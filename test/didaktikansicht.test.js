'use strict';
/* D6, Etappe 5 — die Contracts-Ansicht (Schritt 5). Funktional schlicht
   (Entscheid Markus: Polish kommt spaeter als eigene Runde): Kopfzeile,
   je Contract eine aufklappbare Zeile (typ-Badge, kernaussage im Summary,
   uebrige Felder als Liste darunter), darunter der Punkte-Stand aus dem
   Dossier (offen[] gefiltert fuer==='schritt-5'). Rein lesend — die App
   verwaltet nichts (Leitsatz): geaendert wird in der Blockdatei, neu
   hochgeladen, die Ansicht rendert frisch.

   Blocktext-Fixtures laufen ueber die ECHTE didaktikLesen.lies()-Kette
   (Muster test/review.test.js), kein Handbau der gelesen-Objekte. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { controller, state, graph } = require('../app.js');
const { inhalt } = require('../inhalt.js');
require('../dossier.js');
require('../didaktik-schema.js');
const { didaktikLesen } = require('../didaktik-lesen.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0]; // DBS-001, s. ansichten.test.js/review.test.js

/* ---------- Blocktext-Fixtures ---------- */

function contractText(opts) {
  opts = opts || {};
  const ek = opts.ek || 'DBS-001-EK-001';
  const nr = opts.nr || 1;
  const typ = opts.typ || 'regler';
  const kernaussage = opts.kernaussage || 'Die Praemie sinkt, wenn der Selbstbehalt steigt.';
  const lines = [
    '###CONTRACT ek=' + ek + ' | nr=' + nr + ' | typ=' + typ,
    'kernaussage: ' + kernaussage,
    'zielhandlung: Regler bewegen und den Effekt beobachten.',
    'denkfehler: Ein hoeherer Selbstbehalt senkt die Praemie automatisch um denselben Betrag.',
    'stuetztext: Der Zusammenhang haengt vom Modell ab.'
  ];
  if (typ === 'fliesstext') {
    lines.push('begruendung: Ein Rechenbeispiel reicht hier ohne interaktives Modell.');
  } else {
    lines.push('steuert: den Selbstbehalt in Franken');
    lines.push('beobachtet: die monatliche Praemie');
    lines.push('aha: bei kleinen Selbstbehalten aendert sich wenig');
    lines.push('vorhersage: Wie stark sinkt die Praemie?');
    lines.push('konsequenz: Ein zu hoher Selbstbehalt kann das Budget sprengen.');
  }
  lines.push('###ENDE-CONTRACT');
  return lines.join('\n');
}

function didaktikText(opts) {
  opts = opts || {};
  const kurs = opts.kurs || 'DBS-001';
  const basiertAuf = opts.basiertAuf === undefined ? 'DBS-001_content_final.blocks' : opts.basiertAuf;
  const kopf = '###CONTRACTS kurs=' + kurs + (basiertAuf ? ' | basiert_auf=' + basiertAuf : '');
  const contracts = (opts.contracts || [contractText()]).join('\n');
  let text = [kopf, contracts].join('\n');
  if (opts.punkte) text += '\n' + opts.punkte;
  return text;
}

function gelesenAus(opts) { return didaktikLesen.lies(didaktikText(opts)); }

function dossierMit(offenListe) {
  return {
    dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: offenListe || [], entschieden: []
  };
}

/* ---------- ansichten.didaktikBlock (ueber einSchritt, Muster reviewBlock) ---------- */

test('D6: ohne geladene Fassung erscheint nur der Kurzhinweis', () => {
  const props = { dossier: dossierMit([]), didaktik: null };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /Contracts erscheinen nach der ersten abgelegten Fassung/);
});

test('D6: ohne jedes didaktik-Feld (undefined) ebenfalls nur der Kurzhinweis', () => {
  const props = { dossier: dossierMit([]) };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /Contracts erscheinen nach der ersten abgelegten Fassung/);
});

test('D6: didaktikBlock erscheint nur an einem Schritt mit pruefung===interaktion (Schritt 3 zeigt ihn nicht)', () => {
  const gelesen = gelesenAus({});
  const props = { dossier: dossierMit([]), didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 3, null, props);
  assert.doesNotMatch(html, /id="didaktik-block"/);
});

