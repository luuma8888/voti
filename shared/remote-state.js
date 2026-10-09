import { object } from './validation.js';
import { RelayError, relayEnsure, remoteRef, isAdminCapability } from './relay.js';

/** Stockage privé du client, distinct du snapshot métier et de ses sauvegardes. */
export function validateRemoteConnection(input) {
  try {
    object(input, ['formatVersion', 'relayId', 'pollId', 'remoteRevision', 'adminCapability', 'lastKnownRemoteState'], 'Connexion distante');
    relayEnsure(input.formatVersion === 1, 'INVALID_REQUEST', 'Version de connexion inconnue.');
    remoteRef(input.relayId, input.pollId, input.remoteRevision);
    relayEnsure(input.adminCapability === null || isAdminCapability(input.adminCapability), 'INVALID_CAPABILITY', 'Capacité locale invalide.');
    const known = input.lastKnownRemoteState;
    if (known !== null) {
      object(known, ['status', 'locked', 'definitionHash', 'resultsAvailable'], 'État distant connu');
      relayEnsure(['published', 'closed'].includes(known.status) && typeof known.locked === 'boolean' && typeof known.resultsAvailable === 'boolean', 'INVALID_REQUEST');
      relayEnsure(known.locked ? /^[a-f0-9]{64}$/.test(known.definitionHash) : known.definitionHash === null, 'INVALID_REQUEST');
      relayEnsure(input.remoteRevision > 0, 'INVALID_REQUEST');
    }
    return structuredClone(input);
  } catch (error) { if (error instanceof RelayError) throw error; throw new RelayError('INVALID_REQUEST', 'Connexion distante invalide.'); }
}

/** Empêche un cache retardataire d'écraser une révision ou une capacité connue. */
export function validateConnectionReplacement(previous, next) {
  const valid = validateRemoteConnection(next);
  if (previous) {
    relayEnsure(valid.remoteRevision >= previous.remoteRevision, 'REVISION_CONFLICT', 'Le cache distant serait rétrogradé.');
    relayEnsure(previous.adminCapability === null || previous.adminCapability === valid.adminCapability, 'INVALID_CAPABILITY', 'Une capacité connue ne peut pas être remplacée silencieusement.');
  }
  return valid;
}
export function connectionKey({ relayId, pollId }) { remoteRef(relayId, pollId, 0); return `${relayId}/${pollId}`; }

export class RemoteConnectionAdapter {
  async get(_ref) { throw new RelayError('RELAY_UNAVAILABLE', 'Stockage des connexions indisponible.'); }
  async put(_connection) { throw new RelayError('RELAY_UNAVAILABLE', 'Stockage des connexions indisponible.'); }
  async delete(_ref) { throw new RelayError('RELAY_UNAVAILABLE', 'Stockage des connexions indisponible.'); }
  async list() { throw new RelayError('RELAY_UNAVAILABLE', 'Stockage des connexions indisponible.'); }
}
export class MemoryRemoteConnectionAdapter extends RemoteConnectionAdapter {
  #records = new Map();
  async get(ref) { return structuredClone(this.#records.get(connectionKey(ref)) || null); }
  async put(connection) {
    const key = connectionKey(connection);
    this.#records.set(key, validateConnectionReplacement(this.#records.get(key), connection));
  }
  async delete(ref) { this.#records.delete(connectionKey(ref)); }
  async list() { return structuredClone([...this.#records.values()]); }
}
