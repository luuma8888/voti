/** Quatre postures officielles ; catalogue injecté depuis le manifeste au build. */
export const MASCOT_ASSETS = {};
export function mascot({variant='welcome',lazy=false}={}) {
  const image=document.createElement('img');
  const asset=MASCOT_ASSETS[variant];
  if(!asset)throw new Error('Posture de mascotte inconnue.');
  image.src=new URL(asset.file,document.baseURI).href;
  image.alt='';image.setAttribute('aria-hidden','true');
  image.width=asset.width;image.height=asset.height;image.decoding='async';
  image.className='mascot'+(variant?' mascot-'+variant:'');
  if(lazy)image.loading='lazy';
  return image;
}

/** Les actions de création restent dans l’en-tête existant de chaque liste. */
export function mascotEmptyState(title,description,{illustrated=true,heading='h3',className=''}={}) {
  const box=document.createElement('div');box.className='empty-state mascot-empty-state '+className;
  if(illustrated)box.append(mascot({variant:'empty',lazy:true}));
  const copy=document.createElement('div');copy.className='mascot-empty-copy';
  const label=document.createElement(heading);label.textContent=title;
  const text=document.createElement('p');text.textContent=description;
  copy.append(label,text);box.append(copy);return box;
}
