import {voteConfiguration} from '../shared/vote-modes.js';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
export function multiVote(poll,onReview,initial=[]){
 const d=poll.definition,c=voteConfiguration(d),ranked=c.mode==='ranked_choice';let ids=[...initial];
 const root=el('section',null,{class:'multi-vote'}),title=el('h2',`${ranked?'Classe':'Choisis'} ${c.rule==='all'?'toutes les propositions':(c.rule==='exact'?'exactement':"jusqu’à")+' '+c.limit+(ranked?' préférences':' réponses')}`),status=el('p',null,{role:'status','aria-live':'polite'}),progress=el('ol',null,{class:'rank-progress','aria-label':'Progression du classement'}),list=el('div',null,{class:'vote-choices'}),actions=el('div',null,{class:'actions'});
 title.id='ballot-title-'+crypto.randomUUID();root.setAttribute('aria-labelledby',title.id);
 const button=(text,fn)=>{const b=el('button',text,{type:'button'});b.addEventListener('click',fn);return b;};
 const next=button('Continuer',()=>onReview([...ids])),reset=button(ranked?'Recommencer mon classement':'Recommencer mes choix',()=>{ids=[];draw();}),back=button('Revenir au choix précédent',()=>{ids.pop();draw();});next.className='primary';
 root.append(title);if(ranked){root.append(el('p','Commence par celle que tu préfères le plus.'),el('p','Appuie sur ta réponse préférée.'));if(c.rule==='up_to')root.append(el('p','Tu peux en classer moins et terminer quand tu veux.'));root.append(progress);}
 root.append(status,list,actions);actions.append(next,...(ranked?[back]:[]),reset);
 function draw(){
  status.textContent=ranked?(ids.length<c.limit?`Ton ${ids.length===0?'1er':(ids.length+1)+'e'} choix · ${ids.length} préférences choisies sur ${c.limit}`:'Classement prêt à vérifier'):`${ids.length} réponses ${c.rule==='exact'?'sur les '+c.limit+' demandées':'sélectionnées sur '+c.limit+' possibles'}`;
  progress.replaceChildren();if(ranked)for(let i=0;i<c.limit;i++){const li=el('li',`${i+1} · ${ids[i]?d.choices.find(x=>x.id===ids[i]).label:i===ids.length?'À choisir':'En attente'}`);if(i===ids.length)li.setAttribute('aria-current','step');progress.append(li);}
  list.replaceChildren();for(const choice of d.choices){const i=ids.indexOf(choice.id),selected=i>=0;if(ranked){const b=button(`${selected?(i+1)+' · ':''}${choice.label}`,()=>{ids.push(choice.id);draw();list.querySelector('button:not(:disabled)')?.focus();});b.disabled=selected||ids.length===c.limit;b.className='vote-choice';list.append(b);}else{const input=el('input',null,{type:'checkbox'});input.checked=selected;input.disabled=!selected&&ids.length===c.limit;input.addEventListener('change',()=>{ids=input.checked?[...ids,choice.id]:ids.filter(id=>id!==choice.id);draw();list.querySelector(`[data-choice="${choice.id}"]`)?.focus();});input.dataset.choice=choice.id;const label=el('label',null,{class:'vote-choice'});label.append(input,el('span',choice.label));list.append(label);}}
  next.disabled=ids.length===0||c.rule!=='up_to'&&ids.length!==c.limit;next.textContent=ranked&&c.rule==='up_to'&&ids.length?`Terminer avec ${ids.length===1?'mon choix':'mes '+ids.length+' préférences'}`:'Continuer';back.disabled=!ids.length;
 }
 draw();return root;
}
