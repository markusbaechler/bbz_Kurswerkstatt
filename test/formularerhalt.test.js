'use strict';
/* Formular-Erhalt bei Render (Audit C2, Etappe 1e Task 2). Der Schutz sitzt
   zentral in controller.render() und deckt damit JEDEN Render-Aufruf ab, nicht
   nur eine feste Liste von Ausloesern — Beispiele fuer Aufrufe, die mitten im
   Tippen neu rendern: briefingNachladen, dossierNachladen, quelleErfassen
   (Erfolg), contentModus (Fehler), aber ebenso dossierSpeichern-Erfolg und
   quelleEntfernen. Ohne Erhalt loescht jeder dieser Neuaufbauten ungesicherte
   Eingaben in #briefing-felder [data-feld] und den drei Quellen-Feldern
   (quelle-titel/-herausgeber/-stand/-url).
   Mechanik: controller.render() sichert ueber controller._formularSnapshot() VOR
   dem Neuaufbau (controller._renderAufbau()) und setzt ueber
   controller._formularWiederherstellen() danach zurueck, was von den frisch
   gerenderten Werten abweicht und nicht leer ist. Muster: test/dossierspeichern.test.js
   (gemocktes document, kein echtes DOM noetig).

   Fix-Runde 1 (Review-Finding 1): _formularSnapshot stempelt kursId/schrittId aus
   state.position; _formularWiederherstellen verwirft den Snapshot, sobald diese
   beim Wiederherstellen nicht mehr uebereinstimmen — der Fremd-Kurs-Schutz ist
   damit im Mechanismus verankert statt ein Nebeneffekt der Navigation. */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state } = require('../app.js');
require('../dossier.js');
require('../inhalt.js');
require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];

/* ---------- Hilfsfunktionen fuer die Helfer-Tests (ohne echtes render) ---------- */

function feldElement(id, wert) {
  return { dataset: { feld: id }, value: wert, focus: function () { this._fokussiert = true; } };
}

function quelleElement(wert) {
  const el = { value: wert };
  el.focus = function () { el._fokussiert = true; };
  return el;
}

function baueDocument(felder, quelleEls, aktivId) {
  const map = Object.assign({}, quelleEls);
  const doc = {
    getElementById: function (id) { return map[id] || null; },
    querySelector: function () { return null; },   /* briefingFelderZaehlen sucht ".offen-zahl" */
    querySelectorAll: function (sel) {
      if (sel === '#briefing-felder [data-feld]') return felder;
      return [];
    },
    activeElement: aktivId ? map[aktivId] : null
  };
  return doc;
}

test('_formularSnapshot: null ohne document (Node-Test ohne DOM, wie dossierNachladen)', () => {
  const vorher = global.document;
  delete global.document;
  assert.strictEqual(controller._formularSnapshot(), null);
  if (vorher) global.document = vorher; else delete global.document;
});

test('_formularSnapshot liest Briefing-Felder und die drei Quellen-Eingaben', () => {
  const felder = [feldElement('zielgruppe', 'Getippt'), feldElement('kurszweck', '')];
  const quelle = { 'quelle-titel': quelleElement('SSPA Map'), 'quelle-herausgeber': quelleElement(''),
    'quelle-stand': quelleElement(''), 'quelle-url': quelleElement('') };
  global.document = baueDocument(felder, quelle, null);

  const snap = controller._formularSnapshot();

  assert.strictEqual(snap.werte['feld:zielgruppe'], 'Getippt');
  assert.strictEqual(snap.werte['feld:kurszweck'], '');
  assert.strictEqual(snap.werte['id:quelle-titel'], 'SSPA Map');
  assert.strictEqual(snap.fokusId, null);
  delete global.document;
});

