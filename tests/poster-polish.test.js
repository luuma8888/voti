import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign,validateDesign,PALETTES,choosePalette,customizeColor,resetPalette,paletteColors,TITLE_TYPOGRAPHIES,BODY_TYPOGRAPHIES,IMAGE_RATIOS,imageCrop,contrast,blendColor } from '../web/poster-design.js';
import { makeStudioPlan,makeResultsPlan } from '../web/print-layout.js';
import { PosterRepository } from '../web/poster-storage.js';
import { PollContexts,CONTEXT_KEY } from '../web/poll-context.js';
import { MemoryAssetAdapter } from '../shared/assets.js';
import { published } from './fixtures.js';

function poll(n=3){const p=structuredClone(published().polls[0]);p.remoteRef={relayId:'voti-test',pollId:p.id,revision:1};p.definition.choices=Array.from({length:n},(_,i)=>({...p.definition.choices[0],id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,label:`Choix ${i+1} : été`,order:i}));return p;}
const text=plan=>plan.pages.flatMap(p=>p.nodes.filter(n=>n.type==='text').flatMap(n=>n.lines));
test('Ancien design v1 étendu sans perte, lecture sans écriture et CAS normalisé',async()=>{
  const old=defaultDesign();for(const k of ['titleTypography','bodyTypography','headerMode','qrSurfaceMode','textSurfaceOpacity','densityPreset','choicesPerRow','qrSize','imageSettings'])delete old[k];old.typography='editorial';old.palette='lagoon';
  const p=poll(),raw=JSON.stringify({formatVersion:1,designs:{[p.id]:old}}),values=new Map([['voti.poster.v1',raw]]);
  const repo=new PosterRepository({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},new MemoryAssetAdapter(),{request:(_,f)=>f()});
  const d=repo.get(p.id);assert.equal(d.titleTypography,'editorial');assert.equal(d.bodyTypography,'editorial');assert.equal(d.headerMode,'normal');assert.deepEqual(d.customColors,paletteColors('lagoon'));assert.equal(values.get('voti.poster.v1'),raw);
  await repo.save(p.id,{...d,headerMode:'hidden'},[],d);assert.equal(repo.get(p.id).headerMode,'hidden');assert.deepEqual(old,JSON.parse(raw).designs[p.id]);
  assert.throws(()=>validateDesign({...d,remoteRef:{}}));assert.throws(()=>validateDesign({...d,imageSettings:{main:{ratio:'1:1',fit:'stretch',focalX:.5,focalY:.5}}}));
});
for(const [id] of PALETTES)test(`Palette ${id} synchronisée, personnalisée et retour explicite`,()=>{
  let d=choosePalette(defaultDesign(),id);assert.deepEqual(d.customColors,paletteColors(id));
  d=customizeColor(d,'secondary','#ffcc00');assert.equal(d.customColors.enabled,true);
  for(const layout of ['essential','cards','magazine','mosaic']){const plan=makeStudioPlan(poll(),{...d,layout});assert.equal(plan.palette.secondary,'#ffcc00');assert.ok(plan.pages.flatMap(p=>p.nodes).some(n=>n.color==='secondary'));}
  d=choosePalette(d,'garden');assert.equal(d.customColors.secondary,'#ffcc00');d=resetPalette(d);assert.deepEqual(d.customColors,paletteColors('garden'));
});
test('Titre et corps indépendants : six/quatre piles, accents et texte long',()=>{
  assert.equal(TITLE_TYPOGRAPHIES.length,6);assert.equal(BODY_TYPOGRAPHIES.length,4);
  for(const [title,,family] of TITLE_TYPOGRAPHIES)for(const [body,,bf] of BODY_TYPOGRAPHIES){const p=poll(),plan=makeStudioPlan(p,{...defaultDesign(),titleTypography:title,bodyTypography:body});assert.equal(plan.titleFamily,family);assert.equal(plan.family,bf);assert.ok(plan.pages[0].nodes.some(n=>n.type==='text'&&n.family===family&&n.lines.join(' ').includes(p.definition.question)));}
});
for(const columns of ['1','2','3','auto'])for(const density of ['compact','balanced','airy'])for(const qrSize of ['small','medium','large'])test(`Densité ${density}, ${columns} colonnes, QR ${qrSize}`,()=>{
  const p=poll(6),d={...defaultDesign(),layout:'cards',mode:'choices',choicesPerRow:columns,densityPreset:density,qrSize};const plan=makeStudioPlan(p,d);assert.equal(plan.pages.flatMap(p=>p.items).length,6);
  for(const page of plan.pages)for(const q of page.qrs){assert.ok(q.pixels>=5&&q.size>=400);assert.ok(q.x+q.size<=plan.width&&q.y+q.size<plan.height);assert.ok(page.nodes.some(n=>n.color==='qrSurface'&&n.opacity===1));}
});
test('Trois choix avec images sur une page : trois en ligne ou 2+1',()=>{
  const p=poll(),d=defaultDesign(),ref='sha256-'+'a'.repeat(64);d.media.main=ref;for(const c of p.definition.choices)d.media.choices[c.id]=ref;
  for(const col of ['2','3']){const plan=makeStudioPlan(p,{...d,layout:'cards',mode:'choices',choicesPerRow:col,densityPreset:'compact',qrSize:'small'});assert.equal(plan.pages.length,1);assert.equal(new Set(plan.pages[0].items.map(n=>n.y)).size,col==='3'?1:2);}
  const long=poll(6);long.definition.question='Été à Noël : '.repeat(18);long.definition.description='Description très longue. '.repeat(35);long.definition.choices.forEach(c=>c.label='Libellé avec accents, forêt et pêche. '.repeat(2));assert.ok(makeStudioPlan(long,{...d,mode:'choices',choicesPerRow:'3'}).pages.length>1);
});
test('Header discret/masqué, surface QR et texte pessimiste sur photo noire/blanche',()=>{
  for(const headerMode of ['normal','discreet','hidden'])for(const qrSurfaceMode of ['large','compact','minimal'])for(const [palette] of PALETTES){const p=makeStudioPlan(poll(),{...defaultDesign(),headerMode,qrSurfaceMode,palette,textSurfaceOpacity:.65});
    assert.equal(p.pages[0].nodes.some(n=>n.type==='logo'),headerMode!=='hidden');
    assert.ok(contrast(p.palette.text,blendColor(p.palette.surface,'#000000',p.surfaceOpacity))>=4.5);assert.ok(contrast(p.palette.text,blendColor(p.palette.surface,'#ffffff',p.surfaceOpacity))>=4.5);
    assert.ok(p.pages.flatMap(p=>p.nodes).filter(n=>n.color==='qrSurface').every(n=>n.opacity===1));
  }
});
test('Ratios individuels : proportions et focales sans étirement',()=>{
  const p=poll(),id='sha256-'+'b'.repeat(64),d=defaultDesign();d.media.main=id;
  for(const [ratio] of IMAGE_RATIOS){d.imageSettings.main={ratio,fit:'cover',focalX:0,focalY:1};const plan=makeStudioPlan(p,d,{mediaSizes:{[id]:{width:300,height:600}}}),n=plan.pages[0].nodes.find(n=>n.type==='image');assert.equal(n.focalX,0);assert.equal(n.focalY,1);const expected=ratio==='original'?.5:ratio.split(':').map(Number).reduce((a,b)=>a/b);assert.ok(Math.abs(n.width/n.height-expected)<1e-8);}
  for(const [w,h] of [[300,600],[600,300],[400,400]])for(const focalX of [0,.5,1])for(const focalY of [0,.5,1])for(const fit of ['cover','contain']){const c=imageCrop(w,h,250,160,fit,'center',{focalX,focalY});assert.ok(Math.abs(c.width/c.height-w/h)<1e-8);if(fit==='cover'){assert.ok(c.x<=0&&c.y<=0);assert.ok(c.x+c.width>=250&&c.y+c.height>=160);}else{assert.ok(c.x>=0&&c.y>=0);}}
});
test('Contexte local/en ligne/supprimé distinct du statut et sans secret',()=>{
  const values=new Map(),ctx=new PollContexts({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),p=poll();for(const status of ['draft','published','closed']){p.status=status;assert.equal(ctx.label(p.id), 'Local');assert.equal(ctx.label(p.id,{remoteRevision:1}), 'En ligne');}
  assert.equal(ctx.label(p.id,{remoteRevision:0}),'Publication en attente');ctx.markDeleted(p.id);assert.equal(ctx.label(p.id),'Copie locale · ancien lien supprimé');assert.doesNotMatch(values.get(CONTEXT_KEY),/capability|ballot|relay|http/);assert.equal(ctx.label(p.id,{remoteRevision:2}),'En ligne');
  values.set(CONTEXT_KEY,'corrupt');assert.throws(()=>ctx.markDeleted(p.id));assert.equal(values.get(CONTEXT_KEY),'corrupt');
});
test('Résultats : styles transverses sans changer les agrégats ou le seuil',()=>{
  const p=poll(),projection={available:true,totalBallots:15,choices:p.definition.choices.map(c=>({id:c.id,label:c.label,count:5,percentage:100/3}))};
  const before=structuredClone(projection),plan=makeResultsPlan(p,projection,{...defaultDesign(),headerMode:'hidden',titleTypography:'fantasy',bodyTypography:'soft'});assert.deepEqual(projection,before);assert.equal(plan.total,15);assert.ok(!plan.pages.flatMap(p=>p.nodes).some(n=>n.type==='logo'));assert.ok(text(plan).some(t=>t.includes('Résultats au moment')));assert.throws(()=>makeResultsPlan(p,{available:false},defaultDesign()));
});
