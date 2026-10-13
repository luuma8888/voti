import { ensure } from '../shared/validation.js';
import { validateDefinition } from '../shared/validation.js';
import { participationRules, normalizedText } from '../shared/participation.js';
import { isPublicPollId } from '../shared/relay.js';
import { buildPollUrl, buildChoiceUrl, buildResultsUrl } from '../shared/qr-links.js';
import { createQrMatrix } from './qr.js';
import { validateDesign, designPalette, TITLE_TYPOGRAPHIES, BODY_TYPOGRAPHIES, safeSurfaceOpacity, defaultImageSettings, imageHeightValue } from './poster-design.js';

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
function basePlan(poll,design,measure,mediaSizes={}) {
  const d=validateDesign(design),content=publicContent(poll);
  const landscape=d.layout==='mosaic';
  const width=landscape?PRINT_HEIGHT:PRINT_WIDTH,height=landscape?PRINT_WIDTH:PRINT_HEIGHT;
  const family=BODY_TYPOGRAPHIES.find(t=>t[0]===d.bodyTypography)[2],titleFamily=TITLE_TYPOGRAPHIES.find(t=>t[0]===d.titleTypography)[2];
  const spacing={compact:24,balanced:32,airy:48}[d.densityPreset],font={compact:64,balanced:72,airy:80}[d.densityPreset];
  const text=(value,w,size=44,weight=400)=>wrapPrintText(value,w,t=>measure(t,size,weight,family));
  const palette=designPalette(d),opacity=safeSurfaceOpacity(palette.surface,palette.text,d.textSurfaceOpacity);
  if(opacity<1)palette.accentText=palette.text;
  const plan={width,height,pages:[],palette,family,titleFamily,design:d,content,warnings:[],surfaceOpacity:opacity};
  if(opacity>d.textSurfaceOpacity+.001)plan.warnings.push('Voile des textes renforcé automatiquement pour conserver un contraste sûr.');
  const page=()=>({nodes:[],qrs:[],items:[]});
  function words(p,value,x,y,w,size=44,weight=400,color='text',fontFamily=family) {
    const lines=wrapPrintText(value,w,t=>measure(t,size,weight,fontFamily));p.nodes.push({type:'text',lines,x,y,width:w,font:size,weight,color,family:fontFamily});
    return lines.length*Math.ceil(size*1.28);
  }
  function surface(p,x,y,w,h,color='surface',radius=32){p.nodes.push({type:'surface',x,y,width:w,height:h,color,radius,opacity:color==='surface'?opacity:1});}
  function imageRatio(id,key){const s=d.imageSettings[key]||defaultImageSettings(),dimensions=mediaSizes[id];
    const ratio=s.ratio==='original'?(dimensions?dimensions.width/dimensions.height:16/9):s.ratio.split(':').map(Number).reduce((a,b)=>a/b);
    ensure(Number.isFinite(ratio)&&ratio>0,'Dimensions d’image invalides.');return ratio;}
  function imageFrame(id,key,w,autoHeight,maxHeight=Infinity){
    if(!id)return {width:0,height:0};const s=d.imageSettings[key]||defaultImageSettings(),full=s.ratio==='full-width',ratio=full?null:imageRatio(id,key);
    const requested=imageHeightValue(s.height,key,autoHeight),desired=full?requested:Math.min(w/ratio,requested);
    ensure(maxHeight>0,'Pas assez de place pour l’image : réduis la taille des QR ou change de disposition.');
    if(desired>maxHeight&&!plan.warnings.includes('Hauteur des images adaptée à la page pour préserver les QR et les textes.'))plan.warnings.push('Hauteur des images adaptée à la page pour préserver les QR et les textes.');
    const height=Math.min(desired,maxHeight);return {width:full?w:height*ratio,height};
  }
  function image(p,id,x,y,w,h,fit='cover',position='center',key='main'){
    if(!id)return;const s=d.imageSettings[key]||{...defaultImageSettings(),fit,focalY:position==='top'?0:position==='bottom'?1:.5};
    const ratio=s.ratio==='full-width'?w/h:imageRatio(id,key);
    const frameWidth=Math.min(w,h*ratio),frameHeight=frameWidth/ratio;
    p.nodes.push({type:'image',id,imageKey:key,x:x+(w-frameWidth)*({left:0,center:.5,right:1}[s.align]),y:y+(h-frameHeight)/2,width:frameWidth,height:frameHeight,fit:s.fit,position,radius:28,focalX:s.focalX,focalY:s.focalY});
  }
  function qr(p,url,x,y,maxSize,kind){const matrix=createQrMatrix(url),pixels=Math.floor(maxSize/matrix.size);ensure(pixels>=5&&pixels*matrix.size>=400,'QR trop dense : agrandis la zone ou réduis le nombre de choix par ligne.');const q={url,x:Math.round(x),y:Math.round(y),size:matrix.size*pixels,pixels,matrix,kind};
    const margin={large:30,compact:20,minimal:8}[d.qrSurfaceMode];surface(p,q.x-margin,q.y-margin,q.size+margin*2,q.size+margin*2,'qrSurface',12);p.qrs.push(q);return q;}
  function header(p,continued=false) {
    let y=180;
    if(d.headerMode!=='hidden'){
      const small=d.headerMode==='discreet',height=small?80:145;
      surface(p,PAD,140,width-PAD*2,height,'primary',24);
      words(p,small?'Voti':'Voti · Choisir ensemble, simplement.',PAD+35,small?160:180,width-PAD*2-150,small?32:40,700,'onPrimary');
      p.nodes.push({type:'logo',x:width-PAD-90,y:small?156:170,width:small?42:65,height:small?42:65});y=140+height+spacing+25;
    }
    const titleFont=continued?Math.min(font,58):font,titleWeight=d.titleTypography==='display'?800:700;
    const h=words(p,content.question,PAD+36,y,width-PAD*2-72,titleFont,titleWeight,'text',titleFamily);
    surface(p,PAD,y-20,width-PAD*2,h+40);const title=p.nodes.splice(p.nodes.length-2,1)[0];p.nodes.push(title);y+=h+spacing+30;
    surface(p,PAD,y-h-spacing-50,10,h+40,'primary',6);
    if(!continued&&content.description){const h=words(p,content.description,PAD+36,y,width-PAD*2-72,38);surface(p,PAD,y-22,width-PAD*2,h+40);const t=p.nodes.splice(p.nodes.length-2,1)[0];p.nodes.push(t);y+=h+65;}
    return y;
  }
  return {plan,content,text,words,surface,image,imageFrame,qr,page,header,spacing};
}

