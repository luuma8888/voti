import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { wrangler, configArgs, localEnv } from './relay-local.mjs';
import { HttpRelayAdapter } from '../web/http-relay.js';
import { RelayClient } from '../shared/relay-client.js';
import { MemoryRemoteConnectionAdapter } from '../shared/remote-state.js';
import { createAdminCapability, createVoteActionId } from '../shared/relay.js';
import { draft, votes } from '../tests/fixtures.js';
import { makeAsset, MemoryAssetAdapter } from '../shared/assets.js';

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
  child = wrangler(['dev', ...configArgs, '--local', '--test-scheduled', '--ip', '127.0.0.1', '--port', '8787', ...persist], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; workerOutput = output.slice(-3000); }); child.stderr.on('data', chunk => { output += chunk; workerOutput = output.slice(-3000); });
  const deadline = Date.now() + 45000;
  while (!output.includes('Ready on http://127.0.0.1:8787')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Worker local non prêt : ${output.slice(-1500)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
const adapter = () => new HttpRelayAdapter({ relayId: 'voti-local', baseUrl });
async function setup(rules = {}, asset) {
  const state = draft(rules), poll = state.polls[0], store = new MemoryRemoteConnectionAdapter();
  if (asset) { poll.definition.pollImageAssetId = asset.id; poll.definition.choices[0].imageRef = asset.id; }
  const creator = new RelayClient(adapter(), store), voter = new RelayClient(adapter(), new MemoryRemoteConnectionAdapter());
  await creator.preparePublication(state, poll.id);
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
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9fkAAAAASUVORK5CYII=';
  const asset = await makeAsset(new Blob([Buffer.from(png, 'base64')], { type: 'image/png' }));
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
  await rejects(adapter().preparePublication({ poll: localVotes.polls[0], localBallots: localVotes.ballots, expectedRevision: 0, adminCapability: createAdminCapability() }), 'LOCAL_VOTES_PRESENT');
  const badState = draft(), badId = badState.polls[0].id, cap = createAdminCapability();
  await adapter().preparePublication({ poll: badState.polls[0], localBallots: [], expectedRevision: 0, adminCapability: cap });
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
  await stop(); await start();
  check((await s.voter.getResults(id)).totalBallots === 5);
  check((await s.voter.getAsset(id, asset.id)).id === asset.id);
  if (process.argv.includes('--browser')) {
    const browser = spawn(process.execPath, ['scripts/browser-test.mjs'], { stdio: 'inherit', env: { ...localEnv, VOTI_RELAY_URL: baseUrl, VOTI_RELAY_ID: 'voti-local', VOTI_TEST_RELAY: '1' } });
    const [browserCode] = await once(browser, 'exit'); assert.equal(browserCode, 0); checks++;
  }
  console.log(`Relais HTTP local : ${checks} contrôles réussis (Worker, D1, R2, CORS, concurrence, persistance).`);
} catch (error) { console.error(`Relais local ÉCHEC : ${error.stack}`); console.error(workerOutput); process.exitCode = 1; }
finally { await stop(); }
