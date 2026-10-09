import { defaultRules, defaultStyle, THEMES } from '../shared/model.js';
import { createPoll, getPoll as localPoll, publishPoll, closePoll, castVote, updateSemantics, updateStyle } from '../shared/poll-engine.js';
import { getResults } from '../shared/result-rules.js';
import { exportBackup, restoreBackup, MAX_BACKUP_BYTES } from '../shared/backup.js';
import { LocalStorageAdapter, Repository, STORAGE_KEY } from './storage.js';
import { summarizePolls, queryPolls, STATUS_LABELS, FILTERS, SORTS } from './poll-library.js';
import { THEME_OPTIONS, THEME_KEY, normalizeTheme } from './themes.js';
import { IndexedDBAssetAdapter } from './asset-storage.js';
import { verifyDecodedAsset } from './image-processing.js';
import { ImageViews, imagePicker } from './image-ui.js';
import { HttpRelayAdapter } from './http-relay.js';
import { RELAY_CONFIG } from './relay-config.js';
import { RelayClient } from '../shared/relay-client.js';
import { LocalStorageRemoteConnectionAdapter, REMOTE_STORAGE_KEY } from './remote-storage.js';
import { assetReferences } from '../shared/assets.js';

const connections = new LocalStorageRemoteConnectionAdapter(localStorage, navigator.locks);
const relay = RELAY_CONFIG ? new RelayClient(new HttpRelayAdapter(RELAY_CONFIG), connections) : null;
let bindings = new Map();
const remoteViews = new Map();
let remoteImages = null;
let renderSequence = 0;
function getPoll(current, id) { return remoteViews.get(id) || localPoll(current, id); }
function activeImages() { return remoteImages || images; }
function mascot() { return el('img', null, { src: document.getElementById('brand-mascot').src, alt: '', width: '112', height: '101', class: 'mascot' }); }
function publicLink(id, results = false) { return `#/p/${id}${results ? '/results' : ''}`; }
function questionBlock(poll, staged) {
  const box = el('section', null, { class: 'question-block' });
  const title = app.querySelector(':scope > h1');
  if (title?.textContent === poll.definition.question) box.append(title);
  else box.append(el('h2', poll.definition.question));
  if (poll.definition.description) box.append(el('p', poll.definition.description));
  if (poll.definition.pollImageAssetId) box.append(activeImages().show(poll.definition.pollImageAssetId, { alt: 'Illustration du sondage', staged }));
  return box;
}
function choiceSummary(choices, staged) {
  const list = el('ul', null, { class: choices.some(c => c.imageRef) ? 'choice-summary illustrated' : 'choice-summary' });
  for (const choice of choices) {
    const item = el('li');
    if (choice.imageRef) item.append(activeImages().show(choice.imageRef, { size: 'choice', staged }));
    item.append(el('span', choice.label)); list.append(item);
  }
  return list;
}
async function remoteAction(node, operation, after = () => render()) {
  if (node.disabled) return; node.disabled = true; clearError();
  try { if (!relay) throw new Error('Relais non configuré. Aucun vote local de secours.'); await operation(); await after(); }
  catch (error) {
    if (error.code === 'REVISION_CONFLICT') { editor = null; await render(); showError(new Error('Le sondage a changé sur le relais. État rechargé ; vos modifications n’ont pas été écrasées ni renvoyées.')); }
    else showError(error);
    node.disabled = false;
  }
}
async function publishOnline(id) {
  if (!relay) throw new Error('Relais non configuré.');
  await repository.exclusive(async () => {
    const current = await repository.load(), poll = localPoll(current, id);
    if (current.ballots.some(b => b.pollId === id)) throw new Error('Publication en ligne impossible : ce sondage contient déjà des votes locaux.');
    const connection = await connections.get({ relayId: RELAY_CONFIG.relayId, pollId: id });
    if (!connection) await relay.preparePublication(current, id);
    // Une réponse de commit perdue se résout par une lecture, jamais une seconde histoire locale.
    try { await relay.getPoll(id); return; } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    await relay.uploadMissingAssets(id, [...assetReferences({ polls: [poll] }).keys()], assets);
    await relay.publishPoll(id);
  });
}

const app = document.getElementById('app');
const message = document.getElementById('message');
const notice = document.getElementById('notice');
const libraryView = { search: '', filter: 'all', sort: 'recent' };
const assets = new IndexedDBAssetAdapter();
const images = new ImageViews(assets);
let repository;
let state;
let editor = null;
let voteSession = null;
let route = '';
let focusOrigin = 'programmatic';
document.addEventListener('pointerdown', () => { focusOrigin = 'pointer'; }, true);
document.addEventListener('keydown', event => {
  if (!event.altKey && !event.ctrlKey && !event.metaKey) focusOrigin = 'keyboard';
}, true);

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault(); app.focus(); app.scrollIntoView({ block: 'start' });
});

