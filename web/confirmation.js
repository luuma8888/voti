/** Confirmation UI uniquement : aucune opération métier, stockage ou requête.
 * @param {{title:string, description:string, actionLabel:string, danger?:boolean,
 *   trigger?:HTMLElement}} options
 * @returns {Promise<boolean>} true uniquement après activation explicite de l'action.
 */
export function confirmAction({ title, description, actionLabel, danger = false, trigger = document.activeElement }) {
  // Une deuxième demande ne remplace jamais un dialogue en attente.
  if (document.querySelector('.confirmation-dialog[open]')) return Promise.resolve(false);
  const dialog = document.createElement('dialog');
  // Pas de repli sur une confirmation native ou une action sans confirmation.
  if (typeof dialog.showModal !== 'function') return Promise.resolve(false);
  dialog.className = 'card confirmation-dialog';
  dialog.dataset.danger = String(danger);
  const accent = trigger?.closest('[data-accent]')?.dataset.accent;
  if (['mint', 'lavender', 'peach'].includes(accent)) dialog.dataset.accent = accent;
  const heading = document.createElement('h2');
  heading.id = `confirmation-${crypto.randomUUID()}`;
  heading.textContent = title;
  const explanation = document.createElement('p');
  explanation.id = `${heading.id}-description`;
  explanation.textContent = description;
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.setAttribute('aria-describedby', explanation.id);
  dialog.setAttribute('aria-modal', 'true');
  const controls = document.createElement('div');
  controls.className = 'actions';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = 'Annuler'; cancel.autofocus = true;
  cancel.dataset.confirmation = 'cancel';
  const accept = document.createElement('button');
  accept.type = 'button'; accept.textContent = actionLabel;
  accept.className = danger ? 'danger' : 'primary';
  accept.dataset.confirmation = 'accept';
  controls.append(cancel, accept); dialog.append(heading, explanation, controls);

  return new Promise(resolve => {
    const listeners = new AbortController();
    const initialRoute = location.hash;
    let settled = false;
    const finish = confirmed => {
      if (settled) return;
      settled = true; listeners.abort(); observer.disconnect();
      if (dialog.open) dialog.close();
      dialog.remove(); resolve(confirmed && location.hash === initialRoute && (!trigger || trigger.isConnected));
      // L'import peut réactiver son déclencheur dans son finally après await.
      queueMicrotask(() => {
        if (trigger?.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
      });
    };
    const observer = new MutationObserver(() => {
      if (!dialog.isConnected || (trigger && !trigger.isConnected)) finish(false);
    });
    const listen = (target, event, handler) => target.addEventListener(event, handler, { signal: listeners.signal });
    listen(cancel, 'click', () => finish(false));
    listen(accept, 'click', () => finish(true));
    listen(dialog, 'cancel', event => { event.preventDefault(); finish(false); });
    // dialog.close(), fermeture extérieure : ne valent jamais consentement.
    listen(dialog, 'close', () => finish(false));
    listen(window, 'hashchange', () => finish(false));
    listen(dialog, 'keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      else if (event.key === 'Tab') {
        event.preventDefault();
        const current = document.activeElement;
        (current === cancel ? accept : current === accept ? cancel : event.shiftKey ? accept : cancel).focus();
      } else if (event.key === 'Enter' && (event.repeat || document.activeElement !== accept)) {
        // Entrée au premier focus est une annulation, jamais une suppression.
        event.preventDefault();
        if (!event.repeat) finish(false);
      }
    });
    document.body.append(dialog);
    observer.observe(document.body, { childList: true, subtree: true });
    try { dialog.showModal(); cancel.focus({ preventScroll: true }); }
    catch { finish(false); }
  });
}
