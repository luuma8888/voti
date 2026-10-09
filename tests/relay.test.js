import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayAdapter, RelayError, RELAY_ERROR_CODES, createAdminCapability, createVoteActionId, publicPollRoute, remoteRef } from '../shared/relay.js';
import { RelayClient } from '../shared/relay-client.js';
import { MemoryRemoteConnectionAdapter, validateRemoteConnection } from '../shared/remote-state.js';
import { LocalStorageRemoteConnectionAdapter, REMOTE_STORAGE_KEY } from '../web/remote-storage.js';
import { InMemoryRelayAdapter } from './in-memory-relay.js';
import { draft, published, votes, now } from './fixtures.js';
import { semanticHash } from '../shared/model.js';
import { makeAsset, MemoryAssetAdapter } from '../shared/assets.js';
import { serialize } from '../shared/serialization.js';

const rejects = (promise, code) => assert.rejects(promise, error => error instanceof RelayError && error.code === code);
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9fkAAAAASUVORK5CYII=';
const image = () => makeAsset(new Blob([Buffer.from(png, 'base64')], { type: 'image/png' }));
async function setup(rules = {}, { prepareOnly = false, state = draft(rules) } = {}) {
  const relay = new InMemoryRelayAdapter({ now });
  const creatorStore = new MemoryRemoteConnectionAdapter(), voterStore = new MemoryRemoteConnectionAdapter();
  const creator = new RelayClient(relay, creatorStore), voter = new RelayClient(relay, voterStore);
  const poll = state.polls[0], id = poll.id, choice = poll.definition.choices[0].id;
  await creator.preparePublication(state, id);
  if (!prepareOnly) await creator.publishPoll(id);
  const admin = async () => {
    const record = await creatorStore.get({ relayId: relay.relayId, pollId: id });
    return { pollId: id, adminCapability: record.adminCapability, expectedRevision: record.remoteRevision };
  };
  const vote = (actionId = createVoteActionId()) => voter.castVote(id, choice, actionId);
  return { relay, creator, voter, creatorStore, voterStore, poll, id, choice, state, admin, vote };
}

test('contrat abstrait, codes structurés et routes publiques sans secret', async () => {
  const adapter = new RelayAdapter('test');
  const methods = Object.getOwnPropertyNames(RelayAdapter.prototype).filter(name => name !== 'constructor');
  for (const method of methods) await rejects(adapter[method]({}), 'RELAY_UNAVAILABLE');
  assert.ok(methods.includes('getAsset')); assert.ok(methods.includes('castVote'));
  assert.ok(!methods.some(name => /ballot|export|inspect/i.test(name)));
  for (const code of RELAY_ERROR_CODES) assert.equal(new RelayError(code).toJSON().code, code);
  const id = crypto.randomUUID();
  assert.equal(publicPollRoute(id), `#/p/${id}`);
  assert.equal(publicPollRoute(id, true), `#/p/${id}/results`);
  assert.throws(() => publicPollRoute('../secret'), { code: 'INVALID_REQUEST' });
  assert.throws(() => remoteRef('https://backend', id, 0), { code: 'INVALID_REQUEST' });
});

test('capacité aléatoire 256 bits, distincte du modèle et de la sauvegarde', async () => {
  const values = new Set(Array.from({ length: 100 }, createAdminCapability));
  assert.equal(values.size, 100);
  for (const value of values) assert.match(value, /^voti-admin-v1\.[a-f0-9]{64}$/);
  const s = await setup();
  const capability = (await s.admin()).adminCapability;
  assert.ok(!(await serialize(s.state)).includes(capability));
  assert.equal(await semanticHash(s.poll), await semanticHash(s.state.polls[0]));
  assert.deepEqual(Object.keys(s.relay), ['relayId']);
  assert.ok(!JSON.stringify(await s.voter.getPoll(s.id)).includes(capability));
  assert.equal((await s.voterStore.list())[0].adminCapability, null);
});

