import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, semanticHash } from '../shared/model.js';
import { createPoll, publishPoll, castVote, updateSemantics, closePoll } from '../shared/poll-engine.js';
import { getResults } from '../shared/result-rules.js';
import { validateState } from '../shared/validation.js';
import { migrateState } from '../shared/migration.js';
import { administrativeEntries, moderateComment, normalizeSubmission, participationRules, characterCount } from '../shared/participation.js';

function fixture(options = {}) {
  const draft = createPoll(emptyState(), { question: 'Quel atelier fictif ?', choices: ['Pomme', 'Poire'], ...options });
  return publishPoll(draft, draft.polls[0].id);
}
const action = state => ({ id: crypto.randomUUID(), pollId: state.polls[0].id, choiceId: state.polls[0].definition.choices[0].id });

test('v0.5 : nouveaux défauts anonymous / optional / private', async () => {
  const state = fixture(); assert.deepEqual(participationRules(state.polls[0].definition), { participationIdentityMode: 'anonymous', commentMode: 'optional', commentVisibility: 'private' });
  assert.equal(state.schemaVersion, 3); await validateState(state);
});
test('anonymous + commentaire : aucune Participation ni identité dans le bulletin/commentaire/projections', async () => {
  const initial = fixture(), copy = structuredClone(initial), input = { ...action(initial), comment: '  Très bien 😊  ' };
  const next = await castVote(initial, input); assert.deepEqual(initial, copy);
  assert.equal(next.participations.length, 0); assert.equal(next.comments[0].text, 'Très bien 😊');
  for (const record of [next.ballots[0], next.comments[0], ...administrativeEntries(next, input.pollId)]) {
    for (const key of ['displayName', 'participationId', 'userId', 'ip', 'userAgent', 'participantId']) assert.ok(!Object.hasOwn(record, key));
  }
  assert.deepEqual(getResults(next, input.pollId), { available: false, minimumResponses: 5, releaseMode: 'threshold' });
  await validateState(next);
  await assert.rejects(castVote(initial, { ...input, displayName: 'Emma' }), /anonyme/);
  await assert.rejects(castVote(initial, { ...input, userId: 'hidden' }), /non autorisés/);
});
test('identified : nom requis, Unicode, deux Emma acceptées, liens cohérents sans nom dans les bulletins', async () => {
  let state = fixture({ participationIdentityMode: 'identified' });
  await assert.rejects(castVote(state, action(state)), /Nom ou pseudonyme/);
  for (const displayName of ['Emma', 'Emma', 'Éloïse 😊', 'ليلى']) state = await castVote(state, { ...action(state), displayName, comment: 'Oui !' });
  assert.equal(state.participations.length, 4); assert.equal(state.comments.length, 4);
  assert.equal(new Set(state.participations.map(p => p.participationId)).size, 4);
  for (const b of state.ballots) assert.ok(b.participationId && !Object.hasOwn(b, 'displayName'));
  assert.equal(administrativeEntries(state, state.polls[0].id)[0].displayName, 'Emma'); await validateState(state);
});
test('validation Unicode : 300 points de code, trim, espaces absents, HTML et RTL texte brut', () => {
  const def = fixture().polls[0].definition;
  assert.equal(normalizeSubmission(def, { comment: '  \n ' }).comment, '');
  assert.equal(characterCount(normalizeSubmission(def, { comment: '😊'.repeat(300) }).comment), 300);
  assert.throws(() => normalizeSubmission(def, { comment: '😊'.repeat(301) }), /300/);
  for (const comment of ['<script>alert(1)</script>', '<img onerror="x">', 'école « apostrophe ’ »', 'العربية']) assert.equal(normalizeSubmission(def, { comment }).comment, comment);
  assert.throws(() => normalizeSubmission(def, { comment: '\u202Eabc' }), /contrôle/);
  assert.throws(() => normalizeSubmission(def, { comment: '\ud800' }), /Unicode invalide/);
  assert.throws(() => normalizeSubmission(fixture({ participationIdentityMode: 'identified' }).polls[0].definition, { displayName: 'E'.repeat(61) }), /60/);
});
test('Vote simple refuse un commentaire et ne crée aucun objet commentaire', async () => {
  const initial = fixture({ commentMode: 'disabled' });
  await assert.rejects(castVote(initial, { ...action(initial), comment: 'Texte' }), /ne permet pas/);
  const next = await castVote(initial, { ...action(initial), comment: '  ' }); assert.equal(next.comments.length, 0);
});
test('idempotence étendue : un bulletin/commentaire/Participation ; contenu différent refusé ; suppression sans résurrection', async () => {
  const initial = fixture({ participationIdentityMode: 'identified' }); const input = { ...action(initial), displayName: 'Emma', comment: 'Bravo' };
  const next = await castVote(initial, input), retry = await castVote(next, input); assert.deepEqual(retry, next);
  for (const changes of [{ comment: 'Autre' }, { displayName: 'Autre' }, { choiceId: initial.polls[0].definition.choices[1].id }]) await assert.rejects(castVote(next, { ...input, ...changes }));
  const deleted = moderateComment(next, input.pollId, next.comments[0].commentId, 1, 'delete');
  assert.equal(deleted.ballots.length, 1); assert.equal(deleted.participations.length, 1);
  const repeated = await castVote(deleted, input); assert.equal(repeated.comments.length, 0); await validateState(repeated);
});
test('validation et échec : aucun objet orphelin ni verrouillage partiel', async () => {
  const initial = fixture({ participationIdentityMode: 'identified' }), copy = structuredClone(initial);
  for (const input of [{ ...action(initial), displayName: '' }, { ...action(initial), displayName: 'Emma', comment: 'x'.repeat(301) }, { ...action(initial), displayName: 'Emma', choiceId: crypto.randomUUID() }]) await assert.rejects(castVote(initial, input));
  assert.deepEqual(initial, copy);
  const next = await castVote(initial, { ...action(initial), displayName: 'Emma', comment: 'Oui' });
  const corrupted = structuredClone(next); corrupted.participations = []; await assert.rejects(validateState(corrupted), /Participation/);
  const orphan = structuredClone(initial); orphan.participations.push({ participationId: crypto.randomUUID(), pollId: initial.polls[0].id, displayName: 'Emma' }); await assert.rejects(validateState(orphan), /orpheline/);
});
test('trois règles sémantiques couvertes par le hash et verrouillées au premier vote', async () => {
  const initial = fixture(); const poll = initial.polls[0];
  const changed = updateSemantics(initial, poll.id, { ...poll.definition, commentMode: 'disabled', commentVisibility: 'public_with_results', participationIdentityMode: 'identified', privacy: 'named' }, poll.resultRules);
  assert.notEqual(await semanticHash(poll), await semanticHash(changed.polls[0]));
  const voted = await castVote(initial, action(initial));
  for (const definition of [changed.polls[0].definition, { ...poll.definition, commentMode: 'disabled' }, { ...poll.definition, commentVisibility: 'public_with_results' }]) assert.throws(() => updateSemantics(voted, poll.id, definition, poll.resultRules), /verrouillé/);
});
test('modération CAS : public sous seuil sans existence ; visible au seuil ; aucune identité publique', async () => {
  let state = fixture({ participationIdentityMode: 'identified', commentVisibility: 'public_with_results', resultRules: { minimumResponses: 2 } });
  state = await castVote(state, { ...action(state), displayName: 'Emma', comment: 'Texte public' });
  const pollId = state.polls[0].id, id = state.comments[0].commentId;
  for (const status of ['visible', 'hidden', 'visible']) {
    const revision = state.comments[0].revision; state = moderateComment(state, pollId, id, revision, status);
    assert.throws(() => moderateComment(state, pollId, id, revision, 'hidden'), /REVISION_CONFLICT/);
  }
  assert.ok(!('comments' in getResults(state, pollId))); assert.equal(administrativeEntries(state, pollId)[0].comment.text, 'Texte public');
  state = await castVote(state, { ...action(state), displayName: 'Emma', comment: 'En attente' });
  const results = getResults(state, pollId); assert.equal(results.comments.count, 1); assert.equal(results.comments.items[0].text, 'Texte public');
  assert.ok(!JSON.stringify(results).includes('Emma')); const total = results.totalBallots;
  state = moderateComment(state, pollId, id, state.comments[0].revision, 'delete');
  assert.equal(getResults(state, pollId).totalBallots, total); assert.ok(!('comments' in getResults(state, pollId))); await validateState(state);
});
test('closed + threshold protège aussi les commentaires ; commentaires privés jamais publiés', async () => {
  for (const commentVisibility of ['private', 'public_with_results']) {
    let state = fixture({ commentVisibility, resultRules: { minimumResponses: 1, releaseMode: 'closed' } });
    const input = { ...action(state), comment: 'Essai' }; state = await castVote(state, input);
    if (commentVisibility !== 'private') state = moderateComment(state, input.pollId, state.comments[0].commentId, 1, 'visible');
    else assert.throws(() => moderateComment(state, input.pollId, state.comments[0].commentId, 1, 'visible'), /privé/);
    assert.ok(!('comments' in getResults(state, input.pollId))); state = closePoll(state, input.pollId);
    assert.equal('comments' in getResults(state, input.pollId), commentVisibility !== 'private');
  }
});
test('migration v0.4C : définition/hash/bulletins intacts ; anonymous et comments disabled', async () => {
  let state = fixture(); const poll = state.polls[0]; poll.schemaVersion = 2;
  for (const key of ['participationIdentityMode', 'commentMode', 'commentVisibility']) delete poll.definition[key];
  state = await castVote(state, action(state)); state.schemaVersion = 2; delete state.comments; delete state.participations;
  const copy = structuredClone(state), migrated = await migrateState(state);
  assert.deepEqual(state, copy); assert.deepEqual(migrated.polls, copy.polls); assert.deepEqual(migrated.ballots, copy.ballots);
  assert.equal(migrated.schemaVersion, 3); assert.deepEqual(participationRules(migrated.polls[0].definition), { participationIdentityMode: 'anonymous', commentMode: 'disabled', commentVisibility: 'private' });
  assert.equal((await castVote(migrated, action(migrated))).ballots.length, 2); await validateState(migrated);
  await assert.rejects(migrateState({ ...copy, schemaVersion: 4 }), /inconnue/);
});
