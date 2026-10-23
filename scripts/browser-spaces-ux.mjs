/** v0.6.1 : fixtures fictives face au Worker/D1 LOCAUX, jamais production. */
export async function browserSpacesUx(fixture){
  const app=document.getElementById('app');let checks=0;
  const ok=(value,message)=>{if(!value)throw new Error('UX Espaces : '+message);checks++;};
  const wait=async(fn)=>{const end=performance.now()+15000;while(!fn()){if(performance.now()>end)throw new Error('UX Espaces : attente dépassée : '+app.textContent.slice(0,150));await new Promise(requestAnimationFrame);}};
  const button=(label,root=app)=>[...root.querySelectorAll('button,a')].find(b=>b.textContent===label);
  const set=(label,value,root=app)=>{const l=[...root.querySelectorAll('label')].find(n=>n.textContent===label);if(!l)throw new Error('Champ UX absent : '+label);const i=document.getElementById(l.htmlFor);i.value=value;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return i;};
  const {HttpRelayAdapter}=await import('voti/web/http-relay.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js'),{SpaceAccessStorage}=await import('voti/web/space-storage.js');
  const adapter=new HttpRelayAdapter(RELAY_CONFIG),call=(command,input,credential=fixture.staff)=>adapter.spaceCommand({command,input,credential});
  await new SpaceAccessStorage(localStorage).put({relayId:RELAY_CONFIG.relayId,spaceId:fixture.spaceId,credential:fixture.staff});
  let data=await call('getSpace',{spaceId:fixture.spaceId});const groupId=crypto.randomUUID();
  await call('createGroup',{spaceId:fixture.spaceId,groupId,name:'Soleil fictif',expectedRevision:data.revision});
  location.hash='#space/'+fixture.spaceId;await wait(()=>app.textContent.includes('Sondages de l’Espace')&&app.querySelector('.member-row'));
  ok(app.textContent.includes('choisis Créateur et transmets-lui le fichier SECRET'),'rôle Créateur et import du fichier expliqués');
  const row=app.querySelector('.member-row'),check=row.querySelector('input[type=checkbox]'),save=button('Enregistrer le membre',row);
  ok(save.disabled,'enregistrement inactif sans changement');check.click();ok(!save.disabled&&row.classList.contains('is-dirty'),'affiliation non enregistrée signalée');
  ok(check.parentElement.tagName==='LABEL'&&check.parentElement.textContent.includes('Soleil fictif'),'case associée au bon groupe');
  ok(check.getBoundingClientRect().width===24,'case et label proches, pas largeur de formulaire');
  save.click();await wait(()=>!row.isConnected&&app.querySelector('.member-row input[type=checkbox]')?.checked);
  ok((await call('getSpace',{spaceId:fixture.spaceId})).members.find(m=>m.display_name==='A fictif').groupIds.includes(groupId),'affiliation enregistrée explicitement');
  const current=app.querySelector('.member-row');button('Révoquer la carte',current).click();await wait(()=>document.querySelector('dialog[open]'));button('Révoquer la carte',document.querySelector('dialog[open]')).click();
  await wait(()=>!current.isConnected&&button('Carte déjà révoquée'));
  ok(button('Carte déjà révoquée').disabled,'révocation terminée : bouton désactivé');ok(app.textContent.includes('Carte révoquée · régénération possible'),'statut carte explicite');
  let refused=false;try{await call('getMemberHome',{},fixture.cards[0].credential);}catch(e){refused=e.code==='INVALID_CAPABILITY';}ok(refused,'révocation serveur inchangée');
  // Le test utilise B ensuite ; A ne sera plus présenté par cette fixture UX.
  const invite=[...app.querySelectorAll('section')].find(s=>s.querySelector('h2')?.textContent==='Invitations');
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
  await wait(()=>app.textContent.includes('Sondages de l’Espace'));ok(true,'retour à l’Espace immédiat sans reload');
  if(innerWidth===360){
    const original=HTMLAnchorElement.prototype.click,downloads=[];HTMLAnchorElement.prototype.click=function(){if(this.download)downloads.push(this.download);else original.call(this);};
    try{
      for(const name of ['Carte C fictive','Carte D fictive']){set('Nom ou pseudonyme du nouveau membre',name);button('Créer le membre et sa carte').click();await wait(()=>app.querySelector('h1')?.textContent==='Carte Voti créée');
        if(name==='Carte D fictive'){
          ok(app.textContent.includes('2 carte(s) — Carte C fictive, Carte D fictive'),'périmètre du lot énuméré');
          const individual=button('Télécharger cette carte (PDF SECRET)');individual.click();await wait(()=>downloads.length===1&&!individual.disabled);
          const batch=button('Télécharger le lot de 2 carte(s) A4 (SECRET)');batch.click();await wait(()=>downloads.length===2&&!batch.disabled);
          ok(downloads[0].includes('carte-d-fictive')&&downloads[1].includes('lot-2-cartes'),'PDF individuel/lot : noms réels distincts');ok(downloads.every(n=>!n.includes('v1.')&&!/[a-f0-9]{64}/.test(n)),'aucun credential dans les noms PDF');
        }
        button('Retour à l’Espace').click();await wait(()=>app.textContent.includes('Sondages de l’Espace'));
      }
    }finally{HTMLAnchorElement.prototype.click=original;}
  }
  const details=[...app.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Créer un sondage dans cet Espace');details.open=true;
  ok(app.querySelector('.space-progress').textContent.includes('Étape 1 sur 4'),'guidé par défaut, progression claire');
  set('Question','Une sortie 😊 ?');set('Réponses','Cinéma\nForêt');button('Continuer',details).click();ok(app.querySelector('.space-progress').textContent.includes('Étape 2'),'première étape validée');
  const comments=set('Commentaires','disabled',details),visibility=[...details.querySelectorAll('label')].find(l=>l.textContent==='Visibilité des commentaires');ok(document.getElementById(visibility.htmlFor).disabled,'vote simple : visibilité désactivée');
  comments.value='optional';comments.dispatchEvent(new Event('change',{bubbles:true}));ok(!document.getElementById(visibility.htmlFor).disabled,'commentaires : visibilité réactivée');
  button('Étape précédente',details).click();ok([...details.querySelectorAll('input')].some(i=>i.value==='Une sortie 😊 ?'),'retour conserve la question');
  button('Création rapide',details).click();ok([...details.querySelectorAll('.space-form-step')].every(s=>!s.hidden),'rapide montre les mêmes sections');
  ok([...details.querySelectorAll('textarea')][0].value==='Cinéma\nForêt','changement de mode sans perte des réponses');
  set('Minimum de confidentialité obligatoire','2',details);set('Quand montrer les résultats ?','closed',details);button('Pas à pas',details).click();button('Continuer',details).click();button('Continuer',details).click();button('Continuer',details).click();
  ok(app.querySelector('.space-progress').textContent.includes('Étape 4'),'récapitulatif accessible');ok(details.querySelector('.space-recap').textContent.includes('Quand le sondage est fermé'),'règle humaine en récapitulatif');
  button('Créer le brouillon',details).click();await wait(()=>app.textContent.includes('Publier pour les membres'));
  const pId=location.hash.split('/').at(-1),p=(await call('getSpacePoll',{pollId:pId})).poll;
  ok(p.definition.question==='Une sortie 😊 ?'&&p.resultRules.releaseMode==='closed'&&p.resultRules.minimumResponses===2,'guidé construit la définition attendue');
  set('Commentaires','disabled');ok(document.getElementById([...app.querySelectorAll('label')].find(l=>l.textContent==='Visibilité des commentaires').htmlFor).disabled,'édition : visibilité désactivée');
  button('Publier pour les membres').click();await wait(()=>app.querySelector('[data-result-state]'));
  ok(app.querySelector('[data-result-state]').dataset.resultState==='minimum','état résultats affiché directement en gestion');
  const actions=app.querySelector('.space-poll-actions');ok(actions.querySelectorAll('a.button').length===3,'diffusion/résultats : trois actions distinctes');
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
  const button=(label,root)=>[...root.querySelectorAll('button')].find(b=>b.textContent===label);
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
