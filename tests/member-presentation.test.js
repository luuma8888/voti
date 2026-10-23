import test from 'node:test';import assert from 'node:assert/strict';
import {memberCardModel,CARD_THEMES} from '../web/member-card-model.js';
import {VISUAL_PRESETS,resolveVisual} from '../web/visual-presets.js';
import {validateVisualManifest,embeddedVisuals} from '../scripts/visual-assets.mjs';
const card={credential:'voti-member-v1.'+'a'.repeat(64),displayName:'Étoile 😊',spaceName:'Cabane fictive',groups:['Lune','Soleil']};
test('Carte : modèle partagé, cinq thèmes, groupes secondaires et aucun champ utilisateur image',()=>{
  for(const theme of ['pop','nature','douceur','dark','minimal']){const model=memberCardModel({...card,cardTheme:theme,memberVisualId:'https://exemple.invalid/photo.png',image:'data:image/png;base64,AAAA'});assert.equal(model.memberDisplayName,card.displayName);assert.equal(model.label,'Ma carte individuelle');assert.equal(model.cardTheme,theme);assert.deepEqual(model.groups.map(g=>g.name),card.groups);assert.equal(model.memberVisual,null);assert.equal(model.colors,CARD_THEMES[theme]);assert.ok(!('image'in model));}
  assert.throws(()=>memberCardModel({...card,credential:'invalide'}));assert.throws(()=>memberCardModel({...card,credential:'voti-staff-v1.'+'b'.repeat(64)}));assert.equal(memberCardModel({...card,cardTheme:'inconnu'}).cardTheme,'pop');
});
test('Packs intégrés : catalogues vides, résolution stricte des IDs et options sans persistance',async()=>{
  assert.deepEqual(await embeddedVisuals(process.cwd()),{member:[],group:[]});assert.deepEqual(VISUAL_PRESETS,{member:[],group:[]});
  const entry={id:'member_fixture_01',type:'member',label:'Fixture raster locale',file:'fixture.png',src:'data:image/png;base64,AAAA'},catalog={member:[entry],group:[{...entry,id:'group_fixture_01',type:'group'}]};
  assert.equal(resolveVisual('member',entry.id,catalog),entry);assert.equal(resolveVisual('group',entry.id,catalog),null);assert.equal(resolveVisual('member','absent',catalog),null);
  assert.equal(resolveVisual('member',entry.id,{member:[{...entry,src:'https://example.invalid/x.png'}]}),null);
  const model=memberCardModel({...card,memberVisualId:entry.id,groupVisualIds:['group_fixture_01']},catalog);assert.equal(model.memberVisual,entry);assert.equal(model.groups[0].visual.id,'group_fixture_01');
  const hidden=memberCardModel({...card,memberVisualId:entry.id,groupVisualIds:['group_fixture_01'],visualDisplayOptions:{member:false,groups:false}},catalog);assert.equal(hidden.memberVisual,null);assert.ok(hidden.groups.every(g=>!g.visual));
});
test('Manifestes : ni URL, ni chemin libre, ni doublon, ni confusion membre/groupe',()=>{
  const e={id:'member_fox_01',type:'member',label:'Renard',file:'renard.webp'},manifest={version:1,type:'member',entries:[e]};assert.deepEqual(validateVisualManifest(manifest,'member'),[e]);
  for(const file of ['../photo.png','https://example.invalid/photo.png','data:image/png;base64,AAAA','photo.svg'])assert.throws(()=>validateVisualManifest({...manifest,entries:[{...e,file}]},'member'));
  assert.throws(()=>validateVisualManifest({...manifest,entries:[e,e]},'member'));assert.throws(()=>validateVisualManifest(manifest,'group'));
});
