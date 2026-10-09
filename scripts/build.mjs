import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Emballe les modules ESM locaux dans une import map de data URLs.
 * Aucun compilateur, chargement réseau ou duplication du moteur n'est nécessaire.
 * Les sources acceptent exclusivement des imports statiques relatifs, nommés.
 */
export async function build() {
  const files = [];
  for (const directory of ['shared', 'web']) {
    for (const entry of await readdir(resolve(ROOT, directory))) {
      if (entry.endsWith('.js')) files.push(`${directory}/${entry}`);
    }
  }
  files.sort();
  const imports = {};
  for (const file of files) {
    let source = await readFile(resolve(ROOT, file), 'utf8');
    source = source.replace(/\bfrom\s+(['"])(\.[^'"\n]+)\1/g, (_match, quote, specifier) => {
      const dependency = relative(ROOT, resolve(ROOT, dirname(file), specifier)).split('\\').join('/');
      if (!files.includes(dependency)) throw new Error(`Import non pris en charge : ${file} → ${specifier}`);
      return `from ${quote}voti/${dependency}${quote}`;
    });
    if (/\bimport\s*\(/.test(source) || /\bfrom\s+['"](?:https?:|\/|\.)/.test(source)) {
      throw new Error(`Import non autonome dans ${file}`);
    }
    imports[`voti/${file}`] = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  }
  const template = await readFile(resolve(ROOT, 'web/index.template.html'), 'utf8');
  const css = await readFile(resolve(ROOT, 'web/styles.css'), 'utf8');
  const map = JSON.stringify({ imports }).replaceAll('<', '\\u003c');
  const html = template.replace('/* VOTI_STYLES */', css)
    .replace('<!-- VOTI_MODULES -->', `<script type="importmap">${map}</script>\n  <script type="module">import "voti/web/app.js";</script>`);
  await writeFile(resolve(ROOT, 'index.html'), html);
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = await build();
  console.log(`Build OK : index.html autonome (${Buffer.byteLength(html)} octets), aucune dépendance.`);
}
