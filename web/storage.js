import { emptyState } from '../shared/model.js';
import { parseExport, serialize } from '../shared/serialization.js';

export const STORAGE_KEY = 'voti.local.v1';

/** Contrat : lire un snapshot brut ; écrire atomiquement si le snapshot n'a pas changé. */
export class StorageAdapter {
  read() { throw new Error('StorageAdapter.read doit être implémenté.'); }
  write(_raw, _expected) { throw new Error('StorageAdapter.write doit être implémenté.'); }
}

export class LocalStorageAdapter extends StorageAdapter {
  constructor(storage) { super(); this.storage = storage; }
  read() {
    try { return this.storage.getItem(STORAGE_KEY); }
    catch { throw new Error('Le stockage local est inaccessible. Aucune donnée n’a été écrasée.'); }
  }
  write(raw, expected) {
    if (this.read() !== expected) throw new Error('Les données ont changé dans un autre onglet. Rechargez et réessayez.');
    try { this.storage.setItem(STORAGE_KEY, raw); }
    catch { throw new Error('Sauvegarde locale impossible : stockage indisponible ou plein. L’action n’a pas été enregistrée.'); }
  }
}

/** File locale de transactions ; relecture, validation complète, puis un seul setItem. */
export class Repository {
  constructor(adapter, locks = globalThis.navigator?.locks) {
    this.adapter = adapter; this.locks = locks; this.pending = Promise.resolve(); this.state = emptyState();
  }
  async load() {
    const raw = this.adapter.read();
    this.state = raw === null ? emptyState() : await parseExport(raw);
    return structuredClone(this.state);
  }
  transact(operation) {
    const operationWithStorage = async () => {
      const raw = this.adapter.read();
      const before = raw === null ? emptyState() : await parseExport(raw);
      const candidate = await operation(before);
      const serialized = await serialize(candidate);
      this.adapter.write(serialized, raw);
      this.state = JSON.parse(serialized);
      return structuredClone(this.state);
    };
    const run = this.pending.then(() => this.locks
      ? this.locks.request(STORAGE_KEY, operationWithStorage)
      : operationWithStorage());
    this.pending = run.catch(() => {});
    return run;
  }
}
