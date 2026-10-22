import assert from 'node:assert/strict';
import {once} from 'node:events';
import {wrangler} from './relay-local.mjs';
import {createPoll} from '../shared/poll-engine.js';
import {emptyState,canonical,semanticHash} from '../shared/model.js';

// Base neuve ignorée, fixtures fictives AVANT 0004. Aucun --remote ni Worker réel.
const common=['voti-free-test','--config','relay/cloudflare/wrangler.free-test.jsonc','--local','--persist-to',`.relay-local/v06-migration-${Date.now()}`];
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
async function run(args){const child=wrangler(['d1','execute',...common,...args,'--json'],{stdio:['ignore','pipe','pipe']});let raw='';child.stdout.on('data',c=>raw+=c);child.stderr.resume();assert.equal((await once(child,'exit'))[0],0,'Contrôle D1 de migration locale refusé.');return JSON.parse(raw);}
const rows=async sql=>(await run(['--command',sql]))[0].results;let checks=0;
for(const file of ['0001_initial.sql','0002_cleanup_indexes.sql','0003_participation_comments.sql'])await run(['--file','relay/cloudflare/migrations/'+file]);
const polls=[];for(const identity of ['anonymous','identified']){
  const p=createPoll(emptyState(),{question:'Historique fictif '+identity,choices:['Été','Forêt'],participationIdentityMode:identity}).polls[0];
  if(identity==='anonymous'){p.schemaVersion=2;for(const key of ['participationIdentityMode','commentMode','commentVisibility'])delete p.definition[key];}
  const values=[p.id,canonical(p.definition),canonical(p.style),canonical(p.accessRules),canonical(p.resultRules),await semanticHash(p),'a'.repeat(64)];
  await rows(`INSERT INTO polls(poll_id,status,definition,style,access_rules,result_rules,semantic_hash,capability_hash,created_at,published_at) VALUES(${quote(values[0])},'published',${values.slice(1).map(quote).join(',')},1,1)`);
  const part=identity==='identified'?crypto.randomUUID():null;if(part)await rows(`INSERT INTO participations SELECT ${quote(part)},${quote(p.id)},'Pseudo historique fictif'`);
  await rows(`INSERT INTO ballots(poll_id,action_id,choice_id,participation_id,submission_digest) VALUES(${quote(p.id)},${quote(crypto.randomUUID())},${quote(p.definition.choices[0].id)},${part?quote(part):'NULL'},${quote('0'.repeat(64))})`);polls.push(p);
}
const before=await rows('SELECT * FROM polls ORDER BY poll_id'),ballots=await rows('SELECT * FROM ballots ORDER BY poll_id,action_id'),parts=await rows('SELECT * FROM participations ORDER BY participation_id');
await run(['--file','relay/cloudflare/migrations/0004_spaces_groups_members.sql']);
assert.deepEqual(await rows('SELECT * FROM polls ORDER BY poll_id'),before);checks++;
assert.deepEqual(await rows('SELECT * FROM ballots ORDER BY poll_id,action_id'),ballots);checks++;
assert.deepEqual(await rows('SELECT * FROM participations ORDER BY participation_id'),parts);checks++;
assert.deepEqual((await rows('PRAGMA table_info(participations)')).map(c=>c.name),['participation_id','poll_id','display_name']);checks++;
// Forme exacte sans liste de colonnes utilisée par l’ancien Worker v0.5.
const compatibleParticipation=crypto.randomUUID();await rows(`INSERT INTO participations SELECT ${quote(compatibleParticipation)},${quote(polls[1].id)},'Compatibilité fictive' WHERE 1`);
await rows(`INSERT INTO ballots(poll_id,action_id,choice_id,participation_id) VALUES(${quote(polls[1].id)},${quote(crypto.randomUUID())},${quote(polls[1].definition.choices[0].id)},${quote(compatibleParticipation)})`);checks++;
await rows(`INSERT INTO ballots(poll_id,action_id,choice_id) VALUES(${quote(polls[0].id)},${quote(crypto.randomUUID())},${quote(polls[0].definition.choices[0].id)})`);checks++;
assert.equal((await rows('SELECT count(*) n FROM poll_audiences'))[0].n,0);checks++;
assert.equal((await rows('SELECT count(*) n FROM member_participations'))[0].n,0);checks++;
console.log(`Migration 0004 locale : ${checks} contrôles réussis, lignes/hashes v0.4C/v0.5 intacts et INSERT v0.5 compatibles.`);
