import { emptyState } from '../shared/model.js';
import { createPoll, publishPoll, castVote } from '../shared/poll-engine.js';

export const now = () => '2026-10-09T00:00:00.000Z';
export function draft(rules = {}) {
  return createPoll(emptyState(), { question: 'Quel jeu choisit-on ?', choices: ['Échecs', 'Cartes', 'Ballon'], resultRules: rules }, { now });
}
export function published(rules = {}) {
  const state = draft(rules);
  return publishPoll(state, state.polls[0].id, now);
}
export async function votes(count, rules = {}) {
  let state = published(rules);
  for (let index = 0; index < count; index++) state = await castVote(state, ballot(state), now);
  return state;
}
export function ballot(state, choiceIndex = 0) {
  return { id: crypto.randomUUID(), pollId: state.polls[0].id, choiceId: state.polls[0].definition.choices[choiceIndex].id };
}
