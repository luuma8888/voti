import { ensure, object, isAssetId, isUuid } from '../shared/validation.js';

export const POSTER_KEY = 'voti.poster.v1';
export const LAYOUTS = [['essential','Essentielle'],['cards','Cartes'],['magazine','Magazine'],['mosaic','Mosaïque']];
export const TYPOGRAPHIES = [
  ['modern','Moderne','system-ui, sans-serif'], ['soft','Douce','"Trebuchet MS", system-ui, sans-serif'],
  ['editorial','Éditoriale','Georgia, serif'], ['display','Affiche','Verdana, system-ui, sans-serif'],
];
export const PALETTES = [
  ['pop','Voti Pop','#f4eff9','#ffffff','#684397','#137680'],
  ['lagoon','Lagon','#e7f5f5','#ffffff','#146c78','#285a83'],
  ['garden','Jardin','#edf3e8','#ffffff','#386340','#806227'],
  ['lavender','Lavande','#f1ebf8','#ffffff','#70518d','#48678e'],
  ['peach','Pêche solaire','#fff0df','#ffffff','#995537','#846423'],
  ['night','Nuit élégante','#202638','#2a3145','#c9aff0','#8bddd7'],
  ['ivory','Ivoire premium','#f5f1e7','#fffdf7','#65543e','#436465'],
  ['minimal','Minimal noir & blanc','#ffffff','#f0f0f0','#222222','#555555'],
];
export function luminance(hex) {
  const rgb = hex.match(/\w\w/g).map(c => parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
export function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
export function readableText(bg) {
  if(contrast('#202638',bg)>=4.5)return '#202638';
  return contrast('#000000',bg)>=contrast('#ffffff',bg)?'#000000':'#ffffff';
}
export function designPalette(design) {
  const preset=PALETTES.find(p=>p[0]===design.palette);
  const [,,bg,surface,primary,secondary]=preset;
  const result={bg,surface,primary,secondary,...(design.customColors.enabled?design.customColors:{})};
  delete result.enabled;
  result.text=readableText(result.surface); result.backgroundText=readableText(result.bg);
  // Accents décoratifs libres ; tout texte d'accent est corrigé à >=4,5:1.
  result.accentText=contrast(result.primary,result.surface)>=4.5?result.primary:result.text;
  result.bar=contrast(result.primary,result.bg)>=3?result.primary:readableText(result.bg);
  return result;
}
export function defaultDesign() {
  return {formatVersion:1,layout:'essential',mode:'access',palette:'pop',typography:'modern',
    customColors:{enabled:false,primary:'#684397',secondary:'#137680',bg:'#f4eff9'},
    background:{assetId:null,fit:'cover',position:'center',intensity:.25,veil:'light'},
    media:{main:null,choices:{}},usePollImages:true};
}
export function validateDesign(input) {
  object(input,['formatVersion','layout','mode','palette','typography','customColors','background','media','usePollImages'],'Design');
  ensure(input.formatVersion===1,'Version de design inconnue.');
  ensure(LAYOUTS.some(p=>p[0]===input.layout) && ['access','choices'].includes(input.mode),'Disposition ou type invalide.');
  ensure(PALETTES.some(p=>p[0]===input.palette) && TYPOGRAPHIES.some(p=>p[0]===input.typography),'Palette ou typographie invalide.');
  const colors=input.customColors; object(colors,['enabled','primary','secondary','bg'],'Couleurs');
  ensure(typeof colors.enabled==='boolean' && [colors.primary,colors.secondary,colors.bg].every(c=>/^#[0-9a-f]{6}$/i.test(c)),'Couleur invalide.');
  const bg=input.background; object(bg,['assetId','fit','position','intensity','veil'],'Fond');
  ensure((bg.assetId===null||isAssetId(bg.assetId)) && ['cover','contain'].includes(bg.fit) && ['top','center','bottom'].includes(bg.position) &&
    Number.isFinite(bg.intensity) && bg.intensity>=0 && bg.intensity<=.6 && ['light','dark'].includes(bg.veil),'Fond invalide.');
  object(input.media,['main','choices'],'Médias');
  ensure(input.media.main===null||isAssetId(input.media.main),'Image principale invalide.');
  ensure(input.media.choices && Object.getPrototypeOf(input.media.choices)===Object.prototype && Object.keys(input.media.choices).length<=6,'Images de choix invalides.');
  for(const [id,ref] of Object.entries(input.media.choices)) ensure(isUuid(id)&&isAssetId(ref),'Référence de choix invalide.');
  ensure(typeof input.usePollImages==='boolean','Préférence médias invalide.');
  return structuredClone(input);
}
export function designRefs(design) { return new Set([design.background.assetId,design.media.main,...Object.values(design.media.choices)].filter(Boolean)); }

/** crop borné sans étirement, utilisable dans le plan et les tests. */
export function imageCrop(width,height,boxWidth,boxHeight,fit='cover',position='center') {
  ensure([width,height,boxWidth,boxHeight].every(v=>Number.isFinite(v)&&v>0),'Dimensions de crop invalides.');
  ensure(['cover','contain'].includes(fit)&&['top','center','bottom'].includes(position),'Crop invalide.');
  const factor=fit==='cover'?Math.max(boxWidth/width,boxHeight/height):Math.min(boxWidth/width,boxHeight/height);
  const w=width*factor,h=height*factor;
  return {x:(boxWidth-w)/2,y:position==='top'?0:position==='bottom'?boxHeight-h:(boxHeight-h)/2,width:w,height:h};
}
