import { SCHEMA_VERSION, THEMES, recalculateStats, semanticHash } from './model.js';

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, keys, label) {
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

export function validateDefinition(definition) {
  object(definition, ['question', 'description', 'mode', 'privacy', 'choices'], 'Définition');
  text(definition.question, 240, 'Question');
  text(definition.description, 1000, 'Description', true);
  ensure(definition.mode === 'single_choice', 'Seul le choix unique est disponible.');
  ensure(definition.privacy === 'anonymous', 'Le vote nominatif est réservé à une phase future.');
  ensure(Array.isArray(definition.choices) && definition.choices.length >= 2 && definition.choices.length <= 6, 'Il faut entre 2 et 6 choix.');
  const ids = new Set();
  for (const [index, choice] of definition.choices.entries()) {
    object(choice, ['id', 'label', 'shortLabel', 'emoji', 'imageRef', 'order'], 'Choix');
    ensure(isUuid(choice.id) && !ids.has(choice.id), 'Identifiant de choix invalide ou dupliqué.');
    ids.add(choice.id);
    text(choice.label, 100, 'Réponse');
    text(choice.shortLabel, 40, 'Libellé court', true);
    text(choice.emoji, 16, 'Pictogramme', true);
    ensure(choice.imageRef === null, 'Les images ne sont pas disponibles dans cette phase.');
    ensure(choice.order === index, 'Ordre des choix incohérent.');
  }
}

export function validateRules(rules) {
  object(rules, ['minimumResponses', 'releaseMode', 'releaseAt', 'manualReleased', 'showResponseCountBeforeRelease'], 'Règles de résultats');
  ensure(Number.isSafeInteger(rules.minimumResponses) && rules.minimumResponses >= 1 && rules.minimumResponses <= 100000, 'Le minimum doit être un entier entre 1 et 100 000.');
  ensure(['threshold', 'closed'].includes(rules.releaseMode), 'Mode de publication non disponible.');
  ensure(rules.releaseAt === null && rules.manualReleased === false, 'Publication manuelle ou datée non disponible.');
  ensure(typeof rules.showResponseCountBeforeRelease === 'boolean', 'Visibilité du compteur invalide.');
}

export function validateStyle(style) {
  object(style, ['themeId', 'accent', 'background', 'layout', 'posterVariant'], 'Apparence');
  ensure(THEMES.includes(style.themeId) && style.accent === null && style.background === null && style.layout === 'cards' && style.posterVariant === 'none', 'Apparence non prise en charge.');
}

export function validatePoll(poll) {
  object(poll, ['id', 'schemaVersion', 'contextId', 'status', 'createdAt', 'publishedAt', 'closedAt', 'lockedAt', 'definitionHash', 'definition', 'style', 'accessRules', 'resultRules', 'stats'], 'Sondage');
  ensure(isUuid(poll.id), 'Identifiant du sondage invalide.');
  ensure(poll.schemaVersion === SCHEMA_VERSION, 'Version du sondage inconnue.');
  ensure(poll.contextId === null, 'Les contextes ne sont pas disponibles.');
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
  validateDefinition(poll.definition);
  validateStyle(poll.style);
  validateRules(poll.resultRules);
  object(poll.accessRules, ['audience', 'requiresAccount', 'allowDirectChoiceQr'], 'Accès');
  ensure(poll.accessRules.audience === 'public' && poll.accessRules.requiresAccount === false && poll.accessRules.allowDirectChoiceQr === false, 'Règles d’accès non disponibles.');
  object(poll.stats, ['totalBallots', 'countsByChoice'], 'Statistiques');
  ensure(Number.isSafeInteger(poll.stats.totalBallots) && poll.stats.totalBallots >= 0, 'Statistiques invalides.');
  const counts = poll.stats.countsByChoice;
  ensure(counts && typeof counts === 'object' && !Array.isArray(counts), 'Comptes invalides.');
  ensure(Object.keys(counts).length === poll.definition.choices.length && poll.definition.choices.every(choice => Number.isSafeInteger(counts[choice.id]) && counts[choice.id] >= 0), 'Comptes par choix invalides.');
}

/** Valide l'intégralité de l'état, vérifie les empreintes, recalcule les caches. */
export async function validateState(input) {
  object(input, ['schemaVersion', 'polls', 'ballots'], 'Sauvegarde');
  ensure(input.schemaVersion === SCHEMA_VERSION, 'Version de schéma inconnue : import refusé.');
  ensure(Array.isArray(input.polls) && Array.isArray(input.ballots), 'Listes de données invalides.');
  const state = structuredClone(input);
  const ids = new Set();
  const reserve = id => {
    ensure(isUuid(id) && !ids.has(id), 'Identifiant invalide ou dupliqué dans la sauvegarde.');
    ids.add(id);
  };
  const polls = new Map();
  for (const poll of state.polls) {
    validatePoll(poll);
    reserve(poll.id);
    polls.set(poll.id, poll);
    for (const choice of poll.definition.choices) reserve(choice.id);
  }
  for (const ballot of state.ballots) {
    object(ballot, ['id', 'pollId', 'choiceId'], 'Bulletin');
    reserve(ballot.id);
    const poll = polls.get(ballot.pollId);
    ensure(poll && poll.definition.choices.some(choice => choice.id === ballot.choiceId), 'Bulletin : sondage ou choix inexistant.');
    ensure(poll.status !== 'draft', 'Un brouillon ne peut pas contenir de bulletin.');
  }
  for (const poll of state.polls) {
    poll.stats = recalculateStats(poll, state.ballots);
    ensure((poll.stats.totalBallots > 0) === (poll.lockedAt !== null), 'Bulletins et verrouillage incohérents.');
    if (poll.lockedAt !== null) ensure(await semanticHash(poll) === poll.definitionHash, 'L’empreinte ne correspond pas aux règles verrouillées.');
  }
  return state;
}