test('deux clients indépendants : publication → vote → verrouillage → seuil → fermeture', async () => {
  const s = await setup();
  const first = await s.voter.getPoll(s.id);
  assert.equal(first.status, 'published'); assert.equal(first.locked, false);
  assert.deepEqual(first.results, { available: false, minimumResponses: 5, releaseMode: 'threshold' });
  await s.vote();
  await rejects(s.creator.updateDefinition(s.id, s.poll.definition, s.poll.resultRules), 'REVISION_CONFLICT');
  const locked = await s.creator.getPoll(s.id);
  assert.equal(locked.locked, true); assert.equal(locked.definitionHash, await semanticHash(s.poll));
  await rejects(s.creator.updateDefinition(s.id, s.poll.definition, s.poll.resultRules), 'POLL_LOCKED');
  for (let i = 1; i < 4; i++) await s.vote();
  await rejects(s.voter.getResults(s.id), 'RESULTS_LOCKED');
  const fifth = await s.vote(); assert.equal(fifth.results.totalBallots, 5);
  assert.equal((await s.voter.getResults(s.id)).choices[0].count, 5);
  await s.vote(); assert.equal((await s.voter.getResults(s.id)).totalBallots, 6);
  await s.creator.getPoll(s.id); assert.equal((await s.creator.closePoll(s.id)).status, 'closed');
  await rejects(s.vote(), 'POLL_CLOSED');
});

test('publication privée tant que le créateur ne finalise pas', async () => {
  const s = await setup({}, { prepareOnly: true });
  await rejects(s.voter.getPoll(s.id), 'NOT_FOUND');
  await rejects(s.vote(), 'NOT_FOUND');
  await rejects(s.voter.getResults(s.id), 'NOT_FOUND');
  await s.creator.publishPoll(s.id);
  assert.equal((await s.voter.getPoll(s.id)).status, 'published');
});

test('préparation idempotente et abandon privé sans résidu public', async () => {
  const s = await setup({}, { prepareOnly: true });
  assert.equal((await s.creator.preparePublication(s.state, s.id)).remoteRef.revision, 0);
  const different = structuredClone(s.state); different.polls[0].definition.question = 'Autre question';
  await rejects(s.creator.preparePublication(different, s.id), 'PUBLICATION_CONFLICT');
  await s.creator.discardPublication(s.id);
  assert.equal((await s.creatorStore.list()).length, 0);
  await rejects(s.voter.getPoll(s.id), 'NOT_FOUND');
});

test('un sondage publié localement sans votes peut être publié au relais', async () => {
  const s = await setup({}, { state: published() });
  assert.equal((await s.voter.getPoll(s.id)).status, 'published');
});

test('bulletins locaux refusés par le client ET directement par le relais', async () => {
  const state = await votes(1), poll = state.polls[0];
  const relay = new InMemoryRelayAdapter({ now });
  const client = new RelayClient(relay, new MemoryRemoteConnectionAdapter());
  await rejects(client.preparePublication(state, poll.id), 'LOCAL_VOTES_PRESENT');
  const request = { poll, localBallots: state.ballots, adminCapability: createAdminCapability(), expectedRevision: 0 };
  await rejects(relay.preparePublication(request), 'LOCAL_VOTES_PRESENT');
  await rejects(relay.preparePublication({ ...request, localBallots: [] }), 'LOCAL_VOTES_PRESENT');
  await rejects(relay.getPoll({ pollId: poll.id }), 'NOT_FOUND');
});

test('capacité invalide ne révèle aucune révision et ne modifie rien', async () => {
  const s = await setup(); const before = await s.voter.getPoll(s.id);
  for (const capability of [null, 'incorrect', createAdminCapability()]) {
    await assert.rejects(s.relay.closePoll({ ...(await s.admin()), adminCapability: capability }), error => {
      assert.equal(error.code, 'INVALID_CAPABILITY'); assert.deepEqual(error.details, {}); return true;
    });
  }
  await rejects(s.voter.closePoll(s.id), 'INVALID_CAPABILITY');
  assert.deepEqual(await s.voter.getPoll(s.id), before);
});

test('révision attendue obligatoire ; une seule modification concurrente gagne', async () => {
  const s = await setup(); const admin = await s.admin();
  const definition = { ...s.poll.definition, question: 'Question corrigée' };
  const results = await Promise.allSettled([
    s.relay.updateDefinition({ ...admin, definition, resultRules: s.poll.resultRules }),
    s.relay.updateStyle({ ...admin, style: { ...s.poll.style, themeId: 'peach' } }),
  ]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].reason.code, 'REVISION_CONFLICT');
  assert.equal((await s.voter.getPoll(s.id)).definition.question, definition.question);
  await rejects(s.relay.closePoll({ ...admin, expectedRevision: undefined }), 'REVISION_CONFLICT');
});

