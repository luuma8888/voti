import { RelayAdapter, RelayError, relayEnsure as need, isPublicPollId, isAdminCapability, remoteRef } from '../shared/relay.js';
import { emptyState, canonical, semanticHash } from '../shared/model.js';
import { object, isAssetId, validateState } from '../shared/validation.js';
import { publishPoll, updateSemantics, updateStyle, closePoll, castVote } from '../shared/poll-engine.js';
import { getResults } from '../shared/result-rules.js';
import { assetReferences, validateAsset, validateReferences, contentId } from '../shared/assets.js';

const ADMIN = ['pollId', 'adminCapability', 'expectedRevision'];
const keys = {
  preparePublication: ['poll', 'localBallots', 'adminCapability', 'expectedRevision'],
  getMissingAssets: [...ADMIN, 'assetIds'], putAssets: [...ADMIN, 'assets'],
  publishPoll: ADMIN, discardPublication: ADMIN, closePoll: ADMIN,
  deletePoll: ADMIN, verifyAdmin: ['pollId', 'adminCapability'],
  updateDefinition: [...ADMIN, 'definition', 'resultRules'], updateStyle: [...ADMIN, 'style'],
  getPoll: ['pollId'], getResults: ['pollId'], getAsset: ['pollId', 'assetId'],
  castVote: ['pollId', 'actionId', 'choiceId'],
};

/** Simulation uniquement. File sérialisée = point de linéarisation commun à tous les clients.
 * Aucun état métier, secret dérivé ou bulletin n'est accessible par propriété publique.
 */
