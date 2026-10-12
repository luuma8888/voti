/** Génération hors réseau : bibliothèque/PNG/PDF réels, pas de mock encodeur. */
export async function browserQrScenario() {
  const { createQrMatrix, renderQrCanvas, qrPng } = await import('voti/web/qr.js');
  const { makePosterPlan } = await import('voti/web/poster.js');
  const { sharingPanel } = await import('voti/web/sharing.js');
  const { createPoll, publishPoll } = await import('voti/shared/poll-engine.js');
  const { emptyState } = await import('voti/shared/model.js');
  let checks = 0; const assert = (v, m) => { if (!v) throw new Error(m); checks++; };
  const matrix = createQrMatrix('https://luuma8888.github.io/voti/#/p/09f5d0ce-80d7-4765-a2eb-7a5a651d1f79');
  const canvas = renderQrCanvas(matrix); assert(canvas.width === matrix.size * 8 && canvas.width === canvas.height, 'Dimensions canvas QR');
  const png = await qrPng(matrix); assert(png.type === 'image/png' && png.size > 0, 'PNG QR réel');
  const bitmap = await createImageBitmap(png); assert(bitmap.width === canvas.width, 'PNG QR décodable'); bitmap.close();
  const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  assert(Array.from(pixels).every((value, i) => i % 4 === 3 ? value === 255 : value === 0 || value === 255), 'Pixels QR sans antialiasing');
  const original = document.documentElement.dataset.theme;
  for (const n of [2,3,6]) {
    let state = createPoll(emptyState(), { question:'Quelle activité choisir cet été ?', choices:Array.from({length:n}, (_,i)=>`Réponse ${i+1} : pêche, forêt, cinéma`) });
    state = publishPoll(state, state.polls[0].id);
    const poll = state.polls[0]; poll.remoteRef = { relayId:'voti-test',pollId:poll.id,revision:1 };
    for(const theme of ['pop','nature','douceur','dark','minimal']) {
      document.documentElement.dataset.theme=theme;
      const panel=sharingPanel(poll,{error:e=>{throw e;},notify:()=>{},getAdminKey:async()=>({version:1,relayId:'voti-test',pollId:poll.id,adminCapability:'voti-admin-v1.'+'a'.repeat(64)})});
      document.body.append(panel);
      assert(panel.querySelectorAll('.qr-grid .qr-card').length===n,'Cartes de choix '+n);
      for(const detail of panel.querySelectorAll('details')) detail.open=true;
      assert(panel.querySelector('.secret-qr').hidden && !panel.querySelector('.secret-qr img'),'Secret caché au chargement');
      assert(panel.querySelectorAll('.qr-card .qr-destination').length===n+2,'Destination textuelle de tous les QR publics');
      assert([...panel.querySelectorAll('.qr-card img')].every(img=>img.alt && img.src.startsWith('data:')),'QR locaux avec texte alternatif');
      assert(document.documentElement.scrollWidth<=innerWidth,'Partage sans débordement '+theme+'/'+n+'/'+innerWidth);
      assert([...panel.querySelectorAll('button,.qr-destination')].every(b=>b.getBoundingClientRect().height>=44),'Cibles partage 44 px');
      const reveal=[...panel.querySelectorAll('button')].find(b=>b.textContent==='Afficher le QR secret'); reveal.click();
      const deadline=performance.now()+3000;while(!panel.querySelector('.secret-qr img')){if(performance.now()>deadline)throw new Error('QR secret absent');await new Promise(requestAnimationFrame);}
      assert(!panel.querySelector('.secret-qr').hidden && reveal.textContent==='Masquer','Affichage volontaire du secret');
      assert(!panel.querySelector('.secret-qr a') && !panel.querySelector('.secret-qr button'),'Pas de lien secret/téléchargement accidentel');
      reveal.click();assert(!panel.querySelector('.secret-qr img') && panel.querySelector('.secret-qr').hidden,'Masquer détruit le QR secret');
      if(theme==='pop') {
        const originalClick=HTMLAnchorElement.prototype.click, downloads=[];
        HTMLAnchorElement.prototype.click=function(){downloads.push({url:this.href,name:this.download});};
        try {
          const card=panel.querySelector('.qr-card');
          for(const format of ['PNG','SVG']) {
            const action=[...card.querySelectorAll('button')].find(b=>b.textContent==='Télécharger '+format);action.click();
            const limit=performance.now()+3000;while(downloads.length<1){if(performance.now()>limit)throw new Error('QR non téléchargé');await new Promise(requestAnimationFrame);}
            const file=downloads.shift(), response=await fetch(file.url);
            assert(file.name.endsWith('.'+format.toLowerCase()) && file.name.startsWith('voti-qr-vote-'),'Nom export QR individuel');
            if(format==='PNG') {const bytes=new Uint8Array(await response.arrayBuffer());assert(bytes[0]===137 && bytes[1]===80,'Téléchargement PNG valide');}
            else {const xml=new DOMParser().parseFromString(await response.text(),'image/svg+xml');assert(!xml.querySelector('parsererror') && xml.documentElement.localName==='svg','Téléchargement SVG valide');}
          }
        } finally {HTMLAnchorElement.prototype.click=originalClick;}
      }
      for(const mode of ['access','choices']) assert(makePosterPlan(poll,mode).pages.length<=2,'Plan affiche borné');
      panel.remove();
    }
  }
  document.documentElement.dataset.theme=original;
  return checks;
}

