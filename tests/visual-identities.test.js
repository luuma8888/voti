import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {validateVisualManifest,embeddedVisuals,visualIdsSource,VISUAL_ROOT} from '../scripts/visual-assets.mjs';
import {MEMBER_VISUAL_IDS,GROUP_VISUAL_IDS,isVisualId} from '../shared/visual-ids.js';
import {validateSpaceCommand} from '../shared/space-wire.js';
const manifest=JSON.parse(await readFile(VISUAL_ROOT+'assets-manifest.json','utf8'));
test('168 identités originales, 504 WebP intacts, dimensions et catalogue serveur dérivés du JSON',async()=>{
 validateVisualManifest(manifest);assert.equal(new Set([...MEMBER_VISUAL_IDS,...GROUP_VISUAL_IDS]).size,168);assert.equal(MEMBER_VISUAL_IDS.length,132);assert.equal(GROUP_VISUAL_IDS.length,36);
 const catalog=await embeddedVisuals(process.cwd());for(const [category,n]of [['creature',60],['child',36],['adult',36]])assert.equal(catalog.member.filter(e=>e.category===category).length,n);
 assert.equal(await readFile('shared/visual-ids.js','utf8'),visualIdsSource(manifest));
 for(const kind of ['members','groups'])for(const tier of ['icon','medium','large'])assert.deepEqual((await readdir(VISUAL_ROOT+kind+'/'+tier)).sort(),manifest[kind].map(e=>e.id+'.webp').sort());
 assert.ok(!JSON.stringify(catalog).includes('base64'));assert.ok(!JSON.stringify(catalog).includes('Asset-13'));assert.ok(!JSON.stringify(catalog).includes('https:'));
});
test('IDs métier : uniquement NULL ou un ID du bon type ; ancien payload conservé',()=>{
 const spaceId=crypto.randomUUID(),memberId=crypto.randomUUID(),groupId=crypto.randomUUID(),m={spaceId,memberId,displayName:'Fictif',groupIds:[],expectedRevision:1},g={spaceId,groupId,name:'Fictif',expectedRevision:1};
 assert.deepEqual(validateSpaceCommand('updateMember',m),m);assert.deepEqual(validateSpaceCommand('renameGroup',g),g);
 for(const visualId of [null,...MEMBER_VISUAL_IDS])assert.equal(validateSpaceCommand('updateMember',{...m,visualId}).visualId,visualId);
 for(const visualId of [null,...GROUP_VISUAL_IDS])assert.equal(validateSpaceCommand('renameGroup',{...g,visualId}).visualId,visualId);
 for(const value of [undefined,'','../x','member_unknown','https://x.invalid/a.webp','data:image/webp;base64,AAAA',42,{},GROUP_VISUAL_IDS[0]])assert.throws(()=>validateSpaceCommand('updateMember',{...m,visualId:value}),{code:'INVALID_REQUEST'});
 assert.throws(()=>validateSpaceCommand('renameGroup',{...g,visualId:MEMBER_VISUAL_IDS[0]}),{code:'INVALID_REQUEST'});assert.equal(isVisualId('member',null),true);assert.equal(isVisualId('member',GROUP_VISUAL_IDS[0]),false);
});
test('Module runtime compilé : APIs de résolution et quatre filtres depuis le même JSON',async()=>{
 const catalog=await embeddedVisuals(process.cwd()),source=(await readFile('web/visual-presets.js','utf8')).replace('export const VISUAL_PRESETS = {member:[],group:[]};','export const VISUAL_PRESETS = '+JSON.stringify(catalog)+';');
 const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.equal(api.listMemberVisuals().length,132);assert.equal(api.listGroupVisuals().length,36);
 for(const[c,n]of [['all',132],['creature',60],['child',36],['adult',36]])assert.equal(api.filterMemberVisuals(c).length,n);
 for(const e of [...catalog.member,...catalog.group]){const found=e.kind==='member'?api.getMemberVisual(e.id):api.getGroupVisual(e.id);assert.equal(found.id,e.id);for(const key of ['kind','category','pack','label','sourceAspect','displayMode','icon','medium','large'])assert.ok(found[key]);}
 assert.equal(api.getMemberVisual(GROUP_VISUAL_IDS[0]),null);assert.equal(api.getGroupVisual('inconnu'),null);
});
