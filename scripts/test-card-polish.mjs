import {readFile} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {PDFDocument} from 'pdf-lib';import UPNGModule from '@pdf-lib/upng';import jsQR from 'jsqr';
const root='.browser-tests/member-card-polish',files=JSON.parse(await readFile(root+'/expected.json','utf8'));let checks=0,decoded=0;
const ok=(v,m)=>{if(!v)throw new Error(m);checks++;};
for(const file of files){const pdf=await PDFDocument.load(await readFile(root+'/'+file.name));ok(pdf.getPageCount()===Math.ceil(file.expected.length/8),'Pagination A4 des cartes');
  const prefix=root+'/'+file.name.replace('.pdf','');await promisify(execFile)('pdftoppm',['-r','300','-png',root+'/'+file.name,prefix],{maxBuffer:1000000});
  for(const[i,c]of file.expected.entries()){const bytes=await readFile(prefix+'-'+(Math.floor(i/8)+1)+'.png'),UPNG=UPNGModule.default,img=UPNG.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),rgba=new Uint8Array(UPNG.toRGBA8(img)[0]),within=i%8;
    const x=Math.floor((80+within%2*1200+c.qr.x)/2480*img.width),y=Math.floor((80+Math.floor(within/2)*820+c.qr.y)/3508*img.height),w=Math.ceil(c.qr.size/2480*img.width),h=Math.ceil(c.qr.size/3508*img.height),crop=new Uint8ClampedArray(w*h*4);
    for(let r=0;r<h;r++)crop.set(rgba.subarray(((y+r)*img.width+x)*4,((y+r)*img.width+x+w)*4),r*w*4);
    ok(jsQR(crop,w,h)?.data===c.url,'QR PDF individuel/lot décodable à 300 dpi');decoded++;
    ok(c.label==='Ma carte individuelle'&&c.memberName.length>0&&c.qr.scale>=4,'Modèle et taille QR sûrs');
    // Le premier pixel de bord peut être interpolé par Poppler ; les quatre
    // coins intérieurs de la quiet zone doivent rester entièrement blancs.
    for(const[px,py]of [[5,5],[w-6,5],[5,h-6],[w-6,h-6]]){const at=(py*w+px)*4;ok(crop[at]===255&&crop[at+1]===255&&crop[at+2]===255&&crop[at+3]===255,'Zone QR opaque, y compris Nuit');}
  }
}
console.log(`Cartes harmonisées Poppler : ${checks} contrôles, ${files.length} PDF individuels/lot, ${decoded} QR fictifs décodés à 300 dpi (5 thèmes, groupes et fixtures raster).`);
