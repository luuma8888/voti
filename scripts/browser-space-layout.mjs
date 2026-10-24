/** Fixtures fictives et assertions de structure v0.6.2, exclusivement Worker/D1 local. */
export async function spaceLayoutSetup(){
  const {HttpRelayAdapter}=await import('voti/web/http-relay.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js'),{SpaceAccessStorage}=await import('voti/web/space-storage.js');
  if(!RELAY_CONFIG.baseUrl.startsWith('http://127.0.0.1:'))throw new Error('Fixtures réservées au relais local.');
  const {createSpaceCredential}=await import('voti/shared/spaces.js'),{createPoll}=await import('voti/shared/poll-engine.js'),{emptyState}=await import('voti/shared/model.js');
  const adapter=new HttpRelayAdapter(RELAY_CONFIG),staff=createSpaceCredential('staff'),spaceId=crypto.randomUUID();
  const call=(command,input,credential=staff)=>adapter.spaceCommand({command,input,credential,...(command==='createSpace'?{humanVerificationToken:`voti-local-test.${Date.now()}.${crypto.randomUUID()}`}:{})});
  await call('createSpace',{spaceId,name:'La Cabane Voti',expectedRevision:0});
  const rev=async()=>(await call('getSpace',{spaceId})).revision,groups=[];
  for(const name of ['Groupe Soleil','Groupe Lune']){const groupId=crypto.randomUUID();await call('createGroup',{spaceId,groupId,name,expectedRevision:await rev()});groups.push(groupId);}
  for(const [index,displayName] of ['Soleil A','Soleil B','Soleil C','Lune A','Lune B'].entries())await call('createMember',{spaceId,memberId:crypto.randomUUID(),displayName,groupIds:[groups[index<3?0:1]],memberCredential:createSpaceCredential('member'),expectedRevision:await rev()});
  const polls=[];for(const [index,question]of ['Quel goûter pour notre sortie ?','Notre prochaine activité','Une idée pour le jardin ?'].entries()){
    const poll=createPoll(emptyState(),{question,choices:['Fruits','Gâteau','Pain et chocolat'],resultRules:{minimumResponses:2}}).polls[0];
    await call('prepareSpacePublication',{spaceId,poll,pollAudience:{spaceId,mode:'groups',groupIds:[groups[index===1?1:0]],resultsAudience:'poll_audience'},expectedRevision:await rev()});if(index<2){await call('publishSpacePoll',{pollId:poll.id,expectedRevision:0});if(index===1){const p=(await call('getSpacePoll',{pollId:poll.id})).poll;await adapter.closePoll({pollId:poll.id,adminCapability:staff,expectedRevision:p.remoteRef.revision});}}polls.push(poll.id);
  }
  for(let index=0;index<2;index++){const invitationId=crypto.randomUUID();await call('createInvitation',{spaceId,invitationId,groupIds:[groups[index]],maxUses:5,expiresInDays:7,invitationCredential:createSpaceCredential('invitation'),expectedRevision:await rev()});if(index)await call('closeInvitation',{spaceId,invitationId,expectedRevision:await rev()});}
  await call('createAccess',{spaceId,accessId:crypto.randomUUID(),role:'creator',groupIds:null,staffCredential:createSpaceCredential('staff'),expectedRevision:await rev()});
  const creator=createSpaceCredential('staff');await call('createAccess',{spaceId,accessId:crypto.randomUUID(),role:'creator',groupIds:[groups[0]],staffCredential:creator,expectedRevision:await rev()});
  await new SpaceAccessStorage(localStorage).put({relayId:RELAY_CONFIG.relayId,spaceId,credential:staff});
  const data=await call('getSpace',{spaceId});window.__layoutKeepAlive=true;
  // Aucun secret sauvegardé : fixture/credentials seulement dans la mémoire du test.
  return{spaceId,staff,creator,memberId:data.members[0].member_id,groups,polls};
}

