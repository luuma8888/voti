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
  assert.equal(Object.keys(imports).length, 25);
  assert.ok(imports['voti/shared/relay.js']);
  assert.ok(imports['voti/shared/relay-client.js']);
  assert.ok(!Object.keys(imports).some(name => name.includes('in-memory-relay')));
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

test('build connecté gratuit : politique publique explicite, helpers conservés, valeurs ambiguës refusées', async () => {
  const names = ['VOTI_RELAY_URL', 'VOTI_RELAY_ID', 'VOTI_TURNSTILE_MODE', 'VOTI_TURNSTILE_SITE_KEY', 'VOTI_REMOTE_ASSETS_ENABLED'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    Object.assign(process.env, { VOTI_RELAY_URL: 'http://127.0.0.1:8787', VOTI_RELAY_ID: 'voti-free-test',
      VOTI_TURNSTILE_MODE: 'local-test', VOTI_REMOTE_ASSETS_ENABLED: 'false' });
    delete process.env.VOTI_TURNSTILE_SITE_KEY;
    const html = await build();
    const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
    const source = Buffer.from(map.imports['voti/web/relay-config.js'].split(',')[1], 'base64').toString();
    assert.match(source, /"remoteAssetsEnabled":false/);
    assert.match(source, /export function assertRemoteImagePolicy/);
    assert.doesNotMatch(source, /TURNSTILE_SECRET|voti-admin-v1\./);
    process.env.VOTI_REMOTE_ASSETS_ENABLED = 'yes';
    await assert.rejects(build(), /images distantes invalide/);
  } finally {
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
    await build();
  }
});
