import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
/** Fichiers publics du catalogue uniquement. Aucun chemin libre ou API de médias. */
export async function serveVisualAsset(request,response,root){
  const path=new URL(request.url,'http://localhost').pathname.replace(/^\/voti\//,'/');
  if(!/^\/web\/assets\/voti-visuals\/(?:assets-manifest\.json|(?:members|groups)\/(?:icon|medium|large)\/[a-z0-9_-]+\.webp)$/.test(path))return false;
  try{const bytes=await readFile(resolve(root,'.'+path));response.writeHead(200,{'Content-Type':path.endsWith('.webp')?'image/webp':'application/json','Cache-Control':'public, max-age=3600'});response.end(request.method==='HEAD'?undefined:bytes);}catch{response.writeHead(404);response.end();}return true;
}