export async function spaceLayoutCheck(view){
  const app=document.getElementById('app');let checks=0;const ok=(x,why)=>{if(!x)throw new Error('Structure v0.6.2 : '+why);checks++;};
  ok(window.__layoutKeepAlive,'navigation sans rechargement');
  ok(app.querySelectorAll('[data-space-section]').length===1,'une seule section principale');
  ok(document.documentElement.scrollWidth<=innerWidth,'aucun débordement horizontal');
  for(const a of app.querySelectorAll('.space-navigation .button,.space-section-heading .button,.space-list-row > .button'))if(a.getClientRects().length)ok(a.getBoundingClientRect().height>=44,'cible tactile de navigation');
  if(['members','groups','polls','invitations','access','overview'].includes(view)){
    ok(!app.querySelector('input,textarea,select'),'aucun formulaire permanent dans la liste');
    ok(!app.querySelector('.danger'),'le danger ne domine pas la liste');
    ok(!app.querySelector('.space-poll-form'),'création sondage à la demande');
  }
  if(view==='members'){
    const rows=[...app.querySelectorAll('.space-list-row')];ok(rows.length===5,'cinq membres affichés');
    ok(!app.querySelector('input[type=checkbox]'),'pas de groupes éditables avant ouverture');
    ok(rows.filter(r=>r.getBoundingClientRect().bottom<innerHeight).length>=(innerWidth>1000?5:2),'plusieurs membres visibles dans le viewport');
    ok(!rows.some(r=>r.textContent.includes('Révoquer')),'aucune révocation dans les lignes');
    const last=rows.at(-1).querySelector('a');last.scrollIntoView({block:'center',behavior:'instant'});const nav=document.querySelector('.main-nav'),bottom=innerWidth<500&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().top:innerHeight;
    ok(last.getBoundingClientRect().bottom<=bottom&&last.getBoundingClientRect().top>=0,'dernier membre accessible sans être caché par la navigation');window.scrollTo({top:0,behavior:'instant'});
  }
  if(view==='member-detail'){
    ok(Boolean(app.querySelector('.member-row input[type=text]')),'édition disponible dans la fiche');
    ok(Boolean(app.querySelector('.space-danger-zone:not([open])')),'danger replié dans la fiche');
    ok([...app.querySelectorAll('input[type=checkbox]')].every(i=>i.closest('label')?.textContent.trim()),'cases et labels associés');
  }
  if(view.startsWith('guided-'))ok(app.querySelectorAll('.space-form-step:not([hidden])').length===1,'une décision guidée visible');
  if(view==='creation-choice')ok(app.querySelectorAll('.space-form-step:not([hidden])').length===0,'aucun réglage avant le choix de parcours');
  if(view==='express')ok(app.querySelectorAll('.space-form-step:not([hidden])').length===3,'Express : les trois sections essentielles seulement');
  if(view==='advanced')ok(app.querySelectorAll('.space-form-step[hidden]').length===0,'Avancé : mêmes champs tous accessibles');
  ok(getComputedStyle(document.querySelector('.main-nav')).display==='none','navigation générale sans concurrence');
  ok(!document.querySelector('#location').getClientRects().length,'pas de breadcrumb redondant');
  ok(document.querySelector('.space-global-return').getClientRects().length,'accueil général accessible');
  if(view==='member-detail')ok(app.querySelector('h1').textContent===app.querySelector('.member-row input').value,'le membre est le titre principal');
  for(const svg of app.querySelectorAll('svg.space-icon'))ok(svg.getAttribute('aria-hidden')==='true'&&Boolean(svg.parentElement.textContent.trim()),'icône décorative avec texte visible');
  return checks;
}

