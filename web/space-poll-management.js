import {SPACE_RELEASE_LABELS,resultsState} from './space-ux.js';
import {pollMinimumControl} from './space-poll-minimum.js';
import {editActions} from './edit-actions.js';
import {withSpaceIcon} from './space-icons.js';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const put=(n,...children)=>{n.append(...children);return n;};
const field=(text,input)=>{input.id||='poll-'+crypto.randomUUID();return put(el('div',undefined,{class:'field'}),el('label',text,{for:input.id}),input);};
const select=(text,items,value)=>{const input=el('select');for(const[v,label]of items)input.append(el('option',label,{value:v}));input.value=value;return{input,element:field(text,input)};};
const link=(text,href,kind='')=>el('a',text,{href,class:'button '+kind});
const actions=(...children)=>put(el('div',undefined,{class:'actions poll-actions'}),...children);
const section=(title,cls='')=>put(el('section',undefined,{class:cls}),el('h2',title));

export async function renderSpacePoll(ui,initial,spaceId,{onChange=()=>{}}={}){
  const id=initial.remoteRef.pollId,credential=ui.staff(spaceId),route=location.hash;
  let lastAttendance=null,current=initial,space=await ui.getSpace(spaceId);
  ui.title(current.definition.question);ui.app.append(link('← Retour aux sondages',`#space/${spaceId}/polls`));
  const root=el('div',undefined,{class:'space-poll-management'}),notice=el('p','',{class:'poll-save-notice',role:'status','aria-live':'polite'});ui.app.append(root);
  const call=(command,input)=>ui.call(command,input,credential);
  const readCount=async ids=>(await call('getAudienceSize',{spaceId,pollAudience:{spaceId,mode:ids.length?'groups':'space',groupIds:ids,resultsAudience:'poll_audience'}})).eligible;
  const guarded=async(fn,trigger)=>{if(ui.activeEdit?.root.isConnected&&ui.activeEdit.dirty&&!await ui.activeEdit.confirmDiscard(trigger))return;await fn();};
  const reload=async()=>{const next=(await call('getSpacePoll',{pollId:id})).poll;await paint(next);};
  async function paint(poll,keepOpen=false,knownAttendance=undefined){
    const attendance=knownAttendance!==undefined?knownAttendance:poll.status==='draft'?null:await call('getPollAttendance',{pollId:id});lastAttendance=attendance;
    ui.activeEdit?.dispose();ui.activeEdit=null;current=poll;const heading=ui.app.querySelector('h1');heading.textContent=poll.definition.question;document.title=poll.definition.question+' · Voti';root.replaceChildren();root.append(notice);
    const state=section('État du sondage','poll-state-panel');state.dataset.pollStatus=poll.status;
    state.append(el('p',poll.status==='draft'?'Brouillon · Publication en attente':poll.status==='closed'?'Fermé · En ligne · Espace':'Ouvert · En ligne · Espace',{class:'poll-status'}));
    if(attendance){state.append(el('h3',`${attendance.consumed} participations sur ${attendance.eligible}`,{'data-poll-attendance':'',class:'poll-attendance'}));if(attendance.identityMode==='anonymous')state.append(el('p','Aucune liste nominative de votants ou non-votants n’est disponible pour ce sondage anonyme.',{class:'help'}));}
    state.append(el('p',poll.locked?'Le premier vote a verrouillé la question, les choix et les règles.':'Aucun vote accepté. La définition peut encore être modifiée.',{class:'help'}));root.append(state);
    const admin=actions();
    if(poll.status==='draft')admin.append(ui.button('Publier pour les membres',b=>guarded(async()=>{await call('publishSpacePoll',{pollId:id,expectedRevision:current.remoteRef.revision});ui.pollMinimumModes?.delete(id);await reload();notice.textContent='Sondage publié pour les membres.';},b),'primary'),ui.button('Abandonner le brouillon',b=>guarded(async()=>{if(await ui.confirmAction({trigger:b,title:'Abandonner ce brouillon ?',description:'Ce sondage non publié sera supprimé du relais.',actionLabel:'Abandonner',danger:true})){await ui.adapter.discardPublication({pollId:id,adminCapability:credential,expectedRevision:current.remoteRef.revision});location.hash=`#space/${spaceId}`;}},b),'danger'));
    if(poll.status==='published')admin.append(ui.button('Fermer le sondage',b=>guarded(async()=>{if(await ui.confirmAction({trigger:b,title:'Fermer ce sondage ?',description:'Il n’acceptera plus de vote. Le minimum de confidentialité reste obligatoire.',actionLabel:'Fermer le sondage'})){const fresh=(await call('getSpacePoll',{pollId:id})).poll;await ui.adapter.closePoll({pollId:id,adminCapability:credential,expectedRevision:fresh.remoteRef.revision});await reload();notice.textContent='Sondage fermé.';}},b)));
    if(admin.children.length)root.append(admin);
    const presentation=resultsState(poll,{admin:true,attendance}),results=section('Résultats','space-results-state poll-results-action');results.dataset.resultState=presentation.code;
    const reasonId='result-state-'+crypto.randomUUID();results.append(el('h3',presentation.title),el('p',presentation.detail,{id:reasonId}));
    if(poll.status!=='draft'){const view=link(poll.results.available?'Voir les résultats':'Comprendre la disponibilité',`#space/${spaceId}/poll/${id}/results`,poll.results.available?'primary':'quiet');view.setAttribute('aria-label','Résultats');view.setAttribute('aria-describedby',reasonId);results.append(actions(view));}root.append(results);
    if(poll.status!=='draft'){const share=section('Diffuser le sondage','space-poll-actions');share.append(actions(link('Ouvrir le vote',`#/p/${id}`,'primary'),link('QR & partager le sondage',`#space/${spaceId}/poll/${id}/share`)));root.append(share);}
    const summary=section('Résumé du sondage','poll-summary'),answers=el('ol',undefined,{class:'management-answer-list'});for(const c of poll.definition.choices)answers.append(el('li',c.label));
    const audience=poll.accessRules.pollAudience,groupNames=audience.groupIds.map(g=>space.groups.find(x=>x.group_id===g)?.name??'Groupe archivé');
    summary.append(el('h3',poll.definition.question));if(poll.definition.description)summary.append(el('p',poll.definition.description));summary.append(answers,el('p','Participants : '+(groupNames.length?groupNames.join(', '):'Tout l’Espace')),el('p',(poll.definition.participationIdentityMode==='anonymous'?'Anonyme':'Identifiée avec la Carte Voti')+' · '+(poll.definition.commentMode==='disabled'?'Vote simple':'Commentaire facultatif')),el('p',SPACE_RELEASE_LABELS.find(([key])=>key===poll.resultRules.releaseMode)[1]+' · minimum : '+poll.resultRules.minimumResponses),el('p','Résultats : '+(audience.resultsAudience==='admins_only'?'Administration uniquement':'Membres ciblés')));root.append(summary);
    if(!poll.locked&&poll.status!=='closed')root.append(editor(poll,keepOpen));
    const appearance=put(el('details',undefined,{class:'poll-appearance'}),el('summary','Apparence du sondage')),style=select('Apparence',[['mint','Menthe'],['lavender','Lavande'],['peach','Pêche']],poll.style.themeId);appearance.append(style.element,actions(ui.button('Enregistrer l’apparence',b=>guarded(async()=>{const fresh=(await call('getSpacePoll',{pollId:id})).poll;await ui.adapter.updateStyle({pollId:id,adminCapability:credential,expectedRevision:fresh.remoteRef.revision,style:{...fresh.style,themeId:style.input.value}});await reload();notice.textContent='Apparence enregistrée.';},b))));root.append(appearance);
    if(attendance?.identityMode==='identified'){
      const roster=section('Suivi des participants','poll-roster'),filter=select('Participants',[['all','Tous'],['voted','A participé'],['pending','À relancer']],'all'),list=el('ul');const draw=()=>{list.replaceChildren();for(const m of attendance.members.filter(m=>filter.input.value==='all'||Boolean(m.consumed)===(filter.input.value==='voted')))list.append(el('li',`${m.display_name} · ${m.consumed?'A participé':'À relancer'}${m.choice_id?' · '+poll.definition.choices.find(c=>c.id===m.choice_id)?.label:''}`));};filter.input.addEventListener('change',draw);draw();roster.append(filter.element,list);root.append(roster);
    }
    if(poll.status!=='draft'){
      const danger=put(el('details',undefined,{class:'poll-danger'}),el('summary','Suppression du sondage')),buttons=actions();for(const everywhere of [false,true])buttons.append(ui.button(everywhere?'Supprimer partout':'Supprimer en ligne',b=>guarded(async()=>{if(!await ui.confirmAction({trigger:b,title:everywhere?'Supprimer partout ?':'Supprimer ce sondage en ligne ?',description:everywhere?'Le sondage en ligne et le design de cet appareil seront supprimés. Les PDF téléchargés restent sur leurs appareils.':'Votes, commentaires et éligibilités seront supprimés. Le design local peut être retiré dans Sauvegarde.',actionLabel:everywhere?'Supprimer partout':'Supprimer en ligne',danger:true}))return;let remoteDeleted=false;try{const fresh=(await call('getSpacePoll',{pollId:id})).poll;await ui.adapter.deletePoll({pollId:id,adminCapability:credential,expectedRevision:fresh.remoteRef.revision});remoteDeleted=true;if(everywhere)await ui.posters.remove(id);location.hash=`#space/${spaceId}`;}catch(error){if(remoteDeleted)throw new Error('Suppression en ligne réussie. Le design local reste à retirer dans Sauvegarde.',{cause:error});throw error;}},b),'danger'));danger.append(buttons);root.append(danger);
    }
    onChange(poll);
  }
  function editor(poll,open){
    const details=put(el('details',undefined,{class:'poll-edit'}),el('summary','Modifier le sondage'));details.open=open;
    const form=el('div',undefined,{class:'poll-edit-form'}),essential=put(el('fieldset',undefined,{class:'poll-edit-essential'}),el('legend','L’essentiel')),fine=put(el('fieldset',undefined,{class:'poll-edit-settings'}),el('legend','Affiner les réglages')),advanced=put(el('details'),el('summary','Participation et résultats'));
    const q=el('input',undefined,{type:'text',required:'',maxlength:240}),description=el('textarea',undefined,{rows:2}),choices=el('textarea',undefined,{rows:4,required:''});q.value=poll.definition.question;description.value=poll.definition.description??'';choices.value=poll.definition.choices.map(c=>c.label).join('\n');
    const groups=poll.status==='draft'?ui.groupSelection(space.groups,poll.accessRules.pollAudience.groupIds):null;
    let edit;
    const minimumControl=poll.status==='draft'?pollMinimumControl({data:space,groupIds:()=>groups.values(),readCount,initial:poll.resultRules.minimumResponses,automatic:ui.pollMinimumModes?.get(id)===true,onChange:()=>edit?.update()}):null,minimum=minimumControl?.input??el('input',undefined,{type:'number',min:1,max:100000,required:'',value:poll.resultRules.minimumResponses});
    const identity=select('Participation',[['anonymous','Anonyme'],['identified','Identifiée avec la Carte Voti']],poll.definition.participationIdentityMode),comments=select('Commentaires',[['optional','Vote + commentaire facultatif'],['disabled','Vote simple']],poll.definition.commentMode),visibility=select('Visibilité des commentaires',[['private','Privés'],['public_with_results','Approuvés avec les résultats']],poll.definition.commentVisibility),release=select('Quand montrer les résultats ?',SPACE_RELEASE_LABELS,poll.resultRules.releaseMode),audience=select('Audience des résultats',[['poll_audience','Membres ciblés'],['admins_only','Administration uniquement']],poll.accessRules.pollAudience.resultsAudience);
    const sync=()=>visibility.input.disabled=comments.input.value==='disabled';comments.input.addEventListener('change',sync);sync();
    essential.append(field('Modifier la question',q),field('Description',description),field('Réponses (2 à 6, une par ligne)',choices));if(groups){essential.append(groups.element,el('p','Aucun groupe coché : tout l’Espace. Après publication, cette audience et son snapshot sont figés.',{class:'help'}));groups.element.addEventListener('change',()=>void minimumControl.update());void minimumControl.update();}
    fine.append(identity.element,comments.element,visibility.element,release.element,field('Minimum de confidentialité',minimum));if(minimumControl)fine.append(minimumControl.element);fine.append(audience.element);advanced.append(fine);form.append(essential,advanced);details.append(form);
    const read=()=>({question:q.value,description:description.value,choices:choices.value,identity:identity.input.value,comments:comments.input.value,visibility:visibility.input.value,release:release.input.value,minimum:minimum.value,audience:audience.input.value,groups:groups?.values()??poll.accessRules.pollAudience.groupIds});
    const restore=v=>{q.value=v.question;description.value=v.description;choices.value=v.choices;for(const[k,c]of Object.entries({identity,comments,visibility,release,audience}))c.input.value=v[k];for(const i of groups?.element.querySelectorAll('input')??[])i.checked=v.groups.includes(i.value);if(minimumControl)minimumControl.restore(v.minimum);else minimum.value=v.minimum;sync();};
    edit=editActions(ui,form,{label:'Enregistrer les règles',read,restore,save:async()=>{
      ui.clearError();notice.textContent='';
      if(!q.reportValidity()||!minimum.reportValidity()||!choices.reportValidity())throw new Error('Vérifie les champs du sondage.');
      const v=read(),labels=v.choices.split('\n').map(s=>s.trim()).filter(Boolean);if(labels.length<2||labels.length>6)throw new Error('Propose de 2 à 6 réponses.');essential.disabled=fine.disabled=true;
      const definition={...poll.definition,question:v.question,description:v.description.trim()||null,choices:labels.map((label,i)=>({...poll.definition.choices[i],id:poll.definition.choices[i]?.id??crypto.randomUUID(),label,shortLabel:null,emoji:null,imageRef:null,order:i})),participationIdentityMode:v.identity,privacy:v.identity==='identified'?'named':'anonymous',commentMode:v.comments,commentVisibility:v.visibility},resultRules={...poll.resultRules,releaseMode:v.release,minimumResponses:Number(v.minimum)},pollAudience={...poll.accessRules.pollAudience,...(groups?{mode:v.groups.length?'groups':'space',groupIds:v.groups}:{}),resultsAudience:v.audience};
      try{const response=await call('updateSpacePoll',{pollId:id,expectedRevision:current.remoteRef.revision,definition,resultRules,pollAudience});
        const next={...poll,remoteRef:{...poll.remoteRef,revision:response.revision},definition,resultRules,accessRules:{...poll.accessRules,pollAudience}};
        if(minimumControl)(ui.pollMinimumModes??=new Map()).set(id,!minimumControl.state.custom);
        await paint(next,true,lastAttendance);notice.textContent='Modifications enregistrées.';
        const saved=el('p','Modifications enregistrées.',{class:'poll-edit-confirmation',role:'status',tabindex:'-1'}),container=root.querySelector('.poll-edit-form');if(matchMedia('(max-width:600px)').matches)container.append(saved);else container.prepend(saved);saved.focus({preventScroll:true});container.addEventListener('input',()=>saved.remove(),{once:true});
      }finally{essential.disabled=fine.disabled=false;}
    }});
    const save=form.querySelector('[aria-label="Enregistrer les règles"]');save.replaceChildren(document.createTextNode('Enregistrer les règles'));withSpaceIcon(save,'save');return details;
  }
  await paint(current);return{root,route};
}
