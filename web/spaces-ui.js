import {mascot} from './mascot.js';
import {rememberCard,clearCards,eraseCard,availableCards,forgetCard} from './card-session.js';
import {backdropToggle} from './card-batch-ui.js';
import {editActions,guardEditNavigation} from './edit-actions.js';
import {createSpaceCredential,TemporaryMemberSession,buildMemberUrl,isSpaceCredential,memberName} from '../shared/spaces.js';
import {SpaceAccessStorage,decodeSpaceAccess} from './space-storage.js';
import {semanticHash} from '../shared/model.js';
import {humanVerification} from './human-verification.js';
import {submissionFields,commentsAdministration} from './participation-ui.js';
import {createQrMatrix,renderQrSvg,downloadBlob} from './qr.js';
import {scanMemberCard} from './member-scanner.js';
import {memberCardsPdf} from './member-cards.js';
import {sharingPanel} from './sharing.js';
import {posterStudio,resultsPdfPanel} from './poster-studio.js';
import {resultsState,accessFilename,cardsFilename,fileLabel,makeSpacePollDraft} from './space-ux.js';
import {renderSpacePoll} from './space-poll-management.js';
import {spacePollEditor} from './space-poll-editor.js';
import {renderSpaceManagement} from './space-management.js';
import {withSpaceIcon} from './space-icons.js';
import {filePicker,refreshFilePicker} from './file-picker.js';
import {memberCardModel} from './member-card-model.js';
import {memberCardPreview} from './member-card-view.js';
import {THEME_OPTIONS,normalizeTheme} from './themes.js';
import {visualDisplayOptions} from './visual-gallery.js';
import {visualField} from './visual-field.js';
import {resolveVisual,visualImage} from './visual-presets.js';

const node=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const append=(parent,...children)=>{parent.append(...children);return parent;};
const pollActions=(...children)=>append(node('div',undefined,{class:'actions poll-actions'}),...children);
const link=(label,href)=>{const a=node('a',label.replace(/^←\s*/,''),{href,class:'button space-navigation-link'});return label.startsWith('←')?withSpaceIcon(a,'back'):a;};
function field(label,input){const id='space-'+crypto.randomUUID();input.id=id;return append(node('div',undefined,{class:'field'}),node('label',label,{for:id}),input);}
function textField(label,value=''){const input=node('input',undefined,{type:'text',autocomplete:'off'});input.value=value;return{element:field(label,input),input};}
function selectField(label,items,value){const input=node('select');for(const[v,text]of items)input.append(node('option',text,{value:v}));if(value!==undefined)input.value=value;return{element:field(label,input),input};}

