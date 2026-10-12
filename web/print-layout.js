import { ensure } from '../shared/validation.js';
import { validateDefinition } from '../shared/validation.js';
import { isPublicPollId } from '../shared/relay.js';
import { buildPollUrl, buildChoiceUrl, buildResultsUrl } from '../shared/qr-links.js';
import { createQrMatrix } from './qr.js';
import { validateDesign, designPalette, TYPOGRAPHIES } from './poster-design.js';

export const PRINT_WIDTH=2480, PRINT_HEIGHT=3508;
const PAD=140;
export function wrapPrintText(text,width,measure) {
  const lines=[];
  for(const paragraph of String(text).split(/\r?\n/)) {
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      if(line&&measure(line+' '+word)>width){lines.push(line);line='';}
      if(measure(word)<=width){line+=(line?' ':'')+word;continue;}
      if(line){lines.push(line);line='';}
      for(const char of word){if(line&&measure(line+char)>width){lines.push(line);line='';}line+=char;}
    }
    lines.push(line);
  }
  return lines;
}
/** Plan public whitelisté : ni état complet, ni stockage, ni bulletin. */
function publicContent(poll) {
  validateDefinition(poll.definition);
  ensure(['published','closed'].includes(poll.status),'Sondage non ouvert.');
  return {question:poll.definition.question,description:poll.definition.description||'',status:poll.status,
    choices:poll.definition.choices.map(c=>({id:c.id,label:c.label,imageRef:c.imageRef})),
    imageRef:poll.definition.pollImageAssetId};
}
function basePlan(poll,design,measure) {
  const d=validateDesign(design),content=publicContent(poll);
  const landscape=d.layout==='mosaic';
  const width=landscape?PRINT_HEIGHT:PRINT_WIDTH,height=landscape?PRINT_WIDTH:PRINT_HEIGHT;
  const family=TYPOGRAPHIES.find(t=>t[0]===d.typography)[2];
  const font=d.typography==='display'?80:d.typography==='editorial'?78:d.typography==='soft'?74:76;
  const text=(value,w,size=44,weight=400)=>wrapPrintText(value,w,t=>measure(t,size,weight,family));
  const plan={width,height,pages:[],palette:designPalette(d),family,design:d,content};
  const page=()=>({nodes:[],qrs:[],items:[]});
  function words(p,value,x,y,w,size=44,weight=400,color='text') {
    const lines=text(value,w,size,weight);p.nodes.push({type:'text',lines,x,y,width:w,font:size,weight,color});
    return lines.length*Math.ceil(size*1.28);
  }
  function surface(p,x,y,w,h,color='surface',radius=32){p.nodes.push({type:'surface',x,y,width:w,height:h,color,radius});}
  function image(p,id,x,y,w,h,fit='cover',position='center'){if(id)p.nodes.push({type:'image',id,x,y,width:w,height:h,fit,position,radius:28});}
  function qr(p,url,x,y,maxSize,kind){const matrix=createQrMatrix(url),pixels=Math.floor(maxSize/matrix.size);ensure(pixels>=5,'QR trop dense.');const q={url,x:Math.round(x),y:Math.round(y),size:matrix.size*pixels,pixels,matrix,kind};p.qrs.push(q);return q;}
  function header(p,continued=false) {
    surface(p,PAD,140,width-PAD*2,170,'primary',28);
    words(p,'Voti · Choisir ensemble, simplement.',PAD+40,195,width-PAD*2-180,40,700,'onPrimary');
    p.nodes.push({type:'logo',x:width-PAD-100,y:185,width:70,height:70});
    const titleFont=continued?Math.min(font,60):font,titleWeight=d.typography==='display'?800:d.typography==='soft'?600:700;
    let y=365;const h=words(p,content.question,PAD+36,y,width-PAD*2-72,titleFont,titleWeight);
    surface(p,PAD,325,width-PAD*2,h+70);const title=p.nodes.splice(p.nodes.length-2,1)[0];p.nodes.push(title);y+=h+48;
    if(!continued&&content.description){const h=words(p,content.description,PAD+36,y,width-PAD*2-72,38);surface(p,PAD,y-22,width-PAD*2,h+40);const t=p.nodes.splice(p.nodes.length-2,1)[0];p.nodes.push(t);y+=h+65;}
    return y;
  }
  return {plan,content,text,words,surface,image,qr,page,header};
}

