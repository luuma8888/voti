import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

/** Rendus réels, données fictives ; aucun relais ou credential de production. */
export async function mascotStage(scene){
  const app=document.getElementById('app');let checks=0;
  const ok=(value,message)=>{if(!value)throw new Error('Mascotte : '+message);checks++;};
  const wait=async predicate=>{for(let i=0;i<240;i++){if(predicate())return;await new Promise(requestAnimationFrame);}throw new Error('Écran mascotte attendu : '+scene);};
  const click=text=>{const b=[...app.querySelectorAll('button')].find(b=>b.textContent===text);ok(b,'action '+text);b.click();};
  const go=async hash=>{delete document.body.dataset.spaceManagement;delete document.body.dataset.votiRole;location.hash=hash;window.dispatchEvent(new HashChangeEvent('hashchange'));await new Promise(requestAnimationFrame);await wait(()=>app.getAttribute('aria-busy')==='false'&&(hash==='#home'?app.querySelector('.home-welcome'):hash==='#member'?app.textContent.includes('Scanner ma Carte Voti'):app.querySelector('form')));};
  const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js'),{emptyState}=await import('voti/shared/model.js');
  if(scene==='seed'){
    const draft=createPoll(emptyState(),{question:'Quelle activité vendredi ?',choices:['Parc','Cinéma','Jeux'],commentMode:'disabled'}),state=publishPoll(draft,draft.polls[0].id);
    localStorage.setItem('voti.local.v1',JSON.stringify(state));window.dispatchEvent(new StorageEvent('storage',{key:'voti.local.v1'}));window.__mascotPoll=state.polls[0];await go('#home');await wait(()=>app.querySelectorAll('.poll-row').length===1);
  }else if(scene==='home'||scene==='ordinary')await go(scene==='home'?'#home':'#new');
  else if(scene==='home-empty'){
    localStorage.setItem('voti.local.v1',JSON.stringify(emptyState()));window.dispatchEvent(new StorageEvent('storage',{key:'voti.local.v1'}));await go('#home');await wait(()=>app.querySelector('.empty-library'));
  }else if(scene.startsWith('empty-')||scene==='filled-members'||scene==='space-success'){
    const {SpacesUI}=await import('voti/web/spaces-ui.js'),{TemporaryMemberSession,createSpaceCredential}=await import('voti/shared/spaces.js');
    const ui=Object.assign(Object.create(SpacesUI.prototype),{app,epoch:0,session:new TemporaryMemberSession(),config:{relayId:'mascot-test'},adapter:null,issued:[],cardSelection:null,cardBatchResult:null,cardsVersion:0,cardsClearVersion:0,profile:null,shell:null,outcome:null,clearError:()=>{},notify:()=>{},error:e=>{throw e;}});
    window.__mascotUi=ui;app.replaceChildren();delete document.body.dataset.votiRole;
    if(scene==='space-success'){
      delete document.body.dataset.spaceManagement;
      const draft=createPoll(emptyState(),{question:'Quelle activité vendredi ?',choices:['Parc','Cinéma','Jeux'],commentMode:'disabled'}),state=publishPoll(draft,draft.polls[0].id);
      const poll=state.polls[0];poll.remoteRef={pollId:poll.id,revision:0};let writes=0;
      ui.adapter={spaceCommand:async request=>{ok(request.command==='castMemberVote','seul envoi fictif attendu');writes++;return {};}};
      ui.session.set(createSpaceCredential('member'));ui.profile={displayName:'Soleil A'};
      ui.participantPoll(poll);ok(!app.querySelector('.mascot'),'pas de mascotte après reconnaissance');
      app.querySelector('input[type=radio]').click();click('Continuer');ok(writes===0,'aucun vote au choix');click('Oui, je confirme');
      await wait(()=>app.querySelector('.vote-success-intro'));ok(writes===1,'un seul vote confirmé');
      ok(ui.session.credential===null&&ui.profile===null&&!app.textContent.includes('Soleil A'),'identité oubliée');
      ok(![localStorage,sessionStorage].some(s=>JSON.stringify(s).includes('voti-member-v1.')),'aucun credential participant persisté');
      ok(app.querySelector('a[href="#home"]')&&[...app.querySelectorAll('button')].some(b=>b.textContent==='Participant suivant'),'sorties conservées');
    }else{
      document.body.dataset.spaceManagement='true';
      const data={spaceId:'00000000-0000-4000-8000-000000000001',name:'La Cabane Voti',status:'active',revision:0,access:{role:'admin',groupIds:null},groups:[],members:[],polls:[],invitations:[],staffAccesses:[]};
      const section=scene==='filled-members'?'members':scene.slice(6);
      if(scene==='filled-members')data.members.push({member_id:'00000000-0000-4000-8000-000000000002',display_name:'Soleil A',groupIds:[],status:'active',has_card:true});
      const before=JSON.stringify(data);ui.space(data,section);
      ok(JSON.stringify(data)===before,'aucune mutation des données par le rendu');
      if(scene.startsWith('empty-')){
        ok(app.querySelector('.mascot-empty-state .mascot-empty'),'posture état vide');
        ok(app.querySelector('.space-section-heading a.primary'),'action de création conservée');
      }else ok(!app.querySelector('.mascot'),'pas de mascotte dans une liste remplie');
    }
  }else if(scene==='card')await go('#member');
  else if(scene==='scanner'){
    if(!document.querySelector('.member-scanner[open]'))click('Scanner ma Carte Voti');await wait(()=>document.querySelector('.member-scanner[open]'));
    const dialog=document.querySelector('.member-scanner');ok(!dialog.querySelector('.mascot'),'aucune mascotte dans la caméra');
    ok(getComputedStyle(app.querySelector('.mascot-card-scan')).visibility==='hidden','illustration effacée pendant le scan');
    for(const text of ['Scanner avec la caméra','Choisir un fichier'])ok(dialog.textContent.includes(text),'scan accessible : '+text);
    return checks;
  }else if(scene==='free-success'){
    await go('#vote/'+window.__mascotPoll.id);app.querySelector('input[type=radio]').click();click('Continuer');click('Oui, je confirme');
    await wait(()=>app.querySelector('.vote-success'));
    ok(JSON.parse(localStorage.getItem('voti.local.v1')).ballots.length===1,'vote libre enregistré une fois');
    ok(app.querySelector('.vote-success .mascot-success')&&app.querySelectorAll('.vote-success .actions a').length===2,'confirmation libre et sorties conservées');
  }else if(scene==='next'){
    click('Participant suivant');await wait(()=>app.textContent.includes('Scanner ma Carte Voti'));ok(window.__mascotUi.outcome===null,'participant suivant neutre');
  }
  for(const image of app.querySelectorAll('.mascot'))await image.decode();
  ok(document.documentElement.scrollWidth<=innerWidth,'aucun scroll horizontal');
  for(const image of app.querySelectorAll('.mascot')){
    const r=image.getBoundingClientRect();ok(r.width>0&&r.left>=0&&r.right<=innerWidth,'image entière dans la largeur');
    ok(r.height<=175&&getComputedStyle(image).padding==='0px'&&getComputedStyle(image).borderTopWidth==='0px','illustration sans cadre ou padding de conteneur');
    ok(image.alt===''&&image.getAttribute('aria-hidden')==='true'&&!image.closest('a,button')&&!image.hasAttribute('tabindex'),'illustration décorative');
    ok(getComputedStyle(image).objectFit==='contain','ratio préservé');
    ok(getComputedStyle(image).animationName==='none','image fixe');
  }
  if(['home','home-empty','seed'].includes(scene)){
    ok(app.querySelectorAll('.mascot').length===1,'une seule mascotte sur l’accueil');
    ok(!app.querySelector('.poll-list .mascot'),'pas de mascotte dans les lignes');
    for(const hash of ['#spaces','#member']){
      const a=app.querySelector('a[href="'+hash+'"]'),r=a.getBoundingClientRect();
      ok(r.height>=44&&r.bottom<innerHeight-(innerWidth<680?70:0),'action prioritaire immédiatement visible '+hash);
      const image=app.querySelector('.mascot').getBoundingClientRect();
      ok(r.right<=image.left||r.left>=image.right||r.bottom<=image.top||r.top>=image.bottom,'action sans chevauchement');
    }
    const create=[...document.querySelectorAll('a[href="#new"]')].some(a=>{const r=a.getBoundingClientRect();return r.height>=44&&r.top>=0&&r.bottom<=innerHeight;});ok(create,'Nouveau sondage accessible');
  }
  if(scene==='ordinary')ok(!app.querySelector('.mascot'),'pas de mascotte dans la création');
  if(scene==='card'){
    ok(app.querySelectorAll('.mascot-card-scan').length===1,'posture carte en attente');
    const b=[...app.querySelectorAll('button')].find(b=>b.textContent==='Scanner ma Carte Voti');ok(b.getBoundingClientRect().bottom<innerHeight-70,'scan au-dessus de la navigation');
  }
  return checks;
}

