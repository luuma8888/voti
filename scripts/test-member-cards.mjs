import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {PDFDocument} from 'pdf-lib';
import UPNGModule from '@pdf-lib/upng';
import jsQR from 'jsqr';
import {createQrMatrix} from '../web/qr.js';
import {CARD_LAYOUT} from '../web/card-layout.js';
const root='.browser-tests/member-cards',pdf=await PDFDocument.load(await readFile(root+'/cards.pdf')),expected=JSON.parse(await readFile(root+'/expected.json','utf8'));
let checks=0;const ok=(value,message)=>{if(!value)throw new Error(message);checks++;};
ok(pdf.getPageCount()===2,'Neuf cartes : deux pages');
for(const page of pdf.getPages())ok(Math.abs(page.getWidth()-595.2756)<.01&&Math.abs(page.getHeight()-841.8898)<.01,'Format physique A4');
await promisify(execFile)('pdftoppm',['-r','300','-png',root+'/cards.pdf',root+'/cards'],{maxBuffer:1000000});
for(let index=0;index<expected.length;index++){
  const page=Math.floor(index/8)+1,within=index%8,bytes=await readFile(`${root}/cards-${page}.png`),UPNG=UPNGModule.default,image=UPNG.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),rgba=new Uint8Array(UPNG.toRGBA8(image)[0]);
  const matrix=createQrMatrix(expected[index].url),scale=Math.max(4,Math.floor(CARD_LAYOUT.qr.width/matrix.size)),size=matrix.size*scale,box=expected[index].qr;
  ok(box&&box.size===size&&box.scale>=4,'Grille entière et taille QR sûre');
  const x=Math.floor((80+within%2*1200+box.x)/2480*image.width)-2,y=Math.floor((80+Math.floor(within/2)*820+box.y)/3508*image.height)-2;
  const width=Math.ceil(size/2480*image.width)+5,height=Math.ceil(size/3508*image.height)+5,crop=new Uint8ClampedArray(width*height*4);
  for(let r=0;r<height;r++)crop.set(rgba.subarray(((y+r)*image.width+x)*4,((y+r)*image.width+x+width)*4),r*width*4);
  ok(jsQR(crop,width,height)?.data===expected[index].url,'QR de carte décodable après rasterisation PDF');
  const white=((y+5)*image.width+x+5)*4;ok(rgba[white]===255&&rgba[white+1]===255&&rgba[white+2]===255,'Quiet zone blanche opaque, même en Nuit');
}
console.log(`Cartes PDF Poppler : ${checks} contrôles réussis, 2 pages A4, 9 QR fictifs décodés à 300 dpi.`);
