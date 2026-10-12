import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDesign,validateDesign,IMAGE_RATIOS,imageCrop} from '../web/poster-design.js';
import {makeStudioPlan} from '../web/print-layout.js';
import {paintPrintPage} from '../web/print-renderer.js';
import {published} from './fixtures.js';

const mainId='sha256-'+'a'.repeat(64),choiceId='sha256-'+'b'.repeat(64);
function fixture(n=2){const p=structuredClone(published().polls[0]);p.remoteRef={relayId:'test',pollId:p.id,revision:1};p.definition.choices=Array.from({length:n},(_,i)=>({...p.definition.choices[0],id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,label:`Choix ${i+1}`,order:i}));
  const d={...defaultDesign(),layout:'cards',mode:'choices',choicesPerRow:'2'};d.media.main=mainId;for(const c of p.definition.choices)d.media.choices[c.id]=choiceId;
  return {p,d};}
const metadata={[mainId]:{width:1600,height:900},[choiceId]:{width:1600,height:900}};
const images=plan=>plan.pages.flatMap(p=>p.nodes.filter(n=>n.type==='image'));
const settings=(height='auto',align='center',ratio='original',fit='cover')=>({height,align,ratio,fit,focalX:.25,focalY:.75});

test('Fond : le preset de hauteur ne remplace jamais les dimensions de la page',()=>{
  const d=defaultDesign();d.background.assetId=mainId;d.imageSettings.background=settings();const design=validateDesign(d),rectangles=[],draws=[];
  const context={setTransform(){},clearRect(){},scale(){},fillRect(){},save(){},restore(){},beginPath(){},clip(){},roundRect(...args){rectangles.push(args);},drawImage(...args){draws.push(args);}};
  const plan={width:2480,height:3508,palette:{bg:'#ffffff'},design,pages:[{nodes:[],qrs:[]}]};
  paintPrintPage({width:2480,height:3508,getContext:()=>context},plan,0,{media:new Map([[mainId,{width:1600,height:900}]])});
  assert.deepEqual(rectangles[0].slice(0,4),[0,0,2480,3508]);assert.ok(draws[0].slice(1).every(Number.isFinite));
});

