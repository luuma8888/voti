import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAsset, MemoryAssetAdapter, assetReferences } from '../shared/assets.js';
import { inspectImage } from '../shared/image-format.js';
import { migrateState } from '../shared/migration.js';
import { emptyState, semanticHash } from '../shared/model.js';
import { validateState } from '../shared/validation.js';
import { parseExport } from '../shared/serialization.js';
import { exportBackup, parseBackup, restoreBackup } from '../shared/backup.js';
import { updateSemantics, publishPoll, castVote, updateStyle } from '../shared/poll-engine.js';
import { Repository, LocalStorageAdapter } from '../web/storage.js';
import { assetDatabaseName } from '../web/asset-storage.js';
import { draft, votes, ballot, now } from './fixtures.js';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9fkAAAAASUVORK5CYII=', 'base64');
async function asset() { return makeAsset(new Blob([pixel], { type: 'image/png' })); }
function harness({ fail = false, assets = new MemoryAssetAdapter() } = {}) {
  const storage = { raw: null, writes: 0, getItem() { return this.raw; }, setItem(_key, value) { if (fail) throw new Error('quota'); this.raw = value; this.writes++; } };
  let pending = Promise.resolve();
  const locks = { request(_key, task) { const next = pending.then(task); pending = next.catch(() => {}); return next; } };
  return { storage, assets, repository: new Repository(new LocalStorageAdapter(storage), locks, assets) };
}
async function pictured() {
  const state = draft(), image = await asset();
  state.polls[0].definition.pollImageAssetId = image.id;
  state.polls[0].definition.choices[0].imageRef = image.id;
  return { state, image };
}
async function legacy(state) {
  const old = structuredClone(state); old.schemaVersion = 1;
  for (const poll of old.polls) {
    poll.schemaVersion = 1; delete poll.definition.pollImageAssetId;
    if (poll.lockedAt) poll.definitionHash = await semanticHash(poll);
  }
  return old;
}

