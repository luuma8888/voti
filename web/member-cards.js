import {PDFDocument} from '../vendor/pdf.js';
import {createQrMatrix,drawQr} from './qr.js';
import {buildMemberUrl} from '../shared/spaces.js';
import {memberCardModel} from './member-card-model.js';
function lines(context,text,width){const result=[];let line='';for(const character of String(text)){if(context.measureText(line+character).width>width&&line){result.push(line);line='';}line+=character;}if(line)result.push(line);return result;}

export function cardQrGeometry(model,baseUrl){const matrix=createQrMatrix(buildMemberUrl(baseUrl,model.credential)),scale=Math.max(4,Math.floor(400/matrix.size)),size=matrix.size*scale;if(size>400)throw new Error('Le lien est trop long pour une carte A4 lisible.');return{matrix,scale,size,x:Math.round(model.groups.length||model.memberVisual?1120-size-40:(1120-size)/2),y:300};}
async function image(ctx,preset,x,y,size){if(!preset)return;const img=new Image();await new Promise((yes,no)=>{img.onload=yes;img.onerror=()=>no(new Error('Illustration intégrée indisponible.'));img.src=preset.src;});ctx.drawImage(img,x,y,size,size);img.src='';}
export async function drawMemberCard(ctx,model,baseUrl,x=0,y=0){
  const c=model.colors;ctx.save();ctx.translate(x,y);ctx.textAlign='left';ctx.fillStyle=c.background;ctx.strokeStyle=c.line;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(0,0,1120,760,26);ctx.fill();ctx.stroke();
  ctx.fillStyle=c.soft;ctx.beginPath();ctx.roundRect(18,18,1084,64,14);ctx.fill();ctx.fillStyle=c.accent;ctx.font='bold 32px system-ui';ctx.fillText('Voti',40,62);ctx.font='26px system-ui';ctx.textAlign='right';ctx.fillText(model.label,1080,61);ctx.textAlign='left';
  let font=64;ctx.font=`bold ${font}px system-ui`;while(lines(ctx,model.memberDisplayName,1030).length>2&&font>42)ctx.font=`bold ${--font}px system-ui`;
  ctx.fillStyle=c.ink;for(const[i,line]of lines(ctx,model.memberDisplayName,1030).slice(0,3).entries())ctx.fillText(line,45,145+i*(font+4));
  let spaceFont=28;ctx.font=`${spaceFont}px system-ui`;while(lines(ctx,model.spaceName,1030).length>2&&spaceFont>18)ctx.font=`${--spaceFont}px system-ui`;
  ctx.fillStyle=c.muted;for(const[i,line]of lines(ctx,model.spaceName,1030).slice(0,2).entries())ctx.fillText(line,45,260+i*32);
  await image(ctx,model.memberVisual,45,350,180);
  let gy=360;const gx=model.memberVisual?250:45,gw=model.memberVisual?370:570;ctx.font='28px system-ui';ctx.fillStyle=c.ink;
  for(const group of model.groups.slice(0,3)){await image(ctx,group.visual,gx,gy-27,56);const offset=group.visual?68:0,all=lines(ctx,group.name,gw-offset),text=all.slice(0,2);if(all.length>2){while(ctx.measureText(text[1]+'…').width>gw-offset)text[1]=text[1].slice(0,-1);text[1]+='…';}for(const[i,line]of text.entries())ctx.fillText(line,gx+offset,gy+i*32);gy+=Math.max(70,text.length*32+14);}
  if(model.groups.length>3){const count=model.groups.length-3;ctx.fillStyle=c.muted;ctx.font='25px system-ui';ctx.fillText('Et '+count+' autre'+(count>1?'s groupes':' groupe'),gx,gy);}
  const qr=cardQrGeometry(model,baseUrl);drawQr(ctx,qr.matrix,qr.x,qr.y,qr.scale);
  ctx.fillStyle=c.ink;ctx.font='bold 29px system-ui';ctx.textAlign='center';ctx.fillText(model.instruction,560,735);ctx.restore();
}

/** Même modèle/thème que l'écran ; secret en mémoire et export explicite. */
export async function memberCardsPdf(cards,baseUrl,{catalog}={}){
  if(!Array.isArray(cards)||!cards.length||cards.length>100)throw new Error('Choisis entre 1 et 100 cartes.');
  const models=cards.map(card=>memberCardModel(card,catalog)),pdf=await PDFDocument.create();pdf.setTitle('Cartes Voti individuelles');pdf.setCreator('Voti');
  for(let start=0;start<cards.length;start+=8){
    const canvas=document.createElement('canvas');canvas.width=2480;canvas.height=3508;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,2480,3508);
    for(const [index,model]of models.slice(start,start+8).entries())await drawMemberCard(ctx,model,baseUrl,80+(index%2)*1200,80+Math.floor(index/2)*820);
    const bytes=await new Promise((resolve,reject)=>canvas.toBlob(async blob=>{if(!blob)return reject(new Error('PDF indisponible.'));resolve(new Uint8Array(await blob.arrayBuffer()));},'image/png'));
    const image=await pdf.embedPng(bytes),page=pdf.addPage([595.2756,841.8898]);page.drawImage(image,{x:0,y:0,width:595.2756,height:841.8898});canvas.width=canvas.height=1;
  }
  return new Blob([await pdf.save()],{type:'application/pdf'});
}
