import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {EventEmitter,once} from 'node:events';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from './build.mjs';
import {serveMascotAsset} from './mascot-assets.mjs';
import {servePwaAsset} from './pwa-static.mjs';
import {serveVisualAsset} from './visual-static.mjs';
import {navigateAndWait,waitForApplication} from './browser-navigation.mjs';

// Profil et serveur isolés ; aucune API production, aucun accès réel.
const directory=resolve(ROOT,'.browser-tests/pwa'),profile=resolve(directory,'profile-'+Date.now());
await mkdir(profile,{recursive:true});
const html=await readFile(resolve(ROOT,'index.html'),'utf8');let revision=1;
assert.match(html,/<link rel="manifest" href="\.\/manifest\.webmanifest">/,'Construire le frontend avant test:pwa.');
const server=createServer(async(req,res)=>{
  if(await serveMascotAsset(req,res,ROOT)||await servePwaAsset(req,res,ROOT)||await serveVisualAsset(req,res,ROOT))return;
  if(!['/','/index.html','/voti/','/voti/index.html'].includes(new URL(req.url,'http://localhost').pathname)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});
  res.end(html.replace('</body>',`<!-- PWA_TEST_BUILD_${revision} --></body>`));
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=spawn(process.env.VOTI_CHROMIUM||'/usr/bin/chromium',[
  '--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run',
  '--disable-background-networking','--disable-component-update',`--user-data-dir=${profile}`,'--remote-debugging-pipe','about:blank'
],{stdio:['ignore','ignore','pipe','pipe','pipe'],env:{...process.env,XDG_CONFIG_HOME:profile,XDG_CACHE_HOME:profile,XDG_DATA_HOME:profile}});
let buffer='',sequence=0,checks=0;const pending=new Map(),events=new EventEmitter(),errors=[],requests=[];
function command(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout : '+method));},20000);pending.set(id,{resolve,reject,timer});browser.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});}
browser.stderr.resume();
browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const p=JSON.parse(raw);if(p.id&&pending.has(p.id)){const task=pending.get(p.id);pending.delete(p.id);clearTimeout(task.timer);p.error?task.reject(new Error(p.error.message)):task.resolve(p.result);}if(p.method)events.emit('event',p);if(p.method==='Runtime.exceptionThrown')errors.push(p.params.exceptionDetails.text);if(p.method==='Network.requestWillBeSent'&&/^https?:/.test(p.params.request.url))requests.push(p.params.request.url);}});
async function evaluate(sessionId,expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);assert(!r.exceptionDetails,'Exception pendant le contrôle PWA');return r.result.value;}
try{
  const version=await command('Browser.getVersion');
  const target=await command('Target.createTarget',{url:'about:blank'}),{sessionId}=await command('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  for(const method of ['Page.enable','Runtime.enable','Network.enable'])await command(method,{},sessionId);
  await command('Page.setLifecycleEventsEnabled',{enabled:true},sessionId);
  const manifests=[];
  for(const path of ['/voti/','/']){
    const url=origin+path+'#home';await navigateAndWait(command,events,sessionId,url);await evaluate(sessionId,`(${waitForApplication.toString()})(${JSON.stringify(url)})`);
    const manifest=await command('Page.getAppManifest',{},sessionId);assert.equal(manifest.url,origin+path+'manifest.webmanifest');assert.equal(manifest.errors.length,0);const m=JSON.parse(manifest.data);
    assert.equal(new URL(m.start_url,manifest.url).href,origin+path+'#home');assert.equal(new URL(m.scope,manifest.url).href,origin+path);assert.equal(m.display,'standalone');checks+=5;
    for(const icon of m.icons){const result=await evaluate(sessionId,`new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve([i.naturalWidth,i.naturalHeight]);i.onerror=()=>reject(Error('Icône absente'));i.src=${JSON.stringify(new URL(icon.src,manifest.url).href)};})`);assert.equal(result.join('x'),icon.sizes);checks++;}
    const installability=await command('Page.getInstallabilityErrors',{},sessionId);assert.deepEqual(installability.installabilityErrors,[]);checks++;
    manifests.push({path,installabilityErrors:installability.installabilityErrors});
  }
  await evaluate(sessionId,"location.hash='#spaces'");
  await evaluate(sessionId,"(async()=>{while(!document.querySelector('[data-space-library]'))await new Promise(requestAnimationFrame);return true;})()");checks++;
  await evaluate(sessionId,"location.hash='#new'");
  await evaluate(sessionId,"(async()=>{while(!document.querySelector('#app input'))await new Promise(requestAnimationFrame);return true;})()");checks++;
  await evaluate(sessionId,"history.back()");
  await evaluate(sessionId,"(async()=>{while(location.hash!=='#spaces'||!document.querySelector('[data-space-library]'))await new Promise(requestAnimationFrame);return true;})()");checks++;
  for(const width of [390,1440]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:900,deviceScaleFactor:1,mobile:width===390},sessionId);
    assert(await evaluate(sessionId,'document.documentElement.scrollWidth<=innerWidth+1'));checks++;
    const image=await command('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(resolve(directory,'spaces-'+width+'.png'),Buffer.from(image.data,'base64'));
  }
  revision=2;
  const updated=origin+'/voti/#home';await navigateAndWait(command,events,sessionId,updated);await evaluate(sessionId,`(${waitForApplication.toString()})(${JSON.stringify(updated)})`);
  assert(await evaluate(sessionId,"document.documentElement.outerHTML.includes('PWA_TEST_BUILD_2')"));checks++;
  const storage=await evaluate(sessionId,"(async()=>({workers:(await navigator.serviceWorker.getRegistrations()).length,caches:await caches.keys()}))()");assert.equal(storage.workers,0);assert.deepEqual(storage.caches,[]);checks+=2;
  assert.equal(errors.length,0);assert(requests.every(u=>new URL(u).origin===origin));checks+=2;
  const result={pass:true,checks,chromium:version.product,manifests,updateLoaded:true,storage,runtimeErrors:errors.length,externalRequests:0,osInstallationTested:false,standaloneConfigured:true};
  await writeFile(resolve(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{
  for(const task of pending.values())clearTimeout(task.timer);
  browser.kill('SIGTERM');await Promise.race([once(browser,'exit'),new Promise(resolve=>setTimeout(resolve,1500))]);
  if(browser.exitCode===null)browser.kill('SIGKILL');await new Promise(resolve=>server.close(resolve));await rm(profile,{recursive:true,force:true});
}
