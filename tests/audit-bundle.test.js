import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { createZip, auditPaths, AUDIT_NAME, isAuditArchive, isPrivateOrTemporaryExport } from '../scripts/audit-bundle.mjs';
import { crc32 } from '../relay/cloudflare/image-validation.js';
test('Bundle audit : fichiers Git admissibles sans aucune archive VOTI récursive', async () => {
  const paths = await auditPaths(); assert.ok(paths.includes('AGENTS.md'));
  assert.ok(paths.includes('docs/VOTI_RELAY_V0_3C_SPEC.md'));
  assert.ok(!paths.includes(AUDIT_NAME));
  assert.ok(!paths.some(isAuditArchive));
  assert.ok(!paths.some(isPrivateOrTemporaryExport));
  assert.equal(new Set(paths).size, paths.length);
});
test('Audit v0.5 : .env/.dev.vars exclus même suivis par erreur',()=>{
  assert.equal(AUDIT_NAME,'VOTI_AUDIT_V0_6.zip');
  for(const path of ['.env','.env.local','relay/.dev.vars','relay/.dev.vars.test'])assert.ok(isPrivateOrTemporaryExport(path));
});
test('Audit : captures personnelles exclues, assets de marque conservés',()=>{
  for(const path of ['Screenshot 2026-10-12 20.46.53.png','Screenshot 2026-10-12 21.45.36.png','docs/Screenshot test.webp'])assert.ok(isPrivateOrTemporaryExport(path));
  assert.equal(isPrivateOrTemporaryExport('assets/branding/source/voti-logo-source.png'),false);
});
test('Audit v0.4A : aucune clé exportée ni PDF de recette, même suivi par erreur', () => {
  assert.equal(AUDIT_NAME, 'VOTI_AUDIT_V0_6.zip');
  for(const path of ['voti-admin-test.json','docs/voti-admin-test.json','.browser-tests/test.pdf','voti-affiche-test.pdf']) assert.ok(isPrivateOrTemporaryExport(path));
  assert.equal(isPrivateOrTemporaryExport('shared/admin-key.js'), false);
});
test('Audit : exclusion des ZIP VOTI même anciens, imbriqués ou suivis', () => {
  for (const path of ['VOTI_AUDIT_V0_3B.zip', 'VOTI_AUDIT_V0_3C.zip', AUDIT_NAME, 'docs/VOTI_AUDIT_ancien.zip']) assert.ok(isAuditArchive(path));
  assert.equal(isAuditArchive('docs/rapport.md'), false);
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
