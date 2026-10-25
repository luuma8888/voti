/** v0.6.1 : fixtures fictives face au Worker/D1 LOCAUX, jamais production. */
export async function browserSpacesUx(fixture){
  const app=document.getElementById('app');let checks=0;
  const ok=(value,message)=>{if(!value)throw new Error('UX Espaces : '+message);checks++;};
  const wait=async(fn)=>{const end=performance.now()+15000;while(!fn()){if(performance.now()>end)throw new Error('UX Espaces : attente dépassée : '+app.textContent.slice(0,150));await new Promise(requestAnimationFrame);}};
  const button=(label,root=app)=>[...root.querySelectorAll('button,a')].find(b=>(b.textContent===label.replace(/^[←+]\s*/,'')||b.getAttribute('aria-label')===label));
  const set=(label,value,root=app)=>{if(label==='Quand montrer les résultats ?'&&root.querySelector('[data-release-rule]')){const i=root.querySelector(`[data-release-rule] input[value="${value}"]`);i.click();return i;}if(label==='Réponses'&&root.querySelector('.space-answer-editor')){const labels=value.split('\n');while(root.querySelectorAll('[data-answer-row]').length<labels.length)button('Ajouter une réponse',root).click();[...root.querySelectorAll('[data-answer-row] input')].forEach((i,n)=>{i.value=labels[n]??'';i.dispatchEvent(new Event('input',{bubbles:true}));});return;}const l=[...root.querySelectorAll('label')].find(n=>n.textContent===label.replace(/^[←+]\s*/,''));if(!l)throw new Error('Champ UX absent : '+label);const i=document.getElementById(l.htmlFor);if(i.closest('details'))i.closest('details').open=true;i.value=value;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return i;};
  const {HttpRelayAdapter}=await import('voti/web/http-relay.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js'),{SpaceAccessStorage}=await import('voti/web/space-storage.js');
  const adapter=new HttpRelayAdapter(RELAY_CONFIG),call=(command,input,credential=fixture.staff)=>adapter.spaceCommand({command,input,credential});
  await new SpaceAccessStorage(localStorage).put({relayId:RELAY_CONFIG.relayId,spaceId:fixture.spaceId,credential:fixture.staff});
  let data=await call('getSpace',{spaceId:fixture.spaceId});const groupId=crypto.randomUUID();
  await call('createGroup',{spaceId:fixture.spaceId,groupId,name:'Soleil fictif',expectedRevision:data.revision});
  const go=async(suffix)=>{location.hash='#space/'+fixture.spaceId+suffix;await wait(()=>app.querySelector('[data-space-section]')&&location.hash.endsWith(suffix)&&(!suffix.includes('/new')||app.querySelector('.space-task-form')));};
  const member=(await call('getSpace',{spaceId:fixture.spaceId})).members.find(m=>m.display_name==='A fictif');
  await go('/access/new');await wait(()=>app.textContent.includes('choisis Créateur'));
  ok(app.textContent.includes('choisis Créateur et transmets-lui le fichier SECRET'),'rôle Créateur et import du fichier expliqués');
  await go('/members/'+member.member_id);await wait(()=>app.querySelector('.member-row'));
  const row=app.querySelector('.member-row'),check=row.querySelector('input[type=checkbox]'),save=button('Enregistrer le membre',row);
  ok(save.disabled,'enregistrement inactif sans changement');check.click();ok(!save.disabled&&row.classList.contains('is-dirty'),'affiliation non enregistrée signalée');
  ok(check.parentElement.tagName==='LABEL'&&check.parentElement.textContent.includes('Soleil fictif'),'case associée au bon groupe');
  ok(check.getBoundingClientRect().width===24,'case et label proches, pas largeur de formulaire');
  save.click();await wait(()=>!row.isConnected&&app.querySelector('.member-row input[type=checkbox]')?.checked);
  ok((await call('getSpace',{spaceId:fixture.spaceId})).members.find(m=>m.display_name==='A fictif').groupIds.includes(groupId),'affiliation enregistrée explicitement');
  const current=app.querySelector('.member-row');app.querySelector('.space-danger-zone').open=true;button('Révoquer la carte').click();await wait(()=>document.querySelector('dialog[open]'));button('Révoquer la carte',document.querySelector('dialog[open]')).click();
  await wait(()=>!current.isConnected&&button('Carte déjà révoquée'));
  ok(button('Carte déjà révoquée').disabled,'révocation terminée : bouton désactivé');ok(app.textContent.includes('Carte révoquée · régénération possible'),'statut carte explicite');
  let refused=false;try{await call('getMemberHome',{},fixture.cards[0].credential);}catch(e){refused=e.code==='INVALID_CAPABILITY';}ok(refused,'révocation serveur inchangée');
  // Le test utilise B ensuite ; A ne sera plus présenté par cette fixture UX.
  await go('/invitations/new');await wait(()=>app.textContent.includes('Nombre maximum d’utilisations'));
  const invite=[...app.querySelectorAll('section')].find(s=>s.querySelector('h2')?.textContent==='Nouvelle invitation');
  ok(invite.textContent.includes('Aucun groupe sélectionné'),'omission groupe signalée avant création');invite.querySelector('input[type=checkbox]').click();
  set('Nombre maximum d’utilisations (1 = invitation individuelle)','3',invite);set('Expiration en jours','2',invite);
  ok(invite.querySelector('.space-recap').textContent.includes('Soleil fictif')&&invite.textContent.includes('Maximum 3 utilisation(s), expiration dans 2 jour(s)'),'récapitulatif groupes/usages/durée');
  const oldHash=location.hash,revisionBeforeCancel=(await call('getSpace',{spaceId:fixture.spaceId})).revision,inviteTrigger=button('Créer une invitation',invite);inviteTrigger.focus();inviteTrigger.click();await wait(()=>document.querySelector('dialog[open]'));button('Annuler',document.querySelector('dialog[open]')).click();await wait(()=>!document.querySelector('dialog[open]')&&!inviteTrigger.disabled);
  ok(document.activeElement===inviteTrigger,'annulation : focus restauré après réactivation du bouton');ok((await call('getSpace',{spaceId:fixture.spaceId})).revision===revisionBeforeCancel,'annulation invitation sans mutation');
  inviteTrigger.click();await wait(()=>document.querySelector('dialog[open]'));
  ok(document.querySelector('dialog').textContent.includes('Soleil fictif'),'confirmation expose les groupes visés');button('Créer l’invitation',document.querySelector('dialog[open]')).click();
  await wait(()=>app.querySelector('h1')?.textContent==='Invitation secrète');
  ok(location.hash===oldHash,'reproduction du hash identique après création');ok(app.textContent.includes('ne pourra plus être réaffiché'),'avertissement disponibilité QR');
  ok(Boolean(button('Télécharger le QR SECRET (SVG)')),'QR invitation téléchargeable explicitement');button('Retour à l’Espace').click();
  await wait(()=>app.querySelector('[data-space-section=overview]'));ok(true,'retour à l’Espace immédiat sans reload');
  if(innerWidth===360){
    const original=HTMLAnchorElement.prototype.click,downloads=[];HTMLAnchorElement.prototype.click=function(){if(this.download)downloads.push(this.download);else original.call(this);};
    try{
      for(const name of ['Carte C fictive','Carte D fictive']){await go('/members/new');await wait(()=>app.textContent.includes('Nom ou pseudonyme du nouveau membre'));set('Nom ou pseudonyme du nouveau membre',name);button('Créer le membre et sa carte').click();await wait(()=>app.querySelector('h1')?.textContent==='Carte Voti créée');
        if(name==='Carte D fictive'){
          ok(app.textContent.includes('2 carte(s) — Carte C fictive, Carte D fictive'),'périmètre du lot énuméré');
          const individual=button('Télécharger cette carte (PDF SECRET)');individual.click();await wait(()=>downloads.length===1&&!individual.disabled);
          const batch=button('Télécharger le lot de 2 carte(s) A4 (SECRET)');batch.click();await wait(()=>downloads.length===2&&!batch.disabled);
          ok(downloads[0].includes('carte-d-fictive')&&downloads[1].includes('lot-2-cartes'),'PDF individuel/lot : noms réels distincts');ok(downloads.every(n=>!n.includes('v1.')&&!/[a-f0-9]{64}/.test(n)),'aucun credential dans les noms PDF');
        }
        button('Retour à l’Espace').click();await wait(()=>app.querySelector('[data-space-section=members]'));
      }
    }finally{HTMLAnchorElement.prototype.click=original;}
  }
  await go('/polls/new');await wait(()=>app.querySelector('.space-poll-form'));const details=app.querySelector('.space-poll-form');
  button('Création guidée',details).click();ok(app.querySelector('.space-progress').textContent.includes('Étape 1 sur 6'),'guidé par défaut, progression claire');
  set('Question','Une sortie 😊 ?');button('Continuer',details).click();ok(app.querySelector('.space-progress').textContent.includes('Étape 2'),'première étape validée');set('Réponses','Cinéma\nForêt');button('Continuer',details).click();button('Continuer',details).click();
  const comments=set('Commentaires','disabled',details),visibility=[...details.querySelectorAll('label')].find(l=>l.textContent==='Visibilité des commentaires');ok(document.getElementById(visibility.htmlFor).disabled,'vote simple : visibilité désactivée');
  comments.value='optional';comments.dispatchEvent(new Event('change',{bubbles:true}));ok(!document.getElementById(visibility.htmlFor).disabled,'commentaires : visibilité réactivée');
  button('Retour',details).click();button('Retour',details).click();button('Retour',details).click();ok([...details.querySelectorAll('input')].some(i=>i.value==='Une sortie 😊 ?'),'retour conserve la question');
  button('Changer de parcours',details).click();button('Réglages avancés',details).click();ok([...details.querySelectorAll('.space-form-step')].every(s=>!s.hidden),'rapide montre les mêmes sections');
  ok([...details.querySelectorAll('[data-answer-row] input')].map(i=>i.value).join('\n')==='Cinéma\nForêt','changement de mode sans perte des réponses');
  set('Minimum de confidentialité obligatoire','2',details);set('Quand montrer les résultats ?','closed',details);button('Changer de parcours',details).click();button('Création guidée',details).click();button('Continuer',details).click();button('Continuer',details).click();button('Continuer',details).click();button('Continuer',details).click();button('Continuer',details).click();
  ok(app.querySelector('.space-progress').textContent.includes('Étape 6'),'récapitulatif accessible');ok(details.querySelector('.space-recap').textContent.includes('Quand le sondage est fermé'),'règle humaine en récapitulatif');
  button('Créer le brouillon',details).click();await wait(()=>app.textContent.includes('Publier pour les membres'));
  const pId=location.hash.split('/').at(-1),p=(await call('getSpacePoll',{pollId:pId})).poll;
  ok(p.definition.question==='Une sortie 😊 ?'&&p.resultRules.releaseMode==='closed'&&p.resultRules.minimumResponses===2,'guidé construit la définition attendue');
  set('Commentaires','disabled');ok(document.getElementById([...app.querySelectorAll('label')].find(l=>l.textContent==='Visibilité des commentaires').htmlFor).disabled,'édition : visibilité désactivée');
  const savedRules=button('Enregistrer les règles');savedRules.click();await wait(()=>!savedRules.isConnected);
  button('Publier pour les membres').click();await wait(()=>app.querySelector('[data-poll-status=published]'));
  ok(app.querySelector('[data-result-state]').dataset.resultState==='minimum','état résultats affiché directement en gestion');
  const actions=app.querySelector('.space-poll-actions');ok(actions.querySelectorAll('a.button').length===2&&app.querySelector('.poll-results-action a[aria-label=Résultats]'),'diffusion distincte de l’action et du motif Résultats');
  for(const theme of ['pop','nature','douceur','dark','minimal']){document.documentElement.dataset.theme=theme;ok(document.documentElement.scrollWidth<=innerWidth,'aucun débordement gestion '+theme);}
  // Projection protégée réelle : jamais de compteur/agrégats pour admins_only.
  data=await call('getSpace',{spaceId:fixture.spaceId});
  const {createPoll}=await import('voti/shared/poll-engine.js'),{emptyState}=await import('voti/shared/model.js');
  const restricted=createPoll(emptyState(),{question:'Résultats réservés fictifs',choices:['Oui','Non'],resultRules:{minimumResponses:1}}).polls[0];
  await call('prepareSpacePublication',{spaceId:fixture.spaceId,poll:restricted,pollAudience:{spaceId:fixture.spaceId,mode:'space',groupIds:[],resultsAudience:'admins_only'},expectedRevision:data.revision});await call('publishSpacePoll',{pollId:restricted.id,expectedRevision:0});
  location.hash='#home';await wait(()=>app.querySelector('h1')?.textContent==='Mes sondages');
  // Recharge via carte : le fragment est consommé avant fetch par l'application.
  location.hash='#/member/'+fixture.cards[1].credential;await wait(()=>app.querySelector('h1')?.textContent==='Mon espace');
  ok(app.textContent.includes('À toi de participer')&&!app.textContent.includes('À voter'),'statut participant distinct');
  location.hash=`#/p/${restricted.id}/results`;await wait(()=>app.querySelector('[data-result-state]'));
  ok(app.querySelector('[data-result-state]').dataset.resultState==='reserved','admins_only : vrai motif visible au membre');ok(!app.textContent.includes('Minimum')&&!app.querySelector('.result-row'),'aucun faux seuil ni agrégat');
  const beforeClose=(await call('getSpacePoll',{pollId:pId})).poll;await adapter.closePoll({pollId:pId,adminCapability:fixture.staff,expectedRevision:beforeClose.remoteRef.revision});location.hash=`#/p/${pId}/results`;await wait(()=>app.querySelector('[data-result-state]')?.dataset.resultState==='minimum');
  ok(app.textContent.includes('Minimum de confidentialité non atteint'),'sondage fermé sous minimum : cause exacte');ok(!app.querySelector('.result-row'),'fermeture sous minimum : aucun agrégat');
  button('Terminer').click();await wait(()=>location.hash==='#home');
  ok(!Object.values(localStorage).some(v=>fixture.cards.some(c=>v.includes(c.credential)||v.includes(c.displayName)))&&!sessionStorage.length,'aucun nom ou credential participant persisté');
  return checks;
}
export async function browserScannerUx(credential){
  const app=document.getElementById('app');let checks=0;
  const ok=(value,message)=>{if(!value)throw new Error('Scanner : '+message);checks++;};
  const button=(label,root)=>[...root.querySelectorAll('button')].find(b=>b.textContent===label.replace(/^[←+]\s*/,''));
  const wait=async(fn)=>{const end=performance.now()+15000;while(!fn()){if(performance.now()>end)throw new Error('Scanner : attente caméra simulée dépassée');await new Promise(requestAnimationFrame);}};
  // Caméra artificielle LOCALE : ni téléphone ni validation physique revendiqués.
  const {scanMemberCard}=await import('voti/web/member-scanner.js'),{createQrMatrix,renderQrCanvas}=await import('voti/web/qr.js'),{buildMemberUrl}=await import('voti/shared/spaces.js');
  const original=navigator.mediaDevices.getUserMedia,canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.style.width='192px';document.body.append(canvas);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1920,1080);
  let stream,pump,deadline;const trigger=document.createElement('button');trigger.textContent='Test caméra local';app.append(trigger);
  try{
    navigator.mediaDevices.getUserMedia=async()=>{stream=canvas.captureStream(10);return stream;};
    const pending=scanMemberCard(trigger);button('Scanner avec la caméra',document.querySelector('dialog')).click();await wait(()=>document.querySelector('dialog video')?.videoWidth&&document.querySelector('dialog [role=status]')?.textContent.includes('analyse'));
    ok(document.querySelector('.scan-guide').textContent.includes('agrandis'),'guidage visible');ok(document.querySelector('dialog [role=status]').textContent.includes('analyse'),'analyse locale signalée');
    const qr=renderQrCanvas(createQrMatrix(buildMemberUrl(location.origin+location.pathname,credential)),5);ctx.save();ctx.translate(960,540);ctx.rotate(.12);ctx.drawImage(qr,-qr.width/2,-qr.height/2);ctx.restore();qr.width=qr.height=1;
    pump=setInterval(()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,2,2);stream?.getVideoTracks()[0]?.requestFrame?.();},100);
    const result=await Promise.race([pending,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Caméra fictive non décodée dans le délai borné')),12000);})]);clearTimeout(deadline);
    ok(result===credential,'caméra simulée : petit QR incliné décodé localement');ok(stream.getTracks().every(t=>t.readyState==='ended'),'caméra libérée après reconnaissance');ok(!document.querySelector('dialog[open]'),'dialogue fermé après reconnaissance');
    const cancelled=scanMemberCard(trigger);button('Scanner avec la caméra',document.querySelector('dialog')).click();await wait(()=>document.querySelector('dialog video')?.videoWidth);button('Annuler',document.querySelector('dialog')).click();ok(await cancelled===null,'annulation sans carte');ok(stream.getTracks().every(t=>t.readyState==='ended'),'caméra libérée après annulation');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,1920,1080);const navigation=scanMemberCard(trigger);button('Scanner avec la caméra',document.querySelector('dialog')).click();await wait(()=>document.querySelector('dialog video')?.videoWidth);window.dispatchEvent(new HashChangeEvent('hashchange'));ok(await navigation===null,'navigation ferme le scanner');ok(stream.getTracks().every(t=>t.readyState==='ended'),'navigation libère la caméra');
    let grant;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{grant=resolve;});const late=scanMemberCard(trigger);button('Scanner avec la caméra',document.querySelector('dialog')).click();button('Annuler',document.querySelector('dialog')).click();ok(await late===null,'annulation pendant permission caméra');const delayed=canvas.captureStream(10);grant(delayed);await new Promise(requestAnimationFrame);ok(delayed.getTracks().every(t=>t.readyState==='ended'),'permission tardive : pistes également libérées');
  }finally{clearTimeout(deadline);clearInterval(pump);navigator.mediaDevices.getUserMedia=original;stream?.getTracks().forEach(t=>t.stop());canvas.width=canvas.height=1;canvas.remove();document.querySelector('dialog[open] button:last-child')?.click();trigger.remove();}
  return checks;
}

