const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];

const VOLL = {
  zielgruppe: 'Kunden- und Anlageberatende',
  vorkenntnisse: 'Risikoprofilierung, Anlageklassen',
  kurszweck: 'Derivate kundengerecht erlaeutern',
  praesenz: '1',
  selbstlern: '2',
  scope: 'SSPA Swiss Derivative Map 2025',
  reg_zusatz: 'Rezertifizierung IK, Affluent',
  ausschluesse: 'Keine Optionsbewertung',
  scope_quelle: 'Kursausschreibung, Stand 2026-06'
};

/* ---------- Felddefinition ---------- */

test('die Felder sind die acht generischen plus die Scope-Quelle', () => {
  const ids = inhalt.BRIEFING_FELDER.map(f => f.id);
  assert.deepStrictEqual(ids, ['zielgruppe', 'vorkenntnisse', 'kurszweck', 'praesenz',
    'selbstlern', 'scope', 'reg_zusatz', 'ausschluesse', 'scope_quelle']);
});

test('Praesenz zaehlt in Tagen, Selbstlern in Stunden', () => {
  assert.strictEqual(inhalt.briefingFeld('praesenz').einheit, 'Tage');
  assert.strictEqual(inhalt.briefingFeld('selbstlern').einheit, 'Stunden');
});

test('der Rechtsrahmen steht fest und wird nicht erfragt', () => {
  const f = inhalt.briefingFeld('reg_zusatz');
  assert.ok(f.fest, 'kein fester Rahmen hinterlegt');
  assert.match(f.fest, /FIDLEG/);
  assert.strictEqual(f.pflicht, false, 'Zusaetze duerfen leer bleiben');
});

/* ---------- Datei ---------- */

test('Schreiben und Lesen ergibt dieselben Werte', () => {
  const zurueck = inhalt.briefingFelderLesen(inhalt.briefingFelderText('DBS-001', VOLL));
  inhalt.BRIEFING_FELDER.forEach(f => {
    assert.strictEqual(zurueck[f.id], VOLL[f.id], 'Feld ' + f.id);
  });
});

test('der feste Rahmen steht in der Datei, kommt aber nicht als Wert zurueck', () => {
  const t = inhalt.briefingFelderText('DBS-001', VOLL);
  assert.ok(t.indexOf('FIDLEG') >= 0, 'fester Rahmen fehlt in der Datei');
  const z = inhalt.briefingFelderLesen(t);
  assert.strictEqual(z.reg_zusatz, 'Rezertifizierung IK, Affluent',
    'der feste Rahmen ist faelschlich in den Zusatz gewandert');
});

test('leere Felder werden als [OFFEN] geschrieben und als leer gelesen', () => {
  const t = inhalt.briefingFelderText('DBS-001', { zielgruppe: 'nur dieses' });
  assert.ok(t.indexOf('[OFFEN]') >= 0);
  assert.strictEqual(inhalt.briefingFelderLesen(t).kurszweck, '');
});

test('eine fremde Datei wirft nicht, sie ergibt nur keine Werte', () => {
  assert.deepStrictEqual(inhalt.briefingFelderLesen('irgendein Text ohne Abschnitte'), {});
  assert.deepStrictEqual(inhalt.briefingFelderLesen(null), {});
});

/* ---------- Vollstaendigkeit ---------- */

test('fehlende Pflichtfelder werden beim Namen genannt', () => {
  const f = inhalt.briefingFehlend({ zielgruppe: 'da' });
  assert.ok(f.length > 0);
  assert.ok(!f.includes('Zielgruppe'), 'gefuelltes Feld wird als fehlend gemeldet');
  assert.ok(!f.some(x => /Zusaetze/.test(x)), 'optionales Feld wird als fehlend gemeldet');
});

test('vollstaendig ausgefuellt meldet nichts mehr', () => {
  assert.deepStrictEqual(inhalt.briefingFehlend(VOLL), []);
});

/* ---------- Einspeisung in den Prompt ----------
   Der eigentliche Zweck: was hier mitgeht, fragt der Chat nicht mehr. */

test('der Promptkopf traegt jeden ausgefuellten Wert', () => {
  const k = inhalt.briefingPromptKopf(DBS, VOLL);
  Object.keys(VOLL).forEach(id => {
    assert.ok(k.indexOf(VOLL[id]) >= 0, 'Wert fehlt im Promptkopf: ' + id);
  });
  assert.ok(k.indexOf('FIDLEG') >= 0, 'der feste Rahmen geht nicht mit');
});

test('der Promptkopf verbietet das erneute Abfragen', () => {
  const k = inhalt.briefingPromptKopf(DBS, VOLL);
  assert.match(k, /NICHT erneut ab/);
});

test('leere Felder werden als offen benannt, nicht verschwiegen', () => {
  const k = inhalt.briefingPromptKopf(DBS, { zielgruppe: 'da' });
  assert.match(k, /NOCH OFFEN/);
  assert.ok(k.indexOf('Kurszweck') >= 0, 'offenes Feld nicht benannt');
});

test('bei vollstaendigen Angaben wird eine leere Entscheidliste ausdruecklich erlaubt', () => {
  const k = inhalt.briefingPromptKopf(DBS, VOLL);
  assert.ok(k.indexOf('NOCH OFFEN') < 0, 'meldet offene Felder, obwohl keine offen sind');
  assert.match(k, /leere Entscheidliste ist ein gutes Ergebnis/);
});

/* ---------- Ansicht ---------- */

test('Schritt 1 zeigt das Formular, andere Schritte nicht', () => {
  const eins = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.ok(/id="briefing-felder"/.test(eins), 'kein Formular in Schritt 1');
  inhalt.BRIEFING_FELDER.forEach(f => {
    assert.ok(eins.indexOf('data-feld="' + f.id + '"') >= 0, 'Feld fehlt: ' + f.id);
  });
  const drei = ansichten.einSchritt(INHALT, DBS, 3, null, {});
  assert.ok(!/id="briefing-felder"/.test(drei), 'Formular auch in Schritt 3');
});

test('gesicherte Werte stehen wieder in den Feldern', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: VOLL });
  assert.ok(h.indexOf('SSPA Swiss Derivative Map 2025') >= 0, 'Wert nicht wieder eingesetzt');
});

test('Praesenz und Selbstlern sind Zahlenfelder mit ihrer Einheit', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.match(h, /type="number"[^>]*data-feld="praesenz"/);
  assert.ok(h.indexOf('in Tage') >= 0 && h.indexOf('in Stunden') >= 0, 'Einheit fehlt');
});

test('das Formular meldet, wie viel noch offen ist', () => {
  const leer = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.match(leer, /8 offen/);
  const voll = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: VOLL });
  assert.ok(voll.indexOf('vollst&auml;ndig') >= 0, 'kein Vollstaendig-Vermerk');
});

test('Fremdtext in den Werten wird maskiert', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null,
    { briefingFelder: { zielgruppe: '<script>x</script>' } });
  assert.ok(h.indexOf('<script>x</script>') < 0, 'ungefiltertes HTML in der Ansicht');
});
