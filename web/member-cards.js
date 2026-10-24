import {groupBackdropCanvas} from './card-backdrop.js';
import {PDFDocument} from '../vendor/pdf.js';
import {drawQr} from './qr.js';
import {cardLayout,cardText} from './card-layout.js';
import {memberCardModel} from './member-card-model.js';
export const cardQrGeometry=(model,baseUrl)=>cardLayout(model,baseUrl).qr;
async function image(ctx,preset,tier,x,y,width,height=width){if(!preset)return;const img=new Image();await new Promise((yes,no)=>{img.onload=yes;img.onerror=()=>no(new Error('Illustration intégrée indisponible.'));img.src=preset[tier];});const scale=Math.min(width/img.naturalWidth,height/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,x+(width-w)/2,y+(height-h)/2,w,h);img.src='';}
export async function drawMemberCard(ctx,model,baseUrl,x=0,y=0){
  const l=cardLayout(model,baseUrl),c=model.colors,t=cardText(ctx,model,l);ctx.save();ctx.translate(x,y);ctx.textAlign='left';ctx.fillStyle=c.background;ctx.strokeStyle=c.line;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(0,0,l.width,l.height,26);ctx.fill();ctx.stroke();
  if(model.groupBackdrop?.enabled&&model.groupBackdrop.visuals.length){const bg=await groupBackdropCanvas(model,l);ctx.drawImage(bg,0,0);bg.width=bg.height=1;}
  const h=l.header;ctx.fillStyle=c.soft;ctx.beginPath();ctx.roundRect(h.x,h.y,h.width,h.height,14);ctx.fill();ctx.fillStyle=c.accent;ctx.font='bold 32px system-ui';ctx.fillText('Voti',h.x+22,h.y+44);ctx.font='26px system-ui';ctx.textAlign='right';ctx.fillText(model.label,h.x+h.width-22,h.y+43);ctx.textAlign='left';
  const text=(r,v,color)=>{ctx.fillStyle=color;ctx.font=`${v.bold?'bold ':''}${v.font}px system-ui`;v.lines.forEach((line,i)=>ctx.fillText(line,r.x,r.y+v.font+i*v.lineHeight));};
  text(l.name,t.name,c.ink);text(l.space,t.space,c.muted);
  const m=l.member;await image(ctx,model.memberVisual,'large',m.x,m.y,m.width,m.height);
  for(const[g,group]of model.groups.slice(0,3).entries()){const y=l.groups.y+g*l.groupRow;await image(ctx,group.visual,'icon',l.groups.x,y,l.groupIcon);text({x:l.groups.x+(group.visual?l.groupIcon+l.groupGap:0),y},t.groups[g],c.ink);}
  if(model.groups.length>3){ctx.fillStyle=c.muted;ctx.font='24px system-ui';ctx.fillText('Et '+(model.groups.length-3)+' autre(s) groupes',l.groups.x,l.groups.y+3*l.groupRow+24);}
  drawQr(ctx,l.qr.matrix,l.qr.x,l.qr.y,l.qr.scale);ctx.fillStyle=c.ink;ctx.font='bold 29px system-ui';ctx.textAlign='center';ctx.fillText(model.instruction,l.footer.x+l.footer.width/2,l.footer.y+29);ctx.restore();return l;
}

/** Même modèle/thème que l'écran ; secret en mémoire et export explicite. */
export async function memberCardsPdf(cards,baseUrl,{catalog}={}){
  if(!Array.isArray(cards)||!cards.length||cards.length>200)throw new Error('Choisis entre 1 et 200 cartes.');
  const models=cards.map(card=>memberCardModel(card,catalog)),pdf=await PDFDocument.create();pdf.setTitle('Cartes Voti individuelles');pdf.setCreator('Voti');
  for(let start=0;start<cards.length;start+=8){
    const canvas=document.createElement('canvas');canvas.width=2480;canvas.height=3508;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,2480,3508);
    for(const [index,model]of models.slice(start,start+8).entries())await drawMemberCard(ctx,model,baseUrl,80+(index%2)*1200,80+Math.floor(index/2)*820);
    const bytes=await new Promise((resolve,reject)=>canvas.toBlob(async blob=>{if(!blob)return reject(new Error('PDF indisponible.'));resolve(new Uint8Array(await blob.arrayBuffer()));},'image/png'));
    const image=await pdf.embedPng(bytes),page=pdf.addPage([595.2756,841.8898]);page.drawImage(image,{x:0,y:0,width:595.2756,height:841.8898});canvas.width=canvas.height=1;
  }
  return new Blob([await pdf.save()],{type:'application/pdf'});
}
