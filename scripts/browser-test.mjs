import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, ROOT } from './build.mjs';
import { votes, published } from '../tests/fixtures.js';
import { navigateAndWait, waitForApplication } from './browser-navigation.mjs';

await build();
const url = pathToFileURL(resolve(ROOT, 'index.html')).href;
// Profil isolé conservé dans le dépôt ; jamais le profil réel du navigateur.
const profile = resolve(ROOT, '.browser-tests', `profile-${Date.now()}`);
await mkdir(profile, { recursive: true });
const browser = spawn(process.env.VOTI_CHROMIUM || '/usr/bin/chromium', [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--no-first-run', '--disable-background-networking', '--disable-component-update',
  `--user-data-dir=${profile}`, `--disk-cache-dir=${profile}/cache`, `--crash-dumps-dir=${profile}/crashes`, '--remote-debugging-pipe', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], env: { ...process.env,
  XDG_CONFIG_HOME: resolve(ROOT, '.browser-tests/config'), XDG_CACHE_HOME: resolve(ROOT, '.browser-tests/cache') } });
let buffer = ''; let sequence = 0; const pending = new Map();
const runtimeErrors = []; const requests = [];
const events = new EventEmitter();
let server;
let browserFailure = '';
browser.stderr.on('data', chunk => { browserFailure = (browserFailure + chunk.toString()).slice(-2000); });
function failPending(error) {
  for (const task of pending.values()) { clearTimeout(task.timeout); task.reject(new Error(`${error.message} ${browserFailure.slice(-600)}`)); }
  pending.clear();
}
browser.on('error', failPending);
browser.stdio[3].on('error', failPending);
browser.stdio[4].on('error', failPending);
browser.on('exit', code => { if (code) failPending(new Error(`Chromium a quitté avec le code ${code}.`)); });
browser.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\0')) !== -1) {
    const raw = buffer.slice(0, index); buffer = buffer.slice(index + 1);
    if (!raw) continue;
    const packet = JSON.parse(raw);
    if (packet.method) events.emit('event', packet);
    if (packet.id && pending.has(packet.id)) {
      const task = pending.get(packet.id); pending.delete(packet.id);
      clearTimeout(task.timeout);
      if (packet.error) task.reject(new Error(packet.error.message)); else task.resolve(packet.result);
    } else if (packet.method === 'Runtime.exceptionThrown') runtimeErrors.push(packet.params.exceptionDetails);
    else if (packet.method === 'Network.requestWillBeSent') requests.push(packet.params.request.url);
  }
});
function command(method, params = {}, sessionId) {
  return new Promise((resolveCommand, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Délai dépassé : ${method}`)); }, 30000);
    pending.set(id, { resolve: resolveCommand, reject, timeout });
    browser.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function navigateReady(session, destination) {
  await navigateAndWait(command, events, session, destination);
  await evaluate(session, `(${waitForApplication.toString()})(${JSON.stringify(destination)})`);
}

async function startDevServer() {
  const child = spawn(process.execPath, [resolve(ROOT, 'scripts/dev.mjs')], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: process.env
  });
  server = child;
  await new Promise((resolveReady, reject) => {
    let output = ''; let errors = '';
    const timer = setTimeout(() => reject(new Error('Serveur local non prêt sur 127.0.0.1:4173.')), 15000);
    const finish = callback => { clearTimeout(timer); callback(); };
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      if (output.includes('http://127.0.0.1:4173')) finish(resolveReady);
    });
    child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-1000); });
    child.once('error', error => finish(() => reject(new Error(`Serveur local : ${error.message}`))));
    child.once('exit', code => finish(() => reject(new Error(`Serveur local arrêté (${code}) : ${errors}`))));
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolveExit => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => { clearTimeout(timer); resolveExit(); });
    child.kill();
  });
}

/** Parcours réel via DOM uniquement, aucune API métier exposée par l'application. */
async function browserScenario(fixtures) {
  const key = 'voti.local.v1';
  let checks = 0;
  function assert(condition, label) { if (!condition) throw new Error(label); checks++; }
  async function until(predicate, label) {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > 5000) throw new Error(`Attente : ${label}`);
      await new Promise(resolveWait => setTimeout(resolveWait, 20));
    }
  }
  const text = () => document.getElementById('app')?.textContent || '';
  const stored = () => JSON.parse(localStorage.getItem(key));
  function click(label) {
    const node = [...document.querySelectorAll('#app button,#app a')].find(item => item.textContent === label);
    if (!node) throw new Error(`Bouton absent : ${label}`);
    node.click(); return node;
  }
  function input(node, value) { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }
  async function navigate(hash, expected) {
    if (location.hash !== hash) {
      await new Promise(resolveNavigation => {
        window.addEventListener('hashchange', () => setTimeout(resolveNavigation, 0), { once: true });
        location.hash = hash;
      });
    }
    await until(() => text().includes(expected), expected);
  }
  async function seed(state, hash, expected) {
    localStorage.setItem(key, JSON.stringify(state));
    window.dispatchEvent(new StorageEvent('storage', { key }));
    await navigate(hash, expected);
  }

  await until(() => text().includes('Mes sondages'), 'accueil');
  assert(localStorage.getItem(key) === null, 'Aucune écriture au chargement');
  click('Créer un sondage'); await until(() => !!document.querySelector('textarea'), 'question');
  input(document.querySelector('textarea'), 'Quelle activité ?'); click('Continuer');
  input(document.querySelectorAll('#app input[type=text]')[0], 'Cinéma');
  input(document.querySelectorAll('#app input[type=text]')[1], 'Jeux');
  click('Ajouter une réponse'); input(document.querySelectorAll('#app input[type=text]')[2], '<img src=x onerror="window.votiXss=true">');
  click('Continuer'); click('Continuer');
  const create = click('Créer le brouillon'); create.click();
  await until(() => text().includes('Publier dans ce navigateur'), 'brouillon');
  assert(stored().polls.length === 1 && stored().ballots.length === 0, 'Création unique, sans vote');
  assert(document.querySelectorAll('#app img').length === 0 && !window.votiXss, 'Texte saisi : aucune exécution HTML');
  const id = stored().polls[0].id;
  await navigate(`#vote/${id}`, 'pas encore ouvert');
  assert(stored().ballots.length === 0, 'Brouillon : navigation sans vote');
  await navigate(`#poll/${id}`, 'Publier dans ce navigateur');
  click('Publier dans ce navigateur'); await until(() => text().includes('Vote ouvert'), 'publication');
  click('Modifier le sondage'); await until(() => !!document.querySelector('textarea'), 'édition publiée');
  input(document.querySelector('textarea'), 'Quelle activité vendredi ?');
  click('Continuer'); click('Continuer'); click('Continuer'); click('Enregistrer les modifications');
  await until(() => text().includes('Quelle activité vendredi ?') && text().includes('Ouvrir le vote'), 'édition enregistrée');
  assert(stored().polls[0].definition.question === 'Quelle activité vendredi ?', 'Modification publiée avant vote');
  await navigate(`#results/${id}`, 'pas encore disponibles');
  assert(!text().includes('0 réponses'), 'Compteur à zéro masqué');
  await navigate(`#vote/${id}`, 'Choisis une réponse');
  assert(stored().ballots.length === 0, 'Navigation publiée sans vote');
  document.querySelector('input[type=radio]').click(); click('Continuer');
  assert(stored().ballots.length === 0, 'Présélection sans vote');
  const confirm = click('Oui, je confirme'); confirm.click();
  await until(() => text().includes('Ton vote a bien été enregistré'), 'vote enregistré');
  assert(stored().ballots.length === 1 && !!stored().polls[0].lockedAt, 'Double clic : un bulletin et verrouillage');
  await navigate(`#poll/${id}`, 'premier vote a verrouillé');
  assert(![...document.querySelectorAll('#app a')].some(node => node.textContent === 'Modifier le sondage'), 'Édition sémantique retirée');
  await navigate(`#edit/${id}`, 'ne peut plus être modifié');
  assert(stored().ballots.length === 1, 'Lien édition verrouillée refusé');
  await navigate(`#style/${id}`, 'Modifier l’apparence');
  const hash = stored().polls[0].definitionHash;
  document.querySelector('#app select').value = 'lavender'; click('Enregistrer l’apparence');
  await until(() => stored().polls[0].style.themeId === 'lavender', 'style sauvé');
  assert(stored().polls[0].definitionHash === hash, 'Style hors empreinte');

  for (const count of [4, 5, 6]) {
    const state = fixtures[count]; const poll = state.polls[0];
    await seed(state, `#results/${poll.id}`, count >= 5 ? `${count} réponses` : 'pas encore disponibles');
    assert(count >= 5 ? text().includes(`${count} réponses`) : !text().includes('4 réponses'), `Affichage réel au seuil : ${count}`);
  }
  const closed = fixtures.closed; const closedId = closed.polls[0].id;
  await seed(closed, `#results/${closedId}`, 'pas encore disponibles');
  assert(!text().includes('3 réponses'), 'Fermé à trois : compteur et résultats masqués');
  await navigate(`#vote/${closedId}`, 'Ce sondage est fermé');
  assert(stored().ballots.length === 3, 'Fermé : navigation sans vote');

  const imported = fixtures.html;
  await seed(imported, `#poll/${imported.polls[0].id}`, '<img');
  assert(document.querySelectorAll('#app img,#app svg,#app script').length === 0 && !window.votiXss, 'Textes importés : aucune exécution HTML');
  const theme = document.getElementById('theme-toggle'); theme.click();
  assert(document.documentElement.dataset.theme === 'dark', 'Mode nuit'); theme.click();
  assert(document.documentElement.dataset.theme === 'light', 'Mode jour');
  await navigate('#home', 'Mes sondages');
  const file = new File(['{'], 'invalide.json', { type: 'application/json' });
  const transfer = new DataTransfer(); transfer.items.add(file);
  const upload = document.querySelector('input[type=file]'); upload.files = transfer.files;
  const before = localStorage.getItem(key); upload.dispatchEvent(new Event('change'));
  await until(() => document.getElementById('message').textContent.includes('JSON valide'), 'import refusé');
  assert(localStorage.getItem(key) === before, 'Import invalide : stockage conservé');
  async function uploadJson(state) {
    const data = new DataTransfer(); data.items.add(new File([JSON.stringify(state)], 'voti.json', { type: 'application/json' }));
    const node = document.querySelector('input[type=file]'); node.files = data.files;
    node.dispatchEvent(new Event('change'));
  }
  await uploadJson(fixtures[6]);
  await until(() => document.getElementById('message').textContent.includes('contient déjà'), 'collision refusée');
  assert(localStorage.getItem(key) === before, 'Import sur espace occupé : aucun remplacement');
  await seed({ schemaVersion: 1, polls: [], ballots: [] }, '#home', 'Votre premier sondage');
  await uploadJson(fixtures[6]);
  await until(() => stored().ballots.length === 6 && !document.getElementById('message').textContent, 'import valide');
  assert(stored().polls[0].definitionHash === fixtures[6].polls[0].definitionHash, 'Import valide : données restaurées');
  return checks;
}

try {
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Runtime.enable', {}, sessionId);
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId);
  await navigateReady(sessionId, url);
  const closed = await votes(3, { releaseMode: 'closed' });
  const { closePoll } = await import('../shared/poll-engine.js');
  const { now } = await import('../tests/fixtures.js');
  const injected = published(); injected.polls[0].definition.question = '<img src=x onerror="window.votiXss=true">';
  injected.polls[0].definition.choices[0].label = '<svg onload="window.votiXss=true">';
  const fixtures = { 4: await votes(4), 5: await votes(5), 6: await votes(6), closed: closePoll(closed, closed.polls[0].id, now), html: injected };
  const count = await evaluate(sessionId, `(${browserScenario.toString()})(${JSON.stringify(fixtures)})`);
  await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true }, sessionId);
  const fits = await evaluate(sessionId, 'document.documentElement.scrollWidth <= innerWidth');
  if (!fits) throw new Error('Débordement horizontal à 360 px.');
  await command('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  if (!await evaluate(sessionId, 'getComputedStyle(document.querySelector(".topbar")).display === "none"')) throw new Error('CSS impression non appliqué.');
  await command('Emulation.setEmulatedMedia', { media: '' }, sessionId);
  const offlineUrl = pathToFileURL(resolve(ROOT, 'index.html')).href;
  await command('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, sessionId);
  await navigateReady(sessionId, offlineUrl);
  if (requests.some(item => /^https?:/.test(item))) throw new Error('Requête HTTP inattendue pendant les tests file://.');

  await command('Network.emulateNetworkConditions', { offline: false, latency: 250, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
  await startDevServer();
  const servedUrl = 'http://127.0.0.1:4173/voti/';
  await navigateReady(sessionId, servedUrl);
  // Un véritable rendu navigateur au sous-chemin, avec latence réseau simulée.
  const smoke = await evaluate(sessionId, `(async () => {
    const app = document.getElementById('app');
    if (location.href !== ${JSON.stringify(servedUrl)}) throw new Error('Sous-chemin /voti/ incorrect.');
    if (localStorage.getItem('voti.local.v1') !== null) throw new Error('Écriture inattendue au chargement HTTP.');
    app.querySelector('a[href="#new"]').click();
    await new Promise((resolveChange, reject) => {
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Navigation locale /voti/#new non rendue.')); }, 5000);
      const observer = new MutationObserver(() => {
        if (app.querySelector('textarea')) { clearTimeout(timer); observer.disconnect(); resolveChange(); }
      });
      observer.observe(app, { childList: true, subtree: true });
      if (app.querySelector('textarea')) { clearTimeout(timer); observer.disconnect(); resolveChange(); }
    });
    if (location.pathname !== '/voti/' || location.hash !== '#new') throw new Error('Navigation hors sous-chemin /voti/.');
    if (localStorage.getItem('voti.local.v1') !== null) throw new Error('La navigation a écrit des données.');
    return 4;
  })()`);
  if (runtimeErrors.length) throw new Error(`${runtimeErrors.length} exceptions JavaScript navigateur.`);
  if (requests.some(item => /^https?:/.test(item) && new URL(item).origin !== 'http://127.0.0.1:4173')) throw new Error('Requête réseau externe inattendue.');
  console.log(`Navigateur Chromium : ${count + 4 + smoke} contrôles réussis (file:// offline et http://127.0.0.1:4173/voti/, chargements synchronisés).`);
} catch (error) {
  console.error(`Tests navigateur ÉCHEC : ${error.message}`); process.exitCode = 1;
} finally {
  for (const task of pending.values()) { clearTimeout(task.timeout); task.reject(new Error('Fin du test')); }
  await Promise.all([stopChild(browser), stopChild(server)]);
}
