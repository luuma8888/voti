/** Extension Espace uniquement ; aucune normalisation ne réécrit une définition historique. */
export function voteMode(d){return Object.hasOwn(d,'mode')?d.mode:'single_choice';}
export function voteConfiguration(d){
 const mode=voteMode(d);if(mode==='single_choice'){if(d.voteConfig!==undefined)throw Error('Réglages incompatibles avec un seul choix.');return{mode,limit:1,rule:'exact'};}
 if(!['multiple_choice','ranked_choice'].includes(mode))throw Error('Mode de réponse inconnu.');
 const c=d.voteConfig;
 if(!c||Object.keys(c).sort().join(',')!=='limit,rule,version'||c.version!==1||!['up_to','exact',...(mode==='ranked_choice'?['all']:[])].includes(c.rule))throw Error('Réglages du mode invalides.');
 if(!Number.isSafeInteger(c.limit)||c.limit<(mode==='ranked_choice'?2:1)||c.limit>d.choices.length||c.rule==='all'&&c.limit!==d.choices.length)throw Error('La quantité demandée dépasse les réponses proposées. Ajuste-la avant d’enregistrer.');
 return{mode,...c};
}
export function validateSelections(d,ids){
 const c=voteConfiguration(d);if(c.mode==='single_choice')throw Error('Ce bulletin nécessite un mode expérimental.');
 if(!Array.isArray(ids)||!ids.length||ids.length>c.limit||new Set(ids).size!==ids.length||ids.some(id=>!d.choices.some(x=>x.id===id))||c.rule!=='up_to'&&ids.length!==c.limit)throw Error('Sélection invalide ou incomplète.');
 return c.mode==='multiple_choice'?[...ids].sort():[...ids];
}
export function aggregateSelections(d,ballots){
 const c=voteConfiguration(d),scores=Object.fromEntries(d.choices.map(x=>[x.id,0]));
 for(const ids of ballots)validateSelections(d,ids).forEach((id,i)=>scores[id]+=c.mode==='ranked_choice'?c.limit-i:1);
 const choices=d.choices.map(x=>({id:x.id,label:x.label,...(c.mode==='ranked_choice'?{points:scores[x.id]}:{count:scores[x.id],percentage:ballots.length?scores[x.id]/ballots.length*100:0})}));
 if(c.mode==='ranked_choice'){choices.sort((a,b)=>b.points-a.points);for(const x of choices){x.rank=1+choices.filter(y=>y.points>x.points).length;x.tied=choices.filter(y=>y.points===x.points).length>1;}}
 return{mode:c.mode,limit:c.limit,totalBallots:ballots.length,choices};
}
export function modeLabel(d){const c=voteConfiguration(d);return c.mode==='single_choice'?'Un seul choix':c.mode==='multiple_choice'?`Plusieurs choix · ${c.rule==='exact'?'exactement':"jusqu’à"} ${c.limit} réponses`:`Préférences classées · ${c.rule==='all'?'toute la liste':(c.rule==='exact'?'exactement':"jusqu’à")+' '+c.limit}`;}
