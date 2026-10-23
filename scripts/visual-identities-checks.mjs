import assert from 'node:assert/strict';
import {createSpaceCredential} from '../shared/spaces.js';
import {createPoll} from '../shared/poll-engine.js';
import {emptyState,semanticHash} from '../shared/model.js';
import {MEMBER_VISUAL_IDS,GROUP_VISUAL_IDS} from '../shared/visual-ids.js';
export async function visualIdentitiesChecks({adapter,sql}){
 assert.ok(adapter.baseUrl.startsWith('http://127.0.0.1:'),'Fixtures exclusivement locales.');
 let checks=0,revision=0;const spaceId=crypto.randomUUID(),staff=createSpaceCredential('staff'),groupId=crypto.randomUUID(),memberId=crypto.randomUUID(),card=createSpaceCredential('member');
 const ok=v=>{assert.ok(v);checks++;},call=(command,input,credential=staff)=>adapter.spaceCommand({command,input,credential,...(command==='createSpace'?{humanVerificationToken:`voti-local-test.${Date.now()}.${crypto.randomUUID()}`}:{})}),fresh=async()=>{const v=await call('getSpace',{spaceId});revision=v.revision;return v;};
 await call('createSpace',{spaceId,name:'Fixtures identités visuelles',expectedRevision:0});await fresh();
 await call('createGroup',{spaceId,groupId,name:'Lieu fictif',expectedRevision:revision});await fresh();
 await call('createMember',{spaceId,memberId,displayName:'Membre fictif',groupIds:[groupId],memberCredential:card,expectedRevision:revision});let v=await fresh();ok(v.groups[0].visual_id===null&&v.members[0].visual_id===null);
 const legacyView=await call('getSpace',{spaceId,includeVisuals:false});ok(!Object.hasOwn(legacyView.members[0],'visual_id')&&!Object.hasOwn(legacyView.groups[0],'visual_id'));
 const raw=await fetch(adapter.baseUrl+'/api/v1/spaces/getSpace',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+staff},body:JSON.stringify({input:{spaceId}})});const old=await raw.json();ok(raw.ok&&!Object.hasOwn(old.members[0],'visual_id')&&!Object.hasOwn(old.groups[0],'visual_id'));
 const update=async id=>{await call('updateMember',{spaceId,memberId,displayName:'Membre fictif',groupIds:[groupId],visualId:id,expectedRevision:revision});return fresh();};
 for(const id of [MEMBER_VISUAL_IDS.find(x=>x.includes('creature')),MEMBER_VISUAL_IDS[0],MEMBER_VISUAL_IDS[6]]){v=await update(id);ok(v.members[0].visual_id===id);ok((await call('getMemberHome',{},card)).visualId===id);}
 const saved=v.members[0].visual_id;await call('updateMember',{spaceId,memberId,displayName:'Renommé fictif',groupIds:[groupId],expectedRevision:revision});v=await fresh();ok(v.members[0].visual_id===saved);
 const other=new adapter.constructor({relayId:adapter.relayId,baseUrl:adapter.baseUrl});ok((await other.spaceCommand({command:'getSpace',input:{spaceId},credential:staff})).members[0].visual_id===saved);
 for(const invalid of ['inconnu',GROUP_VISUAL_IDS[0],'https://example.invalid/photo.webp','data:image/webp;base64,AAAA']){await assert.rejects(update(invalid),{code:'INVALID_REQUEST'});checks++;}
 v=await update(null);ok(v.members[0].visual_id===null);
 for(const visualId of [GROUP_VISUAL_IDS[0],GROUP_VISUAL_IDS[1],null]){await call('renameGroup',{spaceId,groupId,name:'Lieu fictif',visualId,expectedRevision:revision});v=await fresh();ok(v.groups[0].visual_id===visualId);}
 // Validation serveur réelle : contourner volontairement la validation du client.
 for(const [command,fields]of [['updateMember',{memberId,displayName:'Membre fictif',groupIds:[],visualId:GROUP_VISUAL_IDS[0]}],['renameGroup',{groupId,name:'Lieu fictif',visualId:MEMBER_VISUAL_IDS[0]}]]){const res=await fetch(adapter.baseUrl+'/api/v1/spaces/'+command,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+staff},body:JSON.stringify({input:{spaceId,expectedRevision:revision,...fields}})});ok(res.status===400);ok((await res.json()).error.code==='INVALID_REQUEST');}
 await assert.rejects(call('renameGroup',{spaceId,groupId,name:'Refus',visualId:GROUP_VISUAL_IDS[0],expectedRevision:revision-1}),{code:'REVISION_CONFLICT'});checks++;
 await assert.rejects(call('getSpace',{spaceId},card),{code:'INVALID_CAPABILITY'});checks++;
 const extraGroup=crypto.randomUUID(),creator=createSpaceCredential('staff');await call('createGroup',{spaceId,groupId:extraGroup,name:'Groupe hors périmètre fictif',visualId:GROUP_VISUAL_IDS[2],expectedRevision:revision});await fresh();
 await call('createAccess',{spaceId,accessId:crypto.randomUUID(),role:'creator',groupIds:[groupId],staffCredential:creator,expectedRevision:revision});await fresh();
 const scoped=await call('getSpace',{spaceId},creator);ok(scoped.groups.length===1&&scoped.groups[0].group_id===groupId&&scoped.members.length===0);
 await assert.rejects(call('renameGroup',{spaceId,groupId,name:'Refus',visualId:GROUP_VISUAL_IDS[1],expectedRevision:revision},creator),{code:'ACCESS_DENIED'});checks++;
 await assert.rejects(call('updateMember',{spaceId,memberId,displayName:'Refus',groupIds:[],visualId:MEMBER_VISUAL_IDS[0],expectedRevision:revision},card),{code:'INVALID_CAPABILITY'});checks++;
 const rows=async q=>(await sql(q))[0].results;ok((await rows("SELECT count(*) n FROM d1_migrations WHERE name='0005_visual_identities.sql'"))[0].n===1);
 for(const table of ['space_members','groups']){const col=(await rows('PRAGMA table_info('+table+')')).find(c=>c.name==='visual_id');ok(col.type==='TEXT'&&col.notnull===0);}
 for(const table of ['ballots','comments','poll_member_eligibility'])ok(!(await rows('PRAGMA table_info('+table+')')).some(c=>c.name.includes('visual')));
 // Preuve avec des profils réellement illustrés : l'ID ne voyage pas dans le vote.
 await fresh();await update(MEMBER_VISUAL_IDS[0]);const secondId=crypto.randomUUID(),secondCard=createSpaceCredential('member');
 await call('createMember',{spaceId,memberId:secondId,displayName:'Second fictif',groupIds:[groupId],memberCredential:secondCard,visualId:MEMBER_VISUAL_IDS[12],expectedRevision:revision});await fresh();
 const poll=createPoll(emptyState(),{question:'Vote anonyme illustré fictif',choices:['Oui','Non']}).polls[0];poll.resultRules.minimumResponses=2;
 const prepared=await call('prepareSpacePublication',{spaceId,poll,pollAudience:{spaceId,mode:'groups',groupIds:[groupId],resultsAudience:'poll_audience'},expectedRevision:revision});await call('publishSpacePoll',{pollId:poll.id,expectedRevision:prepared.revision});
 const current=(await call('getSpacePoll',{pollId:poll.id})).poll,submission={pollId:poll.id,actionId:crypto.randomUUID(),choiceId:poll.definition.choices[0].id,comment:'Avis fictif sans identité',expectedDefinitionHash:await semanticHash(current)};
 await call('castMemberVote',submission,card);await call('castMemberVote',{...submission,actionId:crypto.randomUUID()},secondCard);
 const a=await call('getPollAttendance',{pollId:poll.id});ok(a.identityMode==='anonymous'&&a.members===null&&a.consumed===2&&a.eligible===2);
 const b=await rows(`SELECT * FROM ballots WHERE poll_id='${poll.id}'`),c=await rows(`SELECT * FROM comments WHERE poll_id='${poll.id}'`);ok(b.length===2&&c.length===2&&b.every(r=>r.participation_id===null)&&c.every(r=>r.participation_id===null));
 ok((await rows(`SELECT count(*) n FROM participations WHERE poll_id='${poll.id}'`))[0].n===0);ok((await rows(`SELECT count(*) n FROM member_participations WHERE poll_id='${poll.id}'`))[0].n===0);
 const publicResult=await call('getMemberResults',{pollId:poll.id},card);ok(publicResult.results.available&&publicResult.results.totalBallots===2);
 for(const id of [...MEMBER_VISUAL_IDS,...GROUP_VISUAL_IDS])ok(!JSON.stringify({b,c,publicResult}).includes(id));
 await fresh();await update(MEMBER_VISUAL_IDS[1]);ok((await call('castMemberVote',submission,card)).receipt.alreadyAccepted);
 await assert.rejects(call('castMemberVote',{...submission,actionId:crypto.randomUUID()},card),{code:'ALREADY_PARTICIPATED'});checks++;
 ok((await rows(`SELECT count(*) n FROM ballots WHERE poll_id='${poll.id}'`))[0].n===2);
 ok((await rows('PRAGMA quick_check'))[0].quick_check==='ok');ok((await rows('PRAGMA foreign_key_check')).length===0);
 console.log(`Identités visuelles D1 local : ${checks} contrôles (NULL, IDs, serveur 400, CAS, anciennes projections, seconde session, intégrité).`);return checks;
}
