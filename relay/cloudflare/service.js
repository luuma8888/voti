import { RelayError, relayEnsure as need, remoteRef, isPublicPollId, isAdminCapability } from '../../shared/relay.js';
import { emptyState, canonical, semanticHash } from '../../shared/model.js';
import { validateState, validateDefinition, validateRules, validateStyle, object, isAssetId } from '../../shared/validation.js';
import { assetReferences, contentId, metadata, validateReferences } from '../../shared/assets.js';
import { decodeAsset, encodeAsset } from '../../shared/relay-wire.js';
import { validateServerImage } from './image-validation.js';

const NOW = () => Math.floor(Date.now() / 1000);
const fields = {
  preparePublication: ['poll', 'localBallots', 'expectedRevision'], getMissingAssets: ['assetIds', 'expectedRevision'],
  putAssets: ['assets', 'expectedRevision'], publishPoll: ['expectedRevision'], discardPublication: ['expectedRevision'],
  closePoll: ['expectedRevision'], updateDefinition: ['definition', 'resultRules', 'expectedRevision'],
  deletePoll: ['expectedRevision'], verifyAdmin: [],
  updateStyle: ['style', 'expectedRevision'], castVote: ['actionId', 'choiceId'], getPoll: [], getResults: [], getAsset: [],
};
export async function capabilityDigest(relayId, pollId, capability) {
  need(isAdminCapability(capability), 'INVALID_CAPABILITY');
  return contentId(new TextEncoder().encode(`voti-capability-v1\n${relayId}\n${pollId}\n${capability}`));
}
export class CloudflareRelay {
  constructor(env) { this.env = env; this.db = env.DB; }
  sql(query, ...args) { return this.db.prepare(query).bind(...args); }
  ref(row) { return remoteRef(this.env.RELAY_ID, row.poll_id, row.revision); }
  async row(id) { return this.sql('SELECT * FROM polls WHERE poll_id=?', id).first(); }
  async publicRow(id) { const row = await this.row(id); need(row && row.status !== 'draft', 'NOT_FOUND'); return row; }
  async admin(id, capability, expected, mutation = true) {
    const row = await this.row(id); need(row, 'NOT_FOUND');
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
    const guard = crypto.randomUUID();
    try {
      return await this.db.batch([
        this.sql(`INSERT INTO mutation_guards VALUES(?, CASE WHEN EXISTS(
          SELECT 1 FROM polls WHERE poll_id=? AND revision=? AND capability_hash=?
          AND (status!='draft' OR EXISTS(SELECT 1 FROM publications WHERE poll_id=? AND expires_at>unixepoch()))
        ) THEN 1 ELSE 0 END)`, guard, row.poll_id, row.revision, row.capability_hash, row.poll_id),
        ...statements, this.sql('DELETE FROM mutation_guards WHERE id=?', guard),
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
  async projection(id) {
    // Un seul SELECT : statut/règles/révision et agrégats correspondent au même instant.
    const row = await this.sql(`SELECT p.*, (SELECT COUNT(*) FROM ballots WHERE poll_id=p.poll_id) total,
      (SELECT json_group_object(choice_id,n) FROM (SELECT choice_id,COUNT(*) n FROM ballots WHERE poll_id=p.poll_id GROUP BY choice_id)) counts
      FROM polls p WHERE poll_id=? AND status!='draft'`, id).first();
    need(row, 'NOT_FOUND');
    const definition = JSON.parse(row.definition), rules = JSON.parse(row.result_rules);
    const available = row.total >= rules.minimumResponses && (rules.releaseMode === 'threshold' || row.status === 'closed');
    let results = { available: false, minimumResponses: rules.minimumResponses, releaseMode: rules.releaseMode,
      ...(rules.showResponseCountBeforeRelease ? { totalBallots: row.total } : {}) };
    if (available) {
      const counts = JSON.parse(row.counts || '{}');
      results = { available: true, totalBallots: row.total, choices: definition.choices.map(c => ({ id: c.id, label: c.label,
        count: counts[c.id] || 0, percentage: (counts[c.id] || 0) / row.total * 100 })) };
    }
    return { remoteRef: this.ref(row), status: row.status, locked: Boolean(row.locked), definitionHash: row.locked ? row.semantic_hash : null,
      definition, style: JSON.parse(row.style), accessRules: JSON.parse(row.access_rules), resultRules: rules, results };
  }
  async asset(id, assetId, publicOnly = false) {
    const row = await this.sql(`SELECT a.* FROM asset_links a JOIN polls p USING(poll_id) WHERE a.poll_id=? AND a.asset_id=?
      ${publicOnly ? "AND p.status!='draft' AND EXISTS(SELECT 1 FROM asset_refs r WHERE r.poll_id=a.poll_id AND r.asset_id=a.asset_id)" : ''}`, id, assetId).first();
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
  async execute(method, id, body, capability, assetId) {
    try { object(body, fields[method], 'Requête'); } catch { throw new RelayError('INVALID_REQUEST'); }
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
    if (method === 'getResults') {
      const view = await this.projection(id), result = { remoteRef: view.remoteRef, ...view.results };
      need(result.available, 'RESULTS_LOCKED', 'Résultats non disponibles.', result); return result;
    }
    if (method === 'getAsset') {
      need(isAssetId(assetId), 'INVALID_REQUEST');
      need(this.env.REMOTE_ASSETS_ENABLED !== 'false', 'NOT_FOUND');
      return encodeAsset(await this.asset(id, assetId, true));
    }
    if (method === 'castVote') {
      need(isPublicPollId(body.actionId), 'INVALID_REQUEST');
      need(typeof body.choiceId === 'string', 'INVALID_CHOICE');
      need(body.actionId !== id && body.actionId !== body.choiceId, 'INVALID_REQUEST');
      // INSERT conditionnel + trigger constituent la transaction critique entière.
      // Le SELECT suivant sert uniquement à expliquer l'absence d'insertion/retry.
      const out = await this.db.batch([
        this.sql(`INSERT OR IGNORE INTO ballots(poll_id,action_id,choice_id)
          SELECT poll_id,?,? FROM polls WHERE poll_id=? AND status='published'
          AND EXISTS(SELECT 1 FROM json_each(definition,'$.choices') WHERE json_extract(value,'$.id')=?)
          AND NOT EXISTS(SELECT 1 FROM ballots WHERE poll_id=? AND action_id=?)`,
          body.actionId, body.choiceId, id, body.choiceId, id, body.actionId),
        this.sql('SELECT choice_id FROM ballots WHERE poll_id=? AND action_id=?', id, body.actionId),
      ]);
      const existing = out[1].results[0];
      if (!existing) { const row = await this.publicRow(id); need(row.status !== 'closed', 'POLL_CLOSED'); throw new RelayError('INVALID_CHOICE'); }
      need(existing.choice_id === body.choiceId, 'IDEMPOTENCY_CONFLICT');
      const view = await this.projection(id);
      return { accepted: true, alreadyAccepted: out[0].meta.changes === 0, remoteRef: view.remoteRef, status: view.status, locked: view.locked, results: view.results };
    }
    const row = await this.admin(id, capability, body.expectedRevision, !['getMissingAssets', 'verifyAdmin'].includes(method));
    if (method === 'verifyAdmin') { need(row.status !== 'draft', 'NOT_FOUND'); return this.projection(id); }
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
      need(row.status === 'draft', 'PUBLICATION_CONFLICT'); await this.references(id, definition);
      statements = [this.bump(id, ",status='published',published_at=?", [NOW()]), this.sql('DELETE FROM publications WHERE poll_id=?', id)];
    } else {
      need(row.status !== 'draft', 'NOT_FOUND');
      if (method === 'updateDefinition') {
        need(!row.locked, 'POLL_LOCKED'); need(row.status !== 'closed', 'POLL_CLOSED');
        try { validateDefinition(body.definition); validateRules(body.resultRules); } catch { throw new RelayError('INVALID_DEFINITION'); }
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
    await this.mutate(row, statements); return this.projection(id);
  }
}

/** GC borné, rejouable : D1 délie d'abord, R2 efface ensuite. Pas de suppression par préfixe. */
export async function cleanup(env) {
  const db = env.DB;
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
