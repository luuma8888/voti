import {isSpaceCredential} from '../shared/spaces.js';
import {isPublicPollId,isRelayId,relayEnsure as need,RelayError} from '../shared/relay.js';
import {object} from '../shared/validation.js';
export const SPACE_ACCESS_KEY='voti.spaces.access.v1';
export function decodeSpaceAccess(raw,expectedRelayId){
  try{need(typeof raw==='string'&&raw.length<=4096,'INVALID_CAPABILITY');const value=JSON.parse(raw);object(value,['version','relayId','spaceId','credential'],'Fichier d’accès');
    need(value.version===1&&isRelayId(value.relayId)&&value.relayId===expectedRelayId&&isPublicPollId(value.spaceId)&&isSpaceCredential(value.credential,'staff'),'INVALID_CAPABILITY');return structuredClone(value);
  }catch{throw new RelayError('INVALID_CAPABILITY','Fichier d’accès à l’Espace invalide ou incompatible.');}
}
/** Seulement capacités de GESTION, jamais de cartes, noms ou projection participant. */
export class SpaceAccessStorage {
  constructor(storage,locks=globalThis.navigator?.locks){this.storage=storage;this.locks=locks;}
  list(){const raw=this.storage.getItem(SPACE_ACCESS_KEY);if(raw===null)return[];need(raw.length<100000,'PAYLOAD_TOO_LARGE');let data;try{data=JSON.parse(raw);}catch{throw new RelayError('INVALID_REQUEST','Stockage des accès Espaces illisible.');}object(data,['version','accesses'],'Accès Espaces');need(data.version===1&&Array.isArray(data.accesses)&&data.accesses.length<=100,'INVALID_REQUEST');
    for(const a of data.accesses){object(a,['relayId','spaceId','credential'],'Accès');need(isRelayId(a.relayId)&&isPublicPollId(a.spaceId)&&isSpaceCredential(a.credential,'staff'),'INVALID_CAPABILITY');}
    need(new Set(data.accesses.map(a=>a.relayId+':'+a.spaceId)).size===data.accesses.length,'INVALID_REQUEST');return structuredClone(data.accesses);}
  get(relayId,spaceId){return this.list().find(a=>a.relayId===relayId&&a.spaceId===spaceId)||null;}
  async delete(relayId,spaceId){need(this.locks?.request,'RELAY_UNAVAILABLE');return this.locks.request(SPACE_ACCESS_KEY,()=>{const accesses=this.list().filter(a=>a.relayId!==relayId||a.spaceId!==spaceId);this.storage.setItem(SPACE_ACCESS_KEY,JSON.stringify({version:1,accesses}));});}
  async put(access,replaceCredential=null){
    need(this.locks?.request,'RELAY_UNAVAILABLE');return this.locks.request(SPACE_ACCESS_KEY,()=>{
      object(access,['relayId','spaceId','credential'],'Accès');need(isRelayId(access.relayId)&&isPublicPollId(access.spaceId)&&isSpaceCredential(access.credential,'staff'),'INVALID_CAPABILITY');
      const before=this.list(),existing=this.get(access.relayId,access.spaceId);need(!existing||existing.credential===access.credential||existing.credential===replaceCredential,'CAPABILITY_CONFLICT');
      const accesses=before.filter(a=>a.spaceId!==access.spaceId||a.relayId!==access.relayId);accesses.push(structuredClone(access));need(accesses.length<=100,'PAYLOAD_TOO_LARGE');
      this.storage.setItem(SPACE_ACCESS_KEY,JSON.stringify({version:1,accesses}));
    });
  }
}
