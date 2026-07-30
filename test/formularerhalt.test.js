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

/* ---------- Fix-Runde 1, C-2: Checkboxen (form:'haken') im Formular-Erhalt ----------
   Vorher (Etappe 1e Task 6, Erstfassung) kannten _formularSnapshot/_formularWiederherstellen
   nur .value — ein angehaktes, noch nicht gesichertes SAQ-Haekchen ging bei einem
   Zwischen-Render verloren (dieselbe Fehlerklasse wie C2 in Task 2, nur fuer den neuen
   Feldtyp nicht mitgezogen). Jetzt: .checked wird als eigener (boolescher) Werttyp
   gesichert und restauriert.

   ANDERE Regel als bei Text, bewusst (s. CLAUDE.md): bei Text gewinnt der Snapshot nur,
   wenn er NICHT LEER ist, weil eine leere Zeichenkette zweideutig ist (noch nichts
   getippt vs. bewusst geloescht). Eine Checkbox kennt diese Zweideutigkeit nicht — beide
   Zustaende sind immer eine bewusste Antwort — deshalb gewinnt hier jede Abweichung vom
   frisch gerenderten Stand, in BEIDE Richtungen. Die beiden folgenden Tests belegen genau
   diese Symmetrie (angehakt gewinnt gegen unangehakt gerendert, UND umgekehrt).

   Mutationsprobe (durchgefuehrt, Fix-Runde 1): die checkbox-Zweige in beiden Funktionen
   entfernt (zurueck auf den reinen .value-Pfad von vorher) — `node --test` wurde rot an
   genau den drei Checkbox-Tests dieses Abschnitts (Snapshot-Test + beide Richtungen), der
   vierte ("bleibt unangetastet") blieb gruen, weil dort ohnehin nichts restauriert werden
   muss. Danach wiederhergestellt, wieder 437/437 gruen. */

function hakenElement(id, checked) {
  return { dataset: { feld: id }, type: 'checkbox', checked: checked,
    focus: function () { this._fokussiert = true; } };
}

test('C-2: _formularSnapshot sichert bei einer Checkbox .checked (bool), nicht .value', () => {
  const feld = hakenElement('saq_rezert', true);
  global.document = baueDocument([feld], {}, null);

  const snap = controller._formularSnapshot();

  assert.strictEqual(snap.werte['feld:saq_rezert'], true);
  delete global.document;
});

test('C-2: ein angehaktes Haekchen uebersteht einen Neuaufbau, der unangehakt rendert', () => {
  const feld = hakenElement('saq_rezert', true);
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();

  feld.checked = false;   /* Neuaufbau zeigt den (aelteren) unangehakten Dossier-Stand */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.checked, true, 'ein angehaktes Haekchen ist beim Neuaufbau verloren gegangen');
  delete global.document;
});

test('C-2 Gegenprobe: ein NICHT angehaktes Haekchen uebersteht einen Neuaufbau, der angehakt rendert ' +
  '(beide Richtungen — anders als bei Text, wo Leere bewusst verliert)', () => {
  const feld = hakenElement('saq_rezert', false);
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();

  feld.checked = true;   /* Neuaufbau zeigt einen (aelteren) angehakten Dossier-Stand */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.checked, false,
    'ein bewusst nicht angehaktes Haekchen hat gegen den frisch gerenderten Stand verloren — ' +
    'bei einer Checkbox ist "nicht angehakt" keine Leere, die verlieren duerfte');
  delete global.document;
});

test('C-2: eine Checkbox bleibt unangetastet, wenn sie mit dem frisch gerenderten Stand uebereinstimmt', () => {
  const feld = hakenElement('saq_rezert', true);
  global.document = baueDocument([feld], {}, null);
  const snap = controller._formularSnapshot();
  /* kein Neuaufbau-Unterschied: feld.checked bleibt true */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(feld.checked, true);
  delete global.document;
});

/* ---------- M-2 (Fix-Runde Final): content-modus-Radios im Formular-Erhalt ----------
   Die Radios (name="content-modus", je ein value pro Modus) tragen weder data-feld
   noch eine eigene id — bislang kannten _formularSnapshot/_formularWiederherstellen
   sie gar nicht, ein Zwischen-Render (z. B. ein spaet eintreffendes dossierNachladen)
   konnte deshalb zweierlei zuruecksetzen: die optische Auswahl (checked, waehrend die
   Person gerade erst geklickt hat, aber controller.contentModus() das Schreiben noch
   nicht bestaetigt hat) UND die Schreibsperre (disabled, die contentModus() waehrend
   des laufenden PUT setzt — die Ansicht selbst kennt nur ordnerFehlt, nicht einen
   laufenden Schreibvorgang, und wuerde die Radios beim Neuaufbau also faelschlich
   wieder freigeben).

   checked folgt derselben Beide-Richtungen-Regel wie eine Checkbox (C-2 oben): beide
   Zustaende (angehakt/nicht) sind eine bewusste, beobachtbare Antwort, keine Leere.
   disabled folgt derselben Regel aus demselben Grund: "gesperrt" und "frei" sind
   beides eindeutige, beobachtbare Zustaende. */

