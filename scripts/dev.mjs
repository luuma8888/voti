import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, ROOT } from './build.mjs';

await build();
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  const path = new URL(request.url, 'http://localhost').pathname;
  if (!['/', '/index.html', '/voti/', '/voti/index.html'].includes(path)) { response.writeHead(404); response.end('Introuvable'); return; }
  try {
    const html = await readFile(resolve(ROOT, 'index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : html);
  } catch { response.writeHead(500); response.end('Relancez npm run build.'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Voti : http://127.0.0.1:4173 · Relancer après modification des sources.'));
