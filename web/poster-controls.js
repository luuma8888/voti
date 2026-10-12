import { TITLE_TYPOGRAPHIES, BODY_TYPOGRAPHIES, IMAGE_RATIOS, defaultImageSettings } from './poster-design.js';

const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const button=(label,action)=>{const b=node('button',label);b.type='button';b.addEventListener('click',action);return b;};
export function typographyChoices(label,kind,value,change){
  const group=node('fieldset');group.className='typography-choices';group.append(node('legend',label));
  const options=kind==='title'?TITLE_TYPOGRAPHIES:BODY_TYPOGRAPHIES,name='type-'+crypto.randomUUID();
  for(const [id,title,family] of options){
    const card=node('label'),input=node('input');input.type='radio';input.name=name;input.value=id;input.checked=id===value;
    const sample=node('span',`${title} — Été à Voti`);sample.style.fontFamily=family;
    input.addEventListener('change',()=>{if(input.checked)change(id);});card.append(input,sample);group.append(card);
  }return group;
}
/** Point focal sur l'image réellement affichée, letterboxing exclu. */
export function focalPicker({label,getSettings,getId,views,staged,change,allowRatio=true}){
  const group=node('fieldset');group.className='focal-control';group.append(node('legend',label));
  const preview=node('div');preview.className='focal-preview';
  const marker=node('span');marker.className='focal-marker';marker.setAttribute('aria-hidden','true');
  const value=node('output');const inputFields=[];
  function setField(title,build){const id='crop-'+crypto.randomUUID(),l=node('label',title),input=build();input.id=id;l.htmlFor=id;const box=node('div');box.className='field';box.append(l,input);group.append(box);return input;}
  function select(title,options,key){return setField(title,()=>{const n=node('select');for(const [v,t] of options){const o=node('option',t);o.value=v;n.append(o);}n.value=getSettings()[key];n.addEventListener('change',()=>edit({[key]:n.value}));return n;});}
  const ratio=select('Ratio de l’image',IMAGE_RATIOS,'ratio'),fit=select('Affichage de l’image',[['cover','Remplir'],['contain','Ajuster']],'fit');
  ratio.parentElement.hidden=!allowRatio;
  function imageRect(){const r=preview.getBoundingClientRect(),img=preview.querySelector('img');if(!img?.naturalWidth)return {x:0,y:0,width:r.width,height:r.height};const scale=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight),width=img.naturalWidth*scale,height=img.naturalHeight*scale;return {x:(r.width-width)/2,y:(r.height-height)/2,width,height};}
  function draw(){const s=getSettings(),r=imageRect();marker.style.left=(r.x+s.focalX*r.width)+'px';marker.style.top=(r.y+s.focalY*r.height)+'px';value.textContent=`Zone visible : ${Math.round(s.focalX*100)} % horizontal, ${Math.round(s.focalY*100)} % vertical.`;for(const [key,input] of inputFields)input.value=Math.round(s[key]*100);}
  function edit(patch,commit=true){change({...getSettings(),...patch},commit);draw();}
  for(const [key,title] of [['focalX','Position horizontale'],['focalY','Position verticale']]){const input=setField(title,()=>{const n=node('input');n.type='range';n.min='0';n.max='100';n.step='1';n.addEventListener('input',()=>edit({[key]:Number(n.value)/100},false));n.addEventListener('change',()=>edit({[key]:Number(n.value)/100}));return n;});inputFields.push([key,input]);}
  let drag=false;
  function point(e,commit=false){const r=imageRect(),bounds=preview.getBoundingClientRect();if(r.width&&r.height)edit({focalX:Math.max(0,Math.min(1,(e.clientX-bounds.left-r.x)/r.width)),focalY:Math.max(0,Math.min(1,(e.clientY-bounds.top-r.y)/r.height))},commit);}
  preview.addEventListener('pointerdown',e=>{if(e.button!==0||!getId())return;drag=true;if(e.isTrusted)preview.setPointerCapture(e.pointerId);point(e);});
  preview.addEventListener('pointermove',e=>{if(drag)point(e);});
  preview.addEventListener('pointerup',e=>{if(drag){drag=false;point(e,true);}});
  preview.addEventListener('pointercancel',()=>{drag=false;edit({});});
  const directions=node('div');directions.className='actions';
  for(const [title,key,delta] of [['Gauche','focalX',-.1],['Droite','focalX',.1],['Haut','focalY',-.1],['Bas','focalY',.1]])directions.append(button(title,()=>edit({[key]:Math.max(0,Math.min(1,getSettings()[key]+delta))})));
  directions.append(button('Réinitialiser au centre',()=>edit({focalX:.5,focalY:.5})));
  group.append(node('p','En Remplir, déplace le repère sur la partie à garder visible. En Ajuster, toute l’image reste visible ; ton repère est conservé pour revenir à Remplir.'),preview,value,directions);
  function update(){preview.replaceChildren();views.sweep();const id=getId();group.hidden=!id;
    if(id){const picture=views.show(id,{size:'focal',alt:label,staged});preview.append(picture,marker);picture.querySelector('img').addEventListener('load',draw,{once:true});}
    ratio.value=getSettings().ratio;fit.value=getSettings().fit;draw();}
  const resize=new ResizeObserver(draw);resize.observe(preview);update();
  return {element:group,update,dispose:()=>resize.disconnect()};
}
export const settingsFor=(design,key)=>design.imageSettings[key]||{...defaultImageSettings(),...(key==='background'?{fit:design.background.fit,focalY:design.background.position==='top'?0:design.background.position==='bottom'?1:.5}:{})};
