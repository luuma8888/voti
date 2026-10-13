import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRelayAdapter } from './in-memory-relay.js';
import { RelayClient } from '../shared/relay-client.js';
import { MemoryRemoteConnectionAdapter } from '../shared/remote-state.js';
import { createPoll } from '../shared/poll-engine.js';
import { emptyState } from '../shared/model.js';
import { validateRelayResponse } from '../shared/relay-wire.js';
import { createVoteActionId } from '../shared/relay.js';

async function setup(options={}) {
  const adapter=new InMemoryRelayAdapter(),store=new MemoryRemoteConnectionAdapter();
  const creator=new RelayClient(adapter,store),voter=new RelayClient(adapter,new MemoryRemoteConnectionAdapter());
  const state=createPoll(emptyState(),{question:'Test fictif',choices:['A','B'],commentVisibility:'public_with_results',resultRules:{minimumResponses:1},...options}),poll=state.polls[0];
  await creator.preparePublication(state,poll.id);await creator.publishPoll(poll.id);return {adapter,creator,voter,poll};
}
test('relais partagé : soumission identified idempotente, admin avant seuil et public sans nom',async()=>{
  const {adapter,creator,voter,poll}=await setup({participationIdentityMode:'identified',resultRules:{minimumResponses:2}});
  const action=createVoteActionId(),submission={displayName:'Emma',comment:'Très bien'};
  const [first,retry]=await Promise.all([voter.castVote(poll.id,poll.definition.choices[0].id,action,submission),voter.castVote(poll.id,poll.definition.choices[0].id,action,submission)]);
  assert.equal(first.alreadyAccepted,false);assert.equal(retry.alreadyAccepted,true);
  await assert.rejects(voter.castVote(poll.id,poll.definition.choices[0].id,action,{...submission,comment:'Autre'}),{code:'IDEMPOTENCY_CONFLICT'});
  const admin=await creator.getParticipations(poll.id);assert.equal(admin.entries.length,1);assert.equal(admin.entries[0].displayName,'Emma');
  validateRelayResponse('getParticipations',admin,adapter.relayId,poll.id);
  await creator.updateCommentStatus(poll.id,admin.entries[0].comment.commentId,1,'visible');
  assert.ok(!('comments' in (await voter.getPoll(poll.id)).results));
  await voter.castVote(poll.id,poll.definition.choices[1].id,createVoteActionId(),{displayName:'Emma'});
  const results=await voter.getResults(poll.id);assert.equal(results.comments.count,1);assert.ok(!JSON.stringify(results).includes('Emma'));
  const response=await voter.getComments(poll.id);validateRelayResponse('getComments',response,adapter.relayId,poll.id);
  const contaminated=structuredClone(response);contaminated.items[0].displayName='Emma';assert.throws(()=>validateRelayResponse('getComments',contaminated,adapter.relayId,poll.id));
});
test('modération deux clients admin : CAS, aucune édition de texte ; delete garde quantités et ne recrée pas',async()=>{
  const {creator,voter,poll}=await setup();const action=createVoteActionId();
  await voter.castVote(poll.id,poll.definition.choices[0].id,action,{comment:'Essai'});
  const page=await creator.getParticipations(poll.id),comment=page.entries[0].comment;
  await creator.updateCommentStatus(poll.id,comment.commentId,1,'hidden');
  await assert.rejects(creator.updateCommentStatus(poll.id,comment.commentId,1,'visible'),{code:'REVISION_CONFLICT'});
  await creator.deleteComment(poll.id,comment.commentId,2);
  assert.equal((await voter.getResults(poll.id)).totalBallots,1);
  await voter.castVote(poll.id,poll.definition.choices[0].id,action,{comment:'Essai'});
  assert.equal((await creator.getParticipations(poll.id)).entries.length,0);
});
test('pages bornées de 25 : public sans nom ni actionId, aucun doublon entre pages',async()=>{
  const {creator,voter,poll}=await setup();
  for(let i=0;i<27;i++)await voter.castVote(poll.id,poll.definition.choices[0].id,createVoteActionId(),{comment:'Fictif '+i});
  let admin=await creator.getParticipations(poll.id);assert.equal(admin.entries.length,25);assert.ok(admin.nextCursor);
  const second=await creator.getParticipations(poll.id,admin.nextCursor);assert.equal(second.entries.length,2);
  for(const e of [...admin.entries,...second.entries])await creator.updateCommentStatus(poll.id,e.comment.commentId,1,'visible');
  const first=await voter.getComments(poll.id),last=await voter.getComments(poll.id,first.nextCursor);
  assert.equal(first.count,27);assert.equal(first.items.length,25);assert.equal(last.items.length,2);
  assert.equal(new Set([...first.items,...last.items].map(c=>c.commentId)).size,27);assert.ok(!JSON.stringify(first).includes('actionId'));
});