/** État réellement rendu pour la revue finale ; aucune maquette ni donnée distante. */
export async function spaceCreationView(view){
  if(!['creation-choice','express','advanced'].includes(view)&&!view.startsWith('guided-'))return;
  const root=document.querySelector('.space-poll-form'),button=label=>[...root.querySelectorAll('button')].find(b=>b.textContent===label),set=(label,value)=>{if(label==='Quand montrer les résultats ?'){const i=root.querySelector(`[data-release-rule] input[value="${value}"]`);i.click();return i;}const l=[...root.querySelectorAll('label')].find(n=>n.textContent===label),i=document.getElementById(l.htmlFor);i.value=value;i.dispatchEvent(new Event('change',{bubbles:true}));i.dispatchEvent(new Event('input',{bubbles:true}));};
  if(view==='creation-choice')return;
  button(view==='express'?'Création express':view==='advanced'?'Réglages avancés':'Création guidée').click();set('Question','Quelle activité vendredi ?');
  if(view==='guided-question')return;
  if(view.startsWith('guided-'))button('Continuer').click();
  if(view!=='express')button('Ajouter une réponse').click();['Parc','Cinéma','Jeux'].slice(0,view==='express'?2:3).forEach((text,index)=>set('Réponse '+(index+1),text));
  if(view.startsWith('guided-'))button('Continuer').click();
  if(view!=='express'){set('Qui peut participer ?','groups');const group=[...root.querySelectorAll('.space-group-options label')].find(l=>l.textContent==='Groupe Soleil');group.querySelector('input').click();}
  if(view==='guided-participants'||view==='express')return;
  if(view.startsWith('guided-'))button('Continuer').click();
  if(view==='guided-participation')return;
  if(view.startsWith('guided-'))button('Continuer').click();set('Quand montrer les résultats ?','all_eligible_or_closed');set('Minimum de confidentialité obligatoire','2');
  if(view==='guided-results'||view==='advanced')return;
  button('Continuer').click();
}