test('AssetAdapter : identité de contenu stable, put/get/has/delete et métadonnées sans blob', async () => {
  const adapter = new MemoryAssetAdapter(), image = await asset();
  assert.equal(image.id, (await asset()).id);
  assert.equal(await adapter.has(image.id), false);
  assert.equal(await adapter.put(image), image.id);
  assert.equal(await adapter.has(image.id), true);
  assert.deepEqual(await (await adapter.get(image.id)).blob.arrayBuffer(), await image.blob.arrayBuffer());
  const list = await adapter.listMetadata(); assert.equal(list.length, 1); assert.equal('blob' in list[0], false);
  assert.equal(list[0].width, 1); assert.equal(list[0].byteLength, pixel.length);
  await adapter.put(image); assert.equal((await adapter.listMetadata()).length, 1);
  await adapter.delete(image.id); assert.equal(await adapter.get(image.id), null);
});
test('ID invalide, contenu remplacé et métadonnées incohérentes refusés', async () => {
  const adapter = new MemoryAssetAdapter(), image = await asset();
  await adapter.put(image);
  for (const change of [{ id:'https://example.com/a.png' }, { id:'sha256-'+'0'.repeat(64) }, { width:2 }, { byteLength:1 }, { mimeType:'image/svg+xml' }]) {
    await assert.rejects(adapter.put({ ...image, ...change }));
    assert.equal((await adapter.listMetadata()).length, 1);
  }
});
test('quota et lot invalide : aucune écriture partielle', async () => {
  const image = await asset(), limited = new MemoryAssetAdapter({ quota:1 });
  await assert.rejects(limited.put(image), /Quota/); assert.deepEqual(await limited.listMetadata(), []);
  const adapter = new MemoryAssetAdapter();
  await assert.rejects(adapter.putMany([image, { ...image, width:2 }]));
  assert.deepEqual(await adapter.listMetadata(), []);
});
test('nettoyage orphelins protège une image partagée encore référencée', async () => {
  const { state, image } = await pictured(), adapter = new MemoryAssetAdapter(); await adapter.put(image);
  state.polls[0].definition.pollImageAssetId = null;
  assert.deepEqual(await adapter.collectOrphans(assetReferences(state).keys()), []);
  state.polls[0].definition.choices[0].imageRef = null;
  assert.deepEqual(await adapter.collectOrphans(assetReferences(state).keys()), [image.id]);
});
test('formats inconnus, SVG, GIF, PNG tronqué et dimensions excessives refusés avant décodage', () => {
  for (const value of ['<svg xmlns="http://www.w3.org/2000/svg"/>', 'GIF89a000000000000000000', 'not an image']) assert.throws(() => inspectImage(new TextEncoder().encode(value)));
  assert.throws(() => inspectImage(pixel.subarray(0, 40)));
  const huge = new Uint8Array(pixel); new DataView(huge.buffer).setUint32(16, 20000); assert.throws(() => inspectImage(huge), /Dimensions/);
});
test('migration v1 brouillon et verrouillé : déterministe, sources intactes et ancien hash vérifié', async () => {
  for (const original of [draft(), await votes(2)]) {
    const old = await legacy(original), before = structuredClone(old);
    const next = await migrateState(old);
    assert.equal(next.schemaVersion, 2); assert.equal(next.polls[0].definition.pollImageAssetId, null);
    assert.deepEqual(await migrateState(old), next); assert.deepEqual(old, before);
    assert.deepEqual(await parseExport(JSON.stringify(old)), next);
    assert.deepEqual(next.ballots, old.ballots); await validateState(next);
    if (old.polls[0].lockedAt) {
      assert.notEqual(next.polls[0].definitionHash, old.polls[0].definitionHash);
      old.polls[0].definition.question = 'Altérée'; await assert.rejects(migrateState(old), /empreinte/);
    }
  }
});
test('versions inconnues et anciennes références d’images ambiguës refusées', async () => {
  await assert.rejects(migrateState({ ...emptyState(), schemaVersion:3 }), /Version/);
  const old = await legacy(draft()); old.polls[0].definition.choices[0].imageRef = (await asset()).id;
  await assert.rejects(migrateState(old), /Référence/);
});
test('images sémantiques : modification avant vote, empreinte et verrouillage au premier bulletin', async () => {
  const { state, image } = await pictured(), poll = state.polls[0];
  const changed = structuredClone(poll.definition); changed.pollImageAssetId = null;
  assert.notEqual(await semanticHash(poll), await semanticHash({ ...poll, definition:changed }));
  const changedChoice = structuredClone(poll.definition); changedChoice.choices[0].imageRef = null;
  assert.notEqual(await semanticHash(poll), await semanticHash({ ...poll, definition:changedChoice }));
  assert.equal(updateSemantics(state, poll.id, changed, poll.resultRules).polls[0].definition.pollImageAssetId, null);
  const opened = publishPoll(state, poll.id, now), locked = await castVote(opened, ballot(opened), now);
  assert.equal(locked.polls[0].definition.pollImageAssetId, image.id);
  assert.throws(() => updateSemantics(locked, poll.id, changedChoice, poll.resultRules), /verrouillé/);
  const styled = updateStyle(locked, poll.id, { ...poll.style, themeId:'peach' });
  assert.equal(styled.polls[0].definitionHash, locked.polls[0].definitionHash);
  assert.equal(styled.polls[0].definition.pollImageAssetId, image.id);
  const corrupt = structuredClone(locked); corrupt.polls[0].definition.pollImageAssetId = null;
  await assert.rejects(validateState(corrupt), /empreinte/);
});
test('backup sans asset et import ancien format', async () => {
  const adapter = new MemoryAssetAdapter();
  const raw = await exportBackup(draft(), adapter), parsed = await parseBackup(raw);
  assert.equal(parsed.state.polls.length, 1); assert.deepEqual(parsed.assets, []);
  assert.equal((await parseBackup(JSON.stringify(await legacy(draft())))).state.schemaVersion, 2);
});
test('backup image sondage et choix : une seule copie de l’asset partagé, décodage obligatoire', async () => {
  const { state, image } = await pictured(), adapter = new MemoryAssetAdapter(); await adapter.put(image);
  const raw = await exportBackup(state, adapter); let verified = 0;
  await assert.rejects(parseBackup(raw), /décodage/);
  const parsed = await parseBackup(raw, async () => { verified++; });
  assert.equal(verified, 1); assert.equal(parsed.assets.length, 1); assert.deepEqual(parsed.state, state);
  const target = harness(); await restoreBackup(target.repository, raw, async () => {});
  assert.equal(await target.assets.has(image.id), true); assert.equal(JSON.parse(target.storage.raw).polls[0].definition.pollImageAssetId, image.id);
  assert.doesNotMatch(target.storage.raw, /base64|byteLength|mimeType/);
});
for (const [name, mutate] of [
  ['asset absent', data => { data.assets = []; }],
  ['doublon', data => { data.assets.push(data.assets[0]); }],
  ['corruption', data => { data.assets[0].base64 = 'A'.repeat(data.assets[0].base64.length); }],
  ['version backup', data => { data.backupVersion = 99; }],
  ['version état', data => { data.state.schemaVersion = 99; }],
  ['référence invalide', data => { data.state.polls[0].definition.pollImageAssetId = 'file:///secret'; }],
  ['dimensions', data => { data.assets[0].width++; }],
  ['asset inutilisé', data => { data.state.polls[0].definition.pollImageAssetId = null; data.state.polls[0].definition.choices[0].imageRef = null; }],
]) test(`import ${name} : refus complet avant écriture`, async () => {
  const { state, image } = await pictured(), adapter = new MemoryAssetAdapter(); await adapter.put(image);
  const data = JSON.parse(await exportBackup(state, adapter)); mutate(data);
  const target = harness(); await assert.rejects(restoreBackup(target.repository, JSON.stringify(data), async () => {}));
  assert.equal(target.storage.writes, 0); assert.deepEqual(await target.assets.listMetadata(), []);
});
test('échec du décodage réel injecté : zéro écriture', async () => {
  const { state, image } = await pictured(), adapter = new MemoryAssetAdapter(); await adapter.put(image);
  const target = harness();
  await assert.rejects(restoreBackup(target.repository, await exportBackup(state, adapter), async () => { throw new Error('décodage'); }), /décodage/);
  assert.equal(target.storage.writes, 0); assert.deepEqual(await target.assets.listMetadata(), []);
});
test('échec localStorage après écriture des blobs : rollback des assets, état intact', async () => {
  const { state, image } = await pictured(), target = harness({ fail:true });
  await assert.rejects(target.repository.transact(() => state, [image]), /Sauvegarde locale impossible/);
  assert.equal(target.storage.raw, null); assert.deepEqual(target.repository.state, emptyState()); assert.deepEqual(await target.assets.listMetadata(), []);
});
test('échec de quota d’assets : aucun snapshot publié', async () => {
  const { state, image } = await pictured(), target = harness({ assets:new MemoryAssetAdapter({ quota:1 }) });
  await assert.rejects(target.repository.transact(() => state, [image]), /Quota/);
  assert.equal(target.storage.raw, null); assert.equal(target.storage.writes, 0);
});
test('retrait sauvegardé et reprise après interruption nettoient seulement les orphelins', async () => {
  const { state, image } = await pictured(), target = harness();
  await target.repository.transact(() => state, [image]); await target.repository.recoverAssets(); assert.equal(await target.assets.has(image.id), true);
  await target.repository.transact(current => { current.polls[0].definition.pollImageAssetId = null; current.polls[0].definition.choices[0].imageRef = null; return current; });
  assert.equal(await target.assets.has(image.id), false);
  await target.assets.put(image); await target.repository.recoverAssets(); assert.equal(await target.assets.has(image.id), false);
});
test('import sur espace occupé et refs absentes : aucune écriture d’asset', async () => {
  const { state, image } = await pictured(), source = new MemoryAssetAdapter(); await source.put(image);
  const target = harness(); await target.repository.transact(() => draft());
  const before = target.storage.raw;
  await assert.rejects(restoreBackup(target.repository, await exportBackup(state, source), async () => {}), /contient déjà/);
  assert.equal(target.storage.raw, before); assert.deepEqual(await target.assets.listMetadata(), []);
  await assert.rejects(target.repository.transact(() => state), /Asset absent/);
});

