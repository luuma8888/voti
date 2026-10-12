import { PDFDocument } from '../vendor/pdf.js';
import { imageCrop, readableText } from './poster-design.js';
import { drawQr } from './qr.js';
import { validateAsset } from '../shared/assets.js';

/** Décodage de références locales uniquement. Pas de fetch ni d'URL externe. */
export async function loadPrintMedia(plan,posterAssets,pollAssets) {
  const media=new Map(),ids=new Set(plan.pages.flatMap(p=>p.nodes.filter(n=>n.type==='image').map(n=>n.id)));
  if(plan.design.background.assetId)ids.add(plan.design.background.assetId);
  try {
    for(const id of ids){
      const asset=await posterAssets?.get(id)||await pollAssets?.get(id);
      if(asset){await validateAsset(asset);const bitmap=await createImageBitmap(asset.blob);if(bitmap.width!==asset.width||bitmap.height!==asset.height){bitmap.close();throw new Error('Dimensions d’image incohérentes.');}media.set(id,bitmap);}
    }
    return media;
  } catch(error){for(const bitmap of media.values())bitmap.close();throw new Error('Image d’affiche illisible.',{cause:error});}
}
export function releasePrintMedia(media) { for(const bitmap of media.values())bitmap.close();media.clear(); }
function rounded(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function paintImage(c,image,node) {
  if(!image)return;
  const crop=imageCrop(image.width,image.height,node.width,node.height,node.fit,node.position);
  c.save();rounded(c,node.x,node.y,node.width,node.height,node.radius||0);c.clip();
  c.drawImage(image,node.x+crop.x,node.y+crop.y,crop.width,crop.height);c.restore();
}
/** Un seul renderer et un seul plan, basse résolution ou A4 ~300 dpi. */
export function paintPrintPage(canvas,plan,index,{media=new Map(),logo}={}) {
  const c=canvas.getContext('2d'),scale=canvas.width/plan.width,palette=plan.palette;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.scale(scale,scale);
  c.fillStyle=palette.bg;c.fillRect(0,0,plan.width,plan.height);
  const bg=plan.design.background,image=media.get(bg.assetId);
  if(image){c.globalAlpha=bg.intensity;paintImage(c,image,{x:0,y:0,width:plan.width,height:plan.height,fit:bg.fit,position:bg.position});c.globalAlpha=1;
    c.fillStyle=bg.veil==='dark'?'rgba(0,0,0,.18)':'rgba(255,255,255,.18)';c.fillRect(0,0,plan.width,plan.height);}
  for(const n of plan.pages[index].nodes){
    if(n.type==='surface'){c.fillStyle=palette[n.color];rounded(c,n.x,n.y,n.width,n.height,n.radius);c.fill();}
    if(n.type==='image'){c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';paintImage(c,media.get(n.id),n);}
    if(n.type==='logo'&&logo?.naturalWidth)c.drawImage(logo,n.x,n.y,n.width,n.height);
    if(n.type==='text'){
      const color=n.color==='onPrimary'?readableText(palette.primary):n.color==='onSecondary'?readableText(palette.secondary):palette[n.color];
      c.fillStyle=color;c.font=`${n.weight} ${n.font}px ${plan.family}`;c.textBaseline='top';
      n.lines.forEach((line,i)=>c.fillText(line,n.x,n.y+i*Math.ceil(n.font*1.28)));
    }
    if(n.type==='bar'){c.fillStyle=palette.bg;rounded(c,n.x,n.y,n.width,n.height,12);c.fill();c.fillStyle=palette.bar;if(n.value>0){rounded(c,n.x,n.y,n.width*n.value,n.height,12);c.fill();}}
  }
  c.setTransform(1,0,0,1,0,0);
  for(const q of plan.pages[index].qrs){
    if(scale===1)drawQr(c,q.matrix,q.x,q.y,q.pixels);
    else {
      // Aperçu fidèle en taille ; grille entière et absence d'antialiasing
      // garanties dans le PDF final, sans imposer une taille QR déformée à l'aperçu.
      const tile=document.createElement('canvas');tile.width=tile.height=q.size;
      try{drawQr(tile.getContext('2d'),q.matrix,0,0,q.pixels);c.imageSmoothingEnabled=false;c.drawImage(tile,Math.round(q.x*scale),Math.round(q.y*scale),Math.round(q.size*scale),Math.round(q.size*scale));}
      finally{tile.width=tile.height=1;}
    }
  }
}
export function printMeasure() {
  const canvas=document.createElement('canvas'),c=canvas.getContext('2d');
  return {measure:(t,size,weight,family)=>{c.font=`${weight} ${size}px ${family}`;return c.measureText(t).width;},release:()=>{canvas.width=canvas.height=1;}};
}
export async function exportPrintPdf(plan,options={}) {
  const canvas=document.createElement('canvas');canvas.width=plan.width;canvas.height=plan.height;
  const points=plan.width>plan.height?[841.8898,595.2756]:[595.2756,841.8898];
  const pdf=await PDFDocument.create();pdf.setTitle(plan.kind==='results'?'Résultats Voti':'Affiche Voti');pdf.setCreator('Voti');
  try {
    for(let index=0;index<plan.pages.length;index++){
      paintPrintPage(canvas,plan,index,options);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PDF indisponible.');
      const png=await pdf.embedPng(await blob.arrayBuffer()),sheet=pdf.addPage(points);sheet.drawImage(png,{x:0,y:0,width:points[0],height:points[1]});
    }
    return {bytes:await pdf.save(),plan};
  } finally {canvas.width=canvas.height=1;}
}
