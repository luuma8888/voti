import { emptyState } from '../shared/model.js';
import { createPoll, publishPoll, castVote, closePoll } from '../shared/poll-engine.js';

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

/** Jeu fictif scalable : 5 cas répétés (brouillon, ouvert +/- seuil, fermé +/- seuil). */
export async function libraryFixture(size = 20) {
  const result = emptyState();
  for (let index = 0; index < size; index++) {
    const category = index % 5;
    const time = () => new Date(Date.UTC(2020, 0, index + 1)).toISOString();
    let state = createPoll(emptyState(), { question: `Atelier ${String(index + 1).padStart(3, '0')} · ${category === 0 ? 'Évasion' : 'Choisir ensemble'}`,
      choices: ['Cinéma', 'Jeux'], resultRules: { releaseMode: category >= 3 ? 'closed' : 'threshold' } }, { now: time });
    state.polls[0].definition.description = `Rencontre locale ${index + 1}`;
    if (category !== 0) {
      state = publishPoll(state, state.polls[0].id, time);
      for (let vote = 0; vote < (category === 2 || category === 4 ? 5 : 3); vote++) state = await castVote(state, ballot(state), time);
      if (category >= 3) state = closePoll(state, state.polls[0].id, time);
    }
    result.polls.push(...state.polls); result.ballots.push(...state.ballots);
  }
  return result;
}
