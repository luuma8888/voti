import { recalculateStats } from './model.js';
import { getPoll } from './poll-engine.js';

/** Ne retourne aucune distribution lorsque la publication est bloquée. */
export function getResults(state, pollId) {
  const poll = getPoll(state, pollId);
  const stats = recalculateStats(poll, state.ballots);
  const rules = poll.resultRules;
  const available = poll.status !== 'draft' && stats.totalBallots >= rules.minimumResponses &&
    (rules.releaseMode === 'threshold' || (rules.releaseMode === 'closed' && poll.status === 'closed'));
  if (!available) return { available: false, minimumResponses: rules.minimumResponses, releaseMode: rules.releaseMode,
    ...(rules.showResponseCountBeforeRelease ? { totalBallots: stats.totalBallots } : {}) };
  return { available: true, totalBallots: stats.totalBallots,
    choices: poll.definition.choices.map(choice => ({ id: choice.id, label: choice.label,
      count: stats.countsByChoice[choice.id], percentage: stats.countsByChoice[choice.id] / stats.totalBallots * 100 })) };
}