/** Une opération PDF par appel CDP : évite une évaluation monolithique gourmande. */
export async function browserPosterScenario(n, mode, long = false, theme = 'pop') {
  const { generatePoster } = await import('voti/web/poster.js');
  const { createPoll, publishPoll } = await import('voti/shared/poll-engine.js');
  const { emptyState } = await import('voti/shared/model.js');
  let state=createPoll(emptyState(),{question:'Quelle activité choisir cet été ?',choices:Array.from({length:n},(_,i)=>`Réponse ${i+1} : pêche, forêt, cinéma`)});
  state=publishPoll(state,state.polls[0].id);const poll=state.polls[0];poll.remoteRef={relayId:'voti-test',pollId:poll.id,revision:1};
  if(long) {
    poll.definition.question=('Quelle activité apprécier ensemble cet été, à Noël ou après la forêt ? '.repeat(4)).slice(0,240);
    poll.definition.description=('Échanges, pêche, cinéma et jeux : chacun choisit avec attention. '.repeat(20)).slice(0,1000);
    poll.definition.choices.forEach(c=>c.label=('Une réponse très longue avec accents : à, é, ê, ç, œ, Noël, été. '.repeat(2)).slice(0,100));
  }
  const original=document.documentElement.dataset.theme;document.documentElement.dataset.theme=theme;
  try {
    const palette=getComputedStyle(document.documentElement);
    const {bytes,plan}=await generatePoster(poll,mode,{logo:document.querySelector('.brand-icon'),
      accent:theme==='dark'?'#684397':palette.getPropertyValue('--accent').trim(),soft:theme==='dark'?'#eee7f7':palette.getPropertyValue('--soft').trim()});
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-' || JSON.stringify(plan).includes('admin') || !plan.pages.every(p=>p.qrs.every(q=>q.pixels>=5 && q.size>=400)))throw new Error('PDF ou QR publics incorrects');
    if(long && !(plan.pages.length>1 && plan.pages.length<=4))throw new Error('Textes longs non paginés');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {name:`v04a-${long?'long':n}-${mode}.pdf`,theme,checks:long?4:3,base64:btoa(binary),pages:plan.pages.length,
      qrs:plan.pages.map(p=>p.qrs.map(q=>({url:q.url,x:q.x,y:q.y,size:q.size})))};
  } finally {document.documentElement.dataset.theme=original;}
}

/** Route QR choix : chaque étape est observée avant un quelconque vote. */
export async function qrChoiceStage(id, choiceId, stage) {
  const wait=async predicate=>{const end=performance.now()+10000;while(!predicate()){if(performance.now()>end)throw new Error('Route QR choix non prête');await new Promise(requestAnimationFrame);}};
  const click=label=>{const n=[...document.querySelectorAll('#app button')].find(n=>n.textContent===label);if(!n)throw new Error('Action QR absente');n.click();return n;};
  if(stage==='preset') {
    await wait(()=>document.querySelector('.vote-choices'));
    const selected=document.querySelector('.vote-choices input:checked');
    if(selected?.value!==choiceId || !document.querySelector('.qr-preselection')?.textContent.includes('présélectionné'))throw new Error('QR choix non présélectionné');
    if(JSON.parse(localStorage.getItem('voti.local.v1')||'{"ballots":[]}').ballots.length)throw new Error('Bulletin local depuis QR');return 3;
  }
  if(stage==='invalid') {
    await wait(()=>document.querySelector('.vote-choices'));
    if(document.querySelector('.vote-choices input:checked') || !document.querySelector('.qr-preselection')?.textContent.includes('plus disponible'))throw new Error('Choix invalide remplacé automatiquement');return 2;
  }
  if(stage==='continue') {click('Continuer');await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Oui, je confirme'));return 1;}
  if(stage==='confirm') {const b=click('Oui, je confirme');b.click();await wait(()=>document.getElementById('app').textContent.includes('Ton vote a bien été enregistré.'));return 1;}
  if(stage==='closed') {await wait(()=>document.getElementById('app').textContent.includes('Ce sondage est fermé.'));if(document.querySelector('.vote-choices') || document.querySelector('#app button'))throw new Error('QR choix permet vote fermé');return 2;}
}
