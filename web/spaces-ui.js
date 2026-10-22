import {createSpaceCredential,TemporaryMemberSession,buildMemberUrl,isSpaceCredential,memberName} from '../shared/spaces.js';
import {SpaceAccessStorage,decodeSpaceAccess} from './space-storage.js';
import {createPoll} from '../shared/poll-engine.js';
import {emptyState,semanticHash} from '../shared/model.js';
import {humanVerification} from './human-verification.js';
import {submissionFields,commentsAdministration} from './participation-ui.js';
import {createQrMatrix,renderQrSvg,downloadBlob} from './qr.js';
import {scanMemberCard} from './member-scanner.js';
import {memberCardsPdf} from './member-cards.js';
import {sharingPanel} from './sharing.js';
import {posterStudio,resultsPdfPanel} from './poster-studio.js';

const node=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const append=(parent,...children)=>{parent.append(...children);return parent;};
const link=(label,href)=>node('a',label,{href});
function field(label,input){const id='space-'+crypto.randomUUID();input.id=id;return append(node('div',undefined,{class:'field'}),node('label',label,{for:id}),input);}
function textField(label,value=''){const input=node('input',undefined,{type:'text',autocomplete:'off'});input.value=value;return{element:field(label,input),input};}
function selectField(label,items,value){const input=node('select');for(const[v,text]of items)input.append(node('option',text,{value:v}));if(value!==undefined)input.value=value;return{element:field(label,input),input};}

