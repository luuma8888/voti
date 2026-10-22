import { buildPollUrl, buildChoiceUrl, buildResultsUrl, buildAdminTransferUrl } from '../shared/qr-links.js';
import { createQrMatrix, renderQrSvg, qrPng, downloadBlob } from './qr.js';

const node = (tag, text, className) => { const n = document.createElement(tag); if (text) n.textContent = text; if (className) n.className = className; return n; };
const control = (label, operation) => { const n = node('button', label); n.type = 'button'; n.addEventListener('click', operation); return n; };
function illustration(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('share-icon');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',kind==='warning'?'M12 3 2 21h20L12 3zm0 5v6m0 3v1':kind==='results'?'M4 20V10h4v10m2 0V4h4v16m2 0v-7h4v7':kind==='poster'?'M5 2h14v20H5zM8 6h8M8 10h8M8 14h3v4H8zm6 0h2v4h-2z':'M2 2h7v7H2zm13 0h7v7h-7zM2 15h7v7H2zm11-2h3v3h-3zm5 5h4v4h-4z');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.6');svg.append(path);return svg;}
export function secretWarning(){const box=node('div',null,'secret-warning');box.append(illustration('warning'),node('strong','Ce QR donne accès à l’administration du sondage.'),node('p','Toute personne qui le possède peut gérer ou supprimer ce sondage. Ne le partage pas publiquement.'));return box;}
export function sharingPanel(poll, { baseUrl, getAdminKey, error, notify, openStudio = () => {} }) {
  const panel = node('section', null, 'sharing-panel card'); panel.dataset.accent = poll.style.themeId;
  const id = poll.remoteRef.pollId;
  const shortcuts=node('div',null,'share-shortcuts');shortcuts.setAttribute('role','group');shortcuts.setAttribute('aria-label','Choisir un outil de partage');
  const qrCard = (title, url, name) => {
    const box = node('article', null, 'qr-card'), matrix = createQrMatrix(url);
    const image = node('img'); image.alt = `QR : ${title}`;
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderQrSvg(matrix));
    const link = node('a', url, 'qr-destination'); link.href = url;
    const actions = node('div', null, 'actions');
    actions.append(control('Copier le lien', async () => { try { await navigator.clipboard.writeText(url); notify('Lien copié.'); } catch { notify('La copie automatique est indisponible. Sélectionnez le lien affiché.'); } }),
      control('Télécharger PNG', async () => { try { downloadBlob(await qrPng(matrix), `voti-qr-${name}.png`); } catch (e) { error(e); } }),
      control('Télécharger SVG', () => downloadBlob(new Blob([renderQrSvg(matrix)], { type: 'image/svg+xml' }), `voti-qr-${name}.svg`)));
    box.append(node('h3', title), image, link, actions); return box;
  };
  const section = (title, open = false) => { const d = node('details', null, 'sharing-section'); d.open = open; d.append(node('summary', title)); panel.append(d); return d; };
  const vote=node('section',null,'share-vote');vote.append(node('h2','Lien et QR de vote'),qrCard('Accéder au vote', buildPollUrl(id, baseUrl), `vote-${id}`));panel.append(vote,shortcuts);
  const publicPanels=[];
  const publicSection=title=>{const box=node('section',null,'share-content');box.id='share-'+crypto.randomUUID();box.hidden=true;box.setAttribute('role','region');const heading=node('h2',title);heading.id=box.id+'-title';heading.tabIndex=-1;box.setAttribute('aria-labelledby',heading.id);box.append(heading);panel.append(box);publicPanels.push(box);return box;};
  const choices = node('div', null, 'qr-grid');
  for (const choice of poll.definition.choices) choices.append(qrCard(choice.label, buildChoiceUrl(id, choice.id, baseUrl), `choix-${id}-${choice.id}`));
  const choiceSection=publicSection('Un QR pour chaque choix');choiceSection.append(node('p', 'Ce QR ouvre directement la confirmation de ce choix. Le vote n’est envoyé qu’après validation.'), choices);
  const resultSection=publicSection('QR des résultats');resultSection.append(qrCard('Voir les résultats', buildResultsUrl(id, baseUrl), `resultats-${id}`));
  function show(target,entry){for(const box of publicPanels)box.hidden=box!==target;for(const button of shortcuts.querySelectorAll('[aria-expanded]'))button.setAttribute('aria-expanded',String(button===entry));target.querySelector('h2').focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}
  for(const [title,description,kind,operation] of [
    ['Un QR pour chaque choix','Chaque QR ouvre directement la confirmation d’une réponse.','choice',choiceSection],
    ['QR des résultats','Pour consulter les résultats lorsqu’ils sont disponibles.','results',resultSection],
    ['Créer une affiche PDF','Compose une affiche avec QR, couleurs et images.','poster',null]]){
    const entry=control('',()=>operation?show(operation,entry):openStudio());entry.className='share-shortcut';entry.append(illustration(kind),node('strong',title),node('span',description));shortcuts.append(entry);
    if(operation){entry.setAttribute('aria-controls',operation.id);entry.setAttribute('aria-expanded','false');}else entry.dataset.action='studio';
  }
  if(typeof getAdminKey!=='function')return panel;
  const secret = section('Transférer l’administration — SECRET'); secret.classList.add('secret-transfer');
  secret.append(secretWarning());
  const display = node('div', null, 'secret-qr'); display.hidden = true;
  const toggle = control('Afficher le QR secret', async () => {
    if (toggle.disabled) return;
    if (!display.hidden) { display.replaceChildren(); display.hidden = true; toggle.textContent = 'Afficher le QR secret'; toggle.setAttribute('aria-expanded', 'false'); return; }
    toggle.disabled = true;
    try {
      const key = await getAdminKey(); if (!toggle.isConnected) return;
      const matrix = createQrMatrix(buildAdminTransferUrl(key, baseUrl)), image = node('img');
      image.alt = 'QR secret de transfert de l’administration'; image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderQrSvg(matrix));
      display.append(image, node('p', 'Destination : import volontaire de la clé d’administration de ce sondage. Le destinataire doit confirmer.'));
      display.hidden = false; toggle.textContent = 'Masquer'; toggle.setAttribute('aria-expanded', 'true');
    } catch (e) { error(new Error(e.code ? 'Impossible de préparer le QR secret.' : e.message)); }
    finally { toggle.disabled = false; }
  });
  toggle.setAttribute('aria-expanded', 'false');
  secret.addEventListener('toggle', () => { if (!secret.open) { display.replaceChildren(); display.hidden = true; toggle.textContent = 'Afficher le QR secret'; toggle.setAttribute('aria-expanded', 'false'); } });
  secret.append(toggle, display); return panel;
}
