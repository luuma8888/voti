import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import UPNGModule from '@pdf-lib/upng';import jsQR from 'jsqr';
const UPNG=UPNGModule.default,dir='.browser-tests/voti-card-ux-polish',files=JSON.parse(await readFile(dir+'/matching-pdfs.json','utf8'));let checks=0;
const crop=(rgba,W,x,y,w,h)=>{const out=new Uint8ClampedArray(w*h*4);for(let r=0;r<h;r++)out.set(rgba.subarray(((y+r)*W+x)*4,((y+r)*W+x+w)*4),r*w*4);return out;};
for(const f of files){
 const prefix=dir+'/'+f.name;await promisify(execFile)('pdftoppm',['-r','300','-f','1','-singlefile','-png',prefix+'.pdf',prefix],{maxBuffer:1000000});
 const bytes=await readFile(prefix+'.png'),im=UPNG.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),rgba=new Uint8Array(UPNG.toRGBA8(im)[0]),sx=im.width/2480,sy=im.height/3508;
 const x=Math.floor((80+f.qr.x)*sx),y=Math.floor((80+f.qr.y)*sy),w=Math.ceil(f.qr.size*sx),h=Math.ceil(f.qr.size*sy),qr=crop(rgba,im.width,x,y,w,h);
 assert.equal(jsQR(qr,w,h)?.data,f.url);checks++;
 for(const[px,py]of[[5,5],[w-6,5],[5,h-6],[w-6,h-6]]){const i=(py*w+px)*4;assert.deepEqual([...qr.slice(i,i+4)],[255,255,255,255]);checks++;}
 const cw=Math.round(1120*sx),ch=Math.round(760*sy),card=crop(rgba,im.width,Math.round(80*sx),Math.round(80*sy),cw,ch),name=f.name==='screen-human'?'pdf-human-300dpi.png':'pdf-creature-300dpi.png';
 await writeFile(dir+'/'+name,Buffer.from(UPNG.encode([card.buffer],cw,ch,0)));
}
console.log(`Comparaison écran/PDF : ${checks} contrôles, ${files.length}/${files.length} QR redécodés à 300 dpi, mêmes noms/thèmes/illustrations/QR que les captures.`);
