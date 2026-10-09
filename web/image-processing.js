import { ensure } from '../shared/validation.js';
import { IMAGE_LIMITS, MAX_INPUT_BYTES, inspectImage } from '../shared/image-format.js';
import { makeAsset, validateAsset } from '../shared/assets.js';

/** Le navigateur applique l'orientation EXIF ; le canvas réencode uniquement les pixels. */
async function decode(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { throw new Error('Image invalide : ce fichier ne peut pas être décodé.'); }
}
export async function verifyDecodedAsset(asset) {
  await validateAsset(asset);
  const bitmap = await decode(asset.blob);
  try { ensure(bitmap.width === asset.width && bitmap.height === asset.height, 'Dimensions réelles de l’image incohérentes.'); }
  finally { bitmap.close(); }
}

export async function processImage(file, kind) {
  const limit = IMAGE_LIMITS[kind]; ensure(limit, 'Usage d’image inconnu.');
  ensure(file instanceof Blob && file.size > 0 && file.size <= MAX_INPUT_BYTES, 'Image trop volumineuse : fichier de 20 Mo maximum.');
  const info = inspectImage(new Uint8Array(await file.arrayBuffer()));
  ensure(!file.type || file.type === info.mimeType, 'Le format déclaré ne correspond pas au fichier.');
  const bitmap = await decode(file);
  const canvas = document.createElement('canvas');
  try {
    ensure(bitmap.width * bitmap.height <= 24_000_000 && bitmap.width <= 16384 && bitmap.height <= 16384, 'Dimensions excessives.');
    let scale = Math.min(1, limit.side / Math.max(bitmap.width, bitmap.height));
    // Réduction bornée et qualité progressive ; le PNG est le fallback natif de toBlob.
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      ensure(context, 'Traitement d’image indisponible dans ce navigateur.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', Math.max(.55, .86 - attempt * .06)));
      ensure(blob, 'Impossible de compresser cette image.');
      if (blob.size <= limit.bytes) return makeAsset(blob);
      scale *= .75;
    }
    throw new Error('Cette image reste trop volumineuse après réduction. Choisissez un fichier plus simple.');
  } finally { bitmap.close(); canvas.width = 1; canvas.height = 1; }
}
