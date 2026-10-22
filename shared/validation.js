import { SCHEMA_VERSION, THEMES, recalculateStats, semanticHash } from './model.js';
import { definitionVersion, participationRules, normalizeSubmission, normalizedText, submissionDigest, MAX_COMMENT_LENGTH, MAX_DISPLAY_NAME_LENGTH } from './participation.js';
import { validatePollAudience, GROUP_RELEASE_MODES } from './spaces.js';

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export function object(value, keys, label) {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} doit être un objet.`);
  ensure(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), `${label} : champs manquants ou non autorisés.`);
}

export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function text(value, max, label, nullable = false) {
  if (nullable && value === null) return;
  ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} : texte requis, ${max} caractères maximum.`);
}

function date(value, label, nullable = true) {
  if (nullable && value === null) return;
  ensure(typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, `${label} : date ISO invalide.`);
}

export function isAssetId(value) {
  return typeof value === 'string' && /^sha256-[a-f0-9]{64}$/.test(value);
}

export function validateDefinition(definition, version = definitionVersion(definition ?? {})) {
  ensure([1, 2, 3, 4].includes(version), 'Version de définition inconnue.');
  object(definition, ['question', 'description', 'mode', 'privacy', 'choices', ...(version >= 2 ? ['pollImageAssetId'] : []),
    ...(version >= 3 ? ['participationIdentityMode', 'commentMode', 'commentVisibility'] : [])], 'Définition');
  if (version >= 2) ensure(definition.pollImageAssetId === null || isAssetId(definition.pollImageAssetId), 'Référence image du sondage invalide.');
  text(definition.question, 240, 'Question');
  text(definition.description, 1000, 'Description', true);
  ensure(definition.mode === 'single_choice', 'Seul le choix unique est disponible.');
  if (version >= 3) {
    ensure(['anonymous', 'identified'].includes(definition.participationIdentityMode), 'Mode de participation invalide.');
    ensure(['disabled', 'optional'].includes(definition.commentMode), 'Mode de commentaire invalide.');
    ensure(['private', 'public_with_results'].includes(definition.commentVisibility), 'Visibilité des commentaires invalide.');
    ensure(definition.privacy === (definition.participationIdentityMode === 'identified' ? 'named' : 'anonymous'), 'Confidentialité et participation incohérentes.');
  } else ensure(definition.privacy === 'anonymous', 'Identité non disponible dans le schéma historique.');
  ensure(Array.isArray(definition.choices) && definition.choices.length >= 2 && definition.choices.length <= 6, 'Il faut entre 2 et 6 choix.');
  const ids = new Set();
  for (const [index, choice] of definition.choices.entries()) {
    object(choice, ['id', 'label', 'shortLabel', 'emoji', 'imageRef', 'order'], 'Choix');
    ensure(isUuid(choice.id) && !ids.has(choice.id), 'Identifiant de choix invalide ou dupliqué.');
    ids.add(choice.id);
    text(choice.label, 100, 'Réponse');
    text(choice.shortLabel, 40, 'Libellé court', true);
    text(choice.emoji, 16, 'Pictogramme', true);
    ensure(choice.imageRef === null || (version >= 2 && isAssetId(choice.imageRef)), 'Référence image du choix invalide.');
    ensure(choice.order === index, 'Ordre des choix incohérent.');
  }
}

export function validateRules(rules, group = false) {
  object(rules, ['minimumResponses', 'releaseMode', 'releaseAt', 'manualReleased', 'showResponseCountBeforeRelease'], 'Règles de résultats');
  ensure(Number.isSafeInteger(rules.minimumResponses) && rules.minimumResponses >= 1 && rules.minimumResponses <= 100000, 'Le minimum doit être un entier entre 1 et 100 000.');
  ensure((group?GROUP_RELEASE_MODES:['threshold','closed']).includes(rules.releaseMode), 'Mode de publication non disponible.');
  ensure(rules.releaseAt === null && rules.manualReleased === false, 'Publication manuelle ou datée non disponible.');
  ensure(typeof rules.showResponseCountBeforeRelease === 'boolean', 'Visibilité du compteur invalide.');
}

export function validateStyle(style) {
  object(style, ['themeId', 'accent', 'background', 'layout', 'posterVariant'], 'Apparence');
  ensure(THEMES.includes(style.themeId) && style.accent === null && style.background === null && style.layout === 'cards' && style.posterVariant === 'none', 'Apparence non prise en charge.');
}

