import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { buildPollUrl, buildChoiceUrl, buildResultsUrl, buildAdminTransferUrl, encodeAdminPayload, decodeAdminPayload } from '../shared/qr-links.js';
import { createQrMatrix, renderQrSvg, drawQr } from '../web/qr.js';
import { consumeAdminFragment } from '../web/admin-transfer.js';
import { published } from './fixtures.js';
import { readFile } from 'node:fs/promises';

const id = '09f5d0ce-80d7-4765-a2eb-7a5a651d1f79', choice = '10000000-0000-4000-8000-000000000001';
const key = { version: 1, relayId: 'voti-production', pollId: id, adminCapability: 'voti-admin-v1.' + 'a'.repeat(64) };
function decode(matrix) {
  const scale = 6, size = matrix.size * scale, pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = (y * size + x) * 4, color = matrix.cells[Math.floor(y / scale)][Math.floor(x / scale)] ? 0 : 255;
    pixels[n] = pixels[n + 1] = pixels[n + 2] = color; pixels[n + 3] = 255;
  }
  return jsQR(pixels, size, size)?.data;
}
test('QR : URLs canoniques, aucun secret dans les destinations publiques', () => {
  assert.equal(buildPollUrl(id), `https://luuma8888.github.io/voti/#/p/${id}`);
  assert.equal(buildResultsUrl(id), buildPollUrl(id) + '/results');
  assert.equal(buildChoiceUrl(id, choice), buildPollUrl(id) + '/choice/' + choice);
  assert.ok(![buildPollUrl(id), buildResultsUrl(id), buildChoiceUrl(id, choice)].some(url => url.includes('admin')));
  for (const bad of ['', '../x', 'a/b', '<img>', key.adminCapability, id.toUpperCase(), null]) assert.throws(() => buildPollUrl(bad));
  for (const bad of ['', 'x', '../x', key.adminCapability, null]) assert.throws(() => buildChoiceUrl(id, bad));
  for (const bad of ['javascript:alert(1)', 'https://example.test/?secret=a', 'https://user:pass@example.test/', 'https://example.test/#secret', 'http://example.test/']) assert.throws(() => buildPollUrl(id, bad));
});
for (const n of [2, 3, 6]) test(`QR : ${n} choix, matrice déterministe, quiet zone M, décodage indépendant`, () => {
  for (let i = 0; i < n; i++) {
    const choiceId = `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, url = buildChoiceUrl(id, choiceId);
    const a = createQrMatrix(url); assert.deepEqual(a, createQrMatrix(url));
    assert.equal(a.size, a.modules + 8); assert.equal(a.quietZone, 4); assert.equal(a.errorCorrection, 'M');
    a.cells.forEach((row, y) => row.forEach((value, x) => { if (y < 4 || x < 4 || y >= a.size - 4 || x >= a.size - 4) assert.equal(value, false); }));
    assert.equal(decode(a), url);
    const svg = renderQrSvg(a); assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /shape-rendering="crispEdges"/); assert.doesNotMatch(svg, /<script|onload|href|foreignObject|voti-admin/);
  }
});
test('QR : payload UTF-8 et secret encodés/décodés sans perte', () => {
  for (const payload of ['Voti été pêche à Noël', buildPollUrl(id), buildResultsUrl(id), buildAdminTransferUrl(key)]) assert.equal(decode(createQrMatrix(payload)), payload);
  assert.throws(() => createQrMatrix('x'.repeat(1801)));
  assert.throws(() => createQrMatrix(null));
});
test('QR admin : format fichier exact, versions/relais/structure/capacité invalides refusés', () => {
  const payload = encodeAdminPayload(key); assert.deepEqual(decodeAdminPayload(payload, key.relayId), key);
  assert.equal(new URL(buildAdminTransferUrl(key)).search, '');
  for (const invalid of ['***', '', 'x'.repeat(5501), btoa('{}').replace(/=+$/, '')]) assert.throws(() => decodeAdminPayload(invalid, key.relayId));
  assert.throws(() => decodeAdminPayload(payload, 'other-relay'));
  for (const patch of [{ version: 2 }, { pollId: 'x' }, { adminCapability: 'x' }, { extra: true }]) assert.throws(() => encodeAdminPayload({ ...key, ...patch }));
});
test('QR admin : retrait synchrone de location/history, même payload malformé, aucun stockage/fetch', () => {
  for (const payload of [encodeAdminPayload(key), '***', '']) {
    const loc = { hash: '#/admin/import/' + payload, pathname: '/voti/', search: '' };
    const history = { replaceState(state, title, url) { assert.equal(state, null); assert.equal(title, ''); assert.equal(url, '/voti/#admin-transfer'); loc.hash = '#admin-transfer'; } };
    assert.equal(consumeAdminFragment(loc, history), payload); assert.equal(loc.hash, '#admin-transfer');
    assert.equal(consumeAdminFragment(loc, history), null);
  }
});
test('QR canvas : rectangles sur pixels entiers, fond blanc et lissage désactivé', () => {
  const calls = [], context = { fillRect(...args) { calls.push(args); } };
  drawQr(context, createQrMatrix(buildPollUrl(id)), 20, 40, 6);
  assert.equal(context.imageSmoothingEnabled, false); assert.ok(calls.every(args => args.every(Number.isInteger)));
  assert.throws(() => drawQr(context, createQrMatrix('x'), .5, 0, 4));
});
test('QR admin : bootstrap nettoyé avant stockage, pas de capacité dans DOM public ou PDF', async () => {
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.ok(app.indexOf('consumeAdminFragment(location, history)') < app.indexOf('new LocalStorageRemoteConnectionAdapter'));
  const transfer = await readFile(new URL('../web/admin-transfer.js', import.meta.url), 'utf8');
  assert.doesNotMatch(transfer, /fetch\(|localStorage|console\./);
  const poster = await readFile(new URL('../web/poster.js', import.meta.url), 'utf8');
  assert.doesNotMatch(poster, /adminCapability|buildAdminTransferUrl|exportAdminKey/);
});