export function makeStudioPlan(poll,design,{baseUrl,measure=(t,size)=>[...t].length*size*.6}={}) {
  const id=poll.remoteRef?.pollId;
  ensure(isPublicPollId(id)&&poll.remoteRef.revision>0,'Publie d’abord ce sondage en ligne pour créer ses QR de partage.');
  const tools=basePlan(poll,design,measure),{plan,content,text,words,surface,image,qr,page,header}=tools;
  const {width:w,height:h}=plan;const d=plan.design,main=d.media.main||(d.usePollImages?content.imageRef:null);
  plan.kind='poster';plan.mode=d.mode;plan.pollId=id;plan.accessUrl=buildPollUrl(id,baseUrl);
  const limit=h-650;
  let p=page(),y=header(p);
  function finish() {
    surface(p,PAD,h-625,w-PAD*2,500);
    words(p,d.mode==='choices'?'Ce QR ouvre directement la confirmation de ce choix. Le vote n’est envoyé qu’après validation.':'Scanne pour participer.',PAD+35,h-585,w-PAD*2-520,36,700);
    words(p,'Voir les résultats',PAD+35,h-425,w-PAD*2-540,38,700,'accentText');
    words(p,buildResultsUrl(id,baseUrl),PAD+35,h-360,w-PAD*2-550,28);
    qr(p,buildResultsUrl(id,baseUrl),w-PAD-470,h-585,440,'results');
    surface(p,PAD,h-80,w-PAD*2,65);
    words(p,`A4 · Imprimer à 100 % · ${plan.pages.length+1}`,PAD+20,h-65,w-PAD*2-40,28);
    plan.pages.push(p);ensure(plan.pages.length<=8,'Affiche trop longue.');
  }
  function next(){finish();p=page();y=header(p,true);}
  function room(size){if(y+size>limit)next();ensure(y+size<=limit,'Contenu trop long pour cette disposition.');}
  // Les quatre accès sont des compositions distinctes, pas seulement des palettes.
  if(d.mode==='access') {
    if(main){room(d.layout==='magazine'?520:360);image(p,main,PAD,y,w-PAD*2,d.layout==='magazine'?490:330);y+=d.layout==='magazine'?530:370;}
    const side=d.layout==='magazine',compact=d.layout==='mosaic';
    const listWidth=side?(w-PAD*2)*.49:w-PAD*2;
    const qrSize=compact?1000:side?950:1050;
    const cols=d.layout==='cards'?2:compact?3:1,gap=40,tile=(listWidth-gap*(cols-1))/cols;
    for(let i=0;i<content.choices.length;i+=cols) {
      const row=content.choices.slice(i,i+cols),refs=row.map(c=>d.media.choices[c.id]||(d.usePollImages?c.imageRef:null));
      const hasImages=refs.some(Boolean),imageHeight=hasImages?(cols===1?270:330):0;
      const labelWidth=cols===1&&hasImages?tile-510:tile-90;
      const height=Math.max(...row.map((c,col)=>text(`${i+col+1}. ${c.label}`,labelWidth,44,700).length))*57+65+(cols!==1?imageHeight:0);
      const rowHeight=Math.max(height,cols===1&&hasImages?330:0);
      room(side&&!p.qrs.some(q=>q.kind==='access')?Math.max(rowHeight,qrSize+130):rowHeight);
      if(side&&!p.qrs.some(q=>q.kind==='access'))qr(p,plan.accessUrl,PAD+listWidth+65,y+70,qrSize,'access');
      row.forEach((c,col)=>{
        const x=PAD+col*(tile+gap);surface(p,x,y,tile,rowHeight);
        if(hasImages)image(p,refs[col],x+25,y+25,cols===1?420:tile-50,imageHeight);
        const tx=x+(cols===1&&hasImages?470:30),ty=y+30+(cols!==1&&hasImages?imageHeight:0);
        words(p,`${i+col+1}. ${c.label}`,tx,ty,labelWidth,44,700);
        p.items.push({label:c.label,x,y,width:tile,height:rowHeight});
      });y+=rowHeight+gap;
    }
    if(!side) {
      room(qrSize+155);surface(p,PAD,y,w-PAD*2,qrSize+140);
      words(p,'Scanne pour participer',PAD+35,y+35,w-PAD*2-70,44,700,'accentText');
      qr(p,plan.accessUrl,(w-qrSize)/2,y+105,qrSize,'access');y+=qrSize+155;
    }
  } else {
    if(main){const hero=d.layout==='mosaic'?200:330;room(hero+40);image(p,main,PAD,y,w-PAD*2,hero);y+=hero+40;}
    for(let i=0;i<content.choices.length;) {
      const columns=d.layout==='essential'||(d.layout==='magazine'&&i===0)?1:d.layout==='mosaic'?3:2;
      const gap=48,tile=(w-PAD*2-gap*(columns-1))/columns;
      const row=content.choices.slice(i,i+columns);
      const labels=row.map(c=>text(c.label,columns===1?tile-720:tile-70,44,700));
      const hasMedia=row.some(c=>d.media.choices[c.id]||(d.usePollImages&&c.imageRef));
      const mediaHeight=d.layout==='mosaic'?180:280;
      const height=columns===1?Math.max(730,Math.max(...labels.map(ls=>ls.length))*57+80):Math.max(...labels.map(ls=>ls.length))*57+740+(hasMedia?mediaHeight+30:0);
      room(height);
      row.forEach((c,col)=>{
        const x=PAD+col*(tile+gap),ref=d.media.choices[c.id]||(d.usePollImages?c.imageRef:null);
        surface(p,x,y,tile,height);
        if(d.layout==='magazine')surface(p,x,y,18,height,col%2?'secondary':'primary',8);
        let cy=y+35;
        if(columns!==1&&hasMedia){image(p,ref,x+25,cy,tile-50,mediaHeight);cy+=mediaHeight+35;}
        if(columns===1&&ref)image(p,ref,x+30,cy,tile-760,310);
        if(columns===1&&ref)cy+=345;
        words(p,c.label,x+35,cy,columns===1?tile-760:tile-70,44,700);
        const url=buildChoiceUrl(id,c.id,baseUrl),qx=columns===1?x+tile-670:x+40,qy=columns===1?y+40:cy+labels[col].length*57+30;
        const q=qr(p,url,qx,qy,560,'choice');
        words(p,url,qx,qy+q.size+22,columns===1?630:tile-80,28);
        p.items.push({label:c.label,x,y,width:tile,height,choiceId:c.id});
      });y+=height+48;i+=columns;
    }
  }
  finish();return plan;
}

