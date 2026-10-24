import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {embeddedVisuals,validateVisualManifest,visualIdsSource,VISUAL_ROOT} from '../scripts/visual-assets.mjs';import {inspectImage} from '../shared/image-format.js';
const m=JSON.parse(await readFile(VISUAL_ROOT+'assets-manifest.json','utf8')),dimensions={icon:128,medium:384,large:768,backdrop:1024};
test('Groupes HD V2 : 36 IDs historiques, 144 WebP originaux hashés, tailles exactes et zéro orphelin',async()=>{
 const source=new Map((await readFile('docs/audit/VOTI_GROUPS_HD_V2_CHECKSUMS.sha256','utf8')).trim().split('\n').map(l=>[l.slice(66),l.slice(0,64)]));let files=0;
 for(const tier of Object.keys(dimensions)){const names=await readdir(VISUAL_ROOT+'groups/'+tier);assert.equal(names.length,36);assert.deepEqual(names.sort(),m.groups.map(e=>e.files[tier].split('/').at(-1)).sort());for(const e of m.groups){const path=e.files[tier],bytes=await readFile(VISUAL_ROOT+path),sha=createHash('sha256').update(bytes).digest('hex'),im=inspectImage(bytes),sourceId=e.id==='group_g01_09_mushroom_village_nook'?'group_g01_09_mushroom_village':e.id;assert.equal(sha,source.get('groups/'+tier+'/'+sourceId+'.webp'));assert(path.endsWith('-'+sha.slice(0,12)+'.webp'));assert.equal(im.mimeType,'image/webp');assert.equal(im.width,dimensions[tier]);assert.equal(im.height,dimensions[tier]);files++;}}
 assert.equal(files,144);assert.equal(new Set(m.groups.map(e=>e.id)).size,36);assert.equal(await readFile('shared/visual-ids.js','utf8'),visualIdsSource(m));assert.deepEqual((await readdir(VISUAL_ROOT+'groups')).sort(),Object.keys(dimensions).sort());
});
test('backdrop appartient seulement aux groupes ; membres inchangés, fichiers imbriqués et alias compatibles',async()=>{
 const catalog=await embeddedVisuals(process.cwd());for(const g of catalog.group){assert(g.backdrop.includes('/backdrop/'));for(const tier of Object.keys(dimensions))assert.equal(g.files[tier],g[tier]);}
 for(const e of catalog.member){assert(!Object.hasOwn(e,'backdrop'));assert(!Object.hasOwn(e.files??{},'backdrop'));}
 for(const id of ['group_g01_10_river_glasshouse','group_g02_01_floating_island','group_g03_01_clockwork_garden','group_g01_09_mushroom_village_nook'])assert(catalog.group.find(g=>g.id===id)?.files.backdrop);
 for(const change of [copy=>delete copy.groups[0].files.backdrop,copy=>copy.members[0].files.backdrop='members/backdrop/invalid.webp',copy=>copy.groups[0].files.backdrop='https://remote.invalid/x.webp']){const copy=structuredClone(m);change(copy);assert.throws(()=>validateVisualManifest(copy));}
});
