import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT } from './build.mjs';

let count = 0;
for (const directory of ['shared', 'web', 'scripts', 'tests', 'relay/cloudflare']) {
  for (const file of await readdir(resolve(ROOT, directory))) {
    if (!/\.(?:js|mjs)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', resolve(ROOT, directory, file)], { encoding: 'utf8' });
    if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
    count++;
  }
}
console.log(`Syntaxe OK : ${count} fichiers JavaScript.`);