/** Toute donnée utilisateur passe exclusivement par textContent/value. */
function el(tag, text, attributes = {}) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
function append(parent, ...children) { parent.append(...children); return parent; }
function button(label, onClick, className = '') {
  const node = el('button', label, { type: 'button', class: className });
  node.addEventListener('click', onClick);
  return node;
}
function link(label, hash, className = '') { return el('a', label, { href: hash, class: `button ${className}` }); }
function actions(...children) { return append(el('div', null, { class: 'actions' }), ...children); }
function showError(error) { message.textContent = error.message || String(error); message.hidden = false; }
function clearError() { message.textContent = ''; message.hidden = true; }
function notify(text) { notice.textContent = text; notice.hidden = !text; }
function heading(text) {
  const node = el('h1', text, { tabindex: '-1', 'data-navigation-focus': '', 'data-focus-origin': focusOrigin });
  app.append(node);
  queueMicrotask(() => node.focus());
}
function navigate(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}
function field(label, node, help = '') {
  const id = `field-${crypto.randomUUID()}`;
  node.id = id;
  const wrapper = append(el('div', null, { class: 'field' }), el('label', label, { for: id }), node);
  if (help) {
    const hint = el('span', help, { class: 'help', id: `${id}-help` });
    node.setAttribute('aria-describedby', hint.id);
    wrapper.append(hint);
  }
  return wrapper;
}
function download(raw, name) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const anchor = el('a', '', { href: url, download: name });
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function transact(node, operation, after = () => render(), staged = []) {
  if (node.disabled) return;
  node.disabled = true; clearError();
  try { state = await repository.transact(async current => {
    const id = location.hash.split('/')[1];
    if (id && (await connections.list()).some(c => c.pollId === id)) throw new Error('Ce sondage dépend du relais. Aucune écriture locale de vote ou de définition n’est permise.');
    return operation(current);
  }, staged); after(); if (repository.warning) notify(repository.warning); }
  catch (error) { showError(error); node.disabled = false; }
}

function home() {
  heading('Mes sondages');
  const title = app.lastElementChild;
  const entries = summarizePolls(state);
  for (const entry of entries) if (bindings.has(entry.id)) {
    const known = bindings.get(entry.id).lastKnownRemoteState;
    delete entry.responseCount;
    entry.available = known?.resultsAvailable || false;
    if (known) { entry.status = known.status; entry.statusLabel = STATUS_LABELS[known.status]; }
    entry.actions = [{ label: 'Résultats', href: publicLink(entry.id, true), primary: true }, { label: 'Gérer', href: `#poll/${entry.id}` }];
  }
  app.append(append(el('div', null, { class: 'library-heading' }), title, link('+ Nouveau sondage', '#new', 'primary new-poll')),
    el('p', `${entries.length} sondage${entries.length > 1 ? 's' : ''} · ${entries.filter(entry => entry.status === 'published').length} ouverts · ${entries.filter(entry => entry.available).length} résultats disponibles`, { class: 'library-summary' }));
  if (!entries.length) app.append(append(el('div', null, { class: 'empty-state empty-library' }),
    el('img', null, { src: document.getElementById('brand-mascot').src, alt: '', width: '88', height: '79', class: 'mascot' }),
    el('p', 'Votre premier sondage commence ici. Posez une question et proposez quelques choix.')));
  const toolbar = el('div', null, { class: 'library-toolbar' });
  const search = el('input', null, { type: 'search', placeholder: 'Rechercher un sondage…', autocomplete: 'off', 'data-testid': 'poll-search' });
  search.value = libraryView.search;
  const sort = el('select', null, { 'data-testid': 'poll-sort' });
  for (const [value, label] of SORTS) sort.append(el('option', label, { value }));
  sort.value = libraryView.sort;
  toolbar.append(field('Rechercher', search), field('Trier', sort));
  const filters = el('div', null, { class: 'filter-chips', role: 'group', 'aria-label': 'Filtrer les sondages', tabindex: '0' });
  const count = el('p', '', { class: 'help', role: 'status', 'aria-live': 'polite', 'data-testid': 'library-count' });
  const list = el('ul', null, { class: 'poll-list', 'aria-label': 'Sondages', 'data-testid': 'poll-list' });
  const filterButtons = [];
  function refreshList() {
    const visible = queryPolls(entries, libraryView);
    count.textContent = `${visible.length} sur ${entries.length} sondage${entries.length > 1 ? 's' : ''}`;
    for (const [value, node] of filterButtons) node.setAttribute('aria-pressed', String(libraryView.filter === value));
    list.replaceChildren();
    images.sweep();
    for (const entry of visible) {
      const item = el('li');
      const row = el('article', null, { class: 'poll-row', 'data-poll-id': entry.id, 'data-status': entry.status });
      const info = append(el('div', null, { class: 'poll-info' }), el('h2', entry.question));
      const metadata = append(el('div', null, { class: 'poll-meta' }),
        el('span', entry.statusLabel, { class: `badge status-${entry.status}` }),
        el('span', `${entry.choiceCount} choix`),
        el('time', new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }), { datetime: entry.createdAt }));
      if (Object.hasOwn(entry, 'responseCount')) metadata.append(el('span', `${entry.responseCount} réponses`));
      info.append(metadata, el('p', entry.available ? 'Résultats disponibles' : 'Résultats verrouillés', { class: `result-state ${entry.available ? 'available' : ''}` }));
      if (bindings.has(entry.id)) metadata.append(el('span', 'En ligne', { class: 'badge' }));
      const controls = actions(...entry.actions.map(action => {
        if (action.operation === 'publish') {
          const publish = button(action.label, () => transact(publish, current => publishPoll(current, entry.id)), 'primary');
          publish.setAttribute('aria-label', `Publier : ${entry.question}`);
          return publish;
        }
        const control = link(action.label, action.href, action.primary ? 'primary' : '');
        control.setAttribute('aria-label', `${action.label === 'Résultats 🔒' ? 'Résultats verrouillés' : action.label} : ${entry.question}`);
        return control;
      }));
      const poll = getPoll(state, entry.id);
      if (poll.definition.pollImageAssetId) row.append(images.show(poll.definition.pollImageAssetId, { size: 'thumbnail' }));
      row.append(info, controls); item.append(row); list.append(item);
    }
    if (entries.length && !visible.length) list.append(append(el('li', null, { class: 'empty-state' }),
      el('p', 'Aucun sondage ne correspond à cette recherche.'), button('Réinitialiser la recherche', () => {
        libraryView.search = ''; libraryView.filter = 'all'; search.value = ''; refreshList(); search.focus();
      })));
  }
  for (const [value, label] of FILTERS) {
    const chip = button(label, () => { libraryView.filter = value; refreshList(); });
    chip.dataset.filter = value; filterButtons.push([value, chip]); filters.append(chip);
  }
  search.addEventListener('input', () => { libraryView.search = search.value; refreshList(); });
  sort.addEventListener('change', () => { libraryView.sort = sort.value; refreshList(); });
  app.append(toolbar, filters, count, list);
  refreshList();
}