export function validatePoll(poll, version = poll?.schemaVersion) {
  object(poll, ['id', 'schemaVersion', 'contextId', 'status', 'createdAt', 'publishedAt', 'closedAt', 'lockedAt', 'definitionHash', 'definition', 'style', 'accessRules', 'resultRules', 'stats'], 'Sondage');
  ensure(isUuid(poll.id), 'Identifiant du sondage invalide.');
  ensure([1, 2, 3, 4].includes(version) && poll.schemaVersion === version, 'Version du sondage inconnue.');
  ensure(version===4 ? isUuid(poll.contextId) : poll.contextId === null, 'Contexte invalide.');
  ensure(['draft', 'published', 'closed'].includes(poll.status), 'État du sondage invalide.');
  date(poll.createdAt, 'Création', false);
  for (const field of ['publishedAt', 'closedAt', 'lockedAt']) {
    date(poll[field], field);
    ensure(poll[field] === null || poll[field] >= poll.createdAt, 'Chronologie du sondage incohérente.');
  }
  ensure((poll.status === 'draft') === (poll.publishedAt === null), 'Publication incohérente.');
  ensure((poll.status === 'closed') === (poll.closedAt !== null), 'Fermeture incohérente.');
  ensure(poll.closedAt === null || poll.closedAt >= poll.publishedAt, 'Fermeture antérieure à la publication.');
  ensure(poll.lockedAt === null || (poll.publishedAt !== null && poll.lockedAt >= poll.publishedAt && (poll.closedAt === null || poll.lockedAt <= poll.closedAt)), 'Verrouillage incohérent.');
  ensure(poll.lockedAt === null ? poll.definitionHash === null : /^[a-f0-9]{64}$/.test(poll.definitionHash), 'Empreinte de verrouillage invalide.');
  validateDefinition(poll.definition, version);
  validateStyle(poll.style);
  validateRules(poll.resultRules,version===4);
  validateAccess(poll.accessRules);
  ensure(version===4 ? poll.accessRules.audience==='context'&&poll.contextId===poll.accessRules.pollAudience.spaceId : poll.accessRules.audience==='public','Audience incompatible avec le schéma.');
  ensure(version===4 || ['threshold','closed'].includes(poll.resultRules.releaseMode),'Les modes tout le monde nécessitent un Espace.');
  object(poll.stats, ['totalBallots', 'countsByChoice'], 'Statistiques');
  ensure(Number.isSafeInteger(poll.stats.totalBallots) && poll.stats.totalBallots >= 0, 'Statistiques invalides.');
  const counts = poll.stats.countsByChoice;
  ensure(counts && typeof counts === 'object' && !Array.isArray(counts), 'Comptes invalides.');
  ensure(Object.keys(counts).length === poll.definition.choices.length && poll.definition.choices.every(choice => Number.isSafeInteger(counts[choice.id]) && counts[choice.id] >= 0), 'Comptes par choix invalides.');
}

export function validateAccess(access) {
  object(access,['audience','requiresAccount','allowDirectChoiceQr',...(access?.audience==='context'?['pollAudience']:[])],'Accès');
  ensure(access.requiresAccount===false&&access.allowDirectChoiceQr===false,'Règles d’accès non disponibles.');
  ensure(['public','context'].includes(access.audience),'Audience inconnue.');
  if(access.audience==='context')validatePollAudience(access.pollAudience);
}

