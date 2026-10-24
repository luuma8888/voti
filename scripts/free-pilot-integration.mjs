import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { wrangler, localEnv } from './relay-local.mjs';
import { HttpRelayAdapter } from '../web/http-relay.js';
import { RelayClient } from '../shared/relay-client.js';
import { MemoryRemoteConnectionAdapter } from '../shared/remote-state.js';
import { createAdminCapability, createVoteActionId } from '../shared/relay.js';
import { draft } from '../tests/fixtures.js';
import { makeAsset } from '../shared/assets.js';
import { pngFixture } from '../tests/image-fixtures.js';
import { participationChecks } from './participation-checks.mjs';
import {visualIdentitiesChecks} from './visual-identities-checks.mjs';
import {spacesChecks} from './spaces-checks.mjs';

// Profil local indépendant, sans binding R2, sans credentials et sans ressource distante.
const baseUrl = 'http://127.0.0.1:8787', relayId = 'voti-free-test';
const args = ['--config', 'relay/cloudflare/wrangler.free-test.jsonc'];
const persist = ['--persist-to', `.relay-local/free-${Date.now()}`];
let child, checks = 0;
const check = value => { assert.ok(value); checks++; };
const rejected = async (promise, code) => { await assert.rejects(promise, { code }); checks++; };
const adapter = () => new HttpRelayAdapter({ relayId, baseUrl });
const token = () => `voti-local-test.${Date.now()}.${crypto.randomUUID()}`;
async function sql(command) {
  const proc=wrangler(['d1','execute',relayId,...args,'--local',...persist,'--json','--command',command],{stdio:['ignore','pipe','pipe']});
  let out='';proc.stdout.on('data',c=>out+=c);proc.stderr.resume();assert.equal((await once(proc,'exit'))[0],0,'SQL local de participation refusé.');return JSON.parse(out);
}
try {
  const migration = wrangler(['d1', 'migrations', 'apply', relayId, ...args, '--local', ...persist], { stdio: ['ignore', 'pipe', 'pipe'] });
  migration.stdout.resume(); migration.stderr.resume(); check((await once(migration, 'exit'))[0] === 0);
  child = wrangler(['dev', ...args, '--local', '--test-scheduled', '--ip', '127.0.0.1', '--port', '8787', ...persist], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', chunk => { output = (output + chunk).slice(-4000); }); child.stderr.resume();
  const deadline = Date.now() + 45000;
  while (!output.includes('Ready on http://127.0.0.1:8787')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error('Worker gratuit local non prêt.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if(process.argv.includes('--visual-identities')){const repeat=wrangler(['d1','migrations','apply',relayId,...args,'--local',...persist],{stdio:['ignore','pipe','pipe']});repeat.stdout.resume();repeat.stderr.resume();check((await once(repeat,'exit'))[0]===0);checks+=await visualIdentitiesChecks({adapter:adapter(),sql});}
  if(process.argv.includes('--spaces'))checks+=await spacesChecks({adapter:adapter(),sql});
  if(!process.argv.includes('--spaces-browser-only')){
  checks+=await participationChecks({adapter:adapter(),sql});
  const state = draft(), poll = state.polls[0];
  const store = new MemoryRemoteConnectionAdapter(), creator = new RelayClient(adapter(), store);
  const voter = new RelayClient(adapter(), new MemoryRemoteConnectionAdapter());
  await creator.preparePublication(state, poll.id, token()); check(true);
  await creator.uploadMissingAssets(poll.id, [], { get() { assert.fail('Aucune image attendue'); } }); check(true);
  await creator.publishPoll(poll.id); check((await voter.getPoll(poll.id)).status === 'published');
  const image = await makeAsset(new Blob([pngFixture()], { type: 'image/png' }));
  const initialAuth = await store.get({ relayId, pollId: poll.id });
  await rejected(adapter().putAssets({ pollId: poll.id, adminCapability: initialAuth.adminCapability,
    expectedRevision: initialAuth.remoteRevision, assets: [image] }), 'REMOTE_ASSETS_DISABLED');
  await rejected(voter.getResults(poll.id), 'RESULTS_LOCKED');
  const action = createVoteActionId(); await voter.castVote(poll.id, poll.definition.choices[0].id, action); check(true);
  check((await voter.castVote(poll.id, poll.definition.choices[0].id, action)).alreadyAccepted);
  await rejected(creator.updateDefinition(poll.id, poll.definition, poll.resultRules), 'REVISION_CONFLICT');
  await creator.getPoll(poll.id);
  await rejected(creator.updateDefinition(poll.id, poll.definition, poll.resultRules), 'POLL_LOCKED');
  for (let n = 1; n < 4; n++) await voter.castVote(poll.id, poll.definition.choices[0].id, createVoteActionId());
  await rejected(voter.getResults(poll.id), 'RESULTS_LOCKED');
  await voter.castVote(poll.id, poll.definition.choices[0].id, createVoteActionId());
  check((await voter.getResults(poll.id)).totalBallots === 5);
  await creator.getPoll(poll.id); check((await creator.updateStyle(poll.id, poll.style)).locked);
  const auth = await store.get({ relayId, pollId: poll.id });
  const request = { pollId: poll.id, adminCapability: auth.adminCapability, expectedRevision: auth.remoteRevision };
  await rejected(adapter().putAssets({ ...request, assets: [image] }), 'POLL_LOCKED');
  const illustrated = draft(); illustrated.polls[0].definition.pollImageAssetId = 'sha256-' + 'a'.repeat(64);
  await rejected(adapter().preparePublication({ poll: illustrated.polls[0], localBallots: [], expectedRevision: 0,
    adminCapability: createAdminCapability(), humanVerificationToken: token() }), 'REMOTE_ASSETS_DISABLED');
  await rejected(adapter().getPoll({ pollId: illustrated.polls[0].id }), 'NOT_FOUND');
  await rejected(adapter().getAsset({ pollId: poll.id, assetId: illustrated.polls[0].definition.pollImageAssetId }), 'NOT_FOUND');
  check((await fetch(`${baseUrl}/__scheduled?cron=17+*+*+*+*`)).ok);
  await creator.getPoll(poll.id); await creator.closePoll(poll.id); check((await voter.getPoll(poll.id)).status === 'closed');
  await creator.deletePoll(poll.id); await rejected(voter.getPoll(poll.id), 'NOT_FOUND');
  }
  if (process.argv.includes('--browser')||process.argv.includes('--spaces-browser')) {
    const browser = spawn(process.execPath, ['scripts/browser-test.mjs',...(process.argv.includes('--groups-hd-v2')?['--groups-hd-v2']:[]),...(process.argv.includes('--card-background-batch')?['--card-background-batch']:[]),...(process.argv.includes('--card-ux')?['--card-ux']:[]),...(process.argv.includes('--spaces-browser')?['--spaces',...(process.argv.includes('--space-layout')?['--space-layout']:[]),...(process.argv.includes('--visual-identities')?['--visual-identities']:[])]:[])], { stdio: 'inherit', env: { ...localEnv,
      VOTI_RELAY_URL: baseUrl, VOTI_RELAY_ID: relayId, VOTI_TURNSTILE_MODE: 'local-test',
      VOTI_REMOTE_ASSETS_ENABLED: 'false', VOTI_TEST_FREE_PILOT: '1', VOTI_TEST_PERSIST: persist[1] } });
    check((await once(browser, 'exit'))[0] === 0);
  }
  console.log(`Pilote gratuit local : ${checks} contrôles réussis (HTTP/D1 sans R2).`);
} catch (error) { console.error(`Pilote gratuit local ÉCHEC : ${error.code || error.message}${error.testOperation?' ('+error.testOperation+')':''}`); process.exitCode = 1; }
finally {
  if (child && child.exitCode === null) {
    const exit = once(child, 'exit'); child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000); await exit; clearTimeout(timer);
  }
}