/** Validate la seule projection disponible : ne lit et n'accepte aucun bulletin. */
export function authorizedResults(poll,result) {
  ensure(result?.available===true,'Les résultats ne sont pas encore disponibles.');
  ensure(['published','closed'].includes(poll.status),'Sondage non publié.');
  const total=result.totalBallots;
  ensure(Number.isSafeInteger(total)&&total>0&&total>=poll.resultRules.minimumResponses,'Total de résultats incohérent.');
  ensure(poll.resultRules.releaseMode==='threshold'||(poll.resultRules.releaseMode==='closed'&&poll.status==='closed'),'Les résultats ne sont pas encore disponibles.');
  ensure(Array.isArray(result.choices)&&result.choices.length===poll.definition.choices.length,'Résultats incomplets.');
  const seen=new Set();let sum=0;
  const choices=result.choices.map(c=>{
    const original=poll.definition.choices.find(v=>v.id===c.id);
    ensure(original&&!seen.has(c.id)&&c.label===original.label,'Résultat de choix invalide.');seen.add(c.id);
    ensure(Number.isSafeInteger(c.count)&&c.count>=0&&Number.isFinite(c.percentage)&&Math.abs(c.percentage-c.count/total*100)<.00001,'Résultats incohérents.');
    sum+=c.count;return {id:c.id,label:c.label,count:c.count,percentage:c.percentage};
  });ensure(sum===total,'Total différent de la somme des choix.');return {total,choices};
}
export function makeResultsPlan(poll,result,design,{style='summary',baseUrl,exportDate=new Date(),measure=(t,s)=>[...t].length*s*.6,usePosterMedia=false}={}) {
  const projection=authorizedResults(poll,result);
  ensure(['summary','report'].includes(style),'Style de résultats inconnu.');
  const normalized=validateDesign(design);normalized.layout='cards';normalized.background.assetId=null;
  const {plan,content,words,surface,image,qr,page,header}=basePlan(poll,normalized,measure);
  plan.kind='results';plan.style=style;plan.total=projection.total;
  ensure(exportDate instanceof Date&&!Number.isNaN(exportDate.getTime()),'Date d’export invalide.');
  plan.exportLabel=exportDate.toLocaleString('fr-FR');
  let p=page(),y=header(p),limit=plan.height-650;
  const url=isPublicPollId(poll.remoteRef?.pollId)&&poll.remoteRef.revision>0?buildResultsUrl(poll.remoteRef.pollId,baseUrl):null;
  function finish(){
    surface(p,PAD,plan.height-620,plan.width-PAD*2,485);
    words(p,content.status==='published'?'Sondage ouvert · Résultats au moment de l’export.':'Sondage fermé · État final connu.',PAD+35,plan.height-575,plan.width-PAD*2-550,36,700);
    words(p,'Date d’export : '+plan.exportLabel,PAD+35,plan.height-445,plan.width-PAD*2-550,32);
    if(url){words(p,'Résultats publics : '+url,PAD+35,plan.height-360,plan.width-PAD*2-550,28);qr(p,url,plan.width-PAD-470,plan.height-575,440,'results');}
    surface(p,PAD,plan.height-80,plan.width-PAD*2,65);
    words(p,`Voti · A4 · ${plan.pages.length+1}`,PAD+20,plan.height-65,plan.width-PAD*2-40,28);plan.pages.push(p);ensure(plan.pages.length<=8,'Rapport trop long.');
  }
  function room(height){if(y+height>limit){finish();p=page();y=header(p,true);}ensure(y+height<=limit,'Rapport trop dense.');}
  room(180);surface(p,PAD,y,plan.width-PAD*2,155,'primary');words(p,`${projection.total} réponses`,PAD+35,y+35,plan.width-PAD*2-70,60,700,'onPrimary');y+=190;
  const main=usePosterMedia?normalized.media.main:null;
  const hero=main||(normalized.usePollImages?content.imageRef:null);
  if(hero){room(400);image(p,hero,PAD,y,plan.width-PAD*2,360);y+=400;}
  const ordered=style==='summary'?[...projection.choices].sort((a,b)=>b.count-a.count):projection.choices;
  for(const [index,c] of ordered.entries()) {
    const ref=(usePosterMedia?normalized.media.choices[c.id]:null)||(normalized.usePollImages?content.choices.find(v=>v.id===c.id)?.imageRef:null);
    const label=(style==='summary'?`${index+1}. `:'')+c.label;
    const labelWidth=plan.width-PAD*2-110-(ref?400:0),lines=wrapPrintText(label,labelWidth,t=>measure(t,44,700,plan.family));
    const height=Math.max(style==='report'?270:225,lines.length*57+160,ref?375:0);
    room(height);surface(p,PAD,y,plan.width-PAD*2,height);
    if(ref)image(p,ref,PAD+30,y+25,330,height-50);
    const x=PAD+(ref?400:35),width=labelWidth;
    words(p,label,x,y+28,width,44,700);
    const chartY=y+lines.length*57+46;
    words(p,`${c.count} vote${c.count===1?'':'s'} · ${c.percentage.toLocaleString('fr-FR',{maximumFractionDigits:1})} %`,x,chartY,width,38,700,'accentText');
    p.nodes.push({type:'bar',x,y:chartY+68,width,height:34,value:c.percentage/100});
    p.items.push({label:c.label,count:c.count,percentage:c.percentage,x:PAD,y,width:plan.width-PAD*2,height});y+=height+38;
  }
  finish();return plan;
}