test('D6: didaktikBlock erscheint nicht auf Schritt 4 (Validierung, nicht Interaktion)', () => {
  const gelesen = gelesenAus({});
  const props = { dossier: dossierMit([]), didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.doesNotMatch(html, /id="didaktik-block"/);
});

test('D6: auf Schritt 5 erscheint der Block mit Kopfzeile — n Contracts, Basis', () => {
  const gelesen = gelesenAus({
    contracts: [contractText({ ek: 'DBS-001-EK-001', nr: 1 }), contractText({ ek: 'DBS-001-EK-002', nr: 1 })],
    basiertAuf: 'DBS-001_content_final.blocks'
  });
  const props = { dossier: dossierMit([]), didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /id="didaktik-block"/);
  assert.match(html, /2 Interaktions-Contracts/);
  assert.match(html, /Basis: DBS-001_content_final\.blocks/);
});

test('D6: eine aufgeklappte Zeile traegt typ/kernaussage/felder escaped (Fremdwert-Probe <img>)', () => {
  const boesesFeld = 'Normaler Text <img src=x onerror=alert(1)> Ende.';
  const gelesen = gelesenAus({
    contracts: [contractText({ ek: 'DBS-001-EK-001', kernaussage: boesesFeld })]
  });
  const props = { dossier: dossierMit([]), didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /<details class="didaktik-contract">/);
  assert.match(html, /class="badge badge-bestaetigt"/);
  assert.match(html, />regler</);
  assert.match(html, /DBS-001-EK-001/);
  assert.ok(!html.includes('<img src=x'), 'unescaped <img> im Ausgabe-HTML gefunden — XSS-Luecke');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  /* uebrige Felder als Liste darunter */
  assert.match(html, /<li><b>zielhandlung:<\/b>/);
  assert.match(html, /<li><b>steuert:<\/b>/);
});

test('D6: ein fliesstext-Contract traegt die rote badge-offen-Klasse (begruendungspflichtige Ausnahme)', () => {
  const gelesen = gelesenAus({
    contracts: [contractText({ ek: 'DBS-001-EK-001', typ: 'fliesstext' })]
  });
  const props = { dossier: dossierMit([]), didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /class="badge badge-offen"/);
  assert.match(html, /<li><b>begruendung:<\/b>/);
});

test('D6: Punkte-Stand zeigt die Zahl offener schritt-5-Punkte aus dem Dossier', () => {
  const gelesen = gelesenAus({});
  const props = {
    dossier: dossierMit([
      { was: 'Punkt A', wo: 'DBS-001-EK-001', fuer: 'schritt-5' },
      { was: 'Punkt B', wo: 'DBS-001-EK-002', fuer: 'schritt-5' },
      { was: 'Punkt C', wo: 'DBS-001-EK-003', fuer: 'sign-off' }
    ]),
    didaktik: gelesen
  };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /2 Punkte offen an schritt-5/);
});

test('D6: ohne offene schritt-5-Punkte zeigt der Block "alle Punkte behandelt"', () => {
  const gelesen = gelesenAus({});
  const props = {
    dossier: dossierMit([{ was: 'Punkt X', wo: 'irgendwo', fuer: 'sign-off' }]),
    didaktik: gelesen
  };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /alle Punkte behandelt/);
  assert.doesNotMatch(html, /Punkte offen an schritt-5/);
});

/* ---------- Fixwave nach dem Etappe-5-Review (Auflage 3, Muster gateBlock):
   dossier === null/undefined heisst "laedt noch" bzw. "Ladefehler
   nachgesehen" — vorher zeigte der Block in diesem Fall faelschlich "alle
   Punkte behandelt", obwohl schlicht nichts geprueft werden konnte. */
