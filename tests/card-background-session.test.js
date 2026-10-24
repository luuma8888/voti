import test from 'node:test';import assert from 'node:assert/strict';
import {groupBackdrop} from '../web/card-backdrop.js';
import {availableCards,rememberCard,clearCards,issueSelectedCards,verifyPendingCards} from '../web/card-session.js';
const visual=i=>({id:'local-fixture-'+i,large:'not-loaded-in-unit-'+i});
test('Décor : 0/1/2/3/4/>4, doublons, OFF et paramètres des cinq thèmes',()=>{
 for(const n of [0,1,2,3,4,7]){const b=groupBackdrop(Array.from({length:n},(_,i)=>({visual:visual(i)})),'pop');assert.equal(b.enabled,true);assert.equal(b.visuals.length,Math.min(n,4));assert.equal(b.tiles.length,Math.min(n,4));assert.deepEqual(b.visualIds,Array.from({length:Math.min(n,4)},(_,i)=>'local-fixture-'+i));}
 assert.equal(groupBackdrop([{visual:visual(1)},{visual:null},{visual:visual(1)}],'nature').tiles.length,1);assert.equal(groupBackdrop([{visual:visual(1)}],'pop',false).enabled,false);
 const values=['pop','nature','douceur','dark','minimal'].map(theme=>groupBackdrop([{visual:visual(1)}],theme));assert(values.every(v=>v.intensity>0&&v.intensity<=.12&&v.tint>0));assert(values[4].intensity<values[0].intensity);
});
test('Une source mémoire, remplacement par Espace/membre et effacement sans révocation',()=>{
 const ui={issued:[],cardsVersion:0,cardsClearVersion:0};const a=rememberCard(ui,{spaceId:'s',memberId:'a',credential:'fixture-a'});rememberCard(ui,{spaceId:'s',memberId:'b',credential:'fixture-b'});rememberCard(ui,{spaceId:'t',memberId:'a',credential:'fixture-other-space'});const next=rememberCard(ui,{spaceId:'s',memberId:'a',credential:'fixture-new'});
 assert.equal(a.credential,'');assert.equal(ui.issued.length,3);assert.equal(availableCards(ui,'s').length,2);assert.equal(availableCards(ui,'s')[0],next);clearCards(ui,'s');assert.equal(next.credential,'');assert.equal(ui.issued.length,1);clearCards(ui);assert.equal(ui.issued.length,0);
});
test('Orchestration : avant mutation, échec partiel, CAS et réponse ambiguë vérifiée',async()=>{
 globalThis.location={hash:'#space/local'};const data={spaceId:'local',name:'Fictif',status:'active',revision:1,access:{role:'admin'},groups:[],members:['a','b','c'].map(member_id=>({member_id,status:'active',display_name:member_id,groupIds:[]}))};
 for(const failure of ['before','partial','conflict','ambiguous',null]){
  let calls=0;const ui={issued:[],cardsVersion:0,cardsClearVersion:0,staff:()=>'',adapter:{async spaceCommand(r){if(r.command==='getSpace'){if(failure==='before')throw{code:'RELAY_UNAVAILABLE'};return data;}if(r.command==='getMemberHome')return{memberId:'a',space:{spaceId:'local'}};calls++;if(failure==='ambiguous')throw{code:'RELAY_UNAVAILABLE'};if(failure==='conflict'||failure==='partial'&&calls===2)throw{code:'REVISION_CONFLICT'};return data;}}};
  const result=await issueSelectedCards(ui,data,['a','b','c']);assert.equal(result.entries.length,failure==='partial'?1:failure?0:3);assert.equal(calls,failure==='before'?0:failure==='partial'?2:failure?1:3);assert.equal(ui.cardJob,null);
  if(failure==='ambiguous'){assert.equal(availableCards(ui,'local').length,0);assert.equal(ui.issued[0].state,'unconfirmed');const checked=await verifyPendingCards(ui,'local');assert.equal(checked.verified,1);assert.equal(availableCards(ui,'local').length,1);assert.equal(result.unconfirmed.length,0);}
 }
 delete globalThis.location;
});
test('Une réponse incertaine ne réintroduit pas une ancienne carte elle-même invalide',async()=>{
 const ui={issued:[],cardsVersion:0,cardsClearVersion:0,adapter:{async spaceCommand(){throw{code:'INVALID_CAPABILITY'};}}};
 const old=rememberCard(ui,{spaceId:'s',memberId:'a',credential:'fixture-old'}),candidate=rememberCard(ui,{spaceId:'s',memberId:'a',credential:'fixture-candidate'},'unconfirmed');const result=await verifyPendingCards(ui,'s');assert.equal(result.refused,1);assert.equal(ui.issued.length,0);assert.equal(candidate.credential,'');assert.equal(old.credential,'');
});
test('Échec certain restaure la carte précédente ; ambiguïté vérifiée sans réémettre',async()=>{
 globalThis.location={hash:'#space/s'};const data={spaceId:'s',status:'active',access:{role:'admin'},revision:2,name:'Fictif',groups:[],members:[{member_id:'a',display_name:'Fictif',groupIds:[],status:'active'}]};
 const ui={issued:[],cardsVersion:0,cardsClearVersion:0,staff:()=>'',adapter:{async spaceCommand(r){if(r.command==='getSpace')return data;throw{code:'RATE_LIMITED'};}}};const old=rememberCard(ui,{spaceId:'s',memberId:'a',credential:'fixture-old'});const r=await issueSelectedCards(ui,data,['a']);assert.equal(r.failed[0].code,'RATE_LIMITED');assert.equal(ui.issued[0],old);assert.equal(old.credential,'fixture-old');assert.equal(r.unconfirmed.length,0);
 const candidate=rememberCard(ui,{spaceId:'s',memberId:'a',credential:'fixture-unknown'},'unconfirmed');ui.adapter.spaceCommand=async request=>{if(request.credential==='fixture-unknown')throw{code:'INVALID_CAPABILITY'};assert.equal(request.credential,'fixture-old');return{memberId:'a',space:{spaceId:'s'}};};const verified=await verifyPendingCards(ui,'s');assert.equal(verified.refused,1);assert.equal(ui.issued[0],old);assert.equal(candidate.credential,'');delete globalThis.location;
});
test('Le PDF est borné à la capacité actuelle d’un Espace et refuse vide ou >200',async()=>{
 const {memberCardsPdf}=await import('../web/member-cards.js');await assert.rejects(memberCardsPdf([],'https://fixture.invalid/'),/1 et 200/);await assert.rejects(memberCardsPdf(Array(201).fill({}),'https://fixture.invalid/'),/1 et 200/);
});
test('Effacement pendant une lecture/écriture ne repeuple jamais le registre',async()=>{
 globalThis.location={hash:'#space/s'};const data={spaceId:'s',status:'active',access:{role:'admin'},revision:0,name:'Fictif',groups:[],members:[{member_id:'a',display_name:'Fictif',groupIds:[],status:'active'}]};
 for(const during of ['getSpace','rotateMemberCard']){let release,writes=0;const ui={issued:[],cardsVersion:0,cardsClearVersion:0,staff:()=>'',adapter:{spaceCommand(r){if(r.command==='rotateMemberCard')writes++;if(r.command===during)return new Promise(resolve=>release=resolve);return Promise.resolve(data);}}};const pending=issueSelectedCards(ui,data,['a']);while(!release)await new Promise(setImmediate);const candidate=ui.issued[0];clearCards(ui);release(data);await pending;assert.equal(ui.issued.length,0);assert.equal(ui.cardBatchResult,null);assert.equal(ui.cardJob,null);if(candidate)assert.equal(candidate.credential,'');assert.equal(writes,during==='getSpace'?0:1);}
 delete globalThis.location;
});
