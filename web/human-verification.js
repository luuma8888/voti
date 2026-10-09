import { RelayError } from '../shared/relay.js';

let scriptReady;
function loadTurnstile() {
  if (!scriptReady) scriptReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true; script.defer = true;
    const timer = setTimeout(() => { script.remove(); reject(new RelayError('RELAY_UNAVAILABLE')); }, 15000);
    script.onload = () => { clearTimeout(timer); globalThis.turnstile ? resolve() : reject(new RelayError('RELAY_UNAVAILABLE')); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new RelayError('RELAY_UNAVAILABLE')); };
    document.head.append(script);
  }).catch(error => { scriptReady = null; throw error; });
  return scriptReady;
}
/** Chargement distant EXCLUSIVEMENT suite à Publier en ligne ; jamais au vote. */
export async function humanVerification(config, container) {
  if (config.turnstileMode === 'local-test') {
    const url = new URL(config.baseUrl);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new RelayError('RELAY_UNAVAILABLE');
    container.textContent = 'Vérification locale de test — aucune protection humaine réelle.';
    return `voti-local-test.${Date.now()}.${crypto.randomUUID()}`;
  }
  if (!config.turnstileSiteKey) throw new RelayError('RELAY_UNAVAILABLE');
  container.textContent = 'Vérification avant publication en ligne…';
  await loadTurnstile();
  if (!container.isConnected) throw new RelayError('HUMAN_VERIFICATION_FAILED');
  container.replaceChildren();
  return new Promise((resolve, reject) => {
    let widget, finished = false;
    const finish = (error, token) => {
      if (finished) return; finished = true; clearTimeout(timer);
      window.removeEventListener('hashchange', cancel);
      if (widget !== undefined) globalThis.turnstile.remove(widget);
      if (error) reject(error); else resolve(token);
    };
    const cancel = () => finish(new RelayError('HUMAN_VERIFICATION_FAILED'));
    const timer = setTimeout(cancel, 300000);
    window.addEventListener('hashchange', cancel, { once: true });
    try {
      widget = globalThis.turnstile.render(container, { sitekey: config.turnstileSiteKey, action: 'voti-publication', size: 'flexible',
        callback: token => finish(null, token), 'error-callback': () => finish(new RelayError('RELAY_UNAVAILABLE')),
        'expired-callback': cancel, 'timeout-callback': cancel });
      if (finished) globalThis.turnstile.remove(widget);
    } catch { finish(new RelayError('RELAY_UNAVAILABLE')); }
  });
}
