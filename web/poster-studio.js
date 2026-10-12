import { validateDesign, designRefs, LAYOUTS, PALETTES, choosePalette, customizeColor, resetPalette } from './poster-design.js';
import { typographyChoices, focalPicker, settingsFor } from './poster-controls.js';
import { makeStudioPlan, makeResultsPlan } from './print-layout.js';
import { loadPrintMedia, releasePrintMedia, printMeasure, paintPrintPage, exportPrintPdf, printMediaSizes } from './print-renderer.js';
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
  for(const id of Object.keys(design.imageSettings))if(!['main','background'].includes(id)&&!choices.has(id))delete design.imageSettings[id];
  const staged=new Map(),views=new ImageViews(repository.assets),focalViews=new ImageViews({get:async id=>await repository.assets.get(id)||pollAssets?.get(id)}),canvases=[],crops=[];
  let imageQueue=Promise.resolve();
  const prepareImage=(file,kind)=>{
    const task=imageQueue.then(()=>{if(disposed)throw new Error('Préparation annulée : Studio fermé.');return processImage(file,kind);});
    imageQueue=task.catch(()=>{});return task;
  };
  const status=node('p','Préparation de l’aperçu…','help');status.setAttribute('role','status');
  box.append(node('p','Personnalise ton affiche, sans changer le sondage ni les images vues par les votants.','help'));
  const viewSwitch=node('div',null,'studio-view-switch');viewSwitch.setAttribute('role','group');viewSwitch.setAttribute('aria-label','Vue du Studio');box.dataset.studioPane='settings';
  controls.id='studio-settings-'+crypto.randomUUID();preview.id='studio-preview-'+crypto.randomUUID();
  for(const [pane,label,id] of [['settings','Réglages',controls.id],['preview','Aperçu',preview.id]]){const entry=button(label,()=>{box.dataset.studioPane=pane;for(const b of viewSwitch.children)b.setAttribute('aria-pressed',String(b===entry));fitWorkspace();});entry.setAttribute('aria-controls',id);entry.setAttribute('aria-pressed',String(pane==='settings'));viewSwitch.append(entry);}
  const layout=node('div',null,'studio-grid');layout.append(controls,preview);box.append(viewSwitch,layout);
  preview.classList.add('studio-fit-page');
  const toolbar=node('div',null,'studio-preview-toolbar');toolbar.append(node('h2','Ton affiche'));
  const sheets=node('div',null,'studio-sheets');sheets.tabIndex=0;sheets.setAttribute('role','region');sheets.setAttribute('aria-label','Aperçu de l’affiche, défilement pour lire la page');
  const page=node('select');page.setAttribute('aria-label','Page de l’aperçu');let pageIndex=0,previewPages=0,previewWarnings=[];
  function updatePreviewStatus(){if(previewPages)status.textContent=`${previewPages} page(s) A4 · ${preview.classList.contains('studio-fit-page')?'Vue entière. Agrandis pour lire les détails.':'Vue agrandie. Fais défiler pour lire les détails.'} ${previewWarnings.join(' ')}`;}
  page.addEventListener('change',()=>{pageIndex=Number(page.value);schedule();sheets.scrollTo(0,0);});
  const zoom=button('Agrandir pour lire',()=>{const full=preview.classList.toggle('studio-fit-page');zoom.textContent=full?'Agrandir pour lire':'Voir la page entière';updatePreviewStatus();sheets.scrollTo(0,0);});
  toolbar.append(page,zoom);preview.append(toolbar,status,sheets);
  // Le Studio utilise la hauteur réellement disponible sous les titres/avis.
  // Seul le formulaire défile : il ne doit jamais pousser l'aperçu hors écran.
  let fitScheduled=false;
  function fitWorkspace(){if(fitScheduled)return;fitScheduled=true;requestAnimationFrame(()=>{
    fitScheduled=false;if(disposed||!box.isConnected)return;
    const nav=document.querySelector('.main-nav'),bottom=nav&&getComputedStyle(nav).position==='fixed'?nav.getBoundingClientRect().height+12:12;
    const height=Math.floor(Math.max(260,(window.visualViewport?.height||innerHeight)-Math.max(8,layout.getBoundingClientRect().top)-bottom));
    if(box.style.getPropertyValue('--studio-height')!==`${height}px`)box.style.setProperty('--studio-height',`${height}px`);
  });}
  const workspaceSize=new ResizeObserver(fitWorkspace);workspaceSize.observe(box);
  requestAnimationFrame(()=>{if(disposed)return;const main=box.closest('main');if(main)workspaceSize.observe(main);fitWorkspace();});
  window.addEventListener('resize',fitWorkspace);window.addEventListener('scroll',fitWorkspace,{passive:true});window.visualViewport?.addEventListener('resize',fitWorkspace);
  controls.addEventListener('focusin',event=>{const target=event.target;requestAnimationFrame(()=>{
    if(disposed||!target.isConnected)return;const rect=target.getBoundingClientRect();
    const frame=controls.getBoundingClientRect();if(!rect.height)return;
    if(rect.top<frame.top+8)controls.scrollTop+=rect.top-frame.top-8;
    else if(rect.bottom>frame.bottom-8)controls.scrollTop+=rect.bottom-frame.bottom+8;
  });});
  function freeCanvas(){for(const canvas of canvases)canvas.width=canvas.height=1;canvases.length=0;sheets.replaceChildren();}
  async function draw(){
    const current=++version,snapshot=structuredClone(design),measure=printMeasure();let media;
    try {
      const source={get:async id=>staged.get(id)||repository.assets.get(id)};
      const mediaSizes=await printMediaSizes(poll,snapshot,source,pollAssets);
      const plan=makeStudioPlan(poll,snapshot,{measure:measure.measure,mediaSizes});
      media=await loadPrintMedia(plan,source,pollAssets);if(disposed||current!==version)return;
      freeCanvas();
      pageIndex=Math.min(pageIndex,plan.pages.length-1);
      // Un seul canvas, même pour une affiche longue : les autres pages sont
      // rendues à la demande, sans multiplier la mémoire de l'aperçu.
      {
        const index=pageIndex;
        const canvas=node('canvas');canvas.width=900;canvas.height=Math.round(900*plan.height/plan.width);
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Aperçu ${LAYOUTS.find(l=>l[0]===snapshot.layout)[1]}, page ${index+1} sur ${plan.pages.length}`);
        paintPrintPage(canvas,plan,index,{media,logo:document.querySelector('.brand-icon')});canvases.push(canvas);sheets.append(canvas);
      }
      page.replaceChildren(...plan.pages.map((_,index)=>{const option=node('option',`Page ${index+1} / ${plan.pages.length}`);option.value=String(index);return option;}));
      page.disabled=plan.pages.length===1;page.value=String(pageIndex);
      previewPages=plan.pages.length;previewWarnings=plan.warnings;updatePreviewStatus();
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
  const colorFields=new Map(),colorMode=node('p',null,'color-mode');colorMode.setAttribute('role','status');
  function syncColors(){for(const [key,{input,value}] of colorFields){input.value=design.customColors[key];value.textContent=input.value;}paletteSelect.value=design.customColors.enabled?'custom':design.palette;colorMode.textContent=design.customColors.enabled?`Personnalisé · palette de référence : ${PALETTES.find(p=>p[0]===design.palette)[1]}`:`Palette ${PALETTES.find(p=>p[0]===design.palette)[1]}`;}
  const paletteField=select('Palette',[...PALETTES.map(p=>[p[0],p[1]]),['custom','Personnalisé']],design.customColors.enabled?'custom':design.palette,v=>{if(v==='custom'){syncColors();return;}design=choosePalette(design,v);syncColors();save();});
  const paletteSelect=paletteField.querySelector('select');
  paletteSelect.querySelector('option[value=custom]').disabled=true;
  const sections=node('div',null,'studio-sections');controls.append(sections);
  const accordionName='studio-'+crypto.randomUUID();
  function section(title,description,mark,open=false){const details=node('details',null,'studio-section');details.setAttribute('name',accordionName);details.open=open;const summary=node('summary');summary.append(node('span',mark,'studio-section-mark'),node('strong',title),node('span',description,'studio-section-description'));summary.querySelector('.studio-section-mark').setAttribute('aria-hidden','true');details.append(summary);const content=node('div',null,'studio-section-content');details.append(content);sections.append(details);return content;}
  const composition=section('Composer l’affiche','Type de QR, disposition et espace entre les choix.','01',true);
  composition.append(node('p','QR d’accès : un grand QR pour tout le sondage. QR par choix : un QR associé à chaque réponse, toujours suivi d’une confirmation.','help'));
  composition.append(select('Type d’affiche',[['access','QR d’accès'],['choices','QR par choix']],design.mode,v=>set('mode',v)),
    select('Disposition',LAYOUTS,design.layout,v=>set('layout',v)),
    select('Densité',[['compact','Compact'],['balanced','Équilibré'],['airy','Aéré']],design.densityPreset,v=>set('densityPreset',v)),
    select('Choix par ligne',[['auto','Auto'],['1','1'],['2','2'],['3','3']],design.choicesPerRow,v=>set('choicesPerRow',v)),
    select('Taille des QR',[['small','Petit'],['medium','Moyen'],['large','Grand']],design.qrSize,v=>set('qrSize',v)),
    select('En-tête Voti',[['normal','Normal'],['discreet','Discret'],['hidden','Masqué']],design.headerMode,v=>set('headerMode',v)));
  const colors=section('Choisir les couleurs','Une palette harmonieuse ou tes propres couleurs.','02');
  colors.append(paletteField,colorMode);
  const typography=section('Choisir les écritures','Un style pour le titre, un autre pour les textes.','03');
  typography.append(
    typographyChoices('Typographie du titre','title',design.titleTypography,v=>set('titleTypography',v)),
    typographyChoices('Typographie du texte','body',design.bodyTypography,v=>set('bodyTypography',v)));
  colors.append(node('h3','Couleurs personnalisées'));
  colors.append(node('p','Principale : en-tête et accents. Secondaire : repères des choix. Fond : toute la page.','help'));
  for(const [key,label] of [['primary','Principale'],['secondary','Secondaire'],['bg','Fond']]){
    const input=node('input');input.type='color';input.value=design.customColors[key];const value=node('output',input.value);
    input.addEventListener('input',()=>{design=customizeColor(design,key,input.value);syncColors();save();});const group=field(label,input);group.append(value);colors.append(group);colorFields.set(key,{input,value});
  }
  colors.append(button('Revenir à la palette',()=>{design=resetPalette(design);syncColors();save();}));syncColors();
  const mediaBox=section('Choisir des images','Un fond, une image principale ou une image par réponse.','04'),cropBox=section('Cadrer les images','Choisis la forme et la partie de la photo à garder.','05'),surfaces=section('Surfaces et lisibilité','Laisse voir ta photo sans perdre la lisibilité.','06');
  let bgFitField,bgPositionField;
  function syncBackground(){const s=settingsFor(design,'background');if(bgFitField)bgFitField.querySelector('select').value=s.fit;if(bgPositionField)bgPositionField.querySelector('select').value=s.focalX===.5&&[0,.5,1].includes(s.focalY)?(s.focalY===0?'top':s.focalY===1?'bottom':'center'):'manual';}
  cropBox.append(node('p','Ajoute une image pour régler sa forme et la partie visible. Chaque image a son propre cadrage.','help'));
  mediaBox.append(node('p','Ces images personnalisent seulement l’affiche, sur cet appareil. Aucun média du Studio n’est envoyé au relais.','help'));
  function picker(label,kind,key,get,setId){
    let crop;
    const group=imagePicker({label,kind,getId:get,staged,views,active:()=>!disposed,prepareImage,
      change:asset=>{if(asset)staged.set(asset.id,asset);setId(asset?.id||null);crop.update();save();},busy:delta=>{busy+=delta;download.disabled=busy>0;},
      error,statusReady:'Image prête. Cette image personnalise seulement l’affiche.'});
    group.prepend(node('h3',label));mediaBox.append(group);
    const effectiveId=()=>get()||(design.usePollImages?(key==='main'?poll.definition.pollImageAssetId:poll.definition.choices.find(c=>c.id===key)?.imageRef):null);
    crop=focalPicker({label:`Cadrage : ${label}`,getId:effectiveId,getSettings:()=>settingsFor(design,key),views:focalViews,staged,allowRatio:key!=='background',
      change:(settings,commit)=>{design.imageSettings[key]=settings;if(key==='background'){design.background.fit=settings.fit;syncBackground();}if(commit)save();else schedule();}});
    crops.push(crop);cropBox.append(crop.element);
  }
  picker('Image de fond d’affiche','poll','background',()=>design.background.assetId,id=>design.background.assetId=id);
  bgFitField=select('Mode du fond',[['cover','Remplir'],['contain','Ajuster']],design.background.fit,v=>{design.background.fit=v;design.imageSettings.background={...settingsFor(design,'background'),fit:v};crops[0].update();syncBackground();save();});
  bgPositionField=select('Position du fond',[['top','Haut'],['center','Centre'],['bottom','Bas'],['manual','Point manuel']],design.background.position,v=>{if(v==='manual')return;design.background.position=v;design.imageSettings.background={...settingsFor(design,'background'),focalX:.5,focalY:v==='top'?0:v==='bottom'?1:.5};crops[0].update();syncBackground();save();});
  syncBackground();
  surfaces.append(bgFitField,bgPositionField,
    select('Voile du fond',[['light','Clair'],['dark','Sombre']],design.background.veil,v=>{design.background.veil=v;save();}));
  const intensity=node('input');intensity.type='range';intensity.min='0';intensity.max='60';intensity.step='5';intensity.value=design.background.intensity*100;
  const intensityValue=node('output',intensity.value+' %');intensity.addEventListener('input',()=>{design.background.intensity=Number(intensity.value)/100;intensityValue.textContent=intensity.value+' %';save();});
  const range=field('Intensité de l’image de fond',intensity);range.append(intensityValue);surfaces.append(range,
    select('Surface QR',[['large','Large'],['compact','Compacte'],['minimal','Minimal']],design.qrSurfaceMode,v=>set('qrSurfaceMode',v)),
    select('Fond des textes',[['1','Opaque'],['0.85','Doux'],['0.65','Transparent renforcé']],String(design.textSurfaceOpacity),v=>set('textSurfaceOpacity',Number(v))));
  mediaBox.append(check('Utiliser les images du sondage disponibles sur cet appareil',design.usePollImages,v=>{design.usePollImages=v;for(const c of crops)c.update();save();}),
    node('p','Cette image personnalise seulement l’affiche. Aucun média du Studio n’est envoyé au relais.','help'));
  picker('Image principale d’affiche','poll','main',()=>design.media.main,id=>design.media.main=id);
  for(const choice of poll.definition.choices)picker(`Image d’affiche : ${choice.label}`,'choice',choice.id,()=>design.media.choices[choice.id]||null,id=>{if(id)design.media.choices[choice.id]=id;else delete design.media.choices[choice.id];});
  const download=button('Télécharger le PDF',async()=>{
    if(download.disabled)return;download.disabled=true;let media;const measure=printMeasure();
    try {await queue;if(disposed)return;
      // Relire la présence/les textes publics au téléchargement, jamais republier.
      const current=await refreshPoll();if(disposed)return;
      const mediaSizes=await printMediaSizes(current,design,repository.assets,pollAssets);
      const plan=makeStudioPlan(current,validateDesign(design),{measure:measure.measure,mediaSizes});media=await loadPrintMedia(plan,repository.assets,pollAssets);
      const result=await exportPrintPdf(plan,{media,logo:document.querySelector('.brand-icon')});
      if(!disposed){downloadBlob(new Blob([result.bytes],{type:'application/pdf'}),`voti-affiche-${poll.remoteRef.pollId}-${design.mode}.pdf`);notify(`Affiche prête : ${plan.pages.length} page(s).`);}
    }catch(e){if(!disposed)error(e);}finally{if(media)releasePrintMedia(media);measure.release();download.disabled=busy>0;}
  });download.className='primary';toolbar.append(download);controls.append(node('p','Design et médias d’affiche locaux, exclus de la sauvegarde générale. Le stockage du navigateur peut être effacé.','help'));
  const reset=button('Réinitialiser le design et retirer ses images',async()=>{if(reset.disabled)return;reset.disabled=true;try{await queue;await repository.remove(poll.remoteRef.pollId);onReset();notify('Design réinitialisé. Images affiche-only retirées si elles ne sont plus partagées.');}catch(e){error(e);}finally{reset.disabled=false;}});
  controls.append(reset);if(JSON.stringify(design)!==JSON.stringify(saved))save();else schedule();
  return {element:box,dispose:()=>{disposed=true;version++;workspaceSize.disconnect();window.removeEventListener('resize',fitWorkspace);window.removeEventListener('scroll',fitWorkspace);window.visualViewport?.removeEventListener('resize',fitWorkspace);freeCanvas();for(const crop of crops)crop.dispose();for(const v of [views,focalViews]){for(const url of v.urls.values())URL.revokeObjectURL(url);v.urls.clear();}staged.clear();}};
}

/** Disponible sur la vue résultats, jamais alimenté par des bulletins. */
export function resultsPdfPanel(poll,result,{repository,pollAssets,refreshPoll,error,notify}) {
  const box=node('details',null,'results-pdf advanced');box.append(node('summary','Télécharger les résultats en PDF'));
  let design=repository.get(poll.id||poll.remoteRef.pollId),style='summary',usePosterMedia=false;
  box.append(select('Présentation',[['summary','Synthèse'],['report','Rapport']],style,v=>style=v),
    select('Palette du PDF',PALETTES.map(p=>[p[0],p[1]]),design.palette,v=>design=resetPalette(choosePalette(design,v))),
    typographyChoices('Typographie du titre','title',design.titleTypography,v=>design.titleTypography=v),
    typographyChoices('Typographie du texte','body',design.bodyTypography,v=>design.bodyTypography=v),
    select('En-tête Voti',[['normal','Normal'],['discreet','Discret'],['hidden','Masqué']],design.headerMode,v=>design.headerMode=v),
    check('Inclure les images du sondage disponibles localement',design.usePollImages,v=>design.usePollImages=v),
    check('Inclure aussi les images affiche-only de ce Studio',false,v=>usePosterMedia=v));
  const download=button('Télécharger les résultats en PDF',async()=>{
    if(download.disabled)return;download.disabled=true;let media;const measure=printMeasure();
    try{
      const fresh=await refreshPoll();if(!download.isConnected)return;
      const mediaSizes=await printMediaSizes(fresh.poll,design,repository.assets,pollAssets);
      const plan=makeResultsPlan(fresh.poll,fresh.results,design,{style,usePosterMedia,measure:measure.measure,mediaSizes});
      media=await loadPrintMedia(plan,repository.assets,pollAssets);const file=await exportPrintPdf(plan,{media,logo:document.querySelector('.brand-icon')});
      if(download.isConnected){downloadBlob(new Blob([file.bytes],{type:'application/pdf'}),`voti-resultats-${poll.id||poll.remoteRef.pollId}.pdf`);notify('PDF généré à partir des résultats disponibles au moment de l’export.');}
    }catch(e){if(download.isConnected)error(e);}finally{if(media)releasePrintMedia(media);measure.release();download.disabled=result.available!==true;}
  });download.disabled=result.available!==true;download.className='primary';box.append(download);
  if(!result.available)box.append(node('p','Les résultats ne sont pas encore disponibles.'));
  return box;
}
