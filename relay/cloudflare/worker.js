import { RelayError, relayEnsure as need } from '../../shared/relay.js';
import { HTTP_ROUTES, readBoundedJson } from '../../shared/relay-wire.js';
import { CloudflareRelay, cleanup, capabilityDigest } from './service.js';

const statuses = { NOT_FOUND: 404, INVALID_CAPABILITY: 403, REVISION_CONFLICT: 409, POLL_CLOSED: 409,
  POLL_LOCKED: 409, RESULTS_LOCKED: 423, IDEMPOTENCY_CONFLICT: 409, PUBLICATION_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429, RELAY_UNAVAILABLE: 503 };
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    const headers = { 'Vary': 'Origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (origin && !allowed.includes(origin)) return Response.json({ error: { code: 'INVALID_REQUEST', message: 'Origine refusée.', details: {} } }, { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') {
      const requested = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
      if (!['GET','POST','PUT','PATCH','DELETE'].includes(request.headers.get('Access-Control-Request-Method')) || requested.some(x => !['authorization','content-type'].includes(x))) return new Response(null, { status: 403, headers });
      return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
    }
    try {
      const url = new URL(request.url); need(!url.search, 'INVALID_REQUEST');
      let selected;
      for (const [name, [verb, path]] of Object.entries(HTTP_ROUTES)) {
        const match = url.pathname.match(new RegExp(`^/api/v1/${path.replace(':id', '([a-f0-9-]+)').replace(':asset', '(sha256-[a-f0-9]{64})')}$`));
        if (request.method === verb && match) { selected = { name, id: match[1], assetId: match[2] }; break; }
      }
      need(selected, 'NOT_FOUND');
      const { name, id, assetId } = selected;
      const capability = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      const admin = !['getPoll','getResults','getAsset','castVote'].includes(name);
      let limitKey = `${id || 'publication'}:${name}`;
      if (admin) limitKey = await capabilityDigest(env.RELAY_ID, id || 'publication', capability);
      need(env.LIMITER && (await env.LIMITER.limit({ key: limitKey })).success, 'RATE_LIMITED');
      const body = request.method === 'GET' ? {} : await readBoundedJson(request, name === 'putAssets' ? 20_000_000 : 65_536);
      const result = await new CloudflareRelay(env).execute(name, id, body, capability, assetId);
      ctx.waitUntil(cleanup(env).catch(() => {}));
      return Response.json(result, { headers });
    } catch (failure) {
      const error = failure instanceof RelayError ? failure : new RelayError('RELAY_UNAVAILABLE');
      if (error.code === 'RATE_LIMITED') headers['Retry-After'] = '60';
      return Response.json({ error: error.toJSON() }, { status: statuses[error.code] || 400, headers });
    }
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(cleanup(env)); },
};
