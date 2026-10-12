import { isPublicPollId, relayEnsure, publicPollRoute } from './relay.js';
import { isUuid } from './validation.js';
import { validateAdminKey, parseAdminKey } from './admin-key.js';

export const PUBLIC_VOTI_URL = 'https://luuma8888.github.io/voti/';
function baseUrl(base) {
  const url = new URL(base);
  relayEnsure(!url.username && !url.password && !url.search && !url.hash &&
    (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))),
  'INVALID_REQUEST', 'Adresse publique invalide.');
  return url.href;
}
export function buildPollUrl(pollId, base = PUBLIC_VOTI_URL) {
  relayEnsure(isPublicPollId(pollId), 'INVALID_REQUEST', 'Identifiant public invalide.');
  return baseUrl(base) + publicPollRoute(pollId);
}
export function buildResultsUrl(pollId, base) { return buildPollUrl(pollId, base) + '/results'; }
export function buildChoiceUrl(pollId, choiceId, base) {
  relayEnsure(isUuid(choiceId), 'INVALID_REQUEST', 'Identifiant de choix invalide.');
  return buildPollUrl(pollId, base) + `/choice/${choiceId}`;
}
/** Base64url est un encodage, PAS un chiffrement. Même contrat que le fichier secret. */
export function encodeAdminPayload(input) {
  const key = validateAdminKey(input, input.relayId);
  const bytes = new TextEncoder().encode(JSON.stringify(key));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodeAdminPayload(payload, relayId) {
  relayEnsure(typeof payload === 'string' && payload.length <= 5500 && /^[A-Za-z0-9_-]+$/.test(payload),
    'INVALID_REQUEST', 'QR secret invalide.');
  try {
    const bytes = Uint8Array.from(atob(payload.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const key = parseAdminKey(raw, relayId);
    relayEnsure(encodeAdminPayload(key) === payload, 'INVALID_REQUEST', 'QR secret non canonique.');
    return key;
  } catch { relayEnsure(false, 'INVALID_REQUEST', 'QR secret invalide ou incompatible avec ce relais.'); }
}
export function buildAdminTransferUrl(key, base = PUBLIC_VOTI_URL) {
  return baseUrl(base) + '#/admin/import/' + encodeAdminPayload(key);
}
