/** Deux présentations d'un même formulaire : aucun champ dupliqué, aucune sauvegarde intermédiaire. */
export function spacePollForm({sections,recap,createButton}) {
  const root=document.createElement('div');root.className='space-poll-form';
  const modes=document.createElement('div');modes.className='actions';modes.setAttribute('aria-label','Mode de création');
  const progress=document.createElement('p');progress.className='space-progress';progress.setAttribute('role','status');
  const panels=sections.map(({title,help,element})=>{const panel=document.createElement('section');panel.className='space-form-step';const heading=document.createElement('h3');heading.tabIndex=-1;heading.textContent=title;const p=document.createElement('p');p.textContent=help;panel.append(heading,p,element);return panel;});
  const review=document.createElement('section'),reviewTitle=document.createElement('h3');reviewTitle.tabIndex=-1;reviewTitle.textContent='Vérifie avant de créer';review.append(reviewTitle,recap);review.className='space-form-step';panels.push(review);
  const nav=document.createElement('div');nav.className='actions';let step=0,quick=false;
  function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;}
  function draw(focus=false){panels.forEach((p,i)=>p.hidden=!quick&&i!==step);progress.textContent=quick?'Création rapide · tous les réglages sur un écran':`Étape ${step+1} sur ${panels.length} · ${panels[step].querySelector('h3').textContent}`;guided.setAttribute('aria-pressed',String(!quick));fast.setAttribute('aria-pressed',String(quick));back.hidden=quick||step===0;next.hidden=quick||step===panels.length-1;createButton.hidden=!quick&&step!==panels.length-1;if(focus)panels[quick?0:step].querySelector('h3').focus();}
  const guided=button('Pas à pas',()=>{quick=false;draw(true);}),fast=button('Création rapide',()=>{quick=true;draw(true);});modes.append(guided,fast);
  const back=button('Étape précédente',()=>{step--;draw(true);}),next=button('Continuer',()=>{const inputs=[...panels[step].querySelectorAll('input,textarea,select')];if(inputs.some(i=>!i.reportValidity()))return;step++;draw(true);});nav.append(back,next,createButton);root.append(modes,progress,...panels,nav);draw();return root;
}