test('échec de nettoyage explicite puis reprise, jamais de faux succès de transaction', async () => {
  const { state, image } = await pictured(), adapter = new MemoryAssetAdapter();
  const remove = adapter.deleteMany.bind(adapter);
  adapter.deleteMany = async () => { throw new Error('stockage bloqué'); };
  const target = harness({ fail:true, assets:adapter });
  await assert.rejects(target.repository.transact(() => state, [image]), /Nettoyage des images en attente/);
  assert.equal(target.storage.raw, null);
  adapter.deleteMany = remove;
  await target.repository.recoverAssets(); assert.deepEqual(await adapter.listMetadata(), []);
});
test('nettoyage après commit échoué : snapshot publié et avertissement, reprise sans perte', async () => {
  const { state, image } = await pictured(), target = harness();
  await target.repository.transact(() => state, [image]);
  const remove = target.assets.deleteMany.bind(target.assets);
  target.assets.deleteMany = async () => { throw new Error('bloqué'); };
  const next = await target.repository.transact(current => {
    current.polls[0].definition.pollImageAssetId = null; current.polls[0].definition.choices[0].imageRef = null; return current;
  });
  assert.equal(next.polls[0].definition.pollImageAssetId, null); assert.match(target.repository.warning, /Enregistrement réussi/);
  target.assets.deleteMany = remove; await target.repository.recoverAssets(); assert.equal(await target.assets.has(image.id), false);
});
test('reprise sur snapshot corrompu ne supprime aucun asset', async () => {
  const target = harness(), image = await asset(); await target.assets.put(image); target.storage.raw = 'corrompu';
  await assert.rejects(target.repository.recoverAssets()); assert.equal(await target.assets.has(image.id), true);
});
test('absence de Web Locks : édition avec images refusée avant écriture', async () => {
  const { state, image } = await pictured(), target = harness(); target.repository.locks = null;
  await assert.rejects(target.repository.transact(() => state, [image]), /verrous locaux/);
  assert.equal(target.storage.raw, null); assert.deepEqual(await target.assets.listMetadata(), []);
});
test('file:// : deux documents ne partagent pas une base susceptible de nettoyer les images de l’autre', () => {
  const first = assetDatabaseName({ protocol:'file:', pathname:'/a/index.html' });
  const second = assetDatabaseName({ protocol:'file:', pathname:'/b/index.html' });
  assert.notEqual(first, second);
  assert.equal(first, assetDatabaseName({ protocol:'file:', pathname:'/a/index.html', hash:'#vote/a' }));
  assert.equal(assetDatabaseName({ protocol:'https:', pathname:'/voti/' }), 'voti.assets.v1');
});
