import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpRelayAdapter } from '../web/http-relay.js';
import { HTTP_ROUTES, decodeAsset, encodeAsset } from '../shared/relay-wire.js';
import { RelayError, createAdminCapability } from '../shared/relay.js';
import { InMemoryRelayAdapter } from './in-memory-relay.js';
import { draft } from './fixtures.js';

test('HttpRelayAdapter : protocole JSON, Bearer séparé, aucune cookie ou redirection', async () => {
  const memory = new InMemoryRelayAdapter(), state = draft(), poll = state.polls[0];
  const cap = createAdminCapability(); let requests = 0;
  const adapter = new HttpRelayAdapter({ relayId:'memory', baseUrl:'http://127.0.0.1:8787', fetchImpl: async (url, options) => {
    requests++;
    assert.equal(options.credentials,'omit'); assert.equal(options.redirect,'error');
    assert.ok(!url.includes(cap)); assert.ok(!options.body?.includes(cap));
    const body = options.body ? JSON.parse(options.body) : {};
    let result;
    if (url.endsWith('/publications')) {
      assert.equal(options.headers.Authorization,`Bearer ${cap}`);
      result=await memory.preparePublication({...body,adminCapability:cap});
    } else if (url.endsWith('/commit')) result=await memory.publishPoll({...body,pollId:poll.id,adminCapability:cap});
    else { assert.equal(options.headers.Authorization,undefined); result=await memory.getPoll({pollId:poll.id}); }
    return Response.json(result);
  }});
  const initial=await adapter.preparePublication({poll,localBallots:[],expectedRevision:0,adminCapability:cap});
  assert.equal(initial.remoteRef.revision,0);
  await adapter.publishPoll({pollId:poll.id,expectedRevision:0,adminCapability:cap});
  assert.equal((await adapter.getPoll({pollId:poll.id})).definition.question,poll.definition.question);
  assert.equal(requests,3);
  assert.equal(Object.keys(HTTP_ROUTES).length,12);
});
test('HttpRelayAdapter : timeout, coupure, erreur HTTP inconnue et réponse malformée', async () => {
  const id=crypto.randomUUID();
  for(const fetchImpl of [
    async()=>{throw new Error('réseau');},
    async()=>new Response('<html>Erreur proxy</html>',{status:502}),
    async()=>Response.json({error:{code:'INCONNU'}},{status:400}),
    async()=>Response.json({ballots:[]}),
    (_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout')))),
  ]) {
    const adapter=new HttpRelayAdapter({relayId:'test',baseUrl:'http://localhost:8787',timeoutMs:10,fetchImpl});
    await assert.rejects(adapter.getPoll({pollId:id}),error=>error instanceof RelayError && ['RELAY_UNAVAILABLE','INVALID_REQUEST'].includes(error.code));
  }
});
test('HttpRelayAdapter : erreurs structurées sans message ou secret renvoyé par un proxy', async () => {
  const cap=createAdminCapability();
  const adapter=new HttpRelayAdapter({relayId:'test',baseUrl:'https://example.invalid',fetchImpl:async()=>Response.json({error:{code:'RATE_LIMITED',message:cap,details:{cap}}},{status:429})});
  await assert.rejects(adapter.getPoll({pollId:crypto.randomUUID()}),error=>{
    assert.equal(error.code,'RATE_LIMITED'); assert.ok(!JSON.stringify(error.toJSON()).includes(cap)); return true;
  });
});
test('HttpRelayAdapter : réponse publique contaminée et enveloppe excessive refusées', async () => {
  const memory=new InMemoryRelayAdapter(),state=draft(),poll=state.polls[0],cap=createAdminCapability();
  await memory.preparePublication({poll,localBallots:[],adminCapability:cap,expectedRevision:0});
  const view=await memory.publishPoll({pollId:poll.id,adminCapability:cap,expectedRevision:0});
  for(const response of [Response.json({...view,ballots:[]}),Response.json({...view,adminCapability:cap}),new Response(' '.repeat(70_000))]) {
    const adapter=new HttpRelayAdapter({relayId:'memory',baseUrl:'http://localhost:8787',fetchImpl:async()=>response});
    await assert.rejects(adapter.getPoll({pollId:poll.id}),error=>error instanceof RelayError);
  }
});
test('configuration HTTP sûre : pas de secret URL, query, hash ou HTTP tiers', () => {
  for(const baseUrl of ['http://example.invalid','https://user:pass@example.invalid','https://example.invalid?cap=secret','https://example.invalid/#secret']) {
    assert.throws(()=>new HttpRelayAdapter({relayId:'test',baseUrl}),error=>error.code==='INVALID_REQUEST');
  }
});
test('codec HTTP assets : base64 invalide et taille avant décodage', async () => {
  await assert.rejects(decodeAsset({base64:'bad'}),{code:'ASSET_INVALID'});
  await assert.rejects(encodeAsset({}),/Asset/);
});
