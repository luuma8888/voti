import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {visualSetup,visualView,visualInteractionChecks,visualPdfs} from './browser-visual-identities.mjs';
export async function runVisualReview({command,evaluate,navigateReady,startDevServer,sessionId,url,requests,runtimeErrors}){
 await startDevServer();await navigateReady(sessionId,'http://127.0.0.1:4173/voti/');
 const fixture=await evaluate(sessionId,`(${visualSetup.toString()})()`),directory=resolve('.browser-tests/voti-visual-assets-review');await mkdir(directory,{recursive:true});let checks=0;const captures=[];
 // Vraie souris : un survol ne doit jamais écraser un choix cliqué.
 for(const width of [1440,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:width===1440?900:844,deviceScaleFactor:1,mobile:width<500},sessionId);
  for(const type of ['member','group']){
   checks+=await evaluate(sessionId,`(${visualView.toString()})(${JSON.stringify(fixture)},${JSON.stringify(type==='member'?'selector-all':'selector-group')})`);
   const targets=await evaluate(sessionId,`(()=>{const d=document.querySelector('.visual-selector'),box=b=>{const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id:b.dataset.visualId};};return{first:box(d.querySelectorAll('[data-visual-id]')[0]),second:box(d.querySelectorAll('[data-visual-id]')[1]),third:box(d.querySelectorAll('[data-visual-id]')[2]),accept:box(d.querySelector('.primary'))};})()`);
   const move=async p=>command('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y},sessionId);
   const click=async p=>{await move(p);for(const event of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type:event,x:p.x,y:p.y,button:'left',clickCount:1},sessionId);};
   const selected=async id=>{checks+=await evaluate(sessionId,`(()=>{const d=document.querySelector('.visual-selector'),b=d.querySelector('[data-visual-id="${id}"]');if(b.getAttribute('aria-pressed')!=='true'||d.querySelectorAll('[aria-pressed=true][data-visual-id]').length!==1)throw Error('Un survol a écrasé le choix cliqué');return 1;})()`);};
   await move(targets.second);await selected(targets.first.id);
   await click(targets.second);await selected(targets.second.id);
   await move(targets.third);await selected(targets.second.id);
   checks+=await evaluate(sessionId,`(()=>{const image=document.querySelector('.visual-selector-preview img');if(!image.src.includes('${targets.third.id}'))throw Error('Aperçu au survol perdu');return 1;})()`);
   // Traverser d'autres vignettes pour rejoindre Valider ne change pas le choix.
   await move(targets.first);await move(targets.accept);await selected(targets.second.id);
   // Le changement de filtre garde aussi le choix déjà explicite.
   if(type==='member'){
    checks+=await evaluate(sessionId,`(()=>{const d=document.querySelector('.visual-selector');d.querySelector('[data-category=creature]').click();d.querySelector('[data-category=all]').click();if(d.querySelector('[data-visual-id="${targets.second.id}"]').getAttribute('aria-pressed')!=='true')throw Error('Choix perdu au filtre');return 1;})()`);
   }
   await click(targets.accept);
   checks+=await evaluate(sessionId,`(async()=>{const end=performance.now()+5000;while(document.getElementById('app').querySelector('.visual-field')?.dataset.visualId!=='${targets.second.id}'){if(performance.now()>end)throw Error('Validation ne conserve pas le clic');await new Promise(requestAnimationFrame);}if(document.querySelector('.visual-selector'))throw Error('Dialogue non fermé');return 1;})()`);
  }
 }
 const views=['selector-all','selector-creature','selector-child','selector-adult','preview-creature','preview-child','preview-adult','detail-creature','detail-child','detail-adult','members','selector-group','detail-group','groups','card-creature','card-child','card-adult','card-groups','card-adult-night'];
 for(const width of [1440,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:width===1440?900:844,deviceScaleFactor:1,mobile:width<500},sessionId);
  for(const view of views){const start=requests.length;checks+=await evaluate(sessionId,`(${visualView.toString()})(${JSON.stringify(fixture)},${JSON.stringify(view)})`);
   // Une fiche peut charger son large avant l'ouverture. Le sélecteur lui-même
   // n'expose aucun large : assertion DOM ; le medium n'est que l'aperçu courant.
   if(view.startsWith('selector-')||view.startsWith('preview-'))checks+=await evaluate(sessionId,`(()=>{const d=document.querySelector('.visual-selector');if([...d.querySelectorAll('img')].some(i=>i.src.includes('/large/')))throw new Error('Large dans grille');return 1;})()`);
   const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId),name=view+'-'+width+'.png';await writeFile(resolve(directory,name),Buffer.from(shot.data,'base64'));captures.push(name);
  }
 }
 checks+=await evaluate(sessionId,`(${visualInteractionChecks.toString()})(${JSON.stringify(fixture)})`);
 await evaluate(sessionId,`document.querySelector('.visual-field button').click()`);
 for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
 checks+=await evaluate(sessionId,`(()=>{if(document.querySelector('.visual-selector')||document.activeElement!==document.querySelector('.visual-field button'))throw new Error('Escape/focus perdu');return 1;})()`);
 await evaluate(sessionId,`document.querySelector('.visual-field button').click();document.querySelector('.visual-selector-grid button').focus()`);
 for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},sessionId);
 checks+=await evaluate(sessionId,`(()=>{const d=document.querySelector('.visual-selector'),focused=d.querySelectorAll('[data-visual-id]')[1];if(document.activeElement!==focused||focused.getAttribute('aria-pressed')==='true'||!d.querySelector('.visual-selector-preview img').src.includes(focused.dataset.visualId))throw new Error('Flèches : aperçu sans sélection');return 1;})()`);
 for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})},sessionId);
 checks+=await evaluate(sessionId,`(()=>{const d=document.querySelector('.visual-selector');if(document.activeElement.getAttribute('aria-pressed')!=='true')throw new Error('Entrée : sélection clavier');d.querySelector('.visual-close').click();return 1;})()`);
 // Focus trap réel : Tab et Maj+Tab, puis toucher d'une vignette sur mobile.
 await evaluate(sessionId,`document.querySelector('.visual-field button').click();document.querySelector('.visual-selector .primary').focus()`);
 for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);
 checks+=await evaluate(sessionId,`(()=>{if(document.activeElement!==document.querySelector('.visual-close'))throw new Error('Focus trap Tab');return 1;})()`);
 for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8},sessionId);
 checks+=await evaluate(sessionId,`(()=>{if(document.activeElement!==document.querySelector('.visual-selector .primary'))throw new Error('Focus trap Maj+Tab');return 1;})()`);
 const touch=await evaluate(sessionId,`(()=>{const b=document.querySelectorAll('.visual-selector-grid button')[2],r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id:b.dataset.visualId};})()`);
 await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1},sessionId);
 await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touch.x,y:touch.y}]},sessionId);await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sessionId);
 checks+=await evaluate(sessionId,`(async()=>{const d=document.querySelector('.visual-selector'),end=performance.now()+5000;while(d.querySelector('[data-visual-id="${touch.id}"]').getAttribute('aria-pressed')!=='true'){if(performance.now()>end)throw new Error('Touch sélection');await new Promise(requestAnimationFrame);}d.querySelector('.visual-close').click();return 1;})()`);
 const pdfs=await evaluate(sessionId,`(${visualPdfs.toString()})(${JSON.stringify(fixture)})`),pdfRoot=resolve('.browser-tests/visual-member-cards');await mkdir(pdfRoot,{recursive:true});for(const pdf of pdfs)await writeFile(resolve(pdfRoot,pdf.name),Buffer.from(pdf.base64,'base64'));await writeFile(resolve(pdfRoot,'expected.json'),JSON.stringify(pdfs.map(({name,expected})=>({name,expected}))));
 const openingTimes=await evaluate(sessionId,`window.__visualOpenTimes??[]`);
 await command('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},sessionId);await navigateReady(sessionId,url);
 checks+=await evaluate(sessionId,`(async()=>{const {chooseVisual}=await import('voti/web/visual-selector.js'),{VISUAL_PRESETS}=await import('voti/web/visual-presets.js');void chooseVisual({type:'member'});const d=document.querySelector('.visual-selector');d.querySelector('[data-visual-id]').click();await d.querySelector('.visual-selector-preview img').decode();for(const tier of ['icon','medium','large']){const img=new Image();img.src=VISUAL_PRESETS.member.find(v=>v.category==='child')[tier];await img.decode();if(!img.naturalWidth)throw new Error('WebP offline indisponible');}d.querySelector('.visual-close').click();return 4;})()`);
 if(runtimeErrors.length)throw new Error('Exception navigateur visuels : '+runtimeErrors.join(','));if(requests.some(u=>/^https?:/.test(u)&&!u.startsWith('http://127.0.0.1:')))throw new Error('Réseau distant visuels.');
 await writeFile(resolve(directory,'index.html'),'<!doctype html><meta charset="utf-8"><title>Voti — illustrations locales</title><style>body{font-family:system-ui}section{display:inline-block;vertical-align:top;margin:12px}img{max-width:600px;max-height:700px;display:block}</style><h1>Fixtures locales — WebP originaux</h1>'+captures.map(n=>`<section><a href="${n}">${n}</a><img src="${n}"></section>`).join(''));
 const metrics=openingTimes;await writeFile(resolve(directory,'performance.json'),JSON.stringify({openingMilliseconds:metrics,uniqueLargeRequests:new Set(requests.filter(u=>u.includes('/voti-visuals/')&&u.includes('/large/'))).size}));
 console.log(`Identités visuelles Chromium : ${checks} contrôles, ${captures.length} captures réelles, 132/60/36/36 membres et 36 groupes, variantes progressives et dossier offline.`);
}