function backup() {
  heading('Sauvegarde & transfert');
  app.append(el('p', 'Gardez une copie de vos sondages sur votre appareil.', { class: 'muted' }));
  const panel = el('section', null, { class: 'card backup-panel' });
  const exportButton = button('Exporter une sauvegarde', async () => {
    if (exportButton.disabled) return;
    exportButton.disabled = true; clearError(); notify('');
    try {
      const raw = await repository.exclusive(async () => exportBackup(await repository.load(), assets));
      download(raw, 'voti-sauvegarde.json');
      notify('Le fichier est prêt. Vérifiez son enregistrement sur votre appareil.');
    } catch (error) { showError(error); }
    finally { exportButton.disabled = false; }
  }, 'primary');
  const input = el('input', null, { type: 'file', accept: '.json,application/json', 'aria-label': 'Choisir une sauvegarde à importer', hidden: '' });
  const importButton = button('Importer une sauvegarde', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    input.disabled = true; importButton.disabled = true; clearError(); notify('');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Fichier trop volumineux : 40 Mo maximum.');
      const raw = await file.text();
      state = await restoreBackup(repository, raw, verifyDecodedAsset);
      render();
      notify(repository.warning || 'Sauvegarde importée. Retrouvez vos sondages sur l’accueil.');
    } catch (error) { showError(error); input.disabled = false; importButton.disabled = false; input.value = ''; }
  });
  panel.append(actions(exportButton, importButton), input,
    el('p', 'La sauvegarde contient vos sondages et les bulletins. Conservez-la dans un endroit sûr : le stockage du navigateur peut être effacé.', { class: 'help' }),
    el('p', 'Pour importer, utilisez un navigateur sans sondage. Aucune donnée existante ne sera remplacée. Vous pouvez essayer dans un autre profil vide.', { class: 'help' }));
  const advanced = append(el('details', null, { class: 'advanced' }), el('summary', 'Options avancées'));
  const json = el('textarea', null, { readonly: '', rows: '12', 'aria-label': 'Données JSON de la sauvegarde', spellcheck: 'false' });
  advanced.append(el('p', 'Voir les données JSON · Outil technique. Ces données incluent les bulletins, même si les résultats sont verrouillés.', { class: 'help' }), json);
  advanced.addEventListener('toggle', async () => {
    if (!advanced.open) return;
    try { json.value = await repository.exclusive(async () => exportBackup(await repository.load(), assets)); } catch (error) { showError(error); }
  });
  app.append(panel, advanced, actions(link('Retour à l’accueil', '#home')));
  if (bindings.size) panel.append(el('p', 'Les votes en ligne et les capacités créateur ne sont pas inclus dans cette sauvegarde locale. Ne comptez pas sur ce fichier pour récupérer l’administration distante.', { class: 'help' }));
}

