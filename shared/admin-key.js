import { object } from './validation.js';
import { relayEnsure as need, isAdminCapability, remoteRef } from './relay.js';

/** Fichier explicitement SECRET, distinct du backup métier. Aucune capacité générée ici. */
export function validateAdminKey(input, relayId) {
  try { object(input, ['version', 'relayId', 'pollId', 'adminCapability'], 'Clé d’administration'); }
  catch { need(false, 'INVALID_REQUEST', 'Fichier de clé invalide.'); }
  need(input.version === 1, 'INVALID_REQUEST', 'Version de clé inconnue.');
  remoteRef(input.relayId, input.pollId, 0);
  need(input.relayId === relayId, 'INVALID_REQUEST', 'Cette clé appartient à un autre relais.');
  need(isAdminCapability(input.adminCapability), 'INVALID_CAPABILITY');
  return structuredClone(input);
}
export function parseAdminKey(raw, relayId) {
  need(typeof raw === 'string' && new TextEncoder().encode(raw).length <= 4096, 'INVALID_REQUEST', 'Fichier de clé trop volumineux.');
  let input; try { input = JSON.parse(raw); } catch { need(false, 'INVALID_REQUEST', 'Fichier JSON invalide.'); }
  return validateAdminKey(input, relayId);
}
export async function exportAdminKey(connections, relayId, pollId) {
  const connection = await connections.get({ relayId, pollId });
  need(connection?.adminCapability, 'INVALID_CAPABILITY');
  return JSON.stringify(validateAdminKey({ version: 1, relayId, pollId, adminCapability: connection.adminCapability }, relayId), null, 2);
}
/** Vérification authentifiée distante AVANT écriture. Le remplacement exige le secret
 * précédent explicitement confirmé et comparé sous le verrou du stockage (CAS).
 */
export async function importAdminKey(raw, adapter, connections, { replaceCapability } = {}) {
  const key = parseAdminKey(raw, adapter.relayId);
  const view = await adapter.verifyAdmin({ pollId: key.pollId, adminCapability: key.adminCapability });
  need(view.remoteRef.relayId === key.relayId && view.remoteRef.pollId === key.pollId, 'INVALID_REQUEST');
  const previous = await connections.get(key);
  if (previous?.adminCapability && previous.adminCapability !== key.adminCapability) {
    need(replaceCapability === previous.adminCapability, 'CAPABILITY_CONFLICT', 'Une autre clé est déjà conservée. Confirmez son remplacement.');
  }
  await connections.put({ formatVersion: 1, relayId: key.relayId, pollId: key.pollId,
    remoteRevision: view.remoteRef.revision, adminCapability: key.adminCapability,
    lastKnownRemoteState: { status: view.status, locked: view.locked, definitionHash: view.definitionHash, resultsAvailable: view.results.available } },
  replaceCapability === undefined ? {} : { replaceCapability });
  return view;
}
