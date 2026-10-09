import { ensure, isAssetId, object } from './validation.js';
import { IMAGE_LIMITS, inspectImage } from './image-format.js';

export const ASSET_KEYS = ['id', 'formatVersion', 'mimeType', 'width', 'height', 'byteLength'];
export const MAX_ASSET_BYTES = 24_000_000;
export const MAX_ASSETS = 200;
export async function contentId(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256-' + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
export function metadata(asset) { return Object.fromEntries(ASSET_KEYS.map(key => [key, asset[key]])); }
export async function validateAsset(asset) {
  object(asset, [...ASSET_KEYS, 'blob'], 'Asset');
  ensure(isAssetId(asset.id) && asset.formatVersion === 1, 'Identifiant ou version d’asset invalide.');
  ensure(asset.blob instanceof Blob && asset.byteLength === asset.blob.size && asset.byteLength > 0 && asset.byteLength <= IMAGE_LIMITS.poll.bytes, 'Taille d’asset invalide.');
  ensure(asset.mimeType === asset.blob.type, 'Type d’asset incohérent.');
  const bytes = new Uint8Array(await asset.blob.arrayBuffer());
  const info = inspectImage(bytes, { normalized: true });
  ensure(info.mimeType === asset.mimeType && info.width === asset.width && info.height === asset.height && Math.max(info.width, info.height) <= IMAGE_LIMITS.poll.side, 'Dimensions ou format d’asset incohérents.');
  ensure(await contentId(bytes) === asset.id, 'Asset corrompu : empreinte binaire incorrecte.');
  return asset;
}
export async function makeAsset(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const info = inspectImage(bytes, { normalized: true });
  const asset = { ...info, id: await contentId(bytes), formatVersion: 1, byteLength: blob.size, blob };
  return validateAsset(asset);
}
export function assetReferences(state) {
  const refs = new Map();
  for (const poll of state.polls) {
    if (poll.definition.pollImageAssetId) refs.set(poll.definition.pollImageAssetId, refs.get(poll.definition.pollImageAssetId) || 'poll');
    for (const choice of poll.definition.choices) if (choice.imageRef) refs.set(choice.imageRef, 'choice');
  }
  return refs;
}
export async function validateReferences(state, get) {
  const refs = assetReferences(state);
  ensure(refs.size <= MAX_ASSETS, 'La bibliothèque est limitée à 200 images pour garantir sa sauvegarde.');
  let total = 0;
  for (const [id, kind] of refs) {
    const asset = await get(id);
    ensure(asset, 'Asset absent : une image référencée manque à la sauvegarde.');
    await validateAsset(asset);
    total += asset.byteLength;
    ensure(total <= MAX_ASSET_BYTES, 'La bibliothèque est limitée à 24 Mo d’images pour garantir sa sauvegarde.');
    ensure(asset.byteLength <= IMAGE_LIMITS[kind].bytes && Math.max(asset.width, asset.height) <= IMAGE_LIMITS[kind].side, 'Image trop grande pour cet usage.');
  }
}

/** Contrat binaire indépendant du DOM. putMany et deleteMany sont atomiques.
 * Identités liées au contenu : un id existant ne peut jamais changer de contenu.
 * listMetadata ne retourne pas les blobs ; un export les lit un par un via get.
 * Le nettoyage reçoit les références du snapshot courant sous verrou du repository.
 */
export class AssetAdapter {
  async put(asset) { await this.putMany([asset]); return asset.id; }
  async get(_id) { throw new Error('AssetAdapter.get doit être implémenté.'); }
  async has(id) { return (await this.get(id)) !== null; }
  async delete(id) { return this.deleteMany([id]); }
  async putMany(_assets) { throw new Error('AssetAdapter.putMany doit être implémenté.'); }
  async deleteMany(_ids) { throw new Error('AssetAdapter.deleteMany doit être implémenté.'); }
  async listMetadata() { throw new Error('AssetAdapter.listMetadata doit être implémenté.'); }
  async collectOrphans(referencedIds) {
    const keep = new Set(referencedIds);
    const ids = (await this.listMetadata()).map(item => item.id).filter(id => !keep.has(id));
    await this.deleteMany(ids); return ids;
  }
}

/** Implémentation de contrat pour tests et futurs adaptateurs, sans stockage implicite. */
export class MemoryAssetAdapter extends AssetAdapter {
  constructor({ quota = Infinity } = {}) { super(); this.records = new Map(); this.quota = quota; }
  async get(id) { return this.records.has(id) ? structuredClone(this.records.get(id)) : null; }
  async listMetadata() { return [...this.records.values()].map(metadata); }
  async putMany(assets) {
    for (const asset of assets) await validateAsset(asset);
    const next = new Map(this.records);
    for (const asset of assets) {
      const old = next.get(asset.id);
      ensure(!old || JSON.stringify(metadata(old)) === JSON.stringify(metadata(asset)), 'Un asset existant ne peut pas être remplacé.');
      next.set(asset.id, structuredClone(asset));
    }
    ensure([...next.values()].reduce((total, asset) => total + asset.byteLength, 0) <= this.quota, 'Quota d’images dépassé. Libérez de l’espace et réessayez.');
    this.records = next;
  }
  async deleteMany(ids) { for (const id of ids) this.records.delete(id); }
}
