import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePolls, queryPolls } from '../web/poll-library.js';
import { validateState } from '../shared/validation.js';
import { libraryFixture } from './fixtures.js';

const state = await libraryFixture();
const entries = summarizePolls(state);

test('20 sondages valides, trois statuts et deux états de résultats', async () => {
  assert.equal((await validateState(state)).polls.length, 20);
  assert.equal(entries.length, 20);
  assert.deepEqual(new Set(entries.map(entry => entry.statusLabel)), new Set(['Brouillon', 'Ouvert', 'Fermé']));
  assert.equal(entries.filter(entry => entry.available).length, 8);
});

test('recherche question sans accents ni différence de casse', () => {
  assert.equal(queryPolls(entries, { search: '  EVASION  ' }).length, 4);
});

test('recherche description et choix, absence de résultat', () => {
  assert.equal(queryPolls(entries, { search: 'Rencontre locale 20' })[0].id, entries[19].id);
  assert.equal(queryPolls(entries, { search: 'cinema' }).length, 20);
  assert.equal(queryPolls(entries, { search: 'introuvable' }).length, 0);
});

test('filtres Tous, Brouillons, Ouverts, Fermés et Résultats disponibles', () => {
  for (const [filter, count] of [['all', 20], ['draft', 4], ['published', 8], ['closed', 8], ['available', 8]]) {
    assert.equal(queryPolls(entries, { filter }).length, count);
  }
});

test('recherche et filtre combinés', () => {
  assert.equal(queryPolls(entries, { filter: 'closed', search: 'locale 20' })[0].id, entries[19].id);
  assert.equal(queryPolls(entries, { filter: 'published', search: 'evasion' }).length, 0);
});

test('tri par défaut récent, anciens et A–Z français', () => {
  assert.equal(queryPolls(entries)[0].id, entries[19].id);
  assert.equal(queryPolls(entries, { sort: 'oldest' })[0].id, entries[0].id);
  assert.equal(queryPolls([...entries].reverse(), { sort: 'alphabetical' })[0].id, entries[0].id);
});

test('tri stable lorsque dates et titres sont identiques', () => {
  const pair = [{ ...entries[0], id: 'b' }, { ...entries[0], id: 'a' }];
  assert.deepEqual(queryPolls(pair).map(entry => entry.id), ['a', 'b']);
  assert.deepEqual(queryPolls(pair, { sort: 'alphabetical' }).map(entry => entry.id), ['a', 'b']);
});

test('brouillon : Modifier et Publier ; aucun vote', () => {
  assert.deepEqual(entries[0].actions.map(action => action.label), ['Modifier', 'Publier']);
  assert.equal(entries[0].actions[1].operation, 'publish');
});

test('ouvert : Voter, Résultats ou Résultats verrouillés, Gérer', () => {
  assert.deepEqual(entries[1].actions.map(action => action.label), ['Voter', 'Résultats 🔒', 'Gérer']);
  assert.deepEqual(entries[2].actions.map(action => action.label), ['Voter', 'Résultats', 'Gérer']);
});

test('fermé : accès direct aux résultats, prioritaire si disponibles', () => {
  assert.deepEqual(entries[4].actions.map(action => action.label), ['Résultats', 'Gérer']);
  assert.equal(entries[4].actions[0].href, `#results/${entries[4].id}`);
  assert.equal(entries[4].actions[0].primary, true);
  assert.deepEqual(entries[3].actions.map(action => action.label), ['Résultats 🔒', 'Gérer']);
  assert.equal(entries[3].available, false);
});

test('compteur masqué sous seuil, caches statistiques ignorés', () => {
  const changed = structuredClone(state); changed.polls[1].stats.totalBallots = 999;
  const projection = summarizePolls(changed);
  assert.equal(Object.hasOwn(projection[1], 'responseCount'), false);
  assert.equal(projection[1].available, false);
  assert.equal(projection[4].responseCount, 5);
});

test('projection, recherche et tri ne modifient aucune donnée', () => {
  const before = structuredClone(state); const order = entries.map(entry => entry.id);
  queryPolls(summarizePolls(state), { search: 'choisir', sort: 'oldest' });
  assert.deepEqual(state, before); assert.deepEqual(entries.map(entry => entry.id), order);
});

test('500 sondages : projection et combinaison recherche/filtre/tri', async () => {
  const large = summarizePolls(await libraryFixture(500));
  assert.equal(large.length, 500);
  assert.equal(queryPolls(large, { filter: 'available' }).length, 200);
  assert.equal(queryPolls(large, { search: 'Atelier 500', filter: 'closed', sort: 'oldest' }).length, 1);
});
