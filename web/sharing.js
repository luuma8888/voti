import { buildPollUrl, buildChoiceUrl, buildResultsUrl, buildAdminTransferUrl } from '../shared/qr-links.js';
import { createQrMatrix, renderQrSvg, qrPng, downloadBlob } from './qr.js';

const node = (tag, text, className) => { const n = document.createElement(tag); if (text) n.textContent = text; if (className) n.className = className; return n; };
const control = (label, operation) => { const n = node('button', label); n.type = 'button'; n.addEventListener('click', operation); return n; };
export function sharingPanel(poll, { baseUrl, getAdminKey, error, notify, openStudio = () => {} }) {
  const panel = node('section', null, 'sharing-panel card'); panel.dataset.accent = poll.style.themeId;
  const id = poll.remoteRef.pollId;
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
  section('Lien et QR de vote', true).append(qrCard('Accéder au vote', buildPollUrl(id, baseUrl), `vote-${id}`));
  const choices = node('div', null, 'qr-grid');
  for (const choice of poll.definition.choices) choices.append(qrCard(choice.label, buildChoiceUrl(id, choice.id, baseUrl), `choix-${id}-${choice.id}`));
  section('QR par choix').append(node('p', 'Ce QR ouvre directement la confirmation de ce choix. Le vote n’est envoyé qu’après validation.'), choices);
  section('QR des résultats').append(qrCard('Voir les résultats', buildResultsUrl(id, baseUrl), `resultats-${id}`));
  const posters = section('Affiche PDF'); posters.append(node('p', 'A4, haute résolution. Imprimez à 100 %, sans rogner les marges des QR. Les textes longs peuvent demander plusieurs pages.'));
  const studio=control('Créer une affiche',openStudio);studio.className='primary';posters.append(studio);
  const secret = section('Transférer l’administration — SECRET'); secret.classList.add('secret-transfer');
  secret.append(node('p', 'Cette clé permet d’administrer ce sondage. Toute personne qui la possède peut le modifier ou le supprimer. Ne l’affichez pas publiquement.'));
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