export async function spaceCreationChecks(fixture){
  const app=document.getElementById('app');let checks=0;const ok=(x,why)=>{if(!x)throw new Error('Création v0.6.2 : '+why);checks++;};
  const wait=async(fn)=>{const end=Date.now()+15000;while(!fn()){if(Date.now()>end)throw new Error('Création : attente dépassée '+app.textContent.slice(0,100));await new Promise(requestAnimationFrame);}};
  const button=(label,root=app)=>[...root.querySelectorAll('button')].find(n=>n.textContent===label),click=label=>{const b=button(label);if(!b?.getClientRects().length)throw new Error('Action masquée : '+label);b.click();};
  const set=(label,value)=>{if(label==='Quand montrer les résultats ?'){const i=app.querySelector(`[data-release-rule] input[value="${value}"]`);i.click();return i;}const l=[...app.querySelectorAll('label')].find(n=>n.textContent===label),input=document.getElementById(l.htmlFor);input.closest('details')?.setAttribute('open','');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return input;};
  const field=label=>document.getElementById([...app.querySelectorAll('label')].find(n=>n.textContent===label).htmlFor);
  const newForm=async mode=>{location.hash='#space/'+fixture.spaceId;await wait(()=>app.querySelector('[data-space-section=overview]'));location.hash='#space/'+fixture.spaceId+'/polls/new';await wait(()=>app.querySelector('.space-create-choice'));click(mode);};
  const choose=mode=>{click('Changer de parcours');click(mode);};
  const essential=()=>{set('Question','Quelle activité vendredi ?');set('Réponse 1','Parc');set('Réponse 2','Cinéma');click('Ajouter une réponse');set('Réponse 3','Jeux');set('Qui peut participer ?','groups');[...app.querySelectorAll('.space-group-options label')].find(l=>l.textContent==='Groupe Soleil').querySelector('input').click();};
  const custom=()=>{set('Participation','identified');set('Commentaires','optional');set('Visibilité des commentaires','public_with_results');set('Quand montrer les résultats ?','closed');set('Minimum de confidentialité obligatoire','7');set('Qui peut voir les résultats ?','admins_only');};
  const {HttpRelayAdapter}=await import('voti/web/http-relay.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js');const adapter=new HttpRelayAdapter(RELAY_CONFIG),call=(command,input)=>adapter.spaceCommand({command,input,credential:fixture.staff}),drafts=[];
  const created=async()=>{click('Créer le brouillon');await wait(()=>app.textContent.includes('Publier pour les membres'));const id=location.hash.split('/').at(-1);drafts.push(id);return(await call('getSpacePoll',{pollId:id})).poll;};
  const comparable=p=>JSON.stringify({definition:{...p.definition,choices:p.definition.choices.map(({id,...c})=>c)},rules:p.resultRules,audience:p.accessRules.pollAudience});
  await newForm('Création guidée');click('Continuer');ok(app.querySelector('.space-progress').textContent.includes('Étape 1 sur 6')&&!app.querySelector('.space-form-error').hidden,'question vide refusée près du champ');set('Question','Quelle activité vendredi ?');click('Continuer');click('Continuer');ok(app.querySelector('.space-progress').textContent.includes('Étape 2'),'réponses vides refusées');set('Réponse 1','Parc');set('Réponse 2','Cinéma');click('Ajouter une réponse');set('Réponse 3','Jeux');
  while(app.querySelectorAll('[data-answer-row]').length<6)click('Ajouter une réponse');ok(button('Ajouter une réponse').disabled,'borne six réponses');for(let n=6;n>3;n--)app.querySelectorAll('[data-answer-row]')[n-1].querySelector('button').click();ok(app.querySelectorAll('[data-answer-row]').length===3,'suppression sans perte des trois premières réponses');
  app.querySelector('.space-answer-editor details').open=true;app.querySelector('button[aria-label="Monter la réponse 3"]').click();ok(field('Réponse 2').value==='Jeux','réorganisation des réponses');app.querySelector('button[aria-label="Descendre la réponse 2"]').click();click('Continuer');set('Qui peut participer ?','groups');click('Continuer');ok(app.querySelector('.space-progress').textContent.includes('Étape 3'),'choix de groupes explicite obligatoire');[...app.querySelectorAll('.space-group-options label')].find(l=>l.textContent==='Groupe Soleil').querySelector('input').click();click('Continuer');set('Commentaires','disabled');ok(field('Visibilité des commentaires').disabled,'vote simple désactive la visibilité');set('Participation','identified');set('Commentaires','optional');set('Visibilité des commentaires','public_with_results');click('Continuer');custom();click('Continuer');
  ok(app.querySelector('.space-progress').textContent.includes('Étape 6 sur 6')&&app.querySelectorAll('.space-review > section').length===5,'résumé structuré en cinq rubriques');app.querySelector('button[aria-label="Modifier : Participants"]').click();ok(app.querySelector('.space-progress').textContent.includes('Étape 3')&&field('Réponse 3').value==='Jeux','modifier une étape sans perdre les saisies');click('Continuer');click('Continuer');click('Continuer');choose('Réglages avancés');set('Question','');choose('Création guidée');click('Créer le brouillon');ok(app.querySelector('.space-progress').textContent.includes('Étape 1')&&!app.querySelector('.space-form-error').hidden,'erreur d’un champ masqué : retour à la bonne étape');await wait(()=>!button('Créer le brouillon').disabled);set('Question','Quelle activité vendredi ?');for(let n=0;n<5;n++)click('Continuer');const guided=await created();ok(guided.definition.participationIdentityMode==='identified'&&guided.resultRules.minimumResponses===7&&guided.resultRules.releaseMode==='closed','brouillon guidé conforme');
  await newForm('Réglages avancés');essential();custom();const advanced=await created();ok(comparable(guided)===comparable(advanced),'Guidée et Avancé produisent le même modèle fonctionnel');
  await newForm('Réglages avancés');essential();custom();choose('Création express');ok(app.querySelectorAll('.space-form-step:not([hidden])').length===3&&app.querySelector('.space-express-defaults').textContent.includes('vote simple')&&app.querySelector('.space-express-defaults').textContent.includes('2 réponses'),'Express montre uniquement l’essentiel et ses défauts');choose('Création guidée');ok(field('Participation').value==='identified'&&field('Commentaires').value==='optional'&&field('Visibilité des commentaires').value==='public_with_results'&&field('Minimum de confidentialité obligatoire').value==='7'&&field('Qui peut voir les résultats ?').value==='admins_only'&&app.querySelector('[data-release-rule] input:checked').value==='closed','tous les réglages avancés conservés après Express');choose('Création express');const express=await created();ok(express.definition.participationIdentityMode==='anonymous'&&express.definition.commentMode==='disabled'&&express.definition.commentVisibility==='private'&&express.resultRules.minimumResponses===2&&express.resultRules.releaseMode==='threshold'&&express.accessRules.pollAudience.resultsAudience==='poll_audience','défauts Express exacts, sans baisse silencieuse du minimum');
  const old=button('Enregistrer les règles');set('Minimum de confidentialité','3');old.click();await wait(()=>!old.isConnected);const updated=(await call('getSpacePoll',{pollId:express.remoteRef.pollId})).poll;ok(updated.status==='draft'&&updated.resultRules.minimumResponses===3,'Express modifiable avant publication');
  await newForm('Création guidée');ok(field('Participation').value==='anonymous'&&field('Commentaires').value==='optional'&&field('Visibilité des commentaires').value==='private'&&field('Minimum de confidentialité obligatoire').value==='5'&&field('Qui peut voir les résultats ?').value==='poll_audience','nouvelle Guidée : défauts historiques intacts, sans fuite des défauts Express');
  for(const id of drafts){const p=(await call('getSpacePoll',{pollId:id})).poll;await adapter.discardPublication({pollId:id,adminCapability:fixture.staff,expectedRevision:p.remoteRef.revision});}
  location.hash='#space/'+fixture.spaceId;await wait(()=>app.querySelector('[data-space-section=overview]'));return checks;
}

