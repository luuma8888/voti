import assert from 'node:assert/strict';
import {createSpaceCredential} from '../shared/spaces.js';
import {createPoll} from '../shared/poll-engine.js';
import {emptyState,semanticHash} from '../shared/model.js';
export async function voteModesChecks({adapter,sql}){
 let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},reject=async(p,code)=>{await assert.rejects(p,{code});checks++;};
 const staff=createSpaceCredential('staff'),spaceId=crypto.randomUUID();
 const call=(command,input,credential=staff)=>adapter.spaceCommand({command,input,credential,...(command==='createSpace'?{humanVerificationToken:`voti-local-test.${Date.now()}.${crypto.randomUUID()}`}:{})});
 await call('createSpace',{spaceId,name:'Modes entièrement fictifs',expectedRevision:0});const revision=async()=>(await call('getSpace',{spaceId})).revision;
 const members=[];for(let i=0;i<3;i++){const memberId=crypto.randomUUID(),card=createSpaceCredential('member');await call('createMember',{spaceId,memberId,displayName:'Membre fictif '+i,groupIds:[],memberCredential:card,expectedRevision:await revision()});members.push({memberId,card});}
 assert.deepEqual(await call('getVoteModes',{spaceId}),{kind:'voteModes',version:1});checks++;
 await reject(call('getVoteModes',{spaceId},members[0].card),'INVALID_CAPABILITY');
 for(const [mode,rule,limit]of [['multiple_choice','up_to',5],['multiple_choice','exact',4],['ranked_choice','up_to',5],['ranked_choice','exact',2],['ranked_choice','all',6]]){
  const p=createPoll(emptyState(),{question:'Quel choix fictif ?',choices:['A','B','C','D','E','F'],commentMode:mode==='multiple_choice'&&rule==='up_to'?'optional':'disabled',commentVisibility:'public_with_results'}).polls[0];p.definition.mode=mode;p.definition.voteConfig={version:1,rule,limit};p.resultRules.minimumResponses=2;
  const audience={spaceId,mode:'space',groupIds:[],resultsAudience:'poll_audience'};
  const prep=await call('prepareSpacePublication',{spaceId,poll:p,pollAudience:audience,expectedRevision:await revision()});await call('publishSpacePoll',{pollId:p.id,expectedRevision:prep.revision});
  const poll=(await call('getSpacePoll',{pollId:p.id})).poll,ids=p.definition.choices.map(c=>c.id),hash=await semanticHash(poll),length=rule==='up_to'?(mode==='ranked_choice'?3:2):limit;
  const payload={pollId:p.id,actionId:crypto.randomUUID(),selectionIds:ids.slice(0,length),comment:p.definition.commentMode==='optional'?'Commentaire fictif':null,expectedDefinitionHash:hash};
  for(const selectionIds of [[],[ids[0],ids[0]],[crypto.randomUUID()],...(rule==='exact'?[ids.slice(0,limit-1)]:[]),...(rule==='up_to'?[ids]:[])])await reject(call('castMemberBallot',{...payload,selectionIds},members[0].card),selectionIds.length===0?'INVALID_REQUEST':'INVALID_CHOICE');
  await reject(call('castMemberBallot',{...payload,limit:1},members[0].card),'INVALID_REQUEST');
  await reject(call('castMemberVote',{pollId:p.id,actionId:crypto.randomUUID(),choiceId:ids[0],comment:null,expectedDefinitionHash:hash},members[0].card),'INVALID_REQUEST');
  const race=await Promise.allSettled([call('castMemberBallot',payload,members[0].card),call('castMemberBallot',{...payload,actionId:crypto.randomUUID()},members[0].card)]);ok(race.filter(r=>r.status==='fulfilled').length===1,'une seule transaction gagnante');
  const accepted=race[0].status==='fulfilled';if(accepted)ok((await call('castMemberBallot',payload,members[0].card)).receipt.alreadyAccepted,'reprise idempotente');
  let current=(await call('getSpacePoll',{pollId:p.id})).poll;ok(current.locked&&!current.results.available,'verrouillage, minimum sur participants');
  await reject(call('updateSpacePoll',{pollId:p.id,definition:poll.definition,resultRules:poll.resultRules,pollAudience:audience,expectedRevision:current.remoteRef.revision}),'POLL_LOCKED');
  await call('castMemberBallot',{...payload,actionId:crypto.randomUUID()},members[1].card);
  current=(await call('getSpacePoll',{pollId:p.id})).poll;ok(current.results.available&&current.results.totalBallots===2,'deux bulletins, pas six participations');
  if(mode==='ranked_choice')ok(current.results.choices[0].points===2*limit,'K serveur conservé');else ok(current.results.choices.filter(c=>c.count===2).length===length,'poids identique');
  if(p.definition.commentMode==='optional'){
    const comments=await adapter.getParticipations({pollId:p.id,adminCapability:staff,cursor:null});ok(comments.entries.length===2&&comments.entries.every(e=>e.choiceId===null&&!e.selectionIds&&!e.displayName),'commentaires anonymes sans choix individuel');
    await adapter.updateCommentStatus({pollId:p.id,adminCapability:staff,expectedRevision:current.remoteRef.revision,commentId:comments.entries[0].comment.commentId,expectedCommentRevision:1,moderationStatus:'visible'});
    current=(await call('getSpacePoll',{pollId:p.id})).poll;ok(current.results.comments.items.every(c=>c.choiceId===null),'commentaires publics sans ancrage individuel');
  }
  const attendance=await call('getPollAttendance',{pollId:p.id});ok(attendance.consumed===2&&attendance.members===null,'suivi agrégé anonyme');
  const privacy=(await sql(`SELECT (SELECT count(*) FROM participations WHERE poll_id='${p.id}') n,(SELECT count(*) FROM member_participations WHERE poll_id='${p.id}') linked,(SELECT count(*) FROM ballots WHERE poll_id='${p.id}') ballots`))[0].results[0];ok(privacy.n===0&&privacy.linked===0&&privacy.ballots===2,'pas de lien nominatif ajouté');
  const replacement=createSpaceCredential('member');await call('rotateMemberCard',{spaceId,memberId:members[0].memberId,memberCredential:replacement,expectedRevision:await revision()});members[0].card=replacement;
  await reject(call('castMemberBallot',{...payload,actionId:crypto.randomUUID()},replacement),'ALREADY_PARTICIPATED');
  await adapter.closePoll({pollId:p.id,adminCapability:staff,expectedRevision:current.remoteRef.revision});await reject(call('castMemberBallot',{...payload,actionId:crypto.randomUUID()},members[2].card),'POLL_CLOSED');
 }
 // La variante identifiée reste explicite, avec bulletin complet pour sa gestion autorisée.
 const named=createPoll(emptyState(),{question:'Classement identifié fictif',choices:['A','B','C','D'],participationIdentityMode:'identified'}).polls[0];named.definition.mode='ranked_choice';named.definition.voteConfig={version:1,limit:4,rule:'all'};named.resultRules.minimumResponses=2;
 const restricted={spaceId,mode:'space',groupIds:[],resultsAudience:'admins_only'};
 const prepared=await call('prepareSpacePublication',{spaceId,poll:named,pollAudience:restricted,expectedRevision:await revision()});await call('publishSpacePoll',{pollId:named.id,expectedRevision:prepared.revision});
 const namedPoll=(await call('getSpacePoll',{pollId:named.id})).poll,namedIds=named.definition.choices.map(c=>c.id),namedHash=await semanticHash(namedPoll);
 for(const member of members.slice(0,2)){const receipt=(await call('castMemberBallot',{pollId:named.id,actionId:crypto.randomUUID(),selectionIds:namedIds,comment:'Commentaire fictif',expectedDefinitionHash:namedHash},member.card)).receipt;ok(!receipt.results.available,'aucun résultat réservé dans reçu membre');}
 const roster=await call('getPollAttendance',{pollId:named.id});ok(roster.members.filter(m=>m.selectionIds?.length===4).length===2,'classement complet dans le suivi identifié autorisé');
 const participation=await adapter.getParticipations({pollId:named.id,adminCapability:staff,cursor:null});ok(participation.entries.length===2&&participation.entries.every(e=>e.selectionIds.length===4),'participations identifiées complètes');
 await reject(call('getMemberResults',{pollId:named.id},members[0].card),'ACCESS_DENIED');
 const namedResults=(await call('getSpacePoll',{pollId:named.id})).poll.results;ok(namedResults.available&&namedResults.choices[0].points===8,'barème complet 4/3/2/1 serveur');
 // Une modification de quota avant premier vote doit suivre le parcours CAS existant.
 const changed=createPoll(emptyState(),{question:'Révision fictive',choices:['A','B','C'],commentMode:'disabled'}).polls[0];changed.definition.mode='multiple_choice';changed.definition.voteConfig={version:1,limit:3,rule:'up_to'};
 const audience={spaceId,mode:'space',groupIds:[],resultsAudience:'poll_audience'};
 const prepChanged=await call('prepareSpacePublication',{spaceId,poll:changed,pollAudience:audience,expectedRevision:await revision()});await call('publishSpacePoll',{pollId:changed.id,expectedRevision:prepChanged.revision});
 const before=(await call('getSpacePoll',{pollId:changed.id})).poll,oldHash=await semanticHash(before),definition=structuredClone(before.definition);definition.voteConfig.limit=2;
 await call('updateSpacePoll',{pollId:changed.id,definition,resultRules:before.resultRules,pollAudience:audience,expectedRevision:before.remoteRef.revision});
 await reject(call('castMemberBallot',{pollId:changed.id,actionId:crypto.randomUUID(),selectionIds:changed.definition.choices.map(c=>c.id),comment:null,expectedDefinitionHash:oldHash},members[0].card),'REVISION_CONFLICT');
 ok((await call('getPollAttendance',{pollId:changed.id})).consumed===0,'révision refusée avant consommation');
 console.log('Modes expérimentaux Worker/D1 : '+checks+' contrôles réussis.');return checks;
}
