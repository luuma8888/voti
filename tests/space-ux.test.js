import test from 'node:test';
import assert from 'node:assert/strict';
import {resultsState,accessFilename,cardsFilename,makeSpacePollDraft,SPACE_RELEASE_LABELS,SPACE_EXPRESS_DEFAULTS,spaceCreationValues} from '../web/space-ux.js';
import {recommendedMinimum,audienceMemberCount,MinimumRecommendation} from '../web/space-poll-minimum.js';
import {scanRegion} from '../web/member-scanner.js';
import {groupResultsAvailable} from '../shared/spaces.js';

const poll=(mode='threshold',available=false,audience='poll_audience')=>({status:'published',resultRules:{minimumResponses:2,releaseMode:mode},accessRules:{pollAudience:{resultsAudience:audience}},results:{available}});
test('Express impose un vote simple sans détruire le minimum personnalisé ni les réglages Guidée/Avancé',()=>{
  const values={question:'Sortie ?',answers:'Parc\nCinéma',groupIds:['00000000-0000-4000-8000-000000000002'],identity:'identified',comments:'optional',visibility:'public_with_results',release:'closed',minimum:'7',audience:'admins_only'},initial=structuredClone(values);
  assert.deepEqual(spaceCreationValues(values,'express'),{...values,...SPACE_EXPRESS_DEFAULTS});assert.deepEqual(values,initial);
  assert.deepEqual(spaceCreationValues(values,'guided'),spaceCreationValues(values,'advanced'));
  const result=makeSpacePollDraft(spaceCreationValues(values,'express'),'00000000-0000-4000-8000-000000000001');
  assert.equal(result.poll.definition.participationIdentityMode,'anonymous');assert.equal(result.poll.definition.commentMode,'disabled');assert.equal(result.poll.definition.commentVisibility,'private');assert.equal(result.poll.resultRules.minimumResponses,7);assert.equal(result.poll.resultRules.releaseMode,'threshold');assert.equal(result.pollAudience.resultsAudience,'poll_audience');
  assert.deepEqual(spaceCreationValues(values,'guided'),initial);assert.deepEqual(spaceCreationValues(values,'advanced'),initial);
});
test('Express : petites audiences 1, 2 et 8, recommandation 2 et règles communes',()=>{
  const space='00000000-0000-4000-8000-000000000001';
  for(const eligible of [1,2,8]){
    const {poll:p}=makeSpacePollDraft(spaceCreationValues({question:'Sortie ?',answers:'Parc\nCinéma',groupIds:[],minimum:String(recommendedMinimum(eligible))},'express'),space);
    assert.equal(p.resultRules.minimumResponses,2,'ni réduction à 1, ni ancien minimum 5');
    for(let total=0;total<=eligible;total++)for(const status of ['published','closed'])assert.equal(groupResultsAvailable(status,p.resultRules,total,eligible),total>=2,`snapshot ${eligible}, ${total} votes, ${status}`);
  }
});
test('Résultats : audience prioritaire, pas de faux motif de seuil ni compteur membre',()=>{
  const state=resultsState(poll('closed',false,'admins_only'));
  assert.equal(state.code,'reserved');assert.match(state.title,/réservés/);assert.doesNotMatch(state.detail,/minimum|2|participation/);
  assert.equal(resultsState(poll('threshold',true)).code,'available');
  assert.equal(resultsState(poll('threshold'),{admin:true,attendance:{consumed:1,eligible:3}}).code,'minimum');
  for(const [mode,code]of [['all_eligible','all'],['closed','closed'],['all_eligible_or_closed','all_or_closed']]){
    assert.equal(resultsState(poll(mode)).code,code);
    assert.doesNotMatch(resultsState(poll(mode)).detail,/est atteint/);
    assert.match(resultsState(poll(mode),{admin:true,attendance:{consumed:2,eligible:3}}).detail,/2 personnes sur 3/);
  }
  assert.match(resultsState(poll('threshold',true,'admins_only'),{admin:true}).detail,/administration/);
  for(const mode of ['closed','all_eligible_or_closed']){const closed=poll(mode);closed.status='closed';assert.equal(resultsState(closed).code,'minimum','ne pas demander de fermer un sondage déjà fermé');}
});
test('Minimum 2 / snapshot 1 : fermeture et tous présents ne libèrent jamais les résultats',()=>{
  for(const mode of SPACE_RELEASE_LABELS.map(([key])=>key))for(const status of ['published','closed']){
    const p=poll(mode);p.status=status;p.results.available=groupResultsAvailable(status,p.resultRules,1,1);
    assert.equal(p.results.available,false);
    assert.equal(resultsState(p,{admin:true,attendance:{consumed:1,eligible:1}}).code,'minimum');
  }
});
test('Fichiers : rôles et individuel/lot distincts, métadonnées seules, sans credential',()=>{
  const secret='voti-member-v1.'+'a'.repeat(64),staff='voti-staff-v1.'+'b'.repeat(64);
  const files=[accessFilename('Été / soleil','admin'),accessFilename('Été / soleil','creator',['Lune']),cardsFilename('Été / soleil','Emma'),cardsFilename('Été / soleil',null,6)];
  assert.equal(new Set(files).size,4);assert.match(files[0],/administrateur/);assert.match(files[1],/createur-lune/);assert.match(files[2],/emma/);assert.match(files[3],/lot-6/);
  assert.doesNotMatch(cardsFilename(secret,secret),/member-v1|a{32}/);assert.doesNotMatch(accessFilename(staff,'creator',[staff]),/staff-v1|b{32}/);
  assert.doesNotMatch(cardsFilename('voti-admin-v1.'+'c'.repeat(64),'fictif'),/admin-v1|c{32}/);
  assert.match(cardsFilename('Espace','星'),/星/);assert.doesNotMatch(cardsFilename('../Espace','.. / Emma\n'),/[\/\n]/);
});
test('Création guidée/rapide : construction et validations communes, sans champ de présentation',()=>{
  const values={question:'Sortie été 😊',answers:'Forêt\nCinéma',identity:'anonymous',comments:'optional',visibility:'private',release:'all_eligible',minimum:'2',audience:'admins_only',groupIds:[]};
  const space='00000000-0000-4000-8000-000000000001',options=()=>{let id=10;return{uuid:()=>`00000000-0000-4000-8000-${String(id++).padStart(12,'0')}`,now:()=>new Date(1700000000000).toISOString()};};
  assert.deepEqual(makeSpacePollDraft(values,space,options()),makeSpacePollDraft({...values},space,options()));
  assert.throws(()=>makeSpacePollDraft({...values,minimum:0},space));
  assert.throws(()=>makeSpacePollDraft({...values,answers:'Unique'},space));
  assert.equal(makeSpacePollDraft({...values,comments:'disabled'},space).poll.definition.commentMode,'disabled');
});
test('Scanner : mémoire bornée, centre et plein cadre, sans déformation',()=>{
  for(const [w,h]of [[1920,1080],[1080,1920],[640,480],[4000,4000]])for(const attempt of [0,1]){
    const region=scanRegion(w,h,attempt);assert.ok(region.width<=1280&&region.height<=1280);assert.ok(region.x>=0&&region.y>=0);assert.ok(region.x+region.w<=w&&region.y+region.h<=h);assert.ok(Math.abs(region.width/region.height-region.w/region.h)<.01);
  }
  assert.ok(scanRegion(1920,1080,1).w<scanRegion(1920,1080,0).w);
});

