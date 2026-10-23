import {resolveVisual,visualImage} from './visual-presets.js';
import {chooseVisual} from './visual-selector.js';
/** Champ de fiche : aucun enregistrement tant que le formulaire n'est pas validé. */
export function visualField(type,value=null,onChange=()=>{}){
  const root=document.createElement('section');root.className='visual-field';const preview=document.createElement('div'),status=document.createElement('p'),button=document.createElement('button');button.type='button';status.setAttribute('role','status');const render=()=>{root.dataset.visualId=value??'';const visual=resolveVisual(type,value);preview.replaceChildren(...(visual?[visualImage(visual,'large','visual-detail-image')]:[]));status.textContent=visual?.label??'Aucune illustration';button.textContent=visual?'Changer l’illustration':'Choisir une illustration';};button.addEventListener('click',async()=>{const id=await chooseVisual({type,selected:value,trigger:button});if(id!==undefined){value=id;render();onChange(value);}});root.append(preview,status,button);render();return{element:root,value:()=>value};
}
