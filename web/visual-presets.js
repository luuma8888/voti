/** Rempli au build depuis les manifestes locaux. Aucun asset utilisateur/distant. */
export const VISUAL_PRESETS = {member:[],group:[]};
export function resolveVisual(type,id,catalog=VISUAL_PRESETS){
  if(!['member','group'].includes(type)||typeof id!=='string')return null;
  const entry=catalog[type]?.find(e=>e.type===type&&e.id===id);
  return entry&&new RegExp(`^${type}_[a-z0-9_]{1,60}$`).test(id)&&/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(entry.src)?entry:null;
}
export function presetThumbnail(type,id,catalog=VISUAL_PRESETS){const preset=resolveVisual(type,id,catalog);if(!preset)return null;const img=document.createElement('img');img.src=preset.src;img.alt='';img.className='preset-thumbnail';img.width=40;img.height=40;return img;}
