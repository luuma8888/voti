import { defaultRules, defaultStyle, THEMES } from '../shared/model.js';
import { createPoll, getPoll, publishPoll, closePoll, castVote, updateSemantics, updateStyle } from '../shared/poll-engine.js';
import { getResults } from '../shared/result-rules.js';
import { importIntoEmpty, serialize } from '../shared/serialization.js';
import { MAX_JSON_LENGTH } from '../shared/model.js';
import { LocalStorageAdapter, Repository, STORAGE_KEY } from './storage.js';

const app = document.getElementById('app');
const message = document.getElementById('message');
let repository;
let state;
let editor = null;
let voteSession = null;
let route = '';

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
function heading(text) {
  const node = el('h1', text, { tabindex: '-1' });
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
async function transact(node, operation, after = () => render()) {
  if (node.disabled) return;
  node.disabled = true; clearError();
  try { state = await repository.transact(operation); after(); }
  catch (error) { showError(error); node.disabled = false; }
}

function home() {
  heading('Et si on choisissait ensemble ?');
  app.append(el('p', 'Une question, quelques choix, puis à chacun de voter.', { class: 'muted' }),
    actions(link('Créer un sondage', '#new', 'primary')));
  app.append(el('h2', 'Mes sondages'));
  if (!state.polls.length) app.append(el('p', 'Votre premier sondage commence ici. Aucun exemple n’est ajouté automatiquement.', { class: 'muted' }));
  const grid = el('div', null, { class: 'grid' });
  for (const poll of state.polls) {
    const card = el('article', null, { class: 'card', 'data-accent': poll.style.themeId });
    append(card, el('span', statusLabel(poll), { class: 'badge' }), el('h3', poll.definition.question),
      el('p', poll.lockedAt ? 'Fond verrouillé après le premier vote.' : 'Fond encore modifiable.', { class: 'help' }),
      actions(link('Gérer', `#poll/${poll.id}`), ...(poll.status === 'published' ? [link('Voter', `#vote/${poll.id}`, 'primary')] : [])));
    grid.append(card);
  }
  app.append(grid);
  const exportButton = button('Exporter mes données JSON', async () => {
    try { download(await serialize(state), 'voti-prototype.json'); } catch (error) { showError(error); }
  });
  const input = el('input', null, { type: 'file', accept: '.json,application/json', 'aria-label': 'Choisir une sauvegarde JSON à importer' });
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    input.disabled = true; clearError();
    try {
      if (file.size > MAX_JSON_LENGTH) throw new Error('Fichier trop volumineux pour le prototype.');
      const raw = await file.text();
      state = await repository.transact(current => importIntoEmpty(current, raw));
      render();
    } catch (error) { showError(error); input.disabled = false; input.value = ''; }
  });
  app.append(append(el('section', null, { class: 'card import-box' }), el('h2', 'Garder une copie'),
    el('p', 'L’export contient les sondages et les bulletins. Conservez-le dans un emplacement sûr. L’import nécessite un navigateur sans sondage ; rien ne sera remplacé.', { class: 'help' }),
    actions(exportButton), field('Importer un JSON de prototype', input)));
}

