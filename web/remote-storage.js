import { RemoteConnectionAdapter, connectionKey, validateRemoteConnection, validateConnectionReplacement } from '../shared/remote-state.js';
import { RelayError, relayEnsure } from '../shared/relay.js';
import { object } from '../shared/validation.js';

export const REMOTE_STORAGE_KEY = 'voti.remote.v1';

/** Opt-in : l'UI locale ne l'instancie pas. Aucune exportation implicite des secrets. */
export class LocalStorageRemoteConnectionAdapter extends RemoteConnectionAdapter {
  constructor(storage, locks = globalThis.navigator?.locks) { super(); this.storage = storage; this.locks = locks; }
  read() {
    try {
      const raw = this.storage.getItem(REMOTE_STORAGE_KEY);
      if (raw === null) return { formatVersion: 1, connections: [] };
      relayEnsure(raw.length <= 1_000_000, 'PAYLOAD_TOO_LARGE');
      const data = JSON.parse(raw);
      object(data, ['formatVersion', 'connections'], 'Connexions');
      relayEnsure(data.formatVersion === 1 && Array.isArray(data.connections), 'INVALID_REQUEST');
      const seen = new Set();
      data.connections = data.connections.map(item => {
        const valid = validateRemoteConnection(item), key = connectionKey(valid);
        relayEnsure(!seen.has(key), 'INVALID_REQUEST', 'Connexion dupliquée.'); seen.add(key); return valid;
      });
      return data;
    } catch (error) { if (error instanceof RelayError) throw error; throw new RelayError('RELAY_UNAVAILABLE', 'Connexions locales illisibles ; aucune donnée remplacée.'); }
  }
  async get(ref) { const key = connectionKey(ref); return this.read().connections.find(item => connectionKey(item) === key) || null; }
  async list() { return this.read().connections; }
  async change(operation) {
    relayEnsure(this.locks?.request, 'RELAY_UNAVAILABLE', 'Les écritures de connexions nécessitent Web Locks.');
    return this.locks.request(REMOTE_STORAGE_KEY, () => {
      const data = this.read(); operation(data);
      const raw = JSON.stringify(data); relayEnsure(raw.length <= 1_000_000, 'PAYLOAD_TOO_LARGE');
      try { this.storage.setItem(REMOTE_STORAGE_KEY, raw); }
      catch { throw new RelayError('RELAY_UNAVAILABLE', 'Impossible de conserver la capacité locale : stockage plein ou indisponible.'); }
    });
  }
  async put(input, options = {}) {
    const valid = validateRemoteConnection(input), key = connectionKey(valid);
    return this.change(data => {
      const index = data.connections.findIndex(item => connectionKey(item) === key);
      const next = validateConnectionReplacement(data.connections[index], valid, options);
      if (index < 0) data.connections.push(next); else data.connections[index] = next;
    });
  }
  async delete(ref) { const key = connectionKey(ref); return this.change(data => { data.connections = data.connections.filter(item => connectionKey(item) !== key); }); }
}
