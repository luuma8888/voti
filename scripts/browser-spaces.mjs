/** Parcours fictifs uniquement, exécutés dans l’HTML réel face au Worker local. */
export async function browserSpacesStage(fixture,stage){
  const app=document.getElementById('app'),text=()=>app.textContent;let checks=0;
  const ok=(value,message)=>{if(!value)throw new Error('Espaces Chromium : '+message);checks++;};
  const wait=async predicate=>{const end=performance.now()+15000;while(!predicate()){if(performance.now()>end)throw new Error('Espaces Chromium : attente '+stage+' dépassée : '+text().slice(0,150)+' ; '+document.getElementById('message')?.textContent);await new Promise(requestAnimationFrame);}};
  const click=label=>{const b=[...app.querySelectorAll('button,a')].find(n=>n.textContent===label.replace(/^[←+]\s*/,''));if(!b)throw new Error('Bouton absent : '+label);b.click();return b;};
  if(stage==='adminUi'){
    location.hash='#spaces';await wait(()=>text().includes('Créer un Espace'));
    const set=(label,value)=>{if(label==='Quand montrer les résultats ?'&&app.querySelector('[data-release-rule]')){const i=app.querySelector(`[data-release-rule] input[value="${value}"]`);i.click();return i;}if(label==='Réponses'&&app.querySelector('.space-answer-editor')){const labels=value.split('\n');while(app.querySelectorAll('[data-answer-row]').length<labels.length)click('Ajouter une réponse');[...app.querySelectorAll('[data-answer-row] input')].forEach((i,n)=>{i.value=labels[n]??'';i.dispatchEvent(new Event('input',{bubbles:true}));});return;}const target=[...app.querySelectorAll('label')].find(n=>n.textContent===label.replace(/^[←+]\s*/,''));if(!target)throw new Error('Champ absent '+label);const input=document.getElementById(target.htmlFor);if(input.closest('details'))input.closest('details').open=true;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
    set('Nom de l’Espace','Espace UI fictif');click('Créer un Espace');await wait(()=>text().includes('Administrateur de l’Espace'));
    click('Groupes');await wait(()=>app.querySelector('[data-space-section=groups]'));click('+ Nouveau groupe');await wait(()=>text().includes('Nom du nouveau groupe'));
    set('Nom du nouveau groupe','Groupe UI fictif');click('Créer le groupe');await wait(()=>app.querySelector('.space-list-row h3')?.textContent==='Groupe UI fictif');click('Membres');await wait(()=>app.querySelector('[data-space-section=members]'));click('+ Ajouter un membre');await wait(()=>text().includes('Nom ou pseudonyme du nouveau membre'));
    set('Nom ou pseudonyme du nouveau membre','Membre UI fictif');const box=[...app.querySelectorAll('section')].find(n=>n.classList.contains('space-detail')&&n.textContent.includes('Nom ou pseudonyme du nouveau membre'));box.querySelector('input[type=checkbox]').click();click('Créer le membre et sa carte');await wait(()=>text().includes('Carte Voti créée'));
    ok(Boolean(app.querySelector('.member-card-qr')),'création membre et QR par UI');ok(app.querySelector('.member-card-qr').getBoundingClientRect().width<=innerWidth,'carte mobile bornée');click('Retour à l’Espace');await wait(()=>app.querySelector('[data-space-section=members]'));click('Sondages');await wait(()=>app.querySelector('[data-space-section=polls]'));click('+ Nouveau sondage');await wait(()=>app.querySelector('.space-poll-form'));

    click('Réglages avancés');
    set('Question','Sondage créé dans l’UI');set('Réponses','Oui\nNon');set('Minimum de confidentialité obligatoire','1');click('Créer le brouillon');await wait(()=>text().includes('Publier pour les membres'));
    set('Modifier la question','Question UI modifiée');set('Réponses (2 à 6, une par ligne)','Forêt\nCinéma\nSport');click('Enregistrer les règles');await wait(()=>app.querySelector('h1')?.textContent==='Question UI modifiée'&&app.querySelectorAll('.management-answer-list li').length===3);
    ok(app.querySelectorAll('.management-answer-list li').length===3,'édition réelle des choix avant verrouillage');click('Publier pour les membres');await wait(()=>text().includes('0 participations sur 1'));ok(!text().includes('À relancer'),'admin anonyme : aucune liste nominative');
    for(const theme of ['pop','nature','douceur','dark','minimal']){document.documentElement.dataset.theme=theme;ok(document.documentElement.scrollWidth<=innerWidth,'gestion Espace sans débordement '+theme);}
    const key=localStorage.getItem('voti.spaces.access.v1');ok(key&&!key.includes('voti-member-v1.')&&!key.includes('Membre UI fictif'),'stockage de gestion sans cartes ni noms');
    return checks;
  }
  if(stage==='setup'){
    const {HttpRelayAdapter}=await import('voti/web/http-relay.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js');
    const {createSpaceCredential}=await import('voti/shared/spaces.js'),{createPoll}=await import('voti/shared/poll-engine.js'),{emptyState}=await import('voti/shared/model.js');
    const adapter=new HttpRelayAdapter(RELAY_CONFIG),spaceId=crypto.randomUUID(),staff=createSpaceCredential('staff');
    const call=(command,input,credential=staff,extra={})=>adapter.spaceCommand({command,input,credential,...extra});
    await call('createSpace',{spaceId,name:'Espace recette fictive',expectedRevision:0},staff,{humanVerificationToken:`voti-local-test.${Date.now()}.${crypto.randomUUID()}`});
    const revision=async()=>(await call('getSpace',{spaceId})).revision;
    const cards=[];for(const displayName of ['A fictif','B fictif']){const credential=createSpaceCredential('member');await call('createMember',{spaceId,memberId:crypto.randomUUID(),displayName,groupIds:[],memberCredential:credential,expectedRevision:await revision()});cards.push({credential,displayName,spaceName:'Espace recette fictive'});}
    const polls=[];for(const identity of ['anonymous','identified','anonymous']){const poll=createPoll(emptyState(),{question:'Recette Carte '+identity,choices:['Forêt','Cinéma'],participationIdentityMode:identity,resultRules:{minimumResponses:1}}).polls[0];
      await call('prepareSpacePublication',{spaceId,poll,pollAudience:{spaceId,mode:'space',groupIds:[],resultsAudience:'poll_audience'},expectedRevision:await revision()});await call('publishSpacePoll',{pollId:poll.id,expectedRevision:0});polls.push(poll);}
    return{spaceId,cards,polls,staff};
  }
  if(stage==='home'){
    await wait(()=>text().includes('Mon espace')&&text().includes('A fictif'));
    ok(!location.hash.includes('voti-member-'),'secret retiré du fragment');
    ok(!sessionStorage.length,'aucun stockage de session');
    ok(!Object.values(localStorage).some(value=>fixture.cards.some(c=>value.includes(c.credential)||value.includes(c.displayName))),'carte et nom non persistés');
    ok(getComputedStyle(document.querySelector('.main-nav')).visibility==='hidden','navigation de gestion hors parcours enfant');
    ok(!app.querySelector('a[href^="#space/"]'),'carte sans administration');
    return checks;
  }
  if(stage==='attemptManagement'){
    location.hash='#space/'+fixture.spaceId;await wait(()=>text().includes('Participation terminée'));
    ok(!text().includes('Administrateur de l’Espace')&&!text().includes('A fictif'),'carte participant ne bascule jamais vers gestion');return checks;
  }
  if(stage==='badCard'){
    await wait(()=>text().includes('Scanner ma Carte Voti'));ok(!text().includes('A fictif')&&!text().includes('B fictif'),'mauvaise carte : aucun profil conservé');ok(!location.hash.includes('voti-member-v1.'),'mauvaise carte : URL expurgée');return checks;
  }
  if(stage==='qr'){
    location.hash=`#/p/${fixture.polls[0].id}/choice/${fixture.polls[0].definition.choices[0].id}`;
    await wait(()=>text().includes('Tu choisis : Forêt'));
    ok(!app.querySelector('.vote-choices'),'confirmation directe QR');ok(!app.querySelector('[data-testid=display-name]'),'aucune identité anonyme');
    ok(app.querySelector('.recognized-member')?.textContent.includes('A fictif'),'pseudo de la carte reconnu en mémoire avant vote');
    ok(app.querySelector('[data-testid=vote-comment]'),'commentaire facultatif');ok(text().includes('N’écris pas ton nom'),'notice anonyme');
    for(const theme of ['pop','nature','douceur','dark','minimal']){document.documentElement.dataset.theme=theme;ok(document.documentElement.scrollWidth<=innerWidth,'aucun débordement '+theme);for(const b of app.querySelectorAll('button'))ok(b.getBoundingClientRect().height>=44,'cible tactile');}
    return checks;
  }
  if(stage==='vote'){
    const comment=app.querySelector('[data-testid=vote-comment]');comment.value='<img onerror="window.votiSpaceXss=true"> Essai fictif 😊';comment.dispatchEvent(new Event('input',{bubbles:true}));
    const b=click('Oui, je confirme');b.click();await wait(()=>text().includes('Ton vote a bien été enregistré.'));
    ok(text().includes('Ton commentaire a aussi été envoyé.'),'succès complet');ok(!text().includes('A fictif')&&!window.votiSpaceXss,'identité et texte de formulaire oubliés');
    window.dispatchEvent(new StorageEvent('storage',{key:'voti.local.v1'}));await new Promise(requestAnimationFrame);ok(text().includes('Ton vote a bien été enregistré.'),'succès durable');
    ok(!app.querySelector('textarea,input'),'aucun formulaire conservé');
    click('Participant suivant');await wait(()=>text().includes('Scanner ma Carte Voti'));ok(!text().includes('A fictif'),'appareil neutre pour B');return checks;
  }
  if(stage==='photo'){
    click('Scanner ma Carte Voti');await wait(()=>document.querySelector('dialog[open] input[type=file]'));
    const {createQrMatrix,renderQrCanvas}=await import('voti/web/qr.js'),{buildMemberUrl}=await import('voti/shared/spaces.js');
    const canvas=renderQrCanvas(createQrMatrix(buildMemberUrl(location.origin+location.pathname,fixture.cards[1].credential)),8),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const dt=new DataTransfer();dt.items.add(new File([blob],'carte-fictive.png',{type:'image/png'}));const input=document.querySelector('dialog input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));canvas.width=canvas.height=1;
    await wait(()=>text().includes('Choisis une réponse'));ok(!document.querySelector('dialog[open]'),'photo QR décodée localement et dialogue fermé');
    ok(!text().includes('A fictif'),'carte B remplace identité temporaire');app.querySelector('input[type=radio]').click();click('Continuer');await wait(()=>text().includes('Tu choisis :'));return checks;
  }
  if(stage==='identified'){
    await wait(()=>text().includes('Mon espace'));location.hash=`#/p/${fixture.polls[1].id}/choice/${fixture.polls[1].definition.choices[1].id}`;await wait(()=>text().includes('Tu choisis : Cinéma'));
    ok(!app.querySelector('[data-testid=display-name]'),'nom fourni par carte sans saisie');ok(text().includes('associée à ta Carte Voti'),'identifié explicite');
    ok(text().includes('Voti ne vérifie pas cette identité'),'identité non vérifiée');click('Oui, je confirme');await wait(()=>text().includes('Ton vote a bien été enregistré.'));return checks;
  }
  if(stage==='privacyRace'){
    await wait(()=>text().includes('Mon espace'));location.hash=`#/p/${fixture.polls[2].id}/choice/${fixture.polls[2].definition.choices[0].id}`;await wait(()=>text().includes('Tu choisis : Forêt'));ok(text().includes('Ton commentaire est anonyme'),'consentement initial anonyme');
    const {HttpRelayAdapter}=await import('voti/web/http-relay.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js'),adapter=new HttpRelayAdapter(RELAY_CONFIG);
    const p=(await adapter.spaceCommand({command:'getSpacePoll',input:{pollId:fixture.polls[2].id},credential:fixture.staff})).poll;
    await adapter.spaceCommand({command:'updateSpacePoll',input:{pollId:fixture.polls[2].id,definition:{...p.definition,privacy:'named',participationIdentityMode:'identified'},resultRules:p.resultRules,pollAudience:p.accessRules.pollAudience,expectedRevision:p.remoteRef.revision},credential:fixture.staff});
    click('Oui, je confirme');await wait(()=>text().includes('Ce sondage est identifié.')&&document.getElementById('notice').textContent.includes('Aucun vote envoyé'));ok(document.getElementById('notice').textContent.includes('Aucun vote envoyé'),'changement de confidentialité : consentement à refaire');ok(!text().includes('Ton vote a bien été enregistré.'),'aucun faux succès');return checks;
  }
  if(stage==='privacyConfirm'){click('Oui, je confirme');await wait(()=>text().includes('Ton vote a bien été enregistré.'));ok(!text().includes('A fictif'),'confirmation renouvelée : identité ensuite oubliée');return checks;}
  if(stage==='expiry'){
    await wait(()=>text().includes('Mon espace'));const now=Date.now;try{Date.now=()=>now()+300001;window.dispatchEvent(new StorageEvent('storage',{key:'voti.local.v1'}));await wait(()=>text().includes('Scanner ma Carte Voti'));ok(!text().includes('A fictif')&&!text().includes('B fictif'),'expiration : profil effacé');ok(!sessionStorage.length,'expiration sans session persistée');}finally{Date.now=now;}return checks;
  }
  if(stage==='pdf'){
    const {memberCardsPdf}=await import('voti/web/member-cards.js');const cards=[...fixture.cards];while(cards.length<9)cards.push({...cards[0],displayName:'Pseudo fictif étendu '+cards.length});
    cards[8]={...cards[8],displayName:[...'Étoile fictive 😊 été '.repeat(4)].slice(0,60).join(''),spaceName:[...'Espace fictif Nature et découvertes — édition été '.repeat(3)].slice(0,100).join('')};
    const blob=await memberCardsPdf(cards,location.origin+location.pathname),bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return{base64:btoa(raw),cards:cards.map(c=>({url:location.origin+location.pathname+'#/member/'+c.credential}))};
  }
  if(stage==='localDeletion'){
    const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js'),{emptyState}=await import('voti/shared/model.js');const value=createPoll(emptyState(),{question:'Copie fictive à supprimer',choices:['Oui','Non']});const id=value.polls[0].id;localStorage.setItem('voti.local.v1',JSON.stringify(publishPoll(value,id)));window.dispatchEvent(new StorageEvent('storage',{key:'voti.local.v1'}));location.hash='#poll/'+id;
    await wait(()=>text().includes('Supprimer de cet appareil'));const trigger=click('Supprimer de cet appareil');await wait(()=>document.querySelector('dialog[open]'));document.querySelector('dialog button').click();ok(JSON.parse(localStorage.getItem('voti.local.v1')).polls.length===1,'annulation conserve copie');
    trigger.click();await wait(()=>document.querySelector('dialog[open]'));const action=[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Supprimer de cet appareil');action.click();await wait(()=>location.hash==='#home');await wait(()=>JSON.parse(localStorage.getItem('voti.local.v1')).polls.length===0);ok(true,'copie locale supprimable sans serveur');return checks;
  }
  throw new Error('Étape Espaces inconnue');
}
