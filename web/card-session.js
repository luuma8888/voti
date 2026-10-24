import {createSpaceCredential} from '../shared/spaces.js';
const key=c=>c.spaceId+':'+c.memberId;
const DEFINITE=new Set(['INVALID_REQUEST','INVALID_CAPABILITY','ACCESS_DENIED','NOT_FOUND','REVISION_CONFLICT','PAYLOAD_TOO_LARGE','RATE_LIMITED','CREATION_RATE_LIMITED']);
export const availableCards=(ui,spaceId)=>ui.issued.filter(c=>c.spaceId===spaceId&&c.state==='ready');
export function eraseCard(card){if(!card)return;card.credential='';if(card.previous){eraseCard(card.previous);delete card.previous;}}
export function rememberCard(ui,card,state='ready'){
 const index=ui.issued.findIndex(c=>key(c)===key(card)),previous=index>=0?ui.issued[index]:null;
 card.state=state;card.version=++ui.cardsVersion;if(previous===card)return card;
 if(state==='ready')eraseCard(previous);else if(previous)card.previous=previous;
 if(index>=0)ui.issued.splice(index,1,card);else ui.issued.push(card);return card;
}
export function clearCards(ui,spaceId=null){
 for(let i=ui.issued.length-1;i>=0;i--)if(!spaceId||ui.issued[i].spaceId===spaceId){eraseCard(ui.issued[i]);ui.issued.splice(i,1);}
 ui.cardsVersion++;ui.cardsClearVersion++;if(!spaceId||ui.cardBatchResult?.spaceId===spaceId)ui.cardBatchResult=null;
}
export function forgetCard(ui,spaceId,memberId){for(let i=ui.issued.length-1;i>=0;i--)if(ui.issued[i].spaceId===spaceId&&ui.issued[i].memberId===memberId){eraseCard(ui.issued[i]);ui.issued.splice(i,1);ui.cardsVersion++;}}
function restorePrevious(ui,card){const i=ui.issued.indexOf(card);if(i<0)return;const old=card.previous;delete card.previous;eraseCard(card);if(old)ui.issued.splice(i,1,old);else ui.issued.splice(i,1);ui.cardsVersion++;}
export async function verifyPendingCards(ui,spaceId){
 let verified=0,refused=0;
 for(const card of ui.issued.filter(c=>c.spaceId===spaceId&&c.state==='unconfirmed')){
  try{const p=await ui.adapter.spaceCommand({command:'getMemberHome',input:{},credential:card.credential});if(p.memberId!==card.memberId||p.space.spaceId!==spaceId)throw Object.assign(new Error('Carte incompatible'),{code:'INVALID_CAPABILITY'});eraseCard(card.previous);delete card.previous;card.state='ready';card.version=++ui.cardsVersion;const recent=ui.cardBatchResult;if(recent?.spaceId===spaceId&&recent.unconfirmed.includes(card.memberId)){recent.unconfirmed=recent.unconfirmed.filter(id=>id!==card.memberId);recent.entries.push({memberId:card.memberId,version:card.version});}ui.cardSelection?.ids.delete(card.memberId);verified++;}
  catch(e){if(e.code==='INVALID_CAPABILITY'||e.code==='NOT_FOUND'){if(card.previous){try{const old=await ui.adapter.spaceCommand({command:'getMemberHome',input:{},credential:card.previous.credential});if(old.memberId!==card.memberId||old.space.spaceId!==spaceId){eraseCard(card.previous);delete card.previous;}}catch(previousError){if(!['INVALID_CAPABILITY','NOT_FOUND'].includes(previousError.code))break;eraseCard(card.previous);delete card.previous;}}const recent=ui.cardBatchResult;if(recent?.spaceId===spaceId&&recent.unconfirmed.includes(card.memberId)){recent.unconfirmed=recent.unconfirmed.filter(id=>id!==card.memberId);recent.failed.push({memberId:card.memberId,code:'INVALID_CAPABILITY'});}restorePrevious(ui,card);refused++;}else break;}
 }
 return{verified,refused};
}
export async function issueSelectedCards(ui,data,ids,onProgress=()=>{}){
 const selected=[...new Set(ids)],clearVersion=ui.cardsClearVersion,result={spaceId:data.spaceId,requested:selected.length,entries:[],failed:[],unconfirmed:[],notAttempted:0};
 if(data.access.role!=='admin'||data.status!=='active')throw Object.assign(new Error('Action réservée à l’administration.'),{code:'ACCESS_DENIED'});
 ui.cardJob={running:true,route:location.hash};
 try{
  for(const memberId of selected){
   if(clearVersion!==ui.cardsClearVersion)break;let card;
   try{
    const current=await ui.adapter.spaceCommand({command:'getSpace',input:{spaceId:data.spaceId},credential:ui.staff(data.spaceId)}),member=current.members.find(m=>m.member_id===memberId&&m.status==='active');
    if(!member)throw Object.assign(new Error('Membre non disponible.'),{code:'NOT_FOUND'});
    if(clearVersion!==ui.cardsClearVersion)break;
    card=rememberCard(ui,{spaceId:data.spaceId,memberId,credential:createSpaceCredential('member'),displayName:member.display_name,spaceName:current.name,memberVisualId:member.visual_id??null,groups:current.groups.filter(g=>member.groupIds.includes(g.group_id)).map(g=>({name:g.name,visualId:g.visual_id??null}))},'issuing');
    await ui.adapter.spaceCommand({command:'rotateMemberCard',input:{spaceId:data.spaceId,memberId,memberCredential:card.credential,expectedRevision:current.revision},credential:ui.staff(data.spaceId)});
    if(clearVersion!==ui.cardsClearVersion)break;
    eraseCard(card.previous);delete card.previous;card.state='ready';card.version=++ui.cardsVersion;result.entries.push({memberId,version:card.version});
   }catch(e){
    if(clearVersion!==ui.cardsClearVersion)break;
    if(card&&!DEFINITE.has(e.code)){card.state='unconfirmed';result.unconfirmed.push(memberId);}else{if(card)restorePrevious(ui,card);result.failed.push({memberId,code:e.code??'RELAY_UNAVAILABLE'});}break;
   }
   onProgress(result.entries.length,selected.length);
  }
  result.notAttempted=selected.length-result.entries.length-result.failed.length-result.unconfirmed.length;
  if(clearVersion===ui.cardsClearVersion)ui.cardBatchResult=result;return result;
 }finally{ui.cardJob=null;}
}
