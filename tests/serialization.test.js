import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, MAX_JSON_LENGTH } from '../shared/model.js';
import { parseExport, serialize, importIntoEmpty } from '../shared/serialization.js';
import { votes, draft } from './fixtures.js';

test('export/import complet, empreinte et bulletins conservés', async () => {
  const state = await votes(6);
  assert.deepEqual(await importIntoEmpty(emptyState(), await serialize(state)), state);
});

test('cache statistique recalculé à l’import', async () => {
  const state = await votes(4); state.polls[0].stats.totalBallots = 999;
  const imported = await parseExport(JSON.stringify(state));
  assert.equal(imported.polls[0].stats.totalBallots, 4);
});

test('version inconnue, JSON invalide et fichier volumineux refusés', async () => {
  await assert.rejects(parseExport('{'), /JSON valide/);
  await assert.rejects(parseExport(JSON.stringify({ ...emptyState(), schemaVersion: 9 })), /Version de schéma inconnue/);
  await assert.rejects(parseExport(' '.repeat(MAX_JSON_LENGTH + 1)), /volumineux/);
});

test('import sur espace non vide refusé, aucune mutation', async () => {
  const current = await votes(1); const before = structuredClone(current);
  await assert.rejects(importIntoEmpty(current, await serialize(current)), /contient déjà/);
  assert.deepEqual(current, before);
});

for (const [label, mutate] of [
  ['choix étranger', state => { state.ballots[0].choiceId = crypto.randomUUID(); }],
  ['sondage absent', state => { state.ballots[0].pollId = crypto.randomUUID(); }],
  ['bulletin dupliqué', state => { state.ballots.push(structuredClone(state.ballots[0])); }],
  ['sondage dupliqué', state => { state.polls.push(structuredClone(state.polls[0])); }],
  ['choix dupliqué', state => { state.polls[0].definition.choices[1].id = state.polls[0].definition.choices[0].id; }],
  ['horodatage de bulletin', state => { state.ballots[0].createdAt = '2026-10-09T10:00:00.000Z'; }],
  ['identité de bulletin', state => { state.ballots[0].userId = 'personne'; }],
  ['fond modifié après verrouillage', state => { state.polls[0].definition.question = 'Altération'; }],
  ['règle modifiée après verrouillage', state => { state.polls[0].resultRules.minimumResponses = 1; }],
  ['verrouillage manquant', state => { state.polls[0].lockedAt = null; state.polls[0].definitionHash = null; }],
  ['brouillon avec bulletins', state => { state.polls[0].status = 'draft'; state.polls[0].publishedAt = null; }],
  ['nominatif', state => { state.polls[0].definition.privacy = 'named'; }],
  ['style malveillant', state => { state.polls[0].style.accent = 'url(https://example.com)'; }],
  ['date invalide', state => { state.polls[0].createdAt = 'hier'; }]
]) test(`import incohérent refusé : ${label}`, async () => {
  const state = await votes(1); mutate(state);
  await assert.rejects(parseExport(JSON.stringify(state)));
});

test('texte HTML conservé comme texte, pas filtré en silence', async () => {
  const state = draft(); state.polls[0].definition.question = '<img src=x onerror="window.hacked=true">';
  const next = await parseExport(JSON.stringify(state));
  assert.equal(next.polls[0].definition.question, state.polls[0].definition.question);
});
