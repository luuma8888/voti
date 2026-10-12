import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign, validateDesign, LAYOUTS, PALETTES, TYPOGRAPHIES, designPalette, contrast, imageCrop, POSTER_KEY } from '../web/poster-design.js';
import { makeStudioPlan, makeResultsPlan, authorizedResults } from '../web/print-layout.js';
import { PosterRepository } from '../web/poster-storage.js';
import { MemoryAssetAdapter, makeAsset } from '../shared/assets.js';
import { published } from './fixtures.js';
import { getResults } from '../shared/result-rules.js';
import { votes } from './fixtures.js';
import { closePoll } from '../shared/poll-engine.js';

function poll(n=3) {const p=structuredClone(published().polls[0]);p.remoteRef={relayId:'voti-test',pollId:p.id,revision:1};p.definition.choices=Array.from({length:n},(_,i)=>({...p.definition.choices[0],id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,label:`Réponse ${i+1} : été et forêt`,order:i}));return p;}
function result(p,counts=Array(p.definition.choices.length).fill(5)) {const total=counts.reduce((a,b)=>a+b,0);return {available:true,totalBallots:total,choices:p.definition.choices.map((c,i)=>({id:c.id,label:c.label,count:counts[i],percentage:counts[i]/total*100}))};}
function harness(assets=new MemoryAssetAdapter()) {const values=new Map();let fail=false;return {assets,values,setFail:v=>fail=v,repo:new PosterRepository({getItem:key=>values.get(key)??null,setItem:(key,raw)=>{if(fail)throw new Error('quota');values.set(key,raw);}},assets,{request:(_key,task)=>task()})};}
test('Design v1 : presets, immutabilité, version inconnue et champs secrets refusés',()=>{
  const d=defaultDesign();assert.deepEqual(validateDesign(d),d);assert.equal(PALETTES.length,8);assert.equal(TYPOGRAPHIES.length,4);
  for(const change of [{formatVersion:2},{adminCapability:'secret'},{layout:'canva'},{mode:'admin'},{typography:'url()'},{usePollImages:1}])assert.throws(()=>validateDesign({...d,...change}));
  assert.throws(()=>validateDesign({...d,customColors:{...d.customColors,primary:'red'}}));
});
for(const palette of PALETTES)test(`Palette ${palette[1]} : contraste automatique >=4,5`,()=>{
  const d={...defaultDesign(),palette:palette[0]},colors=designPalette(d);
  assert.ok(contrast(colors.text,colors.surface)>=4.5);assert.ok(contrast(colors.accentText,colors.surface)>=4.5);assert.ok(contrast(colors.backgroundText,colors.bg)>=4.5);
  assert.ok(contrast(colors.bar,colors.bg)>=3);
});
test('Couleurs personnalisées, clair/sombre : QR non colorés et texte adapté',()=>{
  for(const bg of ['#000000','#ffffff','#888888','#ffdd00']){const d=defaultDesign();d.customColors={enabled:true,primary:'#ffff00',secondary:'#ffffff',bg};const p=designPalette(d);assert.ok(contrast(p.text,p.surface)>=4.5);assert.ok(contrast(p.accentText,p.surface)>=4.5);assert.ok(contrast(p.backgroundText,p.bg)>=4.5);assert.ok(contrast(p.bar,p.bg)>=3);}
});
for(const [layout] of LAYOUTS)for(const n of [2,3,4,5,6])for(const mode of ['access','choices'])test(`Studio ${layout}, ${mode}, ${n} choix : zones/public/aucune mutation`,()=>{
  const p=poll(n),original=structuredClone(p),d={...defaultDesign(),layout,mode};const plan=makeStudioPlan(p,d);assert.deepEqual(p,original);assert.equal(plan.pages.flatMap(p=>p.items).length,n);
  assert.ok(plan.pages.length>0&&plan.pages.length<=8);
  const qrs=plan.pages.flatMap(p=>p.qrs);assert.ok(qrs.some(q=>q.kind==='results'));
  assert.equal(qrs.filter(q=>q.kind===mode.slice(0,-1)||q.kind==='choice').length,mode==='choices'?n:0);
  for(const q of qrs){assert.ok(q.x>=0&&q.y>=0&&q.x+q.size<=plan.width&&q.y+q.size<=plan.height);assert.ok(q.pixels>=5&&q.size>=400);}
  for(const page of plan.pages)for(const n of page.nodes)assert.ok(n.x>=0&&n.y>=0&&n.x+(n.width||0)<=plan.width+1);
});
test('Consigne QR choix : confirmation directe, jamais une simple présélection',()=>{
  const expected='Ce QR ouvre directement la confirmation de ce choix. Le vote n’est envoyé qu’après validation.';
  for(const [layout] of LAYOUTS){
    const plan=makeStudioPlan(poll(6),{...defaultDesign(),layout,mode:'choices'});
    for(const page of plan.pages){
      const instruction=page.nodes.find(n=>n.type==='text'&&n.lines.join(' ').startsWith('Ce QR ouvre'));
      assert.ok(instruction);assert.equal(instruction.lines.join(' '),expected);
      assert.doesNotMatch(instruction.lines.join(' '),/présélect/);
    }
  }
});
test('Quatre compositions différentes, portrait/paysage et pagination des textes longs',()=>{
  const p=poll(6);const plans=LAYOUTS.map(([layout])=>makeStudioPlan(p,{...defaultDesign(),layout,mode:'choices'}));
  assert.equal(new Set(plans.map(p=>JSON.stringify(p.pages.map(p=>p.items)))).size,4);
  p.definition.question=('Été et forêt, quel choix pour notre groupe ? '.repeat(6)).slice(0,240);p.definition.description=('Description longue avec accents et contexte. '.repeat(25)).slice(0,1000);p.definition.choices.forEach(c=>c.label=('Une réponse détaillée avec accents et mots longs. '.repeat(3)).slice(0,100));
  const plan=makeStudioPlan(p,{...defaultDesign(),mode:'choices'});assert.ok(plan.pages.length>1);
  for(const [layout] of LAYOUTS)for(const mode of ['access','choices'])assert.ok(makeStudioPlan(p,{...defaultDesign(),layout,mode}).pages.length<=8);
});
test('Médias : cover/contain, focales et aucune déformation',()=>{
  for(const [w,h] of [[300,600],[600,300],[400,400]])for(const fit of ['cover','contain'])for(const position of ['top','center','bottom']){const c=imageCrop(w,h,300,200,fit,position);assert.ok(Math.abs(c.width/c.height-w/h)<.00001);assert.equal(c.x,(300-c.width)/2);assert.ok(fit==='cover'?c.width>=300&&c.height>=200:c.width<=300&&c.height<=200);}
});
test('Stockage dédié versionné : aucun blob, secret ou état métier ; persistance et conflit',async()=>{
  const h=harness(),p=poll(),d=defaultDesign();await h.repo.save(p.id,d);assert.deepEqual(h.repo.get(p.id),d);assert.doesNotMatch(h.values.get(POSTER_KEY),/blob|ballot|capability|actionId/);
  await h.repo.save(p.id,{...d,palette:'night'},[],d);await assert.rejects(h.repo.save(p.id,d,[],d),/autre onglet/);
  h.values.set(POSTER_KEY,JSON.stringify({formatVersion:2,designs:{}}));assert.throws(()=>h.repo.get(p.id),/Version/);
});
test('Assets affiche-only : références partagées protégées, suppression/nettoyage, panne quota rollback',async()=>{
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9fkAAAAASUVORK5CYII=','base64'),a=await makeAsset(new Blob([bytes],{type:'image/png'}));
  const h=harness(),p=poll(),second=poll(2);second.id='30000000-0000-4000-8000-000000000001';const d=defaultDesign();d.media.main=a.id;
  await h.repo.save(p.id,d,[a]);await h.repo.save(second.id,d);await h.repo.recover();assert.ok(await h.assets.has(a.id));
  await h.repo.remove(p.id);assert.ok(await h.assets.has(a.id));await h.repo.remove(second.id);assert.equal(await h.assets.has(a.id),false);
  h.setFail(true);await assert.rejects(h.repo.save(p.id,d,[a]),/quota/);assert.equal(await h.assets.has(a.id),false);
  const limited=harness(new MemoryAssetAdapter({quota:1}));await assert.rejects(limited.repo.save(p.id,d,[a]),/Quota/);assert.equal(limited.values.size,0);
});
test('Asset absent et données corrompues : refus, sans nettoyage destructif',async()=>{const h=harness(),p=poll(),d=defaultDesign();d.media.main='sha256-'+'a'.repeat(64);await assert.rejects(h.repo.save(p.id,d),/absente/);assert.equal(h.values.size,0);h.values.set(POSTER_KEY,'corrupt');await assert.rejects(h.repo.recover());});
test('Médias du sondage/affiche : préférences explicites et aucune modification de définition',()=>{
  const p=poll(),d=defaultDesign(),id='sha256-'+'a'.repeat(64),second='sha256-'+'b'.repeat(64);
  p.definition.pollImageAssetId=id;p.definition.choices[0].imageRef=id;d.media.main=second;d.media.choices[p.definition.choices[0].id]=second;
  const before=structuredClone(p);let plan=makeResultsPlan(p,result(p),d);
  assert.ok(plan.pages.flatMap(p=>p.nodes).some(n=>n.type==='image'&&n.id===id));assert.ok(!plan.pages.flatMap(p=>p.nodes).some(n=>n.id===second));
  plan=makeResultsPlan(p,result(p),d,{usePosterMedia:true});assert.ok(plan.pages.flatMap(p=>p.nodes).some(n=>n.id===second));assert.deepEqual(p,before);
  d.usePollImages=false;d.media.main=null;d.media.choices={};plan=makeStudioPlan(p,d);assert.ok(!plan.pages.flatMap(p=>p.nodes).some(n=>n.type==='image'));
});
for(const style of ['summary','report'])for(const n of [2,3,6])test(`Résultats ${style} ${n} choix : agrégats seuls, A4/QR et date d’export`,()=>{
  const p=poll(n),r=result(p);const before=structuredClone(r);p.adminCapability='SECRET_NOT_PRINTED';p.ballots=[{actionId:'PRIVATE'}];
  const plan=makeResultsPlan(p,r,defaultDesign(),{style,exportDate:new Date('2026-10-12T12:00:00Z')});assert.deepEqual(r,before);assert.equal(plan.total,n*5);assert.equal(plan.pages.flatMap(p=>p.items).length,n);assert.ok(plan.pages.flatMap(p=>p.qrs).every(q=>q.kind==='results'));assert.doesNotMatch(JSON.stringify(plan),/SECRET_NOT_PRINTED|PRIVATE|actionId|ballots|adminCapability/);assert.match(plan.pages.flatMap(p=>p.nodes).filter(n=>n.type==='text').flatMap(n=>n.lines).join(' '),/Date d’export|Résultats au moment/);
});
test('Projection autorisée : seuil, closed+seuil, zéro, total incohérent et pourcentages altérés refusés',async()=>{
  for(const count of [0,4,5,6]){const s=await votes(count),p=s.polls[0],r=getResults(s,p.id);if(count<5)assert.throws(()=>makeResultsPlan(p,r,defaultDesign()),/disponibles/);else assert.doesNotThrow(()=>makeResultsPlan(p,r,defaultDesign()));}
  const s=await votes(5),p=s.polls[0];p.resultRules.releaseMode='closed';assert.throws(()=>makeResultsPlan(p,getResults(s,p.id),defaultDesign()));const closed=closePoll(s,p.id);assert.doesNotThrow(()=>makeResultsPlan(closed.polls[0],getResults(closed,p.id),defaultDesign()));
  const q=poll(2),r=result(q,[5,0]);assert.equal(authorizedResults(q,r).choices[0].percentage,100);r.choices[0].percentage=50;assert.throws(()=>authorizedResults(q,r));r.choices[0].percentage=100;r.totalBallots=6;assert.throws(()=>authorizedResults(q,r));
});
