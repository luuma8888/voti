import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Renderers et routeur réels, relais simulé en mémoire, jamais de production.
export async function layoutFixture(){
  const {SpacesUI}=await import('voti/web/spaces-ui.js');
  const {HttpRelayAdapter}=await import('voti/web/http-relay.js');
  const {SpaceAccessStorage}=await import('voti/web/space-storage.js');
  const {RELAY_CONFIG}=await import('voti/web/relay-config.js');
  const {createSpaceCredential}=await import('voti/shared/spaces.js');
  const {createPoll,publishPoll}=await import('voti/shared/poll-engine.js');
  const {emptyState}=await import('voti/shared/model.js');
  const spaceId='00000000-0000-4000-8000-000000000001';
  const state=createPoll(emptyState(),{question:'Quelle activité vendredi ?',choices:['Parc','Cinéma','Jeux'],commentMode:'disabled',resultRules:{minimumResponses:2}});
  const poll=publishPoll(state,state.polls[0].id).polls[0];
  poll.remoteRef={pollId:poll.id,revision:0};poll.locked=false;
  poll.accessRules.pollAudience={spaceId,mode:'space',groupIds:[],resultsAudience:'poll_audience'};
  poll.results={available:false,totalBallots:0,choices:[]};
  const data={spaceId,name:'La Cabane Voti',status:'active',revision:0,access:{role:'admin',groupIds:null},groups:[],members:[],polls:[],invitations:[],staffAccesses:[]};
  const accesses=new SpaceAccessStorage(localStorage);
  if(!accesses.get(RELAY_CONFIG.relayId,spaceId))await accesses.put({relayId:RELAY_CONFIG.relayId,spaceId,credential:createSpaceCredential('staff')});
  HttpRelayAdapter.prototype.spaceCommand=async function({command}){
    await new Promise(r=>setTimeout(r,80));
    if(command==='getSpace')return data;
    if(command==='getSpacePoll')return{poll};
    if(command==='getPollAttendance')return{consumed:0,eligible:3,identityMode:'anonymous'};
    throw new Error('Commande inattendue : '+command);
  };
  HttpRelayAdapter.prototype.getParticipations=async()=>({items:[],entries:[],nextCursor:null});
  window.__layoutFixture={spaceId,poll,SpacesUI};
  window.__layoutFrames=[];let running=true;
  const sample=()=>{if(!running)return;const r=document.querySelector('main').getBoundingClientRect();window.__layoutFrames.push({x:r.x,width:r.width,viewport:document.body.clientWidth});requestAnimationFrame(sample);};sample();
  window.__stopLayout=()=>{running=false;};
  return{spaceId,pollId:poll.id};
}

