import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import UPNGModule from '@pdf-lib/upng';
import jsQR from 'jsqr';

// Artefacts créés par test:browser, tous ignorés et exclus du ZIP d'audit.
const studio=process.argv.includes('--studio');
const root=resolve(studio?'.browser-tests/studio-pdfs':'.browser-tests/pdfs');
const UPNG=UPNGModule.default;
const files=JSON.parse(await readFile(resolve(root,'plans.json'),'utf8'));
let checks=0, decoded=0;
const assert=(value,message)=>{if(!value)throw new Error(message);checks++;};
assert(new Set(files.map(f=>f.theme)).size>=(studio?4:5),'Affiches générées avec des palettes variées');
if(studio){assert(new Set(files.filter(f=>f.kind==='poster').map(f=>f.layout)).size===4,'Quatre layouts PDF');assert(files.filter(f=>f.kind==='results').length===5,'PDF résultats Synthèse/Rapport');assert(new Set(files.filter(f=>f.kind==='results').map(f=>f.theme)).size===5,'Cinq palettes résultats');}
for(const file of files) {
  const path=resolve(root,file.name), bytes=await readFile(path), pdf=await PDFDocument.load(bytes);
  assert(pdf.getPages().length===file.pages,'Nombre de pages PDF');
  assert(!bytes.includes(Buffer.from('voti-admin-v1.')),'Aucune capacité littérale dans le PDF');
  const planWidth=file.width||2480,planHeight=file.height||3508,landscape=planWidth>planHeight;
  for(const page of pdf.getPages()) assert(Math.abs(page.getWidth()-(landscape?841.8898:595.2756))<.01 && Math.abs(page.getHeight()-(landscape?595.2756:841.8898))<.01,'A4 physique');
  const prefix=resolve(root,'decoded-'+file.name.replace('.pdf',''));
  await promisify(execFile)('pdftoppm',['-r','300','-png',path,prefix],{maxBuffer:1_000_000});
  for(const [index,qrs] of file.qrs.entries()) {
    const png=await readFile(prefix+'-'+(index+1)+'.png');
    const image=UPNG.decode(png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength));
    const rgba=new Uint8Array(UPNG.toRGBA8(image)[0]);
    assert(image.width>=planWidth && image.height>=planHeight,'Raster PDF à 300 dpi');
    for(const q of qrs) {
      const x=Math.floor(q.x/planWidth*image.width),y=Math.floor(q.y/planHeight*image.height);
      const width=Math.ceil(q.size/planWidth*image.width)+1,height=Math.ceil(q.size/planHeight*image.height)+1;
      const crop=new Uint8ClampedArray(width*height*4);
      for(let row=0;row<height;row++)crop.set(rgba.subarray(((y+row)*image.width+x)*4,((y+row)*image.width+x+width)*4),row*width*4);
      assert(jsQR(crop,width,height)?.data===q.url,'QR réellement décodé depuis le PDF : '+file.name);decoded++;
    }
  }
}
console.log(`PDF Poppler : ${checks} contrôles réussis, ${files.length} PDF A4 et ${decoded} QR décodés sans perte.`);
