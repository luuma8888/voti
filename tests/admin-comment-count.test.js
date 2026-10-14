import test from 'node:test';
import assert from 'node:assert/strict';
import {localCommentCount,remoteCommentCount,canReadRemoteComments} from '../web/admin-comment-count.js';
import {createAdminCapability,createVoteActionId} from '../shared/relay.js';
import {RelayClient} from '../shared/relay-client.js';
import {MemoryRemoteConnectionAdapter} from '../shared/remote-state.js';
import {InMemoryRelayAdapter} from './in-memory-relay.js';
import {emptyState} from '../shared/model.js';
import {createPoll,publishPoll,castVote} from '../shared/poll-engine.js';
import {getResults} from '../shared/result-rules.js';

test('lecture distante réservée au créateur, jamais au votant ou à un autre relais',()=>{
  const connection={relayId:'fictif',remoteRevision:1,adminCapability:createAdminCapability()};
  assert.equal(canReadRemoteComments(connection,'fictif'),true);
  for(const value of [null,{...connection,adminCapability:null},{...connection,adminCapability:'invalide'},{...connection,remoteRevision:0}])assert.equal(canReadRemoteComments(value,'fictif'),false);
  assert.equal(canReadRemoteComments(connection,'autre'),false);assert.equal(canReadRemoteComments(connection,null),false);
});

test('compteur local : zéro, un, plusieurs statuts, autre sondage exclu',()=>{
  const state={comments:[]};assert.equal(localCommentCount(state,'p'),0);
  state.comments.push({pollId:'p',moderationStatus:'pending'});assert.equal(localCommentCount(state,'p'),1);
  state.comments.push({pollId:'p',moderationStatus:'visible'},{pollId:'p',moderationStatus:'hidden'},{pollId:'autre'});
  const before=structuredClone(state);assert.equal(localCommentCount(state,'p'),3);assert.deepEqual(state,before);
});
test('compteur distant : pages, commentaires seuls, doublon ignoré',async()=>{
  const seen=[];const pages=[{entries:[{displayName:'Fictif'},{comment:{commentId:'a'}}],nextCursor:'next'},
    {entries:[{comment:{commentId:'a'}},{comment:{commentId:'b'}},{comment:{commentId:'c'}}],nextCursor:null}];
  assert.equal(await remoteCommentCount(async cursor=>{seen.push(cursor);return pages.shift();}),3);
  assert.deepEqual(seen,[null,'next']);
  assert.equal(await remoteCommentCount(async()=>({entries:[],nextCursor:null})),0);
});
test('échec, pagination cyclique et navigation : aucun compteur partiel',async()=>{
  await assert.rejects(remoteCommentCount(async()=>{throw new Error('Indisponible');}),/Indisponible/);
  await assert.rejects(remoteCommentCount(async()=>({entries:[],nextCursor:'same'})),/Pagination/);
  let calls=0;assert.equal(await remoteCommentCount(async()=>{calls++;},()=>false),null);assert.equal(calls,0);
  let active=true;assert.equal(await remoteCommentCount(async()=>{active=false;return{entries:[{comment:{commentId:'a'}}],nextCursor:'next'};},()=>active),null);
});
test('lecture du compteur privé ne modifie aucune projection publique sous seuil',async()=>{
  let state=createPoll(emptyState(),{question:'Fictif',choices:['Oui','Non'],commentVisibility:'private'});
  state=publishPoll(state,state.polls[0].id);const poll=state.polls[0];
  state=await castVote(state,{id:crypto.randomUUID(),pollId:poll.id,choiceId:poll.definition.choices[0].id,comment:'Fictif privé'});
  const projection=getResults(state,poll.id),before=structuredClone(state);
  assert.equal(localCommentCount(state,poll.id),1);assert.deepEqual(getResults(state,poll.id),projection);assert.deepEqual(state,before);
  assert.ok(!JSON.stringify(projection).includes('Fictif privé'));
});

test('relais partagé : 27 commentaires privés paginés, participations sans commentaire exclues, public inchangé',async()=>{
  const adapter=new InMemoryRelayAdapter(),store=new MemoryRemoteConnectionAdapter(),voterStore=new MemoryRemoteConnectionAdapter();
  const creator=new RelayClient(adapter,store),voter=new RelayClient(adapter,voterStore);
  const state=createPoll(emptyState(),{question:'Fictif',choices:['Oui','Non'],participationIdentityMode:'identified',commentVisibility:'private',resultRules:{minimumResponses:50}}),poll=state.polls[0];
  await creator.preparePublication(state,poll.id);await creator.publishPoll(poll.id);
  for(let i=0;i<28;i++)await voter.castVote(poll.id,poll.definition.choices[0].id,createVoteActionId(),{displayName:'Pseudo fictif',...(i<27?{comment:'Privé fictif'}:{})});
  const before=await voter.getPoll(poll.id);let pages=0;
  assert.equal(await remoteCommentCount(cursor=>{pages++;return creator.getParticipations(poll.id,cursor);}),27);assert.equal(pages,2);
  assert.deepEqual(await voter.getPoll(poll.id),before);
  assert.equal(canReadRemoteComments((await voterStore.list())[0],adapter.relayId),false);
  await assert.rejects(voter.getParticipations(poll.id),{code:'INVALID_CAPABILITY'});
  assert.ok(!JSON.stringify(before).includes('Privé fictif'));
});
