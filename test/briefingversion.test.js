const test = require('node:test');
const assert = require('node:assert');

const { inhalt } = require('../inhalt.js');
const { INHALT } = require('./fixture.js');

const d = (...n) => n.map(x => ({ name: x }));

/* Regel Markus, 2026-07-29: "Da das Briefing kein Gate ist, ist immer die letzte
   Upload-Version die _final. Das bedeutet, dass eine bereits bestehende _final
   umbenannt in v1, v2 usw. werden muss." */

test('Schritt 1 fuehrt die Regel, die Gate-Schritte nicht', () => {
  assert.strictEqual(inhalt.letzteGiltAlsFinal(INHALT, 1), true);
  assert.strictEqual(inhalt.letzteGiltAlsFinal(INHALT, 2), false, 'Schritt 2 hat ein Gate');
  assert.strictEqual(inhalt.letzteGiltAlsFinal(INHALT, 4), false, 'Schritt 4 hat ein Sign-off');
});

test('die neue Fassung heisst direkt _final', () => {
  const z = inhalt.naechsteDatei(INHALT, 1, 'VL-001', d('VL-001_briefing_v1.md'));
  assert.strictEqual(z.datei, 'VL-001_briefing_final.md');
  assert.strictEqual(z.ordner, '01_briefing');
});

test('eine bestehende _final wird auf die naechste Nummer zurueckgestuft', () => {
  const z = inhalt.naechsteDatei(INHALT, 1, 'VL-001',
    d('VL-001_briefing_v1.md', 'VL-001_briefing_final.md'));
  assert.deepStrictEqual(z.zurueckstufen,
    { von: 'VL-001_briefing_final.md', nach: 'VL-001_briefing_v2.md' });
  assert.strictEqual(z.datei, 'VL-001_briefing_final.md');
});

test('ohne bestehende _final wird nichts umbenannt', () => {
  const z = inhalt.naechsteDatei(INHALT, 1, 'VL-001', d('VL-001_briefing_v1.md'));
  assert.strictEqual(z.zurueckstufen, null);
});

test('die Zurueckstufung nimmt die naechste freie Nummer, nicht v1', () => {
  const z = inhalt.naechsteDatei(INHALT, 1, 'VL-001',
    d('VL-001_briefing_v1.md', 'VL-001_briefing_v2.md', 'VL-001_briefing_v7.md',
      'VL-001_briefing_final.md'));
  assert.strictEqual(z.zurueckstufen.nach, 'VL-001_briefing_v8.md',
    'wuerde eine bestehende Fassung ueberschreiben');
});

test('die Endung der bisherigen _final bleibt erhalten', () => {
  const r = inhalt.finalZurueckstufen(d('X-001_briefing_final.md'), 'X-001', 'briefing');
  assert.ok(/\.md$/.test(r.nach), 'Endung verloren: ' + r.nach);
});

/* Der Kern: die alte Sperre wuerde genau diesen Ablauf verhindern. */
test('eine _final sperrt Schritt 1 NICHT mehr', () => {
  const dat = d('VL-001_briefing_final.md');
  assert.strictEqual(inhalt.abgeschlossen(INHALT, 1, 'VL-001', dat), null,
    'Schritt 1 ist gesperrt — dann kann das Briefing nie nachgezogen werden');
});

test('bei Gate-Schritten sperrt die _final weiterhin', () => {
  const dat = d('VL-001_lernziele-drehbuch_final.xlsx');
  assert.strictEqual(inhalt.abgeschlossen(INHALT, 2, 'VL-001', dat),
    'VL-001_lernziele-drehbuch_final.xlsx',
    'die Freigabe von Gate 1 ist nicht mehr geschuetzt');
});

test('die geltende Fassung ist danach die neue _final', () => {
  const nachher = d('VL-001_briefing_v1.md', 'VL-001_briefing_v2.md', 'VL-001_briefing_final.md');
  assert.strictEqual(inhalt.geltendeDatei(nachher, 'VL-001', 'briefing'),
    'VL-001_briefing_final.md');
});

/* ---------- Ansicht ---------- */
require('../app.js');
const { ansichten } = require('../ansichten.js');
const { KURSE } = require('./fixture.js');
const VL = KURSE[1];

test('die Ansicht sagt, was mit der bisherigen Fassung passiert', () => {
  const h = ansichten.einSchritt(INHALT, VL, 1, null, {
    ordnerFehlt: false,
    dateien: d(VL.kursId + '_briefing_v1.md', VL.kursId + '_briefing_final.md')
  });
  assert.ok(h.indexOf(VL.kursId + '_briefing_v2.md') >= 0,
    'der neue Name der bisherigen Fassung wird nicht genannt');
  assert.ok(h.indexOf('gilt aber nicht mehr') >= 0, 'keine Erklaerung');
});

test('ohne bestehende _final steht der Hinweis nicht da', () => {
  const h = ansichten.einSchritt(INHALT, VL, 1, null, {
    ordnerFehlt: false, dateien: d(VL.kursId + '_briefing_v1.md')
  });
  assert.ok(h.indexOf('gilt aber nicht mehr') < 0, 'Hinweis ohne Anlass');
});

test('Schritt 1 zeigt keine Abgeschlossen-Sperre mehr', () => {
  const h = ansichten.einSchritt(INHALT, VL, 1, null, {
    ordnerFehlt: false, dateien: d(VL.kursId + '_briefing_final.md')
  });
  assert.ok(h.indexOf('Final ist final') < 0, 'die Sperre blockiert Schritt 1 wieder');
  assert.ok(/id="ergebnis"/.test(h), 'kein Ablegefeld trotz fehlender Sperre');
});