function radioElement(value, checked, disabled) {
  return { name: 'content-modus', value: value, checked: !!checked, disabled: !!disabled };
}

function baueDocumentMitRadios(felder, radios) {
  const doc = baueDocument(felder, {}, null);
  const alt = doc.querySelectorAll;
  doc.querySelectorAll = function (sel) {
    if (sel === '[name="content-modus"]') return radios;
    return alt(sel);
  };
  return doc;
}

test('M-2: _formularSnapshot sichert checked UND disabled je Radio-value', () => {
  const a = radioElement('quellengestuetzt', true, false);
  const b = radioElement('quellenfrei', false, false);
  global.document = baueDocumentMitRadios([], [a, b]);

  const snap = controller._formularSnapshot();

  assert.deepStrictEqual(snap.werte['radio:content-modus:quellengestuetzt'], { checked: true, disabled: false });
  assert.deepStrictEqual(snap.werte['radio:content-modus:quellenfrei'], { checked: false, disabled: false });
  delete global.document;
});

test('M-2: eine gewaehlte Auswahl uebersteht einen Neuaufbau, der den alten Modus zeigt (beide Richtungen)', () => {
  const a = radioElement('quellengestuetzt', false, false);
  const b = radioElement('quellenfrei', true, false);
  global.document = baueDocumentMitRadios([], [a, b]);
  const snap = controller._formularSnapshot();   /* Person hat gerade auf quellenfrei geklickt */

  /* Neuaufbau zeigt den (aelteren) Dossier-Stand: quellengestuetzt */
  a.checked = true; b.checked = false;

  controller._formularWiederherstellen(snap);

  assert.strictEqual(a.checked, false, 'die frisch gewaehlte Auswahl ist beim Neuaufbau zurueckgedreht worden');
  assert.strictEqual(b.checked, true, 'quellenfrei haette wieder angehakt werden muessen');
  delete global.document;
});

test('M-2: eine laufende Schreibsperre (disabled) uebersteht einen Neuaufbau, der die Radios frei zeigt', () => {
  const a = radioElement('quellengestuetzt', true, true);
  const b = radioElement('quellenfrei', false, true);
  global.document = baueDocumentMitRadios([], [a, b]);
  const snap = controller._formularSnapshot();   /* contentModus() haelt gerade die Sperre */

  /* Neuaufbau kennt den laufenden Schreibvorgang nicht, zeichnet frei (disabled=false) */
  a.disabled = false; b.disabled = false;

  controller._formularWiederherstellen(snap);

  assert.strictEqual(a.disabled, true, 'die Schreibsperre ist beim Neuaufbau faelschlich aufgehoben worden');
  assert.strictEqual(b.disabled, true, 'die Schreibsperre ist beim Neuaufbau faelschlich aufgehoben worden');
  delete global.document;
});

test('M-2: Radios bleiben unangetastet, wenn sie mit dem frisch gerenderten Stand uebereinstimmen', () => {
  const a = radioElement('quellengestuetzt', true, false);
  const b = radioElement('quellenfrei', false, false);
  global.document = baueDocumentMitRadios([], [a, b]);
  const snap = controller._formularSnapshot();
  /* kein Neuaufbau-Unterschied */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(a.checked, true);
  assert.strictEqual(b.checked, false);
  delete global.document;
});

