export const SCHEMA_VERSION = 1;
export const MAX_JSON_LENGTH = 2_000_000;
export const THEMES = ['mint', 'lavender', 'peach'];

/** @returns {{schemaVersion: number, polls: object[], ballots: object[]}} */
export function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, polls: [], ballots: [] };
}

export function defaultRules() {
  return { minimumResponses: 5, releaseMode: 'threshold', releaseAt: null,
    manualReleased: false, showResponseCountBeforeRelease: false };
}

export function defaultStyle() {
  return { themeId: 'mint', accent: null, background: null, layout: 'cards', posterVariant: 'none' };
}

export function defaultAccess() {
  return { audience: 'public', requiresAccount: false, allowDirectChoiceQr: false };
}

/** Representation stable, indépendante de l'ordre des clés JSON. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function semantics(poll) {
  return { definition: poll.definition, accessRules: poll.accessRules, resultRules: poll.resultRules };
}

export async function semanticHash(poll) {
  if (!globalThis.crypto?.subtle) throw new Error('Le calcul d’intégrité nécessite un navigateur moderne, sur fichier local ou localhost/HTTPS.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(semantics(poll))));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function recalculateStats(poll, ballots) {
  const countsByChoice = Object.fromEntries(poll.definition.choices.map(choice => [choice.id, 0]));
  let totalBallots = 0;
  for (const ballot of ballots) {
    if (ballot.pollId === poll.id) {
      if (!(ballot.choiceId in countsByChoice)) throw new Error('Bulletin incohérent : choix inconnu.');
      countsByChoice[ballot.choiceId]++;
      totalBallots++;
    }
  }
  return { totalBallots, countsByChoice };
}