test('_formularSnapshot stempelt kursId und schrittId aus state.position', () => {
  state.position = { bereich: 'arbeiten', kursId: 'DBS-001', schrittId: 1, werkzeugId: null, werk: null };
  global.document = baueDocument([], {}, null);

  const snap = controller._formularSnapshot();

  assert.strictEqual(snap.kursId, 'DBS-001');
  assert.strictEqual(snap.schrittId, '1', 'schrittId wird als String gestempelt, wie state.position.schrittId ausgewertet wird');
  delete global.document;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

/* ---------- Fremd-Kurs-Schutz (Fix-Runde 1, Review-Finding 1) ----------
   Der Schutz war zuvor nur ein Nebeneffekt der Navigation (ein Kurswechsel setzt
   zufaellig schrittId auf null, wodurch ein Zwischen-Render ohne Formular laeuft).
   Jetzt verankert im Mechanismus selbst: ein Snapshot aus Kurs A darf nie in ein
   Formular von Kurs B einlaufen, egal wie spaet ein Nachladen aus A eintrifft. */

test('Snapshot unter Kurs A, Wiederherstellen unter Kurs B: kein Wert laeuft ein', () => {
  const feld = feldElement('zielgruppe', 'Getippt in Kurs A');
  state.position = { bereich: 'arbeiten', kursId: 'DBS-001', schrittId: 1, werkzeugId: null, werk: null };
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();

  /* Navigation wechselt den Kurs, bevor das spaete Nachladen aus Kurs A zurueckkommt. */
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: 1, werkzeugId: null, werk: null };
  feld.value = 'Kurs-B-Feldwert';   /* der Neuaufbau von Kurs B zeichnet sein eigenes Formular */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.value, 'Kurs-B-Feldwert',
    'ein Snapshot aus Kurs A hat in ein Formular von Kurs B geschrieben — Fremd-Kurs-Schutz greift nicht');
  delete global.document;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

test('Snapshot und Wiederherstellen auf demselben Kurs, aber unterschiedlichem Schritt: kein Wert laeuft ein', () => {
  const feld = feldElement('zielgruppe', 'Getippt auf Schritt 1');
  state.position = { bereich: 'arbeiten', kursId: 'DBS-001', schrittId: 1, werkzeugId: null, werk: null };
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();

  state.position = { bereich: 'arbeiten', kursId: 'DBS-001', schrittId: 3, werkzeugId: null, werk: null };
  feld.value = 'Schritt-3-Feldwert';

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.value, 'Schritt-3-Feldwert',
    'ein Snapshot von Schritt 1 hat in das Formular von Schritt 3 geschrieben');
  delete global.document;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

test('Snapshot und Wiederherstellen auf demselben Kurs UND Schritt: der Wert laeuft normal ein ' +
  '(Gegenprobe zum Fremd-Kurs-Schutz — der Schutz darf den Normalfall nicht mit blockieren)', () => {
  const feld = feldElement('zielgruppe', 'Getippt und bleibt am selben Ort');
  state.position = { bereich: 'arbeiten', kursId: 'DBS-001', schrittId: 1, werkzeugId: null, werk: null };
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();

  feld.value = '';   /* der Neuaufbau derselben Ansicht zeigt den (leeren) Dossier-Stand */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.value, 'Getippt und bleibt am selben Ort');
  delete global.document;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

test('_formularWiederherstellen: getippter Wert ≠ frisch gerendert (nicht leer) gewinnt', () => {
  const feld = feldElement('zielgruppe', 'Getippt vom Nutzer');
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();

  /* Simuliert den Neuaufbau: die Ansicht wurde neu gezeichnet, das Feld traegt
     jetzt den (aelteren) Dossier-Stand. Mutationsprobe: dasselbe Objekt bleibt
     bestehen, nur .value wird veraendert — kein Austausch des Elements. */
  feld.value = 'Dossier-Stand';
  const referenzVorher = feld;

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld, referenzVorher, 'das Feld-Objekt wurde ersetzt statt nur mutiert');
  assert.strictEqual(feld.value, 'Getippt vom Nutzer', 'der getippte Wert wurde nicht wiederhergestellt');
  delete global.document;
});

test('_formularWiederherstellen: leeres getipptes Feld verliert gegen einen gefuellten Dossier-Stand ' +
  '(bewusst — Leeren wird erst nach Sichern dauerhaft)', () => {
  const feld = feldElement('kurszweck', '');   /* beim Sichern stand hier nichts */
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();

  feld.value = 'Bereits gesicherter Kurszweck';   /* der Neuaufbau zeigt den Dossier-Stand */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.value, 'Bereits gesicherter Kurszweck',
    'ein leeres getipptes Feld hat einen gefuellten Dossier-Stand ueberschrieben');
  delete global.document;
});

test('_formularWiederherstellen setzt auch die Quellen-Eingaben zurueck, wenn abweichend und nicht leer', () => {
  const titel = quelleElement('SSPA Swiss Derivative Map 2025');
  global.document = baueDocument([], { 'quelle-titel': titel }, null);
  const snap = controller._formularSnapshot();

  titel.value = '';   /* frisch gerenderte Ansicht: Quellen-Formular ist immer leer */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(titel.value, 'SSPA Swiss Derivative Map 2025');
  delete global.document;
});

test('_formularWiederherstellen laesst quelle-datei unangetastet — Datei-Inputs lassen sich ' +
  'nicht programmatisch wiederbefuellen (akzeptierte Luecke)', () => {
  let angefragt = [];
  const doc = {
    getElementById: function (id) { angefragt.push(id); return null; },
    querySelectorAll: function () { return []; },
    activeElement: null
  };
  global.document = doc;
  const snap = controller._formularSnapshot();
  angefragt = [];
  controller._formularWiederherstellen(snap);

  assert.ok(!angefragt.includes('quelle-datei'),
    'quelle-datei wurde angefragt — ein Datei-Input kann aber nicht wiederbefuellt werden');
  delete global.document;
});

test('_formularWiederherstellen zaehlt die offenen Felder neu, wenn etwas zurueckgesetzt wurde', () => {
  const feld = feldElement('zielgruppe', 'Getippt');
  const anzeige = { textContent: '', classList: { toggle: function () {} } };
  const felderFuerZaehlung = [Object.assign(feldElement('zielgruppe', ''),
    { parentNode: { classList: { toggle: function () {} } } })];
  global.document = {
    getElementById: function (id) { return id === 'quelle-titel' ? null : null; },
    querySelector: function (s) { return s.indexOf('offen-zahl') >= 0 ? anzeige : null; },
    querySelectorAll: function (sel) {
      if (sel === '#briefing-felder [data-feld]') return [feld];
      return felderFuerZaehlung;
    },
    activeElement: null
  };
  const snap = controller._formularSnapshot();
  feld.value = '';   /* frischer Aufbau: Feld ist (noch) leer im Dossier */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.value, 'Getippt');
  /* briefingFelderZaehlen wurde angestossen: die Anzeige traegt jetzt einen Text
     (sie las ueber dieselbe querySelectorAll-Mock die zweite Feldliste). */
  assert.notStrictEqual(anzeige.textContent, '', 'briefingFelderZaehlen wurde nach der Wiederherstellung nicht aufgerufen');
  delete global.document;
});

/* ---------- Fokus-Restaurierung: mindestens als Aufruf-Nachweis ---------- */

test('_formularWiederherstellen fokussiert das zuvor fokussierte Feld erneut und setzt den Cursor ans Ende', () => {
  let selectionAufruf = null;
  const feld = feldElement('scope', 'Getippter Scope-Text');
  feld.setSelectionRange = function (a, b) { selectionAufruf = [a, b]; };
  let fokusAufrufe = 0;
  feld.focus = function () { fokusAufrufe++; };
  feld.id = 'bf-scope';

  const doc = {
    getElementById: function (id) { return id === 'bf-scope' ? feld : null; },
    querySelectorAll: function (sel) { return sel === '#briefing-felder [data-feld]' ? [feld] : []; },
    activeElement: feld
  };
  global.document = doc;
  const snap = controller._formularSnapshot();
  assert.strictEqual(snap.fokusId, 'bf-scope', 'das fokussierte Feld wurde nicht erkannt');

  controller._formularWiederherstellen(snap);

  assert.strictEqual(fokusAufrufe, 1, 'focus() wurde nicht (genau einmal) aufgerufen — kein Aufruf-Nachweis');
  assert.deepStrictEqual(selectionAufruf, [feld.value.length, feld.value.length],
    'der Cursor wurde nicht ans Ende gesetzt');
  delete global.document;
});

test('_formularWiederherstellen faengt eine InvalidStateError von setSelectionRange ab ' +
  '(type="number" bei Praesenz/Selbstlern unterstuetzt keine Selektion)', () => {
  const feld = feldElement('praesenz', '3');
  feld.id = 'bf-praesenz';
  feld.setSelectionRange = function () { throw new Error('InvalidStateError'); };
  const doc = {
    getElementById: function (id) { return id === 'bf-praesenz' ? feld : null; },
    querySelectorAll: function () { return [feld]; },
    activeElement: feld
  };
  global.document = doc;
  const snap = controller._formularSnapshot();

  assert.doesNotThrow(function () { controller._formularWiederherstellen(snap); });
  delete global.document;
});

test('ohne zuvor fokussiertes Feld wird nichts fokussiert', () => {
  const feld = feldElement('zielgruppe', 'X');
  let fokusAufrufe = 0;
  feld.focus = function () { fokusAufrufe++; };
  global.document = baueDocument([feld], {}, null);   /* activeElement bleibt null */
  const snap = controller._formularSnapshot();

  controller._formularWiederherstellen(snap);

  assert.strictEqual(fokusAufrufe, 0);
  delete global.document;
});

/* ---------- Integration: controller.render() selbst erhaelt das Formular ----------
   "render-Äquivalent" reicht laut Brief; hier zusaetzlich der echte Aufruf, mit einem
   document-Mock, dessen innerHTML-Setter den Neuaufbau simuliert: das Feld faellt auf
   den (aelteren) Dossier-Stand zurueck, wie es ein echter DOM-Neuaufbau taete. */

test('controller.render() bewahrt einen getippten Feldwert ueber den Neuaufbau hinweg', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { kursId: DBS.kursId, schrittId: 1 };
  /* null = nachgesehen, nichts da — verhindert, dass briefingNachladen/dossierNachladen/
     ordnerNachladen von hier aus echte (ungemockte) Netzaufrufe ausloesen. */
  state.data.ordner = { 'DBS-001': null };
  state.data.dateien = { 'DBS-001/01_briefing': null };
  state.data.dossier = {};
  state.data.briefing = {};
  state.hinweis = null;

  const feld = feldElement('zielgruppe', 'Getippt, ungesichert');
  const app = {};
  Object.defineProperty(app, 'innerHTML', {
    set: function () {
      /* Ein echter Neuaufbau wuerde das Formular aus dem (leeren) Dossier-Stand
         zeichnen — hier durch Zuruecksetzen auf leer simuliert. */
      feld.value = '';
    }
  });
  global.document = {
    getElementById: function (id) {
      if (id === 'app') return app;
      if (id === 'nav') return { innerHTML: '' };
      return null;
    },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) { return sel === '#briefing-felder [data-feld]' ? [feld] : []; },
    activeElement: null
  };

  controller.render();

  assert.strictEqual(feld.value, 'Getippt, ungesichert',
    'controller.render() hat den getippten Wert nicht ueber den Neuaufbau hinweg erhalten');

  delete global.document;
  state.auth.account = null;
});

test('controller.render() rendert weiterhin fehlerfrei, wenn kein document existiert (wie bisher)', () => {
  const vorher = global.document;
  delete global.document;
  state.fehler = null;
  state.laden = false;
  state.auth.account = null;
  state.data.inhalt = null;
  state.position = {};

  assert.doesNotThrow(function () { controller.render(); });

  if (vorher) global.document = vorher;
});
