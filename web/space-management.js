import {withSpaceIcon} from './space-icons.js';
import {presetThumbnail,VISUAL_PRESETS} from './visual-presets.js';
/** Présentation de la gestion uniquement. Les commandes et contrôles restent dans SpacesUI/le relais. */
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const put=(parent,...children)=>{parent.append(...children);return parent;};
const nav=(text,href,kind='')=>{const icon=text.startsWith('←')?'back':text.startsWith('+')?'add':text==='Réglages'?'settings':text==='Voir'||text==='Gérer'?'edit':href.split('/')[2]??'overview';return withSpaceIcon(el('a',text.replace(/^[←+]\s*/,''),{href,class:'button '+kind}),icon);};
const badge=(text)=>el('span',text,{class:'space-badge'});
const SECTIONS=[['overview','Aperçu'],['polls','Sondages'],['members','Membres'],['groups','Groupes'],['invitations','Invitations'],['access','Accès']];
const count=(n,one,many=one+'s')=>`${n} ${n>1?many:one}`;
const roles={admin:'Administrateur de l’Espace',creator:'Créateur de l’Espace'};
const status=p=>p.status==='draft'?'Brouillon':p.status==='closed'?'Fermé':'Ouvert';
const scopes=(raw,groups)=>{const ids=typeof raw==='string'?JSON.parse(raw):raw;return ids?.length?ids.map(id=>groups.find(g=>g.group_id===id)?.name??'Groupe archivé').join(' · '):'Tout l’Espace';};