export function makeStudioPlan(poll,design,{baseUrl,measure=(t,size)=>[...t].length*size*.6,mediaSizes={}}={}) {
  const id=poll.remoteRef?.pollId;
  ensure(isPublicPollId(id)&&poll.remoteRef.revision>0,'Publie d’abord ce sondage en ligne pour créer ses QR de partage.');
  const tools=basePlan(poll,design,measure,mediaSizes),{plan,content,text,words,surface,image,imageFrame,qr,page,header,spacing}=tools;
  const {width:w,height:h}=plan;const d=plan.design,main=d.media.main||(d.usePollImages?content.imageRef:null);
  plan.kind='poster';plan.mode=d.mode;plan.pollId=id;plan.accessUrl=buildPollUrl(id,baseUrl);
  const footerHeight=550,limit=h-footerHeight-40;
  let p=page(),y=header(p);
  function finish() {
    surface(p,PAD,h-footerHeight,w-PAD*2,footerHeight-105);
    const q=qr(p,buildResultsUrl(id,baseUrl),w-PAD-440,h-footerHeight+30,430,'results');
    // Un vrai minimum physique, pas une réduction silencieuse au profit du texte.
    ensure(q.y+q.size<h-80,'QR résultats hors page.');
    words(p,d.mode==='choices'?'Ce QR ouvre directement la confirmation de ce choix. Le vote n’est envoyé qu’après validation.':'Scanne pour participer.',PAD+35,h-footerHeight+30,w-PAD*2-540,32,700);
    words(p,'Voir les résultats',PAD+35,h-footerHeight+180,w-PAD*2-540,36,700,'accentText');
    words(p,buildResultsUrl(id,baseUrl),PAD+35,h-footerHeight+240,w-PAD*2-550,26);
    surface(p,PAD,h-80,w-PAD*2,65);
    words(p,`A4 · Imprimer à 100 % · ${plan.pages.length+1}`,PAD+20,h-65,w-PAD*2-40,28);
    plan.pages.push(p);ensure(plan.pages.length<=8,'Affiche trop longue.');
  }
  function next(){finish();p=page();y=header(p,true);}
  function room(size){if(y+size>limit)next();ensure(y+size<=limit,'Contenu trop long pour cette disposition.');}
  const ref=c=>d.media.choices[c.id]||(d.usePollImages?c.imageRef:null);
  const autoMediaHeight={compact:240,balanced:600,airy:760}[d.densityPreset];
  const desiredChoice={small:440,medium:500,large:620}[d.qrSize];
  const defaultCols=d.layout==='essential'?1:d.layout==='mosaic'?3:2;
  const requested=d.choicesPerRow==='auto'?defaultCols:Number(d.choicesPerRow);
  function safeColumns(cols){
    while(cols>1){const tile=(w-PAD*2-spacing*(cols-1))/cols;
      const safe=content.choices.every(c=>{const m=createQrMatrix(buildChoiceUrl(id,c.id,baseUrl));return Math.floor((tile-70)/m.size)*m.size>=400&&Math.floor((tile-70)/m.size)>=5;});
      if(safe)break;cols--;}
    if(cols!==requested)plan.warnings.push('Nombre de colonnes réduit pour garder des QR lisibles.');return cols;
  }
  const cols=d.mode==='choices'?safeColumns(requested):requested;
  const rowLimit=limit-header(page(),true);
  function mainImage(reserve){if(!main)return;
    if(limit-y-spacing<400)next();
    const autoHeight=d.densityPreset==='compact'?480:Math.max(600,Math.min(1600,limit-y-reserve-spacing));
    const frame=imageFrame(main,'main',w-PAD*2,autoHeight,limit-y-spacing);
    room(frame.height+spacing);image(p,main,PAD,y,w-PAD*2,frame.height);y+=frame.height+spacing;
  }
  function choiceRow(i){
    const columns=d.layout==='magazine'&&i===0&&d.choicesPerRow==='auto'?1:cols,gap=spacing,tile=(w-PAD*2-gap*(columns-1))/columns,row=content.choices.slice(i,i+columns);
    const maxQr=Math.min(desiredChoice,tile-80),minChoice=Math.max(...row.map(c=>{const m=createQrMatrix(buildChoiceUrl(id,c.id,baseUrl));return m.size*Math.max(5,Math.ceil(400/m.size));}));
    if(maxQr<desiredChoice&&!plan.warnings.some(w=>w.startsWith('Taille du QR')))plan.warnings.push('Taille du QR adaptée à la largeur des colonnes, sans descendre sous le minimum sûr.');
    ensure(maxQr>=minChoice,'Cette taille de QR ne tient pas. Choisis moins de colonnes.');
    const hasMedia=row.some(c=>ref(c)),sideWidth=tile-maxQr-110;
    const horizontal=hasMedia&&d.choiceComposition==='side-by-side'&&sideWidth>=180;
    if(hasMedia&&d.choiceComposition==='side-by-side'&&!horizontal&&!plan.warnings.includes('Image et QR empilés : carte trop étroite pour les placer côte à côte.'))plan.warnings.push('Image et QR empilés : carte trop étroite pour les placer côte à côte.');
    const labels=row.map(c=>text(c.label,!horizontal&&columns===1?tile-maxQr-140:tile-70,42,700));
    const destinations=row.map(c=>text(buildChoiceUrl(id,c.id,baseUrl),!horizontal&&columns===1?maxQr:tile-70,24));
    const labelHeight=Math.max(...labels.map(ls=>ls.length))*54,linkHeight=Math.max(...destinations.map(ls=>ls.length))*31;
    const mediaWidth=horizontal?sideWidth:columns===1?tile-maxQr-160:tile-60;
    const maxMediaHeight=horizontal?rowLimit-labelHeight-linkHeight-120:columns===1?rowLimit-labelHeight-110:rowLimit-maxQr-linkHeight-labelHeight-115;
    const frames=row.map(c=>imageFrame(ref(c),c.id,mediaWidth,horizontal?Math.min(autoMediaHeight,maxQr):autoMediaHeight,maxMediaHeight));
    const mediaHeight=hasMedia?Math.max(...frames.map(f=>f.height)):0,bodyHeight=Math.max(maxQr,mediaHeight);
    const height=horizontal?labelHeight+bodyHeight+linkHeight+120:columns===1?Math.max(maxQr+linkHeight+85,labelHeight+80+(hasMedia?mediaHeight+30:0)):maxQr+linkHeight+labelHeight+95+(hasMedia?mediaHeight+20:0);
    return {columns,gap,tile,row,maxQr,hasMedia,mediaWidth,frames,mediaHeight,labelHeight,linkHeight,height,horizontal,bodyHeight};
  }
  // Chaque layout conserve sa composition par défaut ; les colonnes sont explicites.
  if(d.mode==='access') {
    const side=d.layout==='magazine'&&d.choicesPerRow==='auto';
    const listWidth=side?(w-PAD*2)*.49:w-PAD*2;
    const qrSize={small:650,medium:800,large:1000}[d.qrSize];
    const listCols=side?1:cols,gap=spacing,tile=(listWidth-gap*(listCols-1))/listCols;
    function accessRow(i){const row=content.choices.slice(i,i+listCols),refs=row.map(ref),hasImages=refs.some(Boolean),labelWidth=tile-70;
      const labelHeight=Math.max(...row.map((c,col)=>text(`${i+col+1}. ${c.label}`,labelWidth,42,700).length))*54+65;
      const imageHeight=hasImages?Math.max(...row.map(c=>imageFrame(ref(c),c.id,tile-50,autoMediaHeight,rowLimit-labelHeight-20).height)):0;
      const frames=row.map(c=>imageFrame(ref(c),c.id,tile-50,autoMediaHeight,rowLimit-labelHeight-20));
      return {row,refs,frames,hasImages,labelWidth,imageHeight,rowHeight:labelHeight+(hasImages?imageHeight+20:0)};
    }
    const first=accessRow(0);mainImage(side?Math.max(first.rowHeight,qrSize+130):first.rowHeight);
    for(let i=0;i<content.choices.length;i+=listCols) {
      const {row,refs,frames,hasImages,imageHeight,labelWidth,rowHeight}=accessRow(i);
      room(side&&!p.qrs.some(q=>q.kind==='access')?Math.max(rowHeight,qrSize+130):rowHeight);
      if(side&&!p.qrs.some(q=>q.kind==='access'))qr(p,plan.accessUrl,PAD+listWidth+65,y+70,qrSize,'access');
      row.forEach((c,col)=>{
        const x=PAD+col*(tile+gap);surface(p,x,y,tile,rowHeight);
        surface(p,x,y,12,rowHeight,'secondary',6);
        if(hasImages)image(p,refs[col],x+25,y+25,tile-50,frames[col].height,'cover','center',c.id);
        const tx=x+30,ty=y+30+(hasImages?imageHeight+20:0);
        words(p,`${i+col+1}. ${c.label}`,tx,ty,labelWidth,42,700);
        p.items.push({label:c.label,x,y,width:tile,height:rowHeight});
      });y+=rowHeight+gap;
    }
    if(!side) {
      room(qrSize+140);
      if(d.qrSurfaceMode==='large')surface(p,PAD,y,w-PAD*2,qrSize+125,'qrSurface');
      const cardWidth=d.qrSurfaceMode==='compact'?qrSize+100:qrSize+30;
      if(d.qrSurfaceMode!=='large')surface(p,(w-cardWidth)/2,y+85,cardWidth,qrSize+40,'qrSurface');
      surface(p,(w-1000)/2,y,1000,70);
      words(p,'Scanne pour participer',(w-900)/2,y+14,900,38,700,'accentText');
      qr(p,plan.accessUrl,(w-qrSize)/2,y+100,qrSize,'access');y+=qrSize+140;
    }
  } else {
    mainImage(choiceRow(0).height);
    for(let i=0;i<content.choices.length;) {
      const {columns,gap,tile,row,maxQr,hasMedia,mediaWidth,frames,mediaHeight,labelHeight,linkHeight,height,horizontal,bodyHeight}=choiceRow(i);
      room(height);
      row.forEach((c,col)=>{
        const x=PAD+col*(tile+gap),asset=ref(c);
        if(horizontal){
          surface(p,x,y,tile,height);surface(p,x,y,12,Math.min(height,180),'secondary',6);
          words(p,c.label,x+35,y+25,tile-70,42,700);
          const bodyY=y+labelHeight+45;
          image(p,asset,x+30,bodyY+(bodyHeight-frames[col].height)/2,mediaWidth,frames[col].height,'cover','center',c.id);
          const url=buildChoiceUrl(id,c.id,baseUrl);
          qr(p,url,x+tile-maxQr-30,bodyY+(bodyHeight-maxQr)/2,maxQr,'choice');
          words(p,url,x+35,bodyY+bodyHeight+25,tile-70,24);
          p.items.push({label:c.label,x,y,width:tile,height,choiceId:c.id,composition:'side-by-side'});return;
        }
        if(d.qrSurfaceMode==='large')surface(p,x,y,tile,height);
        else surface(p,x,y,tile,columns===1?height:labelHeight+65+(hasMedia?mediaHeight+20:0));
        surface(p,x,y,12,Math.min(height,180),'secondary',6);
        let cy=y+35;
        if(hasMedia){image(p,asset,x+30,cy,mediaWidth,frames[col].height,'cover','center',c.id);cy+=mediaHeight+20;}
        words(p,c.label,x+35,cy,columns===1?tile-maxQr-140:tile-70,42,700);
        const url=buildChoiceUrl(id,c.id,baseUrl),qx=columns===1?x+tile-maxQr-40:x+(tile-maxQr)/2,qy=columns===1?y+35:cy+labelHeight+25;
        const q=qr(p,url,qx,qy,maxQr,'choice');
        const urlWidth=columns===1?maxQr:tile-70,urlX=columns===1?qx:x+35;
        surface(p,urlX-8,qy+q.size+18,urlWidth+16,linkHeight+16);
        words(p,url,urlX,qy+q.size+22,urlWidth,24);
        p.items.push({label:c.label,x,y,width:tile,height,choiceId:c.id});
      });y+=height+spacing;i+=columns;
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
export function makeResultsPlan(poll,result,design,{style='summary',baseUrl,exportDate=new Date(),measure=(t,s)=>[...t].length*s*.6,usePosterMedia=false,mediaSizes={},includeComments=false,comments=[],includeIdentities=false,identities=[],adminAuthorized=false}={}) {
  const projection=authorizedResults(poll,result);
  ensure(['summary','report'].includes(style),'Style de résultats inconnu.');
  const rules=participationRules(poll.definition);
  ensure(!includeComments || (style==='report'&&rules.commentVisibility==='public_with_results'),'Commentaires publics indisponibles pour ce PDF.');
  ensure(!includeIdentities || (style==='report'&&adminAuthorized&&rules.participationIdentityMode==='identified'),'Identités réservées à un export administrateur explicite.');
  ensure(Array.isArray(comments)&&comments.length<=500&&Array.isArray(identities)&&identities.length<=500,'PDF limité à 500 commentaires/participations.');
  const normalized=validateDesign(design);normalized.layout='cards';normalized.background.assetId=null;
  const {plan,content,words,surface,image,qr,page,header}=basePlan(poll,normalized,measure,mediaSizes);
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
    words(p,`Voti · A4 · ${plan.pages.length+1}`,PAD+20,plan.height-65,plan.width-PAD*2-40,28);plan.pages.push(p);ensure(plan.pages.length<=32,'Rapport trop long : 32 pages maximum.');
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
    if(ref)image(p,ref,PAD+30,y+25,330,height-50,'cover','center',c.id);
    const x=PAD+(ref?400:35),width=labelWidth;
    words(p,label,x,y+28,width,44,700);
    const chartY=y+lines.length*57+46;
    words(p,`${c.count} vote${c.count===1?'':'s'} · ${c.percentage.toLocaleString('fr-FR',{maximumFractionDigits:1})} %`,x,chartY,width,38,700,'accentText');
    p.nodes.push({type:'bar',x,y:chartY+68,width,height:34,value:c.percentage/100});
    p.items.push({label:c.label,count:c.count,percentage:c.percentage,x:PAD,y,width:plan.width-PAD*2,height});y+=height+38;
    const appendText=(value,heading)=>{
      const plain=normalizedText(value,heading==='Commentaire visible'?300:60,heading,true);
      const lines=wrapPrintText(plain,plan.width-PAD*2-70,t=>measure(t,34,400,plan.family));
      const blockHeight=lines.length*44+110;
      if(y+blockHeight>limit){finish();p=page();y=header(p,true);
        const contextHeight=words(p,'Choix : '+c.label,PAD+35,y,plan.width-PAD*2-70,34,700,'accentText');y+=contextHeight+30;
      }
      ensure(y+blockHeight<=limit,'Commentaire trop dense pour cette page.');surface(p,PAD,y,plan.width-PAD*2,blockHeight);
      words(p,heading,PAD+35,y+22,plan.width-PAD*2-70,28,700,'accentText');words(p,plain,PAD+35,y+66,plan.width-PAD*2-70,34);y+=blockHeight+24;
    };
    if(includeComments)for(const comment of comments.filter(entry=>entry.choiceId===c.id))appendText(comment.text,'Commentaire visible');
    if(includeIdentities)for(const participant of identities.filter(entry=>entry.choiceId===c.id))appendText(participant.displayName,'Nom ou pseudonyme déclaré — non vérifié');
  }
  finish();return plan;
}
