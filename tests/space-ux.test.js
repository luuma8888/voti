import test from 'node:test';
import assert from 'node:assert/strict';
import {resultsState,accessFilename,cardsFilename,makeSpacePollDraft,SPACE_RELEASE_LABELS} from '../web/space-ux.js';
import {scanRegion} from '../web/member-scanner.js';
import {groupResultsAvailable} from '../shared/spaces.js';

const poll=(mode='threshold',available=false,audience='poll_audience')=>({status:'published',resultRules:{minimumResponses:2,releaseMode:mode},accessRules:{pollAudience:{resultsAudience:audience}},results:{available}});
test('Résultats : audience prioritaire, pas de faux motif de seuil ni compteur membre',()=>{
  const state=resultsState(poll('closed',false,'admins_only'));
  assert.equal(state.code,'reserved');assert.match(state.title,/réservés/);assert.doesNotMatch(state.detail,/minimum|2|participation/);
  assert.equal(resultsState(poll('threshold',true)).code,'available');
  assert.equal(resultsState(poll('threshold'),{admin:true,attendance:{consumed:1,eligible:3}}).code,'minimum');
  for(const [mode,code]of [['all_eligible','all'],['closed','closed'],['all_eligible_or_closed','all_or_closed']]){
    assert.equal(resultsState(poll(mode)).code,code);
    assert.doesNotMatch(resultsState(poll(mode)).detail,/est atteint/);
    assert.match(resultsState(poll(mode),{admin:true,attendance:{consumed:2,eligible:3}}).detail,/est atteint/);
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
