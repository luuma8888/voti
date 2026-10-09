import { RelayError, relayEnsure as need } from '../../shared/relay.js';
import { readBoundedJson } from '../../shared/relay-wire.js';
import { capabilityDigest } from './service.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const testTokens = new Map(); // Simulation éphémère locale uniquement, jamais D1.
export function isLocalTest(request, env) {
  return env.TURNSTILE_MODE === 'local-test' && ['127.0.0.1', 'localhost'].includes(new URL(request.url).hostname);
}
/** Siteverify obligatoire en production. Pas de remoteip, token/secret jamais loggés. */
export async function verifyHuman(request, env, token, fetchImpl = globalThis.fetch) {
  need(typeof token === 'string' && token.length > 0, 'HUMAN_VERIFICATION_REQUIRED');
  need(token.length <= 2048, 'HUMAN_VERIFICATION_FAILED');
  if (isLocalTest(request, env)) {
    const match = /^voti-local-test\.([0-9]+)\.([a-f0-9-]{36})$/.exec(token);
    const now = Date.now();
    for (const [key, expiry] of testTokens) if (expiry <= now) testTokens.delete(key);
    need(match && Number(match[1]) <= now && now - Number(match[1]) < 300000 && !testTokens.has(token), 'HUMAN_VERIFICATION_FAILED');
    need(testTokens.size < 1000, 'RELAY_UNAVAILABLE');
    testTokens.set(token, Number(match[1]) + 300000); return;
  }
  need(env.TURNSTILE_MODE !== 'local-test' && typeof env.TURNSTILE_SECRET === 'string' && env.TURNSTILE_SECRET.length > 0,
    'RELAY_UNAVAILABLE');
  const hosts = (env.TURNSTILE_HOSTNAMES || '').split(',').filter(Boolean);
  need(hosts.length > 0, 'RELAY_UNAVAILABLE');
  // Les clés factices officielles ne doivent pas ouvrir une publication en production.
  need(!/^[123]x0{20}/.test(env.TURNSTILE_SECRET), 'RELAY_UNAVAILABLE');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl.call(globalThis, SITEVERIFY, { method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token }) });
    need(response.ok, 'RELAY_UNAVAILABLE');
    const value = await readBoundedJson(response, 16384);
    need(typeof value.success === 'boolean', 'RELAY_UNAVAILABLE');
    need(value.success, 'HUMAN_VERIFICATION_FAILED');
    const time = Date.parse(value.challenge_ts);
    need(hosts.includes(value.hostname) && value.action === 'voti-publication' && Number.isFinite(time) &&
      time <= Date.now() + 30000 && Date.now() - time <= 300000, 'HUMAN_VERIFICATION_FAILED');
  } catch (error) {
    if (error instanceof RelayError && ['HUMAN_VERIFICATION_FAILED', 'RELAY_UNAVAILABLE'].includes(error.code)) throw error;
    throw new RelayError('RELAY_UNAVAILABLE');
  } finally { clearTimeout(timer); }
}
export async function limitRoute(env, name, id, assetId, capability, newPublication = false) {
  let binding = env.LIMITER, key = `${id}:${name}`, code = 'RATE_LIMITED';
  if (newPublication) {
    binding = env.CREATION_LIMITER; key = `${env.RELAY_ID}:creation`; code = 'CREATION_RATE_LIMITED';
  } else if (name === 'getAsset') {
    binding = env.ASSET_LIMITER; key = `${id}:${assetId}`;
  } else if (!['getPoll', 'getResults', 'castVote'].includes(name)) {
    key = await capabilityDigest(env.RELAY_ID, id, capability);
  }
  need(binding?.limit, 'RELAY_UNAVAILABLE');
  need((await binding.limit({ key })).success, code);
}
