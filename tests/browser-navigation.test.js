import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { navigateAndWait, waitForApplication } from '../scripts/browser-navigation.mjs';

const url = 'file:///voti/index.html';
const session = 'test-session';
const navigation = { frameId: 'main', loaderId: 'target-loader' };
const loaded = (events, loaderId = navigation.loaderId, sessionId = session) => events.emit('event', {
  sessionId, method: 'Page.lifecycleEvent', params: { name: 'load', loaderId, frameId: navigation.frameId }
});
const tree = (overrides = {}) => ({ frameTree: { frame: { id: navigation.frameId, loaderId: navigation.loaderId, url, ...overrides } } });

test('load reçu avant réponse Page.navigate : événement conservé', async () => {
  const events = new EventEmitter();
  const command = async method => {
    if (method === 'Page.navigate') { loaded(events); return navigation; }
    return tree();
  };
  assert.deepEqual(await navigateAndWait(command, events, session, url), navigation);
  assert.equal(events.listenerCount('event'), 0);
});

test('load ancien ou autre session ignoré : attendre le bon loader', async () => {
  const events = new EventEmitter(); let frameRead = false;
  const command = async method => {
    if (method === 'Page.navigate') {
      loaded(events, 'ancien-loader'); loaded(events, navigation.loaderId, 'autre-session');
      return navigation;
    }
    frameRead = true; return tree();
  };
  const result = navigateAndWait(command, events, session, url);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(frameRead, false);
  loaded(events);
  await result;
  assert.equal(frameRead, true);
});

test('document non chargé : diagnostic et nettoyage après timeout', async () => {
  const events = new EventEmitter();
  await assert.rejects(navigateAndWait(async () => navigation, events, session, url, 10), /Document attendu non chargé.*target-loader/);
  assert.equal(events.listenerCount('event'), 0);
});

test('Page.navigate en erreur : diagnostic explicite', async () => {
  const events = new EventEmitter();
  await assert.rejects(navigateAndWait(async () => ({ errorText: 'net::ERR_FILE_NOT_FOUND' }), events, session, url), /Navigation impossible.*ERR_FILE_NOT_FOUND/);
  assert.equal(events.listenerCount('event'), 0);
});

test('load correct mais document remplacé : URL vérifiée', async () => {
  const events = new EventEmitter();
  const command = async method => {
    if (method === 'Page.navigate') { loaded(events); return navigation; }
    return tree({ url: 'about:blank' });
  };
  await assert.rejects(navigateAndWait(command, events, session, url), /Document inattendu.*about:blank/);
});

function application({ app = null, message = '', readyState = 'complete', href = url } = {}) {
  return runInNewContext(`(${waitForApplication.toString()})(${JSON.stringify(url)}, 10)`, {
    location: { href },
    document: { readyState, getElementById(id) { return id === 'app' ? app : { textContent: message }; } },
    MutationObserver: class { observe() {} disconnect() {} }, setTimeout, clearTimeout
  });
}

test('#app absent : erreur spécifique sans textContent sur null', async () => {
  await assert.rejects(application(), /#app absent du document chargé/);
});

test('#app présent mais initialisation inachevée : diagnostic distinct', async () => {
  await assert.rejects(application({ app: { textContent: 'Chargement de Voti…', querySelector() { return null; } } }), /Voti ne termine pas son initialisation/);
});

test('initialisation Voti échouée : conserver le message applicatif', async () => {
  await assert.rejects(application({ app: { textContent: 'Données locales indisponibles' }, message: 'Stockage corrompu' }), /Initialisation Voti en erreur.*Stockage corrompu/);
});

test('accueil initialisé : prêt sans délai fixe', async () => {
  assert.equal(await application({ app: { textContent: 'Mes sondages', querySelector() { return {}; } } }), true);
});

test('mauvais document ou readyState incomplet : refus avant scénario', async () => {
  await assert.rejects(application({ href: 'about:blank' }), /Document attendu non chargé/);
  await assert.rejects(application({ readyState: 'loading' }), /état loading/);
});