/** Valide l'intégralité de l'état, vérifie les empreintes, recalcule les caches. */
export async function validateState(input, version = input?.schemaVersion ?? SCHEMA_VERSION) {
  ensure([1, 2, 3].includes(version) && input.schemaVersion === version, 'Version de schéma inconnue : import refusé.');
  object(input, ['schemaVersion', 'polls', 'ballots', ...(version >= 3 ? ['comments', 'participations'] : [])], 'Sauvegarde');
  ensure(Array.isArray(input.polls) && Array.isArray(input.ballots), 'Listes de données invalides.');
  if (version >= 3) ensure(Array.isArray(input.comments) && Array.isArray(input.participations), 'Participations et commentaires invalides.');
  const state = structuredClone(input);
  const ids = new Set();
  const reserve = id => {
    ensure(isUuid(id) && !ids.has(id), 'Identifiant invalide ou dupliqué dans la sauvegarde.');
    ids.add(id);
  };
  const polls = new Map();
  for (const poll of state.polls) {
    ensure(version < 3 ? poll.schemaVersion === version : [2, 3].includes(poll.schemaVersion), 'Le snapshot local est réservé aux sondages libres v2/v3.');
    validatePoll(poll);
    reserve(poll.id);
    polls.set(poll.id, poll);
    for (const choice of poll.definition.choices) reserve(choice.id);
  }
  const participations = new Map();
  for (const participation of state.participations ?? []) {
    object(participation, ['participationId', 'pollId', 'displayName'], 'Participation');
    reserve(participation.participationId);
    ensure(polls.has(participation.pollId) && participationRules(polls.get(participation.pollId).definition).participationIdentityMode === 'identified', 'Participation interdite sur ce sondage.');
    ensure(normalizedText(participation.displayName, MAX_DISPLAY_NAME_LENGTH, 'Nom ou pseudonyme', true) === participation.displayName && !/[\r\n\t]/u.test(participation.displayName), 'Nom ou pseudonyme non normalisé.');
    participations.set(participation.participationId, participation);
  }
  const linked = new Set(), ballots = new Map();
  for (const ballot of state.ballots) {
    reserve(ballot.id);
    const poll = polls.get(ballot.pollId);
    ensure(poll && poll.definition.choices.some(choice => choice.id === ballot.choiceId), 'Bulletin : sondage ou choix inexistant.');
    const identified = participationRules(poll.definition).participationIdentityMode === 'identified';
    object(ballot, ['id', 'pollId', 'choiceId', ...(poll.schemaVersion >= 3 ? ['submissionDigest'] : []), ...(identified ? ['participationId'] : [])], 'Bulletin');
    if (poll.schemaVersion >= 3) ensure(typeof ballot.submissionDigest === 'string' && /^[a-f0-9]{64}$/.test(ballot.submissionDigest), 'Reçu de soumission invalide.');
    if (identified) {
      ensure(participations.get(ballot.participationId)?.pollId === poll.id && !linked.has(ballot.participationId), 'Participation du bulletin invalide ou réutilisée.');
      linked.add(ballot.participationId);
    }
    ballots.set(ballot.id, ballot);
    ensure(poll.status !== 'draft', 'Un brouillon ne peut pas contenir de bulletin.');
  }
  ensure(linked.size === participations.size, 'Participation orpheline.');
  const commented = new Set();
  for (const comment of state.comments ?? []) {
    const poll = polls.get(comment.pollId), ballot = ballots.get(comment.ballotId);
    ensure(poll && participationRules(poll.definition).commentMode === 'optional' && ballot?.pollId === poll.id && ballot.choiceId === comment.choiceId, 'Commentaire incohérent ou orphelin.');
    const identified = participationRules(poll.definition).participationIdentityMode === 'identified';
    object(comment, ['commentId', 'pollId', 'ballotId', 'choiceId', 'text', 'moderationStatus', 'revision', ...(identified ? ['participationId'] : [])], 'Commentaire');
    reserve(comment.commentId);
    ensure(!commented.has(ballot.id), 'Plusieurs commentaires pour un bulletin.'); commented.add(ballot.id);
    ensure(!identified || comment.participationId === ballot.participationId, 'Identité du commentaire incohérente.');
    ensure(normalizedText(comment.text, MAX_COMMENT_LENGTH, 'Commentaire', true) === comment.text, 'Commentaire non normalisé.');
    const normalized=normalizeSubmission(poll.definition, { comment: comment.text, ...(identified ? { displayName: participations.get(ballot.participationId).displayName } : {}) });
    ensure(await submissionDigest(poll.id,ballot.id,ballot.choiceId,normalized)===ballot.submissionDigest,'Contenu du commentaire/Participation incompatible avec le reçu de soumission.');
    ensure(['pending', 'visible', 'hidden'].includes(comment.moderationStatus) && Number.isSafeInteger(comment.revision) && comment.revision >= 1, 'État de modération invalide.');
    ensure(participationRules(poll.definition).commentVisibility === 'public_with_results' || comment.moderationStatus === 'pending', 'Un commentaire privé ne peut pas être rendu public.');
  }
  for (const poll of state.polls) {
    poll.stats = recalculateStats(poll, state.ballots);
    ensure((poll.stats.totalBallots > 0) === (poll.lockedAt !== null), 'Bulletins et verrouillage incohérents.');
    if (poll.lockedAt !== null) ensure(await semanticHash(poll) === poll.definitionHash, 'L’empreinte ne correspond pas aux règles verrouillées.');
  }
  return state;
}
