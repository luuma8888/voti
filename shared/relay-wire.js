import { RelayError, relayEnsure as need, remoteRef } from './relay.js';
import { object, validateDefinition, validateStyle, validateRules, validateAccess, isUuid } from './validation.js';
import { normalizedText, MAX_COMMENT_LENGTH, MAX_DISPLAY_NAME_LENGTH } from './participation.js';
import { ASSET_KEYS, metadata, validateAsset } from './assets.js';
import { encodeBase64 } from './backup.js';

export const HTTP_ROUTES = {
  preparePublication: ['POST', 'publications'],
  getMissingAssets: ['POST', 'publications/:id/missing-assets'],
  putAssets: ['PUT', 'publications/:id/assets'],
  publishPoll: ['POST', 'publications/:id/commit'],
  discardPublication: ['DELETE', 'publications/:id'],
  getPoll: ['GET', 'polls/:id'], updateDefinition: ['PATCH', 'polls/:id/definition'],
  updateStyle: ['PATCH', 'polls/:id/style'], closePoll: ['POST', 'polls/:id/close'],
  castVote: ['POST', 'polls/:id/votes'], getResults: ['GET', 'polls/:id/results'],
  getAsset: ['GET', 'polls/:id/assets/:asset'],
  deletePoll: ['DELETE', 'polls/:id'], verifyAdmin: ['GET', 'polls/:id/admin'],
  getComments: ['GET', 'polls/:id/comments/:cursor'],
  getParticipations: ['GET', 'polls/:id/admin/participations/:cursor'],
  updateCommentStatus: ['PATCH', 'polls/:id/comments'], deleteComment: ['DELETE', 'polls/:id/comments'],
};
export async function encodeAsset(asset) {
  await validateAsset(asset);
  return { ...metadata(asset), base64: encodeBase64(new Uint8Array(await asset.blob.arrayBuffer())) };
}
export async function decodeAsset(value) {
  try {
    object(value, [...ASSET_KEYS, 'base64'], 'Asset');
    need(Number.isSafeInteger(value.byteLength) && value.byteLength > 0 && value.byteLength <= 1_000_000, 'ASSET_INVALID');
    need(typeof value.base64 === 'string' && value.base64.length === Math.ceil(value.byteLength / 3) * 4, 'ASSET_INVALID');
    const bytes = Uint8Array.from(atob(value.base64), char => char.charCodeAt(0));
    need(encodeBase64(bytes) === value.base64, 'ASSET_INVALID');
    return await validateAsset({ ...metadata(value), blob: new Blob([bytes], { type: value.mimeType }) });
  } catch { throw new RelayError('ASSET_INVALID', 'Image distante invalide.'); }
}
export async function readBoundedJson(response, max = 65_536) {
  need(Number(response.headers.get('content-length') || 0) <= max, 'PAYLOAD_TOO_LARGE');
  const reader = response.body?.getReader(); need(reader, 'INVALID_REQUEST');
  const parts = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      size += value.length; need(size <= max, 'PAYLOAD_TOO_LARGE'); parts.push(value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) { await reader.cancel().catch(() => {}); if (error instanceof RelayError) throw error; throw new RelayError('INVALID_REQUEST'); }
}
export function validateProjection(value) {
  need(value && typeof value.available === 'boolean', 'RELAY_UNAVAILABLE');
  if (!value.available) {
    object(value, ['available', 'minimumResponses', 'releaseMode', ...('totalBallots' in value ? ['totalBallots'] : [])], 'Résultats');
    need(Number.isSafeInteger(value.minimumResponses) && value.minimumResponses > 0 && ['threshold', 'closed','all_eligible','all_eligible_or_closed'].includes(value.releaseMode), 'RELAY_UNAVAILABLE');
  } else {
    object(value, ['available', 'totalBallots', 'choices', ...('eligibleTotal' in value?['eligibleTotal']:[]), ...('comments' in value ? ['comments'] : [])], 'Résultats');
    if('eligibleTotal' in value)need(Number.isSafeInteger(value.eligibleTotal)&&value.eligibleTotal>=value.totalBallots,'RELAY_UNAVAILABLE');
    if ('comments' in value) validateCommentPage(value.comments);
    need(Array.isArray(value.choices) && value.choices.length >= 2 && value.choices.length <= 6, 'RELAY_UNAVAILABLE');
    for (const choice of value.choices) {
      object(choice, ['id', 'label', 'count', 'percentage'], 'Résultat');
      need(typeof choice.id === 'string' && typeof choice.label === 'string' && Number.isSafeInteger(choice.count) && choice.count >= 0 && Number.isFinite(choice.percentage) && choice.percentage >= 0 && choice.percentage <= 100, 'RELAY_UNAVAILABLE');
    }
  }
  if ('totalBallots' in value) need(Number.isSafeInteger(value.totalBallots) && value.totalBallots >= 0, 'RELAY_UNAVAILABLE');
}
export function validateRelayResponse(method, value, relayId, pollId) {
  if (method === 'deletePoll') { object(value, ['deleted'], 'Réponse'); need(value.deleted === true, 'RELAY_UNAVAILABLE'); return value; }
  if (method === 'discardPublication') { object(value, ['discarded'], 'Réponse'); need(value.discarded === true, 'RELAY_UNAVAILABLE'); return value; }
  const ref = value?.remoteRef;
  object(ref, ['relayId', 'pollId', 'revision'], 'Référence'); remoteRef(ref.relayId, ref.pollId, ref.revision);
  need(ref.relayId === relayId && ref.pollId === pollId, 'RELAY_UNAVAILABLE');
  if (method === 'getComments') { const { remoteRef: _ref, ...page } = value; validateCommentPage(page); }
  else if (method === 'getParticipations') {
    object(value, ['remoteRef', 'participationIdentityMode', 'entries', 'nextCursor'], 'Administration');
    need(['anonymous', 'identified'].includes(value.participationIdentityMode) && Array.isArray(value.entries) && value.entries.length <= 25, 'RELAY_UNAVAILABLE');
    need(value.nextCursor === null || isUuid(value.nextCursor), 'RELAY_UNAVAILABLE');
    for (const entry of value.entries) {
      const identified = value.participationIdentityMode === 'identified';
      object(entry, ['choiceId', ...(identified ? ['participationId', 'displayName'] : []), ...('comment' in entry ? ['comment'] : [])], 'Participation administrateur');
      need(isUuid(entry.choiceId) && (identified || entry.comment), 'RELAY_UNAVAILABLE');
      if (identified) need(isUuid(entry.participationId) && normalizedText(entry.displayName, MAX_DISPLAY_NAME_LENGTH, 'Nom', true) === entry.displayName, 'RELAY_UNAVAILABLE');
      if (entry.comment) {
        object(entry.comment, ['commentId', 'text', 'moderationStatus', 'revision'], 'Commentaire administrateur');
        need(isUuid(entry.comment.commentId) && ['pending','visible','hidden'].includes(entry.comment.moderationStatus) && Number.isSafeInteger(entry.comment.revision) && entry.comment.revision >= 1, 'RELAY_UNAVAILABLE');
        need(normalizedText(entry.comment.text, MAX_COMMENT_LENGTH, 'Commentaire', true) === entry.comment.text, 'RELAY_UNAVAILABLE');
      }
    }
  } else if (['updateCommentStatus', 'deleteComment'].includes(method)) {
    object(value, ['remoteRef', 'commentId', ...(method === 'deleteComment' ? ['deleted'] : ['moderationStatus', 'revision'])], 'Modération');
    need(isUuid(value.commentId), 'RELAY_UNAVAILABLE');
    if (method === 'deleteComment') need(value.deleted === true, 'RELAY_UNAVAILABLE');
    else need(['visible','hidden'].includes(value.moderationStatus) && Number.isSafeInteger(value.revision) && value.revision >= 2, 'RELAY_UNAVAILABLE');
  } else if (method === 'preparePublication') object(value, ['remoteRef'], 'Préparation');
  else if (['getMissingAssets', 'putAssets'].includes(method)) {
    const key = method === 'putAssets' ? 'assetIds' : 'missingAssetIds'; object(value, ['remoteRef', key], 'Assets');
    need(Array.isArray(value[key]) && value[key].every(id => /^sha256-[a-f0-9]{64}$/.test(id)), 'RELAY_UNAVAILABLE');
  } else if (method === 'getResults') { const { remoteRef: _ref, ...projection } = value; validateProjection(projection); }
  else if (method === 'castVote') {
    object(value, ['accepted', 'alreadyAccepted', 'remoteRef', 'status', 'locked', 'results'], 'Reçu');
    need(value.accepted === true && typeof value.alreadyAccepted === 'boolean', 'RELAY_UNAVAILABLE'); validateProjection(value.results);
  } else {
    object(value, ['remoteRef', 'status', 'locked', 'definitionHash', 'definition', 'style', 'accessRules', 'resultRules', 'results'], 'Sondage');
    validateDefinition(value.definition); validateStyle(value.style); validateRules(value.resultRules,value.accessRules?.audience==='context');
    validateAccess(value.accessRules);
    need(value.locked ? /^[a-f0-9]{64}$/.test(value.definitionHash) : value.definitionHash === null, 'RELAY_UNAVAILABLE');
    validateProjection(value.results);
    need(value.results.available || value.resultRules.showResponseCountBeforeRelease || !('totalBallots' in value.results), 'RELAY_UNAVAILABLE');
  }
  if ('status' in value) need(['published', 'closed'].includes(value.status) && typeof value.locked === 'boolean', 'RELAY_UNAVAILABLE');
  return value;
}

export function validateCommentPage(page) {
  object(page, ['count', 'items', 'nextCursor'], 'Commentaires publics');
  need(Number.isSafeInteger(page.count) && page.count >= 0 && Array.isArray(page.items) && page.items.length <= 25 && page.items.length <= page.count, 'RELAY_UNAVAILABLE');
  need(page.nextCursor === null || isUuid(page.nextCursor), 'RELAY_UNAVAILABLE');
  for (const item of page.items) {
    object(item, ['commentId', 'choiceId', 'text'], 'Commentaire public');
    need(isUuid(item.commentId) && isUuid(item.choiceId) && normalizedText(item.text, MAX_COMMENT_LENGTH, 'Commentaire', true) === item.text, 'RELAY_UNAVAILABLE');
  }
}
