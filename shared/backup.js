import { MAX_JSON_LENGTH } from './model.js';
import { object, ensure, validateState } from './validation.js';
import { migrateState } from './migration.js';
import { ASSET_KEYS, MAX_ASSET_BYTES, MAX_ASSETS, assetReferences, metadata, validateAsset, validateReferences } from './assets.js';

export const MAX_BACKUP_BYTES = 40_000_000;
export function encodeBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
function decodeBase64(value, expected) {
  ensure(typeof value === 'string' && value.length === Math.ceil(expected / 3) * 4 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'Données image base64 invalides.');
  const binary = atob(value), bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  ensure(bytes.length === expected && encodeBase64(bytes) === value, 'Données image base64 incohérentes.');
  return bytes;
}
export async function exportBackup(state, adapter) {
  const valid = await validateState(state);
  const records = new Map();
  await validateReferences(valid, async id => {
    const asset = await adapter.get(id); if (asset) records.set(id, asset); return asset;
  });
  ensure(records.size <= MAX_ASSETS, 'Sauvegarde limitée à 200 images.');
  const assets = []; let total = 0;
  for (const asset of records.values()) {
    total += asset.byteLength; ensure(total <= MAX_ASSET_BYTES, 'Les images de la sauvegarde dépassent 24 Mo.');
    assets.push({ ...metadata(asset), base64: encodeBase64(new Uint8Array(await asset.blob.arrayBuffer())) });
  }
  const raw = JSON.stringify({ format: 'voti-backup', backupVersion: 1, state: valid, assets });
  ensure(new TextEncoder().encode(raw).length <= MAX_BACKUP_BYTES, 'Sauvegarde trop volumineuse : 40 Mo maximum.');
  return raw;
}

/** Prépare entièrement en mémoire. Aucun appel d'écriture dans ce parseur. */
export async function parseBackup(raw, verifyDecoded) {
  ensure(typeof raw === 'string' && raw.length <= MAX_BACKUP_BYTES && new TextEncoder().encode(raw).length <= MAX_BACKUP_BYTES, 'Sauvegarde trop volumineuse : 40 Mo maximum.');
  let data; try { data = JSON.parse(raw); } catch { throw new Error('Le fichier n’est pas un JSON valide.'); }
  let state, encoded;
  if (data?.format === 'voti-backup') {
    object(data, ['format', 'backupVersion', 'state', 'assets'], 'Sauvegarde avec images');
    ensure(data.backupVersion === 1, 'Version de sauvegarde inconnue.');
    state = await migrateState(data.state); encoded = data.assets;
  } else {
    ensure(raw.length <= MAX_JSON_LENGTH, 'Ancienne sauvegarde trop volumineuse.');
    state = await migrateState(data); encoded = [];
  }
  ensure(JSON.stringify(state).length <= MAX_JSON_LENGTH, 'Données de sondages trop volumineuses.');
  ensure(Array.isArray(encoded) && encoded.length <= MAX_ASSETS, 'Liste d’assets invalide ou trop volumineuse.');
  const assets = new Map(), refs = assetReferences(state); let total = 0;
  for (const entry of encoded) {
    object(entry, [...ASSET_KEYS, 'base64'], 'Asset de sauvegarde');
    ensure(!assets.has(entry.id), 'Asset dupliqué dans la sauvegarde.');
    ensure(refs.has(entry.id), 'Asset non référencé dans la sauvegarde.');
    ensure(Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0 && entry.byteLength <= 1_000_000, 'Taille d’asset invalide.');
    total += entry.byteLength; ensure(total <= MAX_ASSET_BYTES, 'Les images de la sauvegarde dépassent 24 Mo.');
    const blob = new Blob([decodeBase64(entry.base64, entry.byteLength)], { type: entry.mimeType });
    const asset = { ...metadata(entry), blob };
    await validateAsset(asset);
    ensure(typeof verifyDecoded === 'function', 'Le décodage des images est requis avant import.');
    await verifyDecoded(asset);
    assets.set(asset.id, asset);
  }
  await validateReferences(state, id => assets.get(id));
  return { state, assets: [...assets.values()] };
}

export async function restoreBackup(repository, raw, verifyDecoded) {
  const prepared = await parseBackup(raw, verifyDecoded);
  return repository.transact(current => {
    ensure(current.polls.length === 0 && current.ballots.length === 0,
      'Import refusé : ce navigateur contient déjà des sondages. Aucun remplacement ni fusion n’est effectué.');
    return prepared.state;
  }, prepared.assets);
}
