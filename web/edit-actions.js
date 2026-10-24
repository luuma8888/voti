import {withSpaceIcon} from './space-icons.js';
/** État de fiche uniquement en mémoire. Aucune donnée de membre dans le stockage. */
export function editActions(ui,root,{read,restore,save,label}){
  let saveError='';
  const baseline=JSON.stringify(read()),route=location.hash,bar=document.createElement('div'),status=document.createElement('p'),actions=document.createElement('div'),cancel=document.createElement('button');
  bar.className='edit-action-bar';actions.className='actions';status.setAttribute('role','status');status.setAttribute('aria-live','polite');cancel.type='button';cancel.textContent='Annuler';
  const mobile=matchMedia('(max-width:600px)'),moveBar=()=>{if(mobile.matches)root.append(bar);else root.prepend(bar);};
  const controller={root,route,dirty:false,saving:false,update,reset,confirmDiscard,dispose:()=>mobile.removeEventListener('change',moveBar)};
  const submit=withSpaceIcon(ui.button('Enregistrer',async()=>{if(!controller.dirty||controller.saving)return;controller.saving=true;saveError='';submit.setAttribute('aria-busy','true');status.textContent='Enregistrement…';cancel.disabled=true;
    try{await save();controller.dirty=false;ui.notify('Modifications enregistrées.');}
    catch(error){saveError='Enregistrement impossible. Modifications non enregistrées conservées.';throw error;}
    finally{controller.saving=false;submit.removeAttribute('aria-busy');cancel.disabled=false;if(root.isConnected)update();}},'primary'),'save');submit.setAttribute('aria-label',label);
  actions.append(cancel,submit);bar.append(status,actions);root.prepend(bar);cancel.addEventListener('click',()=>{reset();root.querySelector('input')?.focus();});root.addEventListener('input',update);root.addEventListener('change',update);
  function update(){controller.dirty=JSON.stringify(read())!==baseline;root.classList.toggle('is-dirty',controller.dirty);bar.hidden=!controller.dirty;submit.disabled=!controller.dirty||controller.saving;status.textContent=controller.saving?'Enregistrement…':controller.dirty?(saveError||'Modifications non enregistrées'):'Aucune modification à enregistrer.';}
  function reset(){if(controller.saving)return;saveError='';restore(JSON.parse(baseline));update();ui.notify('Modifications annulées.');}
  async function confirmDiscard(trigger=document.activeElement){if(!controller.dirty)return true;if(controller.saving){ui.notify('Enregistrement en cours…');return false;}const abandon=await ui.confirmAction({trigger,title:'Des modifications ne sont pas enregistrées.',description:'Tu peux continuer les modifications ou les abandonner.',cancelLabel:'Continuer les modifications',actionLabel:'Abandonner les modifications'});if(abandon)reset();return abandon;}
  ui.activeEdit=controller;mobile.addEventListener('change',moveBar);moveBar();update();return controller;
}
export async function guardEditNavigation(ui,target){
  const edit=ui.activeEdit;if(!edit?.root.isConnected||!edit.dirty||target===edit.route)return true;
  if(ui.editNavigationPending)return false;ui.editNavigationPending=true;
  try{if(await edit.confirmDiscard())return true;history.replaceState(history.state,'',edit.route);ui.clearMember();return false;}
  finally{ui.editNavigationPending=false;}
}