/* ---------- Fix-Runde 1: Gate-Box-Felder im Formular-Erhalt ----------
   Review-Finding (Important): _formularSnapshot/_formularWiederherstellen kannten
   bisher nur #briefing-felder [data-feld], QUELLEN_FORMULAR_IDS und die
   content-modus-Radios — die Gate-Box-Felder (offen-was, offen-wo, offen-fuer,
   offen-wer-N, offen-wann-N, offen-ziel-N, offen-begruendung-N) fehlten. Kritisch,
   weil offenErfassen/offenEntscheiden/offenVerschieben selbst render() aufrufen:
   wer "Entscheiden" auf einem bestehenden Punkt klickt, waehrend in der Erfassung
   schon was/wo getippt ist, verlor den Text deterministisch.

   Fix: EIN gemeinsamer Selektor (data-gate-feld, in ansichten.js gateBlock gesetzt)
   statt einer festen ID-Liste — deckt automatisch auch die indizierten Felder ab,
   ohne dass der Mechanismus eine Obergrenze fuer den Index kennen muesste.
   Selects (offen-fuer, offen-ziel-N) laufen durch DIESELBE Code-Zeile wie
   Textfelder ("abweichend UND nicht leer gewinnt") — ein Select hat aber nie den
   leeren Zustand (immer eine echte Option aus dossier.ZIELE), die
   Nicht-leer-Bedingung ist fuer ihn also nie der einschraenkende Teil. */

function gateFeld(id, wert) {
  const el = { id: id, value: wert };
  el.focus = function () { el._fokussiert = true; };
  return el;
}

function baueDocumentMitGateFeldern(gateFelder, aktivEl) {
  return {
    getElementById: function (id) {
      return gateFelder.filter(function (el) { return el.id === id; })[0] || null;
    },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) {
      if (sel === '[data-gate-feld]') return gateFelder;
      return [];
    },
    activeElement: aktivEl || null
  };
}

test('Fix-Runde 1: _formularSnapshot liest Gate-Box-Felder ueber [data-gate-feld], inkl. indizierter Felder', () => {
  const was = gateFeld('offen-was', 'Getippter Punkt');
  const wer0 = gateFeld('offen-wer-0', 'Markus');
  const ziel0 = gateFeld('offen-ziel-0', 'schritt-3');
  global.document = baueDocumentMitGateFeldern([was, wer0, ziel0]);

  const snap = controller._formularSnapshot();

  assert.strictEqual(snap.werte['gate:offen-was'], 'Getippter Punkt');
  assert.strictEqual(snap.werte['gate:offen-wer-0'], 'Markus');
  assert.strictEqual(snap.werte['gate:offen-ziel-0'], 'schritt-3');
  delete global.document;
});

test('Fix-Runde 1: ein getipptes Gate-Box-Textfeld uebersteht einen Neuaufbau, der es leer zeigt ' +
  '(genau der gemeldete Fehler: Erfassung waehrend "Entscheiden" auf einem anderen Punkt)', () => {
  const was = gateFeld('offen-was', 'Getippter Punkt, ungesichert');
  global.document = baueDocumentMitGateFeldern([was]);
  const snap = controller._formularSnapshot();

  was.value = '';   /* Neuaufbau (ausgeloest z. B. durch offenEntscheiden woanders) */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(was.value, 'Getippter Punkt, ungesichert',
    'das getippte offen-was ist beim Neuaufbau verloren gegangen');
  delete global.document;
});

test('Fix-Runde 1: ein Select in der Gate-Box (offen-ziel-N) laeuft durch dieselbe Regel wie ein Textfeld — abweichender Wert gewinnt', () => {
  const ziel0 = gateFeld('offen-ziel-0', 'schritt-5');   /* Person hat bereits umgestellt */
  global.document = baueDocumentMitGateFeldern([ziel0]);
  const snap = controller._formularSnapshot();

  ziel0.value = 'schritt-3';   /* Neuaufbau zeigt wieder die Default-Auswahl */

  controller._formularWiederherstellen(snap);

  assert.strictEqual(ziel0.value, 'schritt-5',
    'ein Select in der Gate-Box wurde beim Neuaufbau nicht wie ein Textfeld behandelt');
  delete global.document;
});

test('Fix-Runde 1: ein leeres Gate-Box-Feld verliert gegen einen gefuellten frisch gerenderten Wert (dieselbe Regel wie bei Text)', () => {
  const wer0 = gateFeld('offen-wer-0', '');
  global.document = baueDocumentMitGateFeldern([wer0]);
  const snap = controller._formularSnapshot();

  wer0.value = 'Aus dem Dossier';

  controller._formularWiederherstellen(snap);

  assert.strictEqual(wer0.value, 'Aus dem Dossier');
  delete global.document;
});

