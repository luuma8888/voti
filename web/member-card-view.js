import {paintGroupBackdrop} from './card-backdrop.js';
import {renderQrSvg} from './qr.js';
import {cardLayout,cardText} from './card-layout.js';
/** Le DOM et le PDF placent les mêmes zones dans le même repère logique. */
export function memberCardPreview(model,baseUrl){
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;},layout=cardLayout(model,baseUrl),ctx=document.createElement('canvas').getContext('2d'),texts=cardText(ctx,model,layout);
  const card=el('article',null,'voti-member-card');card.dataset.cardTheme=model.cardTheme;card.setAttribute('aria-label',model.label+' : '+model.memberDisplayName);card.style.aspectRatio=layout.width+'/'+layout.height;
  for(const[key,value]of Object.entries(model.colors))card.style.setProperty('--card-'+key,value);
  const backdrop=el('canvas',null,'member-card-backdrop');backdrop.setAttribute('aria-hidden','true');card.append(backdrop);card.backdropReady=paintGroupBackdrop(backdrop,model,layout).catch(()=>{backdrop.remove();card.dataset.backdropError='true';});
  const place=(n,r,zone)=>{n.dataset.cardZone=zone;Object.assign(n.style,{position:'absolute',left:r.x/layout.width*100+'%',top:r.y/layout.height*100+'%',width:r.width/layout.width*100+'%',height:r.height/layout.height*100+'%'});card.append(n);return n;};
  const text=(n,t)=>{n.style.fontSize=t.font/layout.width*100+'cqw';n.style.lineHeight=t.lineHeight/t.font;for(const line of t.lines)n.append(el('span',line));return n;};
  const header=el('header');header.append(el('strong','Voti'),el('span',model.label));place(header,layout.header,'header');
  place(text(el('h2',null,'member-card-name'),texts.name),layout.name,'name');place(text(el('p',null,'member-card-space'),texts.space),layout.space,'space');
  if(model.memberVisual){const img=el('img',null,'member-card-visual');img.src=model.memberVisual.large;img.alt=model.memberVisual.label;img.decoding='async';place(img,layout.member,'member');}
  const groups=el('ul',null,'member-card-groups');model.groups.slice(0,3).forEach((group,i)=>{const li=el('li');li.style.height=layout.groupRow/layout.width*100+'cqw';li.style.gap=layout.groupGap/layout.width*100+'cqw';if(group.visual){const img=el('img');img.src=group.visual.icon;img.alt='';img.style.width=img.style.height=layout.groupIcon/layout.width*100+'cqw';li.append(img);}li.append(text(el('div'),texts.groups[i]));groups.append(li);});if(model.groups.length>3){const more=el('li','Et '+(model.groups.length-3)+' autre(s) groupes');more.title=model.groups.slice(3).map(g=>g.name).join(', ');groups.append(more);}place(groups,layout.groups,'groups');
  const qr=el('img',null,'member-card-code');qr.alt='QR secret de la Carte Voti';qr.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(renderQrSvg(layout.qr.matrix));place(qr,layout.qr,'qr');place(el('p',model.instruction,'member-card-instruction'),layout.footer,'footer');return card;
}
