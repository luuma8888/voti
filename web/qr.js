import { qrEncoder } from '../vendor/qr.js';

/** Matrice incluant exactement quatre modules blancs de quiet zone. Niveau M. */
export function createQrMatrix(payload) {
  if (typeof payload !== 'string' || !payload.length || new TextEncoder().encode(payload).length > 1800) throw new Error('Contenu QR trop volumineux ou invalide.');
  const qr = qrEncoder(0, 'M'); qr.addData(payload, 'Byte'); qr.make();
  const modules = qr.getModuleCount(), size = modules + 8;
  const cells = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) =>
    x >= 4 && y >= 4 && x < size - 4 && y < size - 4 && qr.isDark(y - 4, x - 4)));
  return { size, modules, quietZone: 4, errorCorrection: 'M', cells };
}
export function renderQrSvg(matrix) {
  const paths = [];
  matrix.cells.forEach((row, y) => row.forEach((dark, x) => { if (dark) paths.push(`M${x} ${y}h1v1h-1z`); }));
  // Aucun texte/payload dans le SVG : uniquement des coordonnées générées.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.size} ${matrix.size}" width="${matrix.size * 8}" height="${matrix.size * 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="${paths.join('')}"/></svg>`;
}
export function drawQr(context, matrix, x, y, modulePixels) {
  if (![x, y, modulePixels].every(Number.isInteger) || modulePixels < 1 || modulePixels > 32) throw new Error('Grille QR invalide.');
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#fff'; context.fillRect(x, y, matrix.size * modulePixels, matrix.size * modulePixels);
  context.fillStyle = '#000';
  matrix.cells.forEach((row, dy) => row.forEach((dark, dx) => { if (dark) context.fillRect(x + dx * modulePixels, y + dy * modulePixels, modulePixels, modulePixels); }));
}
export function renderQrCanvas(matrix, modulePixels = 8) {
  if (!Number.isInteger(modulePixels) || modulePixels < 1 || modulePixels > 16) throw new Error('Taille QR invalide.');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = matrix.size * modulePixels;
  drawQr(canvas.getContext('2d'), matrix, 0, 0, modulePixels); return canvas;
}
export function qrPng(matrix) {
  return new Promise((resolve, reject) => renderQrCanvas(matrix).toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG indisponible.')), 'image/png'));
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