test('controller.render() bewahrt einen getippten Gate-Box-Wert ueber den Neuaufbau hinweg (Integrationstest zum Finding)', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { kursId: DBS.kursId, schrittId: 2 };
  state.data.ordner = { 'DBS-001': null };
  state.data.dateien = {};
  state.data.dossier = {};
  state.data.briefing = {};
  state.hinweis = null;

  const was = gateFeld('offen-was', 'Getippt, waehrend anderswo auf "Entscheiden" geklickt wurde');
  const app = {};
  Object.defineProperty(app, 'innerHTML', {
    set: function () {
      /* Ein echter Neuaufbau zeichnet die Gate-Box-Erfassung frisch — leer. */
      was.value = '';
    }
  });
  global.document = {
    getElementById: function (id) {
      if (id === 'app') return app;
      if (id === 'nav') return { innerHTML: '' };
      return null;
    },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) { return sel === '[data-gate-feld]' ? [was] : []; },
    activeElement: null
  };

  controller.render();

  assert.strictEqual(was.value, 'Getippt, waehrend anderswo auf "Entscheiden" geklickt wurde',
    'controller.render() hat den getippten Gate-Box-Wert nicht ueber den Neuaufbau hinweg erhalten');

  delete global.document;
  state.auth.account = null;
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

/* ---------- I2 + M3 (Etappe 1e Task 4): hinweis/fehlerHinweis in ALLEN
   Arbeiten-Ansichten, nicht nur im Schritt ----------
   Der Meldungsblock wurde bisher nur in der Schritt-Ansicht vorangestellt
   (meldung + ansichten.einSchritt(...)) — ein Hinweis aus der Kursliste oder
   Kursansicht heraus (z. B. dossierNachladen von dort) verschwand stumm, weil
   state.hinweis beim naechsten Render trotzdem konsumiert (auf null gesetzt)
   wurde, ohne je gezeigt worden zu sein. Jetzt EINE Stelle in _renderAufbau, vor
   der Ansichts-Weiche berechnet, in Kursliste/Kursansicht/Schritt vorangestellt.
   Nachschlagen bleibt bewusst ohne (keine schreibenden Aktionen dort).

   Zugleich M3: state.hinweis (Erfolg) traegt weiter das gruene Haekchen,
   state.fehlerHinweis (Fehler) die bestehende .klemmt-Fehler-Optik OHNE
   Haekchen — vorher trugen auch echte Fehlermeldungen (z. B. "Dossier konnte
   nicht gelesen werden") das Haekchen von state.hinweis, als waeren sie ein
   Erfolg. */