function statusLabel(poll) { return { draft: 'Brouillon', published: 'Vote ouvert', closed: 'Sondage fermé' }[poll.status]; }
function management(id) {
  const poll = getPoll(state, id);
  heading(poll.definition.question);
  const card = el('section', null, { class: 'card', 'data-accent': poll.style.themeId });
  card.append(questionBlock(poll));
  append(card, el('span', statusLabel(poll), { class: `badge status-${poll.status}` }),
    el('p', poll.lockedAt ? 'Le premier vote a verrouillé la question, les choix et les règles. Vous pouvez encore changer l’apparence.' : 'Vous pouvez modifier la question, les choix et les règles avant le premier vote.'),
    choiceSummary(poll.definition.choices));
  const controls = [];
  if (poll.status === 'draft') {
    const publish = button('Publier dans ce navigateur', () => transact(publish, current => publishPoll(current, id)), 'primary');
    controls.push(publish);
  }
  if (poll.status === 'published') {
    controls.push(link('Ouvrir le vote', `#vote/${id}`, 'primary'));
    const close = button('Fermer le sondage', () => {
      if (window.confirm('Fermer ce sondage ? Il n’acceptera plus de nouveaux votes. Le minimum de réponses restera obligatoire.')) {
        if (bindings.has(id)) remoteAction(close, () => relay.closePoll(id));
        else transact(close, current => closePoll(current, id));
      }
    }, 'danger');
    controls.push(close);
  }
  if (!poll.lockedAt && poll.status !== 'closed') controls.push(link('Modifier le sondage', `#edit/${id}`));
  controls.push(link('Modifier l’apparence', `#style/${id}`), link('Voir les résultats', `#results/${id}`), link('Mes sondages', '#home'));
  card.append(actions(...controls));
  if (bindings.has(id)) {
    const url = new URL(publicLink(id), location.href).href;
    const copy = button('Copier le lien', async () => { try { await navigator.clipboard.writeText(url); notify('Lien copié.'); } catch { notify(`Lien public : ${url}`); } });
    card.append(el('p', 'En ligne · Le relais fait autorité.'), actions(link('Ouvrir le lien public', publicLink(id), 'primary'), copy, link('Résultats', publicLink(id, true))));
  } else if (relay && poll.status === 'published') {
    if (state.ballots.some(b => b.pollId === id)) card.append(el('p', 'Publication en ligne impossible : ce sondage contient déjà des votes locaux.'));
    else {
      const online = button('Publier en ligne', () => remoteAction(online, () => publishOnline(id), async () => { await render(); notify('Publication en ligne réussie. Vous pouvez partager le lien public.'); }), 'primary');
      card.append(actions(online));
    }
  }
  app.append(card);
  app.append(el('p', bindings.has(id) ? 'Aucun nom demandé. Le relais peut voir les connexions réseau. Une personne peut voter plusieurs fois.' : 'Les autres appareils n’ont pas accès aux données de ce navigateur tant que le sondage n’est pas publié en ligne.', { class: 'help' }));
}

function makeEditor(id) {
  if (id) {
    const poll = getPoll(state, id);
    if (poll.lockedAt || poll.status === 'closed') throw new Error('Le fond de ce sondage ne peut plus être modifié.');
    return { id, step: 0, remoteRevision: poll.remoteRef?.revision, question: poll.definition.question, pollImageAssetId: poll.definition.pollImageAssetId, staged: new Map(), processing: 0,
      choices: structuredClone(poll.definition.choices), rules: structuredClone(poll.resultRules) };
  }
  return { id: null, step: 0, question: '', pollImageAssetId: null, staged: new Map(), processing: 0, choices: ['', ''].map(label => ({ id: crypto.randomUUID(), label, imageRef: null })), rules: defaultRules() };
}

function editorImage(owner, target, key, kind, label) {
  return imagePicker({ label, kind, getId: () => target[key], staged: owner.staged, views: activeImages(),
    change: asset => {
      target[key] = asset?.id || null;
      if (asset) owner.staged.set(asset.id, asset);
      const referenced = new Set([owner.pollImageAssetId, ...owner.choices.map(choice => choice.imageRef)]);
      for (const id of owner.staged.keys()) if (!referenced.has(id)) owner.staged.delete(id);
      clearError();
    }, busy: delta => { owner.processing += delta; }, active: () => editor === owner,
    error: showError });
}

