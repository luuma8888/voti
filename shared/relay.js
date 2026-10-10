/** Contrat v1 : aucune dépendance au transport, au DOM ou à un fournisseur. */
export const RELAY_ERROR_CODES = Object.freeze([
  'NOT_FOUND', 'POLL_CLOSED', 'POLL_LOCKED', 'REVISION_CONFLICT', 'INVALID_CHOICE',
  'INVALID_DEFINITION', 'RESULTS_LOCKED', 'INVALID_CAPABILITY', 'ASSET_MISSING',
  'ASSET_INVALID', 'PAYLOAD_TOO_LARGE', 'RATE_LIMITED', 'RELAY_UNAVAILABLE',
  'LOCAL_VOTES_PRESENT', 'IDEMPOTENCY_CONFLICT', 'INVALID_REQUEST', 'PUBLICATION_CONFLICT',
  'HUMAN_VERIFICATION_REQUIRED', 'HUMAN_VERIFICATION_FAILED', 'CREATION_RATE_LIMITED',
  'CAPABILITY_CONFLICT', 'REMOTE_ASSETS_DISABLED',
]);

export class RelayError extends Error {
  constructor(code, message = code, details = {}) {
    super(message); this.name = 'RelayError';
    if (!RELAY_ERROR_CODES.includes(code)) throw new TypeError('Code de relais inconnu.');
    this.code = code; this.details = structuredClone(details);
  }
  toJSON() { return { code: this.code, message: this.message, details: structuredClone(this.details) }; }
}
export function relayEnsure(condition, code, message, details) {
  if (!condition) throw new RelayError(code, message, details);
}
export function isPublicPollId(value) {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
}
export function isRelayId(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value); }
export function isAdminCapability(value) { return typeof value === 'string' && /^voti-admin-v1\.[a-f0-9]{64}$/.test(value); }

/** 32 octets aléatoires système = 256 bits. Jamais appelée au build. */
export function createAdminCapability() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return 'voti-admin-v1.' + Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
export function createVoteActionId() { return crypto.randomUUID(); }

/** Référence publique non sémantique. La révision 0 désigne une préparation privée. */
export function remoteRef(relayId, pollId, revision) {
  relayEnsure(isRelayId(relayId) && isPublicPollId(pollId) && Number.isSafeInteger(revision) && revision >= 0,
    'INVALID_REQUEST', 'Référence distante invalide.');
  return { relayId, pollId, revision };
}
/** Fragments du site Voti, sans capacité ni adresse technique de relais. */
export function publicPollRoute(pollId, results = false) {
  relayEnsure(isPublicPollId(pollId), 'INVALID_REQUEST', 'Identifiant public invalide.');
  return `#/p/${pollId}${results ? '/results' : ''}`;
}

/** Toutes les méthodes sont asynchrones et rejettent avec RelayError.
 * Administration : adminCapability + expectedRevision obligatoires.
 * Les structures exactes de réponse sont décrites dans RELAY_CONTRACT_V0.md.
 * Aucun export, inspecteur ou accès public aux bulletins bruts.
 */
export class RelayAdapter {
  constructor(relayId) {
    relayEnsure(isRelayId(relayId), 'INVALID_REQUEST', 'Identifiant de relais invalide.');
    Object.defineProperty(this, 'relayId', { value: relayId, enumerable: true });
  }
  async preparePublication(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async getMissingAssets(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async putAssets(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async publishPoll(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async discardPublication(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async getPoll(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async updateDefinition(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async updateStyle(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async closePoll(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async deletePoll(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async verifyAdmin(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async castVote(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async getResults(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
  async getAsset(_request) { throw new RelayError('RELAY_UNAVAILABLE'); }
}
