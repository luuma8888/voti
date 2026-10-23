import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as bundle } from 'esbuild';
import {embeddedVisuals} from './visual-assets.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Emballe les modules ESM locaux dans une import map de data URLs.
 * Sources Voti : imports statiques relatifs nommés. Les deux bibliothèques sont
 * bundlées séparément par esbuild, sans compiler/réécrire le moteur.
 * Aucun chargement réseau runtime.
 */
export async function build() {
  const visuals=await embeddedVisuals(ROOT);
  const branding = {};
  for (const name of ['logo', 'background', 'mascot']) {
    const bytes = await readFile(resolve(ROOT, `assets/branding/voti-${name}.webp`));
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`Asset de marque WebP invalide : ${name}`);
    branding[name] = `data:image/webp;base64,${bytes.toString('base64')}`;
  }
  const files = [];
  for (const directory of ['shared', 'web']) {
    for (const entry of await readdir(resolve(ROOT, directory))) {
      if (entry.endsWith('.js')) files.push(`${directory}/${entry}`);
    }
  }
  files.sort();
  const imports = {};
  for (const name of ['qr', 'pdf', 'scanner']) {
    const output = await bundle({ entryPoints: [resolve(ROOT, `vendor/${name}.js`)], bundle: true,
      format: 'esm', platform: 'browser', target: 'es2022', minify: true, write: false, legalComments: 'inline' });
    imports[`voti/vendor/${name}.js`] = `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`;
  }
  for (const file of files) {
    let source = await readFile(resolve(ROOT, file), 'utf8');
    if(file==='web/visual-presets.js')source=source.replace('export const VISUAL_PRESETS = {member:[],group:[]};',`export const VISUAL_PRESETS = ${JSON.stringify(visuals)};`);
    if (file === 'web/relay-config.js' && process.env.VOTI_RELAY_URL) {
      const config = { relayId: process.env.VOTI_RELAY_ID || 'voti-local', baseUrl: process.env.VOTI_RELAY_URL,
        turnstileSiteKey: process.env.VOTI_TURNSTILE_SITE_KEY || null, turnstileMode: process.env.VOTI_TURNSTILE_MODE || 'siteverify',
        remoteAssetsEnabled: process.env.VOTI_REMOTE_ASSETS_ENABLED !== 'false' };
      if (process.env.VOTI_REMOTE_ASSETS_ENABLED !== undefined && !['true', 'false'].includes(process.env.VOTI_REMOTE_ASSETS_ENABLED)) throw new Error('Configuration images distantes invalide.');
      const url = new URL(config.baseUrl);
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(config.relayId) || url.username || url.password || url.search || url.hash ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) throw new Error('Configuration relais invalide.');
      if (!['siteverify', 'local-test'].includes(config.turnstileMode) || (config.turnstileSiteKey !== null && !/^[a-zA-Z0-9_-]{10,100}$/.test(config.turnstileSiteKey)) ||
        (config.turnstileMode === 'local-test' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Configuration Turnstile invalide.');
      source = source.replace('export const RELAY_CONFIG = null;', `export const RELAY_CONFIG = ${JSON.stringify(config)};`);
    }
    source = source.replace(/\bfrom\s+(['"])(\.[^'"\n]+)\1/g, (_match, quote, specifier) => {
      const dependency = relative(ROOT, resolve(ROOT, dirname(file), specifier)).split('\\').join('/');
      if (!files.includes(dependency) && !imports[`voti/${dependency}`]) throw new Error(`Import non pris en charge : ${file} → ${specifier}`);
      return `from ${quote}voti/${dependency}${quote}`;
    });
    if (/\bimport\s*\(/.test(source) || /\bfrom\s+['"](?:https?:|\/|\.)/.test(source)) {
      throw new Error(`Import non autonome dans ${file}`);
    }
    imports[`voti/${file}`] = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  }
  const template = await readFile(resolve(ROOT, 'web/index.template.html'), 'utf8');
  const css = await readFile(resolve(ROOT, 'web/styles.css'), 'utf8');
  const licenses = (await readFile(resolve(ROOT, 'docs/THIRD_PARTY_LICENSES.md'), 'utf8')).replaceAll('<', '&lt;');
  const map = JSON.stringify({ imports }).replaceAll('<', '\\u003c');
  const html = template.replace('/* VOTI_STYLES */', css)
    .replace('<!-- VOTI_MODULES -->', `<script type="text/plain" id="third-party-licenses">${licenses}</script>\n  <script type="importmap">${map}</script>\n  <script type="module">import "voti/web/app.js";</script>`)
    .replace('__VOTI_LOGO__', branding.logo).replace('__VOTI_MASCOT__', branding.mascot)
    .replace('__VOTI_BACKGROUND__', branding.background);
  await writeFile(resolve(ROOT, 'index.html'), html);
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = await build();
  console.log(`Build OK : index.html (${Buffer.byteLength(html)} octets) et pack WebP local, aucune ressource distante.`);
}
