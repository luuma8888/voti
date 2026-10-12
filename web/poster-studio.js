import { validateDesign, designRefs, LAYOUTS, PALETTES, TYPOGRAPHIES } from './poster-design.js';
import { makeStudioPlan, makeResultsPlan } from './print-layout.js';
import { loadPrintMedia, releasePrintMedia, printMeasure, paintPrintPage, exportPrintPdf } from './print-renderer.js';
import { ImageViews, imagePicker } from './image-ui.js';
import { downloadBlob } from './qr.js';
import { processImage } from './image-processing.js';

const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
const button=(label,action)=>{const n=node('button',label);n.type='button';n.addEventListener('click',action);return n;};
function field(label,input){const box=node('div',null,'field'),id='print-'+crypto.randomUUID();input.id=id;const title=node('label',label);title.htmlFor=id;box.append(title,input);return box;}
function select(label,options,value,change){const input=node('select');for(const [v,l] of options){const o=node('option',l);o.value=v;input.append(o);}input.value=value;input.addEventListener('change',()=>change(input.value));return field(label,input);}
function check(label,value,change){const input=node('input');input.type='checkbox';input.checked=value;input.addEventListener('change',()=>change(input.checked));return field(label,input);}

/** Studio local : rendu et stockage indépendants des opérations du relais. */
export function posterStudio(poll,{repository,pollAssets,error,notify,refreshPoll,onReset=()=>{}}) {
  const box=node('section',null,'poster-studio card'),controls=node('div',null,'studio-controls'),preview=node('div',null,'studio-preview');
  const saved=repository.get(poll.remoteRef.pollId);let design=structuredClone(saved),lastSaved=saved,disposed=false,version=0,busy=0,queue=Promise.resolve();
  const choices=new Set(poll.definition.choices.map(c=>c.id));
  for(const id of Object.keys(design.media.choices))if(!choices.has(id))delete design.media.choices[id];
  const staged=new Map(),views=new ImageViews(repository.assets),canvases=[];
  let imageQueue=Promise.resolve();
  const prepareImage=(file,kind)=>{
    const task=imageQueue.then(()=>{if(disposed)throw new Error('Préparation annulée : Studio fermé.');return processImage(file,kind);});
    imageQueue=task.catch(()=>{});return task;
  };
  const status=node('p','Préparation de l’aperçu…','help');status.setAttribute('role','status');
  box.append(node('p','Personnalise ton affiche, sans changer le sondage ni les images vues par les votants.','help'));
  const layout=node('div',null,'studio-grid');layout.append(controls,preview);box.append(layout);
  preview.append(node('h2','Aperçu'),status);const sheets=node('div',null,'studio-sheets');preview.append(sheets);
  function freeCanvas(){for(const canvas of canvases)canvas.width=canvas.height=1;canvases.length=0;sheets.replaceChildren();}
  async function draw(){
    const current=++version,snapshot=structuredClone(design),measure=printMeasure();let media;
    try {
      const plan=makeStudioPlan(poll,snapshot,{measure:measure.measure});
      const source={get:async id=>staged.get(id)||repository.assets.get(id)};
      media=await loadPrintMedia(plan,source,pollAssets);if(disposed||current!==version)return;
      freeCanvas();
      for(let index=0;index<plan.pages.length;index++){
        const canvas=node('canvas');canvas.width=620;canvas.height=Math.round(620*plan.height/plan.width);
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Aperçu ${LAYOUTS.find(l=>l[0]===snapshot.layout)[1]}, page ${index+1} sur ${plan.pages.length}`);
        paintPrintPage(canvas,plan,index,{media,logo:document.querySelector('.brand-icon')});canvases.push(canvas);sheets.append(canvas);
      }
      status.textContent=`${plan.pages.length} page(s) A4 · aperçu réduit, PDF haute résolution au téléchargement.`;
      box.dataset.previewVersion=String(current);
    } catch(e){if(!disposed&&current===version){status.textContent='Aperçu indisponible.';error(e);}}
    finally{measure.release();if(media)releasePrintMedia(media);}
  }
  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(!disposed)draw();});}
  function save(){
    const snapshot=structuredClone(design),media=[...staged.values()];
    queue=queue.then(async()=>{lastSaved=await repository.save(poll.remoteRef.pollId,snapshot,media,lastSaved);const keep=designRefs(design);for(const id of staged.keys())if(!keep.has(id))staged.delete(id);if(!disposed){notify(repository.warning||'Réglages de l’affiche conservés sur cet appareil.');}}).catch(e=>{if(!disposed)error(e);throw e;});
    // Une erreur interrompt la file pour empêcher d'écraser une modification concurrente.
    queue.catch(()=>{});schedule();
  }
  const set=(key,value)=>{design[key]=value;save();};
  controls.append(select('Type d’affiche',[['access','QR d’accès'],['choices','QR par choix']],design.mode,v=>set('mode',v)),
    select('Disposition',LAYOUTS,design.layout,v=>set('layout',v)),select('Palette',PALETTES.map(p=>[p[0],p[1]]),design.palette,v=>set('palette',v)),
    select('Typographie',TYPOGRAPHIES.map(p=>[p[0],p[1]]),design.typography,v=>set('typography',v)));
  const advanced=node('details',null,'advanced');advanced.append(node('summary','Options avancées'));controls.append(advanced);
  advanced.append(check('Couleurs personnalisées',design.customColors.enabled,v=>{design.customColors.enabled=v;save();}));
  for(const [key,label] of [['primary','Principale'],['secondary','Secondaire'],['bg','Fond']]){
    const input=node('input');input.type='color';input.value=design.customColors[key];const value=node('output',input.value);
    input.addEventListener('input',()=>{design.customColors[key]=input.value;value.textContent=input.value;save();});const group=field(label,input);group.append(value);advanced.append(group);
  }
  const mediaBox=node('div');advanced.append(mediaBox);
  function picker(label,kind,get,setId){
    const group=imagePicker({label,kind,getId:get,staged,views,active:()=>!disposed,prepareImage,
      change:asset=>{if(asset)staged.set(asset.id,asset);setId(asset?.id||null);save();},busy:delta=>{busy+=delta;download.disabled=busy>0;},
      error,statusReady:'Image prête. Cette image personnalise seulement l’affiche.'});
    group.prepend(node('h3',label));mediaBox.append(group);
  }
  picker('Image de fond d’affiche','poll',()=>design.background.assetId,id=>design.background.assetId=id);
  advanced.append(select('Mode du fond',[['cover','Remplir'],['contain','Ajuster']],design.background.fit,v=>{design.background.fit=v;save();}),
    select('Position du fond',[['top','Haut'],['center','Centre'],['bottom','Bas']],design.background.position,v=>{design.background.position=v;save();}),
    select('Voile du fond',[['light','Clair'],['dark','Sombre']],design.background.veil,v=>{design.background.veil=v;save();}));
  const intensity=node('input');intensity.type='range';intensity.min='0';intensity.max='60';intensity.step='5';intensity.value=design.background.intensity*100;
  const intensityValue=node('output',intensity.value+' %');intensity.addEventListener('input',()=>{design.background.intensity=Number(intensity.value)/100;intensityValue.textContent=intensity.value+' %';save();});
  const range=field('Intensité de l’image de fond',intensity);range.append(intensityValue);advanced.append(range);
  advanced.append(check('Utiliser les images du sondage disponibles sur cet appareil',design.usePollImages,v=>set('usePollImages',v)),
    node('p','Cette image personnalise seulement l’affiche. Aucun média du Studio n’est envoyé au relais.','help'));
  picker('Image principale d’affiche','poll',()=>design.media.main,id=>design.media.main=id);
  for(const choice of poll.definition.choices)picker(`Image d’affiche : ${choice.label}`,'choice',()=>design.media.choices[choice.id]||null,id=>{if(id)design.media.choices[choice.id]=id;else delete design.media.choices[choice.id];});
  const download=button('Télécharger le PDF',async()=>{
    if(download.disabled)return;download.disabled=true;let media;const measure=printMeasure();
    try {await queue;if(disposed)return;
      // Relire la présence/les textes publics au téléchargement, jamais republier.
      const current=await refreshPoll();if(disposed)return;
      const plan=makeStudioPlan(current,validateDesign(design),{measure:measure.measure});media=await loadPrintMedia(plan,repository.assets,pollAssets);
      const result=await exportPrintPdf(plan,{media,logo:document.querySelector('.brand-icon')});
      if(!disposed){downloadBlob(new Blob([result.bytes],{type:'application/pdf'}),`voti-affiche-${poll.remoteRef.pollId}-${design.mode}.pdf`);notify(`Affiche prête : ${plan.pages.length} page(s).`);}
    }catch(e){if(!disposed)error(e);}finally{if(media)releasePrintMedia(media);measure.release();download.disabled=busy>0;}
  });download.className='primary';controls.append(download,node('p','Design et médias d’affiche locaux, exclus de la sauvegarde générale. Le stockage du navigateur peut être effacé.','help'));
  const reset=button('Réinitialiser le design et retirer ses images',async()=>{if(reset.disabled)return;reset.disabled=true;try{await queue;await repository.remove(poll.remoteRef.pollId);onReset();notify('Design réinitialisé. Images affiche-only retirées si elles ne sont plus partagées.');}catch(e){error(e);}finally{reset.disabled=false;}});
  advanced.append(reset);if(JSON.stringify(design)!==JSON.stringify(saved))save();else schedule();
  return {element:box,dispose:()=>{disposed=true;version++;freeCanvas();for(const url of views.urls.values())URL.revokeObjectURL(url);views.urls.clear();staged.clear();}};
}

/** Disponible sur la vue résultats, jamais alimenté par des bulletins. */
export function resultsPdfPanel(poll,result,{repository,pollAssets,refreshPoll,error,notify}) {
  const box=node('details',null,'results-pdf advanced');box.append(node('summary','Télécharger les résultats en PDF'));
  let design=repository.get(poll.id||poll.remoteRef.pollId),style='summary',usePosterMedia=false;
  box.append(select('Présentation',[['summary','Synthèse'],['report','Rapport']],style,v=>style=v),
    select('Palette du PDF',PALETTES.map(p=>[p[0],p[1]]),design.palette,v=>design.palette=v),
    select('Typographie du PDF',TYPOGRAPHIES.map(p=>[p[0],p[1]]),design.typography,v=>design.typography=v),
    check('Inclure les images du sondage disponibles localement',design.usePollImages,v=>design.usePollImages=v),
    check('Inclure aussi les images affiche-only de ce Studio',false,v=>usePosterMedia=v));
  const download=button('Télécharger les résultats en PDF',async()=>{
    if(download.disabled)return;download.disabled=true;let media;const measure=printMeasure();
    try{
      const fresh=await refreshPoll();if(!download.isConnected)return;
      const plan=makeResultsPlan(fresh.poll,fresh.results,design,{style,usePosterMedia,measure:measure.measure});
      media=await loadPrintMedia(plan,repository.assets,pollAssets);const file=await exportPrintPdf(plan,{media,logo:document.querySelector('.brand-icon')});
      if(download.isConnected){downloadBlob(new Blob([file.bytes],{type:'application/pdf'}),`voti-resultats-${poll.id||poll.remoteRef.pollId}.pdf`);notify('PDF généré à partir des résultats disponibles au moment de l’export.');}
    }catch(e){if(download.isConnected)error(e);}finally{if(media)releasePrintMedia(media);measure.release();download.disabled=result.available!==true;}
  });download.disabled=result.available!==true;download.className='primary';box.append(download);
  if(!result.available)box.append(node('p','Les résultats ne sont pas encore disponibles.'));
  return box;
}
