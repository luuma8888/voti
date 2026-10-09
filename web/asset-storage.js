import { AssetAdapter, metadata, validateAsset } from '../shared/assets.js';

function storageError(error) {
  return new Error(error?.name === 'QuotaExceededError'
    ? 'Quota d’images dépassé. Libérez de l’espace sur cet appareil et réessayez.'
    : 'Stockage des images indisponible. Réessayez ; vos sondages existants sont conservés.', { cause: error });
}

/** En file://, isoler chaque document : IndexedDB peut partager une origine tandis
 * que localStorage est propre au fichier. Un autre HTML ne doit jamais nettoyer nos images. */
export function assetDatabaseName(location = globalThis.location) {
  return location?.protocol === 'file:' ? `voti.assets.v1:file:${encodeURIComponent(location.pathname)}` : 'voti.assets.v1';
}

/** IndexedDB ne contient que les images utilisateur ; aucun asset de marque. */
export class IndexedDBAssetAdapter extends AssetAdapter {
  constructor(factory = globalThis.indexedDB, name = assetDatabaseName()) {
    super(); this.factory = factory; this.name = name; this.opening = null;
  }
  open() {
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      if (!this.factory) { reject(storageError()); return; }
      const request = this.factory.open(this.name, 1);
      let settled = false;
      const fail = error => { settled = true; reject(storageError(error)); };
      request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('Fermez les autres onglets de Voti puis réessayez.'));
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        const db = request.result;
        db.onversionchange = () => { db.close(); this.opening = null; };
        resolve(db);
      };
    }).catch(error => { this.opening = null; throw error; });
    return this.opening;
  }
  async transaction(mode, schedule) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', mode), store = tx.objectStore('assets');
      let value, failure;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure || storageError(tx.error));
      tx.onerror = () => {}; // onabort fournit le résultat définitif de la transaction.
      try { schedule(store, result => { value = result; }, error => { failure = error; tx.abort(); }); }
      catch (error) { failure = storageError(error); tx.abort(); }
    });
  }
  get(id) {
    return this.transaction('readonly', (store, result) => {
      const request = store.get(id); request.onsuccess = () => result(request.result || null);
    });
  }
  listMetadata() {
    return this.transaction('readonly', (store, result) => {
      const items = [], request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { items.push(metadata(cursor.value)); cursor.continue(); }
        else result(items);
      };
    });
  }
  async putMany(assets) {
    for (const asset of assets) await validateAsset(asset);
    return this.transaction('readwrite', (store, _result, abort) => {
      for (const asset of assets) {
        const request = store.get(asset.id);
        request.onsuccess = () => {
          if (!request.result) store.add(asset);
          else if (JSON.stringify(metadata(request.result)) !== JSON.stringify(metadata(asset))) abort(new Error('Un asset existant ne peut pas être remplacé.'));
          else store.put(asset); // Mêmes octets vérifiés par id : répare une éventuelle copie binaire corrompue.
        };
      }
    });
  }
  async deleteMany(ids) {
    if (!ids.length) return;
    return this.transaction('readwrite', store => { for (const id of ids) store.delete(id); });
  }
}
