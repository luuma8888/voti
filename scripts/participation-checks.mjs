import assert from 'node:assert/strict';
import { createPoll } from '../shared/poll-engine.js';
import { emptyState } from '../shared/model.js';
import { createAdminCapability, createVoteActionId } from '../shared/relay.js';

/** Scénarios exécutés contre le Worker + D1 réels LOCAUX, jamais contre la production. */
export async function participationChecks({adapter,sql}) {
  let checks=0;const ok=value=>{assert.ok(value);checks++;};
  const reject=async(promise,code)=>{await assert.rejects(promise,e=>e.code===code);checks++;};
  const rows=async command=>(await sql(command))[0].results;
  async function setup(options={}) {
    const {legacy=false,...settings}=options;
    const state=createPoll(emptyState(),{question:'Atelier fictif v0.5',choices:['Pomme','Poire'],commentVisibility:'public_with_results',...settings});
    if(legacy){state.polls[0].schemaVersion=2;for(const key of ['participationIdentityMode','commentMode','commentVisibility'])delete state.polls[0].definition[key];}
    const poll=state.polls[0],adminCapability=createAdminCapability();
    const prep=await adapter.preparePublication({poll,localBallots:[],expectedRevision:0,adminCapability,humanVerificationToken:`voti-local-test.${Date.now()}.${crypto.randomUUID()}`});
    await adapter.publishPoll({pollId:poll.id,expectedRevision:prep.remoteRef.revision,adminCapability});
    const auth=async() => ({pollId:poll.id,adminCapability,expectedRevision:(await adapter.getPoll({pollId:poll.id})).remoteRef.revision});
    const vote=fields=>adapter.castVote({pollId:poll.id,choiceId:poll.definition.choices[0].id,actionId:createVoteActionId(),...fields});
    const counts=async()=> (await rows(`SELECT (SELECT COUNT(*) FROM ballots WHERE poll_id='${poll.id}') ballots,
      (SELECT COUNT(*) FROM comments WHERE poll_id='${poll.id}') comments,(SELECT COUNT(*) FROM participations WHERE poll_id='${poll.id}') participations,
      (SELECT locked FROM polls WHERE poll_id='${poll.id}') locked`))[0];
    return {poll,auth,vote,counts};
  }
  const anonymous=await setup();const id=anonymous.poll.id;
  const submission={pollId:id,choiceId:anonymous.poll.definition.choices[0].id,actionId:createVoteActionId(),comment:'<img onerror="x"> 😊 Essai anonyme'};
  const receipts=await Promise.all([adapter.castVote(submission),adapter.castVote(submission)]);
  ok(receipts.filter(r=>!r.alreadyAccepted).length===1);
  assert.deepEqual(await anonymous.counts(),{ballots:1,comments:1,participations:0,locked:1});checks++;
  const identityColumns=(await rows(`SELECT participation_id FROM ballots WHERE poll_id='${id}' UNION ALL SELECT participation_id FROM comments WHERE poll_id='${id}'`));
  ok(identityColumns.every(r=>r.participation_id===null));
  let admin=await adapter.getParticipations({...await anonymous.auth(),cursor:null});ok(admin.entries.length===1&&!('displayName' in admin.entries[0]));
  const comment=admin.entries[0].comment;
  await reject(adapter.getParticipations({...await anonymous.auth(),adminCapability:createAdminCapability(),cursor:null}),'INVALID_CAPABILITY');
  await adapter.updateCommentStatus({...await anonymous.auth(),commentId:comment.commentId,expectedCommentRevision:1,moderationStatus:'visible'});
  await reject(adapter.updateCommentStatus({...await anonymous.auth(),commentId:comment.commentId,expectedCommentRevision:2,moderationStatus:'visible',text:'Texte remplacé'}),'INVALID_REQUEST');
  await reject(adapter.updateCommentStatus({...await anonymous.auth(),commentId:comment.commentId,expectedCommentRevision:1,moderationStatus:'hidden'}),'REVISION_CONFLICT');
  ok(!('comments' in (await adapter.getPoll({pollId:id})).results));
  await reject(adapter.getComments({pollId:id,cursor:null}),'RESULTS_LOCKED');
  await reject(adapter.castVote({...submission,comment:'Retry changé'}),'IDEMPOTENCY_CONFLICT');
  await reject(adapter.castVote({...submission,displayName:'Nom interdit'}),'INVALID_COMMENT');
  await reject(adapter.castVote({...submission,comment:'\ud800'}),'INVALID_COMMENT');
  for(let n=0;n<3;n++)await anonymous.vote({comment:n===0?'En attente':''});
  ok(!('comments' in (await adapter.getPoll({pollId:id})).results));
  await anonymous.vote({comment:''});let results=await adapter.getResults({pollId:id});ok(results.totalBallots===5&&results.comments.count===1);
  ok(!JSON.stringify(results).includes('participationId')&&!JSON.stringify(results).includes('actionId'));
  let current=(await adapter.getParticipations({...await anonymous.auth(),cursor:null})).entries.find(e=>e.comment.commentId===comment.commentId).comment;
  await adapter.updateCommentStatus({...await anonymous.auth(),commentId:current.commentId,expectedCommentRevision:current.revision,moderationStatus:'hidden'});
  ok(!('comments' in await adapter.getResults({pollId:id})));
  current=(await adapter.getParticipations({...await anonymous.auth(),cursor:null})).entries.find(e=>e.comment.commentId===comment.commentId).comment;
  await adapter.updateCommentStatus({...await anonymous.auth(),commentId:current.commentId,expectedCommentRevision:current.revision,moderationStatus:'visible'});
  current=(await adapter.getParticipations({...await anonymous.auth(),cursor:null})).entries.find(e=>e.comment.commentId===comment.commentId).comment;
  await adapter.deleteComment({...await anonymous.auth(),commentId:current.commentId,expectedCommentRevision:current.revision});
  await adapter.castVote(submission);ok((await anonymous.counts()).comments===1&&(await anonymous.counts()).ballots===5); // pending conservé, supprimé non recréé
  await reject(adapter.updateDefinition({...await anonymous.auth(),definition:{...anonymous.poll.definition,commentMode:'disabled'},resultRules:anonymous.poll.resultRules}),'POLL_LOCKED');

  const privatePoll=await setup({commentVisibility:'private',resultRules:{minimumResponses:1}});
  await privatePoll.vote({comment:'Privé fictif'});const privateEntry=(await adapter.getParticipations({...await privatePoll.auth(),cursor:null})).entries[0].comment;
  ok(!('comments' in await adapter.getResults({pollId:privatePoll.poll.id})));
  await reject(adapter.getComments({pollId:privatePoll.poll.id,cursor:null}),'NOT_FOUND');
  await reject(adapter.updateCommentStatus({...await privatePoll.auth(),commentId:privateEntry.commentId,expectedCommentRevision:1,moderationStatus:'visible'}),'INVALID_COMMENT');
  const legacy=await setup({legacy:true,resultRules:{minimumResponses:1}});
  const beforeLegacy=(await adapter.getPoll({pollId:legacy.poll.id})).definition;
  await legacy.vote({});ok((await legacy.counts()).comments===0&&(await legacy.counts()).participations===0);
  assert.deepEqual((await adapter.getPoll({pollId:legacy.poll.id})).definition,beforeLegacy);checks++;
  await reject(legacy.vote({comment:'Interdit historique'}),'INVALID_COMMENT');
  await adapter.verifyAdmin(await legacy.auth());await adapter.closePoll(await legacy.auth());
  ok((await adapter.getResults({pollId:legacy.poll.id})).totalBallots===1);await adapter.deletePoll(await legacy.auth());

  const identified=await setup({participationIdentityMode:'identified',resultRules:{minimumResponses:2}});
  await reject(identified.vote({comment:'Sans nom'}),'INVALID_PARTICIPATION');
  await reject(identified.vote({displayName:'\ud800'}),'INVALID_PARTICIPATION');
  const namedAction={pollId:identified.poll.id,choiceId:identified.poll.definition.choices[0].id,actionId:createVoteActionId(),displayName:'Emma',comment:'Commentaire fictif'};
  await Promise.all([adapter.castVote(namedAction),adapter.castVote(namedAction)]);
  await identified.vote({displayName:'Emma',comment:'Second pseudo identique'});
  await identified.vote({displayName:'Éloïse 😊 العربية',comment:''});
  assert.deepEqual(await identified.counts(),{ballots:3,comments:2,participations:3,locked:1});checks++;
  const entries=(await adapter.getParticipations({...await identified.auth(),cursor:null})).entries;
  ok(entries.filter(e=>e.displayName==='Emma').length===2&&entries.every(e=>e.participationId));
  const namedComment=entries.find(e=>e.comment)?.comment;
  await adapter.updateCommentStatus({...await identified.auth(),commentId:namedComment.commentId,expectedCommentRevision:1,moderationStatus:'visible'});
  const publicNamed=await adapter.getResults({pollId:identified.poll.id});
  ok(publicNamed.comments.count===1&&!JSON.stringify(publicNamed).includes('Emma')&&!JSON.stringify(publicNamed).includes('displayName'));
  await reject(adapter.castVote({...namedAction,displayName:'Autre'}),'IDEMPOTENCY_CONFLICT');

  const failing=await setup({participationIdentityMode:'identified'});
  for(const table of ['participations','ballots','comments']) {
    const trigger=`test_v05_fail_${table}`;
    await sql(`CREATE TRIGGER ${trigger} BEFORE INSERT ON ${table} WHEN NEW.poll_id='${failing.poll.id}' BEGIN SELECT RAISE(ABORT,'TEST_FAILURE'); END;`);
    const input={pollId:failing.poll.id,choiceId:failing.poll.definition.choices[0].id,actionId:createVoteActionId(),displayName:'Pseudo fictif',comment:'Texte fictif'};
    await reject(adapter.castVote(input),'RELAY_UNAVAILABLE');
    assert.deepEqual(await failing.counts(),{ballots:0,comments:0,participations:0,locked:0});checks++;
    await sql(`DROP TRIGGER ${trigger}`);
    await adapter.castVote(input);await adapter.castVote(input);
    assert.deepEqual(await failing.counts(),{ballots:1,comments:1,participations:1,locked:1});checks++;
    // Nouvelle préparation de la même fixture pour chaque injection, sans contourner le verrouillage en production.
    await sql(`DELETE FROM ballots WHERE poll_id='${failing.poll.id}'; DELETE FROM participations WHERE poll_id='${failing.poll.id}'; UPDATE polls SET locked=0 WHERE poll_id='${failing.poll.id}';`);
  }
  const closed=await setup({resultRules:{minimumResponses:1,releaseMode:'closed'}});await closed.vote({comment:'À approuver'});
  const closedComment=(await adapter.getParticipations({...await closed.auth(),cursor:null})).entries[0].comment;
  await adapter.updateCommentStatus({...await closed.auth(),commentId:closedComment.commentId,expectedCommentRevision:1,moderationStatus:'visible'});
  ok(!('comments' in (await adapter.getPoll({pollId:closed.poll.id})).results));await adapter.closePoll(await closed.auth());
  ok((await adapter.getResults({pollId:closed.poll.id})).comments.count===1);
  await adapter.deletePoll(await identified.auth());
  const deleted=await identified.counts();ok(deleted.ballots===0&&deleted.comments===0&&deleted.participations===0);
  for(const method of ['getPoll','getResults','getParticipations'])await reject(adapter[method]({pollId:identified.poll.id,adminCapability:createAdminCapability(),cursor:null}),'NOT_FOUND');
  return checks;
}
