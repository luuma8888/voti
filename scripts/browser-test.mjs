import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, ROOT } from './build.mjs';
import { votes, published, libraryFixture } from '../tests/fixtures.js';
import { navigateAndWait, waitForApplication } from './browser-navigation.mjs';
import { browserAssetScenario } from './browser-assets.mjs';
import { graphicFixtures, graphicChecks, remoteBrowserAction } from './browser-relay.mjs';
import { browserKeyExport, browserKeyImport, browserDelete } from './browser-hardening.mjs';
import { browserDialogScenario, keyboardDialogChecks } from './browser-dialogs.mjs';
import { browserQrScenario, browserPosterScenario, qrChoiceStage } from './browser-qr.mjs';
import { adminQrScenario } from './browser-admin-qr.mjs';
import { browserStudioScenario, browserStudioPdfScenario, browserStudioWorkspace } from './browser-studio.mjs';
import { wrangler } from './relay-local.mjs';

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
const httpDiagnostics = [];
const relayRequests = [];
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
    if (packet.method === 'Network.responseReceived' && packet.params.response.url.startsWith('http://127.0.0.1:8787')) httpDiagnostics.push({ url:packet.params.response.url, status:packet.params.response.status });
    if (packet.method === 'Network.loadingFailed') httpDiagnostics.push({ error:packet.params.errorText, cors:packet.params.corsErrorStatus?.corsError });
    if (packet.id && pending.has(packet.id)) {
      const task = pending.get(packet.id); pending.delete(packet.id);
      clearTimeout(task.timeout);
      if (packet.error) task.reject(new Error(packet.error.message)); else task.resolve(packet.result);
    } else if (packet.method === 'Runtime.exceptionThrown') runtimeErrors.push(packet.params.exceptionDetails);
    else if (packet.method === 'Network.requestWillBeSent') {
      requests.push(packet.params.request.url);
      if(packet.params.request.url.startsWith('http://127.0.0.1:8787/api/v1/')) relayRequests.push({sessionId:packet.sessionId,method:packet.params.request.method,url:packet.params.request.url});
    }
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
  let result;
  try { result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session); }
  catch (error) { throw new Error(`${expression.match(/\bfunction\s+(\w+)/)?.[1] || 'Rendu navigateur'} : ${error.message}`); }
  if (result.exceptionDetails) throw new Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, '[module embarqué]'));
  return result.result.value;
}

