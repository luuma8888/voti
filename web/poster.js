import { PDFDocument } from '../vendor/pdf.js';
import { buildPollUrl, buildChoiceUrl, buildResultsUrl } from '../shared/qr-links.js';
import { isPublicPollId } from '../shared/relay.js';
import { validateDefinition } from '../shared/validation.js';
import { createQrMatrix, drawQr } from './qr.js';

export const POSTER_WIDTH = 2480, POSTER_HEIGHT = 3508; // A4 à environ 300 dpi.
export const A4_POINTS = [595.2756, 841.8898];
const MARGIN = 150, CONTENT = POSTER_WIDTH - 2 * MARGIN;

/** Retour à la ligne mesuré, y compris mots non séparés. Jamais de troncature. */
export function wrapText(text, maxWidth, measure) {
  const lines = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && measure(line + ' ' + word) > maxWidth) { lines.push(line); line = ''; }
      if (measure(word) <= maxWidth) { line += (line ? ' ' : '') + word; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const char of word) {
        if (line && measure(line + char) > maxWidth) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Le plan ne reçoit que les données publiques. Aucun secret ou connexion locale. */
export function makePosterPlan(poll, mode = 'access', { baseUrl, measure = (text, font) => [...text].length * font * .6 } = {}) {
  const id = poll.remoteRef?.pollId;
  if (!isPublicPollId(id) || poll.remoteRef.revision <= 0 || !['published', 'closed'].includes(poll.status)) throw new Error('Publie d’abord ce sondage en ligne pour créer ses QR de partage.');
  validateDefinition(poll.definition);
  if (!['access', 'choices'].includes(mode)) throw new Error('Mode d’affiche inconnu.');
  const question = wrapText(poll.definition.question, CONTENT, text => measure(text, 76));
  const description = poll.definition.description ? wrapText(poll.definition.description, CONTENT, text => measure(text, 38)) : [];
  const fullHeader = 300 + question.length * 92 + description.length * 52;
  const compactHeader = 300 + question.length * 92;
  const results = buildResultsUrl(id, baseUrl), access = buildPollUrl(id, baseUrl);
  const pages = [];
  const page = (described = true) => ({ question, description: described ? description : [], items: [], qrs: [] });
  const qr = (url, x, y, maxSize) => {
    const matrix = createQrMatrix(url), pixels = Math.floor(maxSize / matrix.size);
    if (pixels < 5) throw new Error('QR trop dense pour une affiche lisible.');
    return { url, x, y, pixels, size: pixels * matrix.size, matrix };
  };
  const footer = p => {
    p.qrs.push({ ...qr(results, POSTER_WIDTH - MARGIN - 440, POSTER_HEIGHT - 600, 440), kind: 'results' });
  };
  if (mode === 'access') {
    let p = page(), y = fullHeader;
    for (const choice of poll.definition.choices) {
      const lines = wrapText(choice.label, CONTENT - 90, text => measure(text, 44));
      if (y + lines.length * 60 + 28 > POSTER_HEIGHT - 650) { pages.push(p); p = page(false); y = compactHeader; }
      p.items.push({ label: choice.label, lines, x: MARGIN, y, font: 44 }); y += lines.length * 60 + 28;
    }
    if (y + 1570 > POSTER_HEIGHT - 730) { pages.push(p); p = page(false); y = compactHeader; }
    const main = qr(access, 0, y + 170, 1400); main.x = Math.floor((POSTER_WIDTH - main.size) / 2);
    p.qrs.push({ ...main, kind: 'access' });
    footer(p); pages.push(p);
  } else {
    let p = page(), y = fullHeader;
    // Laisser la première rangée utiliser l'espace réellement disponible.
    // La boucle pagine seulement si les libellés/QR ne tiennent plus.
    const tileWidth = (CONTENT - 80) / 2;
    const choices = poll.definition.choices.map(choice => ({ choice,
      lines: wrapText(choice.label, tileWidth - 60, text => measure(text, 44)) }));
    for (let i = 0; i < choices.length; i += 2) {
      const row = choices.slice(i, i + 2), height = Math.max(...row.map(c => c.lines.length)) * 56 + 680;
      if (y + height > POSTER_HEIGHT - 730) { footer(p); pages.push(p); p = page(false); y = compactHeader; }
      row.forEach(({ choice, lines }, col) => {
        const x = MARGIN + col * (tileWidth + 80);
        p.items.push({ label: choice.label, lines, x, y, font: 44 });
        const url = buildChoiceUrl(id, choice.id, baseUrl);
        p.qrs.push({ ...qr(url, Math.round(x + 65), Math.round(y + lines.length * 56 + 30), 560), kind: 'choice',
          destinationLines: wrapText(url, tileWidth - 90, text => measure(text, 28)) });
      });
      y += height + 40;
    }
    footer(p); pages.push(p);
  }
  if (pages.length > 4) throw new Error('Texte trop volumineux pour une affiche.');
  return { mode, width: POSTER_WIDTH, height: POSTER_HEIGHT, pages, pollId: id, accessUrl: access };
}

function paintPage(canvas, page, plan, { accent = '#684397', soft = '#eee7f7', logo } = {}, pageIndex = 0) {
  const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
  const text = (line, x, y, size, color = '#25334b', bold = false) => {
    c.fillStyle = color; c.font = `${bold ? '700' : '400'} ${size}px system-ui,sans-serif`; c.fillText(line, x, y);
  };
  c.fillStyle = soft; c.fillRect(0, 0, canvas.width, 130); text('Voti - Choisir ensemble, simplement.', MARGIN, 87, 40, accent, true);
  if (logo?.naturalWidth) c.drawImage(logo, POSTER_WIDTH - MARGIN - 70, 30, 70, 70);
  let y = 235;
  for (const line of page.question) { text(line, MARGIN, y, 76, '#25334b', true); y += 92; }
  y += 35; for (const line of page.description) { text(line, MARGIN, y, 38); y += 52; }
  for (const item of page.items) item.lines.forEach((line, i) => text((plan.mode === 'access' && i === 0 ? '• ' : '') + line, item.x + 15, item.y + 50 + i * 56, item.font, '#25334b', true));
  for (const item of page.qrs) {
    if (item.kind === 'access') text('Scanne pour participer', item.x, item.y - 45, 48, accent, true);
    if (item.kind === 'results') {
      text('Voir les résultats', MARGIN, item.y + 80, 44, accent, true);
      text(item.url, MARGIN, item.y + 135, 28);
    }
    drawQr(c, item.matrix, item.x, item.y, item.pixels);
    if (item.kind === 'choice') item.destinationLines.forEach((line, i) => text(line, item.x, item.y + item.size + 28 + i * 36, 28));
  }
  if (plan.mode === 'choices') {
    text('Le QR présélectionne ce choix.', MARGIN, POSTER_HEIGHT - 620, 34);
    text('Le vote doit ensuite être confirmé.', MARGIN, POSTER_HEIGHT - 570, 34);
  }
  text('Lien de vote : ' + plan.accessUrl, MARGIN, POSTER_HEIGHT - 230, 28);
  text(`A4 - imprimer à 100 % - ${pageIndex + 1}/${plan.pages.length}`, MARGIN, POSTER_HEIGHT - 170, 30);
}

/** Une seule surface RGBA de 8,7 MP à la fois ; pas de police ni réseau externe. */
export async function generatePoster(poll, mode, options = {}) {
  const canvas = document.createElement('canvas'); canvas.width = POSTER_WIDTH; canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext('2d');
  const measure = (text, font) => { context.font = `700 ${font}px system-ui,sans-serif`; return context.measureText(text).width; };
  const plan = makePosterPlan(poll, mode, { ...options, measure });
  const pdf = await PDFDocument.create(); pdf.setTitle('Affiche Voti'); pdf.setCreator('Voti');
  try {
    for (const [index, page] of plan.pages.entries()) {
      paintPage(canvas, page, plan, options, index);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Impossible de préparer l’affiche.');
      const image = await pdf.embedPng(await blob.arrayBuffer()), sheet = pdf.addPage(A4_POINTS);
      sheet.drawImage(image, { x: 0, y: 0, width: A4_POINTS[0], height: A4_POINTS[1] });
    }
    return { bytes: await pdf.save(), plan };
  } finally { canvas.width = canvas.height = 1; }
}
