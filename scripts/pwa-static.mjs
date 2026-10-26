import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

/** Liste fermée de métadonnées/icônes publiques, pour le serveur local. */
export async function servePwaAsset(request,response,root){
  const path=new URL(request.url,'http://localhost').pathname.replace(/^\/voti\//,'/');
  if(!['/manifest.webmanifest','/assets/pwa/voti-192.png','/assets/pwa/voti-512.png','/assets/pwa/voti-maskable-512.png'].includes(path))return false;
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return true;}
  try{
    const bytes=await readFile(resolve(root,'.'+path));
    response.writeHead(200,{'Content-Type':path.endsWith('.png')?'image/png':'application/manifest+json; charset=utf-8','Cache-Control':'no-cache'});
    response.end(request.method==='HEAD'?undefined:bytes);
  }catch{response.writeHead(404);response.end();}
  return true;
}
