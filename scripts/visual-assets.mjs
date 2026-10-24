import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectImage} from '../shared/image-format.js';
import {createHash} from 'node:crypto';
export const VISUAL_ROOT='web/assets/voti-visuals/';
export function validateVisualManifest(m){
  if(m.schemaVersion!==2||m.format!=='webp'||!Array.isArray(m.members)||!Array.isArray(m.groups)||m.members.length!==132||m.groups.length!==36)throw new Error('Inventaire visuel invalide.');
  const ids=new Set(),counts={creature:0,child:0,adult:0};
  for(const [kind,entries]of [['member',m.members],['group',m.groups]])for(const e of entries){
    if(e.kind!==kind||!new RegExp(`^${kind}_[a-z0-9_]{1,80}$`).test(e.id)||ids.has(e.id)||typeof e.label!=='string'||!e.label.trim()||e.label.length>100||typeof e.pack!=='string'||!['square','portrait'].includes(e.sourceAspect)||typeof e.displayMode!=='string'||!e.files||Object.keys(e.files).sort().join(',')!==(kind==='group'?'backdrop,icon,large,medium':'icon,large,medium'))throw new Error('Entrée de manifeste invalide.');
    ids.add(e.id);if(kind==='member'){if(!Object.hasOwn(counts,e.category))throw new Error('Catégorie invalide.');counts[e.category]++;}else if(e.category!=='group')throw new Error('Catégorie groupe invalide.');
    for(const tier of (kind==='group'?['icon','medium','large','backdrop']:['icon','medium','large']))if(typeof e.files[tier]!=='string'||!new RegExp(`^${kind}s/${tier}/[a-z0-9_-]+\\.webp$`).test(e.files[tier]))throw new Error('Chemin visuel invalide.');
  }
  if(counts.creature!==60||counts.child!==36||counts.adult!==36)throw new Error('Catégories incomplètes.');return m;
}
export function visualIdsSource(m){return '// Généré depuis assets-manifest.json par scripts/visual-assets.mjs --write-ids.\n'+`export const MEMBER_VISUAL_IDS=Object.freeze(${JSON.stringify(m.members.map(e=>e.id))});\nexport const GROUP_VISUAL_IDS=Object.freeze(${JSON.stringify(m.groups.map(e=>e.id))});\n`+`const members=new Set(MEMBER_VISUAL_IDS),groups=new Set(GROUP_VISUAL_IDS);\nexport const isVisualId=(kind,id)=>id===null||(typeof id==='string'&&(kind==='member'?members:kind==='group'?groups:new Set()).has(id));\n`;}
export async function embeddedVisuals(root){
  const m=validateVisualManifest(JSON.parse(await readFile(resolve(root,VISUAL_ROOT+'assets-manifest.json'),'utf8'))),catalog={member:[],group:[]};
  const checksum=await readFile(resolve(root,'docs/audit/VOTI_VISUAL_CHECKSUMS.sha256'),'utf8'),hashes=new Map(checksum.trim().split('\n').map(l=>[l.slice(66),l.slice(0,64)]));
  for(const kind of ['member','group'])for(const e of m[kind+'s']){
    for(const tier of (kind==='group'?['icon','medium','large','backdrop']:['icon','medium','large'])){const path=VISUAL_ROOT+e.files[tier],b=await readFile(resolve(root,path)),image=inspectImage(b),human=kind==='member'&&e.category!=='creature',dims=kind==='group'?{icon:[128,128],medium:[384,384],large:[768,768],backdrop:[1024,1024]}[tier]:tier==='icon'?[128,128]:tier==='medium'?(human?[256,384]:[256,256]):human?[384,576]:[512,512];
      if(image.mimeType!=='image/webp'||image.width!==dims[0]||image.height!==dims[1]||createHash('sha256').update(b).digest('hex')!==hashes.get(path))throw new Error('Visuel altéré ou dimensions invalides : '+path);}
    const {files,...metadata}=e,paths=Object.fromEntries(Object.entries(files).map(([tier,file])=>[tier,VISUAL_ROOT+file]));catalog[kind].push({...metadata,type:kind,...(kind==='group'?{files:paths}:{}),...paths});
  }
  if(await readFile(resolve(root,'shared/visual-ids.js'),'utf8')!==visualIdsSource(m))throw new Error('Catalogue IDs désynchronisé : lancer node scripts/visual-assets.mjs --write-ids.');
  return catalog;
}
if(process.argv.includes('--write-ids')){const m=validateVisualManifest(JSON.parse(await readFile(VISUAL_ROOT+'assets-manifest.json','utf8')));await writeFile('shared/visual-ids.js',visualIdsSource(m));console.log('Catalogue IDs généré : 132 membres, 36 groupes.');}
