import {VISUAL_PRESETS,resolveVisual} from './visual-presets.js';
/** Galerie prête, jamais montée avec un catalogue vide. Pas d'upload ni stockage. */
export function visualGallery({type,catalog=VISUAL_PRESETS,selected=null,onChange=()=>{}}){
  const entries=(catalog[type]??[]).filter(e=>resolveVisual(type,e.id,catalog));if(!entries.length)return null;
  const root=document.createElement('fieldset');root.className='visual-gallery';const legend=document.createElement('legend');legend.textContent=type==='member'?'Illustration du membre':'Illustration du groupe';root.append(legend);const name='visual-'+crypto.randomUUID();
  for(const entry of [null,...entries]){const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='radio';input.name=name;input.value=entry?.id??'';input.checked=input.value===(selected??'');input.addEventListener('change',()=>{if(input.checked)onChange(entry?.id??null);});text.textContent=entry?.label??'Aucune illustration';label.append(input);if(entry){const img=document.createElement('img');img.src=entry.src;img.alt='';label.append(img);}label.append(text);root.append(label);}return root;
}
export function visualDisplayOptions({catalog=VISUAL_PRESETS,value={},onChange=()=>{}}={}){
  const types=['member','group'].filter(t=>catalog[t]?.some(e=>resolveVisual(t,e.id,catalog)));if(!types.length)return null;
  const root=document.createElement('fieldset');root.className='visual-options';const legend=document.createElement('legend');legend.textContent='Illustrations sur cette carte';root.append(legend);let current={...value};
  for(const type of types){const label=document.createElement('label'),input=document.createElement('input'),key=type==='member'?'member':'groups';input.type='checkbox';input.checked=value[key]!==false;label.append(input,document.createTextNode(type==='member'?'Illustration du membre':'Illustrations des groupes'));input.addEventListener('change',()=>{current={...current,[key]:input.checked};onChange({...current});});root.append(label);}return root;
}
