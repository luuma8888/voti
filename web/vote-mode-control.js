import {voteConfiguration,voteMode} from '../shared/vote-modes.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function voteModeControl({definition=null,readModes=null}={}){
 const root=el('fieldset'),legend=el('legend','Comment veux-tu que les participants répondent ?');root.className='vote-mode-control';root.append(legend);
 const mode=el('select'),rule=el('select'),limit=el('input'),extra=el('div'),badge=el('span','Expérimental');badge.className='experimental-badge';
 const field=(text,input)=>{const wrap=el('div'),label=el('label',text);input.id='mode-'+crypto.randomUUID();label.htmlFor=input.id;wrap.append(label,input);return wrap;};
 for(const[v,t]of [['single_choice','Un seul choix — Choisir une réponse'],['multiple_choice','Plusieurs choix — Expérimental'],['ranked_choice','Classer les préférences — Expérimental']]){const o=el('option',t);o.value=v;mode.append(o);}
 limit.type='number';limit.min=1;limit.max=6;limit.value='2';limit.required=true;
 extra.append(badge,field('Règle de sélection',rule),field('Nombre de réponses ou préférences',limit));root.append(field('Manière de répondre',mode),extra);
 function draw(){const old=rule.value;rule.replaceChildren();for(const[v,t]of [['up_to',"Jusqu’à la quantité choisie"],['exact','Exactement la quantité choisie'],...(mode.value==='ranked_choice'?[['all','Toute la liste']]:[])]){const o=el('option',t);o.value=v;rule.append(o);}if([...rule.options].some(o=>o.value===old))rule.value=old;extra.hidden=mode.value==='single_choice';limit.disabled=extra.hidden||rule.value==='all';limit.min=mode.value==='ranked_choice'?2:1;}
 mode.addEventListener('change',draw);rule.addEventListener('change',()=>limit.disabled=extra.hidden||rule.value==='all');
 function restore(d){mode.value=voteMode(d);draw();if(d.voteConfig){rule.value=d.voteConfig.rule;limit.value=d.voteConfig.limit;}limit.disabled=extra.hidden||rule.value==='all';}
 if(definition)restore(definition);else draw();
 if(readModes){for(const o of [...mode.options].slice(1))o.disabled=true;readModes().then(()=>{for(const o of mode.options)o.disabled=false;}).catch(()=>{});}
 return{element:root,read(count){if(rule.value==='all')limit.value=String(count);if(mode.value==='single_choice')return{mode:'single_choice'};const d={mode:mode.value,choices:Array.from({length:count}),voteConfig:{version:1,rule:rule.value,limit:rule.value==='all'?count:Number(limit.value)}};voteConfiguration(d);return{mode:d.mode,voteConfig:d.voteConfig};},restore};
}
