import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageAdapter, Repository } from '../web/storage.js';
import { createPoll, castVote } from '../shared/poll-engine.js';
import { importIntoEmpty, serialize } from '../shared/serialization.js';
import { published, ballot, now } from './fixtures.js';

class FakeStorage {
  raw = null;
  writes = 0;
  fail = false;
  getItem() { return this.raw; }
  setItem(_key, raw) { if (this.fail) throw new Error('quota'); this.raw = raw; this.writes++; }
}

test('initialisation et lecture n’écrivent pas', async () => {
  const storage = new FakeStorage(); const repository = new Repository(new LocalStorageAdapter(storage));
  await repository.load(); assert.equal(storage.writes, 0);
});

test('échec de persistance : état et snapshot conservés', async () => {
  const storage = new FakeStorage(); const repository = new Repository(new LocalStorageAdapter(storage));
  await repository.load(); storage.fail = true;
  await assert.rejects(repository.transact(state => createPoll(state, { question: 'Question', choices: ['A', 'B'] })), /Sauvegarde locale impossible/);
  assert.equal(repository.state.polls.length, 0); assert.equal(storage.raw, null);
});

test('transaction invalide : zéro écriture', async () => {
  const storage = new FakeStorage(); const repository = new Repository(new LocalStorageAdapter(storage));
  await repository.load();
  await assert.rejects(repository.transact(state => ({ ...state, schemaVersion: 8 })), /Version/);
  await assert.rejects(repository.transact(state => importIntoEmpty(state, '{')));
  assert.equal(storage.writes, 0);
});

test('double envoi concurrent sérialisé et idempotent ; une sauvegarde cohérente', async () => {
  const storage = new FakeStorage(); const initial = published(); storage.raw = await serialize(initial);
  const repository = new Repository(new LocalStorageAdapter(storage)); await repository.load(); const action = ballot(initial);
  await Promise.all([repository.transact(state => castVote(state, action, now)), repository.transact(state => castVote(state, action, now))]);
  assert.equal(repository.state.ballots.length, 1);
  const disk = JSON.parse(storage.raw); assert.equal(disk.ballots.length, 1); assert.ok(disk.polls[0].lockedAt);
});

test('détection de modification concurrente pendant calcul asynchrone', async () => {
  const storage = new FakeStorage(); const repository = new Repository(new LocalStorageAdapter(storage)); await repository.load();
  await assert.rejects(repository.transact(async state => {
    const next = createPoll(state, { question: 'Question', choices: ['A', 'B'] });
    storage.raw = '{"changement":"externe"}'; return next;
  }), /autre onglet/);
  assert.equal(storage.writes, 0);
});

test('stockage corrompu ou inaccessible : pas de réinitialisation silencieuse', async () => {
  const storage = new FakeStorage(); storage.raw = 'corrompu';
  const repository = new Repository(new LocalStorageAdapter(storage)); await assert.rejects(repository.load(), /JSON valide/);
  assert.equal(storage.raw, 'corrompu'); assert.equal(storage.writes, 0);
  const blocked = new LocalStorageAdapter({ getItem() { throw new Error('denied'); } });
  assert.throws(() => blocked.read(), /inaccessible/);
});

test('échec d’une transaction ne bloque pas les suivantes', async () => {
  const storage = new FakeStorage(); const repository = new Repository(new LocalStorageAdapter(storage));
  await assert.rejects(repository.transact(state => ({ ...state, schemaVersion: 99 })));
  await repository.transact(state => createPoll(state, { question: 'Question', choices: ['A', 'B'] }));
  assert.equal(repository.state.polls.length, 1);
});

test('verrou partagé : deux repositories ajoutent sans écrasement', async () => {
  const storage = new FakeStorage();
  let pending = Promise.resolve();
  const locks = { request(_key, operation) {
    const task = pending.then(operation); pending = task.catch(() => {}); return task;
  } };
  const first = new Repository(new LocalStorageAdapter(storage), locks);
  const second = new Repository(new LocalStorageAdapter(storage), locks);
  await Promise.all([first.transact(state => createPoll(state, { question: 'Premier', choices: ['A', 'B'] })),
    second.transact(state => createPoll(state, { question: 'Second', choices: ['A', 'B'] }))]);
  assert.equal(JSON.parse(storage.raw).polls.length, 2);
});
