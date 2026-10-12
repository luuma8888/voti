/** Scénarios UI v0.3C sérialisables. Les clés sont des fixtures locales, jamais affichées. */
export async function browserKeyExport() {
  const button = [...document.querySelectorAll('#app button')].find(b => b.textContent === 'Exporter la clé d’administration');
  if (!button) throw new Error('Export clé absent');
  let download;
  const original = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { download = { url: this.href, name: this.download }; };
  try {
    button.click(); const until = performance.now() + 10000;
    while (!download) { if (performance.now() > until) throw new Error('Clé non téléchargée'); await new Promise(requestAnimationFrame); }
    const key = JSON.parse(await (await fetch(download.url)).text());
    if (key.version !== 1 || download.name !== `voti-admin-${key.pollId}.json` || !/^voti-admin-v1\.[a-f0-9]{64}$/.test(key.adminCapability)) throw new Error('Fichier clé invalide');
    if (!document.getElementById('app').textContent.includes('Toute personne qui la possède')) throw new Error('Avertissement secret absent');
    if (location.href.includes(key.adminCapability) || [...document.querySelectorAll('a')].some(a => a.href.includes(key.adminCapability))) throw new Error('Secret dans URL');
    return { key, checks: 4 };
  } finally { HTMLAnchorElement.prototype.click = original; }
}
export async function browserKeyImport(key) {
  let checks = 0;
  const assert = (value, label) => { if (!value) throw new Error(label); checks++; };
  const wait = async predicate => { const end = performance.now() + 15000; while (!predicate()) { if (performance.now() > end) throw new Error('Import clé non terminé : '+document.querySelector('#app h1')?.textContent+' / '+document.getElementById('message')?.textContent); await new Promise(requestAnimationFrame); } };
  const stored = () => JSON.parse(localStorage.getItem('voti.remote.v1')).connections.find(c => c.pollId === key.pollId);
  const input = () => document.querySelector('input[aria-label="Choisir une clé d’administration secrète"]');
  const send = value => {
    const data = new DataTransfer(); data.items.add(new File([JSON.stringify(value)], 'voti-admin-test.json', { type: 'application/json' }));
    input().files = data.files; input().dispatchEvent(new Event('change', { bubbles: true }));
  };
  location.hash = '#backup'; await wait(() => input());
  assert(document.getElementById('app').textContent.includes('Importer une clé d’administration'), 'Import absent Sauvegarde');
  // Secret bien formé mais incorrect : le relais doit le refuser, pas le navigateur seul.
  send({ ...key, adminCapability: 'voti-admin-v1.' + '0'.repeat(64) });
  await wait(() => !document.getElementById('message').hidden && !document.querySelector('.admin-key-panel button').disabled);
  assert(stored().adminCapability === null, 'Mauvaise clé acceptée');
  // Simule un secret local obsolète : annulation puis confirmation du remplacement.
  const records = JSON.parse(localStorage.getItem('voti.remote.v1'));
  const old = 'voti-admin-v1.' + '1'.repeat(64); records.connections.find(c => c.pollId === key.pollId).adminCapability = old;
  localStorage.setItem('voti.remote.v1', JSON.stringify(records));
  const control = document.querySelector('.admin-key-panel button');
  const dialog = () => document.querySelector('.confirmation-dialog');
  control.focus();send(key);await wait(()=>dialog()?.open);
  assert(dialog().querySelector('h2').textContent==='Remplacer la clé d’administration ?' && dialog().textContent.includes('ce navigateur'), 'Titre et conséquence de clé');
  assert(stored().adminCapability===old && document.activeElement.dataset.confirmation==='cancel', 'Ancienne clé conservée avant confirmation');
  dialog().querySelector('[data-confirmation=cancel]').click();
  await wait(()=>!control.disabled && document.activeElement===control);
  assert(stored().adminCapability===old, 'Annulation écrase secret');
  send(key);await wait(()=>dialog()?.open);
  dialog().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await wait(()=>!control.disabled && document.activeElement===control);
  assert(stored().adminCapability===old, 'Échap remplace la clé');
  send(key);await wait(()=>dialog()?.open);
  const accept=dialog().querySelector('[data-confirmation=accept]');
  assert(accept.textContent==='Remplacer la clé' && !accept.classList.contains('danger'), 'Action de remplacement ambiguë');
  accept.click();accept.click();
  await wait(() => location.hash === '#poll/' + key.pollId && document.getElementById('app').getAttribute('aria-busy') === 'false' &&
    document.querySelector(`#app a[href="#/p/${key.pollId}"]`));
  assert(stored().adminCapability === key.adminCapability, 'Confirmation import non prise en compte');
  assert(document.getElementById('app').textContent.includes('Supprimer en ligne'), 'Administration retrouvée sans snapshot local');
  assert(!document.documentElement.querySelector('script[src*="turnstile"]'), 'Turnstile pendant import/admin');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Import déborde à 360');
  location.hash = '#home'; await wait(() => document.getElementById('app').querySelector('h1')?.textContent === 'Mes sondages' && document.getElementById('app').getAttribute('aria-busy') === 'false');
  assert(document.getElementById('app').textContent.includes('Administrations en ligne retrouvées'), 'Administration perdue sur accueil');
  return checks;
}
export async function browserDelete(id, cancelOnly = false) {
  let checks = 0;
  const wait = async f => { const end = performance.now() + 15000; while (!f()) { if (performance.now() > end) throw new Error('Suppression UI non terminée'); await new Promise(requestAnimationFrame); } };
  const control = [...document.querySelectorAll('#app button')].find(b => b.textContent === 'Supprimer en ligne');
  if (!control) throw new Error('Suppression absente');
  const before=localStorage.getItem('voti.remote.v1');
  control.focus();control.click();
  const dialog=document.querySelector('.confirmation-dialog');
  if(!dialog?.matches(':modal') || !dialog.querySelector('h2').textContent.includes('définitivement') || !dialog.textContent.includes('copie locale'))throw new Error('Confirmation suppression insuffisante');checks++;
  if(localStorage.getItem('voti.remote.v1')!==before || control.disabled || document.activeElement.dataset.confirmation!=='cancel')throw new Error('Action avant consentement');checks++;
  if(cancelOnly) {
    dialog.querySelector('[data-confirmation=cancel]').click();await wait(()=>document.activeElement===control);
    control.click();document.querySelector('.confirmation-dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await wait(()=>document.activeElement===control);
    if(localStorage.getItem('voti.remote.v1')!==before || !control.isConnected)throw new Error('Annulation supprime la connexion');checks++;
    return checks;
  }
  const accept=dialog.querySelector('[data-confirmation=accept]');
  if(accept.textContent!=='Supprimer définitivement' || !accept.classList.contains('danger'))throw new Error('Suppression sans bouton danger explicite');checks++;
  accept.click();accept.click();
  await wait(() => location.hash === '#home' && document.getElementById('app').getAttribute('aria-busy') === 'false');
  if (JSON.parse(localStorage.getItem('voti.remote.v1')).connections.some(c => c.pollId === id)) throw new Error('Connexion distante conservée'); checks++;
  if (JSON.parse(localStorage.getItem('voti.local.v1')).ballots.length) throw new Error('Bulletins distants copiés'); checks++;
  location.hash = '#/p/' + id;
  await wait(() => document.getElementById('app').textContent.includes('Impossible d’ouvrir'));
  if (document.querySelector('.vote-choices')) throw new Error('Vote proposé après suppression'); checks++;
  return checks;
}
