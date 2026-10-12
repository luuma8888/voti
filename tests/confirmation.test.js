import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { confirmAction } from '../web/confirmation.js';

test('confirmation : module UI importable sans DOM, aucune dépendance métier', async () => {
  assert.equal(typeof confirmAction, 'function');
  const source = await readFile(new URL('../web/confirmation.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfrom\b|\bfetch\s*\(|localStorage|IndexedDB|\bwindow\.[\w]+\s*=/);
});

test('application : aucune alerte/confirmation native, trois parcours attendent le dialogue', async () => {
  for (const file of await readdir(new URL('../web/', import.meta.url))) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(`../web/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\b(?:window\.)?(?:alert|confirm)\s*\(/, file);
  }
  const app = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.equal([...app.matchAll(/await confirmAction\(/g)].length, 3);
  for (const label of ['Remplacer la clé', 'Fermer le sondage', 'Supprimer définitivement']) {
    assert.ok(app.includes(`actionLabel: '${label}'`));
  }
});

test('dialogue : textes sûrs, sémantique et boutons non-submit, pas de HTML interprété', async () => {
  const source = await readFile(new URL('../web/confirmation.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(/);
  for (const value of ["createElement('dialog')", "'aria-labelledby'", "'aria-describedby'", "'aria-modal'", 'dialog.showModal()', 'cancel.autofocus = true']) assert.ok(source.includes(value));
  assert.equal([...source.matchAll(/\.type = 'button'/g)].length, 2);
});