function renderErfassen() {
  let html = '';
  const app = {};
  Object.defineProperty(app, 'innerHTML', { set: function (v) { html += v; } });
  global.document = {
    getElementById: function (id) {
      if (id === 'app') return app;
      if (id === 'nav') return { innerHTML: '' };
      return null;
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    activeElement: null
  };
  controller.render();
  delete global.document;
  return html;
}

test('state.hinweis erscheint auch in der Kursliste (I2)', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null,
                     variante: null, weg: null };
  state.hinweis = 'Dossier gesichert: Testdatei';
  state.fehlerHinweis = null;

  const html = renderErfassen();

  assert.ok(html.indexOf('Dossier gesichert: Testdatei') >= 0,
    'die Kursliste zeigt state.hinweis nicht — der Meldungsblock haengt noch am Schritt-Zweig');
  assert.ok(html.indexOf('<div class="hinweis">') >= 0);
  assert.strictEqual(state.hinweis, null, 'state.hinweis wurde nicht konsumiert');

  state.auth.account = null;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

test('state.hinweis erscheint auch in der Kursansicht (I2)', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { bereich: 'arbeiten', kursId: DBS.kursId, schrittId: null, werkzeugId: null,
                     werk: null, variante: null, weg: null };
  /* null = nachgesehen, nichts da — verhindert echte (ungemockte) Netzaufrufe aus
     ordnerPruefen/dossierNachladen, die die Kursansicht sonst anstoesst. */
  state.data.ordner = { [DBS.kursId]: null };
  state.data.dossier = { [DBS.kursId]: null };
  state.hinweis = 'Q-001 erfasst: sspa-map.pdf';
  state.fehlerHinweis = null;

  const html = renderErfassen();

  assert.ok(html.indexOf('Q-001 erfasst: sspa-map.pdf') >= 0,
    'die Kursansicht zeigt state.hinweis nicht');

  state.auth.account = null;
  state.data.ordner = {};
  state.data.dossier = {};
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

test('state.fehlerHinweis zeigt die bestehende Fehler-Optik OHNE Haekchen (M3)', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null,
                     variante: null, weg: null };
  state.hinweis = null;
  state.fehlerHinweis = 'Dossier konnte nicht gelesen werden — Seite neu laden.';

  const html = renderErfassen();

  assert.ok(html.indexOf('Dossier konnte nicht gelesen werden') >= 0,
    'die Fehlermeldung erscheint nicht');
  assert.ok(html.indexOf('<div class="klemmt">Dossier konnte nicht gelesen werden') >= 0,
    'die Fehlermeldung nutzt nicht die bestehende .klemmt-Fehler-Optik');
  assert.ok(html.indexOf('&#10003;Dossier konnte nicht gelesen werden') < 0,
    'die Fehlermeldung traegt das gruene Erfolgs-Haekchen — M3 verlangt genau das Gegenteil');
  assert.strictEqual(state.fehlerHinweis, null, 'state.fehlerHinweis wurde nicht konsumiert');

  state.auth.account = null;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

/* ---------- Fix-Runde 1, Review-Finding 1 ----------
   Vorher wurde die meldung-Variable VOR der Bereichs-Weiche berechnet und dabei
   state.hinweis/state.fehlerHinweis sofort konsumiert (auf null gesetzt) — auch
   wenn p.bereich === 'nachschlagen' war und die Ansicht die Meldung gar nicht
   rendert. Eine Meldung, die waehrend Nachschlagen entstand (oder einfach noch
   stand, als dorthin gewechselt wurde), war dann endgueltig verschluckt: weder
   angezeigt noch beim naechsten Wechsel zurueck in eine Arbeiten-Ansicht noch
   vorhanden. Gewaehlte (kleinere) Loesung: die Berechnung/Konsumierung hinter
   die Nachschlagen-Weiche ziehen, statt Nachschlagen zusaetzlich rendern zu
   lassen — Nachschlagen hat keine schreibenden Aktionen, die ueberhaupt eine
   Meldung ausloesen koennten, ein Anzeige-Pfad dort waere totes Gewicht. */
test('bereich=nachschlagen: state.hinweis geht beim Rendern nicht verloren (Fix-Runde 1, Finding 1)', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { bereich: 'nachschlagen', kursId: null, schrittId: null, werkzeugId: null,
                     werk: null, variante: null, weg: null };
  state.hinweis = 'Sollte nicht verschluckt werden';
  state.fehlerHinweis = null;

  const html = renderErfassen();

  const nochImState = state.hinweis === 'Sollte nicht verschluckt werden';
  const angezeigt = html.indexOf('Sollte nicht verschluckt werden') >= 0;
  assert.ok(nochImState || angezeigt,
    'die Meldung ist weder angezeigt noch im State erhalten geblieben — endgueltig verschluckt');

  state.auth.account = null;
  state.hinweis = null;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

test('bereich=nachschlagen: state.fehlerHinweis geht beim Rendern ebenfalls nicht verloren (Fix-Runde 1, Finding 1)', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { bereich: 'nachschlagen', kursId: null, schrittId: null, werkzeugId: null,
                     werk: null, variante: null, weg: null };
  state.hinweis = null;
  state.fehlerHinweis = 'Sollte ebenfalls nicht verschluckt werden';

  const html = renderErfassen();

  const nochImState = state.fehlerHinweis === 'Sollte ebenfalls nicht verschluckt werden';
  const angezeigt = html.indexOf('Sollte ebenfalls nicht verschluckt werden') >= 0;
  assert.ok(nochImState || angezeigt,
    'die Fehlermeldung ist weder angezeigt noch im State erhalten geblieben — endgueltig verschluckt');

  state.auth.account = null;
  state.fehlerHinweis = null;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});

test('Erfolg (state.hinweis) UND Fehler (state.fehlerHinweis) koennen gleichzeitig stehen und bleiben unterscheidbar (M3)', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = INHALT;
  state.data.kurse = KURSE;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null,
                     variante: null, weg: null };
  state.hinweis = 'Abgelegt als X_v2.md';
  state.fehlerHinweis = 'Status nicht aktualisiert: Graph 500';

  const html = renderErfassen();

  const posErfolg = html.indexOf('Abgelegt als X_v2.md');
  const posFehler = html.indexOf('Status nicht aktualisiert');
  assert.ok(posErfolg >= 0 && posFehler >= 0, 'eine der beiden Meldungen fehlt');
  assert.ok(html.slice(Math.max(0, posErfolg - 30), posErfolg).indexOf('&#10003;') >= 0,
    'die Erfolgsmeldung traegt kein Haekchen');
  assert.ok(html.slice(Math.max(0, posFehler - 30), posFehler).indexOf('&#10003;') < 0,
    'die Fehlermeldung traegt faelschlich ein Haekchen');

  state.auth.account = null;
  state.position = { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null };
});
