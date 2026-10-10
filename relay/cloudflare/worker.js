import { RelayError, relayEnsure as need } from '../../shared/relay.js';
import { HTTP_ROUTES, readBoundedJson } from '../../shared/relay-wire.js';
import { CloudflareRelay, cleanup } from './service.js';
import { verifyHuman, limitRoute } from './abuse.js';

const statuses = { NOT_FOUND: 404, INVALID_CAPABILITY: 403, REVISION_CONFLICT: 409, POLL_CLOSED: 409,
  POLL_LOCKED: 409, RESULTS_LOCKED: 423, IDEMPOTENCY_CONFLICT: 409, PUBLICATION_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429, CREATION_RATE_LIMITED: 429, RELAY_UNAVAILABLE: 503,
  HUMAN_VERIFICATION_REQUIRED: 403, HUMAN_VERIFICATION_FAILED: 403, REMOTE_ASSETS_DISABLED: 422 };
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
      const service = new CloudflareRelay(env);
      // Limiter avant lecture du corps et toute validation coûteuse (y compris Siteverify).
      await limitRoute(env, name, id, assetId, capability, name === 'preparePublication');
      const body = request.method === 'GET' ? {} : await readBoundedJson(request,
        name === 'putAssets' && env.REMOTE_ASSETS_ENABLED !== 'false' ? 20_000_000 : 65_536);
      if (name === 'preparePublication') {
        const token = body.humanVerificationToken; delete body.humanVerificationToken;
        const existing = await service.row(body.poll?.id || '');
        // Une reprise existante est authentifiée ; elle ne démarre aucune nouvelle publication.
        if (existing) await service.admin(existing.poll_id, capability, body.expectedRevision);
        else await verifyHuman(request, env, token);
      }
      const result = await service.execute(name, id, body, capability, assetId);
      // Scheduled est le seul mécanisme automatique : aucun GC sur GET ou vote.
      if (name === 'getAsset') {
        // Cache privé navigateur court : suppression/retrait vérifié avant chaque réponse réseau.
        // Pas de cache edge qui court-circuiterait l'autorisation contextuelle.
        headers['Cache-Control'] = 'private, max-age=300, immutable';
        headers.ETag = `"${assetId}"`;
        headers['Access-Control-Expose-Headers'] = 'ETag';
      }
      return Response.json(result, { headers });
    } catch (failure) {
      const error = failure instanceof RelayError ? failure : new RelayError('RELAY_UNAVAILABLE');
      if (['RATE_LIMITED', 'CREATION_RATE_LIMITED'].includes(error.code)) headers['Retry-After'] = '60';
      return Response.json({ error: error.toJSON() }, { status: statuses[error.code] || 400, headers });
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cleanup(env).then(summary => { need(summary.failures === 0, 'RELAY_UNAVAILABLE'); }));
  },
};
