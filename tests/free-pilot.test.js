import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareRelay } from '../relay/cloudflare/service.js';
import worker from '../relay/cloudflare/worker.js';
import { draft } from './fixtures.js';
import { assertRemoteImagePolicy, remoteImagesAllowed } from '../web/relay-config.js';
import { RelayError, createAdminCapability } from '../shared/relay.js';
import { readFile } from 'node:fs/promises';

const assetId = 'sha256-' + 'a'.repeat(64);
const settings = { RELAY_ID: 'voti-production', REMOTE_ASSETS_ENABLED: 'false' };
const refused = promise => assert.rejects(promise, { code: 'REMOTE_ASSETS_DISABLED' });

test('Migration distante D1 : CASE du trigger parenthésé, validation du bulletin conservée', async () => {
  // Le splitter /query distant confond sinon END du CASE et END du trigger.
  // Reproduit sur la base EU avec EXPLAIN, sans création du trigger diagnostic.
  const sql = await readFile('relay/cloudflare/migrations/0001_initial.sql', 'utf8');
  assert.match(sql, /SELECT \(CASE WHEN NOT EXISTS \([\s\S]*?THEN RAISE\(ABORT, 'INVALID_BALLOT'\) END\);/);
  assert.match(sql, /p\.status = 'published'/);
  assert.match(sql, /json_extract\(c\.value, '\$\.id'\) = NEW\.choice_id/);
});

test('Pilote gratuit : images de question/choix refusées avant toute écriture', async () => {
  const service = new CloudflareRelay({ ...settings, DB: { prepare() { assert.fail('Écriture ou lecture D1 inattendue'); } } });
  for (const question of [true, false]) {
    const state = draft(), poll = state.polls[0];
    if (question) poll.definition.pollImageAssetId = assetId;
    else poll.definition.choices[0].imageRef = assetId;
    const before = structuredClone(state);
    await refused(service.execute('preparePublication', null, { poll, localBallots: [], expectedRevision: 0 }, createAdminCapability()));
    assert.deepEqual(state, before);
  }
});

class PreparedRelay extends CloudflareRelay {
  async admin() {
    const poll = draft().polls[0];
    return { poll_id: poll.id, status: 'published', revision: 1, definition: JSON.stringify(poll.definition), access_rules: JSON.stringify(poll.accessRules) };
  }
}
test('Pilote gratuit : upload refusé, aucun accès R2 ni blob dans D1', async () => {
  const service = new PreparedRelay(settings);
  await refused(service.execute('putAssets', crypto.randomUUID(), { assets: [{}], expectedRevision: 1 }, createAdminCapability()));
  assert.deepEqual((await service.execute('putAssets', crypto.randomUUID(), { assets: [], expectedRevision: 1 }, createAdminCapability())).assetIds, []);
  service.admin = async () => ({ status: 'published', locked: 1 });
  await assert.rejects(service.execute('putAssets', crypto.randomUUID(), { assets: [], expectedRevision: 1 }, createAdminCapability()), { code: 'POLL_LOCKED' });
  service.admin = async () => ({ status: 'closed' });
  await assert.rejects(service.execute('putAssets', crypto.randomUUID(), { assets: [], expectedRevision: 1 }, createAdminCapability()), { code: 'POLL_CLOSED' });
});
test('Pilote gratuit : modification illustrée refusée sans changer la sémantique', async () => {
  const poll = draft().polls[0]; poll.definition.pollImageAssetId = assetId;
  const before = structuredClone(poll);
  await refused(new PreparedRelay(settings).execute('updateDefinition', crypto.randomUUID(), {
    definition: poll.definition, resultRules: poll.resultRules, expectedRevision: 1,
  }, createAdminCapability()));
  assert.deepEqual(poll, before);
});
test('Pilote gratuit : protocole publication sans assets utilisable sans R2', async () => {
  const service = new PreparedRelay(settings), id = crypto.randomUUID();
  const value = await service.execute('getMissingAssets', id, { assetIds: [], expectedRevision: 1 }, createAdminCapability());
  assert.deepEqual(value.missingAssetIds, []);
  await refused(service.execute('getMissingAssets', id, { assetIds: [assetId], expectedRevision: 1 }, createAdminCapability()));
  await service.references(id, draft().polls[0].definition);
});
test('Pilote gratuit : route asset publique NOT_FOUND sans accès D1/R2', async () => {
  const res = await worker.fetch(new Request(`https://relay.example/api/v1/polls/${crypto.randomUUID()}/assets/${assetId}`), {
    ...settings, ASSET_LIMITER: { limit: async () => ({ success: true }) },
  }, { waitUntil() { assert.fail('Cleanup inattendu'); } });
  assert.equal(res.status, 404); assert.equal((await res.json()).error.code, 'NOT_FOUND');
});
test('Politique UI : garde-fou avant challenge/upload, sans retirer les images locales', () => {
  const poll = draft().polls[0], config = { remoteAssetsEnabled: false };
  assertRemoteImagePolicy(config, poll.definition);
  poll.definition.choices[0].imageRef = assetId;
  assert.throws(() => assertRemoteImagePolicy(config, poll.definition), { code: 'REMOTE_ASSETS_DISABLED' });
  assert.equal(poll.definition.choices[0].imageRef, assetId);
  assertRemoteImagePolicy(null, poll.definition);
  assertRemoteImagePolicy({ remoteAssetsEnabled: true }, poll.definition);
  assert.equal(remoteImagesAllowed({}), true);
});
test('Contrat : refus images gratuit sérialisable, configuration R2 locale inchangée', () => {
  const error = new RelayError('REMOTE_ASSETS_DISABLED');
  assert.equal(error.toJSON().code, 'REMOTE_ASSETS_DISABLED');
  new CloudflareRelay({}).checkAssetPolicy({ pollImageAssetId: assetId, choices: [] });
});
test('Production gratuite : compte/base explicites, aucun R2, CORS/Turnstile stricts, configuration publique sans secret', async () => {
  const config = JSON.parse(await readFile('relay/cloudflare/wrangler.production.jsonc', 'utf8'));
  assert.equal(config.name, 'voti-relay'); assert.equal(config.workers_dev, true);
  assert.equal(config.vars.REMOTE_ASSETS_ENABLED, 'false');
  assert.equal(config.vars.ALLOWED_ORIGINS, 'https://luuma8888.github.io');
  assert.equal(config.vars.TURNSTILE_MODE, 'siteverify');
  assert.equal(config.vars.TURNSTILE_HOSTNAMES, 'luuma8888.github.io');
  assert.equal(config.observability.enabled, false);
  assert.equal(config.r2_buckets, undefined);
  assert.equal(config.d1_databases[0].database_name, 'voti-production');
  assert.notEqual(config.d1_databases[0].database_id, '00000000-0000-0000-0000-000000000000');
  assert.equal(config.d1_databases[0].remote, false);
  assert.deepEqual(config.triggers.crons, ['17 * * * *']);
  const client = JSON.parse(await readFile('web/relay-production.json', 'utf8'));
  assert.deepEqual(Object.keys(client).sort(), ['baseUrl', 'relayId', 'remoteAssetsEnabled', 'turnstileMode', 'turnstileSiteKey']);
  assert.equal(client.remoteAssetsEnabled, false); assert.equal(client.relayId, config.vars.RELAY_ID);
  assert.equal(new URL(client.baseUrl).origin, client.baseUrl);
  const local = JSON.parse(await readFile('relay/cloudflare/wrangler.jsonc', 'utf8'));
  assert.equal(local.r2_buckets[0].bucket_name, 'voti-local-assets');
});