test('course premier vote / modification : vote et verrouillage atomiques', async () => {
  const s = await setup(); const admin = await s.admin();
  const [vote, edit] = await Promise.allSettled([
    s.relay.castVote({ pollId: s.id, actionId: createVoteActionId(), choiceId: s.choice }),
    s.relay.updateDefinition({ ...admin, definition: { ...s.poll.definition, question: 'Trop tard' }, resultRules: s.poll.resultRules }),
  ]);
  assert.equal(vote.value.locked, true); assert.equal(edit.reason.code, 'REVISION_CONFLICT');
  assert.equal((await s.voter.getPoll(s.id)).definition.question, s.poll.definition.question);
});

test('course inverse : la modification gagnante est celle verrouillée par le vote', async () => {
  const s = await setup(); const definition = { ...s.poll.definition, question: 'Nouvelle définition' };
  const [edit, vote] = await Promise.all([
    s.relay.updateDefinition({ ...(await s.admin()), definition, resultRules: s.poll.resultRules }),
    s.vote(),
  ]);
  assert.ok(vote.remoteRef.revision > edit.remoteRef.revision);
  assert.equal((await s.voter.getPoll(s.id)).definitionHash, await semanticHash({ ...s.poll, definition }));
});

test('double envoi concurrent idempotent ; autre choix refusé ; nouvelle action = nouveau vote', async () => {
  const s = await setup({ minimumResponses: 1 }); const actionId = createVoteActionId();
  // Appels directs pour isoler le contrat du cache du client.
  const request = { pollId: s.id, actionId, choiceId: s.choice };
  const pair = await Promise.all([s.relay.castVote(request), s.relay.castVote(request)]);
  assert.equal(pair[0].alreadyAccepted, false); assert.equal(pair[1].alreadyAccepted, true);
  assert.equal(pair[0].remoteRef.revision, pair[1].remoteRef.revision);
  await rejects(s.relay.castVote({ ...request, choiceId: s.poll.definition.choices[1].id }), 'IDEMPOTENCY_CONFLICT');
  assert.equal((await s.vote()).results.totalBallots, 2);
  await s.creator.getPoll(s.id); await s.creator.closePoll(s.id);
  assert.equal((await s.relay.castVote(request)).alreadyAccepted, true);
});

test('actionId scoped par sondage, et non identité de personne', async () => {
  const s = await setup({ minimumResponses: 1 });
  const other = draft({ minimumResponses: 1 }), poll = other.polls[0];
  await s.creator.preparePublication(other, poll.id); await s.creator.publishPoll(poll.id);
  const actionId = createVoteActionId();
  await s.vote(actionId);
  const result = await s.voter.castVote(poll.id, poll.definition.choices[0].id, actionId);
  assert.equal(result.results.totalBallots, 1);
});

test('mode closed exige fermeture ET minimum ; 3 votes fermés restent masqués', async () => {
  for (const count of [3, 5]) {
    const s = await setup({ releaseMode: 'closed' });
    for (let i = 0; i < count; i++) await s.vote();
    await rejects(s.voter.getResults(s.id), 'RESULTS_LOCKED');
    await s.creator.getPoll(s.id); await s.creator.closePoll(s.id);
    if (count === 3) await rejects(s.voter.getResults(s.id), 'RESULTS_LOCKED');
    else assert.equal((await s.voter.getResults(s.id)).totalBallots, 5);
  }
});

