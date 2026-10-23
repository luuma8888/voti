import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectImage} from '../shared/image-format.js';
export function validateVisualManifest(manifest,type){
  if(manifest.version!==1||manifest.type!==type||!Array.isArray(manifest.entries)||manifest.entries.length>128)throw new Error('Manifeste de visuels invalide.');
  const ids=new Set();for(const e of manifest.entries){if(!new RegExp(`^${type}_[a-z0-9_]{1,60}$`).test(e.id)||e.type!==type||ids.has(e.id)||typeof e.label!=='string'||!e.label.trim()||e.label.length>80||!/^[a-z0-9_-]+\.(png|webp)$/.test(e.file)||e.optionalTags&&(!Array.isArray(e.optionalTags)||e.optionalTags.length>12||e.optionalTags.some(t=>typeof t!=='string'||t.length>40)))throw new Error('Entrée de visuel intégrée invalide.');ids.add(e.id);}return manifest.entries;
}
export async function embeddedVisuals(root){
  const catalog={member:[],group:[]};for(const type of ['member','group']){const dir=resolve(root,`web/assets/${type}-visuals`),manifest=JSON.parse(await readFile(resolve(dir,'manifest.json'),'utf8'));for(const entry of validateVisualManifest(manifest,type)){const bytes=await readFile(resolve(dir,entry.file)),info=inspectImage(bytes);if(bytes.length>300000||info.width!==info.height||info.width<64||info.width>1024)throw new Error('Visuel intégré hors limites.');catalog[type].push({...entry,src:`data:${info.mimeType};base64,${bytes.toString('base64')}`});}}return catalog;
}
