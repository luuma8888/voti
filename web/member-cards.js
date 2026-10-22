import {PDFDocument} from '../vendor/pdf.js';
import {createQrMatrix,drawQr} from './qr.js';
import {buildMemberUrl,memberName,spaceName} from '../shared/spaces.js';
function lines(context,text,width){const result=[];let line='';for(const character of String(text)){if(context.measureText(line+character).width>width&&line){result.push(line);line='';}line+=character;}if(line)result.push(line);return result;}

/** PDF secret de cartes fictives/réelles uniquement sur demande explicite. */
export async function memberCardsPdf(cards,baseUrl){
  if(!Array.isArray(cards)||!cards.length||cards.length>100)throw new Error('Choisis entre 1 et 100 cartes.');
  cards=cards.map(card=>({credential:card.credential,displayName:memberName(card.displayName),spaceName:spaceName(card.spaceName)}));
  const pdf=await PDFDocument.create();
  for(let start=0;start<cards.length;start+=8){
    const canvas=document.createElement('canvas');canvas.width=2480;canvas.height=3508;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,2480,3508);
    for(const [index,card]of cards.slice(start,start+8).entries()){
      const x=80+(index%2)*1200,y=80+Math.floor(index/2)*820;ctx.strokeStyle='#c8c4d1';ctx.strokeRect(x,y,1120,760);
      ctx.fillStyle='#24263c';ctx.font='bold 38px system-ui';ctx.fillText('Carte Voti',x+35,y+65);
      ctx.font='30px system-ui';for(const [i,line]of lines(ctx,card.displayName,1050).entries())ctx.fillText(line,x+35,y+115+i*34);
      ctx.font='25px system-ui';for(const [i,line]of lines(ctx,card.spaceName,1050).entries())ctx.fillText(line,x+35,y+190+i*28);
      const matrix=createQrMatrix(buildMemberUrl(baseUrl,card.credential)),scale=Math.max(4,Math.floor(400/matrix.size));if(matrix.size*scale>400)throw new Error('Le lien est trop long pour une carte A4 lisible.');drawQr(ctx,matrix,Math.round(x+(1120-matrix.size*scale)/2),y+285,scale);
      ctx.fillStyle='#24263c';ctx.font='28px system-ui';ctx.fillText('Garde cette carte pour toi.',x+35,y+720);
    }
    const bytes=await new Promise((resolve,reject)=>canvas.toBlob(async blob=>{if(!blob)return reject(new Error('PDF indisponible.'));resolve(new Uint8Array(await blob.arrayBuffer()));},'image/png'));
    const image=await pdf.embedPng(bytes),page=pdf.addPage([595.2756,841.8898]);page.drawImage(image,{x:0,y:0,width:595.2756,height:841.8898});canvas.width=canvas.height=1;
  }
  return new Blob([await pdf.save()],{type:'application/pdf'});
}
