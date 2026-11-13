import test from 'node:test';
import assert from 'node:assert/strict';
import {voteConfiguration,validateSelections,aggregateSelections} from '../shared/vote-modes.js';
import {createPoll} from '../shared/poll-engine.js';
import {emptyState} from '../shared/model.js';
import {validateDefinition} from '../shared/validation.js';
const base=()=>createPoll(emptyState(),{question:'Choix fictif',choices:['A','B','C','D','E','F']}).polls[0].definition;
const definition=(mode,limit,rule)=>({...base(),mode,voteConfig:{version:1,limit,rule}});
test('Single historique : pas de conversion ; Mode libre refuse les extensions',()=>{const d=base();delete d.mode;assert.equal(voteConfiguration(d).mode,'single_choice');validateDefinition(d);const multi=definition('multiple_choice',4,'up_to');assert.throws(()=>validateDefinition(multi));validateDefinition(multi,undefined,true);});
for(const mode of ['multiple_choice','ranked_choice'])for(const rule of ['up_to','exact'])test(mode+' '+rule+' : bornes, vide, doublon, étranger, ordre',()=>{const d=definition(mode,5,rule),ids=d.choices.map(c=>c.id);for(const n of [1,3,5]){if(rule==='exact'&&n!==5)assert.throws(()=>validateSelections(d,ids.slice(0,n)));else assert.equal(validateSelections(d,ids.slice(0,n)).length,n);}for(const bad of [[],ids,[ids[0],ids[0]],['étranger']])assert.throws(()=>validateSelections(d,bad));});
test('Multiple : 2 participants, 4 sélections, dénominateur 2 ; ordre non sémantique',()=>{const d=definition('multiple_choice',2,'up_to'),[a,b,c]=d.choices.map(c=>c.id),r=aggregateSelections(d,[[a,b],[b,c]]);assert.equal(r.totalBallots,2);assert.deepEqual(r.choices.slice(0,3).map(c=>[c.count,c.percentage]),[[1,50],[2,100],[1,50]]);assert.deepEqual(validateSelections(d,[a,b]),validateSelections(d,[b,a]));});
for(const [k,l,rule,points]of [[2,2,'exact',[2,1]],[5,5,'exact',[5,4,3,2,1]],[5,3,'up_to',[5,4,3]],[5,1,'up_to',[5]],[6,6,'all',[6,5,4,3,2,1]]])test(`Ranked K=${k} L=${l} ${rule}`,()=>{const d=definition('ranked_choice',k,rule),r=aggregateSelections(d,[d.choices.slice(0,l).map(c=>c.id)]);assert.deepEqual(r.choices.slice(0,l).map(c=>c.points),points);assert.equal(r.totalBallots,1);});
test('Ranked : égalité explicite, pas de départage caché',()=>{const d=definition('ranked_choice',2,'exact'),[a,b]=d.choices.map(c=>c.id),r=aggregateSelections(d,[[a,b],[b,a]]);assert.equal(r.choices[0].points,3);assert.equal(r.choices[0].rank,1);assert.equal(r.choices[1].rank,1);assert.equal(r.choices[0].tied,true);});

test('Toute la liste M=4 et quantités falsifiées ou invalidées',()=>{const d=definition('ranked_choice',4,'all');d.choices=d.choices.slice(0,4);assert.deepEqual(aggregateSelections(d,[d.choices.map(c=>c.id)]).choices.map(c=>c.points),[4,3,2,1]);for(const limit of [0,1,5,2.5,'4'])assert.throws(()=>voteConfiguration({...d,voteConfig:{version:1,rule:'all',limit}}));});

test('Mode absent compatible, mode nul ou inconnu refusé',()=>{const d=base();for(const mode of [null,'inconnu',false])assert.throws(()=>validateDefinition({...d,mode},undefined,true));});