function edit(id) {
  if (!editor || editor.id !== (id || null)) editor = makeEditor(id);
  const referenced = new Set([editor.pollImageAssetId, ...editor.choices.map(choice => choice.imageRef)]);
  for (const assetId of editor.staged.keys()) if (!referenced.has(assetId)) editor.staged.delete(assetId);
  heading(['Que veux-tu demander ?', 'Quelles réponses proposes-tu ?', 'Quand montrer les résultats ?', 'Tout est prêt ?'][editor.step]);
  app.append(el('p', `Étape ${editor.step + 1} sur 4 · Aucun nom demandé`, { class: 'step' }));
  const form = el('form', null, { class: 'card' });
  const step = editor.step;
  if (step === 0) {
    const input = el('textarea', null, { required: '', maxlength: '240', placeholder: 'Quel jeu choisit-on vendredi ?' });
    input.value = editor.question;
    input.addEventListener('input', () => { editor.question = input.value; });
    form.append(field('Ta question', input, 'Une question courte et claire, 240 caractères maximum.'));
    form.append(editorImage(editor, editor, 'pollImageAssetId', 'poll', 'Image du sondage'));
  } else if (step === 1) {
    const list = el('fieldset'); list.append(el('legend', 'Entre 2 et 6 réponses'));
    editor.choices.forEach((choice, index) => {
      const input = el('input', null, { required: '', maxlength: '100', type: 'text' });
      input.value = choice.label;
      input.addEventListener('input', () => { choice.label = input.value; });
      const row = append(el('div', null, { class: 'choice-row' }), field(`Réponse ${index + 1}`, input));
      const remove = button('Retirer', () => { editor.choices.splice(index, 1); render(); });
      remove.disabled = editor.choices.length <= 2;
      const up = button('↑', () => { [editor.choices[index - 1], editor.choices[index]] = [editor.choices[index], editor.choices[index - 1]]; render(); });
      up.setAttribute('aria-label', `Monter la réponse ${index + 1}`); up.disabled = index === 0;
      const down = button('↓', () => { [editor.choices[index + 1], editor.choices[index]] = [editor.choices[index], editor.choices[index + 1]]; render(); });
      down.setAttribute('aria-label', `Descendre la réponse ${index + 1}`); down.disabled = index === editor.choices.length - 1;
      row.append(editorImage(editor, choice, 'imageRef', 'choice', `Image de la réponse ${index + 1}`), append(el('div', null, { class: 'choice-controls' }), up, down, remove)); list.append(row);
    });
    form.append(list);
    const add = button('Ajouter une réponse', () => { editor.choices.push({ id: crypto.randomUUID(), label: '' }); render(); });
    add.disabled = editor.choices.length >= 6; form.append(add);
  } else if (step === 2) {
    const minimum = el('input', null, { type: 'number', min: '1', max: '100000', step: '1', required: '' });
    minimum.value = editor.rules.minimumResponses;
    minimum.addEventListener('input', () => { editor.rules.minimumResponses = Number(minimum.value); });
    const mode = el('select');
    mode.append(el('option', 'Dès que le minimum est atteint', { value: 'threshold' }), el('option', 'Après fermeture ET minimum atteint', { value: 'closed' }));
    mode.value = editor.rules.releaseMode;
    mode.addEventListener('change', () => { editor.rules.releaseMode = mode.value; });
    form.append(field('Nombre minimum de réponses', minimum), field('Afficher les résultats', mode),
      el('p', 'Le compteur reste masqué avant publication des résultats. Fermer le sondage ne supprime jamais le minimum requis.', { class: 'help' }));
  } else {
    form.append(questionBlock({ definition: { question: editor.question, pollImageAssetId: editor.pollImageAssetId } }, editor.staged), choiceSummary(editor.choices, editor.staged));
    form.append(el('p', `${editor.rules.minimumResponses} réponses minimum${editor.rules.releaseMode === 'closed' ? ' ET sondage fermé' : ''}.`),
      el('p', 'Aucun nom demandé. Ce prototype ne garantit pas le secret contre l’inspection du stockage de l’appareil.', { class: 'help' }));
  }
  const submit = el('button', step === 3 ? (id ? 'Enregistrer les modifications' : 'Créer le brouillon') : 'Continuer', { type: 'submit', class: 'primary' });
  const back = button('Retour', () => { editor.step--; render(); });
  back.disabled = step === 0;
  form.append(actions(back, submit, link('Annuler', id ? `#poll/${id}` : '#home')));
  let submitting = false;
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submitting) return;
    if (editor.processing) return showError(new Error('Attends la fin de la préparation des images avant de continuer.'));
    if (step === 0 && !editor.question.trim()) return showError(new Error('Écris une question avant de continuer.'));
    if (step === 1 && editor.choices.some(choice => !choice.label.trim())) return showError(new Error('Chaque réponse doit contenir un texte.'));
    if (step === 2 && (!Number.isInteger(editor.rules.minimumResponses) || editor.rules.minimumResponses < 1)) return showError(new Error('Choisis un nombre entier positif.'));
    clearError();
    if (step < 3) { editor.step++; render(); return; }
    submitting = true;
    const snapshot = structuredClone(editor);
    if (id && bindings.has(id)) {
      const original = getPoll(state, id);
      const definition = { ...original.definition, question: snapshot.question.trim(), pollImageAssetId: snapshot.pollImageAssetId,
        choices: snapshot.choices.map((choice, order) => ({ id: choice.id, label: choice.label.trim(), shortLabel: choice.shortLabel || null,
          emoji: choice.emoji || null, imageRef: choice.imageRef || null, order })) };
      await remoteAction(submit, async () => {
        const refs = [...assetReferences({ polls: [{ definition }] }).keys()];
        await relay.uploadMissingAssets(id, refs, { get: assetId => snapshot.staged.get(assetId) || activeImages().adapter.get(assetId) }, snapshot.remoteRevision);
        await relay.updateDefinition(id, definition, snapshot.rules);
      }, () => { editor = null; navigate(`#poll/${id}`); });
      submitting = false; return;
    }
    await transact(submit, current => {
      if (!id) return createPoll(current, { question: snapshot.question.trim(), choices: snapshot.choices.map(choice => choice.label.trim()), resultRules: snapshot.rules,
        pollImageAssetId: snapshot.pollImageAssetId, choiceImageRefs: snapshot.choices.map(choice => choice.imageRef) });
      const original = getPoll(current, id);
      const definition = { ...original.definition, question: snapshot.question.trim(), pollImageAssetId: snapshot.pollImageAssetId, choices: snapshot.choices.map((choice, order) => ({
        id: choice.id, label: choice.label.trim(), shortLabel: choice.shortLabel || null, emoji: choice.emoji || null, imageRef: choice.imageRef || null, order })) };
      return updateSemantics(current, id, definition, snapshot.rules);
    }, () => { editor = null; navigate(`#poll/${id || state.polls.at(-1).id}`); }, [...snapshot.staged.values()]);
    submitting = false;
  });
  app.append(form);
}

