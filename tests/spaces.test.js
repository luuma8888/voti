import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpaceCredential,isSpaceCredential,spaceCredentialDigest,TemporaryMemberSession,validatePollAudience,creatorAllowsAudience,snapshotMembers,groupResultsAvailable,buildMemberUrl,consumeMemberFragment,memberName,spaceName} from '../shared/spaces.js';
import {SpaceAccessStorage,decodeSpaceAccess} from '../web/space-storage.js';
import {removeLocalPoll} from '../shared/poll-deletion.js';
import {createPoll,publishPoll,castVote} from '../shared/poll-engine.js';
import {emptyState,semanticHash} from '../shared/model.js';
import {validateState,validatePoll} from '../shared/validation.js';
import {validateSpaceCommand,validateSpaceResponse} from '../shared/space-wire.js';
import {HttpRelayAdapter} from '../web/http-relay.js';
import {removeFromDevice} from '../web/local-deletion.js';

test('credentials système 256 bits, domaines distincts, jamais interchangeables',async()=>{
  const tokens=new Set();for(const kind of ['member','staff','invitation'])for(let i=0;i<20;i++){const token=createSpaceCredential(kind);tokens.add(token);assert.ok(isSpaceCredential(token,kind));assert.match(token,new RegExp('^voti-'+kind+'-v1\\.[a-f0-9]{64}$'));for(const other of ['member','staff','invitation'].filter(k=>k!==kind))assert.ok(!isSpaceCredential(token,other));assert.notEqual(await spaceCredentialDigest('a',kind,token),await spaceCredentialDigest('b',kind,token));}
  assert.equal(tokens.size,60);assert.throws(()=>createSpaceCredential('admin'));await assert.rejects(spaceCredentialDigest('a','staff',createSpaceCredential('member')),{code:'INVALID_CAPABILITY'});
});
test('session uniquement mémoire, oubli explicite et expiration maximale cinq minutes',()=>{
  let clock=0;const session=new TemporaryMemberSession({now:()=>clock}),token=createSpaceCredential('member');session.set(token);assert.equal(session.credential,token);assert.ok(!JSON.stringify(session).includes(token));clock=300000;assert.equal(session.credential,null);session.set(token);session.clear();assert.equal(session.credential,null);assert.throws(()=>session.set(createSpaceCredential('staff')));assert.throws(()=>new TemporaryMemberSession({ttl:300001}));
});
test('fragment membre expurgé avant tout traitement, QR sans identité ni credential adulte',()=>{
  const token=createSpaceCredential('member'),url=new URL(buildMemberUrl('https://example.test/voti/',token));const calls=[];
  assert.equal(consumeMemberFragment(url,{replaceState:(...args)=>calls.push(args)}),token);assert.equal(calls[0][2],'/voti/#/member');assert.equal(url.search,'');assert.ok(!url.href.includes('displayName'));
  const bad=new URL('https://example.test/voti/#/member/invalide');assert.throws(()=>consumeMemberFragment(bad,{replaceState:(...args)=>calls.push(args)}));assert.equal(calls[1][2],'/voti/#/member');
});
test('audience et créateur limité : A seulement, admin global, aucune Carte participant',()=>{
  const spaceId=crypto.randomUUID(),a=crypto.randomUUID(),b=crypto.randomUUID(),audience={spaceId,mode:'groups',groupIds:[a],resultsAudience:'poll_audience'},access={spaceId,status:'active',role:'creator',groupIds:[a]};
  validatePollAudience(audience);assert.ok(creatorAllowsAudience(access,audience));assert.ok(!creatorAllowsAudience(access,{...audience,groupIds:[b]}));assert.ok(!creatorAllowsAudience({...access,role:'participant'},audience));assert.ok(creatorAllowsAudience({...access,role:'admin',groupIds:null},audience));assert.throws(()=>validatePollAudience({...audience,groupIds:[a,a]}));
});
test('snapshot 10 puis 11 : copie figée, futurs snapshots 11, membres multi-groupes uniques',()=>{
  const spaceId=crypto.randomUUID(),groupId=crypto.randomUUID(),members=Array.from({length:10},()=>({spaceId,memberId:crypto.randomUUID(),status:'active'})),memberships=members.map(m=>({spaceId,memberId:m.memberId,groupId})),audience={spaceId,mode:'groups',groupIds:[groupId],resultsAudience:'poll_audience'};
  const snapshot=snapshotMembers(members,memberships,audience);members.push({spaceId,memberId:crypto.randomUUID(),status:'active'});memberships.push({spaceId,memberId:members[10].memberId,groupId});assert.equal(snapshot.length,10);assert.equal(snapshotMembers(members,memberships,audience).length,11);assert.ok(!snapshot.includes(members[10].memberId));
});
test('quatre modes de résultats : snapshot, fermeture et seuil restent obligatoires',()=>{
  for(const mode of ['threshold','closed','all_eligible','all_eligible_or_closed']){
    const rules={releaseMode:mode,minimumResponses:2};assert.equal(groupResultsAvailable('published',rules,1,3),false);
    assert.equal(groupResultsAvailable('published',rules,2,3),mode==='threshold');assert.equal(groupResultsAvailable('published',rules,3,3),mode!=='closed');
    assert.equal(groupResultsAvailable('closed',rules,2,3),mode!=='all_eligible');assert.equal(groupResultsAvailable('closed',{...rules,minimumResponses:5},3,3),false);
  }
});
test('capacités adultes seules persistables, conflit explicite, aucune carte ou identité stockée',async()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},locks={request:async(_key,fn)=>fn()},adapter=new SpaceAccessStorage(storage,locks);
  const access={relayId:'test',spaceId:crypto.randomUUID(),credential:createSpaceCredential('staff')};await adapter.put(access);assert.equal(adapter.list().length,1);
  await assert.rejects(adapter.put({...access,credential:createSpaceCredential('member')}),{code:'INVALID_CAPABILITY'});const replacement={...access,credential:createSpaceCredential('staff')};await assert.rejects(adapter.put(replacement),{code:'CAPABILITY_CONFLICT'});await adapter.put(replacement,access.credential);assert.equal(adapter.get(access.relayId,access.spaceId).credential,replacement.credential);
  assert.ok(![...map.values()].some(raw=>raw.includes('displayName')||raw.includes('voti-member-v1.')));
});
test('Poll v4 explicite, anciens hashes intacts, vote local de Groupe refusé',async()=>{
  const state=createPoll(emptyState(),{question:'Fictif',choices:['A','B']}),poll=structuredClone(state.polls[0]),oldHash=await semanticHash(poll),spaceId=crypto.randomUUID();
  poll.schemaVersion=4;poll.contextId=spaceId;poll.accessRules={audience:'context',requiresAccount:false,allowDirectChoiceQr:false,pollAudience:{spaceId,mode:'space',groupIds:[],resultsAudience:'poll_audience'}};poll.resultRules.releaseMode='all_eligible';
  validatePoll(poll);await assert.rejects(validateState({...emptyState(),polls:[poll]}),/réservé/);assert.equal(await semanticHash(state.polls[0]),oldHash);assert.notEqual(await semanticHash(poll),oldHash);
  await assert.rejects(castVote({...emptyState(),polls:[poll]},{id:crypto.randomUUID(),pollId:poll.id,choiceId:poll.definition.choices[0].id}),/Carte Voti/);
});
test('suppression locale : votes, commentaires, participations retirés, aucun réseau ou mutation source',async()=>{
  let state=createPoll(emptyState(),{question:'Fictif',choices:['A','B'],participationIdentityMode:'identified'});state=publishPoll(state,state.polls[0].id);const poll=state.polls[0];state=await castVote(state,{id:crypto.randomUUID(),pollId:poll.id,choiceId:poll.definition.choices[0].id,displayName:'Fictif',comment:'Fictif'});const before=structuredClone(state),after=removeLocalPoll(state,poll.id);for(const key of ['polls','ballots','comments','participations'])assert.equal(after[key].length,0);assert.deepEqual(state,before);await validateState(after);
});
test('textes Unicode/XSS restent texte brut, contrats refusent champs cachés et liste nominative anonyme',()=>{
  for(const text of ['Été 😊 العربية',"<script>alert('fictif')</script>",'<img onerror="fictif">'])assert.equal(memberName(text),text);
  assert.equal(spaceName(' Groupe fictif '),'Groupe fictif');assert.throws(()=>memberName(' '));assert.throws(()=>memberName('x'.repeat(61)));
  assert.throws(()=>validateSpaceCommand('getMemberHome',{memberId:crypto.randomUUID()}),{code:'INVALID_REQUEST'});
  assert.throws(()=>validateSpaceResponse({kind:'attendance',identityMode:'anonymous',consumed:1,eligible:2,members:[{displayName:'Fictif'}]}),{code:'RELAY_UNAVAILABLE'});
});
test('transport Espaces : Bearer seulement, aucune redirection/cookie, réponse liée à la requête',async()=>{
  const spaceId=crypto.randomUUID(),credential=createSpaceCredential('staff');let observed;
  const adapter=new HttpRelayAdapter({relayId:'test',baseUrl:'https://relay.example.test',fetchImpl:async(url,options)=>{observed={url,options};return Response.json({kind:'mutation',spaceId,revision:2});}});
  await adapter.spaceCommand({command:'renameSpace',input:{spaceId,name:'Fictif',expectedRevision:1},credential});
  assert.ok(!observed.url.includes(credential));assert.equal(observed.options.headers.Authorization,'Bearer '+credential);assert.equal(observed.options.credentials,'omit');assert.equal(observed.options.redirect,'error');
  assert.ok(!observed.options.body.includes(credential));
  adapter.fetchImpl=async()=>Response.json({kind:'mutation',spaceId:crypto.randomUUID(),revision:2});await assert.rejects(adapter.spaceCommand({command:'renameSpace',input:{spaceId,name:'Fictif',expectedRevision:1},credential}),{code:'RELAY_UNAVAILABLE'});
});
test('retrait appareil : nettoyage partiel ne bloque pas la copie, transaction refusée préserve tout',async()=>{
  const state=createPoll(emptyState(),{question:'Fictif',choices:['A','B']}),pollId=state.polls[0].id,seen=[];
  const input={pollId,repository:{transact:async fn=>fn(state)},posters:{remove:async()=>{seen.push('poster');throw new Error('fixture');}},connections:{delete:async()=>seen.push('connection')},contexts:{forget:()=>seen.push('context')},remoteViews:{delete:()=>seen.push('view')},connection:{relayId:'test'}};
  const result=await removeFromDevice(input);assert.equal(result.state.polls.length,0);assert.deepEqual(result.warnings,['design et médias locaux']);assert.deepEqual(seen,['poster','connection','context','view']);assert.equal(state.polls.length,1);
  seen.length=0;input.repository.transact=async()=>{throw new Error('fixture');};await assert.rejects(removeFromDevice(input));assert.deepEqual(seen,[]);
});
test('fichiers accès de gestion : version/relais/carte/champs refusés et erreurs sans contenu secret',()=>{
  const file={version:1,relayId:'test',spaceId:crypto.randomUUID(),credential:createSpaceCredential('staff')};assert.equal(decodeSpaceAccess(JSON.stringify(file),'test').spaceId,file.spaceId);
  for(const value of [{...file,version:2},{...file,relayId:'other'},{...file,credential:createSpaceCredential('member')},{...file,displayName:'Fictif'}])assert.throws(()=>decodeSpaceAccess(JSON.stringify(value),'test'),{code:'INVALID_CAPABILITY'});
  try{decodeSpaceAccess(file.credential,'test');assert.fail();}catch(error){assert.ok(!error.message.includes(file.credential));}
});
test('consentement : empreinte des règles affichées requise, style exclu et confidentialité incluse',async()=>{
  const poll=createPoll(emptyState(),{question:'Fictif',choices:['A','B']}).polls[0],hash=await semanticHash(poll);
  assert.equal(await semanticHash({...poll,style:{...poll.style,themeId:'peach'}}),hash);
  assert.notEqual(await semanticHash({...poll,definition:{...poll.definition,privacy:'named',participationIdentityMode:'identified'}}),hash);
  const input={pollId:poll.id,actionId:crypto.randomUUID(),choiceId:poll.definition.choices[0].id,comment:null,expectedDefinitionHash:hash};assert.deepEqual(validateSpaceCommand('castMemberVote',input),input);
  assert.throws(()=>validateSpaceCommand('castMemberVote',{...input,expectedDefinitionHash:'invalid'}),{code:'INVALID_REQUEST'});
  const {expectedDefinitionHash:_hash,...legacy}=input;assert.throws(()=>validateSpaceCommand('castMemberVote',legacy),{code:'INVALID_REQUEST'});
});

test('Lecture audience : contrat agrégé borné, sans champs de membre',()=>{
 const spaceId='00000000-0000-4000-8000-000000000001',pollAudience={spaceId,mode:'space',groupIds:[],resultsAudience:'poll_audience'};
 assert.deepEqual(validateSpaceCommand('getAudienceSize',{spaceId,pollAudience}),{spaceId,pollAudience});
 for(const eligible of [0,1,200])assert.equal(validateSpaceResponse({kind:'audienceSize',eligible}).eligible,eligible);
 for(const eligible of [-1,1.5,201])assert.throws(()=>validateSpaceResponse({kind:'audienceSize',eligible}));
 assert.throws(()=>validateSpaceResponse({kind:'audienceSize',eligible:2,members:[]}));
});