/** Réserves de recette Sondage : vrais formulaires et requêtes sur D1 local fictif. */
export async function browserPollUx(width){
 const app=document.getElementById('app'),{HttpRelayAdapter}=await import('voti/web/http-relay.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js'),{SpaceAccessStorage}=await import('voti/web/space-storage.js'),{createSpaceCredential}=await import('voti/shared/spaces.js');
 if(!RELAY_CONFIG.baseUrl.startsWith('http://127.0.0.1:'))throw Error('Recette automatisée locale uniquement.');
 let checks=0;const ok=(v,m)=>{if(!v)throw Error('Polish Sondage : '+m);checks++;},wait=async fn=>{const end=performance.now()+20000;while(!fn()){if(performance.now()>end)throw Error('Polish Sondage : attente '+app.textContent.slice(-200));await new Promise(requestAnimationFrame);}};
 const button=t=>[...app.querySelectorAll('button,a')].find(b=>b.textContent===t||b.getAttribute('aria-label')===t),click=t=>{const b=button(t);ok(Boolean(b?.getClientRects().length),'action visible '+t);b.click();},field=label=>document.getElementById([...app.querySelectorAll('label')].find(l=>l.textContent===label)?.htmlFor),set=(label,value)=>{const i=field(label);for(let d=i.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;i.value=value;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return i;};
 const adapter=new HttpRelayAdapter(RELAY_CONFIG),staff=createSpaceCredential('staff'),spaceId=crypto.randomUUID(),call=(command,input)=>adapter.spaceCommand({command,input,credential:staff,...(command==='createSpace'?{humanVerificationToken:`voti-local-test.${Date.now()}.${crypto.randomUUID()}`}:{})}),rev=async()=>(await call('getSpace',{spaceId})).revision;
 await call('createSpace',{spaceId,name:'Sondages — recette fictive',expectedRevision:0});const ids=[];for(const name of ['Soleil','Lune','Vide','Unique']){const groupId=crypto.randomUUID();await call('createGroup',{spaceId,groupId,name,expectedRevision:await rev()});ids.push(groupId);}
 for(let n=0;n<12;n++)await call('createMember',{spaceId,memberId:crypto.randomUUID(),displayName:'Membre fictif '+n,groupIds:[...(n<8?[ids[0]]:[]),...(n>=6?[ids[1]]:[]),...(n===0?[ids[3]]:[])],memberCredential:createSpaceCredential('member'),expectedRevision:await rev()});
 await new SpaceAccessStorage(localStorage).put({relayId:RELAY_CONFIG.relayId,spaceId,credential:staff});const go=async suffix=>{const old=app.querySelector('.space-poll-form,.space-poll-management');location.hash='#space/'+spaceId+suffix;await wait(()=>suffix.endsWith('/new')?app.querySelector('.space-poll-form')!==old&&app.querySelector('.space-create-choice')?.getClientRects().length:app.querySelector('.space-poll-management')!==old&&app.querySelector('[data-poll-status]'));};
 await go('/polls/new');click('Création express');await wait(()=>app.querySelector('.space-express-defaults').textContent.includes('3 réponses'));
 ok(app.querySelectorAll('.space-form-step:not([hidden])').length===3,'Express reste essentiel');ok(app.querySelector('.space-express-defaults').textContent.includes('sur l’écran suivant'),'Express annonce l’ajustement avant publication');
 set('Question','Question fictive Express '+width);set('Réponse 1','Parc');set('Réponse 2','Cinéma');set('Qui peut participer ?','groups');const group=id=>app.querySelector(`.space-group-options input[value="${id}"]`);
 group(ids[0]).click();ok(field('Minimum de confidentialité obligatoire').value==='2','8 membres => 2');group(ids[1]).click();ok(field('Minimum de confidentialité obligatoire').value==='3','12 distincts, pas 14 => 3');
 click('Changer de parcours');click('Réglages avancés');set('Minimum de confidentialité obligatoire','7');group(ids[1]).click();ok(field('Minimum de confidentialité obligatoire').value==='7','personnalisation préservée au changement audience');
 click('Changer de parcours');click('Création express');ok(app.querySelector('.space-express-defaults').textContent.includes('7 réponses'),'Express conserve le minimum personnalisé');click('Changer de parcours');click('Réglages avancés');click('Utiliser la recommandation');ok(field('Minimum de confidentialité obligatoire').value==='2','retour explicite à la recommandation');
 group(ids[0]).click();group(ids[3]).click();ok(field('Minimum de confidentialité obligatoire').value==='2'&&app.textContent.includes('même à la fermeture'),'un seul membre : plancher 2 expliqué');group(ids[3]).click();group(ids[2]).click();ok(field('Minimum de confidentialité obligatoire').value==='2','audience vide reste 2');group(ids[2]).click();group(ids[0]).click();
 click('Changer de parcours');click('Création express');
 // Ancien Worker sans getAudienceSize : pas de brouillon créé sur un nombre supposé.
 {const before=(await call('getSpace',{spaceId})).polls.length,originalCount=HttpRelayAdapter.prototype.spaceCommand;let missingCalls=0;
  HttpRelayAdapter.prototype.spaceCommand=async function(args){if(args.command==='getAudienceSize'){missingCalls++;const mock=Object.create(this);mock.fetchImpl=async()=>Response.json({error:{code:'NOT_FOUND'}},{status:404});return originalCount.call(mock,args);}return originalCount.call(this,args);};
  try{click('Créer le brouillon');await wait(()=>app.querySelector('.space-form-error')?.hidden===false&&!button('Créer le brouillon').disabled);ok(missingCalls===1&&location.hash.endsWith('/polls/new'),'contrat absent signalé, création reste ouverte');ok((await call('getSpace',{spaceId})).polls.length===before,'aucun brouillon créé sans comptage fiable');}
  finally{HttpRelayAdapter.prototype.spaceCommand=originalCount;}
 }
 click('Créer le brouillon');await wait(()=>app.querySelector('.poll-edit'));
 const id=location.hash.split('/').at(-1),root=app.querySelector('.space-poll-management'),heading=app.querySelector('h1');ok(!app.querySelector('.poll-edit').open,'édition fermée par défaut');ok(app.querySelector('.poll-summary').textContent.includes('Parc'),'résumé indépendant');
 app.querySelector('.poll-edit').open=true;set('Modifier la question','Question modifiée fictive '+width);const bar=app.querySelector('.edit-action-bar');ok(!bar.hidden&&bar.textContent.includes('Modifications non enregistrées'),'modification annoncée');ok(button('Enregistrer les règles').classList.contains('primary'),'enregistrer saillant');
 set('Modifier la question','Question fictive Express '+width);ok(bar.hidden,'retour spontané à la valeur d’origine => clean');set('Modifier la question','Autre question fictive');click('Annuler');ok(field('Modifier la question').value==='Question fictive Express '+width&&bar.hidden,'Annuler restaure la valeur persistée');set('Modifier la question','Question modifiée fictive '+width);
 const original=HttpRelayAdapter.prototype.spaceCommand;let fail=true,sends=0,releaseFailure;HttpRelayAdapter.prototype.spaceCommand=async function(args){if(args.command==='updateSpacePoll'){sends++;if(fail){const mock=Object.create(this);mock.fetchImpl=()=>new Promise(resolve=>{releaseFailure=()=>resolve(Response.json({error:{code:'RELAY_UNAVAILABLE'}},{status:503}));});return original.call(mock,args);}}return original.call(this,args);};
 try{click('Enregistrer les règles');await wait(()=>Boolean(releaseFailure));ok(bar.textContent.includes('Enregistrement…')&&button('Enregistrer les règles').getAttribute('aria-busy')==='true'&&field('Modifier la question').closest('fieldset').disabled,'progression annoncée et saisies bloquées pendant l’envoi');releaseFailure();await wait(()=>bar.textContent.includes('Enregistrement impossible'));ok(field('Modifier la question').value==='Question modifiée fictive '+width&&!bar.hidden,'échec préserve valeurs et dirty');fail=false;click('Enregistrer les règles');await wait(()=>app.querySelector('.poll-save-notice')?.textContent.includes('Modifications enregistrées'));ok(root===app.querySelector('.space-poll-management')&&heading===app.querySelector('h1'),'sauvegarde sans démontage de page/titre');ok(app.querySelector('.poll-edit-confirmation')?.textContent==='Modifications enregistrées.','confirmation locale près de l’édition');ok(sends===2,'un envoi par action, erreur puis succès');}finally{HttpRelayAdapter.prototype.spaceCommand=original;}
 ok(app.querySelector('.edit-action-bar').hidden&&app.querySelector('.poll-edit').open,'succès clean, édition ouverte');set('Modifier la question','Saisie à garder');const originalName=heading.textContent;location.hash='#space/'+spaceId+'/polls';await wait(()=>document.querySelector('dialog[open]'));[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Continuer les modifications').click();await wait(()=>location.hash.endsWith('/poll/'+id));ok(field('Modifier la question').value==='Saisie à garder','navigation annulée conserve saisie');click('Annuler');ok(field('Modifier la question').value===originalName,'annulation après garde');
 click('Publier pour les membres');await wait(()=>app.querySelector('[data-poll-attendance]'));ok(app.querySelector('[data-poll-attendance]').textContent==='0 participations sur 8','snapshot audience Soleil');ok(app.querySelector('[data-poll-attendance]').compareDocumentPosition(button('Fermer le sondage'))&Node.DOCUMENT_POSITION_FOLLOWING,'suivi avant action Fermer');ok(app.querySelector('.poll-results-action a').getAttribute('aria-describedby')===app.querySelector('.poll-results-action p').id,'motif lié à l’action résultats');
 for(let n=0;n<5;n++)await call('createMember',{spaceId,memberId:crypto.randomUUID(),displayName:'Ajout fictif '+n,groupIds:[ids[0]],memberCredential:createSpaceCredential('member'),expectedRevision:await rev()});
 location.hash='#space/'+spaceId+'/polls';await wait(()=>app.querySelector('[data-space-section=polls]'));await go('/poll/'+id);ok(field('Minimum de confidentialité').value==='2','publié : minimum non recalculé rétroactivement');ok(app.querySelector('[data-poll-attendance]').textContent==='0 participations sur 8','snapshot reste 8 malgré nouveaux membres');
 ok(document.documentElement.scrollWidth<=innerWidth,'aucun débordement '+width);window.scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{checks,spaceId,pollId:id};
}
