import {buildMemberUrl} from '../shared/spaces.js';
import {createQrMatrix,renderQrSvg} from './qr.js';
/** Le même modèle est consommé par le DOM accessible et le renderer PDF. */
export function memberCardPreview(model,baseUrl){
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const card=el('article',null,'voti-member-card');card.dataset.cardTheme=model.cardTheme;card.setAttribute('aria-label',model.label+' : '+model.memberDisplayName);
  for(const[key,value]of Object.entries(model.colors))card.style.setProperty('--card-'+key,value);
  const header=el('header');header.append(el('strong','Voti'),el('span',model.label));card.append(header,el('h2',model.memberDisplayName),el('p',model.spaceName,'member-card-space'));
  const content=el('div',null,'member-card-content'),identity=el('div',null,'member-card-identity');
  if(model.memberVisual){const img=el('img');img.src=model.memberVisual.src;img.alt=model.memberVisual.label;img.className='member-card-visual';identity.append(img);}
  const groups=el('ul',null,'member-card-groups');for(const group of model.groups.slice(0,3)){const li=el('li');if(group.visual){const img=el('img');img.src=group.visual.src;img.alt='';li.append(img);}li.append(el('span',group.name));groups.append(li);}if(model.groups.length>3){const count=model.groups.length-3,more=el('li','Et '+count+' autre'+(count>1?'s groupes':' groupe'));more.title=model.groups.slice(3).map(g=>g.name).join(', ');groups.append(more);}identity.append(groups);
  if(model.memberVisual||model.groups.length)content.append(identity);
  else content.classList.add('qr-centered');
  const qr=el('img');qr.className='member-card-code';qr.alt='QR secret de la Carte Voti';qr.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(renderQrSvg(createQrMatrix(buildMemberUrl(baseUrl,model.credential))));content.append(qr);card.append(content,el('p',model.instruction,'member-card-instruction'));return card;
}