test('compteur masqué sur toutes les projections et erreurs, distribution jamais anticipée', async () => {
  for (const showResponseCountBeforeRelease of [false, true]) {
    const s = await setup({ showResponseCountBeforeRelease }); const vote = await s.vote();
    const view = await s.voter.getPoll(s.id);
    for (const projection of [view.results, vote.results]) {
      assert.equal('choices' in projection, false);
      assert.equal('totalBallots' in projection, showResponseCountBeforeRelease);
    }
    await assert.rejects(s.voter.getResults(s.id), error => {
      assert.equal(error.code, 'RESULTS_LOCKED');
      assert.equal('totalBallots' in error.details, showResponseCountBeforeRelease);
      assert.equal('choices' in error.details, false); return true;
    });
    const json = JSON.stringify({ view, vote });
    assert.doesNotMatch(json, /"(?:ballots|stats|capabilityHash|adminCapability|countsByChoice|lockedAt|userId|ip|userAgent|sessionId)":/);
  }
});

test('style après verrouillage et fermeture sans changer empreinte ni règles', async () => {
  const s = await setup(); await s.vote(); const before = await s.creator.getPoll(s.id);
  const after = await s.creator.updateStyle(s.id, { ...before.style, themeId: 'lavender' });
  assert.equal(after.definitionHash, before.definitionHash);
  assert.deepEqual(after.resultRules, before.resultRules);
  await s.creator.closePoll(s.id);
  assert.equal((await s.creator.updateStyle(s.id, s.poll.style)).style.themeId, 'mint');
});

test('requêtes invalides, données personnelles supplémentaires et choix inconnu refusés sans verrouillage', async () => {
  const s = await setup(); const before = await s.voter.getPoll(s.id);
  await rejects(s.relay.castVote({ pollId: s.id, actionId: createVoteActionId(), choiceId: crypto.randomUUID() }), 'INVALID_CHOICE');
  await rejects(s.relay.castVote({ pollId: s.id, actionId: createVoteActionId(), choiceId: s.choice, userId: 'non' }), 'INVALID_REQUEST');
  await rejects(s.relay.getPoll({ pollId: s.id, adminCapability: 'non' }), 'INVALID_REQUEST');
  await rejects(s.relay.updateDefinition({ ...(await s.admin()), definition: { ...s.poll.definition, choices: [] }, resultRules: s.poll.resultRules }), 'INVALID_DEFINITION');
  await rejects(s.relay.getPoll({ pollId: crypto.randomUUID() }), 'NOT_FOUND');
  assert.deepEqual(await s.voter.getPoll(s.id), before);
});

test('limite JSON explicite et aucune mutation après refus', async () => {
  const s = await setup();
  await rejects(s.relay.updateDefinition({ ...(await s.admin()), definition: { ...s.poll.definition, question: 'a'.repeat(70_000) }, resultRules: s.poll.resultRules }), 'PAYLOAD_TOO_LARGE');
  assert.equal((await s.voter.getPoll(s.id)).definition.question, s.poll.definition.question);
});

test('entrées, réponses et cache sont isolés ; aucune navigation ne vote', async () => {
  const state = draft(), before = structuredClone(state);
  const s = await setup({}, { state });
  assert.deepEqual(state, before);
  const view = await s.voter.getPoll(s.id); view.definition.question = 'Mutation externe';
  const request = { ...(await s.admin()), definition: { ...s.poll.definition, question: 'Capturée' }, resultRules: s.poll.resultRules };
  const promise = s.relay.updateDefinition(request); request.definition.question = 'Trop tard'; await promise;
  const result = await s.voter.getPoll(s.id);
  assert.equal(result.definition.question, 'Capturée'); assert.equal(result.locked, false);
  const records = await s.creatorStore.list(); records[0].adminCapability = null;
  assert.ok((await s.admin()).adminCapability);
});

test('asset manquant bloque la publication sans état public partiel', async () => {
  const asset = await image(), state = draft(); state.polls[0].definition.pollImageAssetId = asset.id;
  const s = await setup({}, { state, prepareOnly: true });
  await rejects(s.creator.publishPoll(s.id), 'ASSET_MISSING');
  await rejects(s.voter.getPoll(s.id), 'NOT_FOUND');
  const local = new MemoryAssetAdapter(); await local.put(asset);
  await s.creator.uploadMissingAssets(s.id, [asset.id], local);
  await s.creator.publishPoll(s.id);
  assert.equal((await s.voter.getAsset(s.id, asset.id)).id, asset.id);
});

