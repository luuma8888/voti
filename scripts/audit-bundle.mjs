import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { ROOT } from './build.mjs';
import { crc32 } from '../relay/cloudflare/image-validation.js';

export const AUDIT_NAME = 'VOTI_AUDIT_V0_3D.zip';
export function isAuditArchive(path) { return /(?:^|\/)VOTI_AUDIT_[^/]*\.zip$/i.test(path); }
export async function auditPaths() {
  const { stdout } = await promisify(execFile)('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8_000_000 });
  // Exclure aussi les anciennes archives déjà suivies par Git : jamais de ZIP récursif.
  const paths = [...new Set(stdout.split('\0').filter(path => path && !isAuditArchive(path)))].sort();
  for (const path of paths) {
    if (path === AUDIT_NAME || path.startsWith('/') || path.split('/').includes('..') ||
      /^(?:node_modules|\.npm-cache|\.wrangler|\.relay-local|\.browser-tests|\.git|\.aws|coverage)(?:\/|$)/.test(path)) throw new Error('Contenu interdit dans le bundle d’audit.');
  }
  return paths;
}
/** ZIP standard UTF-8, Deflate natif et CRC de conteneur. Aucun outil/dépendance ajouté. */
export function createZip(entries) {
  const files = [], directory = []; let offset = 0;
  if (entries.length > 65535) throw new Error('ZIP64 non pris en charge.');
  for (const [path, data] of entries) {
    const name = Buffer.from(path), packed = deflateRawSync(data), checksum = crc32(data);
    if (data.length > 0xffffffff || offset + packed.length > 0xffffffff || name.length > 65535) throw new Error('Bundle trop volumineux.');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12); header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    files.push(header, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); directory.push(central, name);
    offset += header.length + name.length + packed.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, central, end]);
}
if (process.argv[1] === import.meta.filename) {
  const paths = await auditPaths(), entries = [];
  for (const path of paths) {
    const file = resolve(ROOT, path);
    if (!(await lstat(file)).isFile()) throw new Error('Le bundle refuse les liens et fichiers spéciaux.');
    entries.push([path, await readFile(file)]);
  }
  const zip = createZip(entries); await writeFile(resolve(ROOT, AUDIT_NAME), zip);
  console.log(`Audit : ${AUDIT_NAME} — ${zip.length} octets, ${paths.length} fichiers Git admissibles.`);
}
