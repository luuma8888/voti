/** Fonctions de recette sérialisées dans le vrai document autonome. */
export async function browserStudioScenario() {
  const {posterStudio,resultsPdfPanel}=await import('voti/web/poster-studio.js');
  const {PosterRepository}=await import('voti/web/poster-storage.js');
  const {IndexedDBAssetAdapter,assetDatabaseName}=await import('voti/web/asset-storage.js');
  const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js');
  const {emptyState}=await import('voti/shared/model.js');
  const {defaultDesign,POSTER_KEY,PALETTES,TITLE_TYPOGRAPHIES,BODY_TYPOGRAPHIES}=await import('voti/web/poster-design.js');
  let checks=0;const assert=(v,m)=>{if(!v)throw new Error(m);checks++;};
  const wait=async f=>{const end=performance.now()+15000;while(!f()){if(performance.now()>end)throw new Error('Studio non prêt');await new Promise(requestAnimationFrame);}};
  let state=createPoll(emptyState(),{question:'Quelle sortie apprécier cet été ?',choices:['Forêt et pêche','Cinéma','Repas de famille']});state=publishPoll(state,state.polls[0].id);
  const poll=state.polls[0];poll.remoteRef={relayId:'voti-test',pollId:poll.id,revision:1};const before=JSON.stringify(poll),stored=localStorage.getItem('voti.local.v1');
  const adapter=new IndexedDBAssetAdapter(indexedDB,assetDatabaseName()+':studio-test'),repo=new PosterRepository(localStorage,adapter,navigator.locks);
  const errors=[];const view=posterStudio(poll,{repository:repo,pollAssets:new IndexedDBAssetAdapter(),error:e=>errors.push(e.message),notify:()=>{},refreshPoll:async()=>poll});document.body.append(view.element);
  const originalTheme=document.documentElement.dataset.theme;
  try {
    await wait(()=>view.element.dataset.previewVersion);
    const openGroup=control=>{if(innerWidth<960)view.element.querySelector('.studio-view-switch button').click();const section=control.closest('.studio-section');if(section)section.open=true;};
    assert(view.element.querySelectorAll('.studio-section').length===6&&view.element.querySelectorAll('.studio-section[open]').length===1,'Six catégories, seule la composition ouverte');
    assert(view.element.querySelector('.studio-controls').nextElementSibling.classList.contains('studio-preview'),'Formulaire gauche, aperçu droite');
    const previewBox=view.element.querySelector('.studio-preview'),sheet=view.element.querySelector('.studio-sheets');
    assert(getComputedStyle(view.element.querySelector('.studio-controls')).overflowY==='auto','Défilement indépendant du formulaire');
    const zoom=[...view.element.querySelectorAll('button')].find(b=>b.textContent==='Agrandir pour lire');assert(previewBox.classList.contains('studio-fit-page'),'Page entière par défaut');zoom.click();assert(!previewBox.classList.contains('studio-fit-page')&&zoom.textContent==='Voir la page entière','Lecture agrandie explicite');zoom.click();assert(previewBox.classList.contains('studio-fit-page'),'Retour à la page entière');
    const change=async(label,value)=>{const l=[...view.element.querySelectorAll('label')].find(n=>n.textContent===label),input=document.getElementById(l.htmlFor),version=view.element.dataset.previewVersion;openGroup(input);input.value=value;input.dispatchEvent(new Event(input.type==='color'?'input':'change',{bubbles:true}));try{await wait(()=>view.element.dataset.previewVersion!==version);}catch(e){throw new Error(label+' : '+errors.join(' / ')+' / '+e.message);}
      const key={'Disposition':'layout','Type d’affiche':'mode','Palette':'palette'}[label];
      if(key)await wait(()=>repo.get(poll.id)[key]===value);if(label==='Principale')await wait(()=>repo.get(poll.id).customColors.primary===value);
    };
    const colorInput=label=>document.getElementById([...view.element.querySelectorAll('label')].find(n=>n.textContent===label).htmlFor);
    for(const palette of PALETTES){await change('Palette',palette[0]);assert(colorInput('Principale').value===palette[4]&&colorInput('Secondaire').value===palette[5]&&colorInput('Fond').value===palette[2],'Palette '+palette[1]+' synchronisée');}
    await change('Palette','lagoon');await change('Palette','garden');
    const oldCanvas=view.element.querySelector('canvas').toDataURL();await change('Secondaire','#ffcc00');
    await wait(()=>repo.get(poll.id).customColors.secondary==='#ffcc00');
    assert(view.element.querySelector('.color-mode').textContent.startsWith('Personnalisé'),'Mode personnalisé explicite');assert(view.element.querySelector('canvas').toDataURL()!==oldCanvas,'Secondaire change les pixels réels');
    await change('Palette','lagoon');assert(colorInput('Secondaire').value==='#ffcc00','Palette ne remplace pas le custom');
    [...view.element.querySelectorAll('button')].find(b=>b.textContent==='Revenir à la palette').click();await wait(()=>!repo.get(poll.id).customColors.enabled);assert(colorInput('Secondaire').value===PALETTES.find(p=>p[0]==='lagoon')[5],'Retour palette synchronisé');
    for(const [kind,list] of [['title',TITLE_TYPOGRAPHIES],['body',BODY_TYPOGRAPHIES]]){
      const group=[...view.element.querySelectorAll('.typography-choices')].find(g=>g.querySelector('legend').textContent===(kind==='title'?'Typographie du titre':'Typographie du texte'));
      openGroup(group);
      assert(group.querySelector('label').getBoundingClientRect().width>group.clientWidth*.8,'Options typographiques en une colonne');
      assert(group.querySelectorAll('input').length===list.length,'Variété typographique');
      for(const [id,,family] of list){const version=view.element.dataset.previewVersion,input=group.querySelector(`input[value="${id}"]`);if(!input.checked){input.click();await wait(()=>view.element.dataset.previewVersion!==version&&repo.get(poll.id)[kind+'Typography']===id);}assert(input.checked&&input.nextElementSibling.style.fontFamily.includes(family.split(',')[0].replaceAll('"','')),'Prévisualisation typo');}
    }
    for(const [label,value] of [['En-tête Voti','hidden'],['Surface QR','minimal'],['Fond des textes','0.65'],['Densité','compact'],['Choix par ligne','3'],['Taille des QR','small']])await change(label,value);
    for(const layout of ['essential','cards','magazine','mosaic']){await change('Disposition',layout);assert(view.element.querySelector('canvas').width===900,'Aperçu lisible à résolution bornée');assert(repo.get(poll.id).layout===layout,'Design conservé');}
    await change('Type d’affiche','choices');await change('Palette','night');
    view.element.querySelector('.typography-choices input[value=editorial]').click();
    await change('Principale','#ffff00');
    assert(repo.get(poll.id).customColors.primary==='#ffff00','Couleur custom persistée');
    const canvas=document.createElement('canvas');canvas.width=300;canvas.height=600;const context=canvas.getContext('2d');context.fillStyle='#6a4b95';context.fillRect(0,0,300,600);context.fillStyle='#f6ce8c';context.fillRect(25,80,250,380);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=1;
    async function image(label){const group=[...view.element.querySelectorAll('.image-picker')].find(n=>n.getAttribute('aria-label')===label),input=group.querySelector('input[type=file]'),transfer=new DataTransfer();openGroup(group);transfer.items.add(new File([blob],'portrait.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change'));await wait(()=>!input.disabled&&group.querySelector('img')?.naturalWidth);return group;}
    const bg=await image('Image de fond d’affiche');await wait(()=>repo.get(poll.id).background.assetId);const imageId=repo.get(poll.id).background.assetId;
    await image('Image principale d’affiche');await image('Image d’affiche : Forêt et pêche');
    const crop=[...view.element.querySelectorAll('.focal-control')].find(g=>g.querySelector('legend').textContent==='Cadrage : Image principale d’affiche');
    openGroup(crop);
    assert(crop&&!crop.hidden,'Cadrage visible');
    await wait(()=>crop.querySelector('img')?.naturalWidth);
    const focalX=[...crop.querySelectorAll('label')].find(n=>n.textContent==='Position horizontale').control;
    assert(focalX.disabled,'Image entière : aucun faux cadrage actif');
    const ratio=crop.querySelector('select');ratio.value='1:1';ratio.dispatchEvent(new Event('change'));
    await wait(()=>!focalX.disabled);
    const rect=crop.querySelector('.focal-preview').getBoundingClientRect(),preview=crop.querySelector('.focal-preview');
    for(const type of ['pointerdown','pointermove','pointerup'])preview.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',button:0,clientX:rect.left+rect.width*.5,clientY:rect.top+rect.height*.8}));
    await wait(()=>repo.get(poll.id).imageSettings.main?.focalY>.7);assert(repo.get(poll.id).imageSettings.main.focalY>.7,'Point focal tactile simulé conservé');
    [...crop.querySelectorAll('button')].find(b=>b.textContent==='Gauche').click();await wait(()=>repo.get(poll.id).imageSettings.main.focalX<.5);
    [...crop.querySelectorAll('button')].find(b=>b.textContent==='Réinitialiser au centre').click();await wait(()=>repo.get(poll.id).imageSettings.main.focalX===.5&&repo.get(poll.id).imageSettings.main.focalY===.5);assert(true,'Clavier/directions et reset centre');
    for(const value of ['original','1:1','16:9','9:16','3:4','4:3']){ratio.value=value;ratio.dispatchEvent(new Event('change'));await wait(()=>repo.get(poll.id).imageSettings.main.ratio===value);assert(true,'Ratio '+value);}
    for(const [text,key,values] of [['Hauteur de la zone','height',[80,400,810,1600]],['Alignement du cadre','align',['left','right','center']]]){
      const select=[...crop.querySelectorAll('label')].find(n=>n.textContent===text).control;
      for(const value of values){select.value=value;select.dispatchEvent(new Event('input'));select.dispatchEvent(new Event('change'));await wait(()=>repo.get(poll.id).imageSettings.main[key]===value);assert(true,text+' '+value);}
    }
    ratio.value='full-width';ratio.dispatchEvent(new Event('change'));await wait(()=>repo.get(poll.id).imageSettings.main.ratio==='full-width');assert(!focalX.disabled,'Pleine largeur : cadrage disponible');
    const heightInput=[...crop.querySelectorAll('label')].find(n=>n.textContent==='Hauteur de la zone').control;
    let previousPixels;
    for(const height of [100,500]){
      const previousVersion=view.element.dataset.previewVersion;
      heightInput.value=height;heightInput.dispatchEvent(new Event('input'));heightInput.dispatchEvent(new Event('change'));
      await wait(()=>view.element.dataset.previewVersion!==previousVersion&&repo.get(poll.id).imageSettings.main.height===height);
      const pixels=view.element.querySelector('.studio-sheets canvas').toDataURL();
      if(previousPixels)assert(pixels!==previousPixels,'Hauteur principale : changement des pixels réels de l’affiche');
      previousPixels=pixels;
    }
    assert(![...view.element.querySelectorAll('.focal-control')].filter(n=>n!==crop).some(n=>n.querySelector('option[value="full-width"]')),'Pleine largeur réservée à la principale');
    [...crop.querySelectorAll('button')].find(b=>b.textContent==='Hauteur automatique').click();await wait(()=>repo.get(poll.id).imageSettings.main.height==='auto');assert(true,'Retour Auto préservé');
    ratio.value='original';ratio.dispatchEvent(new Event('change'));await wait(()=>repo.get(poll.id).imageSettings.main.ratio==='original');
    await change('Image et QR','side-by-side');await wait(()=>repo.get(poll.id).choiceComposition==='side-by-side');assert(true,'Image et QR côte à côte conservé');
    await change('Image et QR','stacked');await wait(()=>repo.get(poll.id).choiceComposition==='stacked');assert(true,'Retour Empilés conservé');
    await repo.recover();assert(await adapter.has(imageId),'Médias affiche conservés au sweep');
    assert(JSON.stringify(poll)===before&&localStorage.getItem('voti.local.v1')===stored,'Médias sans mutation métier');
    await change('Mode du fond','contain');await change('Position du fond','bottom');await change('Voile du fond','dark');
    bg.querySelector('.quiet').click();await wait(()=>repo.get(poll.id).background.assetId===null);assert(await adapter.has(imageId),'Média partagé conservé après retrait fond');
    for(const theme of ['pop','nature','douceur','dark','minimal']){document.documentElement.dataset.theme=theme;
      assert(document.documentElement.scrollWidth<=innerWidth,'Studio sans overflow '+theme+'/'+innerWidth);
      assert([...view.element.querySelectorAll('button,select,input:not([hidden]),summary')].filter(n=>n.getBoundingClientRect().height).every(n=>n.getBoundingClientRect().height>=44),'Cibles Studio 44px');
      const control=view.element.querySelector('.studio-controls select');openGroup(control);control.focus();assert(document.activeElement===control&&getComputedStyle(control).outlineStyle!=='none','Focus Studio visible');}
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

/** Géométrie et captures dans la largeur réelle de main, avec un faux sondage. */
export async function browserStudioWorkspace(stage='mount') {
  const wait=async f=>{const end=performance.now()+15000;while(!f()){if(performance.now()>end)throw new Error('Espace Studio non prêt');await new Promise(requestAnimationFrame);}};
  if(stage==='mount') {
    const {posterStudio}=await import('voti/web/poster-studio.js');
    const {PosterRepository}=await import('voti/web/poster-storage.js');
    const {MemoryAssetAdapter}=await import('voti/shared/assets.js');
    const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js');
    const {emptyState}=await import('voti/shared/model.js');
    let state=createPoll(emptyState(),{question:'Quelle pizza partager ensemble ?',choices:['4 fromages','Margherita','Végétarienne']});state=publishPoll(state,state.polls[0].id);
    const poll=state.polls[0];poll.remoteRef={relayId:'fixture',pollId:poll.id,revision:1};
    const repo=new PosterRepository(localStorage,new MemoryAssetAdapter(),navigator.locks),errors=[];
    const view=posterStudio(poll,{repository:repo,error:e=>errors.push(e.message),notify:()=>{},refreshPoll:async()=>poll});
    const app=document.getElementById('app'),original=[...app.childNodes],title=document.createElement('h1');title.textContent='Studio d’affiche';app.replaceChildren(title,view.element);
    window.__votiStudioWorkspaceTest={view,repo,poll,original,errors};window.scrollTo(0,0);await wait(()=>view.element.dataset.previewVersion&&view.element.style.getPropertyValue('--studio-height'));return 1;
  }
  const {view,repo,poll,original,errors}=window.__votiStudioWorkspaceTest;
  if(stage==='cleanup'){view.dispose();document.getElementById('app').replaceChildren(...original);delete window.__votiStudioWorkspaceTest;await repo.remove(poll.id);window.scrollTo(0,0);return 1;}
  const preview=view.element.querySelector('.studio-preview'),sheet=view.element.querySelector('.studio-sheets'),sections=view.element.querySelectorAll('.studio-section'),controls=view.element.querySelector('.studio-controls');
  const pane=name=>{if(innerWidth<960)[...view.element.querySelectorAll('.studio-view-switch button')].find(b=>b.textContent===name).click();};
  const frame=async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);};
  if(stage==='prepare-keyboard'){if(preview.classList.contains('studio-fit-page'))[...preview.querySelectorAll('button')].find(b=>b.textContent==='Agrandir pour lire').click();sheet.focus({preventScroll:true});return 1;}
  if(stage==='keyboard-scroll'){await wait(()=>sheet.scrollTop>0);pane('Réglages');await frame();const before=preview.getBoundingClientRect().toJSON(),summary=sections[3].querySelector('summary');summary.focus();await frame();const target=summary.getBoundingClientRect(),area=controls.getBoundingClientRect();if(target.top<area.top||target.bottom>area.bottom)throw new Error('Focus clavier hors du formulaire');if(innerWidth>=960&&Math.abs(preview.getBoundingClientRect().top-before.top)>1)throw new Error('Le focus formulaire déplace l’aperçu');return 2;}
  if(stage==='keyboard-open'){await wait(()=>sections[3].open);if(sections[2].open||view.element.querySelectorAll('.studio-section[open]').length!==1)throw new Error('Accordéon clavier non exclusif');return 1;}
  if(stage==='pages') {
    for(const [label,value] of [['Type d’affiche','choices'],['Choix par ligne','1'],['Densité','airy'],['Taille des QR','large']]){const title=[...view.element.querySelectorAll('label')].find(n=>n.textContent===label),input=document.getElementById(title.htmlFor);input.value=value;input.dispatchEvent(new Event('change'));}
    const page=view.element.querySelector('[aria-label="Page de l’aperçu"]');await wait(()=>page.options.length>1&&repo.get(poll.id).qrSize==='large');
    pane('Aperçu');await frame();
    page.value='1';page.dispatchEvent(new Event('change'));
    await wait(()=>view.element.querySelector('.studio-sheets canvas')?.getAttribute('aria-label').includes('page 2 sur'));
    if(view.element.querySelectorAll('.studio-sheets canvas').length!==1)throw new Error('L’aperçu conserve plusieurs canvases');
    return 2;
  }
  pane('Réglages');sections[2].open=true;await frame();
  const before=preview.getBoundingClientRect().toJSON(),summary=sections[2].querySelector('summary');controls.scrollTop+=summary.getBoundingClientRect().top-controls.getBoundingClientRect().top-8;await frame();
  if(innerWidth>=960){const rect=preview.getBoundingClientRect(),left=controls.getBoundingClientRect();if(left.width>310||rect.left<left.right+8||rect.top<0||rect.bottom>innerHeight-8||rect.height<innerHeight*.6||sheet.clientHeight<innerHeight*.42||Math.abs(rect.top-before.top)>1)throw new Error('Formulaire gauche/aperçu haut droite incorrect : '+JSON.stringify({width:innerWidth,preview:rect.toJSON(),form:left.toJSON(),sheetHeight:sheet.clientHeight}));if(controls.scrollTop<=0)throw new Error('Le formulaire ne défile pas indépendamment');}
  else {pane('Aperçu');await frame();if(getComputedStyle(controls).display!=='none'||preview.getBoundingClientRect().height<innerHeight*.5)throw new Error('Bascule mobile ou hauteur aperçu incorrecte');}
  if(!preview.classList.contains('studio-fit-page'))[...preview.querySelectorAll('button')].find(b=>b.textContent==='Voir la page entière').click();
  if(document.documentElement.scrollWidth>innerWidth||sections[0].open||!sections[2].open)throw new Error('Accordéon ou largeur incorrect');
  sheet.focus({preventScroll:true});if(document.activeElement!==sheet||getComputedStyle(sheet).outlineStyle==='none')throw new Error('Aperçu non accessible au clavier');
  const canvas=sheet.querySelector('canvas');if(canvas.getBoundingClientRect().height>sheet.clientHeight||!view.element.querySelector('.studio-fit-page'))throw new Error('La page A4 entière ne tient pas en hauteur');
  if(errors.length)throw new Error(errors.join(' / '));
  return 5;
}

