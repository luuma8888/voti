import {isUuid,ensure} from './validation.js';
/** Suppression locale indépendante du relais. Les erreurs réseau ne la bloquent pas. */
export function removeLocalPoll(state,pollId){
  ensure(isUuid(pollId),'Identifiant de sondage invalide.');const next=structuredClone(state);
  for(const key of ['polls','ballots','comments','participations'])next[key]=next[key].filter(item=>(key==='polls'?item.id:item.pollId)!==pollId);
  return next;
}
