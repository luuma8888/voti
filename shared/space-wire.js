import {relayEnsure as need,isPublicPollId,remoteRef} from './relay.js';
import {object,isUuid} from './validation.js';
import {validateRelayResponse,validateProjection,validateCommentPage} from './relay-wire.js';
import {memberName,spaceName} from './spaces.js';
import {validateDefinition,validateStyle,validateRules,validateAccess} from './validation.js';

/** Contrat fournisseur-neutre ; les credentials transitent exclusivement en Bearer. */
export const SPACE_COMMAND_FIELDS=Object.freeze({
  createSpace:['spaceId','name','expectedRevision'],getSpace:['spaceId'],
  renameSpace:['spaceId','name','expectedRevision'],archiveSpace:['spaceId','expectedRevision'],
  createGroup:['spaceId','groupId','name','expectedRevision'],renameGroup:['spaceId','groupId','name','expectedRevision'],archiveGroup:['spaceId','groupId','expectedRevision'],
  createMember:['spaceId','memberId','displayName','groupIds','memberCredential','expectedRevision'],
  updateMember:['spaceId','memberId','displayName','groupIds','expectedRevision'],
  revokeMember:['spaceId','memberId','expectedRevision'],rotateMemberCard:['spaceId','memberId','memberCredential','expectedRevision'],
  revokeMemberCard:['spaceId','memberId','expectedRevision'],
  createAccess:['spaceId','accessId','role','groupIds','staffCredential','expectedRevision'],revokeAccess:['spaceId','accessId','expectedRevision'],
  createInvitation:['spaceId','invitationId','groupIds','maxUses','expiresInDays','invitationCredential','expectedRevision'],
  closeInvitation:['spaceId','invitationId','expectedRevision'],
  acceptInvitation:['memberId','displayName','memberCredential'],getMemberHome:[],
  prepareSpacePublication:['spaceId','poll','pollAudience','expectedRevision'],
  publishSpacePoll:['pollId','expectedRevision'],getSpacePoll:['pollId'],getMemberPoll:['pollId'],
  updateSpacePoll:['pollId','definition','resultRules','pollAudience','expectedRevision'],
  getMemberResults:['pollId'],getMemberComments:['pollId','cursor'],
  castMemberVote:['pollId','actionId','choiceId','comment','expectedDefinitionHash'],getPollAttendance:['pollId'],getSpaceComments:['pollId','cursor'],
});
export function validateSpaceCommand(command,input){
  need(Object.hasOwn(SPACE_COMMAND_FIELDS,command),'INVALID_REQUEST');
  try{object(input,SPACE_COMMAND_FIELDS[command],'Opération Espace');}catch{need(false,'INVALID_REQUEST');}
  for(const key of ['spaceId','groupId','memberId','accessId','invitationId','pollId','actionId'])if(Object.hasOwn(input,key))need(isPublicPollId(input[key]),'INVALID_REQUEST');
  if(Object.hasOwn(input,'choiceId'))need(isUuid(input.choiceId),'INVALID_REQUEST');
  if(Object.hasOwn(input,'expectedDefinitionHash'))need(typeof input.expectedDefinitionHash==='string'&&/^[a-f0-9]{64}$/.test(input.expectedDefinitionHash),'INVALID_REQUEST');
  if(Object.hasOwn(input,'expectedRevision'))need(Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>=0,'INVALID_REQUEST');
  return structuredClone(input);
}
/** Enveloppe bornée ; projections nommées, jamais un export arbitraire de D1. */
export function validateSpaceResponse(value,relayId=null,pollId=null){
  need(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.kind==='string','RELAY_UNAVAILABLE');
  const keys={space:['kind','spaceId','name','status','revision','access','staffAccesses','groups','members','invitations','polls'],
    member:['kind','memberId','displayName','space','groups','polls'],mutation:['kind','spaceId','revision'],
    prepared:['kind','pollId','revision'],acceptedInvitation:['kind','spaceId','memberId'],
    poll:['kind','poll'],memberPoll:['kind','poll','alreadyParticipated'],results:['kind','results'],comments:['kind','page'],
    vote:['kind','receipt'],attendance:['kind','identityMode','consumed','eligible','members']};
  need(Object.hasOwn(keys,value.kind),'RELAY_UNAVAILABLE');
  try{object(value,keys[value.kind],'Réponse Espace');}catch{need(false,'RELAY_UNAVAILABLE');}
  if(['mutation','prepared','acceptedInvitation'].includes(value.kind)){
    for(const key of ['spaceId','pollId','memberId'])if(Object.hasOwn(value,key))need(isPublicPollId(value[key]),'RELAY_UNAVAILABLE');
    if(Object.hasOwn(value,'revision'))need(Number.isSafeInteger(value.revision)&&value.revision>=0,'RELAY_UNAVAILABLE');
    if(pollId&&value.pollId)need(value.pollId===pollId,'RELAY_UNAVAILABLE');
  }
  if(['poll','memberPoll'].includes(value.kind)){
    const poll=value.poll,ref=poll?.remoteRef;need(ref&&(!relayId||ref.relayId===relayId)&&(!pollId||ref.pollId===pollId),'RELAY_UNAVAILABLE');
    if(poll.status==='draft'){
      object(ref,['relayId','pollId','revision'],'Référence distante');remoteRef(ref.relayId,ref.pollId,ref.revision);
      need(value.kind==='poll'&&poll.locked===false&&poll.definitionHash===null&&poll.results.available===false,'RELAY_UNAVAILABLE');
      object(poll,['remoteRef','status','locked','definitionHash','definition','style','accessRules','resultRules','results'],'Brouillon Espace');
      validateDefinition(poll.definition);validateStyle(poll.style);validateAccess(poll.accessRules);validateRules(poll.resultRules,true);validateProjection(poll.results);
    }else validateRelayResponse('getPoll',poll,ref.relayId,ref.pollId);
    if(value.kind==='memberPoll')need(typeof value.alreadyParticipated==='boolean','RELAY_UNAVAILABLE');
  }
  if(value.kind==='vote'){const ref=value.receipt?.remoteRef;need(ref&&(!relayId||ref.relayId===relayId)&&(!pollId||ref.pollId===pollId),'RELAY_UNAVAILABLE');validateRelayResponse('castVote',value.receipt,ref.relayId,ref.pollId);}
  if(value.kind==='results'){const ref=value.results?.remoteRef;need(ref&&(!relayId||ref.relayId===relayId)&&(!pollId||ref.pollId===pollId),'RELAY_UNAVAILABLE');validateRelayResponse('getResults',value.results,ref.relayId,ref.pollId);}
  if(value.kind==='comments')validateCommentPage(value.page);
  if(value.kind==='member'){
    need(isPublicPollId(value.memberId)&&memberName(value.displayName)===value.displayName,'RELAY_UNAVAILABLE');object(value.space,['spaceId','name'],'Espace participant');need(isPublicPollId(value.space.spaceId)&&spaceName(value.space.name)===value.space.name,'RELAY_UNAVAILABLE');
    need(Array.isArray(value.groups)&&value.groups.length<=20&&Array.isArray(value.polls)&&value.polls.length<=200,'RELAY_UNAVAILABLE');
    for(const g of value.groups){object(g,['group_id','name'],'Groupe participant');need(isPublicPollId(g.group_id)&&spaceName(g.name)===g.name,'RELAY_UNAVAILABLE');}
    for(const p of value.polls){object(p,['pollId','question','status','alreadyParticipated','resultsAvailable'],'Sondage participant');need(isPublicPollId(p.pollId)&&typeof p.question==='string'&&p.question.length<=240&&['published','closed'].includes(p.status)&&typeof p.alreadyParticipated==='boolean'&&typeof p.resultsAvailable==='boolean','RELAY_UNAVAILABLE');}
  }
  if(value.kind==='space'){
    need(isPublicPollId(value.spaceId)&&spaceName(value.name)===value.name&&Number.isSafeInteger(value.revision)&&value.revision>0&&['active','archived'].includes(value.status),'RELAY_UNAVAILABLE');
    object(value.access,['role','groupIds'],'Accès adulte');need(['admin','creator'].includes(value.access.role),'RELAY_UNAVAILABLE');
    const ids=list=>Array.isArray(list)&&list.length<=20&&list.every(isPublicPollId)&&new Set(list).size===list.length;
    need(value.access.groupIds===null||ids(value.access.groupIds),'RELAY_UNAVAILABLE');
    for(const [key,max] of [['members',200],['groups',20],['staffAccesses',20],['invitations',40],['polls',200]])need(Array.isArray(value[key])&&value[key].length<=max,'RELAY_UNAVAILABLE');
    if(value.access.role==='creator')need(!value.members.length&&!value.staffAccesses.length&&!value.invitations.length,'RELAY_UNAVAILABLE');
    for(const m of value.members){object(m,['member_id','display_name','status','has_card','groupIds'],'Membre administré');need(isPublicPollId(m.member_id)&&memberName(m.display_name)===m.display_name&&['active','revoked'].includes(m.status)&&[0,1].includes(m.has_card)&&Array.isArray(m.groupIds)&&m.groupIds.length<=20&&m.groupIds.every(isPublicPollId),'RELAY_UNAVAILABLE');}
    for(const g of value.groups){object(g,['group_id','name','status'],'Groupe administré');need(isPublicPollId(g.group_id)&&spaceName(g.name)===g.name&&['active','archived'].includes(g.status),'RELAY_UNAVAILABLE');}
    for(const a of value.staffAccesses){object(a,['access_id','role','group_scopes','status'],'Accès de gestion');need(isPublicPollId(a.access_id)&&['admin','creator'].includes(a.role)&&['active','revoked'].includes(a.status)&&(a.group_scopes===null||typeof a.group_scopes==='string'&&ids(JSON.parse(a.group_scopes))),'RELAY_UNAVAILABLE');}
    for(const i of value.invitations){object(i,['invitation_id','group_ids','max_uses','uses','expires_at','closed'],'Invitation');need(isPublicPollId(i.invitation_id)&&typeof i.group_ids==='string'&&ids(JSON.parse(i.group_ids))&&Number.isSafeInteger(i.max_uses)&&i.max_uses>=1&&i.max_uses<=200&&Number.isSafeInteger(i.uses)&&i.uses>=0&&i.uses<=i.max_uses&&Number.isSafeInteger(i.expires_at)&&[0,1].includes(i.closed),'RELAY_UNAVAILABLE');}
    for(const p of value.polls){object(p,['pollId','status','question'],'Sondage Espace');need(isPublicPollId(p.pollId)&&['draft','published','closed'].includes(p.status)&&typeof p.question==='string'&&[...p.question].length<=240,'RELAY_UNAVAILABLE');}
  }
  // Ne jamais recevoir un credential serveur, ni des bulletins bruts.
  const reject=entry=>{if(!entry||typeof entry!=='object')return;for(const [key,child]of Object.entries(entry)){
    need(!['credential','credentialDigest','credential_digest','adminCapability','memberCredential','staffCredential','ballots','actionId','action_id'].includes(key),'RELAY_UNAVAILABLE');reject(child);
  }};reject(value);
  if(value.kind==='attendance'){
    need(['anonymous','identified'].includes(value.identityMode)&&Number.isSafeInteger(value.consumed)&&Number.isSafeInteger(value.eligible)&&value.consumed>=0&&value.consumed<=value.eligible,'RELAY_UNAVAILABLE');
    if(value.identityMode==='anonymous')need(value.members===null,'RELAY_UNAVAILABLE');else{need(Array.isArray(value.members)&&value.members.length<=200,'RELAY_UNAVAILABLE');for(const m of value.members){object(m,['member_id','display_name','consumed','participation_id','choice_id','comment_id','text'],'Suivi identifié');need(isPublicPollId(m.member_id)&&memberName(m.display_name)===m.display_name&&[0,1].includes(m.consumed),'RELAY_UNAVAILABLE');}}
  }
  return structuredClone(value);
}
