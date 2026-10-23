import {createPoll} from '../shared/poll-engine.js';
import {emptyState} from '../shared/model.js';
import {validatePollAudience} from '../shared/spaces.js';
import {validateRules} from '../shared/validation.js';

export const SPACE_RELEASE_LABELS = [
  ['threshold','À partir du minimum de participations'],
  ['all_eligible','Quand tous les membres concernés ont participé'],
  ['closed','Quand le sondage est fermé'],
  ['all_eligible_or_closed','Quand tous ont participé, ou dès la fermeture']
];

/** Présentation seulement : available reste exclusivement décidé par le relais.
 * Les compteurs administratifs ne sont jamais demandés dans le parcours membre. */
export function resultsState(poll,{admin=false,attendance=null}={}) {
  const reserved=poll.accessRules?.pollAudience?.resultsAudience==='admins_only';
  if(reserved&&!admin)return{code:'reserved',title:'Résultats réservés à l’administration',detail:'Seuls les administrateurs et créateurs autorisés peuvent consulter ces résultats.'};
  const suffix=reserved?' Consultation réservée à l’administration.':'';
  if(poll.results.available)return{code:'available',title:'Résultats disponibles',detail:'Les conditions de publication des résultats sont remplies.'+suffix};
  if(poll.status==='draft')return{code:'draft',title:'Résultats après publication',detail:'Ce sondage est encore un brouillon.'+suffix};
  const {minimumResponses:n,releaseMode}=poll.resultRules;
  const minimum=`Au moins ${n} participation${n>1?'s sont nécessaires':' est nécessaire'} pour protéger la confidentialité.`;
  if(admin&&attendance&&attendance.consumed<n||releaseMode==='threshold'||poll.status==='closed'&&['closed','all_eligible_or_closed'].includes(releaseMode))return{code:'minimum',title:'Minimum de confidentialité non atteint',detail:minimum+suffix};
  const condition={all_eligible:['all','Participation de tous nécessaire','Les résultats attendent que tous les membres ciblés à la publication aient participé.'],closed:['closed','Fermeture du sondage nécessaire','Les résultats seront accessibles après la fermeture du sondage.'],all_eligible_or_closed:['all_or_closed','Participation de tous ou fermeture nécessaire','Les résultats attendent que tous les membres ciblés aient participé, ou que le sondage soit fermé.']}[releaseMode];
  if(condition)return{code:condition[0],title:condition[1],detail:(admin&&attendance&&attendance.consumed>=n?'Le minimum de confidentialité est atteint. ':minimum+' ')+condition[2]+suffix};
  return{code:'minimum',title:'Résultats pas encore disponibles',detail:minimum+suffix};
}

/** Noms de fichiers : métadonnées choisies, jamais un credential, même collé dans un nom. */
export function fileLabel(value,fallback='espace') {
  const label=String(value??'').replace(/voti-(?:admin|member|staff|invitation)-v1\.[a-f\d]+/gi,'')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
  return [...label].slice(0,55).join('')||fallback;
}
export function accessFilename(name,role,groups=[]) {
  return `voti-space-access-${fileLabel(name)}-${role==='admin'?'administrateur':'createur'}${groups.length?'-'+fileLabel(groups.join('-'),'groupes'):''}-secret.json`;
}
export function cardsFilename(name,member=null,count=1) {
  return `voti-member-card-${fileLabel(name)}-${member===null?`lot-${count}-cartes`:fileLabel(member,'membre')}-secret.pdf`;
}

/** Un seul moteur et une seule construction de brouillon pour guidé/rapide. */
export function makeSpacePollDraft(values,spaceId,options) {
  const poll=createPoll(emptyState(),{question:values.question,choices:values.answers.split('\n').map(s=>s.trim()).filter(Boolean),participationIdentityMode:values.identity,commentMode:values.comments,commentVisibility:values.visibility},options).polls[0];
  poll.resultRules.releaseMode=values.release;poll.resultRules.minimumResponses=Number(values.minimum);
  validateRules(poll.resultRules,true);
  const ids=values.groupIds;
  const pollAudience=validatePollAudience({spaceId,mode:ids.length?'groups':'space',groupIds:ids,resultsAudience:values.audience});
  return{poll,pollAudience};
}
