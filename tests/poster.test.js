import test from 'node:test';
import assert from 'node:assert/strict';
import { makePosterPlan, wrapText, POSTER_WIDTH, POSTER_HEIGHT, A4_POINTS } from '../web/poster.js';
import { buildPollUrl, buildResultsUrl, buildChoiceUrl } from '../shared/qr-links.js';
import { published } from './fixtures.js';

function poll(n, long = false) {
  const p = structuredClone(published().polls[0]);
  p.remoteRef = { relayId: 'voti-production', pollId: p.id, revision: 1 };
  p.definition.choices = Array.from({ length: n }, (_, i) => ({ ...p.definition.choices[0], id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, order: i,
    label: long ? ('Été, pêche, forêt et jeux très appréciés ! '.repeat(3)).slice(0, 100) : `Réponse ${i + 1}` }));
  if (long) { p.definition.question = ('Quelle activité choisir ensemble cet été ? '.repeat(6)).slice(0, 240); p.definition.description = ('À Noël, bientôt : forêt, pêche, après-midi. '.repeat(25)).slice(0, 1000); }
  return p;
}
for (const n of [2, 3, 6]) for (const mode of ['access', 'choices']) for (const long of [false, true]) {
  test(`Affiche ${mode}, ${n} choix, textes ${long ? 'longs' : 'courts'} : A4, QR bornés/publics`, () => {
    const p = poll(n, long), before = structuredClone(p), plan = makePosterPlan(p, mode);
    assert.deepEqual(p, before); assert.equal(plan.width, POSTER_WIDTH); assert.equal(plan.height, POSTER_HEIGHT);
    assert.ok(plan.pages.length <= 4); assert.ok(plan.pages.length >= 1);
    assert.ok(Math.abs(A4_POINTS[0] / A4_POINTS[1] - 210 / 297) < .000001);
    assert.equal(plan.width, 2480); assert.equal(plan.height, 3508);
    const qrs = plan.pages.flatMap(p => p.qrs);
    assert.equal(plan.accessUrl, buildPollUrl(p.id));
    assert.ok(qrs.some(q => q.url === buildResultsUrl(p.id)));
    if (mode === 'access') assert.equal(qrs.filter(q => q.kind === 'access')[0].url, buildPollUrl(p.id));
    else assert.deepEqual(qrs.filter(q => q.kind === 'choice').map(q => q.url), p.definition.choices.map(c => buildChoiceUrl(p.id, c.id)));
    for (const q of qrs) { assert.ok(q.pixels >= 5); assert.ok(q.x + q.size < plan.width && q.y + q.size < plan.height); assert.ok(q.size >= 400); assert.ok(!q.url.includes('admin')); if(q.kind==='choice') {assert.equal(q.destinationLines.join(''),q.url);assert.ok(q.y+q.size+q.destinationLines.length*36<plan.height-650);} }
    for (const page of plan.pages) for (const item of page.items) assert.ok(item.y + item.lines.length * 56 < plan.height - 650);
    assert.equal(plan.pages.flatMap(p => p.items).length, n);
    if (!long) assert.equal(plan.pages.length, 1);
  });
}
test('Affiche : données locales/préparation refusées et aucun secret de connexion consommé', () => {
  const local = published().polls[0]; assert.throws(() => makePosterPlan(local));
  const p = poll(2); p.adminCapability = 'SECRET_NEVER_IN_PUBLIC_POSTER';
  assert.ok(!JSON.stringify(makePosterPlan(p)).includes(p.adminCapability));
  p.remoteRef.revision = 0; assert.throws(() => makePosterPlan(p));
});
test('Affiche : mots longs, nouvelles lignes et accents conservés sans troncature', () => {
  const input = 'Été\n' + 'à'.repeat(150), lines = wrapText(input, 10, text => text.length);
  assert.equal(lines.join('').replaceAll(' ', ''), input.replaceAll('\n', ''));
  assert.ok(lines.every(line => line.length <= 10));
});
