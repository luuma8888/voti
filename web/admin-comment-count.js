import { isAdminCapability } from '../shared/relay.js';

export function canReadRemoteComments(connection, relayId) {
  return Boolean(relayId && connection?.relayId === relayId && connection.remoteRevision > 0 && isAdminCapability(connection.adminCapability));
}

/** Compteur privé de bibliothèque : aucune projection publique ni persistance. */
export function localCommentCount(state, pollId) {
  return state.comments.filter(comment => comment.pollId === pollId).length;
}

/** Les pages identifiées contiennent aussi des participations sans commentaire. */
export async function remoteCommentCount(loadPage, active = () => true) {
  const ids = new Set(), cursors = new Set();
  let cursor = null;
  do {
    if (!active()) return null;
    const page = await loadPage(cursor);
    if (!active()) return null;
    for (const entry of page.entries) if (entry.comment) ids.add(entry.comment.commentId);
    cursor = page.nextCursor;
    if (cursor !== null) {
      if (cursors.has(cursor)) throw new Error('Pagination administrative incohérente.');
      cursors.add(cursor);
    }
  } while (cursor !== null);
  return ids.size;
}
