import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, ROOT } from './build.mjs';

// Configuration publique seulement. N'effectue aucun déploiement ni changement de forfait.
const config = JSON.parse(await readFile(resolve(ROOT, 'web/relay-production.json'), 'utf8'));
const expected = ['baseUrl', 'relayId', 'remoteAssetsEnabled', 'turnstileMode', 'turnstileSiteKey'];
if (JSON.stringify(Object.keys(config).sort()) !== JSON.stringify(expected) || config.remoteAssetsEnabled !== false ||
  config.turnstileMode !== 'siteverify' || new URL(config.baseUrl).protocol !== 'https:' || !config.turnstileSiteKey) {
  throw new Error('Configuration publique du pilote gratuit invalide.');
}
Object.assign(process.env, { VOTI_RELAY_ID: config.relayId, VOTI_RELAY_URL: config.baseUrl,
  VOTI_TURNSTILE_SITE_KEY: config.turnstileSiteKey, VOTI_TURNSTILE_MODE: config.turnstileMode,
  VOTI_REMOTE_ASSETS_ENABLED: 'false' });
const html = await build();
console.log(`Build pilote gratuit OK : ${Buffer.byteLength(html)} octets, sans images distantes.`);
