import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function modeScene(scene){
 const app=document.getElementById('app'),button=text=>[...app.querySelectorAll('button')].find(b=>b.textContent===text),ok=(c,m)=>{if(!c)throw Error(m);};
 if(scene==='setup'){
  const {SpacesUI}=await import('voti/web/spaces-ui.js'),{createPoll}=await import('voti/shared/poll-engine.js'),{emptyState}=await import('voti/shared/model.js'),{TemporaryMemberSession,createSpaceCredential}=await import('voti/shared/spaces.js');
  const ui=Object.assign(Object.create(SpacesUI.prototype),{app,epoch:0,session:new TemporaryMemberSession(),profile:{displayName:'Soleil A'},clearError:()=>{},notify:()=>{},error:e=>{window.__modeError=e.message;},adapter:{spaceCommand:async r=>{window.__modeWrites++;window.__modePayload=r;if(window.__failModeOnce){window.__failModeOnce=false;throw Error('Réseau fictif indisponible');}return{};}}});
  window.__modeUi=ui;window.__modeBase=createPoll(emptyState(),{question:'Quelle activité vendredi ?',choices:['Parc','Cinéma','Jeux','Piscine','Lecture','Musique'],commentMode:'disabled'}).polls[0];window.__modeWrites=0;
  window.__modeNew=()=>{ui.session.set(createSpaceCredential('member'));ui.profile={displayName:'Soleil A'};};return;
 }
 const ui=window.__modeUi,base=window.__modeBase;
 if(scene==='multiple'||scene==='ranked'){
  window.__modeNew();const poll={...structuredClone(base),status:'published',remoteRef:{pollId:base.id,revision:1}};poll.definition.mode=scene==='multiple'?'multiple_choice':'ranked_choice';poll.definition.voteConfig={version:1,rule:'up_to',limit:5};poll.accessRules.pollAudience={resultsAudience:'poll_audience'};window.__modePoll=poll;ui.participantPoll(poll);
  if(scene==='ranked'){ok(app.textContent.includes('Ton 1er choix'),'rang annoncé avant premier clic');ok(app.querySelectorAll('.rank-progress li').length===5,'progression immédiate');ok(app.textContent.includes('Tu peux en classer moins'),'arrêt anticipé annoncé');}
 }
 if(scene==='bounds'){
  for(const mode of ['multiple_choice','ranked_choice'])for(const rule of ['exact','all']){
   if(mode==='multiple_choice'&&rule==='all')continue;const p=structuredClone(window.__modePoll);p.definition.mode=mode;p.definition.voteConfig={version:1,limit:rule==='all'?6:2,rule};window.__modeNew();ui.participantPoll(p);
   const select=()=>{if(mode==='ranked_choice')app.querySelector('.multi-vote .vote-choice:not(:disabled)').click();else app.querySelector('.multi-vote input:not(:checked):not(:disabled)').click();};
   select();ok(button('Continuer').disabled,'exact/complet incomplet refusé');for(let i=1;i<p.definition.voteConfig.limit;i++)select();ok(!button('Continuer').disabled,'exact/complet prêt');ok(window.__modeWrites===0,'quantité atteinte sans soumission automatique');
  }
 }
 if(scene==='choose-two'){
  if(window.__modePoll.definition.mode==='ranked_choice'){button('Parc').click();button('Cinéma').click();ok(app.textContent.includes('Ton 3e choix'),'prochain rang');}
  else{app.querySelectorAll('input[type=checkbox]')[0].click();app.querySelectorAll('input[type=checkbox]')[1].click();}
  ok(window.__modeWrites===0,'aucune écriture préparatoire');
 }
 if(scene==='review'){
  const next=[...app.querySelectorAll('button')].find(b=>b.textContent==='Continuer'||b.textContent.startsWith('Terminer avec'));ok(!next.disabled,'récapitulatif accessible');next.click();ok(button('Oui, je confirme'),'confirmation distincte');ok(window.__modeWrites===0,'récapitulatif sans écriture');
 }
 if(scene==='submit'){
  button('Oui, je confirme').click();button('Oui, je confirme')?.click();for(let i=0;i<120&&!app.querySelector('.vote-success-intro');i++)await new Promise(requestAnimationFrame);
  ok(window.__modeWrites===1,'un seul envoi malgré double clic');ok(!ui.session.credential&&!ui.profile,'identité effacée');ok(window.__modePayload.command==='castMemberBallot','contrat nouveau dédié');window.__modeWrites=0;
 }
 if(scene==='legacy-qr'){ui.participantPoll(window.__modePoll,base.definition.choices[0].id);ok(app.querySelector('.multi-vote')&&!button('Oui, je confirme')&&app.textContent.includes('ne convient pas'),'ancien QR incompatible ne présélectionne rien');}
 if(scene==='network'){
  window.__failModeOnce=true;button('Oui, je confirme').click();for(let i=0;i<120&&button('Oui, je confirme')?.disabled;i++)await new Promise(requestAnimationFrame);
  const first=JSON.stringify(window.__modePayload);ok(!app.querySelector('.vote-success-intro'),'pas de faux succès');ok(button('Modifier mon classement').disabled&&button('Recommencer mon classement').disabled,'bulletin gelé tant que confirmation incertaine');
  button('Oui, je confirme').click();for(let i=0;i<120&&!app.querySelector('.vote-success-intro');i++)await new Promise(requestAnimationFrame);ok(JSON.stringify(window.__modePayload)===first,'même identifiant et contenu à la reprise');ok(!ui.session.credential,'session effacée après reprise');window.__modeWrites=0;
 }
 if(scene==='reset'){
  button('Recommencer mon classement').click();ok(app.textContent.includes('Ton 1er choix'),'retour premier rang');ok(window.__modeWrites===0,'reset sans écriture');
 }
 if(scene==='results'){
  const {aggregateSelections}=await import('voti/shared/vote-modes.js');const p=window.__modePoll,ids=p.definition.choices.slice(0,2).map(c=>c.id);p.results={available:true,...aggregateSelections(p.definition,[ids,[...ids].reverse()])};await ui.showResults(p,null);
 }
 if(scene==='creation'){
  const {spacePollEditor}=await import('voti/web/space-poll-editor.js');app.replaceChildren();ui.title('Nouveau sondage');delete document.body.dataset.votiRole;
  const data={spaceId:crypto.randomUUID(),name:'La Cabane Voti',access:{role:'admin'},groups:[],members:[{member_id:crypto.randomUUID(),status:'active',groupIds:[]},{member_id:crypto.randomUUID(),status:'active',groupIds:[]},{member_id:crypto.randomUUID(),status:'active',groupIds:[]}]};const groups=document.createElement('div');
  app.append(spacePollEditor(data,{button:(...a)=>ui.button(...a),submit:async v=>window.__createdMode=v,groupSelection:()=>({element:groups,values:()=>[]}),readAudienceSize:async()=>3,readModes:async()=>({version:1})}));button('Création express').click();await new Promise(requestAnimationFrame);
 }
 if(scene==='creation-behaviour'){
  const q=app.querySelector('input[maxlength="240"]');q.value='Quelle activité vendredi ?';q.dispatchEvent(new Event('input',{bubbles:true}));
  while(app.querySelectorAll('[data-answer-row]').length<6)button('Ajouter une réponse').click();
  for(const [i,input]of [...app.querySelectorAll('[data-answer-row] input')].entries()){input.value=['Parc','Cinéma','Jeux','Piscine','Lecture','Musique'][i];input.dispatchEvent(new Event('input',{bubbles:true}));}
  const mode=app.querySelector('.vote-mode-control select'),limit=app.querySelector('.vote-mode-control input');mode.value='ranked_choice';mode.dispatchEvent(new Event('change',{bubbles:true}));limit.value=5;limit.dispatchEvent(new Event('input',{bubbles:true}));
  button('Changer de parcours').click();button('Création guidée').click();ok(mode.value==='ranked_choice'&&limit.value==='5','mode conservé entre parcours');button('Changer de parcours').click();button('Création express').click();
  button('Créer le brouillon').click();for(let i=0;i<120&&!window.__createdMode;i++)await new Promise(requestAnimationFrame);ok(window.__createdMode?.voting?.voteConfig.limit===5&&window.__createdMode.voting.mode==='ranked_choice','Express préserve la configuration');ok(window.__createdMode.release==='threshold'&&window.__createdMode.identity==='anonymous','défauts Express conservés');
 }
 if(scene==='configure-multiple'||scene==='configure-ranked'){
  const mode=app.querySelector('.vote-mode-control select');mode.value=scene==='configure-multiple'?'multiple_choice':'ranked_choice';mode.dispatchEvent(new Event('change',{bubbles:true}));
 }
 ok(document.documentElement.scrollWidth<=innerWidth,'aucun overflow');for(const img of app.querySelectorAll('.mascot'))await img.decode();return true;
}
export async function runVoteModesBrowser({command,evaluate,sessionId}){
 const dir=resolve('.browser-tests/vote-modes');await mkdir(dir,{recursive:true});
 const stage=s=>evaluate(sessionId,`(${modeScene.toString()})(${JSON.stringify(s)})`);
 const shot=async name=>{await evaluate(sessionId,'scrollTo(0,0)');const r=await command('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(resolve(dir,name+'.png'),Buffer.from(r.data,'base64'));};
 await stage('setup');
 for(const width of [390,768,1200,1440]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390},sessionId);
  for(const mode of ['multiple','ranked']){
   await stage(mode);if(width===1440&&mode==='ranked')await shot('ranked-before-first-click');
   await stage('choose-two');if([390,1440].includes(width))await shot(mode+'-'+width);
   await stage('review');if(width===1440&&mode==='ranked')await shot('ranked-review');
   await stage('submit');await stage(mode);await stage('choose-two');await stage('results');if(width===1440)await shot('results-'+mode);
  }
 }
 await stage('ranked');await stage('bounds');await stage('ranked');await stage('legacy-qr');await stage('choose-two');await stage('reset');await stage('choose-two');await stage('review');await stage('network');
 await stage('creation');await shot('creation-modes');await stage('configure-multiple');await shot('configuration-multiple');await stage('configure-ranked');await shot('configuration-ranked');await stage('creation-behaviour');
 assert.equal((await evaluate(sessionId,'__modeWrites')),0);console.log('UI modes : 4 largeurs, sélection/rangs avant clic, reset, récapitulatif, confirmation, identité et résultats : PASS.');
}