async function navigateReady(session, destination) {
  await navigateAndWait(command, events, session, destination);
  await evaluate(session, `(${waitForApplication.toString()})(${JSON.stringify(destination)})`);
}
/** Observation indépendante des bulletins dans D1 local, jamais sur la production. */
async function localBallotCount(id) {
  if(!/^[a-f0-9-]{36}$/.test(id) || !/^\.relay-local\/(?:test|free)-\d+$/.test(process.env.VOTI_TEST_PERSIST||'')) throw new Error('Observation D1 locale non configurée.');
  const free=process.env.VOTI_TEST_FREE_PILOT==='1';
  const child=wrangler(['d1','execute',free?'voti-free-test':'voti-local','--config',free?'relay/cloudflare/wrangler.free-test.jsonc':'relay/cloudflare/wrangler.jsonc',
    '--local','--persist-to',process.env.VOTI_TEST_PERSIST,'--json','--command',`SELECT COUNT(*) n FROM ballots WHERE poll_id='${id}'`],{stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',c=>output+=c);child.stderr.resume();
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Lecture du compteur D1 local refusée.')));});
  return JSON.parse(output)[0].results[0].n;
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
  click('+ Nouveau sondage'); await until(() => !!document.querySelector('textarea'), 'question');
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
  assert(![...document.querySelectorAll('#app a')].some(node => node.textContent === 'Résultats'), 'Brouillon : pas de nouveau bouton de résultats');
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
  assert(document.querySelector(`#app a[href="#results/${id}"]`)?.textContent === 'Résultats', 'Vote local : route de résultats locale conservée');
  await navigate(`#poll/${id}`, 'premier vote a verrouillé');
  assert(![...document.querySelectorAll('#app a')].some(node => node.textContent === 'Modifier le sondage'), 'Édition sémantique retirée');
  await navigate(`#edit/${id}`, 'ne peut plus être modifié');
  assert(stored().ballots.length === 1, 'Lien édition verrouillée refusé');
  await navigate(`#style/${id}`, 'Modifier l’apparence');
  const hash = stored().polls[0].definitionHash;
  document.querySelector('#app select').value = 'lavender'; click('Enregistrer l’apparence');
  await until(() => stored().polls[0].style.themeId === 'lavender', 'style sauvé');
  assert(stored().polls[0].definitionHash === hash, 'Style hors empreinte');

  // Micro-correction autorisée pendant la recette v0.3D : l'accent du sondage
  // doit atteindre les composants, pas seulement la bordure. Aucun vote envoyé.
  await navigate(`#vote/${id}`, 'Choisis une réponse');
  const pollCard = document.querySelector('.card[data-accent]');
  const initialTheme = document.documentElement.dataset.theme;
  const initialAccent = pollCard.dataset.accent;
  const beforeAccentChecks = localStorage.getItem(key);
  const rgb = hex => 'rgb(' + hex.trim().slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ') + ')';
  for (const theme of ['pop', 'nature', 'douceur', 'dark', 'minimal']) {
    document.documentElement.dataset.theme = theme;
    const palette = getComputedStyle(document.documentElement);
    const headerColor = getComputedStyle(document.querySelector('.topbar')).backgroundColor;
    const buttonColors = [], questionColors = [];
    for (const accent of ['mint', 'lavender', 'peach']) {
      pollCard.dataset.accent = accent;
      const color = rgb(palette.getPropertyValue(`--poll-${accent}`));
      const soft = rgb(palette.getPropertyValue(`--poll-${accent}-soft`));
      const next = pollCard.querySelector('.primary'), question = pollCard.querySelector('.question-block');
      const radio = pollCard.querySelector('input[type=radio]'); radio.checked = true;
      buttonColors.push(getComputedStyle(next).backgroundColor);
      questionColors.push(getComputedStyle(question).backgroundColor);
      assert(buttonColors.at(-1) === color && getComputedStyle(next).color === rgb(palette.getPropertyValue('--on-accent')), `Bouton contextualisé ${theme}/${accent}`);
      assert(questionColors.at(-1) === soft, `Question contextualisée ${theme}/${accent}`);
      assert(getComputedStyle(radio.closest('.vote-choice')).borderColor === color && getComputedStyle(radio.closest('.vote-choice')).backgroundColor === soft, `Sélection contextualisée ${theme}/${accent}`);
      assert(getComputedStyle(radio).accentColor === color, `Radio contextualisé ${theme}/${accent}`);
      radio.focus();
      assert(parseFloat(getComputedStyle(radio).outlineWidth) >= 3 && getComputedStyle(radio).outlineColor === color, `Focus contextualisé ${theme}/${accent}`);
      assert(getComputedStyle(document.querySelector('.topbar')).backgroundColor === headerColor, `Thème global intact ${theme}/${accent}`);
      assert(next.getBoundingClientRect().height >= 44 && document.documentElement.scrollWidth <= innerWidth, `Tactile et largeur ${theme}/${accent}`);
      radio.checked = false;
    }
    assert(new Set(buttonColors).size === 3 && new Set(questionColors).size === 3, `Trois apparences distinctes ${theme}`);
  }
  pollCard.dataset.accent = initialAccent;
  document.documentElement.dataset.theme = initialTheme;
  assert(localStorage.getItem(key) === beforeAccentChecks, 'Vérification des accents sans mutation des sondages ou des bulletins');

  await navigate(`#poll/${id}`, 'Fermer le sondage');
  const closeControl=[...document.querySelectorAll('#app button')].find(b=>b.textContent==='Fermer le sondage');
  const beforeClose=localStorage.getItem(key);
  closeControl.focus();closeControl.click();closeControl.click();
  assert(document.querySelectorAll('.confirmation-dialog:modal').length===1 && stored().polls[0].status==='published', 'Fermeture locale : un dialogue et aucune action avant confirmation');
  document.querySelector('[data-confirmation=cancel]').click();
  await until(()=>document.activeElement===closeControl, 'focus fermeture annulée');
  assert(localStorage.getItem(key)===beforeClose, 'Fermeture locale annulée sans changement');
  closeControl.click();location.hash='#home';
  await until(()=>!document.querySelector('.confirmation-dialog') && text().includes('Mes sondages'), 'annulation à la navigation');
  assert(localStorage.getItem(key)===beforeClose, 'Navigation pendant confirmation sans fermeture');
  await navigate(`#poll/${id}`, 'Fermer le sondage');
  click('Fermer le sondage');
  const acceptClose=document.querySelector('[data-confirmation=accept]');acceptClose.click();acceptClose.click();
  await until(()=>stored().polls[0].status==='closed', 'fermeture locale confirmée');
  assert(stored().ballots.length===1 && stored().polls[0].definitionHash===hash, 'Fermeture confirmée conserve bulletins et empreinte');

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
  assert(document.querySelector(`#app a[href="#poll/${closedId}"]`)?.textContent === 'Retour', 'Fermé local : retour à la gestion conservé');
  const closedResults = document.querySelector(`#app a[href="#results/${closedId}"]`);
  assert(closedResults?.textContent === 'Résultats' && closedResults.classList.contains('primary'), 'Fermé local : bouton de résultats accessible');
  closedResults.click(); await until(() => text().includes('pas encore disponibles'), 'résultats fermés sous seuil');
  assert(location.hash === `#results/${closedId}` && !text().includes('3 réponses') && stored().ballots.length === 3, 'Bouton fermé : seuil et compteur masqué conservés, aucun vote ajouté');

  const imported = fixtures.html;
  await seed(imported, `#poll/${imported.polls[0].id}`, '<img');
  assert(document.querySelectorAll('#app img,#app svg,#app script').length === 0 && !window.votiXss, 'Textes importés : aucune exécution HTML');
  const theme = document.getElementById('theme-toggle'); theme.click();
  await until(() => document.querySelectorAll('.theme-option').length === 5, 'sélecteur des cinq thèmes');
  assert(document.documentElement.dataset.theme === 'pop', 'Voti Pop par défaut');
  assert(document.querySelectorAll('.theme-option').length === 5 && document.querySelectorAll('.theme-preview .swatch').length === 25, 'Cinq thèmes avec palettes locales');
  const unchanged = localStorage.getItem('voti.local.v1');
  for (const id of ['pop','nature','douceur','dark','minimal']) {
    document.querySelector(`.theme-option[data-theme="${id}"]`).click();
    assert(document.documentElement.dataset.theme === id && localStorage.getItem('voti.theme') === id, `Changement et persistance ${id}`);
    assert(document.querySelectorAll('.theme-option[aria-pressed="true"]').length === 1 && document.querySelector(`.theme-option[data-theme="${id}"] .theme-selection`).textContent.includes('Sélectionné'), `Sélection explicite ${id}`);
  }
  assert(localStorage.getItem('voti.local.v1') === unchanged, 'Thèmes sans mutation des sondages ou bulletins');
  document.querySelector('.theme-option[data-theme="nature"]').click();
  document.querySelector('.main-nav a[href="#backup"]').click();
  await until(() => text().includes('Sauvegarde & transfert'), 'navigation Sauvegarde');
  assert(document.querySelector('.main-nav a[href="#backup"]').getAttribute('aria-current') === 'page', 'Navigation active Sauvegarde');
  assert(!document.getElementById('location').hidden && document.getElementById('location').textContent === 'Sauvegarde' && document.title === 'Sauvegarde · Voti', 'Repère et titre conservés hors accueil');
  assert([...document.querySelectorAll('#app button')].some(node => node.textContent === 'Exporter une sauvegarde') &&
    [...document.querySelectorAll('#app button')].some(node => node.textContent === 'Importer une sauvegarde'), 'Deux actions de sauvegarde simples');
  const advanced = document.querySelector('#app details.advanced');
  assert(!advanced.open && advanced.querySelector('textarea').value === '', 'JSON masqué et non chargé par défaut');
  advanced.open = true;
  await until(() => advanced.querySelector('textarea').value.includes('schemaVersion'), 'JSON avancé');
  assert(advanced.querySelector('textarea').readOnly, 'JSON avancé en lecture seule');
  advanced.open = false;
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
  await navigate('#backup', 'Sauvegarde & transfert');
  await uploadJson(fixtures[6]);
  await until(() => stored().ballots.length === 6 && !document.getElementById('message').textContent, 'import valide');
  assert(stored().polls[0].definitionHash === fixtures[6].polls[0].definitionHash, 'Import valide : données restaurées');

  await seed(fixtures.library, '#home', '20 sondages');
  const rows = () => [...document.querySelectorAll('.poll-row')];
  const counts = () => document.querySelector('[data-testid="library-count"]').textContent;
  assert(rows().length === 20, 'Accueil réel avec 20 sondages');
  assert(!text().includes('Et si on choisissait ensemble') && !document.querySelector('#app input[type=file]'), 'Accueil sans hero ni sauvegarde technique');
  assert(new Set(rows().map(row => row.querySelector('.badge').textContent)).size === 3, 'Trois statuts textuels');
  assert(rows()[0].dataset.pollId === fixtures.library.polls[19].id, 'Tri récent par défaut');
  const search = document.querySelector('[data-testid="poll-search"]');
  search.focus(); input(search, 'evasion');
  assert(rows().length === 4 && document.activeElement === search, 'Recherche sans accent, focus conservé');
  input(search, 'Rencontre locale 20'); assert(rows().length === 1, 'Recherche dans la description');
  input(search, 'cinema'); assert(rows().length === 20, 'Recherche dans les choix');
  input(search, 'introuvable'); assert(rows().length === 0 && text().includes('Aucun sondage'), 'État vide filtré');
  click('Réinitialiser la recherche'); assert(rows().length === 20 && counts().includes('20 sur 20'), 'Réinitialisation de la recherche');
  for (const [filter, expected] of [['draft',4], ['published',8], ['closed',8], ['available',8], ['all',20]]) {
    const chip = document.querySelector(`[data-filter="${filter}"]`); chip.click();
    assert(rows().length === expected && chip.getAttribute('aria-pressed') === 'true', `Filtre ${filter}`);
  }
  const sorter = document.querySelector('[data-testid="poll-sort"]');
  for (const [sort, index] of [['oldest',0], ['alphabetical',0], ['recent',19]]) {
    sorter.value = sort; sorter.dispatchEvent(new Event('change'));
    assert(rows()[0].dataset.pollId === fixtures.library.polls[index].id, `Tri ${sort}`);
  }
  const rowFor = index => rows().find(row => row.dataset.pollId === fixtures.library.polls[index].id);
  const closedAvailable = rowFor(4);
  assert([...closedAvailable.querySelectorAll('.actions a')].map(node => node.textContent).join('|') === 'Résultats|Gérer' &&
    closedAvailable.querySelector('.actions a').classList.contains('primary'), 'Fermé disponible : Résultats prioritaires');
  closedAvailable.querySelector('a[href^="#results/"]').click();
  await until(() => text().includes('5 réponses') && text().includes('Les résultats'), 'résultats directs');
  assert(location.hash === `#results/${fixtures.library.polls[4].id}` && document.querySelector('#app .badge').textContent === 'Fermé', 'Accès direct et statut des résultats');
  await navigate('#home', '20 sondages');
  const locked = rowFor(3);
  assert(!locked.textContent.includes('3 réponses') && locked.textContent.includes('Résultats verrouillés'), 'Liste sans compteur bloqué');
  locked.querySelector('a[href^="#results/"]').click();
  await until(() => text().includes('pas encore disponibles'), 'résultats verrouillés directs');
  assert(!document.querySelector('#app progress') && text().includes('5 réponses') && text().includes('sondage fermé'), 'Explication du blocage, pas de graphique');
  await navigate('#home', '20 sondages');
  const draftRow = rowFor(0);
  assert([...draftRow.querySelectorAll('.actions>*')].map(node => node.textContent).join('|') === 'Modifier|Publier', 'Actions contextuelles Brouillon');
  draftRow.querySelector('a').click(); await until(() => !!document.querySelector('#app textarea'), 'modification depuis liste');
  assert(document.querySelector('#app textarea').value === fixtures.library.polls[0].definition.question, 'Modifier ouvre le bon sondage');
  await navigate('#home', '20 sondages');
  const beforePublish = stored().ballots.length;
  rowFor(0).querySelector('button').click();
  await until(() => rowFor(0)?.dataset.status === 'published', 'publication depuis liste');
  assert(stored().ballots.length === beforePublish && rowFor(0).textContent.includes('Voter'), 'Publier depuis liste sans vote');
  const skip = document.querySelector('.skip-link'); skip.click();
  assert(document.activeElement.id === 'app' && location.hash === '#home', 'Lien d’évitement sans casser la navigation');
  return checks;
}

/** Recette ciblée rapide : disposition réelle, sans refaire 28 exports PDF. */
async function studioWorkspaceChecks(sessionId) {
  let checks=0;
  for(const [width,height] of [[1365,768],[1280,720],[1024,768],[768,1024],[360,740],[320,640]]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500},sessionId);
    checks+=await evaluate(sessionId,`(${browserStudioWorkspace.toString()})('mount')`);
    try {checks+=await evaluate(sessionId,`(${browserStudioWorkspace.toString()})('scroll')`);}
    finally {const capture=await command('Page.captureScreenshot',{format:'png'},sessionId);
      await writeFile(resolve(ROOT,`.browser-tests/studio-workspace-${width}.png`),Buffer.from(capture.data,'base64'));}
    await command('Page.bringToFront',{},sessionId);
    checks+=await evaluate(sessionId,`(${browserStudioWorkspace.toString()})('prepare-keyboard')`);
    for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40},sessionId);
    checks+=await evaluate(sessionId,`(${browserStudioWorkspace.toString()})('keyboard-scroll')`);
    for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})},sessionId);
    checks+=await evaluate(sessionId,`(${browserStudioWorkspace.toString()})('keyboard-open')`);
    checks+=await evaluate(sessionId,`(${browserStudioWorkspace.toString()})('pages')`);
    checks+=await evaluate(sessionId,`(${browserStudioWorkspace.toString()})('cleanup')`);
  }
  return checks;
}