export async function runMascotReview({command,evaluate,navigateReady,startDevServer,sessionId,url,requests,runtimeErrors}){
  const dir=resolve('.browser-tests/mascot-review');await mkdir(dir,{recursive:true});let checks=0;
  const stage=async scene=>{checks+=await evaluate(sessionId,`(${mascotStage.toString()})(${JSON.stringify(scene)})`);};
  const shot=async name=>{await evaluate(sessionId,"window.scrollTo(0,0)");await new Promise(r=>setTimeout(r,50));const r=await command('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(resolve(dir,name+'.png'),Buffer.from(r.data,'base64'));};
  // Le HTML distribué et les assets relatifs fonctionnent aussi depuis un dossier local.
  await stage('seed');await stage('card');await stage('ordinary');
  await startDevServer();await navigateReady(sessionId,'http://127.0.0.1:4173/voti/#home');await stage('seed');
  const first=requests.filter(u=>u.startsWith('http://127.0.0.1:4173/voti/assets/branding/mascots/'));
  assert(first.length>0&&first.every(u=>u.includes('/mascot-welcome-')),'seule la posture d’accueil est chargée au départ');checks++;
  for(const width of [390,768,1200,1440]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:900,deviceScaleFactor:1,mobile:width===390},sessionId);
    for(const scene of ['home','empty-members','empty-groups','empty-polls','card','space-success']){
      await stage(scene);
      if(scene==='home'&&[390,1440].includes(width))await shot('home-'+width);
      if(scene==='empty-members'&&width===1200)await shot('empty-members-1200');
      if(scene==='card'&&width===390)await shot('card-prompt-390');
      if(scene==='space-success'&&width===390)await shot('vote-success-390');
      if(scene==='space-success')await stage('next');
    }
    await stage('filled-members');await stage('ordinary');
  }
  await stage('free-success');
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},sessionId);
  await stage('home-empty');await stage('card');
  await evaluate(sessionId,"[...document.querySelectorAll('#app button')].find(b=>b.textContent==='Scanner ma Carte Voti').focus()");
  for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13},sessionId);
  await stage('scanner');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
  assert(await evaluate(sessionId,"!document.querySelector('.member-scanner[open]')"));checks++;
  for(const theme of ['pop','nature','douceur','dark','minimal']){await evaluate(sessionId,`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await stage('home');}
  const mascotRequests=requests.filter(u=>u.includes('/assets/branding/mascots/'));
  assert(mascotRequests.length>0);assert(mascotRequests.every(u=>u.startsWith('file:')||u.startsWith('http://127.0.0.1:4173/')));
  assert.equal(runtimeErrors.length,0);assert(requests.every(u=>!/^https?:/.test(u)||u.startsWith('http://127.0.0.1:4173/')));
  const result={checks,breakpoints:[390,768,1200,1440],captures:5,runtimeErrors:0,externalRequests:0,fixtures:'fictives en mémoire, rendu et soumission UI réels ; adapter local simulé, sans D1'};
  await writeFile(resolve(dir,'results.json'),JSON.stringify(result,null,2));console.log('Mascotte : '+JSON.stringify(result));
}
