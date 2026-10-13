import { canonical } from './model.js';

export const MAX_COMMENT_LENGTH = 300;
export const MAX_DISPLAY_NAME_LENGTH = 60;
export const characterCount = value => [...value].length;
/** Les valeurs historiques sont interprétées, jamais injectées dans leur définition/hash. */
export function participationRules(definition) {
  return {
    participationIdentityMode: definition.participationIdentityMode ?? 'anonymous',
    commentMode: definition.commentMode ?? 'disabled',
    commentVisibility: definition.commentVisibility ?? 'private',
  };
}
export const definitionVersion = definition => Object.hasOwn(definition, 'participationIdentityMode') ? 3 : 2;
function requireValue(condition, message) { if (!condition) throw new Error(message); }
export function normalizedText(value, maximum, label, required = false) {
  requireValue(typeof value === 'string', `${label} : texte invalide.`);
  const text = value.trim();
  requireValue(!/\p{Surrogate}/u.test(text), `${label} : texte Unicode invalide.`);
  requireValue(characterCount(text) <= maximum && (!required || text.length > 0), `${label} : ${required ? 'texte requis, ' : ''}${maximum} caractères maximum.`);
  requireValue(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text), `${label} : caractères de contrôle interdits.`);
  return text;
}
/** Validation indépendante du DOM et du transport. Aucune identité inventée en anonyme. */
export function normalizeSubmission(definition, input) {
  const rules = participationRules(definition);
  const comment = normalizedText(input.comment ?? '', MAX_COMMENT_LENGTH, 'Commentaire');
  requireValue(rules.commentMode === 'optional' || !comment, 'Ce sondage ne permet pas de commentaire.');
  if (rules.participationIdentityMode === 'anonymous') {
    requireValue(!Object.hasOwn(input, 'displayName'), 'Une participation anonyme ne peut pas contenir de nom.');
    return { comment };
  }
  let displayName;
  try {
    displayName = normalizedText(input.displayName, MAX_DISPLAY_NAME_LENGTH, 'Nom ou pseudonyme', true);
    requireValue(!/[\r\n\t]/u.test(displayName), 'Nom ou pseudonyme : une seule ligne est autorisée.');
  } catch(error) {error.code='INVALID_PARTICIPATION';throw error;}
  return { comment, displayName };
}
/** Reçu de protocole par action, pas un identifiant de personne : sel pollId + actionId. */
export async function submissionDigest(pollId, actionId, choiceId, submission) {
  const data = new TextEncoder().encode(canonical({ protocol: 'voti-submission-v1', pollId, actionId, choiceId, ...submission }));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function publicComments(state, pollId) {
  return (state.comments ?? []).filter(c => c.pollId === pollId && c.moderationStatus === 'visible')
    .map(({ commentId, choiceId, text }) => ({ commentId, choiceId, text })).sort((a,b) => a.commentId.localeCompare(b.commentId));
}

/** Projection réservée au propriétaire local / à l'administrateur authentifié du relais. */
export function administrativeEntries(state, pollId) {
  const poll = state.polls.find(p => p.id === pollId);
  requireValue(poll, 'Sondage introuvable.');
  const identified = participationRules(poll.definition).participationIdentityMode === 'identified';
  const entries = [];
  for (const ballot of state.ballots.filter(b => b.pollId === pollId)) {
    const comment = (state.comments ?? []).find(c => c.ballotId === ballot.id && c.pollId === pollId);
    if (!identified && !comment) continue;
    const participation = identified ? (state.participations ?? []).find(p => p.participationId === ballot.participationId && p.pollId === pollId) : null;
    entries.push({ choiceId: ballot.choiceId, ...(identified ? { participationId: participation.participationId, displayName: participation.displayName } : {}),
      ...(comment ? { comment: { commentId: comment.commentId, text: comment.text, moderationStatus: comment.moderationStatus, revision: comment.revision } } : {}) });
  }
  return entries;
}

export function moderateComment(state, pollId, commentId, expectedRevision, action) {
  requireValue(['visible', 'hidden', 'delete'].includes(action), 'Action de modération invalide.');
  const next = structuredClone(state), poll = next.polls.find(p => p.id === pollId);
  requireValue(poll, 'Sondage introuvable.');
  const index = next.comments.findIndex(c => c.pollId === pollId && c.commentId === commentId);
  requireValue(index >= 0, 'Commentaire introuvable.');
  const comment = next.comments[index];
  if(comment.revision !== expectedRevision) {const error=new Error('REVISION_CONFLICT');error.code='REVISION_CONFLICT';throw error;}
  if (action === 'delete') next.comments.splice(index, 1);
  else {
    requireValue(participationRules(poll.definition).commentVisibility === 'public_with_results', 'Un commentaire privé ne peut pas être publié.');
    comment.moderationStatus = action; comment.revision++;
  }
  return next;
}
