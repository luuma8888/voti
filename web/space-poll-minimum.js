/** Recommandation de présentation seulement ; aucune règle de publication n'est changée. */
export function recommendedMinimum(count){
  if(!Number.isSafeInteger(count)||count<0)throw new Error('Nombre de membres éligibles invalide.');
  return Math.max(2,Math.ceil(count*.25));
}
export function audienceMemberCount(members,groupIds=[]){
  const groups=new Set(groupIds);
  return new Set(members.filter(m=>m.status==='active'&&(!groups.size||m.groupIds.some(id=>groups.has(id)))).map(m=>m.member_id)).size;
}
export class MinimumRecommendation {
  constructor(value=null){this.custom=value!==null;this.value=value===null?'2':String(value);this.count=null;}
  audience(count){this.count=count;if(!this.custom)this.value=String(recommendedMinimum(count));return this.value;}
  personalize(value){this.custom=true;this.value=String(value);}
  recommend(){this.custom=false;if(this.count!==null)this.value=String(recommendedMinimum(this.count));return this.value;}
}
/** État uniquement mémoire du formulaire. Une valeur déjà enregistrée fait autorité à la réouverture. */
export function pollMinimumControl({data,groupIds,readCount,initial=null,automatic=false,onChange=()=>{}}){
  const state=new MinimumRecommendation(initial);if(automatic)state.custom=false;const element=document.createElement('div'),input=document.createElement('input'),help=document.createElement('p'),reset=document.createElement('button');
  element.className='poll-minimum';input.type='number';input.min=1;input.max=100000;input.required=true;input.value=state.value;help.className='help';help.setAttribute('role','status');reset.type='button';reset.textContent='Utiliser la recommandation';element.append(input,help,reset);
  let request=0,lastKey=null,pending=Promise.resolve(),failure=null;
  function draw(){input.value=state.value;reset.hidden=!state.custom||state.count===null;help.textContent=state.count===null?'Calcul du nombre de membres concernés…':`${state.count} membre${state.count>1?'s':''} concerné${state.count>1?'s':''} · minimum recommandé : ${recommendedMinimum(state.count)} (25 %, au moins 2).${state.custom?' Ce minimum est conservé quand tu changes les groupes.':''}${state.count<2?' Cette audience ne peut pas atteindre le minimum recommandé de 2, même à la fermeture.':''}${Number(state.value)>state.count&&state.count>=2?' Le minimum choisi dépasse cette audience : les résultats resteront indisponibles.':''}`;onChange();}
  input.addEventListener('input',()=>{state.personalize(input.value);draw();});reset.addEventListener('click',()=>{state.recommend();draw();input.dispatchEvent(new Event('change',{bubbles:true}));});
  async function update(force=false){const ids=groupIds(),key=JSON.stringify(ids===null?null:[...ids].sort());if(!force&&key===lastKey)return pending;lastKey=key;const mine=++request;failure=null;
    if(ids===null){state.audience(0);draw();return;}
    if(!force&&data.access.role==='admin'){state.audience(audienceMemberCount(data.members,ids));draw();return;}
    // Créateurs : aucun nom reçu ; les changements d'audience obsolètes sont ignorés.
    pending=(async()=>{try{const count=await readCount(ids);if(mine!==request)return;state.audience(count);failure=null;draw();}catch(error){if(mine!==request)return;failure=error;help.textContent='Le nombre de membres ne peut pas être vérifié. Réessaie avant de créer le sondage.';}})();await pending;
  }
  draw();return{element,input,state,update,ready:async()=>{for(let n=0;n<3;n++){const key=JSON.stringify(groupIds());await update(true);if(key===JSON.stringify(groupIds())){if(failure)throw failure;return;}}throw new Error('L’audience a changé. Vérifie les participants puis réessaie.');},restore:value=>{state.value=String(value);state.custom=initial!==null&&!automatic;lastKey=null;void update();draw();}};
}
