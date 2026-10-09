import { processImage } from './image-processing.js';

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
}

/** Les URLs objet sont propres aux vues, jamais sérialisées ni utilisées comme identifiants. */
export class ImageViews {
  constructor(adapter) { this.adapter = adapter; this.urls = new Map(); }
  sweep() {
    for (const [img, url] of this.urls) if (!img.isConnected) { URL.revokeObjectURL(url); this.urls.delete(img); }
  }
  show(id, { size = 'poll', alt = '', staged } = {}) {
    const box = node('span', null, `user-image image-${size}`);
    const img = node('img'); img.alt = alt; img.decoding = 'async';
    const fallback = node('span', 'Image indisponible', 'image-fallback'); fallback.hidden = true;
    box.append(img, fallback);
    const fail = () => { img.hidden = true; fallback.hidden = false; const url = this.urls.get(img); if (url) URL.revokeObjectURL(url); this.urls.delete(img); };
    img.addEventListener('error', fail, { once: true });
    Promise.resolve().then(async () => {
      try {
        const asset = staged?.get(id) || await this.adapter.get(id);
        if (!img.isConnected) return;
        if (!asset) { fail(); return; }
        const url = URL.createObjectURL(asset.blob); this.urls.set(img, url); img.src = url;
      } catch { if (img.isConnected) fail(); }
    });
    return box;
  }
}

export function imagePicker({ label, kind, getId, staged, views, change, busy, active, error }) {
  const group = node('div', null, 'image-picker'); group.setAttribute('role', 'group'); group.setAttribute('aria-label', label);
  const preview = node('div', null, 'image-preview');
  const input = node('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true; input.setAttribute('aria-label', label);
  const choose = node('button'); choose.type = 'button'; choose.addEventListener('click', () => input.click());
  const remove = node('button', 'Retirer l’image', 'quiet'); remove.type = 'button';
  const status = node('span', null, 'help'); status.setAttribute('role', 'status');
  const controls = node('div', null, 'image-actions'); controls.append(choose, remove);
  function refresh() {
    preview.replaceChildren(); views.sweep();
    const id = getId();
    if (id) preview.append(views.show(id, { size: 'preview', staged }));
    choose.textContent = id ? 'Changer l’image' : 'Ajouter une image'; remove.hidden = !id;
  }
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    choose.disabled = true; remove.disabled = true; input.disabled = true; busy(1); status.textContent = 'Préparation de l’image…';
    try {
      const asset = await processImage(file, kind);
      if (active()) { change(asset); refresh(); status.textContent = 'Image prête. Elle sera enregistrée avec le sondage.'; }
    } catch (failure) { if (active()) { status.textContent = ''; error(failure); } }
    finally { busy(-1); choose.disabled = false; remove.disabled = false; input.disabled = false; input.value = ''; }
  });
  remove.addEventListener('click', () => { change(null); refresh(); choose.focus(); status.textContent = 'Image retirée de cette modification.'; });
  group.append(preview, controls, input, status); refresh(); return group;
}
