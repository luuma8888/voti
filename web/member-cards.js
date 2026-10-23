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
      const x=80+(index%2)*1200,y=80+Math.floor(index/2)*820;
      ctx.fillStyle='#f3f5f0';ctx.strokeStyle='#b5c7bf';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,1120,760,26);ctx.fill();ctx.stroke();
      ctx.fillStyle='#dcebe2';ctx.beginPath();ctx.roundRect(x+18,y+18,1084,64,14);ctx.fill();
      ctx.fillStyle='#264b44';ctx.font='bold 32px system-ui';ctx.fillText('Voti',x+40,y+62);ctx.font='26px system-ui';ctx.fillText('MA CARTE PERSONNELLE',x+630,y+61);
      ctx.fillStyle='#24263c';ctx.font='bold 40px system-ui';for(const [i,line]of lines(ctx,card.displayName,1030).slice(0,3).entries())ctx.fillText(line,x+45,y+133+i*45);
      let spaceFont=25;ctx.font=`${spaceFont}px system-ui`;while(lines(ctx,card.spaceName,1030).length>2&&spaceFont>18)ctx.font=`${--spaceFont}px system-ui`;
      for(const [i,line]of lines(ctx,card.spaceName,1030).entries())ctx.fillText(line,x+45,y+246+i*29);
      const matrix=createQrMatrix(buildMemberUrl(baseUrl,card.credential)),scale=Math.max(4,Math.floor(400/matrix.size));if(matrix.size*scale>400)throw new Error('Le lien est trop long pour une carte A4 lisible.');drawQr(ctx,matrix,Math.round(x+(1120-matrix.size*scale)/2),y+285,scale);
      ctx.fillStyle='#24263c';ctx.font='bold 29px system-ui';ctx.textAlign='center';ctx.fillText('Garde cette carte pour toi.',x+560,y+723);ctx.textAlign='left';
    }
    const bytes=await new Promise((resolve,reject)=>canvas.toBlob(async blob=>{if(!blob)return reject(new Error('PDF indisponible.'));resolve(new Uint8Array(await blob.arrayBuffer()));},'image/png'));
    const image=await pdf.embedPng(bytes),page=pdf.addPage([595.2756,841.8898]);page.drawImage(image,{x:0,y:0,width:595.2756,height:841.8898});canvas.width=canvas.height=1;
  }
  return new Blob([await pdf.save()],{type:'application/pdf'});
}
