import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
export const localEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true',
  XDG_CONFIG_HOME: resolve(root, '.relay-local/config'), XDG_CACHE_HOME: resolve(root, '.relay-local/cache'),
  WRANGLER_LOG_PATH: resolve(root, '.relay-local/logs') };
export function wrangler(args, options = {}) {
  return spawn(resolve(root, 'node_modules/node/bin/node'), [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...args],
    { cwd: root, env: localEnv, stdio: 'inherit', ...options });
}
export const configArgs = ['--config', 'relay/cloudflare/wrangler.jsonc'];
export const persistence = ['--persist-to', '.relay-local/state'];
if (process.argv[1] === import.meta.filename) {
  await mkdir(resolve(root, '.relay-local/logs'), { recursive: true });
  const action = process.argv[2];
  if (action === 'cleanup') {
    const result = await fetch('http://127.0.0.1:8787/__scheduled?cron=17+*+*+*+*');
    if (!result.ok) throw new Error('Nettoyage local non exécuté : démarrez worker:local.');
    console.log('Nettoyage local demandé.');
  } else {
  const commands = {
    dev: ['dev', ...configArgs, '--local', '--test-scheduled', '--ip', '127.0.0.1', '--port', '8787', ...persistence],
    migrate: ['d1', 'migrations', 'apply', 'voti-local', ...configArgs, '--local', ...persistence],
  };
  if (!commands[action]) throw new Error('Action locale inconnue. Seuls dev/migrate sont autorisés.');
  const child = wrangler(commands[action]);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => { process.exitCode = code || 0; });
  }
}
