import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import UPNGModule from '@pdf-lib/upng';import jsQR from 'jsqr';
const UPNG=UPNGModule.default,dir='.browser-tests/voti-card-background-batch',files=JSON.parse(await readFile(dir+'/pdfs.json','utf8'));let checks=0,total=0;
const crop=(rgba,W,x,y,w,h)=>{const out=new Uint8ClampedArray(w*h*4);for(let r=0;r<h;r++)out.set(rgba.subarray(((y+r)*W+x)*4,((y+r)*W+x+w)*4),r*w*4);return out;};
for(const f of files){
 const prefix=dir+'/'+f.name;await promisify(execFile)('pdftoppm',['-r','300','-png',prefix+'.pdf',prefix],{maxBuffer:1000000});let im,rgba;
 for(const [index,expected]of f.expected.entries()){
  if(index%8===0){const bytes=await readFile(prefix+'-'+(Math.floor(index/8)+1)+'.png');im=UPNG.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));rgba=new Uint8Array(UPNG.toRGBA8(im)[0]);}
  const sx=im.width/2480,sy=im.height/3508,cx=80+(index%2)*1200,cy=80+Math.floor((index%8)/2)*820;
  // Le même géométrie publiée est utilisée ; si absente, décoder toute la carte.
  const q=expected.qr??{x:620,y:250,size:480},x=Math.floor((cx+q.x)*sx),y=Math.floor((cy+q.y)*sy),w=Math.ceil(q.size*sx),h=Math.ceil(q.size*sy),qr=crop(rgba,im.width,x,y,w,h);
  assert.ok(jsQR(qr,w,h)?.data===expected.url,f.name+' QR '+index+' doit correspondre à la carte exportée');total++;checks++;
  if(expected.qr)for(const[px,py]of[[5,5],[w-6,5],[5,h-6],[w-6,h-6]]){const i=(py*w+px)*4;assert.deepEqual([...qr.slice(i,i+4)],[255,255,255,255]);checks++;}
  if(f.name==='backgrounds'&&[0,2].includes(index)){const cw=Math.round(1120*sx),ch=Math.round(760*sy),card=crop(rgba,im.width,Math.round(cx*sx),Math.round(cy*sy),cw,ch);await writeFile(dir+'/pdf-'+(index===0?'single':'mosaic')+'-300dpi.png',Buffer.from(UPNG.encode([card.buffer],cw,ch,0)));}
 }
}
console.log(`Fond/lot PDF : ${checks} contrôles, ${total}/${total} QR décodés Poppler 300 dpi, PDF nouveau lot et session complète inclus.`);
