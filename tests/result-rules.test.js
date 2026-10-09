import test from 'node:test';
import assert from 'node:assert/strict';
import { getResults } from '../shared/result-rules.js';
import { closePoll } from '../shared/poll-engine.js';
import { draft, votes, now } from './fixtures.js';

for (const count of [0, 4, 5, 6]) test(`threshold à ${count} votes, seuil 5`, async () => {
  const state = await votes(count); const result = getResults(state, state.polls[0].id);
  assert.equal(result.available, count >= 5);
  if (count < 5) {
    assert.equal(Object.hasOwn(result, 'totalBallots'), false);
    assert.equal(Object.hasOwn(result, 'choices'), false);
  } else {
    assert.equal(result.totalBallots, count);
    assert.equal(result.choices[0].percentage, 100);
  }
});

for (const count of [0, 3, 4, 5, 6]) test(`closed à ${count} votes : fermeture ET seuil`, async () => {
  const state = await votes(count, { releaseMode: 'closed' }); const id = state.polls[0].id;
  assert.equal(getResults(state, id).available, false);
  const closed = closePoll(state, id, now);
  assert.equal(getResults(closed, id).available, count >= 5);
});

test('compteur affiché seulement si configuré ; aucune distribution sous seuil', async () => {
  const state = await votes(3, { showResponseCountBeforeRelease: true });
  const result = getResults(state, state.polls[0].id);
  assert.equal(result.totalBallots, 3);
  assert.equal(Object.hasOwn(result, 'choices'), false);
});

test('brouillon sans résultats ; statistiques cache falsifiées sans effet', async () => {
  const state = draft(); assert.equal(getResults(state, state.polls[0].id).available, false);
  const voted = await votes(4); voted.polls[0].stats.totalBallots = 100;
  assert.equal(getResults(voted, voted.polls[0].id).available, false);
});