try {
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Runtime.enable', {}, sessionId);
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId);
  await command('Emulation.setDeviceMetricsOverride', { width: 1200, height: 820, deviceScaleFactor: 1, mobile: false }, sessionId);
  await navigateReady(sessionId, url);
  if(process.argv.includes('--studio-workspace')) {
    const checks=await studioWorkspaceChecks(sessionId);
    if(runtimeErrors.length)throw new Error(`${runtimeErrors.length} exceptions JavaScript navigateur.`);
    if(requests.some(url=>/^https?:/.test(url)))throw new Error('Requête externe depuis le Studio local.');
    console.log(`Studio Chromium : ${checks} contrôles réussis (formulaire gauche une colonne, aperçu hauteur disponible, clavier, mobile, pages).`);
  } else if(process.argv.includes('--studio-images')) {
    let checks=0;
    for(const width of [320,360,1200]){
      await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500},sessionId);
      checks+=await evaluate(sessionId,`(${browserStudioScenario.toString()})()`);
    }
    const files=[];await mkdir(resolve(ROOT,'.browser-tests/image-pdfs'),{recursive:true});
    for(const [layout,mode,n,height,focalY] of [['cards','choices',3,200,0],['cards','access',3,300,1],['mosaic','choices',6,250,.5]]){
      const options={densityPreset:'balanced',choicesPerRow:'2',qrSize:'small',...(mode==='access'?{palette:'ivory'}:{}),imageSettings:{main:{ratio:'full-width',height,fit:'cover',focalX:.5,focalY}}};
      const file=await evaluate(sessionId,`(${browserStudioPdfScenario.toString()})(${JSON.stringify(layout)},${JSON.stringify(mode)},${n},'poster',false,${JSON.stringify(options)},80)`);
      const {base64,...metadata}=file;files.push(metadata);await writeFile(resolve(ROOT,'.browser-tests/image-pdfs',file.name),Buffer.from(base64,'base64'));
    }
    await writeFile(resolve(ROOT,'.browser-tests/image-pdfs/plans.json'),JSON.stringify(files));
    if(runtimeErrors.length)throw new Error(`${runtimeErrors.length} exceptions JavaScript navigateur.`);
    if(requests.some(url=>/^https?:/.test(url)))throw new Error('Requête externe depuis le Studio local.');
    console.log(`Studio images Chromium : ${checks} contrôles réussis, curseur/persistance/ratios/mobile/thèmes, trois PDF ciblés.`);
  } else {
  const closed = await votes(3, { releaseMode: 'closed' });
  const { closePoll } = await import('../shared/poll-engine.js');
  const { now } = await import('../tests/fixtures.js');
  const injected = published(); injected.polls[0].definition.question = '<img src=x onerror="window.votiXss=true">';
  injected.polls[0].definition.choices[0].label = '<svg onload="window.votiXss=true">';
  const fixtures = { 4: await votes(4), 5: await votes(5), 6: await votes(6), closed: closePoll(closed, closed.polls[0].id, now), html: injected, library: await libraryFixture() };
  const count = await evaluate(sessionId, `(${browserScenario.toString()})(${JSON.stringify(fixtures)})`);
  const desktopHeader = await evaluate(sessionId, 'document.querySelector(".topbar").getBoundingClientRect().height');
  if (desktopHeader < 56 || desktopHeader > 72) throw new Error('Header desktop hors plage 56–72 px.');
  const desktopNavigation = await evaluate(sessionId, `(() => {
    const link = document.querySelector('.main-nav a[href="#new"]');
    if (link.innerText.trim() !== 'Nouveau sondage' || link.getAttribute('aria-label') !== 'Nouveau sondage') throw new Error('Libellé desktop ou nom accessible incorrect.');
    return 1;
  })()`);
  await evaluate(sessionId, '(async () => { document.activeElement.blur(); window.scrollTo(0,0); await new Promise(requestAnimationFrame); })()');
  const desktopCapture = await command('Page.captureScreenshot', { format: 'png' }, sessionId);
  await writeFile(resolve(ROOT, '.browser-tests/ux-v0-2a-desktop.png'), Buffer.from(desktopCapture.data, 'base64'));
  let dialogChecks = 0;
  for (const width of [320,360,1200]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height:820, deviceScaleFactor:1, mobile:width<680 }, sessionId);
    dialogChecks += await evaluate(sessionId, `(${browserDialogScenario.toString()})()`);
  }
  await command('Emulation.setDeviceMetricsOverride', { width:360, height:820, deviceScaleFactor:1, mobile:true }, sessionId);
  await command('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:'reduce'}] }, sessionId);
  for(const theme of ['pop','nature','douceur','dark','minimal']) {
    const scenario=await keyboardDialogChecks(command,evaluate,sessionId,theme);
    if(!await evaluate(sessionId, "getComputedStyle(document.querySelector('.confirmation-dialog')).animationName==='none' && getComputedStyle(document.querySelector('.confirmation-dialog')).transitionDuration==='0s'")) throw new Error('Mouvement réduit non respecté');dialogChecks++;
    const capture=await command('Page.captureScreenshot',{format:'png'},sessionId);
    await writeFile(resolve(ROOT,`.browser-tests/ux-v0-3e-${theme}-360.png`),Buffer.from(capture.data,'base64'));
    dialogChecks += await scenario.finish();
  }
  await command('Emulation.setEmulatedMedia', { features:[] }, sessionId);
  await evaluate(sessionId, 'document.documentElement.dataset.theme="nature";window.scrollTo(0,0)');
  await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true }, sessionId);
  const fits = await evaluate(sessionId, 'document.documentElement.scrollWidth <= innerWidth');
  if (!fits) throw new Error('Débordement horizontal à 360 px.');
  const mobileChecks = await evaluate(sessionId, `(() => {
    const header = document.querySelector('.topbar').getBoundingClientRect().height;
    if (header < 52 || header > 64) throw new Error('Header mobile hors plage.');
    if (document.querySelectorAll('.poll-row').length !== 20) throw new Error('Liste mobile incomplète.');
    if (getComputedStyle(document.querySelector('.main-nav')).position !== 'fixed') throw new Error('Navigation mobile absente.');
    const controls = [...document.querySelectorAll('.main-nav a,.poll-row .actions>*,.library-toolbar input,.library-toolbar select,.filter-chips button')];
    if (controls.some(node => node.getBoundingClientRect().height < 44)) throw new Error('Cible tactile inférieure à 44 px.');
    const search = document.querySelector('[data-testid="poll-search"]').getBoundingClientRect();
    const sort = document.querySelector('[data-testid="poll-sort"]').getBoundingClientRect();
    const toolbar = document.querySelector('.library-toolbar').getBoundingClientRect();
    if (sort.top < search.bottom || Math.abs(search.width - toolbar.width) > 1 || Math.abs(sort.width - toolbar.width) > 1) throw new Error('Recherche et tri doivent occuper deux lignes pleine largeur à 360 px.');
    const marker = document.getElementById('location');
    if (!marker.hidden || getComputedStyle(marker).display !== 'none' || document.title !== 'Accueil · Voti') throw new Error('Repère accueil redondant ou titre perdu.');
    const create = document.querySelector('.main-nav a[href="#new"]');
    if (create.innerText.trim() !== 'Créer' || create.getAttribute('aria-label') !== 'Nouveau sondage') throw new Error('Libellé mobile ou nom accessible incorrect.');
    const chips = document.querySelector('.filter-chips');
    if (getComputedStyle(chips).overflowX !== 'auto' || chips.tabIndex !== 0 || chips.scrollWidth <= chips.clientWidth) throw new Error('Filtres non défilables ou non accessibles au clavier.');
    return 8;
  })()`);
  await evaluate(sessionId, 'document.querySelector(".filter-chips").focus()');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, sessionId);
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, sessionId);
  await evaluate(sessionId, `(async () => {
    const chips = document.querySelector('.filter-chips');
    const deadline = performance.now() + 2000;
    while (chips.scrollLeft === 0 && performance.now() < deadline) await new Promise(requestAnimationFrame);
    if (chips.scrollLeft === 0) throw new Error('Défilement clavier des filtres indisponible.');
    chips.scrollLeft = 0;
  })()`);
  await evaluate(sessionId, 'document.querySelector(".main-nav a[href=\\\"#home\\\"]").focus()');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
  const keyboard = await evaluate(sessionId, 'document.activeElement.getAttribute("href") === "#new" && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 3');
  if (!keyboard) throw new Error('Navigation clavier ou focus visible manquant.');
  const contrastChecks = await evaluate(sessionId, `(() => {
    function luminance(color) {
      const hex = color.trim().replace('#','');
      const rgb = [0,2,4].map(index => parseInt(hex.slice(index,index+2),16)/255)
        .map(value => value <= .04045 ? value/12.92 : Math.pow((value+.055)/1.055,2.4));
      return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
    }
    let checks = 0;
    for (const mode of ['pop','nature','douceur','dark','minimal']) {
      document.documentElement.dataset.theme = mode;
      const style = getComputedStyle(document.documentElement);
      const read = key => luminance(style.getPropertyValue(key));
      for (const [a,b] of [['--ink','--surface'], ['--ink','--main'], ['--muted','--header'], ['--muted','--bg'], ['--accent','--surface'], ['--on-accent','--accent'], ['--on-accent','--secondary'], ['--positive','--main'], ['--draft-ink','--draft-bg'], ['--open-ink','--open-bg'], ['--closed-ink','--closed-bg'], ['--danger','--danger-bg']]) {
        const x=read(a),y=read(b),ratio=(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
        if (ratio<4.5) throw new Error('Contraste insuffisant : '+mode+' '+a+'/'+b+' '+ratio);
        checks++;
      }
      for (const background of ['--surface','--main','--header','--soft']) {
        const x=read('--focus'),y=read(background),ratio=(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
        if (ratio<3) throw new Error('Contraste focus insuffisant : '+mode+' '+background+' '+ratio);
        checks++;
      }
      const header = getComputedStyle(document.querySelector('.topbar')).backgroundColor;
      const main = getComputedStyle(document.querySelector('main')).backgroundColor;
      if (header === main || main === getComputedStyle(document.body).backgroundColor) throw new Error('Surfaces non distinctes : '+mode);
      if (getComputedStyle(document.querySelector('.main-nav a[href="#new"]')).outlineColor !== 'rgb('+style.getPropertyValue('--focus').trim().slice(1).match(/../g).map(x=>parseInt(x,16)).join(', ')+')') throw new Error('Focus hors palette : '+mode);
      if (![...document.querySelectorAll('.poll-row .badge:not(.context-badge)')].every(node => ['Brouillon','Ouvert','Fermé'].includes(node.textContent))) throw new Error('Badge sans texte : '+mode);
      if (![...document.querySelectorAll('.poll-row .context-badge')].every(node => node.textContent==='Local')) throw new Error('Contexte local absent : '+mode);
      checks += 4;
    }
    document.documentElement.dataset.theme = 'nature';
    return checks;
  })()`);
  let responsiveChecks = 0;
  for (const width of [360,480,768,1200]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 820, deviceScaleFactor: 1, mobile: width < 680 }, sessionId);
    responsiveChecks += await evaluate(sessionId, `(() => {
      for (const theme of ['pop','nature','douceur','dark','minimal']) {
        document.documentElement.dataset.theme = theme;
        if (document.documentElement.scrollWidth > innerWidth) throw new Error('Débordement '+theme+' à ${width}px.');
        const height = document.querySelector('.topbar').getBoundingClientRect().height;
        if (height > (${width} <= 680 ? 64 : 72)) throw new Error('Header trop haut.');
      }
      document.documentElement.dataset.theme = 'nature';
      return 10;
    })()`);
    if (width === 360 || width === 1200) {
      for (const theme of ['pop','nature','douceur','dark','minimal']) {
        await evaluate(sessionId, `(async () => { document.documentElement.dataset.theme=${JSON.stringify(theme)}; document.activeElement.blur(); window.scrollTo(0,0); await new Promise(requestAnimationFrame); })()`);
        const capture = await command('Page.captureScreenshot', { format:'png' }, sessionId);
        await writeFile(resolve(ROOT, `.browser-tests/ux-v0-2b-1-${theme}-${width}.png`), Buffer.from(capture.data,'base64'));
      }
      await evaluate(sessionId, 'document.documentElement.dataset.theme="nature"');
    }
  }
  await command('Emulation.setDeviceMetricsOverride', { width:360, height:740, deviceScaleFactor:1, mobile:true }, sessionId);
  await evaluate(sessionId, '(async () => { document.activeElement.blur(); window.scrollTo(0,0); await new Promise(requestAnimationFrame); })()');
  const mobileCapture = await command('Page.captureScreenshot', { format: 'png' }, sessionId);
  await writeFile(resolve(ROOT, '.browser-tests/ux-v0-2a-mobile.png'), Buffer.from(mobileCapture.data, 'base64'));
  await command('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  if (!await evaluate(sessionId, 'getComputedStyle(document.querySelector(".topbar")).display === "none"')) throw new Error('CSS impression non appliqué.');
  await command('Emulation.setEmulatedMedia', { media: '' }, sessionId);
  const offlineUrl = pathToFileURL(resolve(ROOT, 'index.html')).href;
  await command('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, sessionId);
  await navigateReady(sessionId, offlineUrl);
  if (!await evaluate(sessionId, 'document.documentElement.dataset.theme === "nature"')) throw new Error('Préférence de thème perdue au rechargement offline.');
  if (requests.some(item => /^https?:/.test(item))) throw new Error('Requête HTTP inattendue pendant les tests file://.');
  const fileAssetChecks = await evaluate(sessionId, `(${browserAssetScenario.toString()})()`);
  const qrChecks = {checks:await evaluate(sessionId, `(${browserQrScenario.toString()})()`)};
  for(const width of [320,360,1200]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500},sessionId);
    qrChecks.checks+=await evaluate(sessionId,`(${browserStudioScenario.toString()})()`);
  }
  qrChecks.checks+=await studioWorkspaceChecks(sessionId);
  await mkdir(resolve(ROOT,'.browser-tests/pdfs'),{recursive:true});
  const posterFiles=[];
  // La recette PDF coûteuse appartient à test:browser/test:poster ; pas trois
  // copies identiques dans les suites réseau, qui gardent tous leurs tests UI QR.
  const pdfFixtures=process.env.VOTI_TEST_RELAY==='1'||process.env.VOTI_TEST_FREE_PILOT==='1'?[]:[[2,false],[3,false],[6,false],[6,true]];
  for(const [n,long] of pdfFixtures) for(const mode of ['access','choices']) {
    const theme=['pop','nature','douceur','dark','minimal','pop','pop','nature'][posterFiles.length];
    const file=await evaluate(sessionId,`(${browserPosterScenario.toString()})(${n},${JSON.stringify(mode)},${long},${JSON.stringify(theme)})`);
    qrChecks.checks+=file.checks;
    await writeFile(resolve(ROOT,'.browser-tests/pdfs',file.name),Buffer.from(file.base64,'base64'));
    const {base64,...metadata}=file;posterFiles.push(metadata);
  }
  if(posterFiles.length) await writeFile(resolve(ROOT,'.browser-tests/pdfs/plans.json'),JSON.stringify(posterFiles));
  if(posterFiles.length) {
    const files=[];await mkdir(resolve(ROOT,'.browser-tests/studio-pdfs'),{recursive:true});
    for(const [index,layout] of ['essential','cards','magazine','mosaic'].entries())for(const mode of ['access','choices']){
      const file=await evaluate(sessionId,`(${browserStudioPdfScenario.toString()})(${JSON.stringify(layout)},${JSON.stringify(mode)},${[2,3,6,6][index]})`);
      const {base64,...metadata}=file;files.push(metadata);await writeFile(resolve(ROOT,'.browser-tests/studio-pdfs',file.name),Buffer.from(base64,'base64'));
    }
    for(const [style,n,long] of [['summary',2,false],['report',3,false],['summary',3,false],['summary',6,false],['report',6,true]]){
      const file=await evaluate(sessionId,`(${browserStudioPdfScenario.toString()})('cards',${JSON.stringify(style)},${n},'results',${long})`);
      const {base64,...metadata}=file;files.push(metadata);await writeFile(resolve(ROOT,'.browser-tests/studio-pdfs',file.name),Buffer.from(base64,'base64'));
    }
    await writeFile(resolve(ROOT,'.browser-tests/studio-pdfs/plans.json'),JSON.stringify(files));
    const polishFiles=[];await mkdir(resolve(ROOT,'.browser-tests/polish-pdfs'),{recursive:true});
    const cases=[
      ['cards','choices',3,'poster',{choicesPerRow:'3',densityPreset:'compact',qrSize:'small',qrSurfaceMode:'minimal',headerMode:'hidden',textSurfaceOpacity:.65,titleTypography:'handwritten',bodyTypography:'modern'}],
      ['cards','choices',3,'poster',{choicesPerRow:'2',densityPreset:'compact',qrSize:'small',qrSurfaceMode:'compact',headerMode:'discreet',textSurfaceOpacity:.85,titleTypography:'editorial',bodyTypography:'soft',palette:'night'}],
      ['essential','access',3,'poster',{choicesPerRow:'3',densityPreset:'compact',qrSize:'small',qrSurfaceMode:'minimal',headerMode:'hidden',textSurfaceOpacity:.65,titleTypography:'fantasy',bodyTypography:'display'}],
      ['magazine','choices',6,'poster',{densityPreset:'airy',qrSize:'large',qrSurfaceMode:'large',titleTypography:'display',bodyTypography:'editorial'}],
      ['mosaic','choices',6,'poster',{choicesPerRow:'3',qrSurfaceMode:'compact',textSurfaceOpacity:.65,titleTypography:'modern',bodyTypography:'modern'}],
      ['essential','choices',3,'poster',{choicesPerRow:'1',headerMode:'discreet',qrSurfaceMode:'minimal',textSurfaceOpacity:.65,titleTypography:'soft',bodyTypography:'soft'}],
      ['cards','report',6,'results',{headerMode:'hidden',titleTypography:'fantasy',bodyTypography:'display',customColors:{enabled:true,primary:'#ffff00',secondary:'#ffcc00',bg:'#202638'}}],
    ];
    for(const [layout,mode,n,kind,options] of cases){
      const file=await evaluate(sessionId,`(${browserStudioPdfScenario.toString()})(${JSON.stringify(layout)},${JSON.stringify(mode)},${n},${JSON.stringify(kind)},false,${JSON.stringify(options)})`);
      const {base64,...metadata}=file;polishFiles.push(metadata);await writeFile(resolve(ROOT,'.browser-tests/polish-pdfs',file.name),Buffer.from(base64,'base64'));
    }
    await writeFile(resolve(ROOT,'.browser-tests/polish-pdfs/plans.json'),JSON.stringify(polishFiles));
    const imageFiles=[];await mkdir(resolve(ROOT,'.browser-tests/image-pdfs'),{recursive:true});
    for(const [layout,mode,n,settings] of [
      ['cards','access',3,{ratio:'16:9',height:'large',align:'center',focalX:0,focalY:0}],
      ['essential','choices',3,{ratio:'original',height:'large',align:'left'}],
      ['mosaic','choices',6,{ratio:'1:1',height:'medium',align:'right',focalX:1,focalY:1}],
    ]){
      const options={imageSettings:{main:settings}};
      const file=await evaluate(sessionId,`(${browserStudioPdfScenario.toString()})(${JSON.stringify(layout)},${JSON.stringify(mode)},${n},'poster',false,${JSON.stringify(options)})`);
      const {base64,...metadata}=file;imageFiles.push(metadata);await writeFile(resolve(ROOT,'.browser-tests/image-pdfs',file.name),Buffer.from(base64,'base64'));
    }
    await writeFile(resolve(ROOT,'.browser-tests/image-pdfs/plans.json'),JSON.stringify(imageFiles));
  }
  await navigateReady(sessionId, offlineUrl);
  await evaluate(sessionId, `(async () => {
    const deadline = performance.now()+5000;
    while (!document.querySelector('.image-thumbnail img')?.naturalWidth && performance.now()<deadline) await new Promise(requestAnimationFrame);
    if (!document.querySelector('.image-thumbnail img')?.naturalWidth) throw new Error('Image IndexedDB perdue au rechargement offline.');
  })()`);

  await command('Network.emulateNetworkConditions', { offline: false, latency: 250, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
  await startDevServer();
  const servedUrl = 'http://127.0.0.1:4173/voti/';
  await navigateReady(sessionId, servedUrl);
  // Un véritable rendu navigateur au sous-chemin, avec latence réseau simulée.
  const smoke = await evaluate(sessionId, `(async () => {
    const app = document.getElementById('app');
    if (location.href !== ${JSON.stringify(servedUrl)}) throw new Error('Sous-chemin /voti/ incorrect.');
    if (localStorage.getItem('voti.local.v1') !== null) throw new Error('Écriture inattendue au chargement HTTP.');
    document.querySelector('.main-nav a[href="#new"]').click();
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
  const pointerTarget = await evaluate(sessionId, `(() => {
    const rect = document.querySelector('.main-nav a[href="#home"]').getBoundingClientRect();
    return { x:rect.x + rect.width/2, y:rect.y + rect.height/2 };
  })()`);
  await command('Input.dispatchMouseEvent', { type:'mousePressed', ...pointerTarget, button:'left', clickCount:1 }, sessionId);
  await command('Input.dispatchMouseEvent', { type:'mouseReleased', ...pointerTarget, button:'left', clickCount:1 }, sessionId);
  await evaluate(sessionId, `(${waitForApplication.toString()})(${JSON.stringify(servedUrl + '#home')})`);
  if (!await evaluate(sessionId, `(() => {
    const heading = document.querySelector('#app h1');
    return document.activeElement === heading && heading.dataset.focusOrigin === 'pointer' && getComputedStyle(heading).outlineStyle === 'none';
  })()`)) throw new Error('Navigation souris : focus de titre perdu ou encadrement superflu.');
  await evaluate(sessionId, 'document.querySelector(".main-nav a[href=\\\"#new\\\"]").focus()');
  await command('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 }, sessionId);
  await command('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 }, sessionId);
  await evaluate(sessionId, `(async () => {
    const deadline=performance.now()+5000;
    while (!document.querySelector('#app textarea') && performance.now()<deadline) await new Promise(requestAnimationFrame);
    const heading=document.querySelector('#app h1');
    if (!document.querySelector('#app textarea') || document.activeElement!==heading || heading.dataset.focusOrigin!=='keyboard' || parseFloat(getComputedStyle(heading).outlineWidth)<3) throw new Error('Navigation clavier : focus du titre non visible.');
  })()`);
  await evaluate(sessionId, `(async () => {
    document.getElementById('theme-toggle').click();
    const deadline=performance.now()+5000;
    while (document.querySelectorAll('.theme-option').length!==5 && performance.now()<deadline) await new Promise(requestAnimationFrame);
    if (document.querySelectorAll('.theme-option').length!==5 || document.documentElement.scrollWidth>innerWidth) throw new Error('Sélecteur de thèmes mobile incomplet ou débordant.');
    if ([...document.querySelectorAll('.theme-option')].some(node=>node.getBoundingClientRect().height<44 || !node.getAttribute('aria-label'))) throw new Error('Thèmes sans cible tactile ou nom accessible.');
  })()`);
  const appearanceCapture=await command('Page.captureScreenshot', { format:'png' }, sessionId);
  await writeFile(resolve(ROOT, '.browser-tests/ux-v0-2b-1-selector-360.png'), Buffer.from(appearanceCapture.data,'base64'));
  const httpAssetChecks = await evaluate(sessionId, `(${browserAssetScenario.toString()})()`);
  await evaluate(sessionId, '(async () => { document.activeElement.blur(); window.scrollTo(0,0); await new Promise(requestAnimationFrame); })()');
  const assetsCapture = await command('Page.captureScreenshot', { format:'png' }, sessionId);
  await writeFile(resolve(ROOT, '.browser-tests/ux-v0-2b-2-images-360.png'), Buffer.from(assetsCapture.data,'base64'));
  let relayChecks = 0;
  const graphicIds = await evaluate(sessionId, `(${graphicFixtures.toString()})()`);
  for (const width of [360,1200]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height:820, deviceScaleFactor:1, mobile:width===360 }, sessionId);
    for (const id of graphicIds) {
      await navigateReady(sessionId, servedUrl + '?graphic=' + crypto.randomUUID() + '#home');
      relayChecks += await evaluate(sessionId, `(${graphicChecks.toString()})(${JSON.stringify(id)},${width})`);
      const capture = await command('Page.captureScreenshot', { format:'png' }, sessionId);
      await writeFile(resolve(ROOT, `.browser-tests/v03b-images-${graphicIds.indexOf(id)}-${width}.png`), Buffer.from(capture.data,'base64'));
    }
  }
  if (process.env.VOTI_TEST_RELAY === '1' || process.env.VOTI_TEST_FREE_PILOT === '1') {
    let id = graphicIds[1];
    if (process.env.VOTI_TEST_FREE_PILOT === '1') {
      await navigateReady(sessionId, servedUrl + '?free-check=' + crypto.randomUUID() + '#poll/' + id);
      if (!await evaluate(sessionId, `document.getElementById('app').textContent.includes('Ce relais gratuit accepte uniquement les sondages sans images') && ![...document.querySelectorAll('#app button')].some(b=>b.textContent==='Publier en ligne') && !document.querySelector('.human-verification')`)) throw new Error('Pilote gratuit : publication illustrée doit être bloquée avant challenge.');
      relayChecks++;
      await navigateReady(sessionId, servedUrl + '?free-check=' + crypto.randomUUID() + '#edit/' + id);
      if (!await evaluate(sessionId, `Boolean(document.querySelector('#app input[type="file"]'))`)) throw new Error('Images locales désactivées par erreur.');
      relayChecks++;
      const textState = published(); id = textState.polls[0].id;
      await evaluate(sessionId, `localStorage.setItem('voti.local.v1', ${JSON.stringify(JSON.stringify(textState))})`);
      await navigateReady(sessionId, servedUrl + '?free=' + crypto.randomUUID() + '#poll/' + id);
    }
    relayChecks += await evaluate(sessionId, `(${remoteBrowserAction.toString()})('publish',${JSON.stringify(id)})`);
    // Parcours applicatif réel, pas seulement un composant monté en fixture.
    await navigateReady(sessionId,servedUrl+'?studio-route='+crypto.randomUUID()+'#poll/'+id);
    relayChecks+=await evaluate(sessionId,`(async()=>{
      const wait=async f=>{const end=performance.now()+15000;while(!f()){if(performance.now()>end)throw new Error('Route Studio non prête');await new Promise(requestAnimationFrame);}};
      const link=document.querySelector('#app a[href="#share/${id}"]');
      if(!link?.textContent.includes('QR & partager')||!link.querySelector('svg[aria-hidden="true"]')||link.getBoundingClientRect().height<44)throw new Error('Action QR peu explicite');link.click();
      await wait(()=>document.querySelector('.sharing-panel')&&document.getElementById('app').getAttribute('aria-busy')==='false');
      const button=document.querySelector('#app button[data-action="studio"]');button.click();
      await wait(()=>document.querySelector('.poster-studio')?.dataset.previewVersion);
      if(location.hash!=='#poster/${id}'||!document.querySelector('.studio-preview canvas')||document.querySelector('.human-verification'))throw new Error('Studio réel incorrect');return 4;
    })()`);
    if(await localBallotCount(id)!==0)throw new Error('Ouvrir le Studio crée un bulletin');relayChecks++;
    await navigateReady(sessionId,servedUrl+'?studio-back='+crypto.randomUUID()+'#poll/'+id);
    const context = await command('Target.createBrowserContext', { disposeOnDetach:true });
    const target = await command('Target.createTarget', { url:'about:blank', browserContextId:context.browserContextId });
    const voter = await command('Target.attachToTarget', { targetId:target.targetId, flatten:true });
    await command('Page.enable', {}, voter.sessionId); await command('Runtime.enable', {}, voter.sessionId);
    await command('Network.enable', {}, voter.sessionId);
    await command('Page.setLifecycleEventsEnabled', { enabled:true }, voter.sessionId);
    for (let n=0;n<5;n++) {
      if(n===0) {
        const poll=await (await fetch('http://127.0.0.1:8787/api/v1/polls/'+id)).json(), choiceId=poll.definition.choices[1].id;
        const choiceUrl=servedUrl+'?qr='+crypto.randomUUID()+'#/p/'+id+'/choice/'+choiceId;
        const voteRequests=()=>relayRequests.filter(r=>r.sessionId===voter.sessionId && r.method==='POST' && r.url.endsWith(`/polls/${id}/votes`)).length;
        const before=voteRequests();
        await navigateReady(voter.sessionId,choiceUrl);
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'preset')`);
        if(await localBallotCount(id)!==0 || voteRequests()!==before)throw new Error('QR au chargement crée un vote');relayChecks++;
        for(const width of [320,360,1200]){
          await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500},voter.sessionId);
          await evaluate(voter.sessionId,"document.querySelector('#app .primary').focus()");
          await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},voter.sessionId);
          await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},voter.sessionId);
          if(!await evaluate(voter.sessionId,"document.activeElement.textContent==='Autre choix' && getComputedStyle(document.activeElement).outlineStyle!=='none' && document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('#app button')].every(n=>n.getBoundingClientRect().height>=44)"))throw new Error('Confirmation QR non accessible '+width);relayChecks++;
        }
        if(await localBallotCount(id)!==0||voteRequests()!==before)throw new Error('Clavier/resize QR crée un vote');relayChecks++;
        await navigateReady(voter.sessionId,choiceUrl.replace('?qr=','?refresh='));
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'preset')`);
        if(await localBallotCount(id)!==0 || voteRequests()!==before)throw new Error('Refresh QR crée un vote');relayChecks++;
        await navigateReady(voter.sessionId,servedUrl+'?bad='+crypto.randomUUID()+'#/p/'+id+'/choice/invalide');
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},'', 'invalid')`);
        if(await localBallotCount(id)!==0)throw new Error('Choix QR invalide crée un vote');relayChecks++;
        await navigateReady(voter.sessionId,choiceUrl.replace('?qr=','?confirm='));
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'continue')`);
        if(await localBallotCount(id)!==0 || voteRequests()!==before)throw new Error('Continuer QR crée un vote');relayChecks++;
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'confirm')`);
        if(await localBallotCount(id)!==1 || voteRequests()!==before+1)throw new Error('Confirmation QR pas exactement un vote');relayChecks++;
      } else if(n===1) {
        const poll=await (await fetch('http://127.0.0.1:8787/api/v1/polls/'+id)).json(),choiceId=poll.definition.choices[1].id;
        const before=relayRequests.filter(r=>r.sessionId===voter.sessionId&&r.method==='POST'&&r.url.endsWith(`/polls/${id}/votes`)).length;
        await navigateReady(voter.sessionId,servedUrl+'?alternative='+crypto.randomUUID()+'#/p/'+id+'/choice/'+choiceId);
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'other')`);
        if(await localBallotCount(id)!==1)throw new Error('Autre choix crée un vote');relayChecks++;
        await navigateReady(voter.sessionId,servedUrl+'?normal='+crypto.randomUUID()+'#/p/'+id);
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'normal')`);
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'alternative')`);
        if(await localBallotCount(id)!==1||relayRequests.filter(r=>r.sessionId===voter.sessionId&&r.method==='POST'&&r.url.endsWith(`/polls/${id}/votes`)).length!==before)throw new Error('Choix alternatif crée un vote avant confirmation');relayChecks++;
        relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},${JSON.stringify(choiceId)},'confirm')`);
        if(await localBallotCount(id)!==2)throw new Error('Alternative confirmée ne crée pas exactement un vote');relayChecks++;
      } else {
        await navigateReady(voter.sessionId, servedUrl + '?visit=' + crypto.randomUUID() + '#/p/' + id);
        relayChecks += await evaluate(voter.sessionId, `(${remoteBrowserAction.toString()})('vote',${JSON.stringify(id)},${process.env.VOTI_TEST_FREE_PILOT !== '1'})`);
      }
      if(n===0) {
        await navigateReady(sessionId, servedUrl+'?visit='+crypto.randomUUID()+'#poll/'+id);
        relayChecks += await evaluate(sessionId, `(${remoteBrowserAction.toString()})('locked',${JSON.stringify(id)})`);
      }
      if(n===3||n===4) {
        await navigateReady(voter.sessionId, servedUrl+'?visit='+crypto.randomUUID()+'#/p/'+id+'/results');
        const text=await evaluate(voter.sessionId,'document.getElementById("app").textContent');
        if(n===3?!text.includes('ne sont pas encore disponibles'):!text.includes('5 réponses'))throw new Error('Seuil distant navigateur incorrect'); relayChecks++;
      }
    }
    await navigateReady(sessionId, servedUrl+'?visit='+crypto.randomUUID()+'#poll/'+id);
    const requestCount=(sid,method,suffix)=>relayRequests.filter(r=>r.sessionId===sid && r.method===method && r.url.endsWith(suffix)).length;
    const closeBefore=requestCount(sessionId,'POST',`/polls/${id}/close`);
    relayChecks += await evaluate(sessionId, `(${remoteBrowserAction.toString()})('closed-cancel',${JSON.stringify(id)})`);
    if(requestCount(sessionId,'POST',`/polls/${id}/close`)!==closeBefore)throw new Error('Fermeture annulée envoie une requête');relayChecks++;
    relayChecks += await evaluate(sessionId, `(${remoteBrowserAction.toString()})('closed',${JSON.stringify(id)})`);
    if(requestCount(sessionId,'POST',`/polls/${id}/close`)!==closeBefore+1)throw new Error('Fermeture confirmée : nombre de requêtes incorrect');relayChecks++;
    await command('Emulation.setDeviceMetricsOverride', { width:360, height:820, deviceScaleFactor:1, mobile:true }, voter.sessionId);
    await navigateReady(voter.sessionId, servedUrl+'?closed='+crypto.randomUUID()+'#/p/'+id);
    relayChecks += await evaluate(voter.sessionId, `(${remoteBrowserAction.toString()})('closed-public',${JSON.stringify(id)})`);
    const closedPoll=await (await fetch('http://127.0.0.1:8787/api/v1/polls/'+id)).json();
    await navigateReady(voter.sessionId,servedUrl+'?qr-closed='+crypto.randomUUID()+'#/p/'+id+'/choice/'+closedPoll.definition.choices[0].id);
    relayChecks+=await evaluate(voter.sessionId,`(${qrChoiceStage.toString()})(${JSON.stringify(id)},'', 'closed')`);
    if(await localBallotCount(id)!==5)throw new Error('QR fermé crée un bulletin');relayChecks++;
    const exported = await evaluate(sessionId, `(${browserKeyExport.toString()})()`); relayChecks += exported.checks;
    await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 820, deviceScaleFactor: 1, mobile: true }, voter.sessionId);
    const adminBefore=requestCount(voter.sessionId,'GET',`/polls/${id}/admin`);
    const mutationsBefore=relayRequests.filter(r=>r.sessionId===voter.sessionId && r.method!=='GET' && r.method!=='OPTIONS').length;
    relayChecks += await evaluate(voter.sessionId, `(${browserKeyImport.toString()})(${JSON.stringify(exported.key)})`);
    if(requestCount(voter.sessionId,'GET',`/polls/${id}/admin`)!==adminBefore+5 || relayRequests.filter(r=>r.sessionId===voter.sessionId && r.method!=='GET' && r.method!=='OPTIONS').length!==mutationsBefore)throw new Error('Import clé : vérification distante ou action unique incorrecte');relayChecks++;
    // Centre réel : destinations publiques canoniques, secret caché, 320/360 px.
    await navigateReady(sessionId,servedUrl+'?share='+crypto.randomUUID()+'#share/'+id);
    for(const width of [320,360,1200]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height:820,deviceScaleFactor:1,mobile:width<680},sessionId);
      if(!await evaluate(sessionId,`document.querySelectorAll('.qr-grid .qr-card').length===${closedPoll.definition.choices.length} && document.querySelector('.secret-qr').hidden && !document.querySelector('.secret-qr img') && document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('.qr-destination')].every(a=>a.href.startsWith('https://luuma8888.github.io/voti/#/p/'))`))throw new Error('Centre de partage incorrect');relayChecks++;
      if(!await evaluate(sessionId,"document.querySelectorAll('.share-shortcut').length===3 && document.querySelector('.secret-warning').textContent.includes('Ne le partage pas publiquement') && document.querySelector('.secret-warning svg').getAttribute('aria-hidden')==='true' && [...document.querySelectorAll('.share-shortcut')].every(b=>b.getBoundingClientRect().height>=44)"))throw new Error('Actions partage/avertissement secret incorrects');relayChecks++;
    }
    const shareCapture=await command('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(resolve(ROOT,'.browser-tests/v04a-sharing.png'),Buffer.from(shareCapture.data,'base64'));
    await navigateReady(sessionId,servedUrl+'?admin-back='+crypto.randomUUID()+'#poll/'+id);
    const transfers=await command('Target.createBrowserContext',{disposeOnDetach:true});
    const transferTarget=await command('Target.createTarget',{url:'about:blank',browserContextId:transfers.browserContextId});
    const transfer=await command('Target.attachToTarget',{targetId:transferTarget.targetId,flatten:true});
    for(const method of ['Page.enable','Runtime.enable','Network.enable'])await command(method,{},transfer.sessionId);
    await command('Page.setLifecycleEventsEnabled',{enabled:true},transfer.sessionId);
    await command('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {const f=window.fetch;window.fetch=function(...args){if(location.hash.includes('admin/import/'))throw new Error('Secret encore présent avant requête');return f.apply(this,args);};})()`},transfer.sessionId);
    const {encodeAdminPayload}=await import('../shared/qr-links.js');
    const clean=servedUrl+'?admin-init='+crypto.randomUUID()+'#admin-transfer';
    await navigateAndWait(command,events,transfer.sessionId,clean.replace('#admin-transfer','#/admin/import/'+encodeAdminPayload(exported.key)),15000,clean);
    await evaluate(transfer.sessionId,`(${waitForApplication.toString()})(${JSON.stringify(clean)})`);
    if(!await evaluate(transfer.sessionId,"location.hash==='#admin-transfer' && localStorage.getItem('voti.remote.v1')===null && document.getElementById('app').textContent.includes('Rien n’est importé automatiquement')"))throw new Error('Bootstrap admin secret non nettoyé');relayChecks++;
    for(const mode of ['cancel','invalid-payload','invalid-version','invalid-relay','invalid-structure','wrong-capability','wrong-poll','confirm']) {
      let key={...exported.key};
      if(mode==='invalid-version')key.version=2;
      if(mode==='invalid-relay')key.relayId='another-relay';
      if(mode==='invalid-structure')key.extra=true;
      if(mode==='wrong-capability')key.adminCapability='voti-admin-v1.'+'0'.repeat(64);
      if(mode==='wrong-poll')key.pollId='10000000-0000-4000-8000-000000000099';
      relayChecks+=await evaluate(transfer.sessionId,`(${adminQrScenario.toString()})(${JSON.stringify(key)},${JSON.stringify(mode)})`);
    }
    relayChecks+=await evaluate(transfer.sessionId,`(${adminQrScenario.toString()})(${JSON.stringify(exported.key)},'confirm')`); // même capacité déjà conservée
    await evaluate(transfer.sessionId,`(() => {const d=JSON.parse(localStorage.getItem('voti.remote.v1'));d.connections.find(c=>c.pollId===${JSON.stringify(id)}).adminCapability='voti-admin-v1.'+'1'.repeat(64);localStorage.setItem('voti.remote.v1',JSON.stringify(d));})()`);
    relayChecks+=await evaluate(transfer.sessionId,`(${adminQrScenario.toString()})(${JSON.stringify(exported.key)},'conflict-cancel')`);
    relayChecks+=await evaluate(transfer.sessionId,`(${adminQrScenario.toString()})(${JSON.stringify(exported.key)},'conflict-confirm')`);
    const deleteBefore=requestCount(sessionId,'DELETE',`/polls/${id}`);
    relayChecks += await evaluate(sessionId, `(${browserDelete.toString()})(${JSON.stringify(id)},true)`);
    if(requestCount(sessionId,'DELETE',`/polls/${id}`)!==deleteBefore)throw new Error('Suppression annulée envoie une requête');relayChecks++;
    relayChecks += await evaluate(sessionId, `(${browserDelete.toString()})(${JSON.stringify(id)})`);
    if(requestCount(sessionId,'DELETE',`/polls/${id}`)!==deleteBefore+1)throw new Error('Suppression confirmée : nombre de requêtes incorrect');relayChecks++;
    // browserDelete termine volontairement sur l'ancien lien public NOT_FOUND.
    // Relire l'accueil réel avant d'inspecter la copie locale conservée.
    await navigateReady(sessionId,servedUrl+'?deleted-copy='+crypto.randomUUID()+'#home');
    if(!await evaluate(sessionId,`document.querySelector('[data-poll-id="${id}"] .context-badge')?.textContent==='Copie locale · ancien lien supprimé'`))throw new Error('Copie supprimée sans contexte local clair');relayChecks++;
    for(const suffix of ['', '/results', '/choice/'+closedPoll.definition.choices[0].id]) {
      await navigateAndWait(command,events,voter.sessionId,servedUrl+'?deleted='+crypto.randomUUID()+'#/p/'+id+suffix);
      if(!await evaluate(voter.sessionId,`(async()=>{const end=performance.now()+10000;while(!document.getElementById('app')?.textContent.includes('Impossible d’ouvrir') || document.getElementById('app').getAttribute('aria-busy')!=='false'){if(performance.now()>end)throw new Error('Sondage supprimé QR non refusé');await new Promise(requestAnimationFrame);}return !document.querySelector('.vote-choices');})()`))throw new Error('QR supprimé permet un vote');relayChecks++;
    }
    relayChecks+=await evaluate(transfer.sessionId,`(${adminQrScenario.toString()})(${JSON.stringify(exported.key)},'deleted')`);
    if(await localBallotCount(id)!==0)throw new Error('Bulletins conservés après suppression');relayChecks++;
    if(relayRequests.some(r=>/voti-admin-v1\.|admin\/import/.test(new URL(r.url).pathname+new URL(r.url).search)))throw new Error('Secret dans URL HTTP');relayChecks++;
    await command('Target.disposeBrowserContext',{browserContextId:transfers.browserContextId});
    await command('Target.disposeBrowserContext', { browserContextId:context.browserContextId });
  }
  if (runtimeErrors.length) throw new Error(`${runtimeErrors.length} exceptions JavaScript navigateur.`);
  if (requests.some(item => /^https?:/.test(item) && !['http://127.0.0.1:4173', ...((process.env.VOTI_TEST_RELAY === '1' || process.env.VOTI_TEST_FREE_PILOT === '1') ? ['http://127.0.0.1:8787'] : [])].includes(new URL(item).origin))) throw new Error('Requête réseau externe inattendue.');
  console.log(`Navigateur Chromium : ${count + 13 + smoke + mobileChecks + contrastChecks + desktopNavigation + responsiveChecks + fileAssetChecks + httpAssetChecks + relayChecks + dialogChecks + qrChecks.checks} contrôles réussis (mode local, QR/PDF, dialogues, graphiques, images, thèmes, clavier, responsive, offline, /voti/${process.env.VOTI_TEST_RELAY ? ', HTTP multi-contextes' : ''}).`);
  }
} catch (error) {
  console.error(`Tests navigateur ÉCHEC : ${error.message}`); process.exitCode = 1;
  if (process.env.VOTI_TEST_RELAY && httpDiagnostics.length) console.error(JSON.stringify(httpDiagnostics.slice(-8)));
} finally {
  for (const task of pending.values()) { clearTimeout(task.timeout); task.reject(new Error('Fin du test')); }
  await Promise.all([stopChild(browser), stopChild(server)]);
}