export class SpacesUI {
  constructor({app,adapter,config,error,notify,clearError=()=>{},confirmAction,posters,assets,memberCredential=null,invitationCredential=null}){
    Object.assign(this,{app,adapter,config,error,notify,clearError,confirmAction,posters,assets});this.accesses=new SpaceAccessStorage(localStorage);this.session=new TemporaryMemberSession();
    this.profile=null;this.invitation=invitationCredential;this.issued=[];this.outcome=null;this.disposePanel=null;this.epoch=0;this.intent=null;
    this.channel=typeof BroadcastChannel==='function'?new BroadcastChannel('voti.member.clear.v1'):null;
    if(this.channel)this.channel.onmessage=event=>{if(event.data?.type==='clear'&&this.session.credential&&!this.submitting){this.clearMember();this.cardPrompt();}};
    if(memberCredential)this.setMember(memberCredential);
    window.addEventListener('pagehide',()=>{const participant=document.body.dataset.votiRole==='member';this.clearMember();this.issued=[];this.invitation=null;if(participant){this.outcome=null;this.cardPrompt();}});
  }
  setMember(credential){this.clearMember();this.outcome=null;this.session.set(credential);this.expiry=setTimeout(()=>{this.clearMember();if(/^#\/?(member|p)(\/|$)/.test(location.hash))this.cardPrompt();},300000);}
  clearMember(){clearTimeout(this.expiry);this.session.clear();this.profile=null;}
  button(label,action,className=''){
    const b=node('button',label,{type:'button',class:className});b.addEventListener('click',async()=>{if(b.disabled)return;b.disabled=true;
      try{await action(b);}catch(e){if(b.isConnected&&e.name!=='AbortError'){if(e.code==='REVISION_CONFLICT'){this.notify('Les données ont changé. Actualise avant de recommencer ; rien n’a été écrasé.');}this.error(e);}}finally{if(b.isConnected)b.disabled=false;}});return b;
  }
  title(text){this.clearError();this.notify('');const h=node('h1',text,{tabindex:'-1','data-navigation-focus':''});this.app.append(h);queueMicrotask(()=>{if(h.isConnected)h.focus({preventScroll:true});});document.title=`${text} · Voti`;const marker=document.getElementById('location');marker.hidden=false;marker.textContent=text;for(const a of document.querySelectorAll('.main-nav a'))a.removeAttribute('aria-current');}
  async call(command,input,credential,extras={}){if(!this.adapter)throw new Error('Relais non configuré. Les sondages libres locaux restent disponibles.');const epoch=this.epoch;
    if(isSpaceCredential(credential,'member')&&this.session.credential!==credential)throw new DOMException('La Carte Voti temporaire a expiré.','AbortError');
    const value=await this.adapter.spaceCommand({command,input,credential,...extras});
    const sameVote=command==='castMemberVote'&&this.session.credential===credential&&location.hash.startsWith(`#/p/${input.pollId}`);
    if(epoch!==this.epoch&&!sameVote)throw new DOMException('La page a changé. La réponse ne sera pas affichée.','AbortError');return value;}
  staff(spaceId){const access=this.accesses.get(this.config?.relayId,spaceId);if(!access)throw new Error('Importe un accès administrateur ou créateur pour cet Espace.');return access.credential;}
  async getSpace(id){return this.call('getSpace',{spaceId:id},this.staff(id));}
  async refresh(){await this.handleRoute(location.hash);}
  ownsRoute(hash){const [view,id]=hash.replace(/^#\/?/,'').split('/');return ['spaces','space','member','invite'].includes(view)||Boolean(this.session.credential)||view==='p'&&this.outcome?.pollId===id;}
  leaveRoute(){this.epoch++;this.disposePanel?.();this.disposePanel=null;this.clearMember();this.outcome=null;this.issued=[];this.invitation=null;delete document.body.dataset.votiRole;}
  async handleRoute(hash){
    this.epoch++;
    const parts=hash.replace(/^#\/?/,'').split('/'),[view,id,sub,pollId,last]=parts;
    if((['member','invite','spaces'].includes(view)&&parts.length>1)||(view==='space'&&(parts.length>5||(sub&&sub!=='poll')||(last&&!['share','poster','results'].includes(last))))||(view==='p'&&sub&&!['choice','results'].includes(sub)))throw new Error('Lien Voti invalide.');
    if(view!=='invite')this.invitation=null;
    if(this.session.credential&&!['member','p'].includes(view)){this.clearMember();this.app.replaceChildren();this.title('Participation terminée');this.app.append(node('p','L’identité temporaire a été oubliée. Une Carte Voti ne donne aucun accès à l’administration.'),link('Accueil','#home'));return true;}
    if(!['spaces','space','member','invite'].includes(view)&&!(view==='p'&&this.session.credential)&&!(view==='p'&&this.outcome?.pollId===id)){
      this.disposePanel?.();this.disposePanel=null;if(view!=='p')this.clearMember();this.outcome=null;this.issued=[];delete document.body.dataset.votiRole;return false;
    }
    const epoch=this.epoch;this.disposePanel?.();this.disposePanel=null;this.app.replaceChildren();
    if(view==='p'&&this.outcome?.pollId===id){this.success(id,this.outcome.commentSent);return true;}
    if(view==='p'){
      try{if(!this.profile)this.profile=await this.call('getMemberHome',{},this.session.credential);const response=await this.call('getMemberPoll',{pollId:id},this.session.credential);if(epoch!==this.epoch)return true;
        if(sub==='results')await this.showResults(response.poll,null);else this.participantPoll(response.poll,sub==='choice'?pollId:null,response.alreadyParticipated);return true;
      }catch(e){if(e.name==='AbortError')throw e;if(e.code==='NOT_FOUND'){this.clearMember();return false;}this.cardPrompt(id,sub==='results'?'results':null,sub==='choice'?pollId:null);this.error(e);return true;}
    }
    if(view==='spaces'){this.clearMember();this.issued=[];delete document.body.dataset.votiRole;await this.listSpaces();}
    else if(view==='member'){this.issued=[];if(!this.session.credential)this.cardPrompt();else{try{const profile=await this.call('getMemberHome',{},this.session.credential);if(epoch===this.epoch){this.profile=profile;this.memberHome();}}catch(e){if(e.name==='AbortError')throw e;this.cardPrompt();this.error(e);}}}
    else if(view==='invite'){this.clearMember();this.issued=[];this.inviteForm();}
    else if(view==='space'){
      this.clearMember();delete document.body.dataset.votiRole;if(sub==='poll'&&pollId){const response=await this.call('getSpacePoll',{pollId},this.staff(id));if(epoch!==this.epoch)return true;
        if(last==='share')this.share(response.poll,id);else if(last==='poster')this.studio(response.poll,id);else if(last==='results')await this.showResults(response.poll,id);else await this.managePoll(response.poll,id);
      }else{const data=await this.getSpace(id);if(epoch===this.epoch)this.space(data);}
    }
    return true;
  }
  cardPrompt(pollId=null,extra=null,choiceId=null){
    this.epoch++;
    this.clearMember();
    document.body.dataset.votiRole='member';
    this.outcome=null;this.issued=[];
    this.app.replaceChildren();this.title('Présente ta Carte Voti');this.intent=pollId?{pollId,extra,choiceId}:null;
    this.app.append(node('p','Ta carte ouvre seulement ton espace participant. Elle ne sera pas conservée sur cet appareil.'),
      this.button('Scanner ma Carte Voti',async b=>{const credential=await scanMemberCard(b);if(!credential||!b.isConnected)return;this.setMember(credential);
        try{const profile=await this.call('getMemberHome',{},credential);if(!b.isConnected||this.session.credential!==credential)return;this.profile=profile;
          if(pollId){const response=await this.call('getMemberPoll',{pollId},credential);if(!b.isConnected||this.session.credential!==credential)return;if(extra==='results')await this.showResults(response.poll,null);else this.participantPoll(response.poll,choiceId,response.alreadyParticipated);}
          else{history.replaceState(null,'',location.pathname+location.search+'#member');this.memberHome();}
        }catch(e){if(this.session.credential===credential)this.clearMember();throw e;}
      },'primary'),link('Accueil','#home'));
  }
  memberHome(){
    document.body.dataset.votiRole='member';
    this.app.replaceChildren();this.title('Mon espace');const p=this.profile;
    this.app.append(node('p',`${p.displayName} · ${p.space.name}`),node('p',p.groups.map(g=>g.name).join(' · ')),node('p','Une participation maximum par membre. Ta carte est secrète : garde-la pour toi.',{class:'help'}));
    const list=node('ul',undefined,{class:'poll-list'});for(const poll of p.polls){const status=poll.status==='closed'?'Fermé':poll.alreadyParticipated?'Déjà participé':'À voter';
      const row=append(node('li'),node('h2',poll.question),node('p',status));if(!poll.alreadyParticipated&&poll.status==='published')row.append(link('Voter',`#/p/${poll.pollId}`));
      if(poll.resultsAvailable)row.append(link('Résultats disponibles',`#/p/${poll.pollId}/results`));list.append(row);}
    this.app.append(list,this.button('Terminer',()=>{this.clearMember();location.hash='#home';}));
  }
  participantPoll(poll,qrChoice=null,alreadyParticipated=false){
    document.body.dataset.votiRole='member';
    this.app.replaceChildren();this.title(poll.definition.question);const id=poll.remoteRef.pollId;
    const finish=this.button('Terminer',()=>{this.clearMember();location.hash='#home';});
    if(poll.status==='closed'){this.app.append(node('p','Ce sondage est fermé.'),link('Résultats',`#/p/${id}/results`),finish);return;}
    if(alreadyParticipated){this.app.append(node('p','Déjà participé. Aucun nouveau vote ne peut être envoyé avec cette carte.'),link('Résultats',`#/p/${id}/results`),this.button('Participant suivant',()=>this.cardPrompt(id),'primary'),finish);return;}
    if(qrChoice&&poll.definition.choices.some(c=>c.id===qrChoice)){this.confirmVote(poll,qrChoice,true);return;}
    if(qrChoice)this.app.append(node('p','Le choix du QR n’est plus disponible. Choisis une réponse.'));
    const form=node('form'),choices=node('fieldset',undefined,{class:'vote-choices'});choices.append(node('legend','Choisis une réponse'));
    for(const choice of poll.definition.choices){const input=node('input',undefined,{type:'radio',name:'space-choice',value:choice.id,required:''});choices.append(append(node('label',undefined,{class:'vote-choice'}),input,node('span',choice.label)));}
    const next=node('button','Continuer',{type:'submit',class:'primary'});form.append(choices,next);form.addEventListener('submit',e=>{e.preventDefault();this.confirmVote(poll,form.querySelector('input:checked').value,false);});this.app.append(form);
  }
  confirmVote(poll,choiceId,fromQr){
    this.app.replaceChildren();this.title('Tu choisis : '+poll.definition.choices.find(c=>c.id===choiceId).label);
    const form=node('form'),state={},fields=submissionFields(poll.definition,state,{memberIdentity:this.profile?.displayName??null});
    const actionId=crypto.randomUUID();let frozen=null,busy=false;
    const confirm=node('button','Oui, je confirme',{type:'submit',class:'primary'});
    const other=this.button('Autre choix',()=>{history.replaceState(null,'',location.pathname+location.search+`#/p/${poll.remoteRef.pollId}`);this.participantPoll(poll);});
    if(fromQr)form.append(node('p','Choix proposé par le QR. Confirme-le ou choisis une autre réponse.'));
    form.append(fields.element,append(node('div',undefined,{class:'actions'}),other,confirm));
    form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;this.submitting=true;confirm.disabled=true;other.disabled=true;
      try{if(!frozen){const submission=fields.validate();frozen={pollId:poll.remoteRef.pollId,actionId,choiceId,comment:submission.comment,expectedDefinitionHash:await semanticHash(poll)};fields.freeze();}
        await this.call('castMemberVote',frozen,this.session.credential);const commentSent=Boolean(frozen.comment);this.clearMember();this.channel?.postMessage({type:'clear'});state.displayName='';state.comment='';frozen=null;
        this.outcome={pollId:poll.remoteRef.pollId,commentSent};this.success(poll.remoteRef.pollId,commentSent);
      }catch(error){if(form.isConnected){if(error.code==='REVISION_CONFLICT'){try{const next=await this.call('getMemberPoll',{pollId:poll.remoteRef.pollId},this.session.credential);this.participantPoll(next.poll,fromQr?choiceId:null,next.alreadyParticipated);this.notify('Le sondage a changé. Aucun vote envoyé : vérifie les nouvelles règles avant de confirmer.');}catch(e){this.clearMember();this.cardPrompt(poll.remoteRef.pollId);this.error(e);}}else if(['ALREADY_PARTICIPATED','INVALID_CAPABILITY','NOT_ELIGIBLE'].includes(error.code)){this.clearMember();this.app.replaceChildren();this.title(error.code==='ALREADY_PARTICIPATED'?'Déjà participé':'Carte non autorisée');this.app.append(node('p','Aucun nouveau vote n’a été enregistré.'),link('Accueil','#home'));}else this.error(error);}}
      finally{busy=false;this.submitting=false;if(confirm.isConnected){confirm.disabled=false;other.disabled=false;}}
    });this.app.append(form);
  }
  success(pollId,commentSent){
    this.epoch++;
    this.app.replaceChildren();this.title('Merci !');this.app.append(node('p','Ton vote a bien été enregistré.'),...(commentSent?[node('p','Ton commentaire a aussi été envoyé.')]:[]),node('p','Ta carte et ton identité ont été oubliées sur cet appareil.'),
      this.button('Participant suivant',()=>{this.outcome=null;this.cardPrompt(pollId);},'primary'),link('Accueil','#home'));
  }
  async listSpaces(){
    const epoch=this.epoch;
    this.title('Espaces & groupes');this.app.append(node('p','Un Espace réunit des groupes et des membres. Aucun compte e-mail ou mot de passe n’est nécessaire.'),link('Mes sondages libres','#home'));
    if(!this.config){this.app.append(node('p','Un relais Internet configuré est nécessaire pour les Espaces. Le mode libre local reste disponible.'));return;}
    for(const access of this.accesses.list().filter(a=>a.relayId===this.config.relayId)){
      if(epoch!==this.epoch)return;
      const row=node('article',undefined,{class:'card'});row.append(link('Ouvrir cet Espace',`#space/${access.spaceId}`),this.button('Retirer cet accès de cet appareil',async b=>{if(await this.confirmAction({trigger:b,title:'Oublier cet accès de gestion ?',description:'L’Espace reste en ligne. Exporte ton accès avant s’il n’est conservé nulle part ailleurs.',actionLabel:'Oublier cet accès',danger:true})){await this.accesses.delete(access.relayId,access.spaceId);await this.refresh();}}));this.app.append(row);
      try{const data=await this.getSpace(access.spaceId);if(row.isConnected)row.querySelector('a').textContent=data.name;}catch{if(row.isConnected)row.append(node('p','Accès indisponible.'))}
    }
    if(epoch!==this.epoch)return;
    const name=textField('Nom de l’Espace'),form=node('form',undefined,{class:'card'}),create=node('button','Créer un Espace',{type:'submit',class:'primary'});name.input.required=true;form.append(name.element,create);
    form.addEventListener('submit',async e=>{e.preventDefault();if(create.disabled)return;create.disabled=true;const spaceId=crypto.randomUUID(),credential=createSpaceCredential('staff'),challenge=node('div');form.append(challenge);
      try{const token=await humanVerification(this.config,challenge);if(!create.isConnected)return;await this.accesses.put({relayId:this.config.relayId,spaceId,credential});await this.call('createSpace',{spaceId,name:name.input.value,expectedRevision:0},credential,{humanVerificationToken:token});location.hash=`#space/${spaceId}`;}
      catch(error){this.error(error);}finally{challenge.remove();if(create.isConnected)create.disabled=false;}});this.app.append(form,this.importAccess());
  }
  importAccess(){
    const input=node('input',undefined,{type:'file',accept:'application/json,.json'}),box=append(node('section',undefined,{class:'card'}),node('h2','Importer un accès SECRET à un Espace'),field('Fichier d’accès de gestion',input));
    input.addEventListener('change',async()=>{try{const file=input.files[0];if(!file||file.size>4096)throw new Error('Fichier d’accès invalide.');const value=decodeSpaceAccess(await file.text(),this.config.relayId);
      await this.call('getSpace',{spaceId:value.spaceId},value.credential);const previous=this.accesses.get(value.relayId,value.spaceId);
      if(previous&&previous.credential!==value.credential&&!await this.confirmAction({trigger:input,title:'Remplacer l’accès à cet Espace ?',description:'Le nouvel accès a été vérifié. Il remplacera la capacité de gestion conservée sur cet appareil.',actionLabel:'Remplacer l’accès'}))return;
      await this.accesses.put({relayId:value.relayId,spaceId:value.spaceId,credential:value.credential},previous?.credential);location.hash=`#space/${value.spaceId}`;
    }catch(error){this.error(error);}finally{input.value='';}});return box;
  }
  async adminMutation(data,command,fields){await this.call(command,{spaceId:data.spaceId,...fields,expectedRevision:data.revision},this.staff(data.spaceId));await this.refresh();}
  groupSelection(groups,selected=[]){const box=node('fieldset',undefined,{class:'space-group-options'});box.append(node('legend','Groupes'));for(const g of groups.filter(g=>g.status==='active')){const input=node('input',undefined,{type:'checkbox',value:g.group_id});input.checked=selected.includes(g.group_id);box.append(append(node('label'),input,node('span',g.name)));}return{element:box,values:()=>[...box.querySelectorAll('input:checked')].map(i=>i.value)};}
  space(data){
    this.title(data.name);this.app.append(node('p',data.access.role==='admin'?'Administrateur de l’Espace':'Créateur de l’Espace'),link('Tous les Espaces','#spaces'));
    if(data.status==='archived')this.app.append(node('p','Espace archivé. Les cartes et accès créateur sont désactivés ; l’historique reste conservé.'));
    const id=data.spaceId,admin=data.access.role==='admin'&&data.status==='active',credential=this.staff(id);
    if(admin){const name=textField('Nom de l’Espace',data.name);this.app.append(name.element,this.button('Renommer l’Espace',()=>this.adminMutation(data,'renameSpace',{name:name.input.value})),this.button('Archiver l’Espace',async b=>{if(await this.confirmAction({trigger:b,title:'Archiver cet Espace ?',description:'Les accès et cartes seront désactivés. Les sondages et historiques sont conservés. Cette version ne propose pas de réactivation.',actionLabel:'Archiver l’Espace',danger:true})){await this.call('archiveSpace',{spaceId:id,expectedRevision:data.revision},credential);location.hash='#spaces';}}));}
    this.app.append(this.button('Exporter mon accès SECRET',()=>downloadBlob(new Blob([JSON.stringify({version:1,relayId:this.config.relayId,spaceId:id,credential})],{type:'application/json'}),`voti-space-access-${id}.json`)),node('p','Cet accès permet de gérer l’Espace selon son rôle. Ne le partage pas publiquement.',{class:'help'}));
    const groups=append(node('section',undefined,{class:'card'}),node('h2','Groupes'));
    for(const g of data.groups){groups.append(node('h3',g.name));if(admin){const name=textField('Nom du groupe',g.name);groups.append(name.element,this.button('Renommer le groupe',()=>this.adminMutation(data,'renameGroup',{groupId:g.group_id,name:name.input.value})),this.button('Archiver le groupe',async b=>{if(await this.confirmAction({trigger:b,title:'Archiver ce groupe ?',description:'Les membres et sondages historiques seront conservés. Un groupe avec des sondages actifs ne peut pas être archivé.',actionLabel:'Archiver'}))await this.adminMutation(data,'archiveGroup',{groupId:g.group_id});}));}}
    if(admin){const name=textField('Nom du nouveau groupe');groups.append(name.element,this.button('Créer le groupe',()=>this.adminMutation(data,'createGroup',{groupId:crypto.randomUUID(),name:name.input.value})));}this.app.append(groups);
    if(admin){
      const members=append(node('section',undefined,{class:'card'}),node('h2','Membres & Cartes Voti'));
      for(const m of data.members){const row=node('article',undefined,{class:'member-row'}),name=textField('Nom ou pseudonyme',m.display_name),selection=this.groupSelection(data.groups,m.groupIds);
        row.append(node('h3',m.display_name),node('p',m.status==='active'?(m.has_card?'Participant · carte active':'Participant · carte révoquée'):'Membre révoqué'));if(m.status==='active')row.append(name.element,selection.element,
          this.button('Enregistrer le membre',()=>this.adminMutation(data,'updateMember',{memberId:m.member_id,displayName:name.input.value,groupIds:selection.values()})),
          this.button('Régénérer la carte',async b=>{if(!await this.confirmAction({trigger:b,title:'Régénérer cette Carte Voti ?',description:'L’ancienne carte ne fonctionnera plus. Les votes passés restent conservés, sans permettre de retrouver un bulletin anonyme.',actionLabel:'Régénérer'}))return;const card=createSpaceCredential('member');await this.call('rotateMemberCard',{spaceId:id,memberId:m.member_id,memberCredential:card,expectedRevision:data.revision},credential);this.showCard({credential:card,memberId:m.member_id,displayName:m.display_name,spaceName:data.name});}),
          this.button('Révoquer la carte',async b=>{if(await this.confirmAction({trigger:b,title:'Révoquer cette carte ?',description:'Le membre et ses anciens votes restent conservés. Une nouvelle carte pourra être générée.',actionLabel:'Révoquer la carte',danger:true}))await this.adminMutation(data,'revokeMemberCard',{memberId:m.member_id});},'danger'),
          this.button('Révoquer le membre',async b=>{if(await this.confirmAction({trigger:b,title:'Révoquer ce membre ?',description:'La carte sera invalidée. Les anciens votes et le snapshot des sondages seront conservés.',actionLabel:'Révoquer',danger:true}))await this.adminMutation(data,'revokeMember',{memberId:m.member_id});},'danger'));
        members.append(row);
      }
      const name=textField('Nom ou pseudonyme du nouveau membre'),selection=this.groupSelection(data.groups);members.append(name.element,selection.element,
        this.button('Créer le membre et sa carte',async()=>{const card=createSpaceCredential('member'),memberId=crypto.randomUUID();await this.call('createMember',{spaceId:id,memberId,displayName:name.input.value,groupIds:selection.values(),memberCredential:card,expectedRevision:data.revision},credential);this.showCard({credential:card,memberId,displayName:name.input.value,spaceName:data.name});}));this.app.append(members);
      const invite=append(node('section',undefined,{class:'card'}),node('h2','Invitations')),inviteGroups=this.groupSelection(data.groups),limit=node('input',undefined,{type:'number',min:1,max:200,value:1}),days=node('input',undefined,{type:'number',min:1,max:30,value:7});
      invite.append(inviteGroups.element,field('Nombre maximum d’utilisations (1 = invitation individuelle)',limit),field('Expiration en jours',days),this.button('Créer une invitation',async()=>{const token=createSpaceCredential('invitation');await this.call('createInvitation',{spaceId:id,invitationId:crypto.randomUUID(),groupIds:inviteGroups.values(),maxUses:Number(limit.value),expiresInDays:Number(days.value),invitationCredential:token,expectedRevision:data.revision},credential);this.app.replaceChildren();this.title('Invitation secrète');const url=new URL(location.pathname,location.origin);url.hash='/invite/'+token;this.app.append(this.qrImage(url.href,'Invitation Voti secrète'),node('p','Seules les personnes invitées doivent recevoir ce QR.'),link('Retour à l’Espace',`#space/${id}`));}));
      for(const i of data.invitations)invite.append(node('p',`${i.uses} / ${i.max_uses} utilisations · ${i.closed?'Fermée':'Active jusqu’au '+new Date(i.expires_at*1000).toLocaleDateString('fr-FR')}`),this.button('Fermer l’invitation',()=>this.adminMutation(data,'closeInvitation',{invitationId:i.invitation_id})));this.app.append(invite);
      const staffBox=append(node('section',undefined,{class:'card'}),node('h2','Accès de gestion')),role=selectField('Rôle',[['creator','Créateur'],['admin','Administrateur']]),scope=this.groupSelection(data.groups);
      staffBox.append(role.element,scope.element,node('p','Créateur : aucun groupe coché = tout l’Espace. Une carte participant ne donne jamais ces droits.'),this.button('Créer un accès de gestion SECRET',async()=>{const token=createSpaceCredential('staff'),scopes=scope.values();await this.call('createAccess',{spaceId:id,accessId:crypto.randomUUID(),role:role.input.value,groupIds:role.input.value==='admin'||!scopes.length?null:scopes,staffCredential:token,expectedRevision:data.revision},credential);downloadBlob(new Blob([JSON.stringify({version:1,relayId:this.config.relayId,spaceId:id,credential:token})],{type:'application/json'}),`voti-space-access-${id}.json`);await this.refresh();}));this.app.append(staffBox);
      for(const access of data.staffAccesses)staffBox.append(node('p',`${access.role==='admin'?'Administrateur':'Créateur'} · ${access.status==='active'?'Actif':'Révoqué'}`),this.button('Révoquer cet accès',async b=>{if(await this.confirmAction({trigger:b,title:'Révoquer cet accès de gestion ?',description:'Il ne pourra plus gérer l’Espace. Le dernier accès administrateur ne peut pas être révoqué.',actionLabel:'Révoquer cet accès',danger:true}))await this.adminMutation(data,'revokeAccess',{accessId:access.access_id});},'danger'));
    }
    const polls=append(node('section',undefined,{class:'card'}),node('h2','Sondages de l’Espace'));for(const p of data.polls)polls.append(append(node('p'),link(`${p.question} · ${p.status==='draft'?'Brouillon':p.status==='closed'?'Fermé':'Ouvert'}`,`#space/${id}/poll/${p.pollId}`)));
    this.app.append(polls);if(data.status==='active')this.newPoll(data,polls);
  }
  qrImage(url,alt){return node('img',undefined,{class:'member-card-qr',alt,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(renderQrSvg(createQrMatrix(url)))});}
  showCard(card){
    this.clearMember();this.app.replaceChildren();this.title('Carte Voti créée');if(card.memberId)this.issued=this.issued.filter(c=>c.memberId!==card.memberId);if(!this.issued.some(c=>c.credential===card.credential))this.issued.push(card);
    this.app.append(node('p',card.displayName+' · '+card.spaceName),this.qrImage(buildMemberUrl(location.origin+location.pathname,card.credential),'Carte Voti secrète'),node('p','Garde cette carte pour toi. Cette carte ne sera pas conservée dans le navigateur.'),
      this.button('Télécharger les cartes A4 (SECRET)',async()=>downloadBlob(await memberCardsPdf(this.issued,location.origin+location.pathname),'voti-member-cards-secret.pdf')),
      location.hash==='#invite'?this.button('Ouvrir Mon espace',()=>{this.setMember(card.credential);location.hash='#member';}):this.button('Retour à l’Espace',()=>this.refresh()));
  }
  inviteForm(){
    document.body.dataset.votiRole='member';
    this.title('Invitation Voti');if(!this.invitation){this.app.append(node('p','Scanne de nouveau ton invitation. Aucun secret n’a été conservé.'));return;}
    const name=textField('Ton nom ou pseudonyme');let registration=null,accepted=false;
    this.app.append(name.element,this.button('Créer ma Carte Voti',async()=>{if(!registration){registration={memberId:crypto.randomUUID(),displayName:memberName(name.input.value),memberCredential:createSpaceCredential('member')};name.input.disabled=true;}
      if(!accepted){await this.call('acceptInvitation',registration,this.invitation);accepted=true;}this.setMember(registration.memberCredential);const profile=await this.call('getMemberHome',{},registration.memberCredential);this.invitation=null;this.showCard({credential:registration.memberCredential,displayName:profile.displayName,spaceName:profile.space.name});registration=null;this.notify('Invitation acceptée. Télécharge ta carte pour la garder.');}));
  }
  newPoll(data,box){
    const question=textField('Question'),answers=node('textarea',undefined,{rows:4,placeholder:'Une réponse par ligne (2 à 6)'}),groups=this.groupSelection(data.groups,data.access.groupIds??[]),identity=selectField('Participation',[['anonymous','Anonyme'],['identified','Identifiée avec la Carte Voti']]),comments=selectField('Commentaires',[['optional','Vote + commentaire facultatif'],['disabled','Vote simple']]),visibility=selectField('Visibilité des commentaires',[['private','Privés'],['public_with_results','Approuvés avec les résultats']]),release=selectField('Quand montrer les résultats ?',[['threshold','À partir de N participations'],['all_eligible','Quand tous les membres éligibles ont participé'],['closed','À la clôture'],['all_eligible_or_closed','Tout le monde OU clôture']]),audience=selectField('Audience des résultats',[['poll_audience','Membres ciblés'],['admins_only','Administration uniquement']]),minimum=node('input',undefined,{type:'number',min:1,max:100000,value:5});
    const details=node('details');details.append(node('summary','Créer un sondage dans cet Espace'),question.element,field('Réponses',answers),groups.element,node('p','Aucun groupe coché : tout l’Espace. La liste des membres éligibles sera figée à la publication.'),identity.element,comments.element,visibility.element,release.element,field('Minimum de confidentialité obligatoire',minimum),audience.element,
      this.button('Créer le brouillon',async()=>{const choices=answers.value.split('\n').map(s=>s.trim()).filter(Boolean);const poll=createPoll(emptyState(),{question:question.input.value,choices,participationIdentityMode:identity.input.value,commentMode:comments.input.value,commentVisibility:visibility.input.value}).polls[0];poll.resultRules.releaseMode=release.input.value;poll.resultRules.minimumResponses=Number(minimum.value);const ids=groups.values();const prep=await this.call('prepareSpacePublication',{spaceId:data.spaceId,poll,pollAudience:{spaceId:data.spaceId,mode:ids.length?'groups':'space',groupIds:ids,resultsAudience:audience.input.value},expectedRevision:data.revision},this.staff(data.spaceId));location.hash=`#space/${data.spaceId}/poll/${prep.pollId}`;},'primary'));box.append(details);
  }
  async managePoll(poll,spaceId){
    this.title(poll.definition.question);const id=poll.remoteRef.pollId,credential=this.staff(spaceId);
    const card=append(node('section',undefined,{class:'card','data-accent':poll.style.themeId}),node('p',poll.status==='draft'?'Brouillon · Publication en attente':poll.status==='closed'?'Fermé · En ligne · Espace':'Ouvert · En ligne · Espace'),node('p',poll.locked?'Le premier vote a verrouillé la question, les choix et les règles.':'Aucun vote accepté. La définition peut encore être modifiée.'),node('h2','Réponses proposées'));
    const answers=node('ol',undefined,{class:'management-answer-list'});for(const c of poll.definition.choices)answers.append(node('li',c.label));card.append(answers);
    if(poll.status!=='draft')card.append(link('Ouvrir le vote',`#/p/${id}`),link('QR & partager le sondage',`#space/${spaceId}/poll/${id}/share`),link('Résultats',`#space/${spaceId}/poll/${id}/results`));
    const mutate=async(method,fields={})=>{const current=(await this.call('getSpacePoll',{pollId:id},credential)).poll;await this.adapter[method]({pollId:id,adminCapability:credential,expectedRevision:current.remoteRef.revision,...fields});await this.refresh();};
    if(poll.status==='draft')card.append(this.button('Publier pour les membres',async()=>{await this.call('publishSpacePoll',{pollId:id,expectedRevision:poll.remoteRef.revision},credential);await this.refresh();},'primary'),this.button('Abandonner le brouillon',async b=>{if(await this.confirmAction({trigger:b,title:'Abandonner ce brouillon ?',description:'Ce sondage non publié sera supprimé du relais.',actionLabel:'Abandonner',danger:true})){await this.adapter.discardPublication({pollId:id,adminCapability:credential,expectedRevision:poll.remoteRef.revision});location.hash=`#space/${spaceId}`;}},'danger'));
    if(poll.status==='published')card.append(this.button('Fermer le sondage',async b=>{if(await this.confirmAction({trigger:b,title:'Fermer ce sondage ?',description:'Il n’acceptera plus de vote. Le minimum de confidentialité reste obligatoire.',actionLabel:'Fermer le sondage'}))await mutate('closePoll');}));
    const style=selectField('Apparence',[['mint','Menthe'],['lavender','Lavande'],['peach','Pêche']],poll.style.themeId);card.append(style.element,this.button('Enregistrer l’apparence',()=>mutate('updateStyle',{style:{...poll.style,themeId:style.input.value}})));
    if(!poll.locked&&poll.status!=='closed'){
      const q=textField('Modifier la question',poll.definition.question),identity=selectField('Participation',[['anonymous','Anonyme'],['identified','Identifiée avec la Carte Voti']],poll.definition.participationIdentityMode),comments=selectField('Commentaires',[['optional','Vote + commentaire facultatif'],['disabled','Vote simple']],poll.definition.commentMode),visibility=selectField('Visibilité des commentaires',[['private','Privés'],['public_with_results','Approuvés avec les résultats']],poll.definition.commentVisibility),release=selectField('Quand montrer les résultats ?',[['threshold','À partir de N participations'],['all_eligible','Tous les membres éligibles'],['closed','À la clôture'],['all_eligible_or_closed','Tout le monde OU clôture']],poll.resultRules.releaseMode),audience=selectField('Audience des résultats',[['poll_audience','Membres ciblés'],['admins_only','Administration uniquement']],poll.accessRules.pollAudience.resultsAudience),minimum=node('input',undefined,{type:'number',min:1,max:100000,value:poll.resultRules.minimumResponses});
      const choices=node('textarea',undefined,{rows:4});choices.value=poll.definition.choices.map(c=>c.label).join('\n');const description=node('textarea',undefined,{rows:2});description.value=poll.definition.description;
      const space=poll.status==='draft'?await this.getSpace(spaceId):null,groups=space?this.groupSelection(space.groups,poll.accessRules.pollAudience.groupIds):null;
      card.append(q.element,field('Description',description),field('Réponses (2 à 6, une par ligne)',choices));if(groups)card.append(groups.element,node('p','Aucun groupe coché : tout l’Espace. Après publication, cette audience et son snapshot sont figés.'));
      card.append(identity.element,comments.element,visibility.element,release.element,field('Minimum de confidentialité',minimum),audience.element,this.button('Enregistrer les règles',async()=>{const labels=choices.value.split('\n').map(s=>s.trim()).filter(Boolean),ids=groups?.values();await this.call('updateSpacePoll',{pollId:id,expectedRevision:poll.remoteRef.revision,definition:{...poll.definition,question:q.input.value,description:description.value.trim()||null,choices:labels.map((label,i)=>({...poll.definition.choices[i],id:poll.definition.choices[i]?.id??crypto.randomUUID(),label,shortLabel:null,emoji:null,imageRef:null,order:i})),participationIdentityMode:identity.input.value,privacy:identity.input.value==='identified'?'named':'anonymous',commentMode:comments.input.value,commentVisibility:visibility.input.value},resultRules:{...poll.resultRules,releaseMode:release.input.value,minimumResponses:Number(minimum.value)},pollAudience:{...poll.accessRules.pollAudience,...(ids?{mode:ids.length?'groups':'space',groupIds:ids}:{}),resultsAudience:audience.input.value}},credential);await this.refresh();}));
    }
    if(poll.status!=='draft')for(const everywhere of [false,true])card.append(this.button(everywhere?'Supprimer partout':'Supprimer en ligne',async b=>{if(!await this.confirmAction({trigger:b,title:everywhere?'Supprimer partout ?':'Supprimer ce sondage en ligne ?',description:everywhere?'Le sondage en ligne et le design de cet appareil seront supprimés. Les PDF téléchargés restent sur leurs appareils.':'Votes, commentaires et éligibilités seront supprimés. Le design local peut être retiré dans Sauvegarde.',actionLabel:everywhere?'Supprimer partout':'Supprimer en ligne',danger:true}))return;let remoteDeleted=false;
      try{const current=(await this.call('getSpacePoll',{pollId:id},credential)).poll;await this.adapter.deletePoll({pollId:id,adminCapability:credential,expectedRevision:current.remoteRef.revision});remoteDeleted=true;if(everywhere)await this.posters.remove(id);location.hash=`#space/${spaceId}`;}
      catch(error){if(remoteDeleted)throw new Error('Suppression en ligne réussie. Le design local reste à retirer dans Sauvegarde.',{cause:error});throw error;}
    },'danger'));this.app.append(card);
    if(poll.status==='draft'){this.app.append(link('Retour à l’Espace',`#space/${spaceId}`));return;}
    const attendance=await this.call('getPollAttendance',{pollId:id},credential),summary=append(node('section',undefined,{class:'card'}),node('h2',`${attendance.consumed} participations sur ${attendance.eligible}`));
    if(attendance.identityMode==='identified'){const filter=selectField('Participants',[['all','Tous'],['voted','A participé'],['pending','À relancer']]),list=node('ul');const draw=()=>{list.replaceChildren();for(const m of attendance.members.filter(m=>filter.input.value==='all'||Boolean(m.consumed)===(filter.input.value==='voted')))list.append(node('li',`${m.display_name} · ${m.consumed?'A participé':'À relancer'}${m.choice_id?' · '+poll.definition.choices.find(c=>c.id===m.choice_id)?.label:''}`));};filter.input.addEventListener('change',draw);draw();summary.append(filter.element,list);}else summary.append(node('p','Aucune liste nominative de votants ou non-votants n’est disponible pour ce sondage anonyme.'));
    this.app.append(summary,link('Retour à l’Espace',`#space/${spaceId}`));
    const panel=commentsAdministration(poll,{load:cursor=>this.adapter.getParticipations({pollId:id,adminCapability:credential,cursor}),mutate:async(_node,c,action)=>{const current=(await this.call('getSpacePoll',{pollId:id},credential)).poll;await this.adapter[action==='delete'?'deleteComment':'updateCommentStatus']({pollId:id,adminCapability:credential,expectedRevision:current.remoteRef.revision,commentId:c.commentId,expectedCommentRevision:c.revision,...(action==='delete'?{}:{moderationStatus:action})});},error:this.error});this.app.append(panel.element);this.disposePanel=panel.dispose;
  }
  share(poll,spaceId){if(poll.status==='draft')throw new Error('Publie d’abord ce sondage pour créer ses QR.');this.title('Partager le sondage');const id=poll.remoteRef.pollId;const panel=sharingPanel(poll,{baseUrl:location.origin+location.pathname,error:this.error,notify:this.notify,openStudio:()=>location.hash=`#space/${spaceId}/poll/${id}/poster`});this.app.append(panel,link('Gérer',`#space/${spaceId}/poll/${id}`));}
  studio(poll,spaceId){if(poll.status==='draft')throw new Error('Publie d’abord ce sondage pour créer son affiche.');this.title('Studio d’affiche');const panel=posterStudio(poll,{repository:this.posters,pollAssets:this.assets,error:this.error,notify:this.notify,refreshPoll:async()=>(await this.call('getSpacePoll',{pollId:poll.remoteRef.pollId},this.staff(spaceId))).poll});this.app.append(panel.element);this.disposePanel=panel.dispose;}
  async showResults(poll,spaceId){
    this.app.replaceChildren();this.title('Les résultats');const result=poll.results,id=poll.remoteRef.pollId;
    if(!spaceId)this.app.append(this.button('Terminer',()=>{this.clearMember();location.hash='#home';}));
    if(!result.available){this.app.append(node('p','Les résultats ne sont pas encore disponibles.'),node('p',`Minimum obligatoire : ${poll.resultRules.minimumResponses} participations.`));return;}
    this.app.append(node('h2',poll.definition.question),node('p',`${result.totalBallots} réponses`));
    for(const c of result.choices){const section=append(node('section',undefined,{class:'result-row'}),node('h3',c.label),node('p',`${c.count} · ${c.percentage.toFixed(1)} %`));for(const comment of result.comments?.items?.filter(m=>m.choiceId===c.id)||[])section.append(node('p',comment.text));this.app.append(section);}
    const credential=spaceId?this.staff(spaceId):this.session.credential;
    const fresh=async()=>{const next=(await this.call(spaceId?'getSpacePoll':'getMemberPoll',{pollId:id},credential)).poll;return{poll:next,results:next.results};};
    this.app.append(resultsPdfPanel({...poll,id},result,{repository:this.posters,pollAssets:this.assets,refreshPoll:fresh,error:this.error,notify:this.notify,admin:Boolean(spaceId),
      loadComments:async()=>{const items=[];let cursor=null;do{const response=await this.call(spaceId?'getSpaceComments':'getMemberComments',{pollId:id,cursor},credential);items.push(...response.page.items);cursor=response.page.nextCursor;if(items.length>500)throw new Error('Maximum 500 commentaires pour ce PDF.');}while(cursor);return items;},
      loadIdentities:async()=>{const entries=[];let cursor=null;do{const page=await this.adapter.getParticipations({pollId:id,adminCapability:credential,cursor});entries.push(...page.entries);cursor=page.nextCursor;if(entries.length>500)throw new Error('Maximum 500 participations pour ce PDF.');}while(cursor);return entries;}}));
  }
}