export async function layoutScene(scene){
  const {spaceId,poll,SpacesUI}=window.__layoutFixture,app=document.getElementById('app');
  const wait=async fn=>{const end=Date.now()+6000;while(!fn()){if(Date.now()>end)throw new Error('Layout écran absent '+scene+': '+app.textContent.slice(0,160));await new Promise(requestAnimationFrame);}};
  if(['space','management','editing','results','home','card'].includes(scene)){
    const hash=scene==='space'?`#space/${spaceId}`:['management','editing'].includes(scene)?`#space/${spaceId}/poll/${poll.id}`:scene==='results'?`#space/${spaceId}/poll/${poll.id}/results`:scene==='card'?'#member':'#home';
    location.hash=hash;
    await wait(()=>app.getAttribute('aria-busy')==='false'&&(scene==='space'?app.querySelector('.space-workspace'):['management','editing'].includes(scene)?app.querySelector('.space-poll-management'):scene==='results'?app.querySelector('.space-results-state'):scene==='card'?app.querySelector('.card-prompt-intro'):app.querySelector('.home-welcome')));
    if(scene==='editing')app.querySelector('.poll-edit').open=true;
  }else{
    const {defaultDesign}=await import('voti/web/poster-design.js');
    const ui=Object.assign(Object.create(SpacesUI.prototype),{posters:{get:()=>defaultDesign()},app,epoch:0,session:{credential:'fixture-layout-in-memory',clear(){this.credential=null;}},profile:{displayName:'Soleil A'},clearError:()=>{},notify:()=>{}});
    if(scene==='member-home'){ui.profile={displayName:'Soleil A',space:{name:'La Cabane Voti'},groups:[{name:'Soleil'}],polls:[{pollId:poll.id,question:poll.definition.question,status:'published'}]};ui.memberHome();}
    if(scene==='vote')ui.participantPoll(poll);
    if(scene==='confirm')ui.confirmVote(poll,poll.definition.choices[0].id,false);
    if(scene==='success')ui.success(poll.id,false);
    if(scene==='available')await ui.showResults({...poll,results:{available:true,totalBallots:2,choices:poll.definition.choices.map((c,i)=>({...c,count:i<2?1:0,percentage:i<2?50:0}))}},null);
  }
  for(const img of app.querySelectorAll('.mascot'))await img.decode();
  await new Promise(requestAnimationFrame);
  const shell=document.querySelector('main').getBoundingClientRect();
  if(document.documentElement.scrollWidth>innerWidth)throw new Error('Débordement '+scene+' à '+innerWidth);
  if(Math.abs(shell.width-Math.min(document.body.clientWidth,1760))>1)throw new Error('Shell étroit '+scene);
  for(const n of app.querySelectorAll('button,input,select,fieldset,.poll-state-panel,.poll-results-action')){
    if(!n.getClientRects().length||getComputedStyle(n).clipPath==='inset(50%)'||n.classList.contains('sr-only')||n.closest('.filter-chips'))continue;
    const r=n.getBoundingClientRect();if(r.right>innerWidth+1||r.left<0)throw new Error('Contrôle hors cadre '+scene+' '+n.outerHTML.slice(0,180)+' '+JSON.stringify({left:r.left,right:r.right,width:innerWidth}));
  }
  if(scene==='management'&&innerWidth>=1000){const a=app.querySelector('.poll-state-panel').getBoundingClientRect(),b=app.querySelector('.poll-results-action').getBoundingClientRect();if(b.left<a.right||Math.abs(a.top-b.top)>1)throw new Error('Gestion non composée');}
  if(scene==='vote'&&app.querySelector('form').getBoundingClientRect().width>801)throw new Error('Lecture vote trop large');
  return{scene,width:innerWidth,shell:shell.width};
}

