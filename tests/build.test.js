import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, ROOT } from '../scripts/build.mjs';

test('build autonome : tous les modules embarqués, aucun script/CSS externe', async () => {
  const html = await build();
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+(?:href|rel)=|@import|url\(https?:/i);
  const match = html.match(/<script type="importmap">(.*?)<\/script>/s);
  const { imports } = JSON.parse(match[1]);
  assert.equal(Object.keys(imports).length, 16);
  assert.ok(imports['voti/web/app.js']);
  for (const [name, data] of Object.entries(imports)) {
    assert.ok(data.startsWith('data:text/javascript;base64,'), name);
    const source = Buffer.from(data.split(',')[1], 'base64').toString();
    assert.doesNotMatch(source, /\bfrom\s+['"]\./);
    for (const [, specifier] of source.matchAll(/\bfrom\s+['"](voti\/[^'"]+)['"]/g)) assert.ok(imports[specifier], specifier);
  }
});

test('les trois WebP de marque sont embarqués exactement, sans PNG source', async () => {
  const html = await build();
  for (const name of ['logo', 'background', 'mascot']) {
    const file = await readFile(resolve(ROOT, `assets/branding/voti-${name}.webp`));
    assert.equal(file.toString('ascii', 8, 12), 'WEBP');
    assert.ok(html.includes(`data:image/webp;base64,${file.toString('base64')}`));
  }
  assert.equal((html.match(/data:image\/webp;base64,/g) || []).length, 3);
  assert.doesNotMatch(html, /data:image\/png|branding\/source|__VOTI_(?:LOGO|BACKGROUND|MASCOT)__/);
});

test('build déterministe et page française responsive, nuit et impression', async () => {
  const first = await build(); const second = await build();
  assert.equal(first, second);
  assert.match(first, /lang="fr"/);
  assert.match(first, /name="viewport"/);
  assert.match(first, /data-theme=dark/);
  assert.match(first, /@media print/);
});

test('rendu des données : pas de sinks HTML exécutables', async () => {
  const source = await readFile(resolve(ROOT, 'web/app.js'), 'utf8');
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/);
  assert.match(source, /node\.textContent = text/);
});
