import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

/** Catalogue public dérivé du manifeste officiel, sans données utilisateur. */
export async function mascotCatalog(root){
  const dir='assets/branding/mascots',manifest=JSON.parse(await readFile(resolve(root,dir,'manifest.json'),'utf8')),catalog={};
  for(const asset of manifest.assets){
    if(!/^mascot-(?:welcome|empty|card-scan|success)$/.test(asset.id)||!new RegExp('^'+asset.id+'-[a-f0-9]{12}\\.webp$').test(asset.web_file))throw new Error('Asset mascotte invalide.');
    const bytes=await readFile(resolve(root,dir,asset.web_file)),hash=createHash('sha256').update(bytes).digest('hex');
    if(hash!==asset.web_sha256||!asset.web_file.includes(hash.slice(0,12))||bytes.length!==asset.web_bytes||bytes.toString('ascii',8,12)!=='WEBP')throw new Error('Intégrité mascotte invalide.');
    const key=asset.id.replace('mascot-','');if(catalog[key])throw new Error('Mascotte dupliquée.');
    catalog[key]={file:dir+'/'+asset.web_file,width:asset.web_dimensions.width,height:asset.web_dimensions.height};
  }
  if(Object.keys(catalog).length!==4)throw new Error('Quatre postures attendues.');
  return catalog;
}

/** Serveur de développement : quatre fichiers publics seulement. */
export async function serveMascotAsset(request,response,root){
  const path=new URL(request.url,'http://localhost').pathname.replace(/^\/voti\//,'/');
  if(!/^\/assets\/branding\/mascots\/mascot-(?:welcome|empty|card-scan|success)-[a-f0-9]{12}\.webp$/.test(path))return false;
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return true;}
  try{
    const bytes=await readFile(resolve(root,'.'+path));
    response.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable'});
    response.end(request.method==='HEAD'?undefined:bytes);
  }catch{response.writeHead(404);response.end();}
  return true;
}
