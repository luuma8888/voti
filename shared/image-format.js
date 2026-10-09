import { ensure } from './validation.js';

export const IMAGE_LIMITS = Object.freeze({ poll: { side: 1600, bytes: 1_000_000 }, choice: { side: 1000, bytes: 600_000 } });
export const MAX_INPUT_BYTES = 20_000_000;
export const MAX_INPUT_PIXELS = 24_000_000;

/** Lit les dimensions AVANT décodage ; le décodage réel reste obligatoire côté Web. */
export function inspectImage(bytes, { normalized = false } = {}) {
  ensure(bytes instanceof Uint8Array && bytes.length >= 12, 'Image invalide ou fichier corrompu.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  let width, height, mimeType;
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') {
    mimeType = 'image/png';
    ensure(bytes.length >= 33 && ascii(12, 4) === 'IHDR' && view.getUint32(8) === 13, 'En-tête PNG invalide.');
    width = view.getUint32(16); height = view.getUint32(20);
    let end = false;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = view.getUint32(offset), kind = ascii(offset + 4, 4);
      ensure(offset + 12 + size <= bytes.length, 'PNG tronqué.');
      ensure(kind !== 'acTL', 'Les images animées ne sont pas acceptées.');
      if (normalized) ensure(!['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(kind), 'Métadonnées non autorisées dans un asset normalisé.');
      offset += 12 + size;
      if (kind === 'IEND') { ensure(offset === bytes.length && size === 0, 'PNG invalide.'); end = true; break; }
    }
    ensure(end, 'PNG incomplet.');
  } else if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    mimeType = 'image/webp';
    ensure(view.getUint32(4, true) + 8 === bytes.length, 'WebP tronqué ou incohérent.');
    const uint24 = offset => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
    for (let offset = 12; offset < bytes.length;) {
      ensure(offset + 8 <= bytes.length, 'WebP incomplet.');
      const kind = ascii(offset, 4), size = view.getUint32(offset + 4, true), p = offset + 8;
      ensure(p + size <= bytes.length, 'WebP invalide.');
      ensure(!['ANIM', 'ANMF'].includes(kind), 'Les images animées ne sont pas acceptées.');
      if (normalized) ensure(!['EXIF', 'XMP '].includes(kind), 'Métadonnées non autorisées dans un asset normalisé.');
      if (kind === 'VP8X') {
        ensure(size >= 10 && !(bytes[p] & 2), 'WebP animé ou invalide.');
        width = uint24(p + 4) + 1; height = uint24(p + 7) + 1;
      } else if (kind === 'VP8 ' && width === undefined) {
        ensure(size >= 10 && ascii(p + 3, 3) === '\x9d\x01\x2a', 'WebP invalide.');
        width = view.getUint16(p + 6, true) & 0x3fff; height = view.getUint16(p + 8, true) & 0x3fff;
      } else if (kind === 'VP8L' && width === undefined) {
        ensure(size >= 5 && bytes[p] === 0x2f, 'WebP invalide.');
        const bits = view.getUint32(p + 1, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
      }
      offset = p + size + (size % 2);
      ensure(offset <= bytes.length, 'WebP invalide.');
    }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    ensure(!normalized, 'Seuls WebP et PNG normalisés sont stockés.');
    mimeType = 'image/jpeg';
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      ensure(bytes[offset++] === 0xff, 'JPEG invalide.');
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      ensure(offset + 2 <= bytes.length, 'JPEG tronqué.');
      const size = view.getUint16(offset);
      ensure(size >= 2 && offset + size <= bytes.length, 'JPEG tronqué.');
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        ensure(size >= 8, 'Dimensions JPEG invalides.');
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += size;
    }
  } else throw new Error('Fichier non reconnu. Choisissez une image JPEG, PNG ou WebP fixe (SVG et GIF refusés).');
  ensure(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 16384 && height <= 16384 && width * height <= MAX_INPUT_PIXELS,
    'Dimensions excessives ou invalides : maximum 24 millions de pixels et 16 384 px par côté.');
  return { mimeType, width, height };
}