test('asset contextualisé : hash connu insuffisant sur un autre sondage ou un asset non référencé', async () => {
  const s = await setup(), asset = await image();
  await s.relay.putAssets({ ...(await s.admin()), assets: [asset] });
  await rejects(s.voter.getAsset(s.id, asset.id), 'NOT_FOUND');
  const other = draft(); await s.creator.preparePublication(other, other.polls[0].id);
  await s.creator.publishPoll(other.polls[0].id);
  const auth = await s.creatorStore.get({ relayId: s.relay.relayId, pollId: other.polls[0].id });
  const missing = await s.relay.getMissingAssets({ pollId: auth.pollId, adminCapability: auth.adminCapability, expectedRevision: auth.remoteRevision, assetIds: [asset.id] });
  assert.deepEqual(missing.missingAssetIds, [asset.id]);
  await rejects(s.voter.getAsset(auth.pollId, asset.id), 'NOT_FOUND');
});

test('assets hash/type/dimensions/taille/duplication invalides : batch atomique', async () => {
  const s = await setup({}, { prepareOnly: true }), asset = await image();
  for (const invalid of [
    { ...asset, id: 'sha256-' + '0'.repeat(64) }, { ...asset, width: 2 },
    { ...asset, mimeType: 'image/webp' }, { ...asset, byteLength: asset.byteLength + 1 },
  ]) {
    await rejects(s.relay.putAssets({ ...(await s.admin()), assets: [invalid] }), 'ASSET_INVALID');
    const missing = await s.relay.getMissingAssets({ ...(await s.admin()), assetIds: [asset.id] });
    assert.deepEqual(missing.missingAssetIds, [asset.id]); assert.equal(missing.remoteRef.revision, 0);
  }
  await rejects(s.relay.putAssets({ ...(await s.admin()), assets: [asset, { ...asset, id: 'sha256-' + '0'.repeat(64) }] }), 'ASSET_INVALID');
  assert.deepEqual((await s.relay.getMissingAssets({ ...(await s.admin()), assetIds: [asset.id] })).missingAssetIds, [asset.id]);
  await rejects(s.relay.putAssets({ ...(await s.admin()), assets: [asset, asset] }), 'ASSET_INVALID');
  await rejects(s.relay.putAssets({ ...(await s.admin()), assets: [{ ...asset, blob: new Blob([new Uint8Array(1_000_001)]) }] }), 'PAYLOAD_TOO_LARGE');
});

test('images sémantiques : ajout avant vote, hash incluant référence, changement après vote refusé', async () => {
  const s = await setup(), asset = await image(), local = new MemoryAssetAdapter(); await local.put(asset);
  await s.creator.uploadMissingAssets(s.id, [asset.id], local);
  const definition = structuredClone(s.poll.definition); definition.choices[0].imageRef = asset.id;
  await s.creator.updateDefinition(s.id, definition, s.poll.resultRules);
  assert.equal((await s.voter.getAsset(s.id, asset.id)).width, 1);
  await s.vote(); const view = await s.creator.getPoll(s.id);
  assert.equal(view.definitionHash, await semanticHash({ ...s.poll, definition }));
  assert.notEqual(view.definitionHash, await semanticHash(s.poll));
  await rejects(s.creator.updateDefinition(s.id, s.poll.definition, s.poll.resultRules), 'POLL_LOCKED');
  await rejects(s.relay.putAssets({ ...(await s.admin()), assets: [asset] }), 'POLL_LOCKED');
});

test('référence supprimée avant vote : asset orphelin nettoyé', async () => {
  const s = await setup(), asset = await image(), local = new MemoryAssetAdapter(); await local.put(asset);
  await s.creator.uploadMissingAssets(s.id, [asset.id], local);
  await s.creator.updateDefinition(s.id, { ...s.poll.definition, pollImageAssetId: asset.id }, s.poll.resultRules);
  await s.creator.updateDefinition(s.id, s.poll.definition, s.poll.resultRules);
  await rejects(s.voter.getAsset(s.id, asset.id), 'NOT_FOUND');
  assert.deepEqual((await s.relay.getMissingAssets({ ...(await s.admin()), assetIds: [asset.id] })).missingAssetIds, [asset.id]);
});

