import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoll,publishPoll,castVote } from '../shared/poll-engine.js';
import { emptyState } from '../shared/model.js';
import { getResults } from '../shared/result-rules.js';
import { moderateComment,publicComments,administrativeEntries } from '../shared/participation.js';
import { makeResultsPlan } from '../web/print-layout.js';
import { defaultDesign } from '../web/poster-design.js';
const words=plan=>plan.pages.flatMap(p=>p.nodes.filter(n=>n.type==='text').flatMap(n=>n.lines)).join(' ');
async function fixture(mode='identified',minimumResponses=1) {
  let state=createPoll(emptyState(),{question:'Résultats fictifs',choices:['Été','Forêt'],participationIdentityMode:mode,commentVisibility:'public_with_results',resultRules:{minimumResponses}});
  state=publishPoll(state,state.polls[0].id);const id=state.polls[0].id;
  state=await castVote(state,{id:crypto.randomUUID(),pollId:id,choiceId:state.polls[0].definition.choices[0].id,comment:'Commentaire approuvé fictif',...(mode==='identified'?{displayName:'Pseudo fictif'}:{})});
  state=moderateComment(state,id,state.comments[0].commentId,1,'visible');return state;
}
test('Synthèse et Rapport par défaut : aucune identité ni commentaire même si projection les contient',async()=>{
  const state=await fixture();for(const style of ['summary','report']){const plan=makeResultsPlan(state.polls[0],getResults(state,state.polls[0].id),defaultDesign(),{style});
    assert.ok(!words(plan).includes('Commentaire approuvé')&&!words(plan).includes('Pseudo fictif'));assert.ok(!JSON.stringify(plan).includes('actionId'));}
});
test('Rapport : opt-in commentaires publics, identités explicites admin seulement, sous seuil refusé',async()=>{
  const state=await fixture(),poll=state.polls[0],results=getResults(state,poll.id);
  const options={style:'report',includeComments:true,comments:publicComments(state,poll.id)};
  const publicPlan=makeResultsPlan(poll,results,defaultDesign(),options);assert.ok(words(publicPlan).includes('Commentaire approuvé fictif'));assert.ok(!words(publicPlan).includes('Pseudo fictif'));
  assert.throws(()=>makeResultsPlan(poll,results,defaultDesign(),{...options,includeIdentities:true,identities:administrativeEntries(state,poll.id)}),/administrateur/);
  const adminPlan=makeResultsPlan(poll,results,defaultDesign(),{...options,includeIdentities:true,adminAuthorized:true,identities:administrativeEntries(state,poll.id)});assert.ok(words(adminPlan).includes('Pseudo fictif'));assert.ok(!JSON.stringify(adminPlan).includes('participationId'));
  const locked=await fixture('anonymous',5);assert.throws(()=>makeResultsPlan(locked.polls[0],getResults(locked,locked.polls[0].id),defaultDesign(),options),/disponibles/);
});
