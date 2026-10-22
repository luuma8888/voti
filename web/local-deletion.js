import {removeLocalPoll} from '../shared/poll-deletion.js';

/** Aucun réseau. Le retrait de la copie ne dépend pas du nettoyage des médias. */
export async function removeFromDevice({repository,posters,connections,contexts,remoteViews,connection,pollId}){
  const state=await repository.transact(current=>removeLocalPoll(current,pollId)),warnings=[];
  for(const [label,operation]of [['design et médias locaux',()=>posters.remove(pollId)],['accès local',()=>connection?connections.delete({relayId:connection.relayId,pollId}):undefined],['repère local',()=>contexts.forget(pollId)]]){
    try{await operation();}catch{warnings.push(label);}
  }
  remoteViews.delete(pollId);return{state,warnings};
}
