/** Fonctions de recette sérialisées dans le vrai document autonome. */
export async function browserStudioScenario() {
  const {posterStudio,resultsPdfPanel}=await import('voti/web/poster-studio.js');
  const {PosterRepository}=await import('voti/web/poster-storage.js');
  const {IndexedDBAssetAdapter,assetDatabaseName}=await import('voti/web/asset-storage.js');
  const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js');
  const {emptyState}=await import('voti/shared/model.js');
  const {defaultDesign,POSTER_KEY}=await import('voti/web/poster-design.js');
  let checks=0;const assert=(v,m)=>{if(!v)throw new Error(m);checks++;};
  const wait=async f=>{const end=performance.now()+15000;while(!f()){if(performance.now()>end)throw new Error('Studio non prêt');await new Promise(requestAnimationFrame);}};
  let state=createPoll(emptyState(),{question:'Quelle sortie apprécier cet été ?',choices:['Forêt et pêche','Cinéma','Repas de famille']});state=publishPoll(state,state.polls[0].id);
  const poll=state.polls[0];poll.remoteRef={relayId:'voti-test',pollId:poll.id,revision:1};const before=JSON.stringify(poll),stored=localStorage.getItem('voti.local.v1');
  const adapter=new IndexedDBAssetAdapter(indexedDB,assetDatabaseName()+':studio-test'),repo=new PosterRepository(localStorage,adapter,navigator.locks);
  const errors=[];const view=posterStudio(poll,{repository:repo,pollAssets:new IndexedDBAssetAdapter(),error:e=>errors.push(e.message),notify:()=>{},refreshPoll:async()=>poll});document.body.append(view.element);
  const originalTheme=document.documentElement.dataset.theme;
  try {
    await wait(()=>view.element.dataset.previewVersion);
    const change=async(label,value)=>{const l=[...view.element.querySelectorAll('label')].find(n=>n.textContent===label),input=document.getElementById(l.htmlFor),version=view.element.dataset.previewVersion;input.value=value;input.dispatchEvent(new Event(input.type==='color'?'input':'change',{bubbles:true}));await wait(()=>view.element.dataset.previewVersion!==version);
      const key={'Disposition':'layout','Type d’affiche':'mode','Palette':'palette','Typographie':'typography'}[label];
      if(key)await wait(()=>repo.get(poll.id)[key]===value);if(label==='Principale')await wait(()=>repo.get(poll.id).customColors.primary===value);
    };
    for(const layout of ['essential','cards','magazine','mosaic']){await change('Disposition',layout);assert(view.element.querySelector('canvas').width===620,'Aperçu réduit');assert(repo.get(poll.id).layout===layout,'Design conservé');}
    await change('Type d’affiche','choices');await change('Palette','night');await change('Typographie','editorial');
    view.element.querySelector('details').open=true;
    const custom=[...view.element.querySelectorAll('label')].find(n=>n.textContent==='Couleurs personnalisées');document.getElementById(custom.htmlFor).click();await change('Principale','#ffff00');
    assert(repo.get(poll.id).customColors.primary==='#ffff00','Couleur custom persistée');
    const canvas=document.createElement('canvas');canvas.width=300;canvas.height=600;const context=canvas.getContext('2d');context.fillStyle='#6a4b95';context.fillRect(0,0,300,600);context.fillStyle='#f6ce8c';context.fillRect(25,80,250,380);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=1;
    async function image(label){const group=[...view.element.querySelectorAll('.image-picker')].find(n=>n.getAttribute('aria-label')===label),input=group.querySelector('input[type=file]'),transfer=new DataTransfer();transfer.items.add(new File([blob],'portrait.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change'));await wait(()=>!input.disabled&&group.querySelector('img')?.naturalWidth);return group;}
    const bg=await image('Image de fond d’affiche');await wait(()=>repo.get(poll.id).background.assetId);const imageId=repo.get(poll.id).background.assetId;
    await image('Image principale d’affiche');await image('Image d’affiche : Forêt et pêche');
    await repo.recover();assert(await adapter.has(imageId),'Médias affiche conservés au sweep');
    assert(JSON.stringify(poll)===before&&localStorage.getItem('voti.local.v1')===stored,'Médias sans mutation métier');
    await change('Mode du fond','contain');await change('Position du fond','bottom');await change('Voile du fond','dark');
    bg.querySelector('.quiet').click();await wait(()=>repo.get(poll.id).background.assetId===null);assert(await adapter.has(imageId),'Média partagé conservé après retrait fond');
    for(const theme of ['pop','nature','douceur','dark','minimal']){document.documentElement.dataset.theme=theme;
      assert(document.documentElement.scrollWidth<=innerWidth,'Studio sans overflow '+theme+'/'+innerWidth);
      assert([...view.element.querySelectorAll('button,select,input:not([hidden]),summary')].filter(n=>n.getBoundingClientRect().height).every(n=>n.getBoundingClientRect().height>=44),'Cibles Studio 44px');
      const control=view.element.querySelector('select');control.focus();assert(document.activeElement===control&&getComputedStyle(control).outlineStyle!=='none','Focus Studio visible');}
    const locked=resultsPdfPanel(poll,{available:false},{repository:repo,pollAssets:adapter,refreshPoll:async()=>{throw new Error('Ne doit pas consulter');},error:e=>errors.push(e.message),notify:()=>{}});document.body.append(locked);locked.open=true;
    assert(locked.querySelector('button').disabled&&locked.textContent.includes('Les résultats ne sont pas encore disponibles.'),'PDF résultats bloqué');locked.remove();
    if(innerWidth===360){
      const originalClick=HTMLAnchorElement.prototype.click,downloads=[];
      HTMLAnchorElement.prototype.click=function(){downloads.push({url:this.href,name:this.download});};
      const projection={available:true,totalBallots:15,choices:poll.definition.choices.map(c=>({id:c.id,label:c.label,count:5,percentage:100/3}))};
      let reads=0;const results=resultsPdfPanel(poll,projection,{repository:repo,pollAssets:adapter,refreshPoll:async()=>{reads++;return {poll,results:projection};},error:e=>errors.push(e.message),notify:()=>{}});
      document.body.append(results);results.open=true;
      try{
        const run=async(control,prefix)=>{const previous=downloads.length;control.click();control.click();await wait(()=>downloads.length===previous+1);const file=downloads[previous],bytes=new Uint8Array(await (await fetch(file.url)).arrayBuffer());assert(file.name.startsWith(prefix)&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-','Téléchargement UI PDF réel et unique');};
        await run([...view.element.querySelectorAll('button')].find(b=>b.textContent==='Télécharger le PDF'),'voti-affiche-');
        await run(results.querySelector('button'),'voti-resultats-');assert(reads===1,'Projection résultats relue avant export');
      }finally{HTMLAnchorElement.prototype.click=originalClick;results.remove();}
    }
    assert(errors.length===0,'Pas d’erreur Studio : '+errors.join(' / '));
  }finally{view.element.remove();view.dispose();document.documentElement.dataset.theme=originalTheme;await repo.remove(poll.id);assert((await adapter.listMetadata()).length===0,'Médias nettoyés après retrait du design');}
  return checks;
}

/** Une génération par appel CDP, avec vrais pixels/media locaux et PDF final. */
export async function browserStudioPdfScenario(layout,mode,n,kind='poster',long=false) {
  const {defaultDesign}=await import('voti/web/poster-design.js');
  const {makeStudioPlan,makeResultsPlan}=await import('voti/web/print-layout.js');
  const {printMeasure,loadPrintMedia,releasePrintMedia,exportPrintPdf}=await import('voti/web/print-renderer.js');
  const {MemoryAssetAdapter}=await import('voti/shared/assets.js');
  const {processImage}=await import('voti/web/image-processing.js');
  const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js');
  const {emptyState}=await import('voti/shared/model.js');
  let state=createPoll(emptyState(),{question:'Quelle activité choisir cet été ?',choices:Array.from({length:n},(_,i)=>`Réponse ${i+1} : forêt, cinéma, pêche`)});state=publishPoll(state,state.polls[0].id);const poll=state.polls[0];poll.remoteRef={relayId:'voti-test',pollId:poll.id,revision:1};
  if(long){poll.definition.question=('Été, Noël et activités : quel choix pour notre groupe ? '.repeat(6)).slice(0,240);poll.definition.description=('Un contexte important, avec accents français et bien des détails. '.repeat(20)).slice(0,1000);poll.definition.choices.forEach(c=>c.label=('Une réponse détaillée : forêt, pêche et cinéma, à Noël et en été. '.repeat(2)).slice(0,100));}
  const design=defaultDesign();design.layout=layout;design.mode=kind==='results'?'access':mode;design.palette=kind==='results'?(long?'ivory':mode==='report'?'lavender':n===2?'pop':n===3?'peach':'night'):{essential:'ivory',cards:'lagoon',magazine:'night',mosaic:'peach'}[layout];design.typography=layout==='magazine'?'editorial':'modern';
  const adapter=new MemoryAssetAdapter();
  for(const [index,[w,h]] of [[300,600],[600,300],[400,400]].entries()){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.fillStyle=index===1?'#f5efdd':'#202638';c.fillRect(0,0,w,h);c.fillStyle=['#daa980','#416f74','#b6a1dc'][index];c.fillRect(20,25,w-40,h-50);c.fillStyle='#ffffff';c.font='bold 28px system-ui';c.fillText(['Portrait','Paysage','Carré'][index],40,70);
    const asset=await processImage(await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),'poll');canvas.width=canvas.height=1;await adapter.put(asset);
    if(index===0)design.media.main=asset.id;if(index===1)design.background.assetId=asset.id;if(index===2)for(const choice of poll.definition.choices)design.media.choices[choice.id]=asset.id;
  }
  const measure=printMeasure();let media;
  try{
    const counts=kind==='results'&&n===2?[10,0]:Array(n).fill(5),total=counts.reduce((a,b)=>a+b,0);
    const projection={available:true,totalBallots:total,choices:poll.definition.choices.map((c,i)=>({id:c.id,label:c.label,count:counts[i],percentage:counts[i]/total*100}))};
    if(kind==='results'&&mode==='report')poll.status='closed';
    const plan=kind==='results'?makeResultsPlan(poll,projection,design,{style:mode,usePosterMedia:true,exportDate:new Date('2026-10-12T12:00:00Z'),measure:measure.measure}):makeStudioPlan(poll,design,{measure:measure.measure});
    media=await loadPrintMedia(plan,adapter,adapter);const {bytes}=await exportPrintPdf(plan,{media,logo:document.querySelector('.brand-icon')});
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {name:`v04b-${kind}-${layout}-${mode}-${n}${long?'-long':''}.pdf`,layout,mode,kind,theme:design.palette,width:plan.width,height:plan.height,pages:plan.pages.length,base64:btoa(binary),
      qrs:plan.pages.map(p=>p.qrs.map(q=>({url:q.url,x:q.x,y:q.y,size:q.size}))),items:plan.pages.map(p=>p.items)};
  }finally{measure.release();if(media)releasePrintMedia(media);}
}