function vote(id) {
  const poll = getPoll(state, id);
  heading(poll.definition.question);
  if (poll.status !== 'published') {
    app.append(el('p', poll.status === 'draft' ? 'Le vote n’est pas encore ouvert.' : 'Ce sondage est fermé.'), actions(link('Retour', `#poll/${id}`)));
    return;
  }
  const card = el('section', null, { class: 'card', 'data-accent': poll.style.themeId });
  card.append(questionBlock(poll));
  if (voteSession?.pollId === id) {
    const choice = poll.definition.choices.find(item => item.id === voteSession.choiceId);
    if (!choice) { voteSession = null; vote(id); return; }
    card.append(el('p', 'Tu choisis :'), el('p', choice.label, { class: 'confirmation' }));
    if (choice.imageRef) card.append(activeImages().show(choice.imageRef, { size: 'choice' }));
    const action = structuredClone(voteSession);
    let submitted = false;
    const confirm = button('Oui, je confirme', async () => {
      if (submitted) return;
      submitted = true;
      const success = () => {
        voteSession = null;
        app.replaceChildren(); heading('Merci !');
        images.sweep();
        app.append(append(el('section', null, { class: 'card vote-success' }), mascot(), el('span', '✓', { class: 'success-icon', 'aria-hidden': 'true' }),
          el('p', 'Ton vote a bien été enregistré.'), actions(link('Revenir à mes sondages', '#home'), link('Résultats', `#results/${id}`))));
      };
      if (remoteViews.has(id)) await remoteAction(confirm, () => relay.castVote(id, action.choiceId, action.id), success);
      else await transact(confirm, current => castVote(current, action), success);
      if (!confirm.disabled) submitted = false;
    }, 'primary');
    const back = button('Retour aux choix', () => { voteSession = null; render(); });
    card.append(actions(confirm, back));
  } else {
    const form = el('form');
    const options = el('fieldset', null, { class: `vote-choices ${poll.definition.choices.some(c => c.imageRef) ? 'illustrated' : ''}` }); options.append(el('legend', 'Choisis une réponse'));
    for (const choice of poll.definition.choices) {
      const input = el('input', null, { type: 'radio', name: 'choice', value: choice.id, required: '' });
      const label = append(el('label', null, { class: 'vote-choice' }), input, el('span', choice.label));
      if (choice.imageRef) label.append(activeImages().show(choice.imageRef, { size: 'choice' }));
      options.append(label);
    }
    const next = el('button', 'Continuer', { type: 'submit', class: 'primary' });
    form.append(options, actions(next, link('Retour', '#home')));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const choiceId = new FormData(form).get('choice');
      if (!choiceId) return;
      voteSession = { id: crypto.randomUUID(), pollId: id, choiceId };
      render();
    });
    card.append(form);
  }
  app.append(card);
}

