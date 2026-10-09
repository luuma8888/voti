import { emptyState } from '../shared/model.js';
import { parseExport, serialize } from '../shared/serialization.js';
import { assetReferences, validateReferences } from '../shared/assets.js';

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
  constructor(adapter, locks = globalThis.navigator?.locks, assets = null) {
    this.adapter = adapter; this.locks = locks; this.assets = assets; this.pending = Promise.resolve(); this.state = emptyState(); this.warning = '';
  }
  async load() {
    const raw = this.adapter.read();
    this.state = raw === null ? emptyState() : await parseExport(raw);
    return structuredClone(this.state);
  }
  exclusive(operation) {
    const run = this.pending.then(() => this.locks ? this.locks.request(STORAGE_KEY, operation) : operation());
    this.pending = run.catch(() => {}); return run;
  }
  async cleanup() {
    if (!this.assets) return;
    if (!this.locks) throw new Error('Le nettoyage des images nécessite un navigateur prenant en charge les verrous locaux.');
    const raw = this.adapter.read();
    const live = raw === null ? emptyState() : await parseExport(raw);
    await this.assets.collectOrphans(assetReferences(live).keys());
  }
  recoverAssets() { return this.exclusive(() => this.cleanup()); }
  transact(operation, staged = []) {
    const operationWithStorage = async () => {
      const raw = this.adapter.read();
      const before = raw === null ? emptyState() : await parseExport(raw);
      const hadAssets = assetReferences(before).size > 0;
      const candidate = await operation(before);
      const serialized = await serialize(candidate);
      const refs = assetReferences(candidate);
      const pending = new Map(staged.filter(asset => refs.has(asset.id)).map(asset => [asset.id, asset]));
      if (refs.size || pending.size) {
        if (!this.assets || !this.locks) throw new Error('Les images nécessitent IndexedDB et les verrous locaux de ce navigateur.');
        await validateReferences(candidate, id => pending.get(id) || this.assets.get(id));
        await this.assets.putMany([...pending.values()]);
      }
      try { this.adapter.write(serialized, raw); }
      catch (error) {
        try { if (pending.size) await this.cleanup(); }
        catch (cleanupError) { throw new Error(`${error.message} Nettoyage des images en attente : ${cleanupError.message}`, { cause: error }); }
        throw error;
      }
      this.state = JSON.parse(serialized);
      this.warning = '';
      // Après publication, un échec de nettoyage ne transforme pas un succès en faux échec.
      try { if (this.assets && (hadAssets || pending.size)) await this.cleanup(); }
      catch { this.warning = 'Enregistrement réussi. Nettoyage des images inutilisées à réessayer au prochain démarrage.'; }
      return structuredClone(this.state);
    };
    return this.exclusive(operationWithStorage);
  }
}