export async function spaceLayoutCreator(fixture){
  const {SpaceAccessStorage}=await import('voti/web/space-storage.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js');
  await new SpaceAccessStorage(localStorage).put({relayId:RELAY_CONFIG.relayId,spaceId:fixture.spaceId,credential:fixture.creator},fixture.staff);
  location.hash='#space/'+fixture.spaceId;
}

export async function spaceLayoutCreatorChecks(fixture){
  const app=document.getElementById('app');let checks=0;
  const ok=(x,why)=>{if(!x)throw new Error('Créateur UI : '+why);checks++;};
  const wait=async(fn)=>{const end=Date.now()+12000;while(!fn()){if(Date.now()>end)throw new Error('Navigation Créateur absente');await new Promise(requestAnimationFrame);}};
  location.hash='#space/'+fixture.spaceId+'/groups';await wait(()=>app.querySelector('[data-space-section=groups]'));
  ok(app.querySelectorAll('.space-list-row').length===1&&app.textContent.includes('Groupe Soleil')&&!app.textContent.includes('Groupe Lune'),'seul le groupe autorisé est rendu');
  ok(!app.querySelector('input,a[href$="/groups/new"]'),'création et édition de groupes réservées à l’administration');
  app.querySelector('.space-list-row a').click();await wait(()=>app.querySelector('.space-group-detail'));
  ok(!app.querySelector('input,button.danger'),'fiche groupe Créateur en lecture seule');
  location.hash='#space/'+fixture.spaceId+'/members';await wait(()=>app.querySelector('h1')?.textContent==='Impossible d’ouvrir cette page');
  ok(app.textContent.includes('Cet accès ne permet pas d’ouvrir cette section.')&&!app.querySelector('.member-row,[data-space-section=members]'),'route membres directe refusée avec motif explicite');
  location.hash='#space/'+fixture.spaceId+'/polls';await wait(()=>app.querySelector('[data-space-section=polls]'));
  ok(app.querySelectorAll('.space-list-row').length===2&&!app.querySelector(`a[href$="/poll/${fixture.polls[1]}"]`),'sondage du groupe interdit absent');
  [...app.querySelectorAll('a')].find(n=>n.textContent==='Nouveau sondage').click();await wait(()=>app.querySelector('.space-create-choice'));[...app.querySelectorAll('button')].find(n=>n.textContent==='Création express').click();
  const label=[...app.querySelectorAll('label')].find(n=>n.textContent==='Qui peut participer ?'),who=document.getElementById(label.htmlFor);
  ok(who.options.length===1&&who.value==='groups'&&app.querySelectorAll('.space-group-options input').length===1&&app.querySelector('.space-group-options input').checked,'Express Créateur limité conserve son seul groupe autorisé');
  document.querySelector('.space-global-return').click();await wait(()=>app.querySelector('h1')?.textContent==='Mes sondages');ok(!document.body.hasAttribute('data-space-management')&&getComputedStyle(document.querySelector('.main-nav')).display!=='none','sortie de l’Espace : navigation libre restaurée');
  return checks;
}

