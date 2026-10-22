import {RelayError,relayEnsure as need,isPublicPollId} from '../../shared/relay.js';
import {canonical,semanticHash} from '../../shared/model.js';
import {validatePoll,validateDefinition,validateRules} from '../../shared/validation.js';
import {assetReferences} from '../../shared/assets.js';
import {memberName,spaceName,spaceCredentialDigest,validatePollAudience,creatorAllowsAudience,groupResultsAvailable} from '../../shared/spaces.js';
import {normalizeSubmission,submissionDigest,participationRules} from '../../shared/participation.js';
import {validateSpaceCommand} from '../../shared/space-wire.js';

const now=()=>Math.floor(Date.now()/1000);
export class SpacesService {
  constructor(relay){this.relay=relay;this.db=relay.db;this.env=relay.env;}
  sql(query,...args){return this.relay.sql(query,...args);}
  async staff(spaceId,credential,expected,adminOnly=false){
    const digest=await spaceCredentialDigest(this.env.RELAY_ID,'staff',credential);
    const row=await this.sql(`SELECT a.*,s.revision,s.name,s.status space_status FROM space_access a JOIN spaces s USING(space_id)
      WHERE a.space_id=? AND a.credential_digest=? AND a.status='active' AND (s.status='active' OR a.role='admin')`,spaceId,digest).first();
    need(row,'INVALID_CAPABILITY');need(!adminOnly||row.role==='admin','ACCESS_DENIED');
    if(expected!==undefined)need(expected===row.revision,'REVISION_CONFLICT');
    return {...row,spaceId:row.space_id,groupIds:row.group_scopes===null?null:JSON.parse(row.group_scopes)};
  }
  async member(credential){
    const digest=await spaceCredentialDigest(this.env.RELAY_ID,'member',credential);
    const row=await this.sql(`SELECT m.*,s.name space_name FROM member_credentials c JOIN space_members m USING(member_id)
      JOIN spaces s USING(space_id) WHERE c.credential_digest=? AND m.status='active' AND s.status='active'`,digest).first();
    need(row,'INVALID_CAPABILITY');return {...row,digest};
  }
  async audience(pollId){
    const row=await this.sql('SELECT * FROM poll_audiences WHERE poll_id=?',pollId).first();need(row,'NOT_FOUND');
    const groups=(await this.sql('SELECT group_id FROM poll_audience_groups WHERE poll_id=?',pollId).all()).results;
    return {spaceId:row.space_id,mode:row.mode,groupIds:groups.map(g=>g.group_id),resultsAudience:row.results_audience};
  }
  async adminPoll(row,credential,expected,mutation){
    const audience=await this.audience(row.poll_id),access=await this.staff(audience.spaceId,credential);
    need(creatorAllowsAudience({...access,status:access.status},audience),'ACCESS_DENIED');
    if(mutation)need(expected===row.revision,'REVISION_CONFLICT');
    return {...row,staffAccessId:access.access_id,staffDigest:access.credential_digest};
  }
  async eligible(pollId,credential,results=false){
    const member=await this.member(credential),audience=await this.audience(pollId);
    need(member.space_id===audience.spaceId,'NOT_ELIGIBLE');
    const eligibility=await this.sql('SELECT consumed FROM poll_member_eligibility WHERE poll_id=? AND member_id=?',pollId,member.member_id).first();
    need(eligibility,'NOT_ELIGIBLE');if(results)need(audience.resultsAudience==='poll_audience','ACCESS_DENIED');
    return {...member,consumed:eligibility.consumed,audience};
  }
  async mutate(access,statements){
    const guard=crypto.randomUUID();
    try{return await this.db.batch([
      this.sql(`INSERT INTO mutation_guards VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM spaces s JOIN space_access a USING(space_id)
        WHERE s.space_id=? AND s.revision=? AND s.status='active' AND a.access_id=? AND a.credential_digest=? AND a.status='active' AND a.role=?) THEN 1 ELSE 0 END)`,
        guard,access.space_id,access.revision,access.access_id,access.credential_digest,access.role),...statements,
      this.sql('UPDATE spaces SET revision=revision+1 WHERE space_id=?',access.space_id),this.sql('DELETE FROM mutation_guards WHERE id=?',guard)]);
    }catch{
      const current=await this.sql('SELECT revision FROM spaces WHERE space_id=?',access.space_id).first();
      need(current,'NOT_FOUND');need(current.revision===access.revision,'REVISION_CONFLICT');throw new RelayError('RELAY_UNAVAILABLE');
    }
  }
  async groupIds(spaceId,ids){
    need(Array.isArray(ids)&&ids.length<=20&&ids.every(isPublicPollId)&&new Set(ids).size===ids.length,'INVALID_REQUEST');
    if(ids.length)need((await this.sql(`SELECT count(*) n FROM groups WHERE group_id IN (${ids.map(()=>'?').join(',')}) AND space_id=? AND status='active'`,...ids,spaceId).first()).n===ids.length,'ACCESS_DENIED');
  }
  async view(access){
    const id=access.space_id,isAdmin=access.role==='admin';
    const groups=(await this.sql('SELECT group_id,name,status FROM groups WHERE space_id=? ORDER BY name',id).all()).results.filter(g=>access.groupIds===null||access.groupIds.includes(g.group_id));
    const members=isAdmin?(await this.sql(`SELECT m.member_id,m.display_name,m.status,EXISTS(SELECT 1 FROM member_credentials c WHERE c.member_id=m.member_id) has_card,
      (SELECT json_group_array(group_id) FROM group_memberships WHERE member_id=m.member_id) group_ids FROM space_members m WHERE space_id=? ORDER BY display_name`,id).all()).results:[];
    for(const member of members){member.groupIds=JSON.parse(member.group_ids);delete member.group_ids;}
    const invitations=isAdmin?(await this.sql('SELECT invitation_id,group_ids,max_uses,uses,expires_at,closed FROM invitations WHERE space_id=?',id).all()).results:[];
    const polls=(await this.sql(`SELECT p.poll_id,p.status,p.definition,a.mode,a.results_audience,
      (SELECT json_group_array(group_id) FROM poll_audience_groups WHERE poll_id=p.poll_id) group_ids FROM polls p JOIN poll_audiences a USING(poll_id) WHERE a.space_id=?
      AND (p.status!='draft' OR EXISTS(SELECT 1 FROM publications x WHERE x.poll_id=p.poll_id AND x.expires_at>unixepoch()))`,id).all()).results;
    const allowed=[];for(const poll of polls){const audience={spaceId:id,mode:poll.mode,groupIds:JSON.parse(poll.group_ids),resultsAudience:poll.results_audience};if(creatorAllowsAudience(access,audience))allowed.push({pollId:poll.poll_id,status:poll.status,question:JSON.parse(poll.definition).question});}
    return {kind:'space',spaceId:id,name:access.name,status:access.space_status,revision:access.revision,
      access:{role:access.role,groupIds:access.groupIds},staffAccesses:isAdmin?(await this.sql('SELECT access_id,role,group_scopes,status FROM space_access WHERE space_id=?',id).all()).results:[],groups,members,invitations,polls:allowed};
  }
  async command(command,input,credential){
    const data=validateSpaceCommand(command,input);
    if(command==='createSpace'){
      need(data.expectedRevision===0,'REVISION_CONFLICT');const name=spaceName(data.name),digest=await spaceCredentialDigest(this.env.RELAY_ID,'staff',credential);
      await this.db.batch([this.sql('INSERT INTO spaces(space_id,name) VALUES(?,?)',data.spaceId,name),
        this.sql("INSERT INTO space_access(access_id,space_id,role,group_scopes,credential_digest) VALUES(?,?,'admin',NULL,?)",crypto.randomUUID(),data.spaceId,digest)]);
      return this.view(await this.staff(data.spaceId,credential));
    }
    if(command==='acceptInvitation')return this.acceptInvitation(data,credential);
    if(command==='getMemberHome'){
      const member=await this.member(credential),groups=(await this.sql("SELECT g.group_id,g.name FROM group_memberships m JOIN groups g USING(group_id) WHERE m.member_id=? AND g.status='active'",member.member_id).all()).results;
      const polls=(await this.sql(`SELECT p.poll_id,p.status,p.definition,p.result_rules,e.consumed,a.snapshot_size,a.results_audience,
        (SELECT coalesce(sum(consumed),0) FROM poll_member_eligibility WHERE poll_id=p.poll_id) consumed_total
        FROM poll_member_eligibility e JOIN polls p USING(poll_id) JOIN poll_audiences a USING(poll_id)
        WHERE e.member_id=? AND p.status!='draft'`,member.member_id).all()).results;
      return {kind:'member',memberId:member.member_id,displayName:member.display_name,space:{spaceId:member.space_id,name:member.space_name},groups,
        polls:polls.map(p=>({pollId:p.poll_id,question:JSON.parse(p.definition).question,status:p.status,alreadyParticipated:Boolean(p.consumed),resultsAvailable:p.results_audience==='poll_audience'&&groupResultsAvailable(p.status,JSON.parse(p.result_rules),p.consumed_total,p.snapshot_size)}))};
    }
    if(['getMemberPoll','getMemberResults','getMemberComments','castMemberVote'].includes(command)){
      const member=await this.eligible(data.pollId,credential,['getMemberResults','getMemberComments'].includes(command));
      if(command==='castMemberVote')return{kind:'vote',receipt:await this.vote(data,member)};
      const poll=await this.relay.projection(data.pollId,true);
      if(['getMemberResults','getMemberComments'].includes(command))need(poll.accessRules.pollAudience.resultsAudience==='poll_audience','ACCESS_DENIED');
      if(command==='getMemberResults'){need(poll.results.available,'RESULTS_LOCKED');return{kind:'results',results:{remoteRef:poll.remoteRef,...poll.results}};}
      if(command==='getMemberComments'){need(poll.results.available,'RESULTS_LOCKED');need(participationRules(poll.definition).commentVisibility==='public_with_results','NOT_FOUND');need(data.cursor===null||isPublicPollId(data.cursor),'INVALID_REQUEST');return{kind:'comments',page:await this.relay.comments(data.pollId,data.cursor)};}
      if(poll.accessRules.pollAudience.resultsAudience==='admins_only')poll.results={available:false,minimumResponses:poll.resultRules.minimumResponses,releaseMode:poll.resultRules.releaseMode};
      return{kind:'memberPoll',poll,alreadyParticipated:Boolean(member.consumed)};
    }
    if(['getSpacePoll','publishSpacePoll','getPollAttendance','updateSpacePoll','getSpaceComments'].includes(command)){
      const source=await this.relay.row(data.pollId);need(source,'NOT_FOUND');const row=await this.adminPoll(source,credential,data.expectedRevision,['publishSpacePoll','updateSpacePoll'].includes(command));
      if(row.status==='draft')need(await this.sql('SELECT 1 FROM publications WHERE poll_id=? AND expires_at>unixepoch()',row.poll_id).first(),'NOT_FOUND');
      if(command==='getPollAttendance')return this.attendance(row);
      if(command==='getSpaceComments'){const view=await this.relay.projection(data.pollId,true);need(view.results.available,'RESULTS_LOCKED');need(participationRules(view.definition).commentVisibility==='public_with_results','NOT_FOUND');need(data.cursor===null||isPublicPollId(data.cursor),'INVALID_REQUEST');return{kind:'comments',page:await this.relay.comments(data.pollId,data.cursor)};}
      if(command==='getSpacePoll')return{kind:'poll',poll:row.status==='draft'?{remoteRef:this.relay.ref(row),status:'draft',locked:false,definitionHash:null,definition:JSON.parse(row.definition),style:JSON.parse(row.style),accessRules:JSON.parse(row.access_rules),resultRules:JSON.parse(row.result_rules),results:{available:false,minimumResponses:JSON.parse(row.result_rules).minimumResponses,releaseMode:JSON.parse(row.result_rules).releaseMode}}:await this.relay.projection(data.pollId,true)};
      if(command==='updateSpacePoll'){
        need(!row.locked,'POLL_LOCKED');need(row.status!=='closed','POLL_CLOSED');try{validateDefinition(data.definition);validateRules(data.resultRules,true);}catch{throw new RelayError('INVALID_DEFINITION');}
        const audience=validatePollAudience(data.pollAudience),old=await this.audience(row.poll_id),access=await this.staff(old.spaceId,credential);
        need(audience.spaceId===old.spaceId&&creatorAllowsAudience(access,audience),'ACCESS_DENIED');await this.groupIds(old.spaceId,audience.groupIds);
        if(row.status!=='draft')need(audience.mode===old.mode&&canonical(audience.groupIds)===canonical([...old.groupIds].sort()),'POLL_LOCKED');
        need(assetReferences({polls:[{definition:data.definition}]}).size===0,'REMOTE_ASSETS_DISABLED');
        need(!data.definition.choices.some(c=>c.id===row.poll_id),'INVALID_DEFINITION');
        const accessRules=JSON.parse(row.access_rules);accessRules.pollAudience=audience;
        await this.relay.mutate(row,[this.relay.bump(row.poll_id,',definition=?,result_rules=?,access_rules=?,semantic_hash=?',[canonical(data.definition),canonical(data.resultRules),canonical(accessRules),await semanticHash({definition:data.definition,resultRules:data.resultRules,accessRules})]),this.sql('UPDATE poll_audiences SET results_audience=?,mode=? WHERE poll_id=?',audience.resultsAudience,audience.mode,row.poll_id),
          ...(row.status==='draft'?[this.sql('DELETE FROM poll_audience_groups WHERE poll_id=?',row.poll_id),...audience.groupIds.map(g=>this.sql('INSERT INTO poll_audience_groups VALUES(?,?)',row.poll_id,g))]:[])]);
        return{kind:'prepared',pollId:row.poll_id,revision:(await this.relay.row(row.poll_id)).revision};
      }
      return this.publish(row);
    }
    const access=await this.staff(data.spaceId,credential,data.expectedRevision, !['getSpace','prepareSpacePublication'].includes(command));
    if(command==='getSpace')return this.view(access);
    if(command==='prepareSpacePublication')return this.prepare(access,data);
    const bounds={createGroup:['groups',20],createMember:['space_members',200],createAccess:['space_access',20],createInvitation:['invitations',40]};
    if(bounds[command]){const[table,max]=bounds[command];need((await this.sql(`SELECT count(*) n FROM ${table} WHERE space_id=?`,data.spaceId).first()).n<max,'PAYLOAD_TOO_LARGE');}
    let statements=[];
    if(command==='renameSpace')statements=[this.sql('UPDATE spaces SET name=? WHERE space_id=?',spaceName(data.name),data.spaceId)];
    else if(command==='archiveSpace')statements=[this.sql("UPDATE spaces SET status='archived' WHERE space_id=?",data.spaceId)];
    else if(command==='createGroup')statements=[this.sql('INSERT INTO groups(group_id,space_id,name) VALUES(?,?,?)',data.groupId,data.spaceId,spaceName(data.name))];
    else if(['renameGroup','archiveGroup'].includes(command)){
      need(await this.sql('SELECT 1 FROM groups WHERE group_id=? AND space_id=?',data.groupId,data.spaceId).first(),'NOT_FOUND');
      if(command==='archiveGroup')need(!await this.sql("SELECT 1 FROM poll_audience_groups g JOIN polls p USING(poll_id) WHERE g.group_id=? AND p.status IN ('draft','published')",data.groupId).first(),'PUBLICATION_CONFLICT');
      statements=[command==='renameGroup'?this.sql('UPDATE groups SET name=? WHERE group_id=?',spaceName(data.name),data.groupId):this.sql("UPDATE groups SET status='archived' WHERE group_id=?",data.groupId)];
    }else if(['createMember','updateMember','revokeMember','rotateMemberCard','revokeMemberCard'].includes(command)){
      if(command!=='createMember')need(await this.sql('SELECT 1 FROM space_members WHERE member_id=? AND space_id=?',data.memberId,data.spaceId).first(),'NOT_FOUND');
      if(['createMember','updateMember'].includes(command)){
        await this.groupIds(data.spaceId,data.groupIds);const name=memberName(data.displayName);
        statements.push(command==='createMember'?this.sql('INSERT INTO space_members(member_id,space_id,display_name) VALUES(?,?,?)',data.memberId,data.spaceId,name):this.sql('UPDATE space_members SET display_name=? WHERE member_id=?',name,data.memberId),
          this.sql('DELETE FROM group_memberships WHERE member_id=?',data.memberId),...data.groupIds.map(g=>this.sql('INSERT INTO group_memberships VALUES(?,?,?)',data.spaceId,g,data.memberId)));
      }
      if(['createMember','rotateMemberCard'].includes(command)){
        const digest=await spaceCredentialDigest(this.env.RELAY_ID,'member',data.memberCredential);
        if(command==='rotateMemberCard')need(await this.sql("SELECT 1 FROM space_members WHERE member_id=? AND status='active'",data.memberId).first(),'NOT_FOUND');
        statements.push(this.sql('INSERT INTO member_credentials VALUES(?,?) ON CONFLICT(member_id) DO UPDATE SET credential_digest=excluded.credential_digest',data.memberId,digest));
      }
      if(command==='revokeMember')statements.push(this.sql("UPDATE space_members SET status='revoked' WHERE member_id=?",data.memberId),this.sql('DELETE FROM member_credentials WHERE member_id=?',data.memberId),this.sql('DELETE FROM group_memberships WHERE member_id=?',data.memberId));
      if(command==='revokeMemberCard')statements.push(this.sql('DELETE FROM member_credentials WHERE member_id=?',data.memberId));
    }else if(command==='createAccess'){
      need(['admin','creator'].includes(data.role),'INVALID_REQUEST');need(data.groupIds===null||data.role==='creator','INVALID_REQUEST');if(data.groupIds!==null)await this.groupIds(data.spaceId,data.groupIds);
      statements=[this.sql('INSERT INTO space_access(access_id,space_id,role,group_scopes,credential_digest) VALUES(?,?,?,?,?)',data.accessId,data.spaceId,data.role,data.groupIds===null?null:JSON.stringify(data.groupIds),await spaceCredentialDigest(this.env.RELAY_ID,'staff',data.staffCredential))];
    }else if(command==='revokeAccess'){
      const target=await this.sql("SELECT * FROM space_access WHERE access_id=? AND space_id=? AND status='active'",data.accessId,data.spaceId).first();need(target,'NOT_FOUND');
      if(target.role==='admin')need((await this.sql("SELECT count(*) n FROM space_access WHERE space_id=? AND role='admin' AND status='active'",data.spaceId).first()).n>1,'ACCESS_DENIED');
      statements=[this.sql("UPDATE space_access SET status='revoked' WHERE access_id=?",data.accessId)];
    }else if(command==='createInvitation'){
      await this.groupIds(data.spaceId,data.groupIds);need(Number.isSafeInteger(data.maxUses)&&data.maxUses>=1&&data.maxUses<=200&&Number.isSafeInteger(data.expiresInDays)&&data.expiresInDays>=1&&data.expiresInDays<=30,'INVALID_REQUEST');
      statements=[this.sql('INSERT INTO invitations(invitation_id,space_id,group_ids,credential_digest,max_uses,expires_at) VALUES(?,?,?,?,?,?)',data.invitationId,data.spaceId,JSON.stringify(data.groupIds),await spaceCredentialDigest(this.env.RELAY_ID,'invitation',data.invitationCredential),data.maxUses,now()+data.expiresInDays*86400)];
    }else if(command==='closeInvitation')statements=[this.sql('UPDATE invitations SET closed=1 WHERE invitation_id=? AND space_id=?',data.invitationId,data.spaceId)];
    else need(false,'INVALID_REQUEST');
    await this.mutate(access,statements);return{kind:'mutation',spaceId:data.spaceId,revision:access.revision+1};
  }
  async acceptInvitation(data,credential){
    const digest=await spaceCredentialDigest(this.env.RELAY_ID,'invitation',credential),row=await this.sql('SELECT * FROM invitations WHERE credential_digest=?',digest).first();need(row,'INVALID_CAPABILITY');
    const cardDigest=await spaceCredentialDigest(this.env.RELAY_ID,'member',data.memberCredential),name=memberName(data.displayName);
    const existing=await this.sql('SELECT m.* FROM space_members m JOIN member_credentials c USING(member_id) WHERE m.member_id=? AND c.credential_digest=?',data.memberId,cardDigest).first();
    if(existing){need(existing.space_id===row.space_id&&existing.display_name===name&&existing.status==='active','INVALID_CAPABILITY');return{kind:'acceptedInvitation',spaceId:row.space_id,memberId:data.memberId};}
    need(!row.closed&&row.expires_at>now(),'INVITATION_EXPIRED');need(row.uses<row.max_uses,'INVITATION_EXHAUSTED');
    const groups=JSON.parse(row.group_ids);await this.groupIds(row.space_id,groups);const guard=crypto.randomUUID();
    try{await this.db.batch([
      this.sql(`INSERT INTO mutation_guards VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM invitations i JOIN spaces s USING(space_id)
        WHERE i.invitation_id=? AND i.closed=0 AND i.expires_at>unixepoch() AND i.uses<i.max_uses AND s.status='active') THEN 1 ELSE 0 END)`,guard,row.invitation_id),
      this.sql('INSERT INTO space_members(member_id,space_id,display_name) VALUES(?,?,?)',data.memberId,row.space_id,name),this.sql('INSERT INTO member_credentials VALUES(?,?)',data.memberId,cardDigest),
      ...groups.map(g=>this.sql('INSERT INTO group_memberships VALUES(?,?,?)',row.space_id,g,data.memberId)),
      this.sql('UPDATE invitations SET uses=uses+1 WHERE invitation_id=?',row.invitation_id),this.sql('UPDATE spaces SET revision=revision+1 WHERE space_id=?',row.space_id),this.sql('DELETE FROM mutation_guards WHERE id=?',guard)]);
    }catch{
      const retry=await this.sql('SELECT m.* FROM space_members m JOIN member_credentials c USING(member_id) WHERE m.member_id=? AND c.credential_digest=?',data.memberId,cardDigest).first();
      if(retry&&retry.space_id===row.space_id&&retry.display_name===name&&retry.status==='active')return{kind:'acceptedInvitation',spaceId:row.space_id,memberId:data.memberId};
      const current=await this.sql('SELECT closed,expires_at,uses,max_uses FROM invitations WHERE invitation_id=?',row.invitation_id).first();need(current&&!current.closed&&current.expires_at>now(),'INVITATION_EXPIRED');need(current.uses<current.max_uses,'INVITATION_EXHAUSTED');throw new RelayError('RELAY_UNAVAILABLE');
    }
    return{kind:'acceptedInvitation',spaceId:row.space_id,memberId:data.memberId};
  }
  async prepare(access,data){
    need((await this.sql('SELECT count(*) n FROM poll_audiences WHERE space_id=?',access.space_id).first()).n<200,'PAYLOAD_TOO_LARGE');
    const audience=validatePollAudience(data.pollAudience);need(audience.spaceId===access.space_id&&creatorAllowsAudience(access,audience),'ACCESS_DENIED');await this.groupIds(audience.spaceId,audience.groupIds);
    const poll=structuredClone(data.poll);poll.schemaVersion=4;poll.contextId=audience.spaceId;poll.accessRules={audience:'context',requiresAccount:false,allowDirectChoiceQr:false,pollAudience:audience};
    need(poll.status==='draft'&&poll.stats.totalBallots===0&&!poll.lockedAt,'LOCAL_VOTES_PRESENT');
    try{validatePoll(poll);}catch{throw new RelayError('INVALID_DEFINITION');}
    need(!poll.definition.choices.some(c=>c.id===poll.id)&&Object.values(poll.stats.countsByChoice).every(n=>n===0)&&poll.definitionHash===null,'INVALID_DEFINITION');this.relay.checkAssetPolicy(poll.definition);
    need(assetReferences({polls:[poll]}).size===0,'REMOTE_ASSETS_DISABLED');
    const statements=[this.sql(`INSERT INTO polls(poll_id,status,definition,style,access_rules,result_rules,semantic_hash,capability_hash,created_at)
      VALUES(?,'draft',?,?,?,?,?,?,?)`,poll.id,canonical(poll.definition),canonical(poll.style),canonical(poll.accessRules),canonical(poll.resultRules),await semanticHash(poll),crypto.randomUUID(),now()),
      this.sql('INSERT INTO publications VALUES(?,?,?)',poll.id,now()+86400,canonical(poll)),this.sql('INSERT INTO poll_audiences(poll_id,space_id,mode,results_audience) VALUES(?,?,?,?)',poll.id,audience.spaceId,audience.mode,audience.resultsAudience),
      ...audience.groupIds.map(g=>this.sql('INSERT INTO poll_audience_groups VALUES(?,?)',poll.id,g))];
    await this.mutate(access,statements);return{kind:'prepared',pollId:poll.id,revision:0};
  }
  async publish(row){
    need(row.status==='draft','PUBLICATION_CONFLICT');await this.relay.references(row.poll_id,JSON.parse(row.definition));
    const possible=await this.sql(`SELECT count(*) n FROM space_members m JOIN poll_audiences a ON a.space_id=m.space_id WHERE a.poll_id=? AND m.status='active'
      AND (a.mode='space' OR EXISTS(SELECT 1 FROM group_memberships g JOIN poll_audience_groups p ON p.group_id=g.group_id WHERE p.poll_id=a.poll_id AND g.member_id=m.member_id))`,row.poll_id).first();need(possible.n>0,'INVALID_DEFINITION');
    const insert=this.sql(`INSERT INTO poll_member_eligibility(poll_id,member_id) SELECT ?,m.member_id FROM space_members m JOIN poll_audiences a ON a.space_id=m.space_id
      WHERE a.poll_id=? AND m.status='active' AND (a.mode='space' OR EXISTS(SELECT 1 FROM group_memberships g JOIN poll_audience_groups p ON p.group_id=g.group_id WHERE p.poll_id=a.poll_id AND g.member_id=m.member_id))`,row.poll_id,row.poll_id);
    const guard=crypto.randomUUID();await this.relay.mutate(row,[
      this.sql('INSERT INTO mutation_guards VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM spaces s JOIN poll_audiences a USING(space_id) WHERE a.poll_id=? AND s.status=\'active\') THEN 1 ELSE 0 END)',guard,row.poll_id),insert,
      this.sql('UPDATE mutation_guards SET ok=CASE WHEN EXISTS(SELECT 1 FROM poll_member_eligibility WHERE poll_id=?) THEN 1 ELSE 0 END WHERE id=?',row.poll_id,guard),
      this.sql('UPDATE poll_audiences SET snapshot_size=(SELECT count(*) FROM poll_member_eligibility WHERE poll_id=?) WHERE poll_id=?',row.poll_id,row.poll_id),
      this.relay.bump(row.poll_id,",status='published',published_at=?",[now()]),this.sql('DELETE FROM publications WHERE poll_id=?',row.poll_id),this.sql('DELETE FROM mutation_guards WHERE id=?',guard)]);
    return{kind:'poll',poll:await this.relay.projection(row.poll_id,true)};
  }
  async attendance(row){
    const mode=participationRules(JSON.parse(row.definition)).participationIdentityMode;
    const counts=await this.sql('SELECT count(*) eligible,coalesce(sum(consumed),0) consumed FROM poll_member_eligibility WHERE poll_id=?',row.poll_id).first();
    let members=null;if(mode==='identified')members=(await this.sql(`SELECT m.member_id,coalesce(identity.display_name,m.display_name) display_name,e.consumed,x.participation_id,b.choice_id,c.comment_id,c.text
      FROM poll_member_eligibility e JOIN space_members m USING(member_id) LEFT JOIN member_participations x ON x.poll_id=e.poll_id AND x.member_id=e.member_id
      LEFT JOIN participations identity ON identity.participation_id=x.participation_id
      LEFT JOIN ballots b ON b.participation_id=x.participation_id LEFT JOIN comments c ON c.participation_id=x.participation_id WHERE e.poll_id=? ORDER BY m.display_name`,row.poll_id).all()).results;
    return{kind:'attendance',identityMode:mode,consumed:counts.consumed,eligible:counts.eligible,members};
  }
  async vote(data,member){
    const row=await this.relay.publicRow(data.pollId),definition=JSON.parse(row.definition),identified=participationRules(definition).participationIdentityMode==='identified';
    need(row.semantic_hash===data.expectedDefinitionHash,'REVISION_CONFLICT');
    need(data.actionId!==data.pollId&&!definition.choices.some(c=>c.id===data.actionId)&&!await this.sql('SELECT 1 FROM space_members WHERE member_id=?',data.actionId).first(),'INVALID_REQUEST');
    const previous=await this.sql('SELECT choice_id,submission_digest,participation_id FROM ballots WHERE poll_id=? AND action_id=?',data.pollId,data.actionId).first();
    // Un renommage du membre ne change pas le contenu d’une soumission déjà acceptée.
    const historic=identified&&previous?await this.sql('SELECT p.display_name FROM participations p JOIN member_participations x USING(participation_id) WHERE p.participation_id=? AND x.member_id=?',previous.participation_id,member.member_id).first():null;
    let submission;try{submission=normalizeSubmission(definition,{comment:data.comment,...(identified?{displayName:historic?.display_name??member.display_name}:{})});}catch(error){throw new RelayError(error.code==='INVALID_PARTICIPATION'?'INVALID_PARTICIPATION':'INVALID_COMMENT');}
    const digest=await submissionDigest(data.pollId,data.actionId,data.choiceId,submission);
    if(member.consumed){need(previous&&previous.choice_id===data.choiceId&&previous.submission_digest===digest,'ALREADY_PARTICIPATED');
      if(identified)need(await this.sql('SELECT 1 FROM member_participations WHERE participation_id=? AND member_id=?',previous.participation_id,member.member_id).first(),'ALREADY_PARTICIPATED');
      const view=await this.relay.projection(data.pollId,true);return{accepted:true,alreadyAccepted:true,remoteRef:view.remoteRef,status:view.status,locked:view.locked,results:member.audience.resultsAudience==='admins_only'?{available:false,minimumResponses:view.resultRules.minimumResponses,releaseMode:view.resultRules.releaseMode}:view.results};}
    need(!previous,'IDEMPOTENCY_CONFLICT');need(row.status==='published','POLL_CLOSED');need(definition.choices.some(c=>c.id===data.choiceId),'INVALID_CHOICE');
    const guard=crypto.randomUUID(),participationId=identified?crypto.randomUUID():null;
    const statements=[this.sql(`INSERT INTO mutation_guards VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM polls p JOIN poll_member_eligibility e USING(poll_id)
      JOIN space_members m USING(member_id) JOIN member_credentials c USING(member_id) JOIN spaces s ON s.space_id=m.space_id
      WHERE p.poll_id=? AND p.semantic_hash=? AND p.status='published' AND e.member_id=? AND e.consumed=0 AND m.status='active' AND s.status='active' AND c.credential_digest=?) THEN 1 ELSE 0 END)`,guard,data.pollId,row.semantic_hash,member.member_id,member.digest),
      this.sql('UPDATE poll_member_eligibility SET consumed=1 WHERE poll_id=? AND member_id=?',data.pollId,member.member_id),
      this.sql('INSERT INTO controlled_vote_guards VALUES(?,?)',data.pollId,guard)];
    if(identified)statements.push(this.sql('INSERT INTO participations(participation_id,poll_id,display_name) VALUES(?,?,?)',participationId,data.pollId,member.display_name),this.sql('INSERT INTO member_participations VALUES(?,?,?)',participationId,data.pollId,member.member_id));
    statements.push(this.sql('INSERT INTO ballots(poll_id,action_id,choice_id,participation_id,submission_digest) VALUES(?,?,?,?,?)',data.pollId,data.actionId,data.choiceId,participationId,digest));
    if(submission.comment)statements.push(this.sql("INSERT INTO comments(comment_id,poll_id,action_id,choice_id,text,moderation_status,revision,participation_id) VALUES(?,?,?,?,?,'pending',1,?)",crypto.randomUUID(),data.pollId,data.actionId,data.choiceId,submission.comment,participationId));
    statements.push(this.sql('DELETE FROM controlled_vote_guards WHERE poll_id=? AND guard_id=?',data.pollId,guard),this.sql('DELETE FROM mutation_guards WHERE id=?',guard));
    try{await this.db.batch(statements);}catch{
      need(await this.sql("SELECT 1 FROM member_credentials c JOIN space_members m USING(member_id) JOIN spaces s USING(space_id) WHERE c.member_id=? AND c.credential_digest=? AND m.status='active' AND s.status='active'",member.member_id,member.digest).first(),'INVALID_CAPABILITY');
      // Relecture par ids uniquement pour classer la course, jamais de lien au bulletin.
      const used=await this.sql('SELECT consumed FROM poll_member_eligibility WHERE poll_id=? AND member_id=?',data.pollId,member.member_id).first();
      if(used?.consumed){const b=await this.sql('SELECT submission_digest FROM ballots WHERE poll_id=? AND action_id=?',data.pollId,data.actionId).first();if(b?.submission_digest===digest){const view=await this.relay.projection(data.pollId,true);if(member.audience.resultsAudience==='admins_only')view.results={available:false,minimumResponses:view.resultRules.minimumResponses,releaseMode:view.resultRules.releaseMode};return{accepted:true,alreadyAccepted:true,remoteRef:view.remoteRef,status:view.status,locked:view.locked,results:view.results};}throw new RelayError('ALREADY_PARTICIPATED');}
      need(!await this.sql('SELECT 1 FROM ballots WHERE poll_id=? AND action_id=?',data.pollId,data.actionId).first(),'IDEMPOTENCY_CONFLICT');
      const latest=await this.relay.publicRow(data.pollId);need(latest.status==='published','POLL_CLOSED');need(latest.semantic_hash===row.semantic_hash,'REVISION_CONFLICT');throw new RelayError('RELAY_UNAVAILABLE');
    }
    const view=await this.relay.projection(data.pollId,true);if(member.audience.resultsAudience==='admins_only')view.results={available:false,minimumResponses:view.resultRules.minimumResponses,releaseMode:view.resultRules.releaseMode};
    return{accepted:true,alreadyAccepted:false,remoteRef:view.remoteRef,status:view.status,locked:view.locked,results:view.results};
  }
}
