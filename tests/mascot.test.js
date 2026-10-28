import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {ROOT} from '../scripts/build.mjs';
import {mascotCatalog,serveMascotAsset} from '../scripts/mascot-assets.mjs';

test('Mascotte : quatre postures officielles, dimensions, transparence et octets fidèles au pack',async()=>{
 const m=JSON.parse(await readFile(new URL('../assets/branding/mascots/manifest.json',import.meta.url),'utf8'));
 assert.equal(m.zip_sha256,'b51f66ce1ecd25c2c82b394c7603d7b7308ad0d29399b8023b533eb980d117f2');
 assert.equal(m.assets.length,4);assert.equal(new Set(m.assets.map(a=>a.id)).size,4);
 for(const a of m.assets){
  for(const kind of ['web','source']){const bytes=await readFile(new URL('../assets/branding/mascots/'+a[kind+'_file'],import.meta.url));assert.equal(bytes.length,a[kind+'_bytes']);assert.equal(createHash('sha256').update(bytes).digest('hex'),a[kind+'_sha256']);}
  const b=await readFile(new URL('../assets/branding/mascots/'+a.web_file,import.meta.url));
  assert.equal(b.toString('ascii',12,16),'VP8X');assert.equal(b.readUIntLE(24,3)+1,a.web_dimensions.width);assert.equal(b.readUIntLE(27,3)+1,a.web_dimensions.height);assert.ok(b[20]&16,'alpha WebP');
 }
 const catalog=await mascotCatalog(ROOT);assert.deepEqual(Object.keys(catalog).sort(),['card-scan','empty','success','welcome']);
});

test('Mascotte : ressources locales GET/HEAD, cache versionné, aucun PNG source exposé par le serveur local',async t=>{
 const server=createServer(async(req,res)=>{if(!await serveMascotAsset(req,res,ROOT)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port,catalog=await mascotCatalog(ROOT);
 for(const prefix of ['/','/voti/'])for(const a of Object.values(catalog)){
  const r=await fetch(base+prefix+a.file);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.match(r.headers.get('cache-control'),/immutable/);assert.ok((await r.arrayBuffer()).byteLength>0);
  const h=await fetch(base+prefix+a.file,{method:'HEAD'});assert.equal(h.status,200);assert.equal(await h.text(),'');
 }
 assert.equal((await fetch(base+'/assets/branding/source/mascots/mascot-welcome.png')).status,404);
 assert.equal((await fetch(base+'/api/v1/spaces/getSpace')).status,404);
});

test('Mascotte : catalogue dans le build, images séparées sans préchargement des quatre postures',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/__VOTI_MASCOT__|id="brand-mascot"/);
 const map=JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
 const module=Buffer.from(map.imports['voti/web/mascot.js'].split(',')[1],'base64').toString('utf8');
 assert.match(module,/mascot-welcome-[a-f0-9]{12}\.webp/);assert.match(module,/mascot-card-scan-[a-f0-9]{12}\.webp/);assert.doesNotMatch(module,/data:image/);
 const template=await readFile(new URL('../web/index.template.html',import.meta.url),'utf8');assert.doesNotMatch(template,/preload.*mascot/);
});
