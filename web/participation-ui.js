import { participationRules, normalizeSubmission, characterCount } from '../shared/participation.js';
import { confirmAction } from './confirmation.js';

function node(tag, text, attrs = {}) {
  const element = document.createElement(tag); if (text !== undefined) element.textContent = text;
  for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,String(value)); return element;
}
function labeled(label, control) { const box = node('label'); box.append(node('span',label),control); return box; }
export const ANONYMOUS_NOTICE = 'Ton commentaire est anonyme. N’écris pas ton nom, ton prénom, ton adresse, ton école ou une information qui permettrait de te reconnaître. Évite aussi de donner des informations personnelles sur quelqu’un d’autre.';
export const IDENTITY_NOTICE = 'Voti ne vérifie pas cette identité. Deux personnes peuvent utiliser le même nom ou pseudonyme.';
export const IDENTITY_LINK_NOTICE = 'Ton nom ou pseudonyme est associé à ta réponse. N’ajoute pas d’autres informations personnelles inutiles.';

export function submissionFields(definition, session, {memberIdentity=null}={}) {
  const rules = participationRules(definition), box = node('div',undefined,{class:'submission-fields'});
  const controls = [];
  if (rules.participationIdentityMode === 'identified') {
    if(memberIdentity!==null){session.displayName=memberIdentity;box.append(node('p','Ce sondage est identifié. Ta réponse sera associée à ta Carte Voti.',{class:'privacy-notice'}),node('p',IDENTITY_NOTICE,{class:'help'}));}
    else {
    const input = node('input',undefined,{type:'text',autocomplete:'off',required:'','data-testid':'display-name','aria-describedby':'identity-notice'});
    input.value = session.displayName ?? ''; input.addEventListener('input',()=>{session.displayName=input.value;input.setCustomValidity('');}); controls.push(input);
    box.append(labeled('Ton nom ou pseudonyme',input),node('p',IDENTITY_NOTICE,{class:'help',id:'identity-notice'}),node('p',IDENTITY_LINK_NOTICE,{class:'help'}));
    }
  }
  if (rules.commentMode === 'optional') {
    const input = node('textarea',undefined,{rows:3,'data-testid':'vote-comment','aria-describedby':'comment-notice comment-count'});
    const count = node('p','',{class:'help',id:'comment-count','aria-live':'polite'});
    input.value = session.comment ?? ''; const refresh = ()=>{session.comment=input.value;count.textContent=`${characterCount(input.value.trim())} / 300 caractères`;input.setCustomValidity('');};
    input.addEventListener('input',refresh); refresh(); controls.push(input);
    box.append(labeled('Commentaire facultatif',input),count,node('p',rules.participationIdentityMode === 'anonymous' ? ANONYMOUS_NOTICE : IDENTITY_LINK_NOTICE,{class:'privacy-notice',id:'comment-notice'}));
    if (rules.commentVisibility === 'public_with_results') box.append(node('p','Il sera visible seulement s’il est approuvé et lorsque les résultats seront disponibles.',{class:'help'}));
    else box.append(node('p','Seul le créateur du sondage pourra lire ton commentaire.',{class:'help'}));
  }
  return { element:box, validate:()=>{
    try { return normalizeSubmission(definition,{ ...(rules.commentMode === 'optional' ? {comment:session.comment ?? ''} : {}),
      ...(rules.participationIdentityMode === 'identified' ? {displayName:session.displayName ?? ''} : {}) }); }
    catch(error) { const target=controls.find(c=>c.required&&!c.value.trim())??controls.at(-1);if(target){target.setCustomValidity(error.message);target.reportValidity();target.focus();}throw error; }
  }, freeze:()=>{for(const control of controls)control.disabled=true;} };
}

/** Aucun cache persistant de projection d'administration ; texte toujours textContent. */
export function commentsAdministration(poll,{load,mutate,error}) {
  const rules=participationRules(poll.definition), box=node('section',undefined,{class:'card comments-admin','data-testid':'comments-admin'});
  box.append(node('h2',rules.participationIdentityMode==='identified'?'Participations & commentaires':'Commentaires'));
  box.append(node('p','Cette zone est réservée à l’administration, même avant publication des résultats.',{class:'help'}));
  const content=node('div'),status=node('p','Chargement…',{role:'status'});box.append(status,content);
  let active=true, busy=false;
  async function refresh() {
    if(busy)return;busy=true;status.textContent='Chargement…';
    try {
      const entries=[];let cursor=null;
      do {const page=await load(cursor);if(!active)return;entries.push(...page.entries);cursor=page.nextCursor;if(entries.length>=500&&cursor)throw new Error('Affichage limité à 500 participations.');}while(cursor);
      content.replaceChildren();status.textContent=entries.length?`${entries.length} entrée(s)`:'Aucun commentaire ou participation pour le moment.';
      for(const choice of poll.definition.choices){const group=entries.filter(e=>e.choiceId===choice.id);if(!group.length)continue;
        const section=node('section',undefined,{class:'comment-group'});section.append(node('h3',choice.label));
        for(const entry of group){const row=node('article',undefined,{class:'comment-entry'});
          if(entry.displayName)row.append(node('strong',entry.displayName));
          if(entry.comment){const c=entry.comment;row.append(node('p',c.text,{class:'comment-text'}));
            if(rules.commentVisibility==='public_with_results')row.append(node('span',{pending:'En attente',visible:'Visible avec les résultats',hidden:'Masqué'}[c.moderationStatus],{class:'badge'}));
            const actions=node('div',undefined,{class:'actions'});
            const operation=(label,action,danger=false)=>{const button=node('button',label,{type:'button',class:danger?'danger':'','data-comment-action':action});
              button.addEventListener('click',async()=>{if(button.disabled)return;
                if(action==='delete'&&!await confirmAction({trigger:button,title:'Supprimer ce commentaire ?',description:'Ce commentaire sera supprimé définitivement. Cette action est irréversible.',actionLabel:'Supprimer définitivement',danger:true}))return;
                if(!active)return;for(const b of box.querySelectorAll('button'))b.disabled=true;
                try {await mutate(button,c,action);if(active)await refresh();}catch(e){if(active){if(e.code==='REVISION_CONFLICT')await refresh();error(e);}}finally{for(const b of box.querySelectorAll('button'))b.disabled=false;}
              });actions.append(button);};
            if(rules.commentVisibility==='public_with_results'){if(c.moderationStatus!=='visible')operation('Afficher','visible');if(c.moderationStatus!=='hidden')operation('Masquer','hidden');}
            operation('Supprimer définitivement','delete',true);row.append(actions);
          }else row.append(node('p','Sans commentaire',{class:'help'}));section.append(row);
        }content.append(section);
      }
    }catch(e){if(active){status.textContent='Lecture indisponible.';error(e);}}finally{busy=false;}
  }
  const reload=node('button','Actualiser',{type:'button'});reload.addEventListener('click',refresh);box.append(reload);
  queueMicrotask(refresh);return {element:box,dispose:()=>{active=false;content.replaceChildren();}};
}
