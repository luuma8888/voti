/** Fonctions sérialisables exécutées dans les contextes Chromium isolés. */
export async function graphicFixtures() {
  const { createPoll, publishPoll } = await import('voti/shared/poll-engine.js');
  const { emptyState } = await import('voti/shared/model.js');
  const { IndexedDBAssetAdapter } = await import('voti/web/asset-storage.js');
  const { processImage } = await import('voti/web/image-processing.js');
  const images = new IndexedDBAssetAdapter(), ids = [];
  for (const [w,h] of [[300,600],[600,300]]) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d'); context.fillStyle = '#387d79'; context.fillRect(0,0,w,h);
    context.fillStyle = '#ffe4b1'; context.fillRect(15,15,w-30,h-30);
    const asset = await processImage(await new Promise(resolve => canvas.toBlob(resolve, 'image/png')), 'choice');
    await images.put(asset); ids.push(asset.id);
  }
  let state = emptyState();
  for (const n of [2,3,6]) {
    state = createPoll(state, { question: `Images ${n} choix`, choices: Array.from({length:n}, (_,i)=>`Réponse ${i+1}`),
      pollImageAssetId: ids[n===2?0:1], choiceImageRefs: Array.from({length:n}, (_,i)=>i===n-1?null:ids[i%2]) });
    state = publishPoll(state, state.polls.at(-1).id);
  }
  localStorage.setItem('voti.local.v1', JSON.stringify(state));
  window.dispatchEvent(new StorageEvent('storage', { key:'voti.local.v1' }));
  return state.polls.map(p=>p.id);
}
export async function graphicChecks(id, width) {
  let checks=0; const assert=(v,m)=>{if(!v)throw new Error(m);checks++;};
  const wait=async f=>{const until=performance.now()+10000;while(!f()){if(performance.now()>until)throw new Error('Rendu graphique non prêt');await new Promise(requestAnimationFrame);}};
  location.hash='#vote/'+id;
  await wait(()=>document.querySelector('.vote-choices'));
  await wait(()=>[...document.querySelectorAll('.user-image img')].every(img=>img.naturalWidth>0));
  assert(document.querySelector('.question-block h1') && document.querySelector('.question-block .image-poll'), 'Question et image non regroupées');
  assert(document.querySelector('.illustrated'), 'Choix non illustrés');
  const choices=[...document.querySelectorAll('.vote-choice')];
  assert([2,3,6].includes(choices.length), 'Nombre de choix');
  for(const choice of choices){
    assert(choice.textContent.includes('Réponse'), 'Texte absent');
    assert(choice.querySelector('input[type=radio]'), 'Radio accessible absent');
    if(choice.querySelector('.image-choice')) assert(choice.querySelector('.image-choice').getBoundingClientRect().height>=170, 'Image trop petite');
  }
  assert(choices.some(c=>!c.querySelector('.image-choice')), 'Choix mixte absent');
  for(const theme of ['pop','nature','douceur','dark','minimal']){
    document.documentElement.dataset.theme=theme;
    assert(document.documentElement.scrollWidth<=innerWidth, 'Débordement '+theme+' '+width);
    assert(getComputedStyle(document.querySelector('.question-block img')).objectFit==='contain','Image recadrée');
    const card=document.querySelector('.card[data-accent]'), initialAccent=card.dataset.accent;
    const buttons=[],questions=[];
    for(const accent of ['mint','lavender','peach']){
      card.dataset.accent=accent;
      const palette=getComputedStyle(card),rgb=hex=>'rgb('+hex.trim().slice(1).match(/../g).map(value=>parseInt(value,16)).join(', ')+')';
      const color=rgb(palette.getPropertyValue('--accent')),soft=rgb(palette.getPropertyValue('--soft'));
      buttons.push(getComputedStyle(card.querySelector('.primary')).backgroundColor);
      questions.push(getComputedStyle(card.querySelector('.question-block')).backgroundColor);
      assert(buttons.at(-1)===color && questions.at(-1)===soft,'Accent illustré incohérent '+theme+'/'+accent);
      const radio=card.querySelector('input[type=radio]');radio.checked=true;
      assert(getComputedStyle(radio.closest('.vote-choice')).borderColor===color,'Sélection illustrée hors accent');radio.checked=false;
      assert(document.documentElement.scrollWidth<=innerWidth && card.querySelector('.primary').getBoundingClientRect().height>=44,'Accent responsive '+theme+'/'+accent+' '+width);
    }
    assert(new Set(buttons).size===3 && new Set(questions).size===3,'Accents illustrés non distincts '+theme);
    card.dataset.accent=initialAccent;
  }
  document.documentElement.dataset.theme='pop';
  window.scrollTo(0,document.body.scrollHeight); await new Promise(requestAnimationFrame);
  const bg=getComputedStyle(document.body,'::before');
  assert(bg.position==='fixed' && parseFloat(bg.height)===innerHeight && parseFloat(bg.width)===innerWidth && bg.pointerEvents==='none','Fond ne couvre pas viewport');
  document.querySelector('.vote-choice input').focus();
  assert(document.activeElement.type==='radio', 'Choix non focalisable');
  window.scrollTo(0,0);
  return checks;
}
export async function remoteBrowserAction(action, id, expectImages = true) {
  const wait=async f=>{const until=performance.now()+15000;while(!f()){if(performance.now()>until)throw new Error('Attente distante : '+action+' / '+document.getElementById('app').textContent+' / '+document.getElementById('message').textContent);await new Promise(requestAnimationFrame);}};
  const click=label=>{const node=[...document.querySelectorAll('#app button,#app a')].find(n=>n.textContent===label);if(!node)throw new Error('Action absente '+label);node.click();};
  if(action==='publish') {
    location.hash='#poll/'+id; await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Publier en ligne'));
    click('Publier en ligne'); await wait(()=>[...document.querySelectorAll('a')].some(a=>a.textContent==='Ouvrir le lien public'));
    if(JSON.parse(localStorage.getItem('voti.local.v1')).ballots.length)throw new Error('Bulletin local lors publication');
    return 3;
  }
  if(action==='vote') {
    await wait(()=>document.querySelector('.vote-choice input'));
    if (expectImages) await wait(()=>document.querySelector('.question-block img')?.naturalWidth);
    document.querySelector('.vote-choice input').click(); click('Continuer');
    await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Oui, je confirme'));
    click('Oui, je confirme'); click('Oui, je confirme');
    await wait(()=>document.querySelector('#app h1')?.textContent==='Merci !');
    if(!document.querySelector('.vote-success .mascot') || (JSON.parse(localStorage.getItem('voti.local.v1')||'{"ballots":[]}').ballots.length))throw new Error('Succès distant incorrect');
    const results=[...document.querySelectorAll('#app a')].find(a=>a.textContent==='Résultats');
    if(results?.getAttribute('href')!==`#/p/${id}/results`)throw new Error('Résultats après vote : route locale au lieu du lien public');
    results.click(); await wait(()=>document.querySelector('#app h1')?.textContent==='Les résultats' && document.getElementById('app').getAttribute('aria-busy')==='false');
    if(location.hash!==`#/p/${id}/results` || document.querySelector('#app a[href^="#poll/"]'))throw new Error('Résultats du votant redirigés vers la gestion');
    return 6;
  }
  if(action==='locked') {
    await wait(()=>document.querySelector('#app h1'));
    if([...document.querySelectorAll('a')].some(a=>a.textContent==='Modifier le sondage'))throw new Error('Modification offerte après vote');
    if(!document.getElementById('app').textContent.includes('verrouillé'))throw new Error('Verrouillage absent'); return 2;
  }
  if(action==='closed-cancel' || action==='closed') {
    const control=[...document.querySelectorAll('#app button')].find(b=>b.textContent==='Fermer le sondage');
    control.focus();control.click();
    const dialog=document.querySelector('.confirmation-dialog');
    if(!dialog?.matches(':modal') || dialog.querySelector('h2').textContent!=='Fermer ce sondage ?' || !dialog.textContent.includes('minimum de réponses'))throw new Error('Confirmation fermeture incomplète');
    if(action==='closed-cancel') {
      dialog.querySelector('[data-confirmation=cancel]').click();await wait(()=>document.activeElement===control);
      if(!document.getElementById('app').textContent.includes('Vote ouvert'))throw new Error('Annulation ferme le sondage');
      control.click();document.querySelector('.confirmation-dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      await wait(()=>document.activeElement===control);
      return 4;
    }
    const accept=dialog.querySelector('[data-confirmation=accept]');
    if(accept.textContent!=='Fermer le sondage' || accept.classList.contains('danger'))throw new Error('Fermeture alarmiste ou action ambiguë');
    accept.click();accept.click();
    await wait(()=>document.getElementById('app').textContent.includes('Sondage fermé'));return 3;
  }
  if(action==='closed-public') {
    await wait(()=>document.getElementById('app').textContent.includes('Ce sondage est fermé.') && document.getElementById('app').getAttribute('aria-busy')==='false');
    if(document.querySelector('.vote-choices') || document.querySelector('#app button'))throw new Error('Vote proposé sur sondage fermé');
    const results=[...document.querySelectorAll('#app a')].find(a=>a.textContent==='Résultats');
    if(results?.getAttribute('href')!==`#/p/${id}/results` || !results.classList.contains('primary'))throw new Error('Bouton de résultats fermé absent ou route incorrecte');
    const back=[...document.querySelectorAll('#app a')].find(a=>a.textContent==='Retour');
    if(back?.getAttribute('href')!=='#home' || document.querySelector('#app a[href^="#poll/"]'))throw new Error('Retour public dirigé vers la gestion privée');
    results.focus();
    if(document.activeElement!==results || results.getBoundingClientRect().height<44 || document.documentElement.scrollWidth>innerWidth)throw new Error('Bouton fermé inaccessible ou débordement mobile');
    results.click(); await wait(()=>document.querySelector('#app h1')?.textContent==='Les résultats' && document.getElementById('app').getAttribute('aria-busy')==='false');
    if(location.hash!==`#/p/${id}/results` || !document.getElementById('app').textContent.includes('5 réponses') || document.querySelectorAll('.result-row').length<2)throw new Error('Résultats fermés non accessibles au votant');
    if(document.querySelector('.human-verification') || document.querySelector('script[src*="turnstile"]') || JSON.parse(localStorage.getItem('voti.local.v1')||'{"ballots":[]}').ballots.length)throw new Error('Navigation fermée crée du vote local ou charge Turnstile');
    return 6;
  }
  return 0;
}