export async function runLayoutConsistency({command,evaluate,navigateReady,startDevServer,sessionId,runtimeErrors}){
  const dir=resolve('.browser-tests/layout-consistency');await mkdir(dir,{recursive:true});
  await startDevServer();const base='http://127.0.0.1:4173/voti/';
  const shot=async name=>{await evaluate(sessionId,'scrollTo(0,0)');const {data}=await command('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(resolve(dir,name+'.png'),Buffer.from(data,'base64'));};
  const results=[];
  for(const width of [390,768,1200,1440,1920]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390},sessionId);
    await navigateReady(sessionId,base+'?width='+width+'#home');await evaluate(sessionId,`(${layoutFixture.toString()})()`);
    for(const scene of ['home','space','management','editing','results','card','member-home','vote','confirm','success','available','space']){
      results.push(await evaluate(sessionId,`(${layoutScene.toString()})(${JSON.stringify(scene)})`));
      if(width===1440&&['space','management','card','vote'].includes(scene))await shot(scene+'-1440');
      if(width===390&&['management','card'].includes(scene))await shot(scene+'-390');
    }
    const frames=await evaluate(sessionId,'__stopLayout();__layoutFrames');
    assert(frames.length>0&&frames.every(f=>Math.abs(f.width-Math.min(f.viewport,1760))<1),'géométrie stable pendant SPA');
    assert(Math.max(...frames.map(f=>f.width))-Math.min(...frames.map(f=>f.width))<1,'largeur identique pendant SPA');
  }
  // Le HTML initial est réellement peint avec JS suspendu : pas un loader reconstruit.
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
  for(const [name,hash]of [['home','#home'],['space','#space/00000000-0000-4000-8000-000000000001'],['management','#space/00000000-0000-4000-8000-000000000001/poll/00000000-0000-4000-8000-000000000002'],['card','#member']]){
    await command('Emulation.setScriptExecutionDisabled',{value:true},sessionId);
    await command('Page.navigate',{url:base+'?initial='+name+hash},sessionId);await new Promise(r=>setTimeout(r,200));await shot('initial-'+name+'-1440');
    await command('Emulation.setScriptExecutionDisabled',{value:false},sessionId);
    assert(await evaluate(sessionId,"Math.abs(document.querySelector('main').getBoundingClientRect().width-document.body.clientWidth)<1"));
    await navigateReady(sessionId,base+'?resume='+name+'#home');
  }
  assert.equal(runtimeErrors.length,0);
  await writeFile(resolve(dir,'results.json'),JSON.stringify({results,initialPaints:4,runtimeErrors:0,notes:'SPA via routeur réel + adaptateur fictif ; HTML initial sans JS ; les refreshs Espace sans accès valide ne testent pas le backend.'},null,2));
  console.log('Layout : '+results.length+' écrans / 5 largeurs, 4 premiers rendus, géométrie stable.');
}

/** Refreshs authentifiés sur le Worker D1 de test existant (aucune production). */
export async function checkLiveLayoutRefresh({command,evaluate,navigateReady,sessionId,fixture}){
  await evaluate(sessionId,`(async()=>{const{SpaceAccessStorage}=await import('voti/web/space-storage.js'),{RELAY_CONFIG}=await import('voti/web/relay-config.js');const store=new SpaceAccessStorage(localStorage),spaceId=${JSON.stringify(fixture.spaceId)},credential=${JSON.stringify(fixture.staff)};await store.put({relayId:RELAY_CONFIG.relayId,spaceId,credential},store.get(RELAY_CONFIG.relayId,spaceId)?.credential);})()`);
  const {identifier}=await command('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__shellSamples=[];
    const sample=()=>{const main=document.querySelector('main');if(main){const r=main.getBoundingClientRect();window.__shellSamples.push({width:r.width,x:r.x,viewport:document.body.clientWidth,loader:main.textContent.includes('Chargement de Voti')});}requestAnimationFrame(sample);};requestAnimationFrame(sample);
  `},sessionId);
  let checks=0;
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false},sessionId);
  for(let repeat=0;repeat<3;repeat++)for(const [name,hash,selector]of [
    ['home','#home','.home-welcome'],
    ['space','#space/'+fixture.spaceId,'.space-workspace'],
    ['management','#space/'+fixture.spaceId+'/poll/'+fixture.polls[0],'.space-poll-management'],
    ['card','#member','.card-prompt-intro']
  ]){
    await navigateReady(sessionId,'http://127.0.0.1:4173/voti/?refresh='+repeat+'-'+name+hash);
    assert(await evaluate(sessionId,`Boolean(document.querySelector(${JSON.stringify(selector)}))`),'refresh vers écran réel '+name);
    const samples=await evaluate(sessionId,'__shellSamples');assert(samples.length>0&&samples.every(r=>Math.abs(r.width-Math.min(r.viewport,1760))<1&&Math.abs(r.x)<1),'aucun shell étroit pendant refresh '+name);assert(Math.max(...samples.map(r=>r.width))-Math.min(...samples.map(r=>r.width))<1,'pas de saut au refresh '+name);checks++;
  }
  await command('Page.removeScriptToEvaluateOnNewDocument',{identifier},sessionId);
  console.log('Layout : '+checks+' refreshs authentifiés stables, Worker/D1 local.');return checks;
}
