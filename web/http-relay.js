import { RelayAdapter, RelayError, RELAY_ERROR_CODES, relayEnsure as need, isPublicPollId } from '../shared/relay.js';
import { HTTP_ROUTES, encodeAsset, decodeAsset, readBoundedJson, validateRelayResponse } from '../shared/relay-wire.js';

/** Transport fetch uniquement ; pas de DOM, cookies, retry automatique ou état métier. */
export class HttpRelayAdapter extends RelayAdapter {
  constructor({ relayId, baseUrl, timeoutMs = 15000, fetchImpl = globalThis.fetch }) {
    super(relayId);
    const url = new URL(baseUrl);
    need(!url.username && !url.password && !url.search && !url.hash &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))), 'INVALID_REQUEST');
    this.baseUrl = url.href.replace(/\/$/, ''); this.timeoutMs = timeoutMs; this.fetchImpl = fetchImpl;
  }
  async call(method, input) {
    const request = structuredClone(input), pollId = request.pollId || request.poll?.id;
    need(isPublicPollId(pollId), 'INVALID_REQUEST');
    const [verb, path] = HTTP_ROUTES[method];
    const { adminCapability, pollId: _poll, assetId, ...body } = request;
    const headers = { Accept: 'application/json' };
    if (adminCapability) headers.Authorization = `Bearer ${adminCapability}`;
    if (method === 'putAssets') body.assets = await Promise.all(body.assets.map(encodeAsset));
    const payload = verb === 'GET' ? undefined : JSON.stringify(body);
    if (payload) { need(new TextEncoder().encode(payload).length <= (method === 'putAssets' ? 20_000_000 : 65_536), 'PAYLOAD_TOO_LARGE'); headers['Content-Type'] = 'application/json'; }
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl.call(globalThis, `${this.baseUrl}/api/v1/${path.replace(':id', pollId).replace(':asset', encodeURIComponent(assetId || ''))}`,
        { method: verb, headers, body: payload, credentials: 'omit', redirect: 'error', cache: method === 'getAsset' ? 'default' : 'no-store', signal: controller.signal });
      const value = await readBoundedJson(response, method === 'getAsset' ? 1_400_000 : 65_536);
      if (!response.ok) {
        need(value?.error && RELAY_ERROR_CODES.includes(value.error.code), 'RELAY_UNAVAILABLE');
        // Ne pas répercuter des messages ou détails arbitraires d'un proxy HTTP.
        if (value.error.code === 'RESULTS_LOCKED') validateRelayResponse('getResults', value.error.details, this.relayId, pollId);
        throw new RelayError(value.error.code, value.error.code === 'RESULTS_LOCKED' ? 'Les résultats ne sont pas encore disponibles.' : 'Le relais a refusé cette opération.', value.error.code === 'RESULTS_LOCKED' ? value.error.details : {});
      }
      if (method === 'getAsset') { const asset = await decodeAsset(value); need(asset.id === assetId, 'ASSET_INVALID'); return asset; }
      return validateRelayResponse(method, value, this.relayId, pollId);
    } catch (error) { if (error instanceof RelayError) throw error; throw new RelayError('RELAY_UNAVAILABLE', 'Relais indisponible. Aucun vote local de secours n’a été enregistré.'); }
    finally { clearTimeout(timer); }
  }
  async preparePublication(r) { return this.call('preparePublication', r); }
  async getMissingAssets(r) { return this.call('getMissingAssets', r); }
  async putAssets(r) { return this.call('putAssets', r); }
  async publishPoll(r) { return this.call('publishPoll', r); }
  async discardPublication(r) { return this.call('discardPublication', r); }
  async getPoll(r) { return this.call('getPoll', r); }
  async updateDefinition(r) { return this.call('updateDefinition', r); }
  async updateStyle(r) { return this.call('updateStyle', r); }
  async closePoll(r) { return this.call('closePoll', r); }
  async deletePoll(r) { return this.call('deletePoll', r); }
  async verifyAdmin(r) { return this.call('verifyAdmin', r); }
  async castVote(r) { return this.call('castVote', r); }
  async getResults(r) { return this.call('getResults', r); }
  async getAsset(r) { return this.call('getAsset', r); }
}
