import { deflateSync } from 'node:zlib';
import { crc32 } from '../relay/cloudflare/image-validation.js';
export function pngFixture(red = 100, width = 1, height = 1) {
  const chunk = (kind, body) => {
    const result = Buffer.alloc(body.length + 12); result.writeUInt32BE(body.length);
    result.write(kind, 4); body.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, result.length - 4)), result.length - 4); return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows.set([red, 150, 200, 255], y * (width * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