export function renderSpaceManagement(ui,data,section='overview',entity=null,catalog=VISUAL_PRESETS){
  const id=data.spaceId,base='#space/'+id,admin=data.access.role==='admin',active=data.status==='active';
  const permitted=admin?SECTIONS:SECTIONS.filter(([key])=>['overview','polls','groups'].includes(key));
  if(![...permitted.map(([key])=>key),'settings'].includes(section))throw new Error('Cet accès ne permet pas d’ouvrir cette section.');
  if(entity&&(!['polls','members','groups','invitations','access'].includes(section)||entity==='new'&&!active))throw new Error('Cette action n’est pas disponible.');
  if(entity==='new'&&section!=='polls'&&!admin)throw new Error('Action réservée à l’administration.');
  const person=section==='members'&&entity&&entity!=='new'?data.members.find(m=>m.member_id===entity):null;
  if(!ui.shell||ui.shell.spaceId!==id||!ui.shell.root.isConnected){
    ui.title(data.name);const heading=ui.app.querySelector('h1'),workspace=el('div',undefined,{class:'space-workspace'}),context=el('p',data.name,{class:'space-context-name'}),role=el('p',roles[data.access.role],{class:'help'});
    const header=put(el('header',undefined,{class:'space-heading'}),nav('← Espaces','#spaces','space-back'),put(el('div'),context,heading,role),nav('Réglages',base+'/settings'));
    const navigation=el('nav',undefined,{class:'space-navigation','aria-label':'Dans cet Espace'}),content=el('section',undefined,{class:'space-content'});
    for(const[key,label]of permitted)navigation.append(nav(label,base+(key==='overview'?'':'/'+key)));
    workspace.append(header,navigation,content);ui.app.append(workspace);ui.shell={spaceId:id,root:workspace,header,navigation,content,heading,context,role};
  }
  const {root:workspace,content,heading,context,role,navigation}=ui.shell;
  ui.title(person?.display_name??data.name,heading);context.textContent=data.name;context.hidden=!person;role.textContent=roles[data.access.role];
  const settingsLink=ui.shell.header.querySelector('a[href$="/settings"]');if(section==='settings')settingsLink.setAttribute('aria-current','page');else settingsLink.removeAttribute('aria-current');
  const allowed=permitted.map(([key])=>key).join(',');if(navigation.dataset.allowed!==allowed){navigation.replaceChildren(...permitted.map(([key,label])=>nav(label,base+(key==='overview'?'':'/'+key))));navigation.dataset.allowed=allowed;}
  for(const a of navigation.querySelectorAll('a')){const key=a.hash.split('/')[2]??'overview';if(key===section)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  workspace.toggleAttribute('data-space-task',Boolean(entity));content.dataset.spaceSection=section;content.setAttribute('aria-label',SECTIONS.find(([key])=>key===section)?.[1]??'Réglages');content.setAttribute('aria-busy','false');content.replaceChildren();
  if(!active)content.append(el('p','Espace archivé. Les cartes et accès créateur sont désactivés ; l’historique reste conservé.',{class:'space-notice'}));
  const title=(text,action)=>{const h=put(el('div',undefined,{class:'space-section-heading'}),el('h2',text));if(action)h.append(action);content.append(h);};
  const add=(text)=>active?nav(text,base+'/'+section+'/new','primary'):null;
  const list=()=>{const box=el('div',undefined,{class:'space-list'});content.append(box);return box;};
  const row=(name,details,href,label='Voir',secondary=false,visual=null)=>{
    const article=el('article',undefined,{class:'space-list-row'+(secondary?' is-secondary':'')});
    article.append(put(el('div',undefined,{class:'space-row-title'}),...(visual?[visual]:[]),el('h3',name)),put(el('div',undefined,{class:'space-row-meta'}),...details.map(d=>typeof d==='string'?badge(d):d)),nav(label,href));article.querySelector('a').setAttribute('aria-label',label+' : '+name);return article;
  };
  const empty=(text)=>content.append(el('p',text,{class:'space-empty'}));
  if(entity){
    content.append(nav('← Retour : '+(SECTIONS.find(([key])=>key===section)?.[1]??''),base+'/'+section,'space-back'));
    if(section==='polls'&&entity==='new'){title('Nouveau sondage');const task=el('div',undefined,{class:'space-task-form'});content.append(task);ui.newPoll(data,task);return;}
    const collections={members:['members','member_id'],groups:['groups','group_id'],invitations:['invitations','invitation_id'],access:['staffAccesses','access_id']};
    const collection=collections[section];if(!collection)throw new Error('Page introuvable.');
    const item=entity==='new'?null:data[collection[0]].find(x=>x[collection[1]]===entity);if(entity!=='new'&&!item)throw new Error('Cet élément est introuvable ou inaccessible.');
    const subset={...data,[collection[0]]:item?[item]:[]};
    const task=el('div',undefined,{class:'space-task-form'});content.append(task);
    if(!active&&section!=='groups'){task.append(el('h2',item.display_name??(section==='access'?'Accès de gestion':'Invitation')),el('p','Cet Espace est archivé. Les modifications et les cartes sont désactivées.'));return;}
    ui.spaceDetails(subset,section,entity,task);return;
  }
  if(section==='overview'){
    title('Bienvenue dans ton Espace');
    const metrics=el('div',undefined,{class:'space-metrics'}),items=[[data.groups.filter(g=>g.status==='active').length,'groupes'],...(admin?[[data.members.filter(m=>m.status==='active').length,'membres']]:[[data.polls.length,'sondages accessibles']]),[data.polls.filter(p=>p.status==='published').length,'sondages ouverts']];
    for(const[number,label]of items)metrics.append(put(el('div'),el('strong',String(number)),el('span',number>1?label:label.replace('groupes','groupe').replace('membres','membre').replace('sondages ouverts','sondage ouvert').replace('sondages accessibles','sondage accessible'))));content.append(metrics);
    const actions=el('div',undefined,{class:'space-overview-actions'});if(active){actions.append(nav('Nouveau sondage',base+'/polls/new','primary'));if(admin)actions.append(nav('Ajouter un membre',base+'/members/new'),nav('Créer une invitation',base+'/invitations/new'));}content.append(actions);
    if(admin){const useful=data.invitations.filter(i=>!i.closed&&i.uses<i.max_uses&&i.expires_at>Date.now()/1000).length;content.append(put(el('p',undefined,{class:'help'}),el('span',useful?count(useful,'invitation encore utilisable','invitations encore utilisables')+'. ':'Aucune invitation en cours. '),nav('Voir les invitations',base+'/invitations','space-inline-nav')));}
    title('Les derniers sondages',nav('Tous les sondages',base+'/polls'));const box=list();for(const p of data.polls.slice(0,3))box.append(row(p.question,[status(p)],base+'/poll/'+p.pollId,'Gérer'));if(!data.polls.length)empty('Ton prochain sondage apparaîtra ici.');
    return;
  }
  if(section==='members'){
    title('Membres',add('+ Ajouter un membre'));content.append(el('p','Ouvre une fiche pour modifier les groupes ou gérer la Carte Voti.',{class:'help'}));
    const box=list();for(const m of data.members){const groups=data.groups.filter(g=>m.groupIds.includes(g.group_id)).map(g=>g.name);box.append(row(m.display_name,[...groups.length?groups:['Sans groupe'],m.status!=='active'?'Membre révoqué':m.has_card?'Carte active':'Carte révoquée'],base+'/members/'+m.member_id,'Voir',m.status!=='active',presetThumbnail('member',m.visual_id??m.memberVisualId,catalog)));}if(!data.members.length)empty('Ajoute un premier membre pour lui remettre sa Carte Voti.');return;
  }
  if(section==='groups'){
    title('Groupes',admin?add('+ Nouveau groupe'):null);const box=list();for(const g of data.groups){const details=[admin?count(data.members.filter(m=>m.status==='active'&&m.groupIds.includes(g.group_id)).length,'membre'):'Groupe accessible',...(g.status==='active'?[]:['Archivé'])];box.append(row(g.name,details,base+'/groups/'+g.group_id,admin?'Gérer':'Voir',g.status!=='active',presetThumbnail('group',g.visual_id??g.groupVisualId,catalog)));}if(!data.groups.length)empty('Les groupes permettent de choisir qui participe à chaque sondage.');return;
  }
  if(section==='polls'){
    title('Sondages',add('+ Nouveau sondage'));const box=list(),metadata=[];for(const p of data.polls){const meta=el('span','Audience et résultats…',{class:'space-poll-metadata'});const r=row(p.question,[status(p),meta],base+'/poll/'+p.pollId,'Gérer');box.append(r);metadata.push({p,meta});}if(!data.polls.length)empty('Crée un sondage avec le parcours guidé ou express.');
    // Résumés enrichis par les lectures déjà autorisées. Deux lectures simultanées,
    // 20 au maximum ; toute réponse devenue obsolète est ignorée par ui.call.
    const pending=metadata.slice(0,20);let cursor=0;const worker=async()=>{while(cursor<pending.length&&content.isConnected){const{p,meta}=pending[cursor++];try{const{poll}=await ui.call('getSpacePoll',{pollId:p.pollId},ui.staff(id));if(!meta.isConnected)return;meta.textContent=scopes(poll.accessRules.pollAudience.groupIds,data.groups)+' · '+(poll.status==='draft'?'À publier':poll.results.available?'Résultats disponibles':poll.accessRules.pollAudience.resultsAudience==='admins_only'?'Résultats réservés à l’administration':'Résultats pas encore disponibles');}catch(error){if(error.name==='AbortError')return;if(meta.isConnected)meta.textContent='Détails dans « Gérer »';}}};void worker();void worker();for(const{meta}of metadata.slice(20))meta.textContent='Détails dans « Gérer »';return;
  }
  if(section==='invitations'){
    title('Invitations',add('+ Nouvelle invitation'));const box=list();for(const i of data.invitations){const ended=i.closed||i.uses>=i.max_uses||i.expires_at<=Date.now()/1000;box.append(row(JSON.parse(i.group_ids).length?scopes(i.group_ids,data.groups):'Sans groupe',[count(i.uses,'personne')+' sur '+i.max_uses,ended?'Terminée':'Jusqu’au '+new Date(i.expires_at*1000).toLocaleDateString('fr-FR')],base+'/invitations/'+i.invitation_id,'Voir',ended));}if(!data.invitations.length)empty('Une invitation permet de rejoindre l’Espace et de créer sa Carte Voti.');return;
  }
  if(section==='access'){
    title('Accès de gestion',add('+ Créer un accès'));content.append(el('p','Pour les personnes qui gèrent l’Espace ou créent ses sondages. Les Cartes Voti restent réservées à la participation.',{class:'help'}));const box=list();for(const a of data.staffAccesses)box.append(row(a.role==='admin'?'Administrateur':'Créateur',[scopes(a.group_scopes,data.groups),a.status==='active'?'Actif':'Révoqué'],base+'/access/'+a.access_id,'Voir',a.status!=='active'));content.append(nav('Exporter mon accès personnel',base+'/settings'));return;
  }
  title('Réglages de l’Espace');const settings=el('div',undefined,{class:'space-task-form'});content.append(settings);ui.spaceDetails(data,'settings',null,settings);
}