test('Minimum recommandé : 25 %, plancher 2 et arrondi supérieur',()=>{
 for(const [n,expected]of [[0,2],[1,2],[3,2],[8,2],[9,3],[12,3],[20,5],[21,6],[100,25]])assert.equal(recommendedMinimum(n),expected);
 for(const n of [-1,1.5,NaN])assert.throws(()=>recommendedMinimum(n));
});
test('Audience dédoublonnée : actifs distincts et union des groupes ciblés',()=>{
 const a={member_id:'a',status:'active',groupIds:['soleil','lune']},b={member_id:'b',status:'active',groupIds:['lune']},c={member_id:'c',status:'revoked',groupIds:['soleil']},d={member_id:'d',status:'active',groupIds:[]};
 assert.equal(audienceMemberCount([a,a,b,c,d],['soleil','lune']),2);assert.equal(audienceMemberCount([a,b,c,d],['soleil']),1);assert.equal(audienceMemberCount([a,b,c,d]),3);
});
test('Recommandation suit l’audience avant personnalisation, jamais après sans action explicite',()=>{
 const model=new MinimumRecommendation();assert.equal(model.audience(8),'2');assert.equal(model.audience(21),'6');model.personalize('4');assert.equal(model.audience(100),'4');assert.equal(model.recommend(),'25');assert.equal(model.audience(12),'3');
 const saved=new MinimumRecommendation(7);assert.equal(saved.audience(100),'7','valeur enregistrée conservée, y compris à la réouverture d’un brouillon');
});
test('Messages : motifs distincts, compteur uniquement gestion, aucun faux message de fermeture',()=>{
 const state=(mode,done=2,status='published')=>resultsState({...poll(mode),status},{admin:true,attendance:{consumed:done,eligible:3}});
 assert.equal(state('all_eligible_or_closed').detail,'2 personnes sur 3 ont participé. Les résultats seront disponibles après la dernière participation, ou si tu fermes le sondage.');
 assert.doesNotMatch(state('all_eligible').detail,/si tu fermes/);assert.match(state('closed').detail,/quand le sondage sera fermé/);assert.doesNotMatch(state('threshold',1).detail,/dernière participation|si tu fermes/);
 assert.equal(state('all_eligible_or_closed',1,'closed').code,'minimum');assert.doesNotMatch(resultsState(poll('all_eligible_or_closed')).detail,/2 personnes sur 3/);
 const reserved=resultsState(poll('threshold',false,'admins_only'),{attendance:{consumed:2,eligible:3}});assert.equal(reserved.code,'reserved');assert.doesNotMatch(reserved.detail,/personnes|participation/);
});
