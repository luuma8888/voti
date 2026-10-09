import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { THEME_OPTIONS, THEME_KEY, normalizeTheme } from '../web/themes.js';

test('cinq thèmes uniques, Pop par défaut, compatibilité de la préférence existante', () => {
  assert.equal(THEME_OPTIONS.length, 5);
  assert.equal(new Set(THEME_OPTIONS.map(theme => theme.id)).size, 5);
  assert.equal(THEME_KEY, 'voti.theme');
  for (const theme of THEME_OPTIONS) assert.equal(normalizeTheme(theme.id), theme.id);
  for (const value of [null, undefined, 'light', 'inconnu', '<script>']) assert.equal(normalizeTheme(value), 'pop');
  assert.equal(normalizeTheme('dark'), 'dark');
});

const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');
const blocks = [...css.matchAll(/(?:\:root,\.theme-option|\:where\(\:root,\.theme-option\))\[data-theme=(\w+)\]\s*\{([^}]+)\}/g)];
const palettes = Object.fromEntries(blocks.map(([, id, body]) => [id, Object.fromEntries([...body.matchAll(/--([\w-]+):([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))]));
function luminance(hex) {
  const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function ratio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
for (const { id } of THEME_OPTIONS) {
  test(`palette ${id} complète, contrastes texte ≥4,5 et focus ≥3`, () => {
    const palette = palettes[id]; assert.ok(palette);
    assert.deepEqual(Object.keys(palette).sort(), Object.keys(palettes.pop).sort());
    assert.notEqual(palette.header, palette.main);
    assert.notEqual(palette.main, palette.bg);
    for (const [a,b] of [['ink','surface'], ['ink','main'], ['muted','header'], ['muted','bg'], ['accent','surface'], ['on-accent','accent'], ['on-accent','secondary'], ['positive','main'], ['draft-ink','draft-bg'], ['open-ink','open-bg'], ['closed-ink','closed-bg'], ['danger','danger-bg']]) {
      assert.ok(ratio(palette[a], palette[b]) >= 4.5, `${id}: ${a}/${b} = ${ratio(palette[a], palette[b])}`);
    }
    for (const background of ['surface','main','header','soft']) assert.ok(ratio(palette.focus, palette[background]) >= 3, `${id}: focus/${background}`);
    assert.notEqual(palette.focus, palette.danger);
  });
}

test('palettes locales et focus contextualisé, sans ressource distante', () => {
  assert.doesNotMatch(css, /@import|url\(|https?:/i);
  assert.match(css, /:focus-visible\s*\{[^}]*var\(--focus\)/);
  assert.match(css, /\[data-navigation-focus\]:not\(\[data-focus-origin=keyboard\]\):focus/);
});