test('Ancien cadrage v1 : taille Auto et alignement Centre, sans mutation',()=>{
  const {d}=fixture();d.imageSettings.main={ratio:'original',fit:'cover',focalX:.25,focalY:.75};const before=structuredClone(d),normalized=validateDesign(d);
  assert.deepEqual(d,before);assert.equal(normalized.imageSettings.main.height,'auto');assert.equal(normalized.imageSettings.main.align,'center');
  for(const patch of [{height:'huge'},{height:1601},{height:79},{height:NaN},{align:'free'},{adminCapability:'secret'}])assert.throws(()=>validateDesign({...d,imageSettings:{main:{...d.imageSettings.main,...patch}}}));
  assert.throws(()=>validateDesign({...d,imageSettings:{background:settings('large')}}));
});
test('Principale paysage Grande : largeur utile entière, pas une vignette centrée',()=>{
  const {p,d}=fixture();d.imageSettings.main=settings('large');
  for(const mode of ['access','choices']){const plan=makeStudioPlan(p,{...d,mode},{mediaSizes:metadata}),main=images(plan).find(n=>n.imageKey==='main');
    assert.equal(main.width,plan.width-280);assert.equal(main.x,140);assert.ok(main.height>1200);assert.equal(main.width/main.height,1600/900);}
});
test('Hauteur principale Petite/Moyenne/Grande : effet réel et borné',()=>{
  const {p,d}=fixture(),heights=[];
  for(const height of ['small','medium','large']){d.imageSettings.main=settings(height);const plan=makeStudioPlan(p,d,{mediaSizes:metadata});heights.push(images(plan).find(n=>n.imageKey==='main').height);}
  assert.equal(heights[0],400);assert.equal(heights[1],800);assert.ok(heights[2]>heights[1]);
});
test('Hauteur des choix : effet réel, images dominantes et non déformées',()=>{
  const {p,d}=fixture();d.media.main=null;const heights=[];
  for(const height of ['small','medium','large']){for(const c of p.definition.choices)d.imageSettings[c.id]=settings(height);const plan=makeStudioPlan(p,d,{mediaSizes:metadata}),photo=images(plan)[0];
    heights.push(photo.height);assert.equal(photo.width/photo.height,1600/900);assert.ok(photo.y+photo.height<plan.pages[0].qrs.find(q=>q.kind==='choice').y);}
  assert.equal(heights[0],220);assert.equal(heights[1],440);assert.ok(heights[2]>440);
});
test('Alignement du cadre gauche/centre/droite : distinct du point focal et des QR',()=>{
  const {p,d}=fixture(),xs=[];let qrs;
  for(const align of ['left','center','right']){d.imageSettings.main=settings('small',align);const plan=makeStudioPlan(p,d,{mediaSizes:metadata}),photo=images(plan).find(n=>n.imageKey==='main');xs.push(photo.x);
    assert.equal(photo.focalX,.25);assert.equal(photo.focalY,.75);const current=plan.pages.map(p=>p.qrs.map(({x,y,size,url})=>({x,y,size,url})));if(qrs)assert.deepEqual(current,qrs);qrs=current;}
  assert.equal(xs[0],140);assert.ok(xs[0]<xs[1]&&xs[1]<xs[2]);
});
test('Ratios et Remplir/Ajuster : cadre proportionnel, sans étirement',()=>{
  for(const [ratio] of IMAGE_RATIOS)for(const fit of ['cover','contain']){const {p,d}=fixture();d.imageSettings.main=settings('large','center',ratio,fit);
    const plan=makeStudioPlan(p,d,{mediaSizes:metadata}),photo=images(plan).find(n=>n.imageKey==='main'),expected=ratio==='original'?1600/900:ratio.split(':').map(Number).reduce((a,b)=>a/b);
    assert.ok(Math.abs(photo.width/photo.height-expected)<1e-8);const crop=imageCrop(1600,900,photo.width,photo.height,fit,'center',photo);assert.ok(Math.abs(crop.width/crop.height-1600/900)<1e-8);}
});
test('Images agrandies : 2/3/6 choix, quatre layouts, deux types, QR et textes préservés',()=>{
  for(const count of [2,3,6])for(const layout of ['essential','cards','magazine','mosaic'])for(const mode of ['access','choices'])for(const height of ['auto','large']){
    const {p,d}=fixture(count),before=structuredClone(p);d.layout=layout;d.mode=mode;d.choicesPerRow='auto';d.imageSettings.main=settings(height);for(const c of p.definition.choices)d.imageSettings[c.id]=settings(height);
    const plan=makeStudioPlan(p,d,{mediaSizes:metadata});assert.deepEqual(p,before);assert.equal(plan.pages.flatMap(p=>p.items).length,count);assert.ok(plan.pages.length<=8);
    for(const page of plan.pages){for(const q of page.qrs){assert.ok(q.pixels>=5&&q.size>=400&&q.x+q.size<=plan.width&&q.y+q.size<=plan.height);}
      for(const image of page.nodes.filter(n=>n.type==='image')){assert.ok(image.width>0&&image.height>0&&image.x>=140&&image.x+image.width<=plan.width-140+1&&image.y+image.height<=plan.height-590+1);
        for(const q of page.qrs)assert.ok(image.x+image.width<=q.x||q.x+q.size<=image.x||image.y+image.height<=q.y||q.y+q.size<=image.y,'Image superposée à un QR');
        if(image.imageKey!=='main'){const choice=p.definition.choices.find(c=>c.id===image.imageKey),label=page.nodes.find(n=>n.type==='text'&&n.lines.join(' ').endsWith(choice.label));assert.ok(label&&label.y>=image.y+image.height);}}
    }
  }
});
test('Trois choix illustrés Compact : une page en 3 ou 2+1 avec Auto',()=>{
  for(const columns of ['2','3']){const {p,d}=fixture(3);d.densityPreset='compact';d.qrSize='small';d.choicesPerRow=columns;
    const plan=makeStudioPlan(p,d,{mediaSizes:metadata});assert.equal(plan.pages.length,1);}
});
test('Pleine largeur : hauteur précise indépendante du ratio natif, sans étirement',()=>{
  for(const layout of ['essential','cards','magazine','mosaic'])for(const fit of ['cover','contain'])for(const height of [80,210,590]){
    const {p,d}=fixture();d.layout=layout;d.imageSettings.main=settings(height,'center','full-width',fit);
    const plan=makeStudioPlan(p,d,{mediaSizes:metadata}),main=images(plan).find(n=>n.imageKey==='main');
    assert.equal(main.x,140);assert.equal(main.width,plan.width-280);assert.equal(main.height,height);
    const crop=imageCrop(1600,900,main.width,main.height,fit,'center',main);assert.ok(Math.abs(crop.width/crop.height-1600/900)<1e-8);
  }
});
test('Curseur : nombres bornés et anciens presets conservés, Pleine largeur seulement principale',()=>{
  const {p,d}=fixture();for(const height of [80,125,850,1600]){d.imageSettings.main=settings(height);assert.equal(validateDesign(d).imageSettings.main.height,height);}
  for(const height of [40,65,900]){d.imageSettings[p.definition.choices[0].id]=settings(height);assert.equal(validateDesign(d).imageSettings[p.definition.choices[0].id].height,height);}
  for(const height of [0,39,901,Infinity,'120']){d.imageSettings[p.definition.choices[0].id]=settings(height);assert.throws(()=>validateDesign(d));}
  d.imageSettings[p.definition.choices[0].id]=settings(80,'center','full-width');assert.throws(()=>validateDesign(d));
});
test('Cartes Équilibré : trois choix sur deux lignes et une page grâce aux petites hauteurs',()=>{
  const {p,d}=fixture(3);d.choicesPerRow='2';d.qrSize='small';d.imageSettings.main=settings(200,'center','full-width');
  for(const c of p.definition.choices)d.imageSettings[c.id]=settings(80);
  const plan=makeStudioPlan(p,d,{mediaSizes:metadata});assert.equal(plan.pages.length,1);assert.equal(plan.pages[0].items.length,3);
  assert.ok(plan.pages[0].items[2].y>plan.pages[0].items[1].y);for(const q of plan.pages[0].qrs)assert.ok(q.size>=400&&q.pixels>=5);
});
test('Images de même rangée : hauteurs individuelles 80/440 réellement respectées',()=>{
  for(const mode of ['access','choices'])for(const choiceComposition of ['stacked','side-by-side']){
    const {p,d}=fixture();d.media.main=null;d.mode=mode;d.choiceComposition=choiceComposition;
    p.definition.choices.forEach((c,i)=>{d.imageSettings[c.id]=settings(i?440:80,'center','1:1');});
    const plan=makeStudioPlan(p,d,{mediaSizes:metadata}),photos=images(plan);
    assert.equal(photos[0].height,80);assert.equal(photos[1].height,440);
  }
});
test('Cartes côte à côte : trois choix illustrés sur deux lignes, une page sans petites photos',()=>{
  const {p,d}=fixture(3);d.choiceComposition='side-by-side';d.qrSize='medium';d.imageSettings.main=settings(400,'center','full-width');
  const plan=makeStudioPlan(p,d,{mediaSizes:metadata});assert.equal(plan.pages.length,1);assert.equal(plan.pages[0].items.length,3);
  for(const c of p.definition.choices){const photo=images(plan).find(n=>n.imageKey===c.id),q=plan.pages[0].qrs.find(q=>q.url.includes('/choice/'+c.id));
    assert.ok(photo.width>300&&photo.height>180);assert.ok(photo.x+photo.width<q.x);assert.ok(q.size>=400&&q.pixels>=5);
    const label=plan.pages[0].nodes.find(n=>n.type==='text'&&n.lines.join(' ')===c.label);assert.ok(label.y<photo.y&&label.y<q.y);}
});
test('Côte à côte : 2/3/6 choix, colonnes 1/2/3, images mixtes et pagination sûre',()=>{
  for(const count of [2,3,6])for(const columns of ['1','2','3'])for(const qrSize of ['small','medium','large']){
    const {p,d}=fixture(count);d.choiceComposition='side-by-side';d.choicesPerRow=columns;d.qrSize=qrSize;delete d.media.choices[p.definition.choices.at(-1).id];
    const plan=makeStudioPlan(p,d,{mediaSizes:metadata});assert.equal(plan.pages.flatMap(p=>p.items).length,count);
    for(const page of plan.pages){for(const photo of page.nodes.filter(n=>n.type==='image'))for(const q of page.qrs)
      assert.ok(photo.x+photo.width<=q.x||q.x+q.size<=photo.x||photo.y+photo.height<=q.y||q.y+q.size<=photo.y);
      for(const q of page.qrs)assert.ok(q.size>=400&&q.pixels>=5&&q.y+q.size<plan.height-80);
    }
    if(columns==='3')assert.ok(plan.warnings.some(w=>w.includes('carte trop étroite')));
  }
});
test('Ancien design : Empilés par défaut, réglage inconnu rejeté sans mutation',()=>{
  const d=defaultDesign();delete d.choiceComposition;const before=structuredClone(d);assert.equal(validateDesign(d).choiceComposition,'stacked');assert.deepEqual(d,before);
  assert.throws(()=>validateDesign({...d,choiceComposition:'unknown'}));
});
