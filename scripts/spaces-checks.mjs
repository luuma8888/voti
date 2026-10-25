import assert from 'node:assert/strict';
import {createSpaceCredential,spaceCredentialDigest} from '../shared/spaces.js';
import {createPoll} from '../shared/poll-engine.js';
import {emptyState,semanticHash} from '../shared/model.js';

/** Fixtures intégralement fictives, HTTP + vrais COUNT/contraintes D1 locaux. */
export async function spacesChecks({adapter,sql}) {
  let checks=0;const ok=(v,message)=>{assert.ok(v,message);checks++;};
  const reject=async(p,code)=>{await assert.rejects(p,{code});checks++;};
  const rows=async q=>(await sql(q))[0].results;
  const spaceId=crypto.randomUUID(),staff=createSpaceCredential('staff');
  const call=(command,input,credential=staff,extras={})=>adapter.spaceCommand({command,input,credential,...extras}).catch(error=>{error.testOperation=command;throw error;});
  let view=await call('createSpace',{spaceId,name:'Espace entièrement fictif',expectedRevision:0},staff,{humanVerificationToken:`voti-local-test.${Date.now()}.${crypto.randomUUID()}`});ok(view.access.role==='admin');
  const fresh=async()=>{view=await call('getSpace',{spaceId});return view.revision;};
  const groups=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
  for(const [i,groupId]of groups.entries())await call('createGroup',{spaceId,groupId,name:'Groupe fictif '+i,expectedRevision:await fresh()});
  await reject(call('renameSpace',{spaceId,name:'Conflit',expectedRevision:1}),'REVISION_CONFLICT');
  const members=[];
  async function member(index=members.length){
    const item={memberId:crypto.randomUUID(),card:createSpaceCredential('member')};
    await call('createMember',{spaceId,memberId:item.memberId,displayName:'Pseudo fictif '+index,groupIds:[groups[0]],memberCredential:item.card,expectedRevision:await fresh()});members.push(item);return item;
  }
  for(let i=0;i<10;i++)await member();
  ok((await call('getMemberHome',{},members[0].card)).displayName==='Pseudo fictif 0');
  await reject(call('getSpace',{spaceId},members[0].card),'INVALID_CAPABILITY');
  await reject(call('getMemberHome',{},staff),'INVALID_CAPABILITY');
  const creator=createSpaceCredential('staff'),accessId=crypto.randomUUID();
  await call('createAccess',{spaceId,accessId,role:'creator',groupIds:[groups[0]],staffCredential:creator,expectedRevision:await fresh()});
  // Recommandation de minimum : lecture agrégée, sans noms ni mutation de révision.
  const size=(ids=[],credential=staff)=>call('getAudienceSize',{spaceId,pollAudience:{spaceId,mode:ids.length?'groups':'space',groupIds:ids,resultsAudience:'poll_audience'}},credential);
  await call('updateMember',{spaceId,memberId:members[0].memberId,displayName:'Pseudo fictif 0',groupIds:[groups[0],groups[1]],expectedRevision:await fresh()});
  const beforeSize=await fresh();assert.deepEqual(await size(),{kind:'audienceSize',eligible:10});checks++;
  ok((await size([groups[0],groups[1]])).eligible===10,'union sans double comptage');ok((await size([groups[2]])).eligible===0,'audience vide');
  ok((await size([groups[0]],creator)).eligible===10,'créateur : agrégat autorisé, sans roster');
  await reject(size([groups[1]],creator),'ACCESS_DENIED');await reject(size([],creator),'ACCESS_DENIED');await reject(size([],members[0].card),'INVALID_CAPABILITY');
  ok((await fresh())===beforeSize,'lecture sans modification de l’Espace');
  async function prepare({identity='anonymous',release='threshold',minimum=1,audienceGroup=groups[0],credential=staff,resultsAudience='poll_audience'}={}){
    const poll=createPoll(emptyState(),{question:'Sondage Espace fictif',choices:['Oui','Non'],participationIdentityMode:identity,commentVisibility:'public_with_results'}).polls[0];poll.resultRules.minimumResponses=minimum;poll.resultRules.releaseMode=release;
    const prep=await call('prepareSpacePublication',{spaceId,poll,pollAudience:{spaceId,mode:'groups',groupIds:[audienceGroup],resultsAudience},expectedRevision:await fresh()},credential);
    return{poll,prep};
  }
  await reject(prepare({audienceGroup:groups[1],credential:creator}),'ACCESS_DENIED');
  const initial=await prepare({credential:creator});
  await call('publishSpacePoll',{pollId:initial.poll.id,expectedRevision:initial.prep.revision},creator);checks++;
  await reject(adapter.getPoll({pollId:initial.poll.id}),'MEMBER_CARD_REQUIRED');
  await reject(adapter.castVote({pollId:initial.poll.id,choiceId:initial.poll.definition.choices[0].id,actionId:crypto.randomUUID()}),'MEMBER_CARD_REQUIRED');
  const eleventh=await member();
  const attendance=await call('getPollAttendance',{pollId:initial.poll.id});ok(attendance.eligible===10&&attendance.members===null);
  await reject(call('getMemberPoll',{pollId:initial.poll.id},eleventh.card),'NOT_ELIGIBLE');
  const vote=async(poll,item,extra={})=>call('castMemberVote',{pollId:poll.id,actionId:crypto.randomUUID(),choiceId:poll.definition.choices[0].id,comment:'Commentaire entièrement fictif',expectedDefinitionHash:await semanticHash((await call('getSpacePoll',{pollId:poll.id})).poll),...extra},item.card);
  const submission={pollId:initial.poll.id,actionId:crypto.randomUUID(),choiceId:initial.poll.definition.choices[0].id,comment:'Fictif',expectedDefinitionHash:await semanticHash((await call('getSpacePoll',{pollId:initial.poll.id})).poll)};
  const otherSubmission={...submission,actionId:crypto.randomUUID(),comment:'Seconde requête entièrement fictive'};
  const race=await Promise.allSettled([call('castMemberVote',submission,members[0].card),call('castMemberVote',otherSubmission,members[0].card)]);
  ok(race.filter(r=>r.status==='fulfilled').length===1);ok(race.some(r=>r.status==='rejected'&&r.reason.code==='ALREADY_PARTICIPATED'));
  const accepted=race[0].status==='fulfilled'?submission:otherSubmission;
  ok((await call('castMemberVote',accepted,members[0].card)).receipt.alreadyAccepted);
  ok((await call('getPollAttendance',{pollId:initial.poll.id})).consumed===1);
  const privacy=(await rows(`SELECT (SELECT count(*) FROM ballots WHERE poll_id='${initial.poll.id}') ballots,
    (SELECT count(*) FROM participations WHERE poll_id='${initial.poll.id}') participations,
    (SELECT count(*) FROM member_participations WHERE poll_id='${initial.poll.id}') member_links,
    (SELECT count(*) FROM comments WHERE poll_id='${initial.poll.id}' AND participation_id IS NOT NULL) named_comments,
    (SELECT count(*) FROM ballots WHERE poll_id='${initial.poll.id}' AND participation_id IS NOT NULL) named_ballots`))[0];
  assert.deepEqual(privacy,{ballots:1,participations:0,member_links:0,named_comments:0,named_ballots:0});checks++;
  const eligibilityColumns=await rows('PRAGMA table_info(poll_member_eligibility)');assert.deepEqual(eligibilityColumns.map(c=>c.name),['poll_id','member_id','consumed']);checks++;
  ok(!(await call('getPollAttendance',{pollId:initial.poll.id})).members);
  const oldCard=members[0].card,newCard=createSpaceCredential('member');
  await call('rotateMemberCard',{spaceId,memberId:members[0].memberId,memberCredential:newCard,expectedRevision:await fresh()});members[0].card=newCard;
  await reject(call('getMemberHome',{},oldCard),'INVALID_CAPABILITY');await reject(vote(initial.poll,members[0]),'ALREADY_PARTICIPATED');
  const named=await prepare({identity:'identified',release:'all_eligible',minimum:1});await call('publishSpacePoll',{pollId:named.poll.id,expectedRevision:0});
  await vote(named.poll,members[1]);
  const roster=await call('getPollAttendance',{pollId:named.poll.id});ok(roster.members.length===11&&roster.members.filter(m=>m.consumed).length===1);
  ok(roster.members.find(m=>m.member_id===members[1].memberId).choice_id===named.poll.definition.choices[0].id);
  await reject(call('getMemberResults',{pollId:named.poll.id},members[1].card),'RESULTS_LOCKED');
  for(const table of ['participations','member_participations','ballots','comments']){
    const failing=await prepare({identity:'identified'});await call('publishSpacePoll',{pollId:failing.poll.id,expectedRevision:0});
    await rows(`CREATE TRIGGER v06_fail_${table} BEFORE INSERT ON ${table} WHEN NEW.poll_id='${failing.poll.id}' BEGIN SELECT RAISE(ABORT,'fixture_failure'); END`);
    await reject(vote(failing.poll,members[2]),'RELAY_UNAVAILABLE');
    const count=(await rows(`SELECT (SELECT count(*) FROM ballots WHERE poll_id='${failing.poll.id}') ballots,
      (SELECT count(*) FROM comments WHERE poll_id='${failing.poll.id}') comments,(SELECT count(*) FROM participations WHERE poll_id='${failing.poll.id}') participations,
      (SELECT count(*) FROM member_participations WHERE poll_id='${failing.poll.id}') member_links,
      (SELECT sum(consumed) FROM poll_member_eligibility WHERE poll_id='${failing.poll.id}') consumed`))[0];
    assert.deepEqual(count,{ballots:0,comments:0,participations:0,member_links:0,consumed:0});checks++;await rows(`DROP TRIGGER v06_fail_${table}`);
  }
  const invitation=createSpaceCredential('invitation');await call('createInvitation',{spaceId,invitationId:crypto.randomUUID(),groupIds:[groups[0]],maxUses:1,expiresInDays:1,invitationCredential:invitation,expectedRevision:await fresh()});
  const join={memberId:crypto.randomUUID(),displayName:'Invité fictif',memberCredential:createSpaceCredential('member')};
  await call('acceptInvitation',join,invitation);await call('acceptInvitation',join,invitation);checks++;
  await reject(call('acceptInvitation',{...join,memberId:crypto.randomUUID(),memberCredential:createSpaceCredential('member')},invitation),'INVITATION_EXHAUSTED');
  const secret=(await rows(`SELECT credential_digest FROM member_credentials WHERE member_id='${join.memberId}'`))[0];
  ok(secret.credential_digest===await spaceCredentialDigest(adapter.relayId,'member',join.memberCredential));
  // Petite audience stable pour éprouver toutes les conditions de résultats sur D1.
  for(const m of members.slice(0,3))await call('updateMember',{spaceId,memberId:m.memberId,displayName:'Emma fictive',groupIds:[groups[0],groups[1]],expectedRevision:await fresh()});
  const groupThree=async options=>{const item=await prepare({audienceGroup:groups[1],...options});await call('publishSpacePoll',{pollId:item.poll.id,expectedRevision:0});return item.poll;};
  const currentPoll=async poll=>(await call('getSpacePoll',{pollId:poll.id})).poll;
  for(const release of ['threshold','all_eligible','closed','all_eligible_or_closed']){
    const p=await groupThree({release,minimum:2});
    await reject(call('getMemberPoll',{pollId:p.id},members[3].card),'NOT_ELIGIBLE');
    await vote(p,members[0]);ok(!(await currentPoll(p)).results.available,'minimum obligatoire');
    await vote(p,members[1]);ok((await currentPoll(p)).results.available===(release==='threshold'),'2/3 : résultat selon mode');
    const before=(await currentPoll(p)).remoteRef.revision;
    await adapter.closePoll({pollId:p.id,adminCapability:staff,expectedRevision:before});
    ok((await currentPoll(p)).results.available===(release!=='all_eligible'),'fermeture ne remplace pas tous les éligibles');
    await reject(vote(p,members[2]),'POLL_CLOSED');
  }
  const all=await groupThree({release:'all_eligible',minimum:3});for(const m of members.slice(0,3))await vote(all,m);
  ok((await call('getMemberResults',{pollId:all.id},members[2].card)).results.totalBallots===3);
  const high=await groupThree({release:'all_eligible_or_closed',minimum:5});await vote(high,members[0]);let highView=await currentPoll(high);await adapter.closePoll({pollId:high.id,adminCapability:staff,expectedRevision:highView.remoteRef.revision});ok(!(await currentPoll(high)).results.available,'fermer sous plancher ne publie rien');
  // Réserve humaine v0.6 : snapshot 1 et minimum 2, même après tous/fermeture.
  await call('updateMember',{spaceId,memberId:members[0].memberId,displayName:'Emma fictive',groupIds:[groups[0],groups[1],groups[2]],expectedRevision:await fresh()});
  for(const release of ['all_eligible','closed','all_eligible_or_closed']){
    const single=await prepare({audienceGroup:groups[2],release,minimum:2}),id=single.poll.id;await call('publishSpacePoll',{pollId:id,expectedRevision:0});
    ok((await call('getPollAttendance',{pollId:id})).eligible===1,'snapshot exact : un membre');await vote(single.poll,members[0]);
    ok(!(await currentPoll(single.poll)).results.available,'1/1 ne contourne pas minimum 2');const before=await currentPoll(single.poll);await adapter.closePoll({pollId:id,adminCapability:staff,expectedRevision:before.remoteRef.revision});
    ok(!(await currentPoll(single.poll)).results.available,'fermeture à 1/1 ne contourne pas minimum 2');
    const stored=(await rows(`SELECT (SELECT count(*) FROM ballots WHERE poll_id='${id}') ballots,(SELECT count(*) FROM poll_member_eligibility WHERE poll_id='${id}' AND consumed=1) consumed,(SELECT count(*) FROM participations WHERE poll_id='${id}') identities`))[0];assert.deepEqual(stored,{ballots:1,consumed:1,identities:0});checks++;
  }
  const restricted=await groupThree({resultsAudience:'admins_only'});await vote(restricted,members[0]);
  ok(!(await call('getMemberPoll',{pollId:restricted.id},members[0].card)).poll.results.available);await reject(call('getMemberResults',{pollId:restricted.id},members[0].card),'ACCESS_DENIED');ok((await currentPoll(restricted)).results.available);
  const consent=await groupThree(),beforeConsent=await currentPoll(consent),oldHash=await semanticHash(beforeConsent);
  await call('updateSpacePoll',{pollId:consent.id,definition:{...beforeConsent.definition,privacy:'named',participationIdentityMode:'identified'},resultRules:beforeConsent.resultRules,pollAudience:beforeConsent.accessRules.pollAudience,expectedRevision:beforeConsent.remoteRef.revision});
  await reject(vote(consent,members[0],{expectedDefinitionHash:oldHash}),'REVISION_CONFLICT');
  for(const table of ['ballots','comments','participations','member_participations'])ok((await rows(`SELECT count(*) n FROM ${table} WHERE poll_id='${consent.id}'`))[0].n===0,'consentement périmé : aucune écriture '+table);
  ok((await call('getPollAttendance',{pollId:consent.id})).consumed===0);await vote(consent,members[0]);ok((await call('getPollAttendance',{pollId:consent.id})).consumed===1);
  const locked=await groupThree();const stale=await currentPoll(locked);await vote(locked,members[0]);
  const update={pollId:locked.id,definition:stale.definition,resultRules:stale.resultRules,pollAudience:stale.accessRules.pollAudience,expectedRevision:stale.remoteRef.revision};
  await reject(call('updateSpacePoll',update),'REVISION_CONFLICT');update.expectedRevision=(await currentPoll(locked)).remoteRef.revision;await reject(call('updateSpacePoll',update),'POLL_LOCKED');
  ok((await adapter.updateStyle({pollId:locked.id,adminCapability:staff,expectedRevision:update.expectedRevision,style:stale.style})).locked);
  await reject(call('getPollAttendance',{pollId:locked.id},creator),'ACCESS_DENIED');
  const double=await groupThree({identity:'identified'}),sameAction=crypto.randomUUID();await vote(double,members[0],{actionId:sameAction});await vote(double,members[1]);
  const doubleRoster=await call('getPollAttendance',{pollId:double.id});ok(doubleRoster.members.filter(m=>m.consumed&&m.display_name==='Emma fictive').length===2,'deux pseudonymes égaux acceptés');
  await call('updateMember',{spaceId,memberId:members[0].memberId,displayName:'Renommé fictif',groupIds:[groups[0],groups[1]],expectedRevision:await fresh()});
  ok((await vote(double,members[0],{actionId:sameAction})).receipt.alreadyAccepted,'retry après renommage');
  const adminPage=await adapter.getParticipations({pollId:double.id,adminCapability:staff,cursor:null});const c=adminPage.entries.find(e=>e.comment)?.comment;
  ok(Boolean(c));const doubleView=await currentPoll(double);await adapter.updateCommentStatus({pollId:double.id,adminCapability:staff,expectedRevision:doubleView.remoteRef.revision,commentId:c.commentId,expectedCommentRevision:c.revision,moderationStatus:'visible'});
  const publicResult=(await call('getMemberResults',{pollId:double.id},members[1].card)).results;
  ok(publicResult.comments.items.length===1&&!JSON.stringify(publicResult).includes('Emma fictive')&&!JSON.stringify(publicResult).includes('Renommé fictif'),'public : aucune identité');
  const beforeCount=publicResult.totalBallots;const afterMod=await currentPoll(double);await adapter.deleteComment({pollId:double.id,adminCapability:staff,expectedRevision:afterMod.remoteRef.revision,commentId:c.commentId,expectedCommentRevision:c.revision+1});ok((await currentPoll(double)).results.totalBallots===beforeCount);
  await call('revokeMemberCard',{spaceId,memberId:members[2].memberId,expectedRevision:await fresh()});await reject(call('getMemberHome',{},members[2].card),'INVALID_CAPABILITY');
  ok((await call('getPollAttendance',{pollId:all.id})).eligible===3,'snapshot conservé après révocation de carte');
  const expire=createSpaceCredential('invitation'),expireId=crypto.randomUUID();await call('createInvitation',{spaceId,invitationId:expireId,groupIds:[],maxUses:2,expiresInDays:1,invitationCredential:expire,expectedRevision:await fresh()});
  await rows(`UPDATE invitations SET expires_at=unixepoch()-1 WHERE invitation_id='${expireId}'`);await reject(call('acceptInvitation',{...join,memberId:crypto.randomUUID(),memberCredential:createSpaceCredential('member')},expire),'INVITATION_EXPIRED');
  const multi=createSpaceCredential('invitation'),multiId=crypto.randomUUID();await call('createInvitation',{spaceId,invitationId:multiId,groupIds:[groups[0],groups[1]],maxUses:2,expiresInDays:1,invitationCredential:multi,expectedRevision:await fresh()});
  for(let n=0;n<2;n++){const invited={memberId:crypto.randomUUID(),displayName:'Invité groupe fictif',memberCredential:createSpaceCredential('member')};await call('acceptInvitation',invited,multi);ok((await call('getMemberHome',{},invited.memberCredential)).groups.length===2);await reject(call('getMemberPoll',{pollId:all.id},invited.memberCredential),'NOT_ELIGIBLE');}
  await reject(call('acceptInvitation',{memberId:crypto.randomUUID(),displayName:'Invité fictif',memberCredential:createSpaceCredential('member')},multi),'INVITATION_EXHAUSTED');
  await call('closeInvitation',{spaceId,invitationId:multiId,expectedRevision:await fresh()});await reject(call('acceptInvitation',{memberId:crypto.randomUUID(),displayName:'Fictif',memberCredential:createSpaceCredential('member')},multi),'INVITATION_EXPIRED');
  const expiredDraft=await prepare();await rows(`UPDATE publications SET expires_at=unixepoch()-1 WHERE poll_id='${expiredDraft.poll.id}'`);await reject(call('getSpacePoll',{pollId:expiredDraft.poll.id}),'NOT_FOUND');ok(!(await call('getSpace',{spaceId})).polls.some(p=>p.pollId===expiredDraft.poll.id),'préparation expirée absente de la bibliothèque');
  const allGroups=[...groups];while(allGroups.length<20){const groupId=crypto.randomUUID();await call('createGroup',{spaceId,groupId,name:'Groupe limite fictif '+allGroups.length,expectedRevision:await fresh()});allGroups.push(groupId);}
  await call('updateMember',{spaceId,memberId:members[0].memberId,displayName:'Renommé fictif',groupIds:allGroups,expectedRevision:await fresh()});ok((await call('getMemberHome',{},members[0].card)).groups.length===20,'vingt groupes sans N+1');
  await reject(call('createGroup',{spaceId,groupId:crypto.randomUUID(),name:'Trop',expectedRevision:await fresh()}),'PAYLOAD_TOO_LARGE');
  const wide=createPoll(emptyState(),{question:'Union vingt groupes fictifs',choices:['A','B'],resultRules:{minimumResponses:1}}).polls[0];
  await call('prepareSpacePublication',{spaceId,poll:wide,pollAudience:{spaceId,mode:'groups',groupIds:allGroups,resultsAudience:'poll_audience'},expectedRevision:await fresh()});await call('publishSpacePoll',{pollId:wide.id,expectedRevision:0});
  const wideRoster=await call('getPollAttendance',{pollId:wide.id});ok(wideRoster.eligible>10&&wideRoster.members===null,'union multi-groupes figée sans doublons');
  const unique=(await rows(`SELECT count(*) n,count(DISTINCT member_id) unique_count FROM poll_member_eligibility WHERE poll_id='${wide.id}'`))[0];ok(unique.n===unique.unique_count);
  await call('revokeMember',{spaceId,memberId:eleventh.memberId,expectedRevision:await fresh()});await reject(call('getMemberHome',{},eleventh.card),'INVALID_CAPABILITY');ok((await call('getPollAttendance',{pollId:named.poll.id})).eligible===11,'révocation conserve le snapshot');
  ok((await rows('SELECT count(*) n FROM controlled_vote_guards'))[0].n===0,'garde transitoire vide');
  assert.deepEqual((await rows('PRAGMA table_info(participations)')).map(c=>c.name),['participation_id','poll_id','display_name']);checks++;
  ok((await rows(`SELECT count(*) n FROM poll_member_eligibility e JOIN member_participations p ON p.poll_id=e.poll_id AND p.member_id=e.member_id JOIN ballots b ON b.participation_id=p.participation_id WHERE e.poll_id='${all.id}'`))[0].n===0,'aucune jointure identité-bulletin anonyme');
  const namedBeforeDelete=await currentPoll(double);await adapter.deletePoll({pollId:double.id,adminCapability:staff,expectedRevision:namedBeforeDelete.remoteRef.revision});
  for(const table of ['ballots','comments','participations','member_participations','poll_member_eligibility','poll_audiences'])ok((await rows(`SELECT count(*) n FROM ${table} WHERE poll_id='${double.id}'`))[0].n===0,'cascade identified '+table);
  const spacePoll=await call('getSpacePoll',{pollId:initial.poll.id});
  await adapter.deletePoll({pollId:initial.poll.id,adminCapability:staff,expectedRevision:spacePoll.poll.remoteRef.revision});
  await reject(call('getMemberPoll',{pollId:initial.poll.id},members[1].card),'NOT_FOUND');
  ok((await rows(`SELECT count(*) n FROM poll_member_eligibility WHERE poll_id='${initial.poll.id}'`))[0].n===0);
  ok((await rows('SELECT count(*) n FROM mutation_guards'))[0].n===0);
  const adminAccess=(await call('getSpace',{spaceId})).staffAccesses.find(a=>a.role==='admin');await reject(call('revokeAccess',{spaceId,accessId:adminAccess.access_id,expectedRevision:await fresh()}),'ACCESS_DENIED');
  await call('archiveSpace',{spaceId,expectedRevision:await fresh()});ok((await call('getSpace',{spaceId})).status==='archived');await reject(call('getMemberHome',{},members[1].card),'INVALID_CAPABILITY');await reject(call('getSpace',{spaceId},creator),'INVALID_CAPABILITY');ok((await call('getSpacePoll',{pollId:wide.id})).poll.status==='published','historique archivé lisible seulement admin');
  return checks;
}