function statusLabel(poll) { return { draft: 'Brouillon', published: 'Vote ouvert', closed: 'Sondage fermé' }[poll.status]; }
function management(id) {
  const poll = getPoll(state, id);
  heading(poll.definition.question);
  const card = el('section', null, { class: 'card', 'data-accent': poll.style.themeId });
  append(card, el('span', statusLabel(poll), { class: 'badge' }),
    el('p', poll.lockedAt ? 'Le premier vote a verrouillé la question, les choix et les règles. Vous pouvez encore changer l’apparence.' : 'Vous pouvez modifier la question, les choix et les règles avant le premier vote.'),
    el('ul'));
  for (const choice of poll.definition.choices) card.lastChild.append(el('li', choice.label));
  const controls = [];
  if (poll.status === 'draft') {
    const publish = button('Publier dans ce navigateur', () => transact(publish, current => publishPoll(current, id)), 'primary');
    controls.push(publish);
  }
  if (poll.status === 'published') {
    controls.push(link('Ouvrir le vote', `#vote/${id}`, 'primary'));
    const close = button('Fermer le sondage', () => {
      if (window.confirm('Fermer ce sondage ? Il n’acceptera plus de nouveaux votes. Le minimum de réponses restera obligatoire.')) transact(close, current => closePoll(current, id));
    }, 'danger');
    controls.push(close);
  }
  if (!poll.lockedAt && poll.status !== 'closed') controls.push(link('Modifier le sondage', `#edit/${id}`));
  controls.push(link('Modifier l’apparence', `#style/${id}`), link('Voir les résultats', `#results/${id}`), link('Mes sondages', '#home'));
  card.append(actions(...controls));
  app.append(card);
  app.append(el('p', 'Les autres appareils n’ont pas accès aux données de ce navigateur. Aucun QR de vote partagé n’est disponible dans cette version.', { class: 'help' }));
}

function makeEditor(id) {
  if (id) {
    const poll = getPoll(state, id);
    if (poll.lockedAt || poll.status === 'closed') throw new Error('Le fond de ce sondage ne peut plus être modifié.');
    return { id, step: 0, question: poll.definition.question,
      choices: structuredClone(poll.definition.choices), rules: structuredClone(poll.resultRules) };
  }
  return { id: null, step: 0, question: '', choices: ['', ''].map(label => ({ id: crypto.randomUUID(), label })), rules: defaultRules() };
}

