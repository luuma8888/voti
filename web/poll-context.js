import { ensure, isUuid, object } from '../shared/validation.js';

export const CONTEXT_KEY='voti.ui.context.v1';
/** Repère UX local uniquement ; ni statut métier, ni état du relais, ni sauvegarde. */
export class PollContexts {
  constructor(storage){this.storage=storage;}
  read(){const raw=this.storage.getItem(CONTEXT_KEY);if(raw===null)return {formatVersion:1,deleted:[]};ensure(raw.length<16000,'Repères locaux trop volumineux.');let value;try{value=JSON.parse(raw);}catch{throw new Error('Repères locaux illisibles. Aucun repère effacé.');}object(value,['formatVersion','deleted'],'Repères');ensure(value.formatVersion===1&&Array.isArray(value.deleted)&&value.deleted.length<=200&&value.deleted.every(isUuid)&&new Set(value.deleted).size===value.deleted.length,'Repères locaux invalides.');return value;}
  markDeleted(id){ensure(isUuid(id),'Sondage invalide.');const d=this.read();d.deleted=[...d.deleted.filter(x=>x!==id),id].slice(-200);this.storage.setItem(CONTEXT_KEY,JSON.stringify(d));}
  label(id,binding){if(binding)return binding.remoteRevision>0?'En ligne':'Publication en attente';return this.read().deleted.includes(id)?'Copie locale · ancien lien supprimé':'Local';}
}
