/** Métadonnées générées au build depuis le JSON fourni. Images WebP séparées. */
export const VISUAL_PRESETS = {member:[],group:[]};
export function resolveVisual(type,id,catalog=VISUAL_PRESETS){
  if(!['member','group'].includes(type)||typeof id!=='string')return null;
  const entry=catalog[type]?.find(e=>e.kind===type&&e.id===id);
  return entry&&(type==='group'?['icon','medium','large','backdrop']:['icon','medium','large']).every(t=>new RegExp(`^web/assets/voti-visuals/${type}s/${t}/[a-z0-9_-]+\\.webp$`).test(entry[t]))?entry:null;
}
export const getMemberVisual=id=>resolveVisual('member',id);
export const getGroupVisual=id=>resolveVisual('group',id);
export const listMemberVisuals=()=>[...VISUAL_PRESETS.member];
export const listGroupVisuals=()=>[...VISUAL_PRESETS.group];
export const filterMemberVisuals=category=>category==='all'?listMemberVisuals():listMemberVisuals().filter(e=>e.category===category);
export function visualImage(preset,tier='icon',className=''){const img=document.createElement('img');img.src=preset[tier];img.alt=preset.label;img.className=className;img.decoding='async';if(tier==='icon')img.loading='lazy';return img;}
export function presetThumbnail(type,id,catalog=VISUAL_PRESETS){const preset=resolveVisual(type,id,catalog);if(!preset)return null;const img=visualImage(preset,'icon','preset-thumbnail');img.alt='';img.width=40;img.height=40;return img;}