function edit(id) {
  if (!editor || editor.id !== (id || null)) editor = makeEditor(id);
  heading(['Que veux-tu demander ?', 'Quelles réponses proposes-tu ?', 'Quand montrer les résultats ?', 'Tout est prêt ?'][editor.step]);
  app.append(el('p', `Étape ${editor.step + 1} sur 4 · Aucun nom demandé`, { class: 'step' }));
  const form = el('form', null, { class: 'card' });
  const step = editor.step;
  if (step === 0) {
    const input = el('textarea', null, { required: '', maxlength: '240', placeholder: 'Quel jeu choisit-on vendredi ?' });
    input.value = editor.question;
    input.addEventListener('input', () => { editor.question = input.value; });
    form.append(field('Ta question', input, 'Une question courte et claire, 240 caractères maximum.'));
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
      row.append(append(el('div', null, { class: 'choice-controls' }), up, down, remove)); list.append(row);
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
    form.append(el('h2', editor.question), el('ul'));
    for (const choice of editor.choices) form.lastChild.append(el('li', choice.label));
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
    if (step === 0 && !editor.question.trim()) return showError(new Error('Écris une question avant de continuer.'));
    if (step === 1 && editor.choices.some(choice => !choice.label.trim())) return showError(new Error('Chaque réponse doit contenir un texte.'));
    if (step === 2 && (!Number.isInteger(editor.rules.minimumResponses) || editor.rules.minimumResponses < 1)) return showError(new Error('Choisis un nombre entier positif.'));
    clearError();
    if (step < 3) { editor.step++; render(); return; }
    submitting = true;
    const snapshot = structuredClone(editor);
    await transact(submit, current => {
      if (!id) return createPoll(current, { question: snapshot.question.trim(), choices: snapshot.choices.map(choice => choice.label.trim()), resultRules: snapshot.rules });
      const original = getPoll(current, id);
      const definition = { ...original.definition, question: snapshot.question.trim(), choices: snapshot.choices.map((choice, order) => ({
        id: choice.id, label: choice.label.trim(), shortLabel: choice.shortLabel || null, emoji: choice.emoji || null, imageRef: null, order })) };
      return updateSemantics(current, id, definition, snapshot.rules);
    }, () => { editor = null; navigate(`#poll/${id || state.polls.at(-1).id}`); });
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
  if (voteSession?.pollId === id) {
    const choice = poll.definition.choices.find(item => item.id === voteSession.choiceId);
    if (!choice) { voteSession = null; vote(id); return; }
    card.append(el('p', 'Tu choisis :'), el('p', choice.label, { class: 'confirmation' }));
    const action = structuredClone(voteSession);
    let submitted = false;
    const confirm = button('Oui, je confirme', async () => {
      if (submitted) return;
      submitted = true;
      await transact(confirm, current => castVote(current, action), () => {
        voteSession = null;
        app.replaceChildren(); heading('Merci !');
        app.append(append(el('section', null, { class: 'card' }), el('span', '✓', { class: 'success-icon', 'aria-hidden': 'true' }),
          el('p', 'Ton vote a bien été enregistré.'), actions(link('Revenir à mes sondages', '#home'), link('Résultats', `#results/${id}`))));
      });
      if (!confirm.disabled) submitted = false;
    }, 'primary');
    const back = button('Retour aux choix', () => { voteSession = null; render(); });
    card.append(actions(confirm, back));
  } else {
    const form = el('form');
    const options = el('fieldset', null, { class: 'vote-choices' }); options.append(el('legend', 'Choisis une réponse'));
    for (const choice of poll.definition.choices) {
      const input = el('input', null, { type: 'radio', name: 'choice', value: choice.id, required: '' });
      const label = append(el('label', null, { class: 'vote-choice' }), input, el('span', choice.label));
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
  const result = getResults(state, id);
  heading('Les résultats');
  const card = append(el('section', null, { class: 'card', 'data-accent': poll.style.themeId }), el('h2', poll.definition.question));
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
  card.append(actions(link('Gérer le sondage', `#poll/${id}`), link('Mes sondages', '#home')));
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
  const save = button('Enregistrer l’apparence', () => transact(save, current => updateStyle(current, id, { ...defaultStyle(), themeId: select.value }), () => navigate(`#poll/${id}`)), 'primary');
  card.append(field('Thème', select), actions(save, link('Retour', `#poll/${id}`))); app.append(card);
}

function render() {
  if (!state) return;
  app.replaceChildren();
  const nextRoute = location.hash || '#home';
  if (nextRoute !== route) { editor = null; voteSession = null; clearError(); route = nextRoute; }
  try {
    const [view, id, extra] = nextRoute.slice(1).split('/');
    if (extra) throw new Error('Ce lien local n’est pas reconnu.');
    if (view === 'home' && !id) home();
    else if (view === 'new' && !id) edit();
    else if (view === 'poll' && id) management(id);
    else if (view === 'edit' && id) edit(id);
    else if (view === 'vote' && id) vote(id);
    else if (view === 'results' && id) results(id);
    else if (view === 'style' && id) style(id);
    else throw new Error('Ce lien local n’est pas reconnu.');
  } catch (error) { app.replaceChildren(); heading('Impossible d’ouvrir cette page'); app.append(el('p', error.message), actions(link('Accueil', '#home'))); }
}

const themeToggle = document.getElementById('theme-toggle');
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? 'Mode jour' : 'Mode nuit';
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
}
try { setTheme(localStorage.getItem('voti.theme') === 'dark' ? 'dark' : 'light'); } catch { setTheme('light'); }
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme); try { localStorage.setItem('voti.theme', theme); } catch { /* Préférence non critique. */ }
});

try {
  repository = new Repository(new LocalStorageAdapter(localStorage));
  state = await repository.load();
  render();
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
  if (event.key !== STORAGE_KEY) return;
  try { state = await repository.load(); editor = null; voteSession = null; render(); }
  catch (error) { state = null; app.replaceChildren(el('p', 'Données modifiées dans un autre onglet : rechargez pour vérifier le stockage.')); showError(error); }
});
