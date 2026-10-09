/** Attend le load du frame/loader renvoyé par Page.navigate.
 * L'écoute est installée AVANT la commande : le load peut précéder sa réponse.
 */
export async function navigateAndWait(command, events, sessionId, url, timeoutMs = 15000) {
  let navigation;
  let finished = false;
  const loads = [];
  let onEvent;
  let timer;
  const loaded = new Promise((resolve, reject) => {
    const check = () => {
      if (navigation && loads.some(event => event.loaderId === navigation.loaderId && event.frameId === navigation.frameId)) resolve();
    };
    onEvent = packet => {
      if (packet.sessionId !== sessionId || packet.method !== 'Page.lifecycleEvent' || packet.params.name !== 'load') return;
      loads.push(packet.params);
      if (loads.length > 32) loads.shift();
      check();
    };
    events.on('event', onEvent);
    timer = setTimeout(() => reject(new Error(`Document attendu non chargé : ${url} (aucun load du loader ${navigation?.loaderId || 'non reçu'}).`)), timeoutMs);
    command('Page.navigate', { url }, sessionId).then(result => {
      if (finished) return;
      if (result.errorText || result.isDownload || !result.loaderId) {
        reject(new Error(`Navigation impossible vers ${url} : ${result.errorText || 'aucun nouveau document chargé'}.`));
        return;
      }
      navigation = result;
      check();
    }, reject);
  });
  try {
    await loaded;
    const { frameTree } = await command('Page.getFrameTree', {}, sessionId);
    const frame = frameTree.frame;
    const frameUrl = frame.url + (frame.url.includes('#') ? '' : frame.urlFragment || '');
    if (frame.id !== navigation.frameId || frame.loaderId !== navigation.loaderId || frameUrl !== url) {
      throw new Error(`Document inattendu après navigation : attendu ${url}, reçu ${frameUrl} (loader ${frame.loaderId}).`);
    }
    return navigation;
  } finally {
    finished = true;
    clearTimeout(timer);
    events.removeListener('event', onEvent);
  }
}

/** Exécuté dans le document cible ; observation du DOM, pas de délai arbitraire. */
export async function waitForApplication(expectedUrl, timeoutMs = 15000) {
  if (location.href !== expectedUrl || document.readyState !== 'complete') {
    throw new Error(`Document attendu non chargé : ${expectedUrl} (reçu ${location.href}, état ${document.readyState}).`);
  }
  function observe(predicate, failure) {
    return new Promise((resolve, reject) => {
      let timer;
      const observer = new MutationObserver(check);
      function check() {
        try {
          const value = predicate();
          if (!value) return;
          clearTimeout(timer); observer.disconnect(); resolve(value);
        } catch (error) { clearTimeout(timer); observer.disconnect(); reject(error); }
      }
      observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
      timer = setTimeout(() => { observer.disconnect(); reject(new Error(failure)); }, timeoutMs);
      check();
    });
  }
  await observe(() => document.getElementById('app'), `#app absent du document chargé : ${expectedUrl}.`);
  await observe(() => {
    const app = document.getElementById('app');
    if (app?.textContent.includes('Données locales indisponibles')) {
      throw new Error(`Initialisation Voti en erreur : ${document.getElementById('message')?.textContent || app.textContent}.`);
    }
    const hash = new URL(expectedUrl).hash;
    if (hash && hash !== '#home') {
      if (app?.querySelector('h1')?.textContent === 'Impossible d’ouvrir cette page') throw new Error(`Page non disponible : ${app.textContent}`);
      return app?.querySelector('h1') && app.getAttribute('aria-busy') === 'false';
    }
    return app?.querySelector('a[href="#new"]') && app.querySelector('[data-testid="poll-list"]');
  }, `Voti ne termine pas son initialisation : ${expectedUrl} (#app présent, accueil non prêt).`);
  return true;
}
