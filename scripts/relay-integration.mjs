import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { wrangler, configArgs, localEnv, localTestArgs } from './relay-local.mjs';
import { HttpRelayAdapter } from '../web/http-relay.js';
import { RelayClient } from '../shared/relay-client.js';
import { MemoryRemoteConnectionAdapter } from '../shared/remote-state.js';
import { createAdminCapability, createVoteActionId } from '../shared/relay.js';
import { draft, votes } from '../tests/fixtures.js';
import { makeAsset, MemoryAssetAdapter } from '../shared/assets.js';
import { pngFixture } from '../tests/image-fixtures.js';
import { exportAdminKey, importAdminKey } from '../shared/admin-key.js';

const baseUrl = 'http://127.0.0.1:8787';
const statePath = `.relay-local/test-${Date.now()}`;
const persist = ['--persist-to', statePath];
let child, checks = 0, workerOutput = '';
const check = value => { assert.ok(value); checks++; };
const rejects = async (promise, code) => { await assert.rejects(promise, error => error.code === code); checks++; };
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exit = once(child, 'exit'); child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000); await exit; clearTimeout(timer);
}
async function start() {
  child = wrangler(['dev', ...configArgs, ...localTestArgs, '--local', '--test-scheduled', '--ip', '127.0.0.1', '--port', '8787', ...persist], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; workerOutput = output.slice(-3000); }); child.stderr.on('data', chunk => { output += chunk; workerOutput = output.slice(-3000); });
  const deadline = Date.now() + 45000;
  while (!output.includes('Ready on http://127.0.0.1:8787')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Worker local non prêt : ${output.slice(-1500)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
const adapter = () => new HttpRelayAdapter({ relayId: 'voti-local', baseUrl });
const token = () => `voti-local-test.${Date.now()}.${crypto.randomUUID()}`;
async function sql(command) {
  const proc = wrangler(['d1', 'execute', 'voti-local', ...configArgs, '--local', ...persist, '--json', '--command', command], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', error = ''; proc.stdout.on('data', chunk => { output += chunk; }); proc.stderr.on('data', chunk => { error += chunk; });
  assert.equal((await once(proc, 'exit'))[0], 0, error);
  return JSON.parse(output);
}
async function setup(rules = {}, asset) {
  const state = draft(rules), poll = state.polls[0], store = new MemoryRemoteConnectionAdapter();
  if (asset) { poll.definition.pollImageAssetId = asset.id; poll.definition.choices[0].imageRef = asset.id; }
  const creator = new RelayClient(adapter(), store), voter = new RelayClient(adapter(), new MemoryRemoteConnectionAdapter());
  await creator.preparePublication(state, poll.id, token());
  if (asset) {
    await rejects(creator.publishPoll(poll.id), 'ASSET_MISSING');
    const assets = new MemoryAssetAdapter(); await assets.put(asset);
    await creator.uploadMissingAssets(poll.id, [asset.id], assets);
  }
  await creator.publishPoll(poll.id);
  const auth = async () => { const c = await store.get({ relayId: 'voti-local', pollId: poll.id }); return { pollId: poll.id, adminCapability: c.adminCapability, expectedRevision: c.remoteRevision }; };
  return { state, poll, creator, voter, auth, vote: () => voter.castVote(poll.id, poll.definition.choices[0].id, createVoteActionId()) };
}
try {
  await mkdir('.relay-local/logs', { recursive: true });
  const migration = wrangler(['d1', 'migrations', 'apply', 'voti-local', ...configArgs, '--local', ...persist], { stdio: ['ignore', 'pipe', 'pipe'] });
  let migrationOutput = ''; migration.stdout.on('data', c => { migrationOutput += c; }); migration.stderr.on('data', c => { migrationOutput += c; });
  const [code] = await once(migration, 'exit'); assert.equal(code, 0, migrationOutput);
  await start();
  const humanState = draft(), humanPoll = humanState.polls[0], humanCap = createAdminCapability();
  const prepare = { poll: humanPoll, localBallots: [], adminCapability: humanCap, expectedRevision: 0 };
  await rejects(adapter().preparePublication(prepare), 'HUMAN_VERIFICATION_REQUIRED');
  await rejects(adapter().preparePublication({ ...prepare, humanVerificationToken: 'invalid' }), 'HUMAN_VERIFICATION_FAILED');
  await rejects(adapter().preparePublication({ ...prepare, humanVerificationToken: `voti-local-test.${Date.now() - 301000}.${crypto.randomUUID()}` }), 'HUMAN_VERIFICATION_FAILED');
  const singleToken = token();
  await adapter().preparePublication({ ...prepare, humanVerificationToken: singleToken });
  const replayState = draft();
  await rejects(adapter().preparePublication({ ...prepare, poll: replayState.polls[0], humanVerificationToken: singleToken }), 'HUMAN_VERIFICATION_FAILED');
  // Une préparation déjà authentifiée se reprend sans nouveau challenge.
  check((await adapter().preparePublication(prepare)).remoteRef.pollId === humanPoll.id);
  const badPng = pngFixture(); badPng[42] ^= 1;
  const corruptImage = await makeAsset(new Blob([badPng], { type: 'image/png' }));
  await rejects(adapter().putAssets({ pollId: humanPoll.id, adminCapability: humanCap, expectedRevision: 0, assets: [corruptImage] }), 'ASSET_INVALID');
  check((await adapter().getMissingAssets({ pollId: humanPoll.id, adminCapability: humanCap, expectedRevision: 0, assetIds: [corruptImage.id] })).missingAssetIds.length === 1);
  const asset = await makeAsset(new Blob([pngFixture()], { type: 'image/png' }));
  const s = await setup({}, asset), id = s.poll.id, choice = s.poll.definition.choices[0].id;
  check((await s.voter.getPoll(id)).definition.pollImageAssetId === asset.id);
  check((await s.voter.getAsset(id, asset.id)).byteLength === asset.byteLength);
  await rejects(s.voter.getResults(id), 'RESULTS_LOCKED');
  const action = createVoteActionId(); const first = await s.voter.castVote(id, choice, action);
  const retry = await s.voter.castVote(id, choice, action);
  check(first.locked && retry.alreadyAccepted && first.remoteRef.revision === retry.remoteRef.revision);
  await rejects(s.voter.castVote(id, s.poll.definition.choices[1].id, action), 'IDEMPOTENCY_CONFLICT');
  await rejects(s.creator.updateDefinition(id, s.poll.definition, s.poll.resultRules), 'REVISION_CONFLICT');
  await s.creator.getPoll(id);
  await rejects(s.creator.updateDefinition(id, s.poll.definition, s.poll.resultRules), 'POLL_LOCKED');
  const styled = await s.creator.updateStyle(id, { ...s.poll.style, themeId: 'peach' }); check(styled.style.themeId === 'peach');
  for (let n = 1; n < 4; n++) await s.vote();
  await rejects(s.voter.getResults(id), 'RESULTS_LOCKED');
  check(!('totalBallots' in (await s.voter.getPoll(id)).results));
  await s.vote(); check((await s.voter.getResults(id)).totalBallots === 5);
  await rejects(adapter().closePoll({ ...(await s.auth()), adminCapability: createAdminCapability() }), 'INVALID_CAPABILITY');
  await s.creator.getPoll(id); await s.creator.closePoll(id); await rejects(s.vote(), 'POLL_CLOSED');
  for (const count of [3, 5]) {
    const closed = await setup({ releaseMode: 'closed' });
    for (let n = 0; n < count; n++) await closed.vote();
    await rejects(closed.voter.getResults(closed.poll.id), 'RESULTS_LOCKED');
    await closed.creator.getPoll(closed.poll.id); await closed.creator.closePoll(closed.poll.id);
    if (count === 3) await rejects(closed.voter.getResults(closed.poll.id), 'RESULTS_LOCKED');
    else check((await closed.voter.getResults(closed.poll.id)).totalBallots === 5);
  }
  const other = await setup();
  await rejects(other.voter.getAsset(other.poll.id, asset.id), 'NOT_FOUND');
  const stale = await other.auth(); await other.vote();
  await rejects(adapter().updateDefinition({ ...stale, definition: other.poll.definition, resultRules: other.poll.resultRules }), 'REVISION_CONFLICT');
  const simultaneous = await setup({ minimumResponses: 1 });
  const outcomes = await Promise.allSettled([simultaneous.vote(), simultaneous.creator.updateDefinition(simultaneous.poll.id, { ...simultaneous.poll.definition, question: 'Course réelle' }, simultaneous.poll.resultRules)]);
  check(outcomes[0].status === 'fulfilled');
  check(outcomes[1].status === 'fulfilled' || outcomes[1].reason.code === 'REVISION_CONFLICT');
  check((await simultaneous.voter.getPoll(simultaneous.poll.id)).locked);
  const localVotes = await votes(1);
  await rejects(adapter().preparePublication({ poll: localVotes.polls[0], localBallots: localVotes.ballots, expectedRevision: 0, adminCapability: createAdminCapability(), humanVerificationToken: token() }), 'LOCAL_VOTES_PRESENT');
  const badState = draft(), badId = badState.polls[0].id, cap = createAdminCapability();
  await adapter().preparePublication({ poll: badState.polls[0], localBallots: [], expectedRevision: 0, adminCapability: cap, humanVerificationToken: token() });
  const badUpload = await fetch(`${baseUrl}/api/v1/publications/${badId}/assets`, { method: 'PUT', headers: { Authorization: `Bearer ${cap}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision: 0, assets: [{ ...asset, blob: undefined, base64: 'invalid' }] }) });
  check((await badUpload.json()).error.code === 'ASSET_INVALID');
  const missing = await adapter().getMissingAssets({ pollId: badId, adminCapability: cap, expectedRevision: 0, assetIds: [asset.id] }); check(missing.missingAssetIds.length === 1);
  // Préparation réellement illustrée, expiration forcée du seul UUID de fixture.
  const staged = await adapter().putAssets({ pollId: badId, adminCapability: cap, expectedRevision: 0, assets: [asset] });
  const expire = wrangler(['d1','execute','voti-local',...configArgs,'--local',...persist,'--command',`UPDATE publications SET expires_at=unixepoch()-1 WHERE poll_id='${badId}'`], { stdio:['ignore','pipe','pipe'] });
  expire.stdout.resume(); expire.stderr.resume(); check((await once(expire,'exit'))[0] === 0);
  await rejects(adapter().publishPoll({ pollId:badId, adminCapability:cap, expectedRevision:staged.remoteRef.revision }), 'NOT_FOUND');
  check((await fetch(baseUrl+'/__scheduled?cron=17+*+*+*+*')).ok);
  await rejects(adapter().getMissingAssets({pollId:badId,adminCapability:cap,expectedRevision:staged.remoteRef.revision,assetIds:[asset.id]}),'NOT_FOUND');
  for (const origin of ['https://luuma8888.github.io', 'http://127.0.0.1:4173']) {
    const response = await fetch(`${baseUrl}/api/v1/polls/${id}`, { headers: { Origin: origin } });
    check(response.status === 200 && response.headers.get('access-control-allow-origin') === origin && response.headers.get('vary') === 'Origin');
    check(!response.headers.has('access-control-allow-credentials'));
  }
  const refused = await fetch(`${baseUrl}/api/v1/polls/${id}`, { headers: { Origin: 'https://luuma8888.github.io.attacker.invalid' } }); check(refused.status === 403);
  const options = await fetch(`${baseUrl}/api/v1/polls/${id}/style`, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:4173', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'Authorization, Content-Type' } }); check(options.status === 204);
  const huge = await fetch(`${baseUrl}/api/v1/polls/${id}/votes`, { method: 'POST', body: ' '.repeat(66_000) }); check(huge.status === 413);
  for (const suffix of ['ballots', 'rawBallots', 'listBallots']) check((await fetch(`${baseUrl}/api/v1/polls/${id}/${suffix}`)).status === 404);
  const rateId = crypto.randomUUID(); let limited = false;
  for (let n = 0; n < 125; n++) { const response = await fetch(`${baseUrl}/api/v1/polls/${rateId}`); if (response.status === 429) { limited = (await response.json()).error.code === 'RATE_LIMITED'; break; } }
  check(limited);
  // 7 assets indépendants, 30 arrivées simultanées normales : aucun 429.
  const groupState = draft(), groupPoll = groupState.polls[0], groupStore = new MemoryRemoteConnectionAdapter();
  const groupCreator = new RelayClient(adapter(), groupStore), groupAssets = new MemoryAssetAdapter();
  const pictures = [];
  for (let n = 0; n < 7; n++) { const image = await makeAsset(new Blob([pngFixture(30 + n)], { type: 'image/png' })); pictures.push(image); await groupAssets.put(image); }
  const template = groupPoll.definition.choices[0];
  groupPoll.definition.choices = Array.from({ length: 6 }, (_, n) => ({ ...template, id: crypto.randomUUID(), order: n, label: `Choix ${n + 1}`, imageRef: pictures[n + 1].id }));
  groupPoll.definition.pollImageAssetId = pictures[0].id;
  groupPoll.stats.countsByChoice = Object.fromEntries(groupPoll.definition.choices.map(c => [c.id, 0]));
  await groupCreator.preparePublication(groupState, groupPoll.id, token());
  await groupCreator.uploadMissingAssets(groupPoll.id, pictures.map(a => a.id), groupAssets); await groupCreator.publishPoll(groupPoll.id);
  const arrivals = await Promise.all(Array.from({ length: 30 }, async () => Promise.all(pictures.map(image => fetch(`${baseUrl}/api/v1/polls/${groupPoll.id}/assets/${image.id}`)))));
  check(arrivals.flat().every(res => res.status === 200));
  check(arrivals[0].every(res => res.headers.get('cache-control') === 'private, max-age=300, immutable' && res.headers.get('etag')?.startsWith('"sha256-')));
  const groupConnection = await groupStore.get({ relayId: 'voti-local', pollId: groupPoll.id });
  const rawKey = await exportAdminKey(groupStore, 'voti-local', groupPoll.id), imported = new MemoryRemoteConnectionAdapter();
  check((await importAdminKey(rawKey, adapter(), imported)).definition.question === groupPoll.definition.question);
  await rejects(importAdminKey(JSON.stringify({ ...JSON.parse(rawKey), adminCapability: createAdminCapability() }), adapter(), new MemoryRemoteConnectionAdapter()), 'INVALID_CAPABILITY');
  const groupVoter = new RelayClient(adapter(), new MemoryRemoteConnectionAdapter());
  await groupVoter.castVote(groupPoll.id, groupPoll.definition.choices[0].id, createVoteActionId());
  await rejects(adapter().deletePoll({ pollId: groupPoll.id, adminCapability: createAdminCapability(), expectedRevision: groupConnection.remoteRevision }), 'INVALID_CAPABILITY');
  await rejects(groupCreator.deletePoll(groupPoll.id), 'REVISION_CONFLICT');
  await groupCreator.getPoll(groupPoll.id); await groupCreator.deletePoll(groupPoll.id);
  check(await groupStore.get(groupConnection) === null);
  for (const operation of [() => adapter().getPoll({ pollId: groupPoll.id }), () => adapter().getResults({ pollId: groupPoll.id }),
    () => adapter().getAsset({ pollId: groupPoll.id, assetId: pictures[0].id }), () => adapter().castVote({ pollId: groupPoll.id, choiceId: groupPoll.definition.choices[0].id, actionId: createVoteActionId() })]) await rejects(operation(), 'NOT_FOUND');
  const rows = (await sql(`SELECT (SELECT COUNT(*) FROM polls WHERE poll_id='${groupPoll.id}') polls,
    (SELECT COUNT(*) FROM ballots WHERE poll_id='${groupPoll.id}') ballots,
    (SELECT COUNT(*) FROM asset_links WHERE poll_id='${groupPoll.id}') links,
    (SELECT COUNT(*) FROM asset_refs WHERE poll_id='${groupPoll.id}') refs,
    (SELECT COUNT(*) FROM publications WHERE poll_id='${groupPoll.id}') preparations,
    (SELECT COUNT(*) FROM r2_garbage WHERE object_key LIKE 'polls/${groupPoll.id}/%') garbage`))[0].results[0];
  check(rows.polls === 0 && rows.ballots === 0 && rows.links === 0 && rows.refs === 0 && rows.preparations === 0 && rows.garbage === 7);
  await stop(); await start();
  check((await s.voter.getResults(id)).totalBallots === 5);
  check((await s.voter.getAsset(id, asset.id)).id === asset.id);
  // Garbage survit au redémarrage ; aucun GET ne le consomme, cron le vide.
  check((await sql(`SELECT COUNT(*) n FROM r2_garbage WHERE object_key LIKE 'polls/${groupPoll.id}/%'`))[0].results[0].n === 7);
  check((await fetch(baseUrl + '/__scheduled?cron=17+*+*+*+*')).ok);
  check((await sql(`SELECT COUNT(*) n FROM r2_garbage WHERE object_key LIKE 'polls/${groupPoll.id}/%'`))[0].results[0].n === 0);
  // 26 préparations expirées synthétiques : chaque passage supprime AU PLUS 25.
  const expiredIds = Array.from({ length: 26 }, () => crypto.randomUUID());
  const seed = expiredIds.map(pollId => `INSERT INTO polls(poll_id,status,definition,style,access_rules,result_rules,semantic_hash,capability_hash,created_at)
    SELECT '${pollId}','draft',definition,style,access_rules,result_rules,semantic_hash,capability_hash,unixepoch()-90000 FROM polls WHERE poll_id='${id}';
    INSERT INTO publications VALUES('${pollId}',unixepoch()-1,'{}');`).join('\n');
  await sql(seed);
  check((await fetch(baseUrl + '/__scheduled?cron=17+*+*+*+*')).ok);
  check((await sql('SELECT COUNT(*) n FROM publications WHERE expires_at<=unixepoch()'))[0].results[0].n === 1);
  check((await fetch(baseUrl + '/__scheduled?cron=17+*+*+*+*')).ok);
  check((await sql('SELECT COUNT(*) n FROM publications WHERE expires_at<=unixepoch()'))[0].results[0].n === 0);
  // Publié/fermé restent disponibles, indépendamment de leur ancienneté.
  await sql(`UPDATE polls SET created_at=0,published_at=1,closed_at=2 WHERE poll_id='${id}'`);
  check((await s.voter.getPoll(id)).status === 'closed');
  if (process.argv.includes('--browser')) {
    const browser = spawn(process.execPath, ['scripts/browser-test.mjs'], { stdio: 'inherit', env: { ...localEnv, VOTI_RELAY_URL: baseUrl, VOTI_RELAY_ID: 'voti-local', VOTI_TURNSTILE_MODE: 'local-test', VOTI_TEST_RELAY: '1' } });
    const [browserCode] = await once(browser, 'exit'); assert.equal(browserCode, 0); checks++;
  }
  // Fenêtre neuve pour le quota réel edge : nouvelles capacités ne le réinitialisent pas.
  await stop(); await start(); let creationLimited = false, created = 0;
  for (let n = 0; n < 40; n++) {
    const state = draft();
    try { await adapter().preparePublication({ poll: state.polls[0], localBallots: [], expectedRevision: 0, adminCapability: createAdminCapability(), humanVerificationToken: token() }); created++; }
    catch (error) { if (error.code !== 'CREATION_RATE_LIMITED') throw error; creationLimited = true; break; }
  }
  check(created >= 2 && creationLimited);
  // Les opérations d'un sondage existant ne partagent pas le quota de création.
  await s.creator.getPoll(id); check((await s.creator.updateStyle(id, s.poll.style)).status === 'closed');
  console.log(`Relais HTTP local : ${checks} contrôles réussis (Worker, D1, R2, CORS, concurrence, persistance).`);
} catch (error) { console.error(`Relais local ÉCHEC : ${error.stack}`); console.error(workerOutput); process.exitCode = 1; }
finally { await stop(); }