test('D6: dossier ist null (laedt noch) — der Block behauptet NICHT "alle Punkte behandelt"', () => {
  const gelesen = gelesenAus({});
  const props = { dossier: null, didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.doesNotMatch(html, /alle Punkte behandelt/);
  assert.doesNotMatch(html, /Punkte offen an schritt-5/);
  assert.match(html, /Punkte-Stand erscheint, sobald das Dossier geladen ist/);
});

test('D6: dossier ist undefined (nie geladen) — derselbe Guard greift', () => {
  const gelesen = gelesenAus({});
  const props = { didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.doesNotMatch(html, /alle Punkte behandelt/);
  assert.match(html, /Punkte-Stand erscheint, sobald das Dossier geladen ist/);
});

/* ---------- Etappe 6 / Fast-Follow F2: die FELDWERTE sind gepinnt, nicht nur die Labels.
   Livebefund D9 ("8 leere Aufzaehlungspunkte je Contract — die Feldwerte erscheinen
   nicht"): die bestehenden D6-Tests prueften nur die Labels
   (/<li><b>zielhandlung:<\/b>/) — eine Fassung, die die Werte verliert (z. B. der
   im Etappe-6-Plan verdaechtigte Zugriffsfehler c[name] statt c.felder[name]),
   waere durch die GESAMTE bisherige Suite gruen gelaufen: der filter() laeuft auf
   f[n] (Felder vorhanden -> Label gerendert), erst der map()-Wert waere leer.
   Diese Tests schliessen genau die Luecke: jeder gelistete Feldwert muss
   WOERTLICH hinter seinem Label stehen — ueber die ECHTE didaktikLesen.lies()-
   Kette, kein Handbau der gelesen-Objekte. (Die Reproduktion am echten
   VL-002-Bestand ergab KEINEN Code-Defekt — s. CLAUDE.md, "Fast-Follow F2".) */

test('F2: jede Feld-Zeile traegt den WERT woertlich hinter dem Label — Modell-Contract, alle 8 Felder', () => {
  const gelesen = gelesenAus({});
  const props = { dossier: dossierMit([]), didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  const erwartet = {
    zielhandlung: 'Regler bewegen und den Effekt beobachten.',
    denkfehler: 'Ein hoeherer Selbstbehalt senkt die Praemie automatisch um denselben Betrag.',
    stuetztext: 'Der Zusammenhang haengt vom Modell ab.',
    steuert: 'den Selbstbehalt in Franken',
    beobachtet: 'die monatliche Praemie',
    aha: 'bei kleinen Selbstbehalten aendert sich wenig',
    vorhersage: 'Wie stark sinkt die Praemie?',
    konsequenz: 'Ein zu hoher Selbstbehalt kann das Budget sprengen.'
  };
  for (const [name, wert] of Object.entries(erwartet)) {
    assert.ok(html.includes('<li><b>' + name + ':</b> ' + wert + '</li>'),
      'Feldwert fehlt hinter dem Label: ' + name);
  }
});

test('F2: begruendung-Wert (fliesstext) und Apostroph-Werte (VL-002-Realdaten-Stil) stehen escaped im HTML', () => {
  const gelesen = gelesenAus({ contracts: [
    contractText({ ek: 'DBS-001-EK-001', typ: 'fliesstext' }),
    [
      '###CONTRACT ek=DBS-001-EK-002 | nr=1 | typ=rechner',
      'kernaussage: Gerechnet wird auf dem versicherten Lohn.',
      'zielhandlung: Die Kette durchrechnen.',
      'denkfehler: Lohn und versicherter Lohn werden gleichgesetzt.',
      'stuetztext: Beispiel unveraendert aus dem Content.',
      "steuert: Jahreslohn (Schieber 20'000-100'000).",
      'beobachtet: alle Kettenglieder live.',
      "aha: Unter 22'680 springt alles auf null.",
      "vorhersage: Wie hoch ist die Gutschrift bei 78'000?",
      "konsequenz: 7'731 Franken.",
      '###ENDE-CONTRACT'
    ].join('\n')
  ] });
  const props = { dossier: dossierMit([]), didaktik: gelesen };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.ok(html.includes('<li><b>begruendung:</b> Ein Rechenbeispiel reicht hier ohne interaktives Modell.</li>'),
    'begruendung-Wert fehlt hinter dem Label');
  /* Das Apostroph-Tausendertrennzeichen der echten VL-002-Werte laeuft durch esc()
     (Konvention 4) — der Wert bleibt sichtbar, nur escaped. */
  assert.ok(html.includes('<li><b>steuert:</b> Jahreslohn (Schieber 20&#39;000-100&#39;000).</li>'),
    'Apostroph-Wert fehlt oder ist nicht escaped');
  assert.ok(html.includes('<li><b>aha:</b> Unter 22&#39;680 springt alles auf null.</li>'),
    'aha-Wert fehlt');
});

/* ---------- controller.didaktikNachladen (Cache, Doppelabruf-Schutz, Nicht-sticky, Retry) ---------- */

function vorbereitenController() {
  state.position.kursId = 'DBS-001';
  state.position.schrittId = '5';
  state.data.inhalt = INHALT;
  state.data.didaktik = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  global.document = undefined;   /* controller.render() muss auch ohne DOM auskommen */
}

test('didaktikNachladen laedt die geltende umsetzung-.blocks und cacht das Ergebnis unter dem Kurs', async () => {
  vorbereitenController();
  const lief = inhalt.ablageVon(INHALT, '5', 'DBS-001').lieferobjekt;

  graph.ordnerInhalt = function (kursId, ordner) {
    if (ordner === '05_didaktik') return Promise.resolve([{ name: 'DBS-001_' + lief + '_v1.blocks' }]);
    return Promise.resolve([]);
  };
  graph.dateiLesen = function (kursId, ordner, datei) {
    if (datei === 'DBS-001_' + lief + '_v1.blocks') {
      return Promise.resolve(didaktikText({ contracts: [contractText({ ek: 'DBS-001-EK-001' })] }));
    }
    return Promise.resolve(null);
  };

  await controller.didaktikNachladen('DBS-001');

  const r = state.data.didaktik['DBS-001'];
  assert.ok(r, 'kein Didaktik-Objekt im Cache');
  assert.strictEqual(r.contracts[0].ek, 'DBS-001-EK-001');
  assert.strictEqual(r.kopf.kurs, 'DBS-001');
});

test('didaktikNachladen: Doppelabruf-Schutz — ein zweiter Aufruf waehrend des Ladens loest keine weiteren Netzzugriffe aus', async () => {
  vorbereitenController();
  let aufrufe = 0;
  const resolvers = [];
  graph.ordnerInhalt = function () {
    aufrufe++;
    return new Promise(function (res) { resolvers.push(res); });
  };
  graph.dateiLesen = function () { return Promise.resolve(null); };

  const p1 = controller.didaktikNachladen('DBS-001');
  assert.strictEqual(state.data.didaktik['DBS-001'], null, 'der Zwischenzustand null (laedt) fehlt');
  const anzahlNachErstemAufruf = aufrufe;

  controller.didaktikNachladen('DBS-001');   /* Guard: !== undefined -> return, ohne Netzzugriff */
  assert.strictEqual(aufrufe, anzahlNachErstemAufruf,
    'ein zweiter Aufruf waehrend des Ladens hat erneut Netzzugriffe ausgeloest');

  resolvers.forEach(function (r) { r([]); });
  await p1;
});

test('didaktikNachladen: ein Kettenfehler setzt fehlerHinweis, rendert und faellt danach auf undefined zurueck (I1-Muster)', async () => {
  vorbereitenController();
  graph.ordnerInhalt = function () { return Promise.reject(new Error('Netz weg')); };
  graph.dateiLesen = function () { return Promise.resolve(null); };

  await controller.didaktikNachladen('DBS-001');

  assert.strictEqual(state.data.didaktik['DBS-001'], undefined,
    'sticky null: ein erneuter Ansichtswechsel koennte nie wieder nachladen');
  assert.match(state.fehlerHinweis, /Contracts/);
});

test('didaktikNachladen: nach einem Fehler ruft ein zweiter Aufruf tatsaechlich erneut ab', async () => {
  vorbereitenController();
  let aufrufe = 0;
  graph.ordnerInhalt = function () {
    aufrufe++;
    if (aufrufe === 1) return Promise.reject(new Error('Netz weg'));
    return Promise.resolve([]);
  };
  graph.dateiLesen = function () { return Promise.resolve(null); };

  await controller.didaktikNachladen('DBS-001');
  assert.strictEqual(state.data.didaktik['DBS-001'], undefined,
    'nach dem Fehler muss der Zustand wieder undefined sein, sonst blockiert der Doppelabruf-Guard');

  await controller.didaktikNachladen('DBS-001');
  assert.ok(aufrufe > 1, 'der zweite Aufruf haette erneut abfragen sollen — stattdessen sticky null/Guard');
  assert.strictEqual(state.data.didaktik['DBS-001'], null,
    'der zweite Versuch fand keine Datei — null ist das korrekte Ergebnis (kein Lieferobjekt gefunden)');
});