/** Une génération par appel CDP, avec vrais pixels/media locaux et PDF final. */
export async function browserStudioPdfScenario(layout,mode,n,kind='poster',long=false,polish=null,choiceHeight=null) {
  const {defaultDesign}=await import('voti/web/poster-design.js');
  const {makeStudioPlan,makeResultsPlan}=await import('voti/web/print-layout.js');
  const {printMeasure,loadPrintMedia,releasePrintMedia,exportPrintPdf,printMediaSizes}=await import('voti/web/print-renderer.js');
  const {MemoryAssetAdapter}=await import('voti/shared/assets.js');
  const {processImage}=await import('voti/web/image-processing.js');
  const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js');
  const {emptyState}=await import('voti/shared/model.js');
  let state=createPoll(emptyState(),{question:'Quelle activité choisir cet été ?',choices:Array.from({length:n},(_,i)=>`Réponse ${i+1} : forêt, cinéma, pêche`)});state=publishPoll(state,state.polls[0].id);const poll=state.polls[0];poll.remoteRef={relayId:'voti-test',pollId:poll.id,revision:1};
  if(long){poll.definition.question=('Été, Noël et activités : quel choix pour notre groupe ? '.repeat(6)).slice(0,240);poll.definition.description=('Un contexte important, avec accents français et bien des détails. '.repeat(20)).slice(0,1000);poll.definition.choices.forEach(c=>c.label=('Une réponse détaillée : forêt, pêche et cinéma, à Noël et en été. '.repeat(2)).slice(0,100));}
  const design=defaultDesign();design.layout=layout;design.mode=kind==='results'?'access':mode;design.palette=kind==='results'?(long?'ivory':mode==='report'?'lavender':n===2?'pop':n===3?'peach':'night'):{essential:'ivory',cards:'lagoon',magazine:'night',mosaic:'peach'}[layout];design.typography=layout==='magazine'?'editorial':'modern';
  if(polish)Object.assign(design,polish);
  const adapter=new MemoryAssetAdapter();
  for(const [index,[w,h]] of [[300,600],[600,300],[400,400]].entries()){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.fillStyle=index===1?'#f5efdd':'#202638';c.fillRect(0,0,w,h);c.fillStyle=['#daa980','#416f74','#b6a1dc'][index];c.fillRect(20,25,w-40,h-50);c.fillStyle='#ffffff';c.font='bold 28px system-ui';c.fillText(['Portrait','Paysage','Carré'][index],40,70);
    const asset=await processImage(await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),'poll');canvas.width=canvas.height=1;await adapter.put(asset);
    if(index===0)design.media.main=asset.id;if(index===1)design.background.assetId=asset.id;if(index===2)for(const choice of poll.definition.choices)design.media.choices[choice.id]=asset.id;
  }
  if(polish){for(const [i,key] of ['main','background',...poll.definition.choices.map(c=>c.id)].entries())design.imageSettings[key]={ratio:['original','16:9','1:1','9:16','3:4','4:3'][i%6],fit:i%2?'contain':'cover',focalX:i%2?1:0,focalY:i%3?1:0,...(polish.imageSettings?.[key]||{})};}
  if(choiceHeight!==null)for(const choice of poll.definition.choices)design.imageSettings[choice.id]={ratio:'1:1',fit:'cover',focalX:.5,focalY:.5,height:choiceHeight,align:'center'};
  const measure=printMeasure();let media;
  try{
    const counts=kind==='results'&&n===2?[10,0]:Array(n).fill(5),total=counts.reduce((a,b)=>a+b,0);
    const projection={available:true,totalBallots:total,choices:poll.definition.choices.map((c,i)=>({id:c.id,label:c.label,count:counts[i],percentage:counts[i]/total*100}))};
    if(kind==='results'&&mode==='report')poll.status='closed';
    const mediaSizes=await printMediaSizes(poll,design,adapter,adapter);
    const plan=kind==='results'?makeResultsPlan(poll,projection,design,{style:mode,usePosterMedia:true,exportDate:new Date('2026-10-12T12:00:00Z'),measure:measure.measure,mediaSizes}):makeStudioPlan(poll,design,{measure:measure.measure,mediaSizes});
    media=await loadPrintMedia(plan,adapter,adapter);const {bytes}=await exportPrintPdf(plan,{media,logo:document.querySelector('.brand-icon')});
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {name:`${polish?'v04c':'v04b'}-${kind}-${layout}-${mode}-${n}${long?'-long':''}${polish?'-'+(design.choicesPerRow)+'-'+design.headerMode:''}.pdf`,layout,mode,kind,theme:design.palette,width:plan.width,height:plan.height,pages:plan.pages.length,base64:btoa(binary),
      qrs:plan.pages.map(p=>p.qrs.map(q=>({url:q.url,x:q.x,y:q.y,size:q.size}))),items:plan.pages.map(p=>p.items),images:plan.pages.map(p=>p.nodes.filter(n=>n.type==='image'))};
  }finally{measure.release();if(media)releasePrintMedia(media);}
}
