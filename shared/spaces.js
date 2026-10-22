import { relayEnsure as need, isPublicPollId, isRelayId } from './relay.js';
import { normalizedText } from './participation.js';

export const SPACE_ROLES = Object.freeze(['admin', 'creator', 'participant']);
export const GROUP_RELEASE_MODES = Object.freeze(['threshold', 'closed', 'all_eligible', 'all_eligible_or_closed']);
export function spaceName(value) {try{return normalizedText(value,100,'Nom',true);}catch{need(false,'INVALID_REQUEST');} }
export function memberName(value) {try{const name=normalizedText(value,60,'Nom ou pseudonyme',true);need(!/[\r\n\t]/.test(name),'INVALID_PARTICIPATION');return name;}catch{need(false,'INVALID_PARTICIPATION');} }

/** Domaines distincts : une carte ne peut pas être présentée comme accès adulte. */
export function createSpaceCredential(kind) {
  need(['member','staff','invitation'].includes(kind),'INVALID_REQUEST');
  return `voti-${kind}-v1.`+Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
}
export function isSpaceCredential(value,kind) {
  return typeof value==='string'&&['member','staff','invitation'].includes(kind)&&new RegExp(`^voti-${kind}-v1\\.[a-f0-9]{64}$`).test(value);
}
export async function spaceCredentialDigest(relayId,kind,value) {
  need(isRelayId(relayId)&&isSpaceCredential(value,kind),'INVALID_CAPABILITY');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`voti-space-credential-v1\n${relayId}\n${kind}\n${value}`));
  return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}

export function validatePollAudience(value) {
  need(value&&Object.keys(value).sort().join(',')==='groupIds,mode,resultsAudience,spaceId','INVALID_DEFINITION');
  need(['space','groups'].includes(value.mode)&&isPublicPollId(value.spaceId),'INVALID_DEFINITION');
  need(['poll_audience','admins_only'].includes(value.resultsAudience),'INVALID_DEFINITION');
  need(Array.isArray(value.groupIds)&&value.groupIds.length<=20&&value.groupIds.every(isPublicPollId)&&new Set(value.groupIds).size===value.groupIds.length,'INVALID_DEFINITION');
  need(value.mode==='space'?value.groupIds.length===0:value.groupIds.length>0,'INVALID_DEFINITION');
  return {...structuredClone(value),groupIds:[...value.groupIds].sort()};
}
export function creatorAllowsAudience(access,audience) {
  if(!access||access.status!=='active'||access.spaceId!==audience.spaceId)return false;
  if(access.role==='admin')return true;
  if(access.role!=='creator')return false;
  return access.groupIds===null||(audience.mode==='groups'&&audience.groupIds.every(id=>access.groupIds.includes(id)));
}
/** Snapshot indépendant des objets vivants. Aucun état de vote nominatif projeté. */
export function snapshotMembers(members,memberships,audience) {
  validatePollAudience(audience);
  const groups=new Set(audience.groupIds);
  const allowed=new Set(memberships.filter(m=>m.spaceId===audience.spaceId&&groups.has(m.groupId)).map(m=>m.memberId));
  return [...new Set(members.filter(m=>m.spaceId===audience.spaceId&&m.status==='active'&&(audience.mode==='space'||allowed.has(m.memberId))).map(m=>m.memberId))].sort();
}
export function groupResultsAvailable(status,rules,consumed,eligible) {
  need(GROUP_RELEASE_MODES.includes(rules.releaseMode)&&Number.isSafeInteger(rules.minimumResponses)&&rules.minimumResponses>=1&&['draft','published','closed'].includes(status)&&Number.isSafeInteger(consumed)&&Number.isSafeInteger(eligible)&&eligible>0&&consumed>=0&&consumed<=eligible,'INVALID_DEFINITION');
  if(status==='draft'||consumed<rules.minimumResponses)return false;
  const all=consumed===eligible;
  return rules.releaseMode==='threshold'||(rules.releaseMode==='closed'&&status==='closed')||
    (rules.releaseMode==='all_eligible'&&all)||(rules.releaseMode==='all_eligible_or_closed'&&(all||status==='closed'));
}
export function buildMemberUrl(base,token) {
  need(isSpaceCredential(token,'member'),'INVALID_CAPABILITY');
  const url=new URL(base);need(!url.username&&!url.password&&!url.search&&(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))),'INVALID_REQUEST');url.hash=`/member/${token}`;return url.href;
}
/** Effacer le fragment AVANT appel réseau. Jamais de stockage du secret. */
export function consumeMemberFragment(location,history) {
  const match=location.hash.match(/^#\/member\/(.*)$/);if(!match)return null;
  history.replaceState(null,'',location.pathname+location.search+'#/member');
  need(isSpaceCredential(match[1],'member'),'INVALID_CAPABILITY');return match[1];
}

/** Session participant volontairement mémoire seulement, réutilisable hors DOM. */
export class TemporaryMemberSession {
  #credential=null;
  #deadline=0;
  constructor({now=()=>Date.now(),ttl=300000}={}){this.now=now;need(Number.isSafeInteger(ttl)&&ttl>0&&ttl<=300000,'INVALID_REQUEST');this.ttl=ttl;}
  set(credential){need(isSpaceCredential(credential,'member'),'INVALID_CAPABILITY');this.#credential=credential;this.#deadline=this.now()+this.ttl;}
  get credential(){if(this.now()>=this.#deadline)this.clear();return this.#credential;}
  clear(){this.#credential=null;this.#deadline=0;}
}