function results(id) {
  const poll = getPoll(state, id);
  const result = remoteViews.get(id)?.results || getResults(state, id);
  heading('Les résultats');
  const card = append(el('section', null, { class: 'card', 'data-accent': poll.style.themeId }), el('h2', poll.definition.question));
  card.append(el('span', STATUS_LABELS[poll.status], { class: `badge status-${poll.status}` }));
  if (!result.available) {
    card.append(el('p', 'Les résultats ne sont pas encore disponibles.'),
      el('p', `Ils apparaîtront à partir de ${result.minimumResponses} réponses${result.releaseMode === 'closed' ? ', une fois le sondage fermé' : ''}.`, { class: 'muted' }));
    if (Object.hasOwn(result, 'totalBallots')) card.append(el('p', `${result.totalBallots} réponses reçues.`));
  } else {
    card.append(el('p', `${result.totalBallots} réponses`));
    for (const choice of result.choices) {
      const row = el('div', null, { class: 'result-row' });
      const percentage = choice.percentage.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
      row.append(append(el('p'), el('span', choice.label), el('span', `${choice.count} · ${percentage} %`)),
        el('progress', `${percentage} %`, { value: choice.count, max: result.totalBallots, 'aria-label': `${choice.label} : ${choice.count} votes, ${percentage} pour cent` }));
      card.append(row);
    }
  }
  card.append(actions(...(bindings.get(id)?.adminCapability || !remoteViews.has(id) ? [link('Gérer le sondage', `#poll/${id}`)] : []), link('Mes sondages', '#home')));
  app.append(card);
}

function style(id) {
  const poll = getPoll(state, id);
  heading('Modifier l’apparence');
  const card = el('section', null, { class: 'card', 'data-accent': poll.style.themeId });
  card.append(el('h2', poll.definition.question), el('p', 'Le thème change la présentation. La question, les choix et les règles restent identiques.', { class: 'help' }));
  const select = el('select');
  const names = { mint: 'Menthe', lavender: 'Lavande', peach: 'Pêche' };
  for (const theme of THEMES) select.append(el('option', names[theme], { value: theme }));
  select.value = poll.style.themeId;
  select.addEventListener('change', () => { card.dataset.accent = select.value; });
  const save = button('Enregistrer l’apparence', () => bindings.has(id)
    ? remoteAction(save, () => relay.updateStyle(id, { ...defaultStyle(), themeId: select.value }), () => navigate(`#poll/${id}`))
    : transact(save, current => updateStyle(current, id, { ...defaultStyle(), themeId: select.value }), () => navigate(`#poll/${id}`)), 'primary');
  card.append(field('Accent du sondage', select), el('p', 'Ces accents restent propres au sondage. Le thème de Voti se choisit dans le header.', { class: 'help' }), actions(save, link('Retour', `#poll/${id}`))); app.append(card);
}

function appearance() {
  heading('L’apparence de Voti');
  app.append(el('p', 'Choisis ton ambiance. Les sondages et les votes ne changent pas.', { class: 'muted' }));
  const choices = el('div', null, { class: 'theme-options', role: 'group', 'aria-label': 'Thème de Voti' });
  for (const theme of THEME_OPTIONS) {
    const selected = document.documentElement.dataset.theme === theme.id;
    const option = button('', () => {
      setTheme(theme.id);
      try { localStorage.setItem(THEME_KEY, theme.id); }
      catch { notify('Le thème est appliqué, mais ce navigateur ne peut pas conserver cette préférence.'); }
      for (const control of choices.children) {
        const active = control.dataset.theme === theme.id;
        control.setAttribute('aria-pressed', String(active));
        control.querySelector('.theme-selection').textContent = active ? 'Sélectionné ✓' : 'Choisir';
      }
    }, 'theme-option');
    option.dataset.theme = theme.id;
    option.setAttribute('aria-pressed', String(selected));
    option.setAttribute('aria-label', theme.name);
    const preview = el('span', null, { class: 'theme-preview', 'aria-hidden': 'true' });
    for (const tone of ['accent', 'secondary', 'warm', 'peach', 'positive']) preview.append(el('span', null, { class: `swatch swatch-${tone}` }));
    option.append(preview, el('strong', theme.name), el('span', theme.description, { class: 'theme-description' }),
      el('span', selected ? 'Sélectionné ✓' : 'Choisir', { class: 'theme-selection' }));
    choices.append(option);
  }
  app.append(choices, actions(link('Retour à l’accueil', '#home')));
}

