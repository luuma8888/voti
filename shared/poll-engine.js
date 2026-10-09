import { SCHEMA_VERSION, defaultAccess, defaultRules, defaultStyle, recalculateStats, semanticHash } from './model.js';
import { ensure, isUuid, validateDefinition, validatePoll, validateRules, validateStyle } from './validation.js';

export function getPoll(state, id) {
  const poll = state.polls.find(item => item.id === id);
  ensure(poll, 'Ce sondage n’existe pas dans ce navigateur.');
  return poll;
}

/** Le moteur ne modifie jamais son état d'entrée. */
export function createPoll(state, input, { uuid = () => crypto.randomUUID(), now = () => new Date().toISOString() } = {}) {
  const poll = {
    id: uuid(), schemaVersion: SCHEMA_VERSION, contextId: null, status: 'draft',
    createdAt: now(), publishedAt: null, closedAt: null, lockedAt: null, definitionHash: null,
    definition: { question: input.question, description: null, mode: 'single_choice', privacy: 'anonymous', pollImageAssetId: input.pollImageAssetId ?? null,
      choices: input.choices.map((label, order) => ({ id: uuid(), label, shortLabel: null, emoji: null, imageRef: input.choiceImageRefs?.[order] ?? null, order })) },
    style: defaultStyle(), accessRules: defaultAccess(), resultRules: { ...defaultRules(), ...input.resultRules },
    stats: { totalBallots: 0, countsByChoice: {} }
  };
  poll.stats = recalculateStats(poll, []);
  validatePoll(poll);
  ensure(!state.polls.some(item => item.id === poll.id), 'Identifiant de sondage déjà utilisé.');
  return { ...structuredClone(state), polls: [...structuredClone(state.polls), poll] };
}

export function updateSemantics(state, id, definition, resultRules) {
  const next = structuredClone(state);
  const poll = getPoll(next, id);
  ensure(poll.lockedAt === null, 'Le premier vote a verrouillé la question, les choix et les règles.');
  ensure(poll.status !== 'closed', 'Un sondage fermé ne peut plus être modifié sur le fond.');
  validateDefinition(definition);
  validateRules(resultRules);
  poll.definition = structuredClone(definition);
  poll.resultRules = structuredClone(resultRules);
  poll.stats = recalculateStats(poll, next.ballots);
  return next;
}

export function updateStyle(state, id, style) {
  validateStyle(style);
  const next = structuredClone(state);
  getPoll(next, id).style = structuredClone(style);
  return next;
}

export function publishPoll(state, id, now = () => new Date().toISOString()) {
  const next = structuredClone(state);
  const poll = getPoll(next, id);
  ensure(poll.status === 'draft', 'Seul un brouillon peut être publié.');
  validatePoll(poll);
  poll.status = 'published';
  poll.publishedAt = now();
  return next;
}

export function closePoll(state, id, now = () => new Date().toISOString()) {
  const next = structuredClone(state);
  const poll = getPoll(next, id);
  ensure(poll.status === 'published', 'Seul un sondage publié peut être fermé.');
  poll.status = 'closed';
  poll.closedAt = now();
  return next;
}

/** id est l'identifiant d'une action de confirmation, réutilisé lors d'un retry. */
export async function castVote(state, { id, pollId, choiceId }, now = () => new Date().toISOString()) {
  ensure(isUuid(id), 'Identifiant de bulletin invalide.');
  const existing = state.ballots.find(ballot => ballot.id === id);
  if (existing) {
    ensure(existing.pollId === pollId && existing.choiceId === choiceId, 'Cet identifiant de vote a déjà été utilisé pour un autre choix.');
    return structuredClone(state);
  }
  const next = structuredClone(state);
  const poll = getPoll(next, pollId);
  ensure(poll.status === 'published', poll.status === 'draft' ? 'Le vote n’est pas encore ouvert.' : 'Ce sondage est fermé.');
  ensure(poll.definition.choices.some(choice => choice.id === choiceId), 'Ce choix n’appartient pas au sondage.');
  if (poll.lockedAt === null) {
    // Tout est préparé sur une copie : aucun état partiellement verrouillé n'est exposé.
    poll.definitionHash = await semanticHash(poll);
    poll.lockedAt = now();
  }
  next.ballots.push({ id, pollId, choiceId });
  poll.stats = recalculateStats(poll, next.ballots);
  return next;
}
