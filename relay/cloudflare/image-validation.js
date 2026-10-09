import { relayEnsure as need, RelayError } from '../../shared/relay.js';

const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
/** CRC de conteneur PNG, pas une primitive cryptographique. SHA-256 reste obligatoire. */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
/** Durcissement serveur uniquement : aucune modification des octets/identités. */
export async function validateServerImage(asset) {
  const bytes = new Uint8Array(await asset.blob.arrayBuffer()), v = new DataView(bytes.buffer);
  const text = (p, n) => String.fromCharCode(...bytes.subarray(p, p + n));
  const bad = condition => need(condition, 'ASSET_INVALID');
  bad(bytes.length <= 1000000 && asset.width <= 1600 && asset.height <= 1600 && asset.width * asset.height <= 2560000);
  try {
    if (asset.mimeType === 'image/png') {
      bad(text(0, 8) === '\x89PNG\r\n\x1a\n');
      const color = bytes[25]; let paletteEntries = 0;
      const seen = new Set(), idat = []; let phase = 0, chunks = 0;
      const allowed = ['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM', 'iCCP', 'cICP', 'sBIT', 'pHYs'];
      for (let p = 8; p < bytes.length;) {
        bad(p + 12 <= bytes.length && ++chunks <= 256);
        const size = v.getUint32(p), kind = text(p + 4, 4), end = p + 12 + size;
        bad(end <= bytes.length && allowed.includes(kind));
        bad(crc32(bytes.subarray(p + 4, end - 4)) === v.getUint32(end - 4));
        bad(kind === 'IDAT' || !seen.has(kind));
        if (p === 8) bad(kind === 'IHDR' && size === 13);
        if (kind === 'IHDR') bad(p === 8 && size === 13);
        else if (kind === 'IDAT') { bad(phase < 2 && size > 0); phase = 1; idat.push(bytes.subarray(p + 8, end - 4)); }
        else if (kind === 'IEND') { bad(size === 0 && idat.length > 0 && end === bytes.length); phase = 2; }
        else {
          bad(phase === 0);
          if (kind === 'PLTE') { bad([2, 3, 6].includes(color) && size >= 3 && size <= 768 && size % 3 === 0); paletteEntries = size / 3; }
          if (kind === 'tRNS') {
            bad((color === 0 && size === 2 && v.getUint16(p + 8) <= 255) ||
              (color === 2 && size === 6 && [8, 10, 12].every(k => v.getUint16(p + k) <= 255)) ||
              (color === 3 && paletteEntries > 0 && size > 0 && size <= paletteEntries));
          }
          if (kind === 'sRGB') bad(size === 1 && bytes[p + 8] <= 3 && !seen.has('iCCP'));
          if (kind === 'gAMA') bad(size === 4 && v.getUint32(p + 8) > 0);
          if (kind === 'cHRM') bad(size === 32);
          if (kind === 'cICP') bad(size === 4);
          if (kind === 'pHYs') bad(size === 9 && bytes[p + 16] <= 1);
          if (kind === 'sBIT') bad(size === ({ 0: 1, 2: 3, 3: 3, 4: 2, 6: 4 }[color]) && bytes.subarray(p + 8, end - 4).every(b => b > 0 && b <= 8));
          if (kind === 'iCCP') {
            const zero = bytes.subarray(p + 8, end - 4).indexOf(0);
            bad(!seen.has('sRGB') && size <= 65536 && zero > 0 && zero <= 79 && size > zero + 2 && bytes[p + 9 + zero] === 0);
          }
        }
        seen.add(kind); p = end;
      }
      bad(seen.has('IEND'));
      const depth = bytes[24];
      // Les encodeurs canvas normalisés produisent ces formats fixes, non entrelacés.
      bad(depth === 8 && [0, 2, 3, 4, 6].includes(color) && bytes[26] === 0 && bytes[27] === 0 && bytes[28] === 0);
      bad(color !== 3 || seen.has('PLTE'));
      bad(v.getUint32(16) === asset.width && v.getUint32(20) === asset.height);
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
      const stride = 1 + asset.width * channels, expected = stride * asset.height;
      // Inflation native BORNÉE : vérifie zlib et lignes/filtres, pas le rendu des pixels.
      const reader = new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
      let total = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          bad(total + value.length <= expected);
          for (let p = (stride - total % stride) % stride; p < value.length; p += stride) bad(value[p] <= 4);
          total += value.length;
        }
        bad(total === expected);
      } finally { await reader.cancel().catch(() => {}); }
    } else {
      bad(asset.mimeType === 'image/webp' && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP' && v.getUint32(4, true) + 8 === bytes.length);
      const seen = new Set(); let dimensions, canvas, flags = 0;
      for (let p = 12; p < bytes.length;) {
        bad(p + 8 <= bytes.length); const kind = text(p, 4), size = v.getUint32(p + 4, true), start = p + 8;
        const end = start + size, next = end + size % 2;
        bad(size > 0 && next <= bytes.length && ['VP8X', 'ICCP', 'ALPH', 'VP8 ', 'VP8L'].includes(kind) && !seen.has(kind));
        if (size % 2) bad(bytes[end] === 0);
        if (kind === 'VP8X') {
          bad(p === 12 && size === 10); flags = bytes[start];
          bad((flags & 0xcf) === 0 && bytes[start + 1] === 0 && bytes[start + 2] === 0 && bytes[start + 3] === 0);
          const u24 = k => bytes[k] | bytes[k + 1] << 8 | bytes[k + 2] << 16;
          canvas = [u24(start + 4) + 1, u24(start + 7) + 1];
        } else if (kind === 'ICCP') bad(seen.has('VP8X') && (flags & 32) && !dimensions && !seen.has('ALPH') && size <= 65536);
        else if (kind === 'ALPH') {
          bad(seen.has('VP8X') && (flags & 16) && !dimensions && size > 1 && (bytes[start] & 0xc0) === 0 && (bytes[start] & 3) <= 1 && ((bytes[start] >>> 4) & 3) <= 1);
          if ((bytes[start] & 3) === 0) bad(size === 1 + canvas[0] * canvas[1]);
        }
        else {
          bad(!dimensions);
          if (kind === 'VP8 ') {
            bad(size > 10 && text(start + 3, 3) === '\x9d\x01\x2a');
            const tag = bytes[start] | bytes[start + 1] << 8 | bytes[start + 2] << 16;
            bad((tag & 1) === 0 && (tag & 16) && ((tag >>> 1) & 7) <= 3 && (tag >>> 5) > 0 && (tag >>> 5) < size - 3);
            const w = v.getUint16(start + 6, true), h = v.getUint16(start + 8, true);
            bad((w & 0xc000) === 0 && (h & 0xc000) === 0); dimensions = [w, h];
            bad(Boolean(flags & 16) === seen.has('ALPH'));
          } else {
            bad(size > 5 && bytes[start] === 0x2f && !seen.has('ALPH'));
            const bits = v.getUint32(start + 1, true); bad((bits >>> 29) === 0);
            dimensions = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
            if (canvas) bad(Boolean(flags & 16) === Boolean(bits & 0x10000000));
          }
        }
        seen.add(kind); p = next;
      }
      bad(dimensions && dimensions[0] === asset.width && dimensions[1] === asset.height);
      bad(!canvas || (canvas[0] === dimensions[0] && canvas[1] === dimensions[1]));
      bad(Boolean(flags & 32) === seen.has('ICCP'));
    }
  } catch { throw new RelayError('ASSET_INVALID', 'Image normalisée invalide.'); }
  return asset;
}