async function render() {
  if (!state) return;
  const sequence = ++renderSequence;
  app.setAttribute('aria-busy', 'true');
  app.replaceChildren();
  images.sweep();
  const nextRoute = location.hash || '#home';
  if (nextRoute !== route) { editor = null; voteSession = null; clearError(); notify(''); route = nextRoute; }
  try {
    const [view, id, extra] = nextRoute.replace(/^#\//, '#').slice(1).split('/');
    bindings = new Map(connections.read().connections.map(c => [c.pollId, c]));
    if (sequence !== renderSequence) return;
    remoteImages?.sweep(); remoteImages = null;
    const distant = view === 'p' || (id && bindings.has(id));
    if (distant && ['poll', 'edit', 'style'].includes(view) && !bindings.get(id)?.adminCapability) throw new Error('La capacité créateur est nécessaire pour gérer ce sondage.');
    if (distant) {
      if (!relay || (bindings.has(id) && bindings.get(id).relayId !== RELAY_CONFIG.relayId)) throw new Error('Relais non configuré ou indisponible. Aucun vote local de secours.');
      try {
        const value = await relay.getPoll(id);
        if (sequence !== renderSequence) return;
        remoteViews.set(id, { ...value, id, lockedAt: value.locked ? 'remote' : null });
        bindings = new Map((await connections.list()).map(c => [c.pollId, c]));
        remoteImages = new ImageViews({ get: assetId => relay.getAsset(id, assetId) });
      } catch (error) {
        if (error.code === 'NOT_FOUND' && view === 'poll' && bindings.get(id)?.adminCapability && state.polls.some(p => p.id === id)) {
          heading('Publication en attente');
          const resume = button('Reprendre la publication', () => remoteAction(resume, () => publishOnline(id)));
          const discard = button('Abandonner la préparation', () => remoteAction(discard, () => relay.discardPublication(id)), 'danger');
          app.append(el('p', 'Aucun vote local ne sera ajouté pendant cette préparation.'), actions(resume, discard)); return;
        }
        throw error;
      }
    } else if (id) remoteViews.delete(id);
    const locations = { home: 'Accueil', new: 'Nouveau sondage', backup: 'Sauvegarde', appearance: 'Apparence de Voti', poll: 'Sondage · Gestion', edit: 'Sondage · Modification', vote: 'Sondage · Vote', results: 'Sondage · Résultats', style: 'Sondage · Apparence' };
    const pageMarker = document.getElementById('location');
    pageMarker.textContent = view === 'p' ? (extra === 'results' ? 'Sondage · Résultats en ligne' : 'Sondage · Vote en ligne') : locations[view] || 'Page locale';
    pageMarker.hidden = view === 'home' && !id;
    for (const node of document.querySelectorAll('.main-nav a')) {
      if (node.getAttribute('href') === `#${view}`) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    }
    document.title = `${locations[view] || 'Voti'} · Voti`;
    if (view === 'p' && (!extra || extra === 'results')) { document.title = `${pageMarker.textContent} · Voti`; if (extra) results(id); else vote(id); return; }
    if (extra) throw new Error('Ce lien local n’est pas reconnu.');
    if (view === 'home' && !id) home();
    else if (view === 'backup' && !id) backup();
    else if (view === 'appearance' && !id) appearance();
    else if (view === 'new' && !id) edit();
    else if (view === 'poll' && id) management(id);
    else if (view === 'edit' && id) edit(id);
    else if (view === 'vote' && id) vote(id);
    else if (view === 'results' && id) results(id);
    else if (view === 'style' && id) style(id);
    else throw new Error('Ce lien local n’est pas reconnu.');
  } catch (error) { app.replaceChildren(); heading('Impossible d’ouvrir cette page'); app.append(el('p', error.message), actions(link('Accueil', '#home'))); }
  finally { if (sequence === renderSequence) app.setAttribute('aria-busy', 'false'); }
}

const themeToggle = document.getElementById('theme-toggle');
function setTheme(theme) {
  document.documentElement.dataset.theme = normalizeTheme(theme);
  const active = THEME_OPTIONS.find(item => item.id === document.documentElement.dataset.theme);
  themeToggle.textContent = 'Thème';
  themeToggle.setAttribute('aria-label', `Choisir le thème de Voti : ${active.name}`);
}
try { setTheme(localStorage.getItem(THEME_KEY)); } catch { setTheme('pop'); }
themeToggle.addEventListener('click', () => navigate('#appearance'));

try {
  repository = new Repository(new LocalStorageAdapter(localStorage), navigator.locks, assets);
  state = await repository.load();
  render();
  repository.recoverAssets().catch(error => notify(`Les sondages restent accessibles. ${error.message}`));
} catch (error) {
  app.replaceChildren(); heading('Données locales indisponibles');
  app.append(el('p', 'Aucune donnée n’a été remplacée. Vérifiez les permissions du navigateur ou conservez le fichier brut avant une réparation.'));
  const recover = button('Récupérer le stockage brut', () => {
    try { download(localStorage.getItem(STORAGE_KEY) || '{}', 'voti-recuperation-non-validee.json'); } catch (failure) { showError(failure); }
  });
  app.append(actions(recover)); showError(error);
}
window.addEventListener('hashchange', render);
window.addEventListener('storage', async event => {
  if (event.key === REMOTE_STORAGE_KEY) { render(); return; }
  if (event.key !== STORAGE_KEY) return;
  try { state = await repository.load(); editor = null; voteSession = null; render(); }
  catch (error) { state = null; app.replaceChildren(el('p', 'Données modifiées dans un autre onglet : rechargez pour vérifier le stockage.')); showError(error); }
});
