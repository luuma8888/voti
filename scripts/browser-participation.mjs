/** Scénario exécuté dans le vrai HTML autonome, exclusivement données fictives. */
export async function browserParticipationScenario() {
  const {createPoll,publishPoll,castVote}=await import('voti/shared/poll-engine.js');
  const {emptyState}=await import('voti/shared/model.js');
  const key='voti.local.v1';let checks=0;
  const assert=(v,m)=>{if(!v)throw new Error('Participation : '+m);checks++;};
  const text=()=>document.getElementById('app').textContent;
  const stored=()=>JSON.parse(localStorage.getItem(key));
  const wait=async f=>{const end=performance.now()+10000;while(!f()){if(performance.now()>end)throw new Error('Participation : attente dépassée');await new Promise(requestAnimationFrame);}};
  const click=label=>{const b=[...document.querySelectorAll('#app button,#app a')].find(b=>b.textContent===label);if(!b)throw new Error('Participation : bouton absent '+label);b.click();return b;};
  const input=(target,value)=>{target.value=value;target.dispatchEvent(new Event('input',{bubbles:true}));};
  const go=async(hash,label)=>{location.hash=hash;await wait(()=>text().includes(label)&&document.getElementById('app').getAttribute('aria-busy')==='false');};
  for(const mode of ['anonymous','identified']) {
    let initial=createPoll(emptyState(),{question:'Sondage fictif '+mode,choices:['Été 😊','Forêt'],participationIdentityMode:mode,commentVisibility:'public_with_results',resultRules:{minimumResponses:1}});
    initial=publishPoll(initial,initial.polls[0].id);const pollId=initial.polls[0].id;
    localStorage.setItem(key,JSON.stringify(initial));window.dispatchEvent(new StorageEvent('storage',{key}));await go('#home','Mes sondages');
    await wait(()=>document.querySelector(`[data-poll-id="${pollId}"]`));
    assert(!document.querySelector('[data-testid=admin-comment-count]'),'zéro commentaire : compteur absent');
    await go('#vote/'+pollId,'Choisis une réponse');document.querySelector('.vote-choices input').click();click('Continuer');
    await wait(()=>document.querySelector('[data-testid=vote-comment]'));
    assert(stored().ballots.length===0,'confirmation avant saisie sans vote');
    assert(document.querySelector('[data-testid=display-name]')!==null=== (mode==='identified'),'champ identité seulement identifié');
    if(mode==='identified') {
      click('Oui, je confirme');await new Promise(requestAnimationFrame);assert(stored().ballots.length===0,'nom obligatoire avant vote');
      input(document.querySelector('[data-testid=display-name]'),'Emma 😊 العربية');
      assert(text().includes('Voti ne vérifie pas cette identité'),'identité déclarée explicite');
    } else assert(text().includes('N’écris pas ton nom')&&text().includes('quelqu’un d’autre'),'avertissement anonyme visible');
    const comment='<img onerror="window.votiXss=true"> 😊 été';input(document.querySelector('[data-testid=vote-comment]'),comment);
    assert(document.getElementById('comment-count').textContent.includes('300'),'compteur accessible');
    for(const theme of ['pop','nature','douceur','dark','minimal']){
      document.documentElement.dataset.theme=theme;
      assert(document.documentElement.scrollWidth<=innerWidth,'pas de débordement '+theme);
      for(const b of document.querySelectorAll('#app button'))assert(b.getBoundingClientRect().height>=44,'cible tactile');
    }
    const confirm=click('Oui, je confirme');confirm.click();await wait(()=>text().includes('Ton commentaire a aussi été envoyé.'));
    assert(stored().ballots.length===1&&stored().comments.length===1,'double clic : une soumission complète');
    assert(stored().participations.length===(mode==='identified'?1:0),'aucune Participation anonyme');
    window.dispatchEvent(new StorageEvent('storage',{key}));await new Promise(requestAnimationFrame);assert(text().includes('Ton vote a bien été enregistré'),'succès durable');
    await go('#home','Mes sondages');assert(document.querySelector('[data-testid=admin-comment-count]')?.dataset.count==='1','accueil créateur : un commentaire');
    await go('#poll/'+pollId,'Ouvrir le vote');await wait(()=>document.querySelector('[data-comment-action=visible]'));
    const answers=document.querySelector('.management-answers'),notice=document.querySelector('.management-lock-notice');
    assert(answers?.querySelector('h2').textContent==='Réponses proposées','réponses titrées');
    assert(!answers.contains(notice)&&notice.compareDocumentPosition(answers)&Node.DOCUMENT_POSITION_FOLLOWING,'message de verrouillage séparé');
    for(const theme of ['pop','nature','douceur','dark','minimal']){
      document.documentElement.dataset.theme=theme;
      assert(document.documentElement.scrollWidth<=innerWidth,'gestion sans débordement '+theme);
      assert(getComputedStyle(answers).borderTopStyle==='solid'&&getComputedStyle(answers).backgroundColor!==getComputedStyle(answers.parentElement).backgroundColor,'bloc visuellement distinct '+theme);
    }
    assert(text().includes(comment)&&!window.votiXss,'admin : texte brut sans XSS');
    document.querySelector('[data-comment-action=visible]').click();await wait(()=>stored().comments[0].moderationStatus==='visible');
    await go('#results/'+pollId,'Les résultats');assert(text().includes(comment),'commentaire approuvé public');
    assert(!document.querySelector('[data-testid=admin-comment-count]'),'aucun compteur administratif dans les résultats');
    assert(!text().includes('Emma 😊 العربية')&&!window.votiXss,'identité jamais dans résultats publics');
    const pdf=document.querySelector('.results-pdf');pdf.open=true;
    const identity=[...pdf.querySelectorAll('input[type=checkbox]')].find(c=>(c.labels?.[0]?.textContent??'').includes('identités'));
    assert(mode==='identified'?identity&&!identity.checked:!identity,'PDF identités OFF par défaut, seulement admin identified');
    if(identity){
      const presentation=[...pdf.querySelectorAll('select')].find(c=>c.querySelector('option[value=report]'));
      presentation.value='report';presentation.dispatchEvent(new Event('change',{bubbles:true}));
      const warning=[...pdf.querySelectorAll('p')].find(p=>p.textContent.startsWith('Ce PDF contiendra'));
      assert(warning.hidden,'identités OFF : avertissement absent');identity.click();assert(!warning.hidden,'identités ON : avertissement immédiatement visible');
      identity.click();assert(warning.hidden,'désactivation : avertissement retiré');
    }
    await go('#poll/'+pollId,'Ouvrir le vote');await wait(()=>document.querySelector('[data-comment-action=delete]'));
    document.querySelector('[data-comment-action=delete]').click();await wait(()=>document.querySelector('dialog[open]'));
    assert(document.querySelector('dialog').textContent.includes('irréversible'),'suppression dialogue explicite');
    [...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Annuler').click();assert(stored().comments.length===1,'annulation sans mutation');
    document.querySelector('[data-comment-action=delete]').click();await wait(()=>document.querySelector('dialog[open]'));
    const remove=[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Supprimer définitivement');remove.click();remove.click();await wait(()=>stored().comments.length===0);
    assert(stored().ballots.length===1,'suppression commentaire garde vote');
    await go('#home','Mes sondages');assert(!document.querySelector('[data-testid=admin-comment-count]'),'commentaire supprimé : compteur absent');
    let several=stored();
    for(let i=0;i<3;i++)several=await castVote(several,{id:crypto.randomUUID(),pollId,choiceId:several.polls[0].definition.choices[0].id,comment:'Fictif '+i,...(mode==='identified'?{displayName:'Fictif'}:{})});
    localStorage.setItem(key,JSON.stringify(several));window.dispatchEvent(new StorageEvent('storage',{key}));
    await wait(()=>document.querySelector('[data-testid=admin-comment-count]')?.dataset.count==='3');assert(true,'plusieurs commentaires : nombre exact');
  }
  document.documentElement.dataset.theme=localStorage.getItem('voti.theme')||'pop';return checks;
}

export async function browserParticipationPdf(mode='anonymous',withIdentity=false) {
  const {createPoll,publishPoll,castVote}=await import('voti/shared/poll-engine.js');
  const {emptyState}=await import('voti/shared/model.js');
  const {getResults}=await import('voti/shared/result-rules.js');
  const {moderateComment,publicComments,administrativeEntries}=await import('voti/shared/participation.js');
  const {defaultDesign}=await import('voti/web/poster-design.js');
  const {makeResultsPlan}=await import('voti/web/print-layout.js');
  const {printMeasure,exportPrintPdf}=await import('voti/web/print-renderer.js');
  let state=createPoll(emptyState(),{question:'Quelles activités pour l’été ? Rapport fictif détaillé',choices:['Été, forêt et cinéma','Jeux coopératifs','Créativité'],participationIdentityMode:mode,commentVisibility:'public_with_results',resultRules:{minimumResponses:1}});
  state=publishPoll(state,state.polls[0].id);const id=state.polls[0].id;
  for(let i=0;i<12;i++) {
    state=await castVote(state,{id:crypto.randomUUID(),pollId:id,choiceId:state.polls[0].definition.choices[i%3].id,
      comment:('Un commentaire fictif avec accents : été, forêt, coopération. '.repeat(5)).slice(0,300),...(mode==='identified'?{displayName:i===0?'Pseudo fictif : Éloïse 😊 العربية':'Pseudo fictif '+(i+1)}:{})});
    state=moderateComment(state,id,state.comments.at(-1).commentId,1,'visible');
  }
  const poll=state.polls[0];poll.remoteRef={relayId:'fixture',pollId:id,revision:1};
  const design=defaultDesign();design.palette=mode==='identified'?'ivory':'lagoon';const measure=printMeasure();
  try {
    const plan=makeResultsPlan(poll,getResults(state,id),design,{style:'report',includeComments:true,comments:publicComments(state,id),
      includeIdentities:withIdentity,adminAuthorized:withIdentity,identities:administrativeEntries(state,id),measure:measure.measure});
    const {bytes}=await exportPrintPdf(plan,{logo:document.querySelector('.brand-icon')});let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const words=plan.pages.flatMap(p=>p.nodes.filter(n=>n.type==='text').flatMap(n=>n.lines)).join(' ');
    if(words.includes('actionId')||words.includes('submissionDigest')||words.includes('voti-admin-v1.')||(!withIdentity&&words.includes('Pseudo fictif')))throw new Error('PDF participation contient une donnée non autorisée');
    return {name:`v05-${mode}-${withIdentity?'identities':'public'}.pdf`,theme:design.palette,pages:plan.pages.length,width:plan.width,height:plan.height,base64:btoa(binary),
      qrs:plan.pages.map(p=>p.qrs.map(q=>({url:q.url,x:q.x,y:q.y,size:q.size}))),items:plan.pages.map(p=>p.items)};
  }finally{measure.release();}
}

export async function remoteParticipationStage(stage,pollId,choiceId) {
  const wait=async f=>{const end=performance.now()+15000;while(!f()){if(performance.now()>end)throw new Error('Participation distante non prête');await new Promise(requestAnimationFrame);}};
  if(stage==='create') {
    const {createPoll}=await import('voti/shared/poll-engine.js');const {emptyState}=await import('voti/shared/model.js');
    const {RelayClient}=await import('voti/shared/relay-client.js');const {HttpRelayAdapter}=await import('voti/web/http-relay.js');
    const {RELAY_CONFIG}=await import('voti/web/relay-config.js');const {LocalStorageRemoteConnectionAdapter}=await import('voti/web/remote-storage.js');
    const state=createPoll(emptyState(),{question:'Test distant fictif identified',choices:['Pomme','Poire'],participationIdentityMode:'identified',commentVisibility:'public_with_results',resultRules:{minimumResponses:1}});
    const poll=state.polls[0],client=new RelayClient(new HttpRelayAdapter(RELAY_CONFIG),new LocalStorageRemoteConnectionAdapter(localStorage,navigator.locks));
    await client.preparePublication(state,poll.id,`voti-local-test.${Date.now()}.${crypto.randomUUID()}`);await client.publishPoll(poll.id);
    localStorage.setItem('voti.local.v1',JSON.stringify(state));window.dispatchEvent(new StorageEvent('storage',{key:'voti.local.v1'}));
    return {id:poll.id,choiceId:poll.definition.choices[0].id};
  }
  const text=()=>document.getElementById('app').textContent;
  if(stage==='fields') {
    await wait(()=>document.querySelector('[data-testid=display-name]')&&document.querySelector('[data-testid=vote-comment]'));
    if(!text().includes('Tu choisis :')||document.querySelector('.vote-choices')||document.querySelector('.human-verification'))throw new Error('QR v0.5 ne doit pas passer par liste/challenge');
    const name=document.querySelector('[data-testid=display-name]'),comment=document.querySelector('[data-testid=vote-comment]');
    name.value='Pseudo distant fictif';name.dispatchEvent(new Event('input',{bubbles:true}));comment.value='<script>non exécuté</script> 😊';comment.dispatchEvent(new Event('input',{bubbles:true}));return 3;
  }
  if(stage==='vote') {
    const button=[...document.querySelectorAll('#app button')].find(b=>b.textContent==='Oui, je confirme');button.click();button.click();
    await wait(()=>text().includes('Ton commentaire a aussi été envoyé.'));
    if(JSON.parse(localStorage.getItem('voti.local.v1')??'{"ballots":[]}').ballots.length)throw new Error('Vote distant copié dans ballot local');
    if(localStorage.getItem('voti.remote.v1')?.includes('Pseudo distant fictif'))throw new Error('Identité dans cache public distant');return 3;
  }
  if(stage==='admin') {
    await wait(()=>document.querySelector('[data-comment-action=visible]'));
    if(!text().includes('Pseudo distant fictif')||!text().includes('<script>non exécuté</script>'))throw new Error('Admin sans identité/commentaire');
    document.querySelector('[data-comment-action=visible]').click();await wait(()=>text().includes('Visible avec les résultats'));return 2;
  }
  if(stage==='public') {
    await wait(()=>document.querySelector('.public-comment'));
    if(text().includes('Pseudo distant fictif')||!text().includes('<script>non exécuté</script>')||document.querySelector('.public-comment script'))throw new Error('Projection publique identity/XSS');return 2;
  }
  throw new Error('Étape participation inconnue.');
}
