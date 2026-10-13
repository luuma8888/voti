import { recalculateStats } from './model.js';
import { getPoll } from './poll-engine.js';
import { participationRules, publicComments } from './participation.js';

/** Ne retourne aucune distribution lorsque la publication est bloquée. */
export function getResults(state, pollId) {
  const poll = getPoll(state, pollId);
  const stats = recalculateStats(poll, state.ballots);
  const rules = poll.resultRules;
  const available = poll.status !== 'draft' && stats.totalBallots >= rules.minimumResponses &&
    (rules.releaseMode === 'threshold' || (rules.releaseMode === 'closed' && poll.status === 'closed'));
  if (!available) return { available: false, minimumResponses: rules.minimumResponses, releaseMode: rules.releaseMode,
    ...(rules.showResponseCountBeforeRelease ? { totalBallots: stats.totalBallots } : {}) };
  const comments = participationRules(poll.definition).commentVisibility === 'public_with_results' ? publicComments(state, pollId) : [];
  return { available: true, totalBallots: stats.totalBallots,
    ...(comments.length ? { comments: { count: comments.length, items: comments.slice(0, 25), nextCursor: comments.length > 25 ? comments[24].commentId : null } } : {}),
    choices: poll.definition.choices.map(choice => ({ id: choice.id, label: choice.label,
      count: stats.countsByChoice[choice.id], percentage: stats.countsByChoice[choice.id] / stats.totalBallots * 100 })) };
}