export class InMemoryRelayAdapter extends RelayAdapter {
  #records = new Map();
  #tail = Promise.resolve();
  #now;
  constructor({ relayId = 'memory', now = () => new Date().toISOString() } = {}) {
    super(relayId); this.#now = now;
  }
  #run(method, input) {
    let request;
    try {
      request = structuredClone(input);
      object(request, [...keys[method], ...(method === 'preparePublication' && Object.hasOwn(request, 'humanVerificationToken') ? ['humanVerificationToken'] : [])], 'Requête relais');
      need(JSON.stringify(request).length <= 65_536, 'PAYLOAD_TOO_LARGE');
    } catch (error) { return Promise.reject(error instanceof RelayError ? error : new RelayError('INVALID_REQUEST')); }
    const result = this.#tail.then(() => this.#execute(method, request)).catch(error => {
      if (error instanceof RelayError) throw error;
      throw new RelayError('RELAY_UNAVAILABLE', 'La simulation du relais n’a pas pu terminer l’opération.');
    });
    this.#tail = result.catch(() => {});
    return result.then(value => structuredClone(value));
  }
  #ref(record) { return remoteRef(this.relayId, record.state.polls[0].id, record.revision); }
  #nextRevision(record) {
    // Monotone mais non consécutive : revision - 1 ne révèle pas le nombre de votes.
    const next = record.revision + 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000);
    need(Number.isSafeInteger(next), 'RELAY_UNAVAILABLE'); return next;
  }
  #view(record) {
    const poll = record.state.polls[0];
    return { remoteRef: this.#ref(record), status: poll.status, locked: poll.lockedAt !== null,
      definitionHash: poll.definitionHash, definition: poll.definition, style: poll.style,
      accessRules: poll.accessRules, resultRules: poll.resultRules, results: getResults(record.state, poll.id) };
  }
  async #digest(pollId, capability) {
    need(isAdminCapability(capability), 'INVALID_CAPABILITY');
    return contentId(new TextEncoder().encode(`voti-capability-v1\n${this.relayId}\n${pollId}\n${capability}`));
  }
  async #valid(state, code = 'INVALID_DEFINITION') {
    try { await validateState(state); } catch { throw new RelayError(code); }
  }
  async #references(state, assets) {
    for (const id of assetReferences(state).keys()) need(assets.has(id), 'ASSET_MISSING', 'Une image référencée manque.');
    try { await validateReferences(state, id => assets.get(id)); } catch { throw new RelayError('ASSET_INVALID'); }
  }
  #prune(record) {
    const keep = assetReferences(record.state);
    record.assets = new Map([...record.assets].filter(([id]) => keep.has(id)));
  }
  async #execute(method, request) {
    if (method === 'preparePublication') {
      const { poll, localBallots, adminCapability, expectedRevision } = request;
      need(poll && isPublicPollId(poll.id) && Array.isArray(localBallots), 'INVALID_DEFINITION');
      need(localBallots.length === 0 && !poll.lockedAt && !poll.definitionHash && poll.stats?.totalBallots === 0, 'LOCAL_VOTES_PRESENT');
      need(expectedRevision === 0, 'REVISION_CONFLICT');
      need(poll.status !== 'closed', 'POLL_CLOSED');
      await this.#valid({ ...emptyState(), polls: [poll], ballots: localBallots });
      const capabilityHash = await this.#digest(poll.id, adminCapability);
      const previous = this.#records.get(poll.id);
      // Retient seulement le hash de la capacité, jamais la requête d'administration.
      const signature = canonical(poll);
      if (previous) {
        need(previous.capabilityHash === capabilityHash, 'INVALID_CAPABILITY');
        need(previous.revision === 0 && !previous.public, 'REVISION_CONFLICT');
        need(previous.signature === signature, 'PUBLICATION_CONFLICT');
        return { remoteRef: this.#ref(previous) };
      }
      const state = { ...emptyState(), polls: [{ ...poll, status: 'draft', createdAt: this.#now(), publishedAt: null }] };
      await this.#valid(state);
      const record = { state, revision: 0, public: false, capabilityHash, signature,
        semanticDigest: await semanticHash(poll), assets: new Map() };
      this.#records.set(poll.id, record);
      return { remoteRef: this.#ref(record) };
    }
    need(isPublicPollId(request.pollId), 'INVALID_REQUEST');
    const record = this.#records.get(request.pollId);
    need(record, 'NOT_FOUND');
    if (keys[method].includes('adminCapability')) {
      need(await this.#digest(request.pollId, request.adminCapability) === record.capabilityHash, 'INVALID_CAPABILITY');
      // Lecture authentifiée : permet aussi de retrouver une préparation après
      // perte de réponse. Seules les mutations imposent la révision exacte.
      if (!['getMissingAssets', 'verifyAdmin'].includes(method)) need(Number.isSafeInteger(request.expectedRevision) && request.expectedRevision === record.revision,
        'REVISION_CONFLICT', 'Rechargez l’état distant.', { remoteRef: this.#ref(record) });
    } else need(record.public, 'NOT_FOUND');
    const poll = record.state.polls[0];
    if (method === 'verifyAdmin') { need(record.public, 'NOT_FOUND'); return this.#view(record); }
    if (method === 'deletePoll') { need(record.public, 'NOT_FOUND'); this.#records.delete(poll.id); return { deleted: true }; }
    if (method === 'getPoll') return this.#view(record);
    if (method === 'getResults') {
      const result = { remoteRef: this.#ref(record), ...getResults(record.state, poll.id) };
      need(result.available, 'RESULTS_LOCKED', 'Les résultats ne sont pas encore disponibles.', result);
      return result;
    }
    if (method === 'getAsset') {
      need(isAssetId(request.assetId), 'INVALID_REQUEST');
      need(assetReferences(record.state).has(request.assetId), 'NOT_FOUND');
      need(record.assets.has(request.assetId), 'ASSET_MISSING');
      return record.assets.get(request.assetId);
    }
    if (method === 'discardPublication') {
      need(!record.public, 'PUBLICATION_CONFLICT'); this.#records.delete(poll.id); return { discarded: true };
    }
    if (method === 'getMissingAssets') {
      need(Array.isArray(request.assetIds) && request.assetIds.length <= 14 && request.assetIds.every(isAssetId), 'INVALID_REQUEST');
      return { remoteRef: this.#ref(record), missingAssetIds: [...new Set(request.assetIds)].filter(id => !record.assets.has(id)) };
    }
    if (method === 'putAssets') {
      need(poll.status !== 'closed', 'POLL_CLOSED'); need(!poll.lockedAt, 'POLL_LOCKED');
      need(Array.isArray(request.assets), 'ASSET_INVALID');
      need(request.assets.length <= 14, 'PAYLOAD_TOO_LARGE');
      const next = new Map(record.assets), seen = new Set();
      for (const asset of request.assets) {
        need(asset && !seen.has(asset.id), 'ASSET_INVALID'); seen.add(asset.id);
        need(asset.blob instanceof Blob, 'ASSET_INVALID');
        need(asset.blob.size <= 1_000_000, 'PAYLOAD_TOO_LARGE');
        try { await validateAsset(asset); } catch { throw new RelayError('ASSET_INVALID'); }
        next.set(asset.id, asset);
      }
      need(next.size <= 14, 'PAYLOAD_TOO_LARGE');
      if (next.size !== record.assets.size) { const revision = this.#nextRevision(record); record.assets = next; record.revision = revision; }
      return { remoteRef: this.#ref(record), assetIds: [...seen] };
    }
    if (method === 'castVote') {
      need(isPublicPollId(request.actionId), 'INVALID_REQUEST');
      const existing = record.state.ballots.find(item => item.id === request.actionId);
      if (existing) need(existing.choiceId === request.choiceId, 'IDEMPOTENCY_CONFLICT');
      else {
        need(poll.status !== 'closed', 'POLL_CLOSED');
        need(poll.definition.choices.some(choice => choice.id === request.choiceId), 'INVALID_CHOICE');
        need(request.actionId !== poll.id && !poll.definition.choices.some(choice => choice.id === request.actionId), 'INVALID_REQUEST');
        const next = await castVote(record.state, { id: request.actionId, pollId: poll.id, choiceId: request.choiceId }, this.#now);
        await this.#valid(next);
        need(next.polls[0].definitionHash === record.semanticDigest, 'INVALID_DEFINITION');
        const revision = this.#nextRevision(record);
        record.state = next; record.revision = revision; this.#prune(record);
      }
      const view = this.#view(record);
      return { accepted: true, alreadyAccepted: Boolean(existing), remoteRef: view.remoteRef,
        status: view.status, locked: view.locked, results: view.results };
    }
    let next;
    if (method === 'publishPoll') {
      need(!record.public, 'PUBLICATION_CONFLICT');
      await this.#references(record.state, record.assets);
      next = publishPoll(record.state, poll.id, this.#now);
    } else {
      need(record.public, 'NOT_FOUND');
      if (method === 'updateDefinition') {
        need(!poll.lockedAt, 'POLL_LOCKED'); need(poll.status !== 'closed', 'POLL_CLOSED');
        try { next = updateSemantics(record.state, poll.id, request.definition, request.resultRules); }
        catch { throw new RelayError('INVALID_DEFINITION'); }
        await this.#references(next, record.assets);
      } else if (method === 'updateStyle') {
        try { next = updateStyle(record.state, poll.id, request.style); }
        catch { throw new RelayError('INVALID_DEFINITION'); }
      } else if (method === 'closePoll') {
        need(poll.status !== 'closed', 'POLL_CLOSED'); next = closePoll(record.state, poll.id, this.#now);
      }
    }
    await this.#valid(next);
    const semanticDigest = await semanticHash(next.polls[0]), revision = this.#nextRevision(record);
    record.state = next; record.semanticDigest = semanticDigest;
    record.public = true; record.revision = revision; this.#prune(record);
    return this.#view(record);
  }
  async preparePublication(request) { return this.#run('preparePublication', request); }
  async getMissingAssets(request) { return this.#run('getMissingAssets', request); }
  async putAssets(request) { return this.#run('putAssets', request); }
  async publishPoll(request) { return this.#run('publishPoll', request); }
  async discardPublication(request) { return this.#run('discardPublication', request); }
  async getPoll(request) { return this.#run('getPoll', request); }
  async getResults(request) { return this.#run('getResults', request); }
  async getAsset(request) { return this.#run('getAsset', request); }
  async updateDefinition(request) { return this.#run('updateDefinition', request); }
  async updateStyle(request) { return this.#run('updateStyle', request); }
  async closePoll(request) { return this.#run('closePoll', request); }
  async deletePoll(request) { return this.#run('deletePoll', request); }
  async verifyAdmin(request) { return this.#run('verifyAdmin', request); }
  async castVote(request) { return this.#run('castVote', request); }
}
