import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import UPNGModule from '@pdf-lib/upng';
import jsQR from 'jsqr';

// Artefacts créés par test:browser, tous ignorés et exclus du ZIP d'audit.
const studio=process.argv.includes('--studio');
const polish=process.argv.includes('--polish');
const images=process.argv.includes('--images');
const participation=process.argv.includes('--participation');
const root=resolve(participation?'.browser-tests/participation-pdfs':images?'.browser-tests/image-pdfs':polish?'.browser-tests/polish-pdfs':studio?'.browser-tests/studio-pdfs':'.browser-tests/pdfs');
const UPNG=UPNGModule.default;
const files=JSON.parse(await readFile(resolve(root,'plans.json'),'utf8'));
let checks=0, decoded=0;
const assert=(value,message)=>{if(!value)throw new Error(message);checks++;};
assert(new Set(files.map(f=>f.theme)).size>=(participation?2:images?3:studio||polish?4:5),'Affiches générées avec des palettes variées');
if(participation){assert(files.length===3,'Trois rapports participation');assert(files.every(f=>f.pages>=2),'Commentaires paginés');}
if(images){assert(files.length===3,'Trois PDF de zones d’images');assert(files[0].images.flat().some(i=>i.imageKey==='main'&&i.width>2000),'Image principale pleine largeur dans le PDF');}
if(polish){assert(files.length===7,'Sept scénarios polish');assert(files.filter(f=>f.kind==='poster'&&f.layout==='cards'&&f.mode==='choices'&&f.pages===1).length===2,'Trois choix sur une page : 3 et 2+1');}
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
      // Poppler arrondit séparément les axes A4 (ex. paysage 3508×2481).
      // Garder deux pixels de la marge blanche réelle, sans modifier les pixels
      // ni reconstruire la matrice, évite une découpe à la limite du raster.
      const x=Math.floor(q.x/planWidth*image.width)-2,y=Math.floor(q.y/planHeight*image.height)-2;
      const width=Math.ceil(q.size/planWidth*image.width)+5,height=Math.ceil(q.size/planHeight*image.height)+5;
      assert(x>=0&&y>=0&&x+width<=image.width&&y+height<=image.height,'Découpe QR complète avec sa marge réelle');
      const crop=new Uint8ClampedArray(width*height*4);
      for(let row=0;row<height;row++)crop.set(rgba.subarray(((y+row)*image.width+x)*4,((y+row)*image.width+x+width)*4),row*width*4);
      assert(jsQR(crop,width,height)?.data===q.url,'QR réellement décodé depuis le PDF : '+file.name+', page '+(index+1));decoded++;
    }
  }
}
console.log(`PDF Poppler : ${checks} contrôles réussis, ${files.length} PDF A4 et ${decoded} QR décodés sans perte.`);
