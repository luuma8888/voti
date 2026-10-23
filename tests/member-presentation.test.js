import test from 'node:test';import assert from 'node:assert/strict';
import {memberCardModel,CARD_THEMES} from '../web/member-card-model.js';
import {VISUAL_PRESETS,resolveVisual} from '../web/visual-presets.js';
import {validateVisualManifest,embeddedVisuals} from '../scripts/visual-assets.mjs';
const card={credential:'voti-member-v1.'+'a'.repeat(64),displayName:'Étoile 😊',spaceName:'Cabane fictive',groups:['Lune','Soleil']};
test('Carte : modèle partagé, cinq thèmes, groupes secondaires et aucun champ utilisateur image',()=>{
  for(const theme of ['pop','nature','douceur','dark','minimal']){const model=memberCardModel({...card,cardTheme:theme,memberVisualId:'https://exemple.invalid/photo.png',image:'data:image/png;base64,AAAA'});assert.equal(model.memberDisplayName,card.displayName);assert.equal(model.label,'Ma carte individuelle');assert.equal(model.cardTheme,theme);assert.deepEqual(model.groups.map(g=>g.name),card.groups);assert.equal(model.memberVisual,null);assert.equal(model.colors,CARD_THEMES[theme]);assert.ok(!('image'in model));}
  assert.throws(()=>memberCardModel({...card,credential:'invalide'}));assert.throws(()=>memberCardModel({...card,credential:'voti-staff-v1.'+'b'.repeat(64)}));assert.equal(memberCardModel({...card,cardTheme:'inconnu'}).cardTheme,'pop');
});
test('Packs intégrés : catalogue réel compilé, résolution stricte des IDs et options sans persistance',async()=>{
  const pack=await embeddedVisuals(process.cwd());assert.equal(pack.member.length,132);assert.equal(pack.group.length,36);assert.deepEqual(VISUAL_PRESETS,{member:[],group:[]});
  const entry={id:'member_fixture_01',type:'member',kind:'member',label:'Fixture raster locale',icon:'web/assets/voti-visuals/members/icon/member_fixture_01.webp',medium:'web/assets/voti-visuals/members/medium/member_fixture_01.webp',large:'web/assets/voti-visuals/members/large/member_fixture_01.webp'},catalog={member:[entry],group:[{...entry,id:'group_fixture_01',type:'group',kind:'group',icon:entry.icon.replace('/members/','/groups/'),medium:entry.medium.replace('/members/','/groups/'),large:entry.large.replace('/members/','/groups/')}]};
  assert.equal(resolveVisual('member',entry.id,catalog),entry);assert.equal(resolveVisual('group',entry.id,catalog),null);assert.equal(resolveVisual('member','absent',catalog),null);
  assert.equal(resolveVisual('member',entry.id,{member:[{...entry,icon:'https://example.invalid/x.png'}]}),null);
  const model=memberCardModel({...card,memberVisualId:entry.id,groupVisualIds:['group_fixture_01']},catalog);assert.equal(model.memberVisual,entry);assert.equal(model.groups[0].visual.id,'group_fixture_01');
  const hidden=memberCardModel({...card,memberVisualId:entry.id,groupVisualIds:['group_fixture_01'],visualDisplayOptions:{member:false,groups:false}},catalog);assert.equal(hidden.memberVisual,null);assert.ok(hidden.groups.every(g=>!g.visual));
});
test('Manifestes réels : ni URL, ni chemin libre, ni doublon, ni confusion membre/groupe',async()=>{
 const {readFile}=await import('node:fs/promises');const m=JSON.parse(await readFile('web/assets/voti-visuals/assets-manifest.json','utf8'));assert.equal(validateVisualManifest(m),m);const moved=structuredClone(m);moved.members[0].files.icon='members/icon/nom-physique-different.webp';assert.equal(validateVisualManifest(moved).members[0].id,m.members[0].id);
 for(const path of ['../photo.webp','https://example.invalid/photo.webp','data:image/webp;base64,AAAA','photo.svg']){const bad=structuredClone(m);bad.members[0].files.icon=path;assert.throws(()=>validateVisualManifest(bad));}
 const dup=structuredClone(m);dup.members[1]=dup.members[0];assert.throws(()=>validateVisualManifest(dup));const kind=structuredClone(m);kind.members[0].kind='group';assert.throws(()=>validateVisualManifest(kind));
});
