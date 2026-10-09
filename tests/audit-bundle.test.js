import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { createZip, auditPaths, AUDIT_NAME } from '../scripts/audit-bundle.mjs';
import { crc32 } from '../relay/cloudflare/image-validation.js';
test('Bundle audit : liste Git exacte sans cache, dépendance ni ZIP lui-même', async () => {
  const paths = await auditPaths(); assert.ok(paths.includes('AGENTS.md'));
  assert.ok(paths.includes('docs/VOTI_RELAY_V0_3C_SPEC.md'));
  assert.ok(!paths.includes(AUDIT_NAME));
  assert.equal(new Set(paths).size, paths.length);
});
test('Archive audit : ZIP UTF-8 déterministe, octets/CRC et répertoire corrects', () => {
  const entries = [['docs/rapport-é.json', Buffer.from('{"test":true}')], ['assets/image.webp', Buffer.from([0, 255, 12, 9])]];
  const zip = createZip(entries); assert.deepEqual(createZip(entries), zip);
  let p = 0;
  for (const [name, data] of entries) {
    assert.equal(zip.readUInt32LE(p), 0x04034b50);
    const length = zip.readUInt32LE(p + 18), names = zip.readUInt16LE(p + 26), start = p + 30 + names;
    assert.equal(zip.subarray(p + 30, start).toString(), name);
    assert.equal(zip.readUInt32LE(p + 14), crc32(data));
    assert.deepEqual(inflateRawSync(zip.subarray(start, start + length)), data); p = start + length;
  }
  assert.equal(zip.readUInt32LE(p), 0x02014b50); assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), entries.length); assert.equal(zip.readUInt32LE(zip.length - 6), p);
});
