import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, recalculateStats, semanticHash } from '../shared/model.js';
import { createPoll, publishPoll, closePoll, castVote, updateSemantics, updateStyle } from '../shared/poll-engine.js';
import { validateState } from '../shared/validation.js';
import { draft, published, votes, ballot, now } from './fixtures.js';

test('création : 2 et 6 choix valides, 1 et 7 refusés, textes vides refusés', () => {
  for (const count of [2, 6]) assert.equal(createPoll(emptyState(), { question: 'Question', choices: Array.from({ length: count }, (_, i) => `Choix ${i}`) }).polls[0].definition.choices.length, count);
  for (const count of [1, 7]) assert.throws(() => createPoll(emptyState(), { question: 'Question', choices: Array(count).fill('Choix') }), /2 et 6/);
  for (const input of [{ question: '', choices: ['A', 'B'] }, { question: 'Question', choices: ['', 'B'] }]) assert.throws(() => createPoll(emptyState(), input), /texte requis/);
});

test('brouillon : vote refusé sans modifier l’état', async () => {
  const state = draft(); const before = structuredClone(state);
  await assert.rejects(castVote(state, ballot(state)), /pas encore ouvert/);
  assert.deepEqual(state, before);
});

test('sondage fermé : nouveaux votes refusés', async () => {
  const state = published(); const closed = closePoll(state, state.polls[0].id, now);
  await assert.rejects(castVote(closed, ballot(closed)), /fermé/);
  assert.equal(closed.ballots.length, 0);
});

test('premier bulletin accepté : verrouillage et bulletin atomiques, entrée intacte', async () => {
  const state = published(); const before = structuredClone(state);
  const next = await castVote(state, ballot(state), now);
  assert.deepEqual(state, before);
  assert.equal(next.polls[0].lockedAt, now());
  assert.equal(next.polls[0].definitionHash, await semanticHash(next.polls[0]));
  assert.equal(next.ballots.length, 1);
  assert.deepEqual(Object.keys(next.ballots[0]).sort(), ['choiceId', 'id', 'pollId']);
  await validateState(next);
});

test('bulletin refusé : aucun verrouillage, aucune écriture', async () => {
  const state = published(); const before = structuredClone(state);
  await assert.rejects(castVote(state, { ...ballot(state), choiceId: crypto.randomUUID() }), /n’appartient/);
  await assert.rejects(castVote(state, { ...ballot(state), pollId: crypto.randomUUID() }), /n’existe/);
  assert.deepEqual(state, before);
});

test('choix d’un autre sondage refusé', async () => {
  const state = published();
  const second = createPoll(state, { question: 'Autre ?', choices: ['Oui', 'Non'] }, { now });
  await assert.rejects(castVote(second, { ...ballot(second), choiceId: second.polls[1].definition.choices[0].id }), /n’appartient/);
});

test('fond et règles modifiables après publication avant premier vote', () => {
  const state = published(); const poll = state.polls[0];
  const next = updateSemantics(state, poll.id, { ...poll.definition, question: 'Question modifiée' }, { ...poll.resultRules, minimumResponses: 6 });
  assert.equal(next.polls[0].definition.question, 'Question modifiée');
  assert.equal(next.polls[0].resultRules.minimumResponses, 6);
  assert.equal(next.polls[0].status, 'published');
  assert.equal(state.polls[0].definition.question, 'Quel jeu choisit-on ?');
});

test('après premier vote : question, choix, privacy, mode, règles refusés', async () => {
  const state = await votes(1); const poll = state.polls[0];
  for (const definition of [
    { ...poll.definition, question: 'Autre' },
    { ...poll.definition, choices: poll.definition.choices.slice(0, 2) },
    { ...poll.definition, privacy: 'named' },
    { ...poll.definition, mode: 'multiple_choice' }
  ]) assert.throws(() => updateSemantics(state, poll.id, definition, poll.resultRules), /verrouillé/);
  assert.throws(() => updateSemantics(state, poll.id, poll.definition, { ...poll.resultRules, minimumResponses: 1 }), /verrouillé/);
});

test('style modifiable après verrouillage et fermeture, empreinte inchangée', async () => {
  let state = await votes(1); const poll = state.polls[0];
  state = closePoll(state, poll.id, now);
  const next = updateStyle(state, poll.id, { ...poll.style, themeId: 'lavender' });
  assert.equal(next.polls[0].style.themeId, 'lavender');
  assert.equal(next.polls[0].definitionHash, poll.definitionHash);
  await validateState(next);
});

test('empreinte : règles, accès et définition inclus ; style exclu ; ordre des clés indifférent', async () => {
  const state = published(); const poll = state.polls[0]; const hash = await semanticHash(poll);
  for (const patch of [
    { definition: { ...poll.definition, question: 'Autre' } },
    { definition: { ...poll.definition, privacy: 'named' } },
    { definition: { ...poll.definition, mode: 'multiple_choice' } },
    { resultRules: { ...poll.resultRules, minimumResponses: 6 } },
    { resultRules: { ...poll.resultRules, releaseMode: 'closed' } },
    { accessRules: { ...poll.accessRules, requiresAccount: true } }
  ]) assert.notEqual(await semanticHash({ ...poll, ...patch }), hash);
  assert.equal(await semanticHash({ ...poll, style: { ...poll.style, themeId: 'peach' } }), hash);
  assert.equal(await semanticHash({ ...poll, resultRules: Object.fromEntries(Object.entries(poll.resultRules).reverse()) }), hash);
});

test('idempotence : même action répétée = un bulletin ; action distincte acceptée', async () => {
  const state = published(); const action = ballot(state);
  const once = await castVote(state, action, now);
  const twice = await castVote(once, action, now);
  assert.equal(twice.ballots.length, 1);
  await assert.rejects(castVote(twice, { ...action, choiceId: twice.polls[0].definition.choices[1].id }), /déjà été utilisé/);
  const distinct = await castVote(twice, ballot(twice, 1), now);
  assert.equal(distinct.ballots.length, 2);
});

test('statistiques dérivées des bulletins', async () => {
  const state = await votes(6);
  state.polls[0].stats.totalBallots = 999;
  const stats = recalculateStats(state.polls[0], state.ballots);
  assert.equal(stats.totalBallots, 6);
  assert.equal(stats.countsByChoice[state.polls[0].definition.choices[0].id], 6);
});

test('publication invalide et transitions répétées refusées', () => {
  const state = draft(); state.polls[0].definition.question = '';
  assert.throws(() => publishPoll(state, state.polls[0].id), /texte requis/);
  const valid = published();
  assert.throws(() => publishPoll(valid, valid.polls[0].id), /brouillon/);
  const closed = closePoll(valid, valid.polls[0].id, now);
  assert.throws(() => closePoll(closed, closed.polls[0].id), /publié/);
});
