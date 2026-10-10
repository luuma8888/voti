import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Miniflare/workerd provient du Wrangler déjà verrouillé : aucune dépendance
// ajoutée. Code métier réel, runtime réel, Siteverify simulé, zéro appel Internet.
test('Siteverify dans workerd : fetch réel, succès/refus et redirection fermée', async () => {
  let scenario = 'success', calls = 0;
  const root = resolve(import.meta.dirname, '..');
  const modules = [{ type: 'ESModule', path: import.meta.filename,
    contents: `import { verifyHuman } from '../relay/cloudflare/abuse.js';
      export default { async fetch(request, env) {
        try { await verifyHuman(request, env, 'runtime-token-fixture');
          return Response.json({ accepted: true });
        } catch (error) { return Response.json({ code: error.code }); }
      } };` }];
  for (const directory of ['shared', 'relay/cloudflare']) {
    for (const file of await readdir(resolve(root, directory))) {
      if (!file.endsWith('.js')) continue;
      const path = resolve(root, directory, file);
      modules.push({ type: 'ESModule', path, contents: await readFile(path, 'utf8') });
    }
  }
  const mf = new Miniflare(convertV4MiniflareOptions({
    compatibilityDate: '2026-10-01', modules, modulesRoot: root,
    bindings: { TURNSTILE_MODE: 'siteverify', TURNSTILE_HOSTNAMES: 'luuma8888.github.io',
      TURNSTILE_SECRET: 'runtime-fixture-not-a-real-secret' },
    outboundService: async request => {
      calls++;
      assert.equal(request.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      assert.equal(request.method, 'POST');
      const body = await request.json();
      assert.deepEqual(body, { secret: 'runtime-fixture-not-a-real-secret', response: 'runtime-token-fixture' });
      if (scenario === 'redirect') return new Response(null, { status: 302,
        headers: { Location: 'https://untrusted.invalid/' } });
      if (scenario === 'unavailable') return new Response('unavailable', { status: 503 });
      if (scenario === 'invalid') return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
      return Response.json({ success: true, hostname: scenario === 'hostname' ? 'untrusted.invalid' : 'luuma8888.github.io',
        action: 'voti-publication', challenge_ts: new Date().toISOString() });
    },
  }));
  try {
    for (const [name, expected] of [['success', { accepted: true }], ['invalid', { code: 'HUMAN_VERIFICATION_FAILED' }],
      ['redirect', { code: 'RELAY_UNAVAILABLE' }], ['unavailable', { code: 'RELAY_UNAVAILABLE' }],
      ['hostname', { code: 'HUMAN_VERIFICATION_FAILED' }]]) {
      scenario = name; const before = calls;
      const response = await mf.dispatchFetch('https://relay.invalid/api/v1/publications');
      assert.deepEqual(await response.json(), expected, name);
      assert.equal(calls, before + 1, name + ' : un seul appel, aucune redirection suivie');
    }
  } finally { await mf.dispose(); }
});