export class SpacesUI {
  constructor({app,adapter,config,error,notify,clearError=()=>{},confirmAction,posters,assets,memberCredential=null,invitationCredential=null}){
    Object.assign(this,{app,adapter,config,error,notify,clearError,confirmAction,posters,assets});this.accesses=new SpaceAccessStorage(localStorage);this.session=new TemporaryMemberSession();
    const home=withSpaceIcon(link('Accueil Voti','#home'),'back');home.className='button space-global-return';document.querySelector('.topbar').insertBefore(home,document.getElementById('theme-toggle'));
    window.addEventListener('beforeunload',event=>{if(this.activeEdit?.root.isConnected&&this.activeEdit.dirty||this.cardJob?.running){event.preventDefault();event.returnValue='';}});
    this.profile=null;this.invitation=invitationCredential;this.issued=[];this.cardsVersion=0;this.cardsClearVersion=0;this.cardSelection=null;this.cardBatchResult=null;this.outcome=null;this.disposePanel=null;this.epoch=0;this.intent=null;this.shell=null;
    this.channel=typeof BroadcastChannel==='function'?new BroadcastChannel('voti.member.clear.v1'):null;
    if(this.channel)this.channel.onmessage=event=>{if(event.data?.type==='clear'&&this.session.credential&&!this.submitting){this.clearMember();this.cardPrompt();}};
    if(memberCredential)this.setMember(memberCredential);
    window.addEventListener('pagehide',()=>{const participant=document.body.dataset.votiRole==='member';this.clearMember();clearCards(this);eraseCard(this.currentCard);this.currentCard=null;this.cardSelection=null;document.querySelectorAll('.voti-member-card').forEach(c=>c.remove());this.invitation=null;if(participant){this.outcome=null;this.cardPrompt();}});
  }
  setMember(credential){this.clearMember();this.outcome=null;this.session.set(credential);this.expiry=setTimeout(()=>{this.clearMember();if(/^#\/?(member|p)(\/|$)/.test(location.hash))this.cardPrompt();},300000);}
  clearMember(){clearTimeout(this.expiry);this.session.clear();this.profile=null;}
  button(label,action,className=''){
    const b=node('button',label,{type:'button',class:className});b.addEventListener('click',async()=>{if(b.disabled)return;b.disabled=true;
      try{if(this.activeEdit?.root.contains(b)&&!b.closest('.edit-action-bar')&&this.activeEdit.dirty&&!await this.activeEdit.confirmDiscard(b))return;await action(b);}catch(e){if(b.isConnected&&e.name!=='AbortError'){if(e.code==='REVISION_CONFLICT'){this.notify('Les données ont changé. Actualise avant de recommencer ; rien n’a été écrasé.');}this.error(e);}}finally{if(b.isConnected){b.disabled=false;if(document.activeElement===document.body)b.focus({preventScroll:true});}}});return b;
  }
  title(text,existing=null){this.clearError();this.notify('');const h=existing??node('h1',text,{tabindex:'-1','data-navigation-focus':''});h.textContent=text;if(!existing)this.app.append(h);queueMicrotask(()=>{if(h.isConnected)h.focus({preventScroll:true});});document.title=`${text} · Voti`;const marker=document.getElementById('location');marker.hidden=false;marker.textContent=text;for(const a of document.querySelectorAll('.main-nav a'))a.removeAttribute('aria-current');}
  async call(command,input,credential,extras={}){if(!this.adapter)throw new Error('Relais non configuré. Les sondages libres locaux restent disponibles.');const epoch=this.epoch;
    if(isSpaceCredential(credential,'member')&&this.session.credential!==credential)throw new DOMException('La Carte Voti temporaire a expiré.','AbortError');
    const value=await this.adapter.spaceCommand({command,input,credential,...extras});
    const sameVote=command==='castMemberVote'&&this.session.credential===credential&&location.hash.startsWith(`#/p/${input.pollId}`);
    if(epoch!==this.epoch&&!sameVote)throw new DOMException('La page a changé. La réponse ne sera pas affichée.','AbortError');return value;}
  staff(spaceId){const access=this.accesses.get(this.config?.relayId,spaceId);if(!access)throw new Error('Importe un accès administrateur ou créateur pour cet Espace.');return access.credential;}
  async getSpace(id){return this.call('getSpace',{spaceId:id},this.staff(id));}
  beforeNavigate(hash){if(this.cardJob?.running&&hash!==this.cardJob.route){history.replaceState(history.state,'',this.cardJob.route);this.notify('Création des cartes en cours. Patiente encore un instant.');return Promise.resolve(false);}return guardEditNavigation(this,hash);}
  async refresh(){await this.handleRoute(location.hash);}
  async navigate(hash){if(location.hash===hash)await this.refresh();else location.hash=hash;}
  returnToSpace(id){const a=link('Retour à l’Espace',`#space/${id}`);a.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();this.navigate(a.hash).catch(this.error);});return a;}
  ownsRoute(hash){const [view,id]=hash.replace(/^#\/?/,'').split('/');return ['spaces','space','member','invite'].includes(view)||Boolean(this.session.credential)||view==='p'&&this.outcome?.pollId===id;}
  canKeepShell(hash){const [view,id,section]=hash.replace(/^#\/?/,'').split('/');return !this.session.credential&&view==='space'&&(!section||['polls','members','groups','invitations','access','settings'].includes(section))&&this.shell?.spaceId===id&&this.shell.root.isConnected;}
  leaveRoute(){this.app.classList.remove('space-poll-page');if(this.currentCard&&!this.currentCard.spaceId)eraseCard(this.currentCard);this.currentCard=null;this.activeEdit?.dispose();this.activeEdit=null;this.shell=null;document.body.removeAttribute('data-space-management');this.epoch++;this.disposePanel?.();this.disposePanel=null;this.clearMember();this.outcome=null;this.invitation=null;delete document.body.dataset.votiRole;}
  async handleRoute(hash){
    if(this.currentCard&&!this.currentCard.spaceId)eraseCard(this.currentCard);this.currentCard=null;
    this.activeEdit?.dispose();this.activeEdit=null;
    this.epoch++;
    document.body.toggleAttribute('data-space-management',/^#\/?space\//.test(hash)&&!this.session.credential);
    this.app.classList.toggle('space-poll-page',/^#\/?p\//.test(hash)||/^#\/?space\/[^/]+\/poll\//.test(hash));
    const parts=hash.replace(/^#\/?/,'').split('/'),[view,id,sub,pollId,last]=parts;
    if((['member','invite','spaces'].includes(view)&&parts.length>1)||(view==='space'&&(parts.length>5||(sub&&!['poll','polls','members','groups','invitations','access','settings'].includes(sub))||(last&&(sub!=='poll'||!['share','poster','results'].includes(last)))||(sub==='settings'&&pollId)))||(view==='p'&&sub&&!['choice','results'].includes(sub)))throw new Error('Lien Voti invalide.');
    if(view!=='invite')this.invitation=null;
    if(this.session.credential&&!['member','p'].includes(view)){this.clearMember();this.app.replaceChildren();this.title('Participation terminée');this.app.append(node('p','L’identité temporaire a été oubliée. Une Carte Voti ne donne aucun accès à l’administration.'),link('Accueil','#home'));return true;}
    if(!['spaces','space','member','invite'].includes(view)&&!(view==='p'&&this.session.credential)&&!(view==='p'&&this.outcome?.pollId===id)){
      this.disposePanel?.();this.disposePanel=null;if(view!=='p')this.clearMember();this.outcome=null;delete document.body.dataset.votiRole;return false;
    }
    const epoch=this.epoch;this.disposePanel?.();this.disposePanel=null;
    if(this.canKeepShell(hash)){this.shell.content.setAttribute('aria-busy','true');this.shell.content.replaceChildren(node('p','Chargement de cette section…',{role:'status',class:'help'}));}
    else{this.shell=null;this.app.replaceChildren();}
    if(view==='p'&&this.outcome?.pollId===id){this.success(id,this.outcome.commentSent);return true;}
    if(view==='p'){
      try{if(!this.profile)this.profile=await this.call('getMemberHome',{},this.session.credential);const response=await this.call('getMemberPoll',{pollId:id},this.session.credential);if(epoch!==this.epoch)return true;
        if(sub==='results')await this.showResults(response.poll,null);else this.participantPoll(response.poll,sub==='choice'?pollId:null,response.alreadyParticipated);return true;
      }catch(e){if(e.name==='AbortError')throw e;if(e.code==='NOT_FOUND'){this.clearMember();return false;}this.cardPrompt(id,sub==='results'?'results':null,sub==='choice'?pollId:null);this.error(e);return true;}
    }
    if(view==='spaces'){this.clearMember();delete document.body.dataset.votiRole;await this.listSpaces();}
    else if(view==='member'){if(!this.session.credential)this.cardPrompt();else{try{const profile=await this.call('getMemberHome',{},this.session.credential);if(epoch===this.epoch){this.profile=profile;this.memberHome();}}catch(e){if(e.name==='AbortError')throw e;this.cardPrompt();this.error(e);}}}
    else if(view==='invite'){this.clearMember();this.inviteForm();}
    else if(view==='space'){
      this.clearMember();delete document.body.dataset.votiRole;if(sub==='poll'&&pollId){const response=await this.call('getSpacePoll',{pollId},this.staff(id));if(epoch!==this.epoch)return true;
        if(last==='share')this.share(response.poll,id);else if(last==='poster')this.studio(response.poll,id);else if(last==='results')await this.showResults(response.poll,id);else await this.managePoll(response.poll,id);
      }else{const data=await this.getSpace(id);if(epoch===this.epoch)this.space(data,sub||'overview',pollId||null);}
    }
    return true;
  }
  cardPrompt(pollId=null,extra=null,choiceId=null){
    this.epoch++;
    this.clearMember();
    document.body.dataset.votiRole='member';
    this.outcome=null;
    this.app.replaceChildren();this.title('Présente ta Carte Voti');this.intent=pollId?{pollId,extra,choiceId}:null;
    this.app.append(append(node('div',undefined,{class:'card-prompt-intro'}),mascot({variant:'card-scan'}),node('p','Ta carte ouvre seulement ton espace participant. Elle ne sera pas conservée sur cet appareil.')),
      pollActions(this.button('Scanner ma Carte Voti',async b=>{const credential=await scanMemberCard(b);if(!credential||!b.isConnected)return;this.setMember(credential);
        try{const profile=await this.call('getMemberHome',{},credential);if(!b.isConnected||this.session.credential!==credential)return;this.profile=profile;
          if(pollId){const response=await this.call('getMemberPoll',{pollId},credential);if(!b.isConnected||this.session.credential!==credential)return;if(extra==='results')await this.showResults(response.poll,null);else this.participantPoll(response.poll,choiceId,response.alreadyParticipated);}
          else{history.replaceState(null,'',location.pathname+location.search+'#member');this.memberHome();}
        }catch(e){if(this.session.credential===credential)this.clearMember();throw e;}
      },'primary'),link('Accueil','#home')));
  }
  memberHome(){
    document.body.dataset.votiRole='member';
    this.app.replaceChildren();this.title('Mon espace');const p=this.profile;
    this.app.append(node('p',`${p.displayName} · ${p.space.name}`),node('p',p.groups.map(g=>g.name).join(' · ')),node('p','Une participation maximum par membre. Ta carte est secrète : garde-la pour toi.',{class:'help'}));
    const list=node('ul',undefined,{class:'poll-list'});for(const poll of p.polls){const status=poll.status==='closed'?'Fermé':poll.alreadyParticipated?'Déjà participé':'À toi de participer';
      const row=append(node('li'),node('h2',poll.question),node('p',status)),buttons=pollActions();if(!poll.alreadyParticipated&&poll.status==='published')buttons.append(link('Voter',`#/p/${poll.pollId}`));
      if(poll.resultsAvailable)buttons.append(link('Résultats disponibles',`#/p/${poll.pollId}/results`));if(buttons.children.length)row.append(buttons);list.append(row);}
    this.app.append(list,this.button('Terminer',()=>{this.clearMember();location.hash='#home';}));
  }
  participantPoll(poll,qrChoice=null,alreadyParticipated=false){
    document.body.dataset.votiRole='member';
    this.app.replaceChildren();this.title(poll.definition.question);const id=poll.remoteRef.pollId;
    const finish=this.button('Terminer',()=>{this.clearMember();location.hash='#home';});
    if(poll.status==='closed'){this.app.append(node('p','Ce sondage est fermé.'),pollActions(link('Résultats',`#/p/${id}/results`),finish));return;}
    if(alreadyParticipated){this.app.append(node('p','Déjà participé. Aucun nouveau vote ne peut être envoyé avec cette carte.'),pollActions(link('Résultats',`#/p/${id}/results`),this.button('Participant suivant',()=>this.cardPrompt(id),'primary'),finish));return;}
    if(qrChoice&&poll.definition.choices.some(c=>c.id===qrChoice)){this.confirmVote(poll,qrChoice,true);return;}
    this.recognizedMember();
    if(qrChoice)this.app.append(node('p','Le choix du QR n’est plus disponible. Choisis une réponse.'));
    const form=node('form'),choices=node('fieldset',undefined,{class:'vote-choices'});choices.append(node('legend','Choisis une réponse'));
    for(const choice of poll.definition.choices){const input=node('input',undefined,{type:'radio',name:'space-choice',value:choice.id,required:''});choices.append(append(node('label',undefined,{class:'vote-choice'}),input,node('span',choice.label)));}
    const next=node('button','Continuer',{type:'submit',class:'primary'});form.append(choices,pollActions(next));form.addEventListener('submit',e=>{e.preventDefault();this.confirmVote(poll,form.querySelector('input:checked').value,false);});this.app.append(form);
  }
  confirmVote(poll,choiceId,fromQr){
    this.app.replaceChildren();this.title('Tu choisis : '+poll.definition.choices.find(c=>c.id===choiceId).label);
    this.recognizedMember();
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
    this.app.replaceChildren();this.title('Merci !');this.app.append(append(node('div',undefined,{class:'vote-success-intro'}),mascot({variant:'success'}),node('p','Ton vote a bien été enregistré.')),...(commentSent?[node('p','Ton commentaire a aussi été envoyé.')]:[]),node('p','Ta carte et ton identité ont été oubliées sur cet appareil.'),
      pollActions(this.button('Participant suivant',()=>{this.outcome=null;this.cardPrompt(pollId);},'primary'),link('Accueil','#home')));
  }
  recognizedMember(){if(this.profile&&this.session.credential)this.app.append(node('p',`Carte reconnue : ${this.profile.displayName}`,{class:'recognized-member',role:'status'}));}
  async listSpaces(){
    const epoch=this.epoch;
    this.title('Espaces & groupes');this.app.append(node('p','Un Espace réunit des groupes et des membres. Aucun compte e-mail ou mot de passe n’est nécessaire.'),link('Mes sondages libres','#home'));
    if(!this.config){this.app.append(node('p','Un relais Internet configuré est nécessaire pour les Espaces. Le mode libre local reste disponible.'));return;}
    const library=node('section',undefined,{'data-space-library':'',class:'space-library'});library.append(node('h2','Mes Espaces'));const list=node('div',undefined,{class:'space-library-list'});library.append(list);this.app.append(library);
    for(const access of this.accesses.list().filter(a=>a.relayId===this.config.relayId)){
      if(epoch!==this.epoch)return;
      const name=node('h3','Espace enregistré'),role=node('p','Lecture de cet accès…',{class:'help'}),more=append(node('details',undefined,{class:'space-access-more'}),node('summary','Plus d’actions'));
      more.append(this.button('Retirer cet accès de cet appareil',async b=>{if(await this.confirmAction({trigger:b,title:'Oublier cet accès de gestion ?',description:'L’Espace reste en ligne. Exporte ton accès avant s’il n’est conservé nulle part ailleurs.',actionLabel:'Oublier cet accès',danger:true})){clearCards(this,access.spaceId);await this.accesses.delete(access.relayId,access.spaceId);await this.refresh();}}));
      const open=withSpaceIcon(link('Ouvrir',`#space/${access.spaceId}`),'overview');open.classList.add('primary');const row=append(node('article',undefined,{class:'space-library-row'}),append(node('div'),name,role),open,more);list.append(row);
      try{const data=await this.getSpace(access.spaceId);if(row.isConnected){name.textContent=data.name;role.textContent=data.access.role==='admin'?'Administrateur de l’Espace':'Créateur de l’Espace';open.setAttribute('aria-label','Ouvrir '+data.name);}}catch{if(row.isConnected)role.textContent='Accès indisponible.';}
    }
    if(!list.children.length)list.append(node('p','Tes Espaces apparaîtront ici après création ou import.',{class:'help'}));
    if(epoch!==this.epoch)return;
    const name=textField('Nom de l’Espace'),form=node('form',undefined,{class:'card'}),create=node('button','Créer un Espace',{type:'submit',class:'primary'});name.input.required=true;form.append(name.element,create);
    form.addEventListener('submit',async e=>{e.preventDefault();if(create.disabled)return;create.disabled=true;const spaceId=crypto.randomUUID(),credential=createSpaceCredential('staff'),challenge=node('div');form.append(challenge);
      try{const token=await humanVerification(this.config,challenge);if(!create.isConnected)return;await this.accesses.put({relayId:this.config.relayId,spaceId,credential});await this.call('createSpace',{spaceId,name:name.input.value,expectedRevision:0},credential,{humanVerificationToken:token});location.hash=`#space/${spaceId}`;}
      catch(error){this.error(error);}finally{challenge.remove();if(create.isConnected)create.disabled=false;}});const add=append(node('details',undefined,{class:'space-create-entry'}),node('summary','Créer un Espace'),form);this.app.append(add,this.importAccess());
  }
  importAccess(){
    const input=node('input',undefined,{type:'file',accept:'application/json,.json'}),box=append(node('section',undefined,{class:'space-import'}),node('h2','Importer un accès SECRET à un Espace'),filePicker(input,'Fichier d’accès de gestion'));
    input.addEventListener('change',async()=>{try{const file=input.files[0];if(!file||file.size>4096)throw new Error('Fichier d’accès invalide.');const value=decodeSpaceAccess(await file.text(),this.config.relayId);
      await this.call('getSpace',{spaceId:value.spaceId},value.credential);const previous=this.accesses.get(value.relayId,value.spaceId);
      if(previous&&previous.credential!==value.credential&&!await this.confirmAction({trigger:input,title:'Remplacer l’accès à cet Espace ?',description:'Le nouvel accès a été vérifié. Il remplacera la capacité de gestion conservée sur cet appareil.',actionLabel:'Remplacer l’accès'}))return;
      await this.accesses.put({relayId:value.relayId,spaceId:value.spaceId,credential:value.credential},previous?.credential);location.hash=`#space/${value.spaceId}`;
    }catch(error){this.error(error);}finally{input.value='';refreshFilePicker(input);}});return box;
  }
  async adminMutation(data,command,fields){await this.call(command,{spaceId:data.spaceId,...fields,expectedRevision:data.revision},this.staff(data.spaceId));if(['revokeMemberCard','revokeMember'].includes(command))forgetCard(this,data.spaceId,fields.memberId);await this.refresh();}
  groupSelection(groups,selected=[]){const box=node('fieldset',undefined,{class:'space-group-options'});box.append(node('legend','Groupes'));for(const g of groups.filter(g=>g.status==='active')){const input=node('input',undefined,{type:'checkbox',value:g.group_id});input.checked=selected.includes(g.group_id);box.append(append(node('label'),input,node('span',g.name)));}return{element:box,values:()=>[...box.querySelectorAll('input:checked')].map(i=>i.value)};}
  space(data,section,entity){renderSpaceManagement(this,data,section,entity);}
  spaceDetails(data,section,entity,container){
    const id=data.spaceId,admin=data.access.role==='admin'&&data.status==='active',credential=this.staff(id);
    if(section==='settings'&&admin){const name=textField('Nom de l’Espace',data.name);container.append(name.element,this.button('Renommer l’Espace',()=>this.adminMutation(data,'renameSpace',{name:name.input.value})),this.button('Archiver l’Espace',async b=>{if(await this.confirmAction({trigger:b,title:'Archiver cet Espace ?',description:'Les accès et cartes seront désactivés. Les sondages et historiques sont conservés. Cette version ne propose pas de réactivation.',actionLabel:'Archiver l’Espace',danger:true})){await this.call('archiveSpace',{spaceId:id,expectedRevision:data.revision},credential);clearCards(this,id);location.hash='#spaces';}}));}
    if(section==='settings'){
    const scopeNames=(data.access.groupIds??[]).map(groupId=>data.groups.find(g=>g.group_id===groupId)?.name??'groupe');
    container.append(this.button('Exporter mon accès SECRET',()=>downloadBlob(new Blob([JSON.stringify({version:1,relayId:this.config.relayId,spaceId:id,credential})],{type:'application/json'}),accessFilename(data.name,data.access.role,scopeNames))),node('p','Cet accès permet de gérer l’Espace selon son rôle. Ne le partage pas publiquement.',{class:'help'}));
    }
    if(section==='groups'){
    const groups=append(node('section',undefined,{class:'space-detail'}),node('h2','Groupes')),groupGrid=node('div',undefined,{class:'space-detail-items'});groups.append(groupGrid);
    for(const g of data.groups){const row=append(node('article',undefined,{class:'space-group-detail'}),node('h3',g.name),node('p',g.status==='active'?'Groupe actif':'Groupe archivé',{class:'help'}));groupGrid.append(row);if(!admin||g.status!=='active'){const visual=resolveVisual('group',g.visual_id);if(visual)row.append(visualImage(visual,'large','visual-detail-image'));}if(admin&&g.status==='active'){const name=textField('Nom du groupe',g.name),illustration=visualField('group',g.visual_id??null,()=>editor?.update());let editor;row.append(illustration.element,name.element,append(node('div',undefined,{class:'actions'}),this.button('Archiver le groupe',async b=>{if(await this.confirmAction({trigger:b,title:'Archiver ce groupe ?',description:'Les membres et sondages historiques seront conservés. Un groupe avec des sondages actifs ne peut pas être archivé.',actionLabel:'Archiver'}))await this.adminMutation(data,'archiveGroup',{groupId:g.group_id});})));editor=editActions(this,row,{label:'Enregistrer le groupe',read:()=>({name:name.input.value,visualId:illustration.value()}),restore:v=>{name.input.value=v.name;illustration.setValue(v.visualId);},save:()=>this.adminMutation(data,'renameGroup',{groupId:g.group_id,name:name.input.value,visualId:illustration.value()})});}}
    if(admin&&entity==='new'){const name=textField('Nom du nouveau groupe'),illustration=visualField('group');groups.append(append(node('div',undefined,{class:'space-detail-create'}),node('h3','Ajouter un groupe'),name.element,illustration.element,this.button('Créer le groupe',async()=>{await this.call('createGroup',{spaceId:id,expectedRevision:data.revision,groupId:crypto.randomUUID(),name:name.input.value,visualId:illustration.value()},credential);location.hash=`#space/${id}/groups`;},'primary')));}container.append(groups);}

    if(admin&&section==='members'){
      const members=append(node('section',undefined,{class:'space-detail'}),node('h2',entity==='new'?'Ajouter un membre':'Informations')),memberGrid=node('div',undefined,{class:'space-detail-items'});members.append(memberGrid);
      for(const m of data.members){const row=node('article',undefined,{class:'member-row space-member-detail'}),name=textField('Nom ou pseudonyme',m.display_name),selection=this.groupSelection(data.groups,m.groupIds),illustration=visualField('member',m.visual_id??null,()=>editor?.update());let editor;
        const revoke=this.button(m.has_card?'Révoquer la carte':'Carte déjà révoquée',async b=>{if(await this.confirmAction({trigger:b,title:'Révoquer cette carte ?',description:'Le membre et ses anciens votes restent conservés. Une nouvelle carte pourra être générée.',actionLabel:'Révoquer la carte',danger:true})){await this.adminMutation(data,'revokeMemberCard',{memberId:m.member_id});this.notify('Carte révoquée. Elle ne permet plus de participer. Tu peux en régénérer une.');}},'danger');revoke.disabled=!m.has_card;
        row.append(node('h3','Carte Voti'),node('p',m.status==='active'?(m.has_card?'Carte active':'Carte révoquée · régénération possible'):'Membre révoqué',{class:'space-card-state'}));if(m.status==='active')row.append(illustration.element,name.element,selection.element,append(node('div',undefined,{class:'actions'}),
          this.button('Régénérer la carte',async b=>{if(!await this.confirmAction({trigger:b,title:'Régénérer cette Carte Voti ?',description:'L’ancienne carte ne fonctionnera plus. Les votes passés restent conservés, sans permettre de retrouver un bulletin anonyme.',actionLabel:'Régénérer'}))return;const card=createSpaceCredential('member');await this.call('rotateMemberCard',{spaceId:id,memberId:m.member_id,memberCredential:card,expectedRevision:data.revision},credential);this.showCard({spaceId:id,credential:card,memberId:m.member_id,displayName:m.display_name,memberVisualId:m.visual_id??null,spaceName:data.name,groups:data.groups.filter(g=>m.groupIds.includes(g.group_id)).map(g=>({name:g.name,visualId:g.visual_id??null})),returnHash:`#space/${id}/members`});}),
          revoke,
          this.button('Révoquer le membre',async b=>{if(await this.confirmAction({trigger:b,title:'Révoquer ce membre ?',description:'La carte sera invalidée. Les anciens votes et le snapshot des sondages seront conservés.',actionLabel:'Révoquer',danger:true}))await this.adminMutation(data,'revokeMember',{memberId:m.member_id});},'danger')));
        if(m.status==='active'){editor=editActions(this,row,{label:'Enregistrer le membre',read:()=>({name:name.input.value,visualId:illustration.value(),groups:selection.values().sort()}),restore:v=>{name.input.value=v.name;for(const input of selection.element.querySelectorAll('input'))input.checked=v.groups.includes(input.value);illustration.setValue(v.visualId);},save:()=>this.adminMutation(data,'updateMember',{memberId:m.member_id,displayName:name.input.value,groupIds:selection.values(),visualId:illustration.value()})});}

        if(m.status!=='active'){const visual=resolveVisual('member',m.visual_id);if(visual)row.append(visualImage(visual,'large','visual-detail-image'));}memberGrid.append(row);
      }
      if(entity==='new'){const name=textField('Nom ou pseudonyme du nouveau membre'),selection=this.groupSelection(data.groups),illustration=visualField('member');members.append(append(node('div',undefined,{class:'space-detail-create'}),node('h3','Ajouter un membre'),name.element,illustration.element,selection.element,node('p','Coche ses groupes, puis crée le membre et sa carte.',{class:'help'}),
        this.button('Créer le membre et sa carte',async()=>{const card=createSpaceCredential('member'),memberId=crypto.randomUUID();await this.call('createMember',{spaceId:id,memberId,displayName:name.input.value,groupIds:selection.values(),memberCredential:card,visualId:illustration.value(),expectedRevision:data.revision},credential);this.showCard({spaceId:id,credential:card,memberId,displayName:name.input.value,memberVisualId:illustration.value(),spaceName:data.name,groups:data.groups.filter(g=>selection.values().includes(g.group_id)).map(g=>({name:g.name,visualId:g.visual_id??null})),returnHash:`#space/${id}/members`});},'primary')));}
      container.append(members);}
    if(admin&&section==='invitations'){

      const invite=append(node('section',undefined,{class:'space-detail'}),node('h2',entity==='new'?'Nouvelle invitation':'Invitation')),inviteGroups=this.groupSelection(data.groups),limit=node('input',undefined,{type:'number',min:1,max:200,value:1}),days=node('input',undefined,{type:'number',min:1,max:30,value:7});
      const inviteRecap=node('p',undefined,{class:'space-recap',role:'status'}),recapInvitation=()=>{const ids=inviteGroups.values();return `${ids.length?'Groupes : '+data.groups.filter(g=>ids.includes(g.group_id)).map(g=>g.name).join(', '):'Aucun groupe sélectionné : les nouveaux membres seront dans l’Espace uniquement.'} Maximum ${limit.value} utilisation(s), expiration dans ${days.value} jour(s).`;};
      const updateInvite=()=>inviteRecap.textContent=recapInvitation();invite.addEventListener('input',updateInvite);invite.addEventListener('change',updateInvite);updateInvite();
      if(entity==='new')invite.append(inviteGroups.element,field('Nombre maximum d’utilisations (1 = invitation individuelle)',limit),field('Expiration en jours',days),inviteRecap,this.button('Créer une invitation',async b=>{if(!limit.reportValidity()||!days.reportValidity())return;const groupIds=inviteGroups.values(),maxUses=Number(limit.value),expiresInDays=Number(days.value);if(!await this.confirmAction({trigger:b,title:'Créer cette invitation ?',description:recapInvitation(),actionLabel:'Créer l’invitation'}))return;const token=createSpaceCredential('invitation');await this.call('createInvitation',{spaceId:id,invitationId:crypto.randomUUID(),groupIds,maxUses,expiresInDays,invitationCredential:token,expectedRevision:data.revision},credential);this.app.replaceChildren();this.title('Invitation secrète');const url=new URL(location.pathname,location.origin);url.hash='/invite/'+token;this.app.append(node('p','Invitation créée. '+inviteRecap.textContent,{class:'space-recap'}),this.qrImage(url.href,'Invitation Voti secrète'),node('p','Seules les personnes invitées doivent recevoir ce QR. Copie le lien ou télécharge le QR maintenant : il ne pourra plus être réaffiché après avoir quitté cet écran.',{class:'secret-warning'}),this.button('Copier le lien SECRET',async()=>{await navigator.clipboard.writeText(url.href);this.notify('Lien secret copié. Partage-le seulement avec les personnes invitées.');}),this.button('Télécharger le QR SECRET (SVG)',()=>downloadBlob(new Blob([renderQrSvg(createQrMatrix(url.href))],{type:'image/svg+xml'}),`voti-invitation-${fileLabel(data.name)}-secret.svg`)),this.returnToSpace(id));}));
      for(const i of data.invitations)invite.append(node('p',`${i.uses} / ${i.max_uses} utilisations · ${i.closed?'Fermée':'Active jusqu’au '+new Date(i.expires_at*1000).toLocaleDateString('fr-FR')}`),this.button('Fermer l’invitation',()=>this.adminMutation(data,'closeInvitation',{invitationId:i.invitation_id})));container.append(invite);}
    if(admin&&section==='access'){

      const staffBox=append(node('section',undefined,{class:'space-detail'}),node('h2',entity==='new'?'Créer un accès':'Accès de gestion')),role=selectField('Rôle',[['creator','Créateur'],['admin','Administrateur']]),scope=this.groupSelection(data.groups);
      if(entity==='new'){staffBox.append(node('p','Pour permettre à une autre personne de créer des sondages, choisis Créateur et transmets-lui le fichier SECRET. Elle l’importe dans Espaces & groupes. Réserve ce fichier aux personnes autorisées.'));
      staffBox.append(role.element,scope.element,node('p','Créateur : aucun groupe coché = tout l’Espace. Une carte participant ne donne jamais ces droits.'),this.button('Créer un accès de gestion SECRET',async()=>{const token=createSpaceCredential('staff'),scopes=scope.values();await this.call('createAccess',{spaceId:id,accessId:crypto.randomUUID(),role:role.input.value,groupIds:role.input.value==='admin'||!scopes.length?null:scopes,staffCredential:token,expectedRevision:data.revision},credential);downloadBlob(new Blob([JSON.stringify({version:1,relayId:this.config.relayId,spaceId:id,credential:token})],{type:'application/json'}),accessFilename(data.name,role.input.value,role.input.value==='creator'?data.groups.filter(g=>scopes.includes(g.group_id)).map(g=>g.name):[]));location.hash=`#space/${id}/access`;}));}
      container.append(staffBox);
      for(const access of data.staffAccesses){staffBox.append(node('p',access.group_scopes?JSON.parse(access.group_scopes).map(g=>data.groups.find(x=>x.group_id===g)?.name??'Groupe archivé').join(' · '):'Tout l’Espace'));staffBox.append(node('p',`${access.role==='admin'?'Administrateur':'Créateur'} · ${access.status==='active'?'Actif':'Révoqué'}`),this.button('Révoquer cet accès',async b=>{if(await this.confirmAction({trigger:b,title:'Révoquer cet accès de gestion ?',description:'Il ne pourra plus gérer l’Espace. Le dernier accès administrateur ne peut pas être révoqué.',actionLabel:'Révoquer cet accès',danger:true}))await this.adminMutation(data,'revokeAccess',{accessId:access.access_id});},'danger'));}

    }
    const dangers=[...container.querySelectorAll('button')].filter(b=>b.classList.contains('danger')||b.textContent.startsWith('Archiver '));
    if(dangers.length){const zone=append(node('details',undefined,{class:'space-danger-zone'}),node('summary','Actions à utiliser avec précaution'));for(const button of dangers){button.classList.add('danger');zone.append(button);}container.append(zone);}
  }
  qrImage(url,alt){return node('img',undefined,{class:'member-card-qr',alt,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(renderQrSvg(createQrMatrix(url)))});}
  showCard(card){
    this.activeEdit?.dispose();this.activeEdit=null;
    this.clearMember();this.app.replaceChildren();this.title('Carte Voti créée');if(card.spaceId&&card.memberId){rememberCard(this,card);this.cardBatchResult=null;}this.currentCard=card;const batch=card.spaceId?availableCards(this,card.spaceId):[];
    card.cardTheme??=normalizeTheme(document.documentElement.dataset.theme);const page=node('section',undefined,{class:'member-card-page'}),preview=node('div',undefined,{class:'member-card-preview'}),themes=node('div',undefined,{class:'card-theme-picker',role:'group','aria-label':'Thème de cette carte'});
    const update=()=>{preview.replaceChildren(memberCardPreview(memberCardModel(card),location.origin+location.pathname));for(const b of themes.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.cardTheme===card.cardTheme));};
    for(const theme of THEME_OPTIONS){const b=this.button(theme.name,()=>{card.cardTheme=theme.id;update();});b.dataset.cardTheme=theme.id;themes.append(b);}page.append(node('h2','Thème de cette carte'),themes,preview);
    const selectedCatalog={member:[resolveVisual('member',card.memberVisualId)].filter(Boolean),group:(card.groups??[]).map((g,i)=>resolveVisual('group',card.groupVisualIds?.[i]??g.visualId)).filter(Boolean)};const options=visualDisplayOptions({catalog:selectedCatalog,value:card.visualDisplayOptions,onChange:value=>{card.visualDisplayOptions=value;update();}});update();this.app.append(page);
    const tools=node('div',undefined,{class:'member-card-tools'});page.append(tools);if(options)tools.append(options);tools.append(backdropToggle(card.groupBackdropEnabled,value=>{card.groupBackdropEnabled=value;update();}));tools.append(node('p','Garde cette carte pour toi. Télécharge-la pour la conserver après le rechargement de cet onglet.',{class:'help'}),
      this.button('Télécharger cette carte (PDF SECRET)',async()=>{const credential=card.credential,pdf=await memberCardsPdf([card],location.origin+location.pathname);if(card.credential===credential)downloadBlob(pdf,cardsFilename(card.spaceName,card.displayName));}),
      ...(batch.length?[node('p',`Cartes disponibles dans cette session : ${batch.length} carte(s) — ${batch.map(c=>c.displayName).join(', ')}.`,{class:'space-recap'}),
      this.button(`Télécharger le lot de ${batch.length} carte(s) A4 (SECRET)`,async()=>{const version=this.cardsVersion,pdf=await memberCardsPdf(batch.map(c=>({...c,cardTheme:card.cardTheme,groupBackdropEnabled:card.groupBackdropEnabled!==false})),location.origin+location.pathname);if(version===this.cardsVersion)downloadBlob(pdf,cardsFilename(card.spaceName,null,batch.length));}),
      node('p','Le thème et le fond choisis s’appliquent aussi au PDF du lot. Retrouve ce lot dans Membres, sans créer de nouvelle carte. Il reste disponible jusqu’au rechargement ou à la fermeture de cet onglet.',{class:'help'})]:[]),
      location.hash==='#invite'?this.button('Ouvrir Mon espace',()=>{this.setMember(card.credential);location.hash='#member';}):this.button('Retour à l’Espace',()=>card.returnHash?this.navigate(card.returnHash):this.refresh()));
  }
  inviteForm(){
    document.body.dataset.votiRole='member';
    this.title('Invitation Voti');if(!this.invitation){this.app.append(node('p','Scanne de nouveau ton invitation. Aucun secret n’a été conservé.'));return;}
    const name=textField('Ton nom ou pseudonyme');let registration=null,accepted=false;
    this.app.append(name.element,this.button('Créer ma Carte Voti',async()=>{if(!registration){registration={memberId:crypto.randomUUID(),displayName:memberName(name.input.value),memberCredential:createSpaceCredential('member')};name.input.disabled=true;}
      if(!accepted){await this.call('acceptInvitation',registration,this.invitation);accepted=true;}this.setMember(registration.memberCredential);const profile=await this.call('getMemberHome',{},registration.memberCredential);this.invitation=null;this.showCard({credential:registration.memberCredential,displayName:profile.displayName,memberVisualId:profile.visualId??null,spaceName:profile.space.name,groups:profile.groups.map(g=>({name:g.name,visualId:g.visual_id??null}))});registration=null;this.notify('Invitation acceptée. Télécharge ta carte pour la garder.');}));
  }
  newPoll(data,box){
    box.append(spacePollEditor(data,{readAudienceSize:async ids=>(await this.call('getAudienceSize',{spaceId:data.spaceId,pollAudience:{spaceId:data.spaceId,mode:ids.length?'groups':'space',groupIds:ids,resultsAudience:'poll_audience'}},this.staff(data.spaceId))).eligible,button:(...args)=>this.button(...args),groupSelection:(...args)=>this.groupSelection(...args),submit:async(values,metadata)=>{const {poll,pollAudience}=makeSpacePollDraft(values,data.spaceId);const prep=await this.call('prepareSpacePublication',{spaceId:data.spaceId,poll,pollAudience,expectedRevision:data.revision},this.staff(data.spaceId));(this.pollMinimumModes??=new Map()).set(prep.pollId,metadata?.automaticMinimum===true);location.hash=`#space/${data.spaceId}/poll/${prep.pollId}`;}}));
  }
  async managePoll(poll,spaceId){
    const id=poll.remoteRef.pollId,credential=this.staff(spaceId);let panelElement;
    const onChange=value=>{this.disposePanel?.();this.disposePanel=null;panelElement?.remove();if(value.status==='draft')return;
    const panel=commentsAdministration(value,{load:cursor=>this.adapter.getParticipations({pollId:id,adminCapability:credential,cursor}),mutate:async(_node,c,action)=>{const current=(await this.call('getSpacePoll',{pollId:id},credential)).poll;await this.adapter[action==='delete'?'deleteComment':'updateCommentStatus']({pollId:id,adminCapability:credential,expectedRevision:current.remoteRef.revision,commentId:c.commentId,expectedCommentRevision:c.revision,...(action==='delete'?{}:{moderationStatus:action})});},error:this.error});panelElement=panel.element;this.app.append(panel.element);this.disposePanel=panel.dispose;
    };
    await renderSpacePoll(this,poll,spaceId,{onChange});
  }
  share(poll,spaceId){if(poll.status==='draft')throw new Error('Publie d’abord ce sondage pour créer ses QR.');this.title('Partager le sondage');const id=poll.remoteRef.pollId;const panel=sharingPanel(poll,{baseUrl:location.origin+location.pathname,error:this.error,notify:this.notify,openStudio:()=>location.hash=`#space/${spaceId}/poll/${id}/poster`});this.app.append(panel,link('Gérer',`#space/${spaceId}/poll/${id}`));}
  studio(poll,spaceId){if(poll.status==='draft')throw new Error('Publie d’abord ce sondage pour créer son affiche.');this.title('Studio d’affiche');this.app.append(link('← Gérer le sondage',`#space/${spaceId}/poll/${poll.remoteRef.pollId}`));const panel=posterStudio(poll,{repository:this.posters,pollAssets:this.assets,error:this.error,notify:this.notify,refreshPoll:async()=>(await this.call('getSpacePoll',{pollId:poll.remoteRef.pollId},this.staff(spaceId))).poll});this.app.append(panel.element);this.disposePanel=panel.dispose;}
  async showResults(poll,spaceId){
    this.app.replaceChildren();this.title('Les résultats');const result=poll.results,id=poll.remoteRef.pollId;if(spaceId)this.app.append(link('← Gérer le sondage',`#space/${spaceId}/poll/${id}`));
    if(!spaceId)this.app.append(pollActions(this.button('Terminer',()=>{this.clearMember();location.hash='#home';})));
    if(!result.available||!spaceId&&poll.accessRules.pollAudience.resultsAudience==='admins_only'){const attendance=spaceId?await this.call('getPollAttendance',{pollId:id},this.staff(spaceId)):null,state=resultsState(poll,{admin:Boolean(spaceId),attendance});this.app.append(append(node('section',undefined,{class:'space-results-state','data-result-state':state.code}),node('h2',state.title),node('p',state.detail)));return;}
    this.app.append(node('h2',poll.definition.question),node('p',`${result.totalBallots} réponses`));
    for(const c of result.choices){const section=append(node('section',undefined,{class:'result-row'}),node('h3',c.label),node('p',`${c.count} · ${c.percentage.toFixed(1)} %`));for(const comment of result.comments?.items?.filter(m=>m.choiceId===c.id)||[])section.append(node('p',comment.text));this.app.append(section);}
    const credential=spaceId?this.staff(spaceId):this.session.credential;
    const fresh=async()=>{const next=(await this.call(spaceId?'getSpacePoll':'getMemberPoll',{pollId:id},credential)).poll;return{poll:next,results:next.results};};
    this.app.append(resultsPdfPanel({...poll,id},result,{repository:this.posters,pollAssets:this.assets,refreshPoll:fresh,error:this.error,notify:this.notify,admin:Boolean(spaceId),
      loadComments:async()=>{const items=[];let cursor=null;do{const response=await this.call(spaceId?'getSpaceComments':'getMemberComments',{pollId:id,cursor},credential);items.push(...response.page.items);cursor=response.page.nextCursor;if(items.length>500)throw new Error('Maximum 500 commentaires pour ce PDF.');}while(cursor);return items;},
      loadIdentities:async()=>{const entries=[];let cursor=null;do{const page=await this.adapter.getParticipations({pollId:id,adminCapability:credential,cursor});entries.push(...page.entries);cursor=page.nextCursor;if(entries.length>500)throw new Error('Maximum 500 participations pour ce PDF.');}while(cursor);return entries;}}));
  }
}
