import { validateState } from './validation.js';
import { RelayError, relayEnsure, createAdminCapability } from './relay.js';

/** Client sans DOM ni transport. Son cache ne décide jamais des droits distants. */
export class RelayClient {
  #relay;
  #connections;
  constructor(relay, connections) { this.#relay = relay; this.#connections = connections; }
  #key(pollId) { return { relayId: this.#relay.relayId, pollId }; }
  async #remember(response) {
    const { relayId, pollId, revision } = response.remoteRef;
    const previous = await this.#connections.get({ relayId, pollId });
    // Une réponse retardataire ne doit pas rétrograder le cache.
    if (previous && previous.remoteRevision > revision) return response;
    const known = response.definition ? { status: response.status, locked: response.locked,
      definitionHash: response.definitionHash, resultsAvailable: response.results.available } : null;
    await this.#connections.put({ formatVersion: 1, relayId, pollId, remoteRevision: revision,
      adminCapability: previous?.adminCapability ?? null, lastKnownRemoteState: known });
    return response;
  }
  async #admin(method, pollId, fields = {}) {
    const connection = await this.#connections.get(this.#key(pollId));
    relayEnsure(connection?.adminCapability, 'INVALID_CAPABILITY');
    const response = await this.#relay[method]({ ...fields, pollId,
      adminCapability: connection.adminCapability, expectedRevision: connection.remoteRevision });
    return response.remoteRef ? this.#remember(response) : response;
  }
  async preparePublication(input, pollId, humanVerificationToken) {
    const state = structuredClone(input);
    try { await validateState(state); } catch { throw new RelayError('INVALID_DEFINITION'); }
    const poll = state.polls.find(item => item.id === pollId);
    relayEnsure(poll, 'NOT_FOUND');
    const localBallots = state.ballots.filter(item => item.pollId === pollId);
    relayEnsure(localBallots.length === 0, 'LOCAL_VOTES_PRESENT');
    let connection = await this.#connections.get(this.#key(pollId));
    if (!connection) {
      connection = { formatVersion: 1, ...this.#key(pollId), remoteRevision: 0,
        adminCapability: createAdminCapability(), lastKnownRemoteState: null };
      // La capacité doit être conservée AVANT toute préparation distante.
      await this.#connections.put(connection);
    }
    relayEnsure(connection.adminCapability, 'INVALID_CAPABILITY');
    return this.#remember(await this.#relay.preparePublication({ poll, localBallots,
      adminCapability: connection.adminCapability, expectedRevision: connection.remoteRevision,
      ...(humanVerificationToken === undefined ? {} : { humanVerificationToken }) }));
  }
  async uploadMissingAssets(pollId, assetIds, assets, expectedRevision) {
    const missing = await this.#admin('getMissingAssets', pollId, { assetIds: [...assetIds] });
    if (expectedRevision !== undefined) relayEnsure(missing.remoteRef.revision === expectedRevision, 'REVISION_CONFLICT');
    const records = [];
    for (const id of missing.missingAssetIds) {
      const asset = await assets.get(id); relayEnsure(asset, 'ASSET_MISSING'); records.push(asset);
    }
    return this.#admin('putAssets', pollId, { assets: records });
  }
  async publishPoll(pollId) { return this.#admin('publishPoll', pollId); }
  async discardPublication(pollId) {
    let result;
    try { result = await this.#admin('discardPublication', pollId); }
    catch (error) {
      if (error.code !== 'NOT_FOUND') throw error;
      // Préparation expirée/nettoyée ou réponse d'abandon perdue : oubli local explicite.
      result = { discarded: true };
    }
    await this.#connections.delete(this.#key(pollId)); return result;
  }
  async getPoll(pollId) { return this.#remember(await this.#relay.getPoll({ pollId })); }
  async updateDefinition(pollId, definition, resultRules) { return this.#admin('updateDefinition', pollId, { definition, resultRules }); }
  async updateStyle(pollId, style) { return this.#admin('updateStyle', pollId, { style }); }
  async closePoll(pollId) { return this.#admin('closePoll', pollId); }
  async deletePoll(pollId) {
    let result;
    try { result = await this.#admin('deletePoll', pollId); }
    catch (error) { if (error.code !== 'NOT_FOUND') throw error; result = { deleted: true }; }
    await this.#connections.delete(this.#key(pollId)); return result;
  }
  async castVote(pollId, choiceId, actionId) { return this.#remember(await this.#relay.castVote({ pollId, choiceId, actionId })); }
  async getResults(pollId) { return this.#relay.getResults({ pollId }); }
  async getAsset(pollId, assetId) { return this.#relay.getAsset({ pollId, assetId }); }
}
