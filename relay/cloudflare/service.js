import { RelayError, relayEnsure as need, remoteRef, isPublicPollId, isAdminCapability } from '../../shared/relay.js';
import { emptyState, canonical, semanticHash } from '../../shared/model.js';
import { validateState, validateDefinition, validateRules, validateStyle, object, isAssetId } from '../../shared/validation.js';
import { assetReferences, contentId, metadata, validateReferences } from '../../shared/assets.js';
import { decodeAsset, encodeAsset } from '../../shared/relay-wire.js';
import { validateServerImage } from './image-validation.js';
import { participationRules, normalizeSubmission, submissionDigest } from '../../shared/participation.js';
import { groupResultsAvailable } from '../../shared/spaces.js';
import { SpacesService } from './spaces-service.js';

const NOW = () => Math.floor(Date.now() / 1000);
const fields = {
  preparePublication: ['poll', 'localBallots', 'expectedRevision'], getMissingAssets: ['assetIds', 'expectedRevision'],
  putAssets: ['assets', 'expectedRevision'], publishPoll: ['expectedRevision'], discardPublication: ['expectedRevision'],
  closePoll: ['expectedRevision'], updateDefinition: ['definition', 'resultRules', 'expectedRevision'],
  deletePoll: ['expectedRevision'], verifyAdmin: [],
  updateStyle: ['style', 'expectedRevision'], castVote: ['actionId', 'choiceId'], getPoll: [], getResults: [], getAsset: [],
  getComments: [], getParticipations: [], updateCommentStatus: ['commentId', 'expectedCommentRevision', 'moderationStatus', 'expectedRevision'],
  deleteComment: ['commentId', 'expectedCommentRevision', 'expectedRevision'],
};
export async function capabilityDigest(relayId, pollId, capability) {
  need(isAdminCapability(capability), 'INVALID_CAPABILITY');
  return contentId(new TextEncoder().encode(`voti-capability-v1\n${relayId}\n${pollId}\n${capability}`));
}
export class CloudflareRelay {
  constructor(env) { this.env = env; this.db = env.DB; this.spaces = new SpacesService(this); }
  sql(query, ...args) { return this.db.prepare(query).bind(...args); }
  ref(row) { return remoteRef(this.env.RELAY_ID, row.poll_id, row.revision); }
  async row(id) { return this.sql('SELECT * FROM polls WHERE poll_id=?', id).first(); }
  async publicRow(id) { const row = await this.row(id); need(row && row.status !== 'draft', 'NOT_FOUND'); return row; }
  async admin(id, capability, expected, mutation = true) {
    const row = await this.row(id); need(row, 'NOT_FOUND');
    if(JSON.parse(row.access_rules).audience==='context')return this.spaces.adminPoll(row,capability,expected,mutation);
    const digest = await capabilityDigest(this.env.RELAY_ID, id, capability);
    // Workers Web Crypto fournit la comparaison constante des octets.
    need(crypto.subtle.timingSafeEqual(new TextEncoder().encode(digest), new TextEncoder().encode(row.capability_hash)), 'INVALID_CAPABILITY');
    if (mutation) need(Number.isSafeInteger(expected) && expected === row.revision, 'REVISION_CONFLICT');
    if (row.status === 'draft') {
      const prep = await this.sql('SELECT expires_at FROM publications WHERE poll_id=?', id).first();
      need(prep && prep.expires_at > NOW(), 'NOT_FOUND');
    }
    return row;
  }
  /** Guard et mutations dans le même batch D1 transactionnel. Aucun await entre SQL. */
  async mutate(row, statements) {
    const guard = crypto.randomUUID(), staffGuard = crypto.randomUUID();
    try {
      return await this.db.batch([
        this.sql(`INSERT INTO mutation_guards VALUES(?, CASE WHEN EXISTS(
          SELECT 1 FROM polls WHERE poll_id=? AND revision=? AND capability_hash=?
          AND (status!='draft' OR EXISTS(SELECT 1 FROM publications WHERE poll_id=? AND expires_at>unixepoch()))
        ) THEN 1 ELSE 0 END)`, guard, row.poll_id, row.revision, row.capability_hash, row.poll_id),
        ...(row.staffAccessId ? [this.sql(`INSERT INTO mutation_guards VALUES(?,CASE WHEN EXISTS(
          SELECT 1 FROM space_access a JOIN spaces s USING(space_id) JOIN poll_audiences p USING(space_id)
          WHERE p.poll_id=? AND a.access_id=? AND a.credential_digest=? AND a.status='active' AND (s.status='active' OR a.role='admin')
          AND (a.role='admin' OR (a.role='creator' AND a.group_scopes IS NULL) OR (a.role='creator' AND p.mode='groups' AND NOT EXISTS(
            SELECT 1 FROM poll_audience_groups g WHERE g.poll_id=p.poll_id AND g.group_id NOT IN (SELECT value FROM json_each(a.group_scopes)))))
          ) THEN 1 ELSE 0 END)`,staffGuard,row.poll_id,row.staffAccessId,row.staffDigest)] : []),
        ...statements, this.sql('DELETE FROM mutation_guards WHERE id IN (?,?)', guard,staffGuard),
      ]);
    } catch {
      const current = await this.row(row.poll_id);
      need(current, 'NOT_FOUND'); need(current.revision === row.revision, 'REVISION_CONFLICT');
      if (current.status === 'draft') {
        const prep = await this.sql('SELECT expires_at FROM publications WHERE poll_id=?', row.poll_id).first();
        need(prep?.expires_at > NOW(), 'NOT_FOUND');
      }
      throw new RelayError('RELAY_UNAVAILABLE');
    }
  }
  bump(id, extra = '', args = []) {
    return this.sql(`UPDATE polls SET revision=revision+1+abs(random()%1000000)${extra} WHERE poll_id=?`, ...args, id);
  }
  async projection(id, authorized = false) {
    // Un seul SELECT : statut/règles/révision et agrégats correspondent au même instant.
    const row = await this.sql(`SELECT p.*, (SELECT COUNT(*) FROM ballots WHERE poll_id=p.poll_id) total,
      (SELECT count(*) FROM poll_member_eligibility WHERE poll_id=p.poll_id) eligible,
      (SELECT coalesce(sum(consumed),0) FROM poll_member_eligibility WHERE poll_id=p.poll_id) consumed,
      (SELECT json_group_object(choice_id,n) FROM (SELECT choice_id,COUNT(*) n FROM ballots WHERE poll_id=p.poll_id GROUP BY choice_id)) counts
      FROM polls p WHERE poll_id=? AND status!='draft'`, id).first();
    need(row, 'NOT_FOUND');
    const grouped=JSON.parse(row.access_rules).audience==='context';need(!grouped||authorized,'MEMBER_CARD_REQUIRED');
    need(!grouped||row.total===row.consumed,'RELAY_UNAVAILABLE');
    const definition = JSON.parse(row.definition), rules = JSON.parse(row.result_rules);
    const available = grouped?groupResultsAvailable(row.status,rules,row.consumed,row.eligible):row.total >= rules.minimumResponses && (rules.releaseMode === 'threshold' || row.status === 'closed');
    let results = { available: false, minimumResponses: rules.minimumResponses, releaseMode: rules.releaseMode,
      ...(rules.showResponseCountBeforeRelease ? { totalBallots: row.total } : {}) };
    if (available) {
      const counts = JSON.parse(row.counts || '{}');
      results = { available: true, totalBallots: row.total, ...(grouped?{eligibleTotal:row.eligible}:{}), choices: definition.choices.map(c => ({ id: c.id, label: c.label,
        count: counts[c.id] || 0, percentage: (counts[c.id] || 0) / row.total * 100 })) };
      if (participationRules(definition).commentVisibility === 'public_with_results') {
        const comments = await this.comments(id, null);
        if (comments.count) results.comments = comments;
      }
    }
    return { remoteRef: this.ref(row), status: row.status, locked: Boolean(row.locked), definitionHash: row.locked ? row.semantic_hash : null,
      definition, style: JSON.parse(row.style), accessRules: JSON.parse(row.access_rules), resultRules: rules, results };
  }
  async comments(id, cursor) {
    const { results } = await this.sql(`SELECT comment_id,choice_id,text,
      (SELECT COUNT(*) FROM comments WHERE poll_id=? AND moderation_status='visible') total
      FROM comments WHERE poll_id=? AND moderation_status='visible' AND comment_id>? ORDER BY comment_id LIMIT 26`, id, id, cursor ?? '').all();
    return { count: results[0]?.total ?? (await this.sql("SELECT COUNT(*) total FROM comments WHERE poll_id=? AND moderation_status='visible'", id).first()).total,
      items: results.slice(0,25).map(c => ({ commentId: c.comment_id, choiceId: c.choice_id, text: c.text })), nextCursor: results.length > 25 ? results[24].comment_id : null };
  }
  async participations(row, cursor) {
    const identified = participationRules(JSON.parse(row.definition)).participationIdentityMode === 'identified';
    const { results } = await this.sql(identified ? `SELECT b.choice_id,x.participation_id,x.display_name,c.comment_id,c.text,c.moderation_status,c.revision
      FROM participations x JOIN ballots b ON b.poll_id=x.poll_id AND b.participation_id=x.participation_id
      LEFT JOIN comments c ON c.poll_id=b.poll_id AND c.action_id=b.action_id
      WHERE x.poll_id=? AND x.participation_id>? ORDER BY x.participation_id LIMIT 26` :
      `SELECT choice_id,comment_id,text,moderation_status,revision FROM comments WHERE poll_id=? AND comment_id>? ORDER BY comment_id LIMIT 26`, row.poll_id, cursor ?? '').all();
    return { remoteRef: this.ref(row), participationIdentityMode: identified ? 'identified' : 'anonymous',
      entries: results.slice(0,25).map(c => ({ choiceId: c.choice_id, ...(identified ? { participationId: c.participation_id, displayName: c.display_name } : {}),
        ...(c.comment_id ? { comment: { commentId: c.comment_id, text: c.text, moderationStatus: c.moderation_status, revision: c.revision } } : {}) })),
      nextCursor: results.length > 25 ? (identified ? results[24].participation_id : results[24].comment_id) : null };
  }
  async vote(id, body) {
    need(isPublicPollId(body.actionId), 'INVALID_REQUEST');
    need(typeof body.choiceId === 'string', 'INVALID_CHOICE');
    const row = await this.publicRow(id), definition = JSON.parse(row.definition);
    need(JSON.parse(row.access_rules).audience==='public','MEMBER_CARD_REQUIRED');
    need(body.actionId !== id && !definition.choices.some(c => c.id === body.actionId), 'INVALID_REQUEST');
    let submission;
    try { submission = normalizeSubmission(definition, body); }
    catch(error) { throw new RelayError(error.code==='INVALID_PARTICIPATION' ? 'INVALID_PARTICIPATION' : 'INVALID_COMMENT'); }
    const digest = await submissionDigest(id, body.actionId, body.choiceId, submission);
    const guard = crypto.randomUUID(), fresh = crypto.randomUUID(), participationId = Object.hasOwn(submission, 'displayName') ? crypto.randomUUID() : null;
    const matches = b => b && b.choice_id === body.choiceId && (b.submission_digest ? b.submission_digest === digest : !submission.comment && !submission.displayName);
    const existing = await this.sql('SELECT choice_id,submission_digest FROM ballots WHERE poll_id=? AND action_id=?', id, body.actionId).first();
    if (existing) { need(matches(existing), 'IDEMPOTENCY_CONFLICT'); const v = await this.projection(id); return { accepted: true, alreadyAccepted: true, remoteRef: v.remoteRef, status: v.status, locked: v.locked, results: v.results }; }
    need(row.status === 'published', 'POLL_CLOSED');
    need(definition.choices.some(c => c.id === body.choiceId), 'INVALID_CHOICE');
    const statements = [
      this.sql(`INSERT INTO mutation_guards VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM polls WHERE poll_id=? AND semantic_hash=? AND (
        EXISTS(SELECT 1 FROM ballots WHERE poll_id=? AND action_id=? AND choice_id=? AND submission_digest=?) OR (
          status='published' AND EXISTS(SELECT 1 FROM json_each(definition,'$.choices') WHERE json_extract(value,'$.id')=?)
          AND NOT EXISTS(SELECT 1 FROM ballots WHERE poll_id=? AND action_id=?)))) THEN 1 ELSE 0 END)`,
        guard,id,row.semantic_hash,id,body.actionId,body.choiceId,digest,body.choiceId,id,body.actionId),
      this.sql('INSERT INTO mutation_guards SELECT ?,1 WHERE NOT EXISTS(SELECT 1 FROM ballots WHERE poll_id=? AND action_id=?)', fresh,id,body.actionId),
    ];
    if (participationId) statements.push(this.sql('INSERT INTO participations(participation_id,poll_id,display_name) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM mutation_guards WHERE id=?)', participationId,id,submission.displayName,fresh));
    const insertIndex = statements.length;
    statements.push(this.sql('INSERT INTO ballots(poll_id,action_id,choice_id,participation_id,submission_digest) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mutation_guards WHERE id=?)', id,body.actionId,body.choiceId,participationId,digest,fresh));
    if (submission.comment) statements.push(this.sql("INSERT INTO comments(comment_id,poll_id,action_id,choice_id,text,moderation_status,revision,participation_id) SELECT ?,?,?,?,?,'pending',1,? WHERE EXISTS(SELECT 1 FROM mutation_guards WHERE id=?)", crypto.randomUUID(),id,body.actionId,body.choiceId,submission.comment,participationId,fresh));
    statements.push(this.sql('DELETE FROM mutation_guards WHERE id IN (?,?)',guard,fresh));
    let out;
    try { out = await this.db.batch(statements); }
    catch {
      const current = await this.publicRow(id), previous = await this.sql('SELECT choice_id,submission_digest FROM ballots WHERE poll_id=? AND action_id=?',id,body.actionId).first();
      if (previous) need(matches(previous), 'IDEMPOTENCY_CONFLICT');
      need(current.semantic_hash === row.semantic_hash, 'REVISION_CONFLICT'); need(current.status === 'published' || matches(previous), 'POLL_CLOSED');
      throw new RelayError('RELAY_UNAVAILABLE');
    }
    const view = await this.projection(id);
    return { accepted: true, alreadyAccepted: out[insertIndex].meta.changes === 0, remoteRef: view.remoteRef, status: view.status, locked: view.locked, results: view.results };
  }
  async asset(id, assetId, publicOnly = false) {
    const row = await this.sql(`SELECT a.* FROM asset_links a JOIN polls p USING(poll_id) WHERE a.poll_id=? AND a.asset_id=?
      ${publicOnly ? "AND p.status!='draft' AND json_extract(p.access_rules,'$.audience')='public' AND EXISTS(SELECT 1 FROM asset_refs r WHERE r.poll_id=a.poll_id AND r.asset_id=a.asset_id)" : ''}`, id, assetId).first();
    need(row, publicOnly ? 'NOT_FOUND' : 'ASSET_MISSING');
    const obj = await this.env.ASSETS.get(row.object_key); need(obj, 'ASSET_MISSING');
    const meta = JSON.parse(row.metadata);
    return { ...meta, blob: new Blob([await obj.arrayBuffer()], { type: meta.mimeType }) };
  }
  async references(id, definition) {
    this.checkAssetPolicy(definition);
    try { await validateReferences({ polls: [{ definition }] }, assetId => this.asset(id, assetId)); }
    catch (error) { if (error instanceof RelayError) throw error; throw new RelayError('ASSET_INVALID'); }
  }
  /** Le pilote gratuit refuse les images, sans modifier ni dépouiller la définition. */
  checkAssetPolicy(definition) {
    if (this.env.REMOTE_ASSETS_ENABLED === 'false') {
      need(assetReferences({ polls: [{ definition }] }).size === 0, 'REMOTE_ASSETS_DISABLED');
    }
  }
  async execute(method, id, body, capability, assetId, cursor) {
    try { object(body, [...fields[method], ...(method === 'castVote' ? ['comment','displayName'].filter(k => Object.hasOwn(body,k)) : [])], 'Requête'); } catch { throw new RelayError('INVALID_REQUEST'); }
    if (['getComments','getParticipations'].includes(method)) { need(cursor === 'start' || isPublicPollId(cursor), 'INVALID_REQUEST'); cursor = cursor === 'start' ? null : cursor; }
    if (method === 'preparePublication') {
      const { poll, localBallots, expectedRevision } = body; id = poll?.id;
      need(isPublicPollId(id) && Array.isArray(localBallots), 'INVALID_DEFINITION');
      need(!localBallots.length && !poll.lockedAt && !poll.definitionHash && poll.stats?.totalBallots === 0, 'LOCAL_VOTES_PRESENT');
      need(poll.status !== 'closed', 'POLL_CLOSED'); need(expectedRevision === 0, 'REVISION_CONFLICT');
      try { await validateState({ ...emptyState(), polls: [poll] }); } catch { throw new RelayError('INVALID_DEFINITION'); }
      this.checkAssetPolicy(poll.definition);
      const hash = await capabilityDigest(this.env.RELAY_ID, id, capability), signature = canonical(poll);
      const semantic = await semanticHash(poll);
      await this.db.batch([
        this.sql(`INSERT OR IGNORE INTO polls(poll_id,status,definition,style,access_rules,result_rules,semantic_hash,capability_hash,created_at)
          VALUES(?,'draft',?,?,?,?,?,?,?)`, id, canonical(poll.definition), canonical(poll.style), canonical(poll.accessRules), canonical(poll.resultRules), semantic, hash, NOW()),
        this.sql(`INSERT OR IGNORE INTO publications SELECT poll_id,?,? FROM polls WHERE poll_id=? AND status='draft' AND capability_hash=?`,
          NOW() + Number(this.env.PREPARATION_TTL_SECONDS || 86400), signature, id, hash),
      ]);
      const row = await this.admin(id, capability, 0);
      const prep = await this.sql('SELECT signature FROM publications WHERE poll_id=?', id).first();
      need(prep?.signature === signature, 'PUBLICATION_CONFLICT'); return { remoteRef: this.ref(row) };
    }
    need(isPublicPollId(id), 'INVALID_REQUEST');
    if (method === 'getPoll') return this.projection(id);
    if (method === 'getComments') {
      const view = await this.projection(id); need(view.results.available, 'RESULTS_LOCKED', 'Résultats non disponibles.', { remoteRef: view.remoteRef, ...view.results });
      need(participationRules(view.definition).commentVisibility === 'public_with_results', 'NOT_FOUND');
      return { remoteRef: view.remoteRef, ...await this.comments(id,cursor) };
    }
    if (method === 'getResults') {
      const view = await this.projection(id), result = { remoteRef: view.remoteRef, ...view.results };
      need(result.available, 'RESULTS_LOCKED', 'Résultats non disponibles.', result); return result;
    }
    if (method === 'getAsset') {
      need(isAssetId(assetId), 'INVALID_REQUEST');
      need(this.env.REMOTE_ASSETS_ENABLED !== 'false', 'NOT_FOUND');
      return encodeAsset(await this.asset(id, assetId, true));
    }
    if (method === 'castVote') return this.vote(id,body);
    const row = await this.admin(id, capability, body.expectedRevision, !['getMissingAssets', 'verifyAdmin', 'getParticipations'].includes(method));
    if (method === 'getParticipations') { need(row.status !== 'draft', 'NOT_FOUND'); return this.participations(row,cursor); }
    if (['updateCommentStatus','deleteComment'].includes(method)) {
      need(isPublicPollId(body.commentId) && Number.isSafeInteger(body.expectedCommentRevision) && body.expectedCommentRevision >= 1, 'INVALID_REQUEST');
      const comment = await this.sql('SELECT * FROM comments WHERE poll_id=? AND comment_id=?',id,body.commentId).first(); need(comment,'NOT_FOUND');
      need(comment.revision === body.expectedCommentRevision,'REVISION_CONFLICT');
      const deleting = method === 'deleteComment', guard = crypto.randomUUID();
      if (!deleting) need(['visible','hidden'].includes(body.moderationStatus) && participationRules(JSON.parse(row.definition)).commentVisibility === 'public_with_results','INVALID_COMMENT');
      try { await this.mutate(row,[
        this.sql('INSERT INTO mutation_guards VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM comments WHERE poll_id=? AND comment_id=? AND revision=?) THEN 1 ELSE 0 END)',guard,id,body.commentId,body.expectedCommentRevision),
        deleting ? this.sql('DELETE FROM comments WHERE poll_id=? AND comment_id=?',id,body.commentId) : this.sql('UPDATE comments SET moderation_status=?,revision=revision+1 WHERE poll_id=? AND comment_id=?',body.moderationStatus,id,body.commentId),
        this.sql('DELETE FROM mutation_guards WHERE id=?',guard),
      ]); } catch (error) {
        if (error.code !== 'RELAY_UNAVAILABLE') throw error;
        const current = await this.sql('SELECT revision FROM comments WHERE poll_id=? AND comment_id=?',id,body.commentId).first();
        need(current,'NOT_FOUND'); need(current.revision === body.expectedCommentRevision,'REVISION_CONFLICT'); throw error;
      }
      return { remoteRef: this.ref(row), commentId: body.commentId, ...(deleting ? { deleted: true } : { moderationStatus: body.moderationStatus, revision: comment.revision + 1 }) };
    }
    if (method === 'verifyAdmin') { need(row.status !== 'draft', 'NOT_FOUND'); return this.projection(id,Boolean(row.staffAccessId)); }
    if (method === 'deletePoll') {
      need(row.status !== 'draft', 'NOT_FOUND');
      // Garde + bulletins + cascades/liens/garbage dans UN batch. Aucune dépendance R2.
      await this.mutate(row, [this.sql('DELETE FROM ballots WHERE poll_id=?', id), this.sql('DELETE FROM polls WHERE poll_id=?', id)]);
      return { deleted: true };
    }
    if (method === 'getMissingAssets') {
      need(Array.isArray(body.assetIds) && body.assetIds.length <= 14 && body.assetIds.every(isAssetId), 'INVALID_REQUEST');
      if (this.env.REMOTE_ASSETS_ENABLED === 'false') {
        need(body.assetIds.length === 0, 'REMOTE_ASSETS_DISABLED');
        return { remoteRef: this.ref(row), missingAssetIds: [] };
      }
      const { results } = await this.sql('SELECT asset_id FROM asset_links WHERE poll_id=?', id).all();
      return { remoteRef: this.ref(row), missingAssetIds: [...new Set(body.assetIds)].filter(id => !results.some(a => a.asset_id === id)) };
    }
    if (method === 'discardPublication') {
      need(row.status === 'draft', 'PUBLICATION_CONFLICT');
      await this.mutate(row, [this.sql('DELETE FROM polls WHERE poll_id=?', id)]); return { discarded: true };
    }
    if (method === 'putAssets') {
      need(row.status !== 'closed', 'POLL_CLOSED'); need(!row.locked, 'POLL_LOCKED');
      if (this.env.REMOTE_ASSETS_ENABLED === 'false') {
        need(Array.isArray(body.assets), 'ASSET_INVALID');
        need(body.assets.length === 0, 'REMOTE_ASSETS_DISABLED');
        // Le contrat client envoie aussi les lots vides : no-op, sans R2 ni révision.
        return { remoteRef: this.ref(row), assetIds: [] };
      }
      need(Array.isArray(body.assets) && body.assets.length <= 14, 'ASSET_INVALID');
      const assets = [];
      // Sérialisé pour borner la mémoire/CPU par image avant toute écriture R2.
      for (const value of body.assets) assets.push(await validateServerImage(await decodeAsset(value)));
      need(new Set(assets.map(a => a.id)).size === assets.length, 'ASSET_INVALID');
      const old = (await this.sql('SELECT asset_id FROM asset_links WHERE poll_id=?', id).all()).results.map(a => a.asset_id);
      const fresh = assets.filter(a => !old.includes(a.id)); need(old.length + fresh.length <= 14, 'PAYLOAD_TOO_LARGE');
      if (fresh.length) {
        const records = fresh.map(a => ({ asset: a, key: `polls/${id}/${a.id}/${crypto.randomUUID()}` }));
        // Réservation durable de GC avant écriture R2. Un crash laisse une entrée récupérable.
        await this.db.batch(records.map(r => this.sql('INSERT INTO r2_garbage VALUES(?,?)', r.key, NOW() + 3600)));
        try {
          for (const r of records) await this.env.ASSETS.put(r.key, r.asset.blob.stream(), { httpMetadata: { contentType: r.asset.mimeType } });
          await this.mutate(row, [this.bump(id), ...records.flatMap(r => [
            this.sql('INSERT INTO asset_links VALUES(?,?,?,?)', id, r.asset.id, r.key, JSON.stringify(metadata(r.asset))),
            this.sql('DELETE FROM r2_garbage WHERE object_key=?', r.key),
          ])]);
        } catch (error) {
          // Ne retirer que les objets encore en garbage : jamais ceux liés par un commit.
          for (const r of records) await this.sql('UPDATE r2_garbage SET delete_after=unixepoch() WHERE object_key=?', r.key).run();
          throw error;
        }
      }
      return { remoteRef: this.ref(await this.row(id)), assetIds: assets.map(a => a.id) };
    }
    const definition = JSON.parse(row.definition), accessRules = JSON.parse(row.access_rules);
    let statements;
    if (method === 'publishPoll') {
      if(accessRules.audience==='context')return (await this.spaces.publish(row)).poll;
      need(row.status === 'draft', 'PUBLICATION_CONFLICT'); await this.references(id, definition);
      statements = [this.bump(id, ",status='published',published_at=?", [NOW()]), this.sql('DELETE FROM publications WHERE poll_id=?', id)];
    } else {
      need(row.status !== 'draft', 'NOT_FOUND');
      if (method === 'updateDefinition') {
        need(!row.locked, 'POLL_LOCKED'); need(row.status !== 'closed', 'POLL_CLOSED');
        try { validateDefinition(body.definition); validateRules(body.resultRules,accessRules.audience==='context'); } catch { throw new RelayError('INVALID_DEFINITION'); }
        need(!body.definition.choices.some(c => c.id === id), 'INVALID_DEFINITION');
        await this.references(id, body.definition);
        const hash = await semanticHash({ definition: body.definition, resultRules: body.resultRules, accessRules });
        statements = [this.bump(id, ',definition=?,result_rules=?,semantic_hash=?', [canonical(body.definition), canonical(body.resultRules), hash])];
      } else if (method === 'updateStyle') {
        try { validateStyle(body.style); } catch { throw new RelayError('INVALID_DEFINITION'); }
        statements = [this.bump(id, ',style=?', [canonical(body.style)])];
      } else {
        need(row.status !== 'closed', 'POLL_CLOSED'); statements = [this.bump(id, ",status='closed',closed_at=?", [NOW()])];
      }
    }
    statements.push(this.sql('DELETE FROM asset_links WHERE poll_id=? AND asset_id NOT IN (SELECT asset_id FROM asset_refs WHERE poll_id=?)', id, id));
    await this.mutate(row, statements); return this.projection(id,Boolean(row.staffAccessId));
  }
}

/** GC borné, rejouable : D1 délie d'abord, R2 efface ensuite. Pas de suppression par préfixe. */
export async function cleanup(env) {
  const db = env.DB;
  await db.prepare('DELETE FROM invitations WHERE invitation_id IN (SELECT invitation_id FROM invitations WHERE closed=1 OR expires_at<=unixepoch() ORDER BY expires_at,invitation_id LIMIT 25)').run();
  const removed = await db.prepare("DELETE FROM polls WHERE status='draft' AND poll_id IN (SELECT poll_id FROM publications WHERE expires_at<=unixepoch() ORDER BY expires_at,poll_id LIMIT 25)").run();
  const { results } = await db.prepare('SELECT object_key FROM r2_garbage WHERE delete_after<=unixepoch() ORDER BY delete_after,object_key LIMIT 100').all();
  const summary = { preparations: removed?.meta?.changes || 0, assets: 0, failures: 0 };
  for (const row of results) {
    try {
      await env.ASSETS.delete(row.object_key);
      await db.prepare('DELETE FROM r2_garbage WHERE object_key=?').bind(row.object_key).run();
      summary.assets++;
    } catch { summary.failures++; /* Entrée durable conservée ; les autres objets peuvent progresser. */ }
  }
  return summary;
}
