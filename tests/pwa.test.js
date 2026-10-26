import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {ROOT} from '../scripts/build.mjs';
import {servePwaAsset} from '../scripts/pwa-static.mjs';
import {auditPaths,isPrivateOrTemporaryExport} from '../scripts/audit-bundle.mjs';

const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8'));

test('PWA : identité publique, standalone et chemins corrects à la racine et sous /voti/',()=>{
  assert.equal(manifest.name,'Voti');assert.equal(manifest.short_name,'Voti');
  assert.equal(manifest.display,'standalone');assert.equal(manifest.prefer_related_applications,false);
  assert.equal(manifest.id,'./');assert.equal(manifest.start_url,'./#home');assert.equal(manifest.scope,'./');
  assert.equal(manifest.theme_color,'#e9e2f5');assert.equal(manifest.background_color,'#fdfbff');
  assert.ok(!Object.hasOwn(manifest,'orientation'));
  for(const base of ['https://example.test/','https://luuma8888.github.io/voti/']){
    const url=new URL('manifest.webmanifest',base);
    assert.equal(new URL(manifest.scope,url).href,base);
    assert.equal(new URL(manifest.start_url,url).href,base+'#home');
    assert.equal(new URL(manifest.id,url).href,base);
    for(const icon of manifest.icons)assert.ok(new URL(icon.src,url).href.startsWith(base+'assets/pwa/'));
  }
  assert.doesNotMatch(JSON.stringify(manifest),/https?:|credential|token|secret|roster|member|group/);
});

test('PWA : trois PNG réels, dimensions déclarées, icône maskable dédiée opaque',async()=>{
  assert.equal(manifest.icons.length,3);
  for(const [i,size] of [192,512,512].entries()){
    const icon=manifest.icons[i],bytes=await readFile(new URL('../'+icon.src,import.meta.url));
    assert.equal(icon.type,'image/png');assert.equal(icon.sizes,`${size}x${size}`);
    assert.equal(icon.purpose,i===2?'maskable':'any');
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(bytes.toString('ascii',12,16),'IHDR');
    assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
    assert.equal(bytes[25],2,'PNG RGB opaque, sans transparence sous le logo');
    assert.equal(isPrivateOrTemporaryExport(icon.src),false);
  }
  const paths=await auditPaths();
  assert.ok(paths.includes('manifest.webmanifest'));
  for(const icon of manifest.icons)assert.ok(paths.includes(icon.src));
  assert.equal(isPrivateOrTemporaryExport('assets/pwa/capture-personnelle.png'),true);
});

test('PWA : métadonnées dans le template, aucun worker, bootstrap ni cache ajouté',async()=>{
  const html=await readFile(new URL('../web/index.template.html',import.meta.url),'utf8');
  assert.match(html,/<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html,/<meta name="theme-color" content="#e9e2f5">/);
  assert.match(html,/<link rel="apple-touch-icon" href="\.\/assets\/pwa\/voti-192\.png">/);
  const files=['manifest.webmanifest','web/index.template.html',...(await readdir(new URL('../web/',import.meta.url))).filter(f=>f.endsWith('.js')).map(f=>'web/'+f)];
  for(const file of files){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/serviceWorker\.register|caches\.(?:open|match)|sync\.register|beforeinstallprompt/);
  }
});

test('PWA : serveur local GET/HEAD, MIME manifest, chemins fermés, aucune API servie',async t=>{
  const server=createServer(async(req,res)=>{if(!await servePwaAsset(req,res,ROOT)){res.writeHead(404);res.end();}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin='http://127.0.0.1:'+server.address().port;
  for(const prefix of ['/','/voti/']){
    const r=await fetch(origin+prefix+'manifest.webmanifest');assert.equal(r.status,200);
    assert.match(r.headers.get('content-type'),/^application\/manifest\+json/);assert.equal(r.headers.get('cache-control'),'no-cache');
    assert.deepEqual(await r.json(),manifest);
    for(const icon of manifest.icons){const image=await fetch(origin+prefix+icon.src);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.ok((await image.arrayBuffer()).byteLength>0);}
    const head=await fetch(origin+prefix+'manifest.webmanifest',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
  assert.equal((await fetch(origin+'/api/v1/spaces/getSpace')).status,404);
  assert.equal((await fetch(origin+'/assets/pwa/other.png')).status,404);
  assert.equal((await fetch(origin+'/manifest.webmanifest',{method:'POST',body:'private'})).status,405);
});
