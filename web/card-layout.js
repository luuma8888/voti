import {createQrMatrix} from './qr.js';
import {buildMemberUrl} from '../shared/spaces.js';
/** Une carte de 94,8 × 64,4 mm dans la planche A4 à huit cartes (300 dpi). */
export const CARD_LAYOUT=Object.freeze({width:1120,height:760,
  header:{x:18,y:18,width:1084,height:64},name:{x:40,y:100,width:1040,height:106},space:{x:40,y:212,width:1040,height:44},
  member:{x:40,y:260,width:430,height:448},groups:{x:375,y:282,width:245,height:410},qr:{x:632,y:260,width:456,height:456},
  footer:{x:40,y:718,width:1040,height:34},groupIcon:62,groupGap:12,groupRow:108});
export function cardLayout(model,baseUrl){
  const matrix=createQrMatrix(buildMemberUrl(baseUrl,model.credential)),scale=Math.floor(CARD_LAYOUT.qr.width/matrix.size);
  if(scale<4)throw new Error('Le lien est trop long pour une carte A4 lisible.');
  const size=matrix.size*scale,box=CARD_LAYOUT.qr;
  const centered=!model.memberVisual&&!model.groups.length,groups=model.memberVisual?CARD_LAYOUT.groups:{...CARD_LAYOUT.groups,x:40,width:540};
  return{...CARD_LAYOUT,member:{...CARD_LAYOUT.member,width:model.groups.length?320:430},groups,qr:{matrix,scale,size,x:Math.round(centered?(CARD_LAYOUT.width-size)/2:box.x+(box.width-size)/2),y:Math.round(box.y+(box.height-size)/2),width:size,height:size}};
}
export function fitCardText(ctx,text,width,{font=28,min=22,maxLines=2,lineHeight=1.12,bold=false,height=Infinity}={}){
  const wrap=()=>{const lines=[];let line='';for(const char of String(text)){if(ctx.measureText(line+char).width>width&&line){const split=line.lastIndexOf(' ');if(split>0){lines.push(line.slice(0,split));line=line.slice(split+1);}else{lines.push(line);line='';}}line+=char;}if(line)lines.push(line);return lines;};
  let all;do{ctx.font=`${bold?'bold ':''}${font}px system-ui`;all=wrap();if(all.length<=maxLines&&all.length*font*lineHeight<=height||font<=min)break;font--;}while(true);
  const lines=all.slice(0,maxLines);if(all.length>maxLines){let tail=lines.at(-1);while(tail&&ctx.measureText(tail+'…').width>width)tail=tail.slice(0,-1);lines[lines.length-1]=tail+'…';}
  return{font,lineHeight:font*lineHeight,lines,bold};
}
export function cardText(ctx,model,layout=CARD_LAYOUT){return{
  name:fitCardText(ctx,model.memberDisplayName,layout.name.width,{font:64,min:44,bold:true,height:layout.name.height}),
  space:fitCardText(ctx,model.spaceName,layout.space.width,{font:28,min:18,lineHeight:1.08,height:layout.space.height}),
  groups:model.groups.slice(0,3).map(g=>fitCardText(ctx,g.name,layout.groups.width-(g.visual?layout.groupIcon+layout.groupGap:0),{font:28,min:24,maxLines:3})),
};}
