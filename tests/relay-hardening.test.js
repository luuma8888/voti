import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyHuman, limitRoute } from '../relay/cloudflare/abuse.js';
import { cleanup } from '../relay/cloudflare/service.js';
import worker from '../relay/cloudflare/worker.js';
import { validateServerImage, crc32 } from '../relay/cloudflare/image-validation.js';
import { makeAsset } from '../shared/assets.js';
import { pngFixture } from './image-fixtures.js';
import { createAdminCapability } from '../shared/relay.js';
import { exportAdminKey, importAdminKey, parseAdminKey } from '../shared/admin-key.js';
import { MemoryRemoteConnectionAdapter } from '../shared/remote-state.js';
import { LocalStorageRemoteConnectionAdapter } from '../web/remote-storage.js';
import { RelayClient } from '../shared/relay-client.js';
import { InMemoryRelayAdapter } from './in-memory-relay.js';
import { draft } from './fixtures.js';
import { contentId } from '../shared/assets.js';
import { humanVerification } from '../web/human-verification.js';

const request = new Request('https://relay.example/api/v1/publications');
const env = { TURNSTILE_SECRET: 'test-fixture-not-a-real-secret', TURNSTILE_HOSTNAMES: 'luuma8888.github.io' };
const valid = () => ({ success: true, hostname: 'luuma8888.github.io', action: 'voti-publication', challenge_ts: new Date().toISOString() });
const fails = (promise, code) => assert.rejects(promise, { code });
test('Turnstile : vrai protocole Siteverify, token/secret POST seulement, pas de remoteip', async () => {
  await verifyHuman(request, env, 'token-fixture', async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { secret: env.TURNSTILE_SECRET, response: 'token-fixture' });
    return Response.json(valid());
  });
});
test('Turnstile : absence de token, token excessif, secret absent et clé factice fermés', async () => {
  await fails(verifyHuman(request, env), 'HUMAN_VERIFICATION_REQUIRED');
  await fails(verifyHuman(request, env, 'a'.repeat(2049)), 'HUMAN_VERIFICATION_FAILED');
  await fails(verifyHuman(request, {}, 'fixture'), 'RELAY_UNAVAILABLE');
  await fails(verifyHuman(request, { ...env, TURNSTILE_SECRET: '1x0000000000000000000000000000000AA' }, 'fixture'), 'RELAY_UNAVAILABLE');
});
test('Turnstile : service en erreur/JSON corrompu échoue fermé sans divulgation', async () => {
  for (const fetchImpl of [async () => { throw new Error(env.TURNSTILE_SECRET); }, async () => new Response('oops', { status: 500 }), async () => new Response('oops'), async () => Response.json({})]) {
    await fails(verifyHuman(request, env, 'fixture', fetchImpl), 'RELAY_UNAVAILABLE');
  }
});
test('Turnstile : invalidité, replay, expiration, hostname et action refusés', async () => {
  for (const response of [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, { ...valid(), hostname: 'evil.invalid' },
    { ...valid(), action: 'vote' }, { ...valid(), challenge_ts: new Date(Date.now() - 301000).toISOString() }, { ...valid(), challenge_ts: 'bad' }]) {
    await fails(verifyHuman(request, env, 'fixture', async () => Response.json(response)), 'HUMAN_VERIFICATION_FAILED');
  }
});
test('Turnstile local : explicite, loopback uniquement, expiration et replay', async () => {
  const local = new Request('http://127.0.0.1:8787/api/v1/publications'), settings = { TURNSTILE_MODE: 'local-test' };
  const token = `voti-local-test.${Date.now()}.${crypto.randomUUID()}`;
  await verifyHuman(local, settings, token);
  await fails(verifyHuman(local, settings, token), 'HUMAN_VERIFICATION_FAILED');
  await fails(verifyHuman(local, settings, `voti-local-test.${Date.now() - 301000}.${crypto.randomUUID()}`), 'HUMAN_VERIFICATION_FAILED');
  await fails(verifyHuman(request, settings, token), 'RELAY_UNAVAILABLE');
  await fails(verifyHuman(local, settings, 'inventé'), 'HUMAN_VERIFICATION_FAILED');
});
test('Limite création : capacités A/B/C partagent le même quota, admin indépendant', async () => {
  let count = 0; const keys = [], administrative = [];
  const settings = { RELAY_ID: 'test', CREATION_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: ++count <= 2 }; } },
    LIMITER: { limit: async ({ key }) => { administrative.push(key); return { success: true }; } } };
  const caps = Array.from({ length: 3 }, createAdminCapability);
  for (const cap of caps.slice(0, 2)) await limitRoute(settings, 'preparePublication', crypto.randomUUID(), null, cap, true);
  await fails(limitRoute(settings, 'preparePublication', crypto.randomUUID(), null, caps[2], true), 'CREATION_RATE_LIMITED');
  assert.equal(new Set(keys).size, 1);
  await limitRoute(settings, 'closePoll', crypto.randomUUID(), null, caps[0]); assert.equal(administrative.length, 1);
  assert.ok(!administrative[0].includes(caps[0]));
});
test('Assets : 30 jeunes × 7 images, quotas séparés par poll/asset', async () => {
  const keys = new Map(), settings = { ASSET_LIMITER: { limit: async ({ key }) => { const count = (keys.get(key) || 0) + 1; keys.set(key, count); return { success: count <= 600 }; } } };
  for (let youth = 0; youth < 30; youth++) for (let image = 0; image < 7; image++) await limitRoute(settings, 'getAsset', 'poll', `sha256-${image}`);
  assert.equal(keys.size, 7); assert.ok([...keys.values()].every(n => n === 30));
  await limitRoute(settings, 'getAsset', 'other-poll', 'sha256-0'); assert.equal(keys.size, 8);
});
test('Worker : 429 création structuré, aucune nouvelle capacité ne change sa clé', async () => {
  const keys = [], settings = { RELAY_ID: 'test', CREATION_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: false }; } } };
  for (let n = 0; n < 3; n++) {
    const res = await worker.fetch(new Request('http://localhost/api/v1/publications', { method: 'POST', headers: { Authorization: `Bearer ${createAdminCapability()}` }, body: '{}' }), settings, { waitUntil() { assert.fail('Cleanup inattendu'); } });
    assert.equal(res.status, 429); assert.equal((await res.json()).error.code, 'CREATION_RATE_LIMITED'); assert.equal(res.headers.get('retry-after'), '60');
  }
  assert.equal(new Set(keys).size, 1);
});
test('GET public normal : aucun waitUntil/cleanup ni accès R2', async () => {
  const queries = [], settings = { RELAY_ID: 'test', LIMITER: { limit: async () => ({ success: true }) }, ASSET_LIMITER: { limit: async () => ({ success: true }) }, DB: { prepare(query) {
    queries.push(query); return { bind() { return this; }, async first() { return null; } };
  } } };
  const id = crypto.randomUUID();
  for (const path of [`polls/${id}`, `polls/${id}/results`, `polls/${id}/assets/sha256-${'a'.repeat(64)}`]) {
    const res = await worker.fetch(new Request(`http://localhost/api/v1/${path}`), settings, { waitUntil() { assert.fail('GET lance GC'); } });
    assert.equal(res.status, 404);
  }
  assert.ok(queries.every(q => !/garbage|DELETE|publications/.test(q)));
});
test('Cleanup : bornes, R2 échoue, garbage durable et reprise après restart', async () => {
  const keys = new Set(['fail', 'ok']); const queries = []; let failure = true;
  const settings = { ASSETS: { async delete(key) { if (key === 'fail' && failure) throw new Error('R2 indisponible'); } }, DB: { prepare(query) {
    queries.push(query); let key; return { bind(value) { key = value; return this; }, async run() { if (query.includes('DELETE FROM r2_garbage')) keys.delete(key); }, async all() { return { results: [...keys].map(object_key => ({ object_key })) }; } };
  } } };
  const summary = await cleanup(settings); assert.equal(summary.failures, 1); assert.equal(summary.assets, 1); assert.deepEqual([...keys], ['fail']);
  assert.ok(queries.some(q => q.includes('LIMIT 25')) && queries.some(q => q.includes('LIMIT 100')));
  failure = false; let task;
  await worker.scheduled({}, settings, { waitUntil(pending) { task = pending; } }); await task;
  // Exécuter un nouveau passage avec la même base durable, comme après redémarrage.
  await cleanup(settings); assert.equal(keys.size, 0);
});
test('PNG serveur : CRC, inflation zlib et scanlines réellement vérifiés', async () => {
  await validateServerImage(await makeAsset(new Blob([pngFixture()], { type: 'image/png' })));
  const bytes = pngFixture(); bytes[42] ^= 1;
  await fails(validateServerImage(await makeAsset(new Blob([bytes], { type: 'image/png' }))), 'ASSET_INVALID');
  const bad = pngFixture(); bad[42] ^= 1; const end = 41 + bad.readUInt32BE(33);
  bad.writeUInt32BE(crc32(bad.subarray(37, end)), end);
  await fails(validateServerImage(await makeAsset(new Blob([bad], { type: 'image/png' }))), 'ASSET_INVALID');
});
test('WebP serveur : marques réelles normalisées acceptées', async () => {
  for (const name of ['logo', 'background', 'mascot']) {
    const bytes = await readFile(`assets/branding/voti-${name}.webp`);
    await validateServerImage(await makeAsset(new Blob([bytes], { type: 'image/webp' })));
  }
});
test('WebP serveur : chunks ambigus, réservés, dimensions trompeuses et animation rejetés', async () => {
  const original = await readFile('assets/branding/voti-logo.webp');
  const image = await makeAsset(new Blob([original], { type: 'image/webp' }));
  const cases = [];
  if (original.toString('ascii', 12, 16) === 'VP8X') {
    const badFlags = Buffer.from(original); badFlags[20] |= 2; cases.push(badFlags);
    const badSize = Buffer.from(original); badSize[24] ^= 1; cases.push(badSize);
    const reserved = Buffer.from(original); reserved[21] = 1; cases.push(reserved);
  }
  const duplicate = Buffer.concat([original, original.subarray(12)]); duplicate.writeUInt32LE(duplicate.length - 8, 4); cases.push(duplicate);
  const unknown = Buffer.from(original); unknown.write('ANIM', 12); cases.push(unknown);
  assert.ok(cases.length >= 2);
  for (const bytes of cases) {
    const candidate = { ...image, byteLength: bytes.length, id: await contentId(bytes), blob: new Blob([bytes], { type: image.mimeType }) };
    await fails(validateServerImage(candidate), 'ASSET_INVALID');
  }
});
test('PNG serveur : IDAT absent, duplication, CRC invalide et limites dimensions/pixels', async () => {
  const bytes = pngFixture(), image = await makeAsset(new Blob([bytes], { type: 'image/png' }));
  const duplicate = Buffer.concat([bytes.subarray(0, 33), bytes.subarray(8)]);
  const absent = Buffer.concat([bytes.subarray(0, 33), bytes.subarray(bytes.length - 12)]);
  for (const candidate of [duplicate, absent]) await fails(validateServerImage({ ...image, byteLength: candidate.length, blob: new Blob([candidate], { type: image.mimeType }) }), 'ASSET_INVALID');
  await fails(validateServerImage({ ...image, width: 1601 }), 'ASSET_INVALID');
  await fails(validateServerImage({ ...image, mimeType: 'image/jpeg' }), 'ASSET_INVALID');
});
test('PNG serveur : inflation dépassant les dimensions déclarées interrompue', async () => {
  const bytes = pngFixture(100, 256, 256); bytes.writeUInt32BE(1, 16); bytes.writeUInt32BE(1, 20);
  bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
  await fails(validateServerImage(await makeAsset(new Blob([bytes], { type: 'image/png' }))), 'ASSET_INVALID');
});
test('UI challenge local : aucune dépendance DOM/réseau, mode de test interdit hors loopback', async () => {
  const container = { textContent: '' };
  const token = await humanVerification({ baseUrl: 'http://127.0.0.1:8787', turnstileMode: 'local-test' }, container);
  assert.match(token, /^voti-local-test\./); assert.match(container.textContent, /aucune protection humaine réelle/);
  await fails(humanVerification({ baseUrl: 'https://relay.example', turnstileMode: 'local-test' }, container), 'RELAY_UNAVAILABLE');
  await fails(humanVerification({ baseUrl: 'https://relay.example' }, container), 'RELAY_UNAVAILABLE');
});
async function published() {
  const memory = new InMemoryRelayAdapter(), store = new MemoryRemoteConnectionAdapter(), state = draft();
  const client = new RelayClient(memory, store), id = state.polls[0].id;
  await client.preparePublication(state, id); await client.publishPoll(id);
  return { memory, store, client, id, state };
}
test('Contrat mémoire : preuve de création optionnelle transportable, sans simuler un service humain', async () => {
  const relay = new InMemoryRelayAdapter(), connections = new MemoryRemoteConnectionAdapter(), state = draft();
  await new RelayClient(relay, connections).preparePublication(state, state.polls[0].id, 'preuve-fixture');
  const value = await relay.getMissingAssets({ pollId: state.polls[0].id, adminCapability: (await connections.list())[0].adminCapability, expectedRevision: 0, assetIds: [] });
  assert.equal(value.remoteRef.revision, 0); assert.ok(!JSON.stringify(value).includes('preuve-fixture'));
});
test('deletePoll mémoire : capacité, révision, verrouillage, suppression de tous les accès', async () => {
  const s = await published(), auth = await s.store.get({ relayId: 'memory', pollId: s.id });
  await fails(s.memory.deletePoll({ pollId: s.id, adminCapability: createAdminCapability(), expectedRevision: auth.remoteRevision }), 'INVALID_CAPABILITY');
  await s.client.castVote(s.id, s.state.polls[0].definition.choices[0].id, crypto.randomUUID());
  await fails(s.memory.deletePoll({ pollId: s.id, adminCapability: auth.adminCapability, expectedRevision: auth.remoteRevision }), 'REVISION_CONFLICT');
  await s.client.deletePoll(s.id); assert.equal(await s.store.get(auth), null);
  for (const method of ['getPoll', 'getResults', 'getAsset', 'castVote']) await fails(s.memory[method]({ pollId: s.id,
    ...(method === 'getAsset' ? { assetId: 'sha256-' + 'a'.repeat(64) } : method === 'castVote' ? { actionId: crypto.randomUUID(), choiceId: s.state.polls[0].definition.choices[0].id } : {}) }), 'NOT_FOUND');
});
test('Clé : export/import explicite, vérification distante, entrées inchangées', async () => {
  const s = await published(), raw = await exportAdminKey(s.store, 'memory', s.id), empty = new MemoryRemoteConnectionAdapter();
  const key = parseAdminKey(raw, 'memory'); assert.deepEqual(Object.keys(key), ['version', 'relayId', 'pollId', 'adminCapability']);
  await importAdminKey(raw, s.memory, empty);
  assert.equal((await empty.get(key)).adminCapability, key.adminCapability);
  assert.equal(raw, await exportAdminKey(s.store, 'memory', s.id));
});
test('Clé : mauvaise version/relais/poll/capacité refusés, aucune écriture', async () => {
  const s = await published(), key = JSON.parse(await exportAdminKey(s.store, 'memory', s.id));
  for (const delta of [{ version: 2 }, { relayId: 'other' }, { pollId: 'bad' }, { pollId: crypto.randomUUID() }, { adminCapability: 'bad' }, { adminCapability: createAdminCapability() }, { secret: 'extra' }]) {
    const empty = new MemoryRemoteConnectionAdapter();
    await assert.rejects(importAdminKey(JSON.stringify({ ...key, ...delta }), s.memory, empty)); assert.deepEqual(await empty.list(), []);
  }
});
test('Clé : conflit explicite, annulation sans écriture, remplacement confirmé et CAS', async () => {
  const s = await published(), raw = await exportAdminKey(s.store, 'memory', s.id), key = JSON.parse(raw), store = new MemoryRemoteConnectionAdapter();
  const old = createAdminCapability();
  await store.put({ ...(await s.store.get(key)), adminCapability: old });
  await fails(importAdminKey(raw, s.memory, store), 'CAPABILITY_CONFLICT'); assert.equal((await store.get(key)).adminCapability, old);
  await importAdminKey(raw, s.memory, store, { replaceCapability: old }); assert.equal((await store.get(key)).adminCapability, key.adminCapability);
  await fails(store.put({ ...(await store.get(key)), adminCapability: createAdminCapability() }, { replaceCapability: old }), 'CAPABILITY_CONFLICT');
});
test('Clé : adaptateur local garde atomique sous Web Lock', async () => {
  let raw = null; const storage = { getItem() { return raw; }, setItem(_k, value) { raw = value; } };
  const adapter = new LocalStorageRemoteConnectionAdapter(storage, { request(_key, f) { return f(); } });
  const s = await published(), record = (await s.store.list())[0];
  await adapter.put(record); const next = { ...record, adminCapability: createAdminCapability() };
  await fails(adapter.put(next), 'INVALID_CAPABILITY');
  await adapter.put(next, { replaceCapability: record.adminCapability }); assert.equal((await adapter.get(record)).adminCapability, next.adminCapability);
});