test('stockage distant séparé : validation stricte, versions, révisions et capacités', async () => {
  const s = await setup(), record = (await s.creatorStore.list())[0];
  assert.throws(() => validateRemoteConnection({ ...record, formatVersion: 2 }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateRemoteConnection({ ...record, ballots: [] }), { code: 'INVALID_REQUEST' });
  await rejects(s.creatorStore.put({ ...record, remoteRevision: 0, lastKnownRemoteState: null }), 'REVISION_CONFLICT');
  await rejects(s.creatorStore.put({ ...record, adminCapability: createAdminCapability() }), 'INVALID_CAPABILITY');
  await rejects(s.creatorStore.put({ ...record, adminCapability: null }), 'INVALID_CAPABILITY');
  await s.creatorStore.delete(record); assert.deepEqual(await s.creatorStore.list(), []);
});

test('adaptateur localStorage isolé, réouverture, quota et corruption sans remplacement', async () => {
  const values = new Map([['voti.local.v1', 'local intact']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const locks = { request: async (_key, operation) => operation() };
  const adapter = new LocalStorageRemoteConnectionAdapter(storage, locks);
  const s = await setup(), record = (await s.creatorStore.list())[0];
  await adapter.put(record);
  assert.deepEqual(await new LocalStorageRemoteConnectionAdapter(storage, locks).get(record), record);
  assert.equal(values.get('voti.local.v1'), 'local intact');
  const before = values.get(REMOTE_STORAGE_KEY);
  const failing = new LocalStorageRemoteConnectionAdapter({ ...storage, setItem: () => { throw new Error('quota'); } }, locks);
  await rejects(failing.put(record), 'RELAY_UNAVAILABLE'); assert.equal(values.get(REMOTE_STORAGE_KEY), before);
  await rejects(new LocalStorageRemoteConnectionAdapter(storage, null).put(record), 'RELAY_UNAVAILABLE');
  values.set(REMOTE_STORAGE_KEY, 'corrompu');
  await rejects(adapter.put(record), 'RELAY_UNAVAILABLE'); assert.equal(values.get(REMOTE_STORAGE_KEY), 'corrompu');
});

test('échec du stockage de capacité : aucune préparation distante', async () => {
  const relay = new InMemoryRelayAdapter({ now }); const state = draft();
  const connections = new MemoryRemoteConnectionAdapter();
  connections.put = async () => { throw new RelayError('RELAY_UNAVAILABLE'); };
  await rejects(new RelayClient(relay, connections).preparePublication(state, state.polls[0].id), 'RELAY_UNAVAILABLE');
  await rejects(relay.getPoll({ pollId: state.polls[0].id }), 'NOT_FOUND');
});

test('préparation avec réponse perdue : lecture authentifiée retrouve la révision sans fusion', async () => {
  const s = await setup({}, { prepareOnly: true }), asset = await image();
  const stale = await s.admin();
  const uploaded = await s.relay.putAssets({ ...stale, assets: [asset] });
  // Le cache créateur n'a pas vu la réponse d'upload.
  await rejects(s.creator.publishPoll(s.id), 'REVISION_CONFLICT');
  const recovered = await s.relay.getMissingAssets({ ...stale, assetIds: [asset.id] });
  assert.equal(recovered.remoteRef.revision, uploaded.remoteRef.revision);
  assert.deepEqual(recovered.missingAssetIds, []);
  const local = new MemoryAssetAdapter(); await local.put(asset);
  await s.creator.uploadMissingAssets(s.id, [asset.id], local);
  await s.creator.publishPoll(s.id);
});

test('plusieurs votes concurrents ne perdent aucun bulletin et verrouillent une seule définition', async () => {
  const s = await setup({ minimumResponses: 5 });
  const results = await Promise.all(Array.from({ length: 20 }, () => s.relay.castVote({ pollId: s.id, choiceId: s.choice, actionId: createVoteActionId() })));
  assert.equal(new Set(results.map(result => result.remoteRef.revision)).size, 20);
  for (let i = 1; i < results.length; i++) assert.ok(results[i].remoteRef.revision > results[i - 1].remoteRef.revision);
  assert.equal((await s.voter.getResults(s.id)).totalBallots, 20);
  assert.equal((await s.voter.getPoll(s.id)).definitionHash, await semanticHash(s.poll));
});
