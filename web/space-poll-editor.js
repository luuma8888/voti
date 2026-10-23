import {spaceAnswers,spacePollForm} from './space-poll-form.js';
import {SPACE_RELEASE_LABELS,spaceCreationValues} from './space-ux.js';
import {withSpaceIcon} from './space-icons.js';

const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const put=(n,...children)=>{n.append(...children);return n;};
const field=(label,input)=>{input.id||='field-'+crypto.randomUUID();return put(el('div',null,{class:'field'}),el('label',label,{for:input.id}),input);};
const select=(label,options)=>{const input=el('select');for(const[v,text]of options)input.append(el('option',text,{value:v}));return{input,element:field(label,input)};};
function releaseChoices(){const element=el('fieldset',null,{'data-release-rule':'',class:'space-release-options'});element.append(el('legend','Quand montrer les résultats ?'));const name='release-'+crypto.randomUUID();for(const[value,label]of [['threshold','Après un minimum de réponses'],['all_eligible','Quand tout le monde a répondu'],['closed','Quand je ferme le sondage'],['all_eligible_or_closed','Quand tout le monde a répondu ou que je ferme le sondage']]){const input=el('input',null,{type:'radio',name,value});input.checked=value==='threshold';element.append(put(el('label'),input,el('span',label)));}return{element,value:()=>element.querySelector('input:checked').value};}

export function spacePollEditor(data,{button,submit,groupSelection}){
  const question=el('input',null,{type:'text',required:'',maxlength:240,autocomplete:'off'}),answers=spaceAnswers(),limited=Boolean(data.access.groupIds?.length),groups=groupSelection(data.groups,data.access.groupIds??[]);
  const who=select('Qui peut participer ?',limited?[['groups','Les groupes autorisés']]:[['space','Tout l’Espace'],['groups','Certains groupes']]);
  who.element.classList.add('space-audience-choice');
  const identity=select('Participation',[['anonymous','Anonyme'],['identified','Identifiée avec la Carte Voti']]),comments=select('Commentaires',[['optional','Vote + commentaire facultatif'],['disabled','Vote simple']]),visibility=select('Visibilité des commentaires',[['private','Privés'],['public_with_results','Approuvés avec les résultats']]),release=releaseChoices(),audience=select('Qui peut voir les résultats ?',[['poll_audience','Les membres concernés'],['admins_only','Les personnes qui gèrent l’Espace']]),minimum=el('input',null,{type:'number',min:1,max:100000,value:5,required:''});
  const recap=el('div',null,{class:'space-recap space-review'}),identityHelp=el('p',null,{class:'help'}),visibilityExtra=put(el('details',null,{class:'space-extra-options'}),el('summary','Options supplémentaires'),visibility.element);
  let form;
  const raw=()=>({question:question.value,answers:answers.value(),identity:identity.input.value,comments:comments.input.value,visibility:visibility.input.value,release:release.value(),minimum:minimum.value,audience:audience.input.value,groupIds:who.input.value==='space'?[]:groups.values()});
  const values=()=>spaceCreationValues(raw(),form?.mode());
  const sync=()=>{groups.element.hidden=who.input.value==='space';visibility.input.disabled=comments.input.value==='disabled';identityHelp.textContent=identity.input.value==='anonymous'?'Les réponses ne sont pas reliées aux noms des membres.':'Les personnes qui gèrent le sondage pourront voir le nom associé à chaque réponse.';const v=values();recap.replaceChildren();
    const blocks=[['Question',[v.question||'Ta question'],0],['Réponses',v.answers.split('\n').filter(Boolean),1],['Participants',[v.groupIds.length?data.groups.filter(g=>v.groupIds.includes(g.group_id)).map(g=>g.name).join(', '):'Tout l’Espace'],2],['Participation',[v.identity==='anonymous'?'Anonyme':'Identifiée avec la Carte Voti',v.comments==='disabled'?'Vote simple':'Commentaire facultatif',...(v.comments==='disabled'?[]:[v.visibility==='private'?'Commentaires privés':'Commentaires approuvés avec les résultats'])],3],['Résultats',[SPACE_RELEASE_LABELS.find(([key])=>key===v.release)[1],'Minimum : '+v.minimum,audience.input.selectedOptions[0].textContent],4]];
    for(const[label,lines,step]of blocks){const block=el('section'),head=put(el('div',null,{class:'space-review-heading'}),el('h4',label)),edit=withSpaceIcon(button('Modifier',()=>form.goToStep(step)),'edit');edit.setAttribute('aria-label','Modifier : '+label);head.append(edit);block.append(head);if(label==='Réponses'){const list=el('ul');for(const line of lines)list.append(el('li',line));block.append(list);}else for(const line of lines)block.append(el('p',line));recap.append(block);}
  };
  const create=button('Créer le brouillon',async()=>{if(!form.validate())return;try{await submit(values());}catch(e){form.showError(e.message);throw e;}},'primary');
  form=spacePollForm({sections:[
    {title:'Ta question',help:'Que veux-tu demander aux autres ?',element:put(el('div',null,{class:'space-question-content'}),field('Question',question)),validate:()=>!question.value.trim()?{field:question,message:'Écris ta question.'}:null},
    {title:'Tes réponses',help:'Propose de 2 à 6 réponses.',element:answers.element,validate:answers.validate},
    {title:'Qui peut participer ?',help:'Choisis les personnes qui pourront voter.',element:put(el('div'),who.element,groups.element),validate:()=>who.input.value==='groups'&&!groups.values().length?{field:who.input,message:'Choisis au moins un groupe.'}:null},
    {title:'Comment participer ?',help:'Choisis si les réponses sont anonymes et si un commentaire est possible.',element:put(el('div'),identity.element,identityHelp,comments.element,visibilityExtra)},
    {title:'Quand montrer les résultats ?',help:'Le minimum reste nécessaire, même à la fermeture ou quand tout le monde a répondu.',element:put(el('div'),release.element,field('Minimum de confidentialité obligatoire',minimum),audience.element)}
  ],recap,createButton:create,onChange:sync});
  form.element.prepend(el('p','Sondage de l’Espace : '+data.name,{class:'space-task-context'}));
  form.element.addEventListener('input',sync);form.element.addEventListener('change',sync);sync();return form.element;
}