export async function spaceLayoutActions(fixture){
  const app=document.getElementById('app');let checks=0;
  const ok=(x,why)=>{if(!x)throw new Error('Tâche v0.6.2 : '+why);checks++;};
  const wait=async(fn)=>{const end=Date.now()+15000;while(!fn()){if(Date.now()>end)throw new Error('Tâche absente : '+app.textContent.slice(0,120));await new Promise(requestAnimationFrame);}};
  const go=async(suffix)=>{location.hash='#space/'+fixture.spaceId+suffix;await wait(()=>app.getAttribute('aria-busy')==='false'&&app.querySelector('[data-space-section]')?.getAttribute('aria-busy')==='false'&&app.querySelector('[data-space-section]').dataset.spaceSection===suffix.split('/')[1]);};
  const click=(text,root=app)=>{const b=[...root.querySelectorAll('a,button')].find(n=>n.textContent===text.replace(/^[←+]\s*/,'')||n.getAttribute('aria-label')===text);if(!b)throw new Error('Action absente : '+text);b.click();};
  const set=(text,value)=>{const l=[...app.querySelectorAll('label')].find(n=>n.textContent===text.replace(/^[←+]\s*/,'')),input=document.getElementById(l.htmlFor);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
  const confirm=async(text)=>{await wait(()=>document.querySelector('dialog[open]'));click(text,document.querySelector('dialog[open]'));};
  await go('/groups/new');ok(!app.querySelector('.space-list-row'),'création groupe isolée');set('Nom du nouveau groupe','Atelier fictif');click('Créer le groupe');await wait(()=>app.querySelector('.space-list-row')?.isConnected&&app.textContent.includes('Atelier fictif'));
  const row=[...app.querySelectorAll('.space-list-row')].find(n=>n.textContent.includes('Atelier fictif'));row.querySelector('a').click();await wait(()=>app.textContent.includes('Nom du groupe'));set('Nom du groupe','Atelier renommé');click('Enregistrer le groupe');await wait(()=>app.querySelector('h3')?.textContent==='Atelier renommé');ok(true,'renommer groupe dans sa fiche');
  app.querySelector('.space-danger-zone').open=true;click('Archiver le groupe');await confirm('Archiver');await wait(()=>app.textContent.includes('Groupe archivé'));ok(!app.querySelector('input'),'groupe archivé en lecture seule');
  await go('/invitations');const invitation=app.querySelector('.space-list-row:not(.is-secondary)');invitation.querySelector('a').click();await wait(()=>app.textContent.includes('Fermer l’invitation'));click('Fermer l’invitation');await wait(()=>app.textContent.includes('Fermée'));ok(true,'fermer invitation depuis son détail');
  await go('/access');const access=[...app.querySelectorAll('.space-list-row')].find(n=>n.textContent.includes('Créateur')&&n.textContent.includes('Tout l’Espace'));access.querySelector('a').click();await wait(()=>app.querySelector('.space-danger-zone'));ok(app.textContent.includes('Tout l’Espace'),'périmètre lisible dans le détail accès');app.querySelector('.space-danger-zone').open=true;click('Révoquer cet accès');await confirm('Révoquer cet accès');await wait(()=>app.textContent.includes('Révoqué'));ok(true,'révocation accès confirmée');
  await go('/settings');ok(Boolean(app.querySelector('input'))&&Boolean(app.querySelector('.space-danger-zone:not([open])')),'réglages et danger séparés de l’en-tête');
  await go('/members');const a=app.querySelector('.space-list-row a');a.focus();ok(document.activeElement===a,'détail accessible au clavier');
  return checks;
}
