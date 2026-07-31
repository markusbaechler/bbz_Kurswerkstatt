const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1];

/* Schritt 3 nach dem Umbau: zwei Arbeitswege, dazu Hochladen als Ablageweg. */
function mitWegen() {
  const i = JSON.parse(JSON.stringify(INHALT));
  /* Frueher stand hier eine eigene Fassung von Schritt 3, weil die Fixture noch
     keine Varianten fuehrte. Seit sie den echten Kontrakt spiegelt, waere das
     eine zweite Wahrheit — und sie verdeckte, dass der Bauauftrag aus dem Feld
     qualitaet kommt. */
  /* Den Guide ueber die Funktion holen, nicht ueber eine ID: die Fixture nennt
     ihn guide-3, SharePoint nennt ihn guide-2a. */
  const g = inhalt.anleitungVon(i, 3);
  g.stepsProWeg = {
    'chat': ['Prompt kopieren', 'Modul einsetzen', 'Datei hochladen'],
    'claude-code': ['Bauspec ausfuehren lassen', 'Abnahme verlangen']
  };
  return i;
}

/* Hochladen ist eine Art abzulegen, keine Art zu produzieren. */
test('Hochladen zaehlt nicht als Arbeitsweg', () => {
  assert.deepStrictEqual(inhalt.arbeitswege(mitWegen(), 3), ['chat', 'claude-code']);
});

test('Schritte ohne stepsProWeg verhalten sich wie bisher', () => {
  const g = inhalt.anleitungVon(INHALT, 4);
  assert.deepStrictEqual(inhalt.anleitungSchritte(INHALT, 4), g.steps);
});

test('jeder Weg bekommt seine eigenen Schritte', () => {
  const i = mitWegen();
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 3, 'chat'),
    ['Prompt kopieren', 'Modul einsetzen', 'Datei hochladen']);
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 3, 'claude-code'),
    ['Bauspec ausfuehren lassen', 'Abnahme verlangen']);
});

test('ohne Wahl gilt der erste Arbeitsweg aus dem Kontrakt', () => {
  const i = mitWegen();
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 3),
                         inhalt.anleitungSchritte(i, 3, 'chat'));
});

test('ein unbekannter Weg faellt auf den ersten zurueck, statt leer zu bleiben', () => {
  const i = mitWegen();
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 3, 'brieftaube'),
                         inhalt.anleitungSchritte(i, 3, 'chat'));
});

/* ---------- Ansicht ---------- */

test('bei zwei Arbeitswegen erscheint die Wegwahl', () => {
  const h = ansichten.einSchritt(mitWegen(), AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/data-action="weg"/.test(h), 'keine Wegwahl');
  assert.ok(/data-weg="chat"/.test(h) && /data-weg="claude-code"/.test(h));
  assert.strictEqual((h.match(/class="ptab on" data-action="weg"/g) || []).length, 1,
                     'genau ein Weg muss vorgewaehlt sein');
  assert.ok(!/data-weg="hochladen"/.test(h), 'Hochladen darf nicht als Arbeitsweg erscheinen');
});

/* Der Kern: kein gemischter Text mehr. */
test('der Chat-Weg zeigt keine Claude-Code-Handgriffe', () => {
  const h = ansichten.einSchritt(mitWegen(), AFL, 3, null,
    { ordnerFehlt: false, dateien: [], weg: 'chat' });
  assert.ok(h.indexOf('Prompt kopieren') >= 0);
  assert.ok(h.indexOf('Bauspec ausfuehren lassen') < 0, 'CC-Schritt im Chat-Weg sichtbar');
});

test('der Claude-Code-Weg zeigt keinen Kopierknopf-Handgriff', () => {
  const h = ansichten.einSchritt(mitWegen(), AFL, 3, null,
    { ordnerFehlt: false, dateien: [], weg: 'claude-code' });
  assert.ok(h.indexOf('Bauspec ausfuehren lassen') >= 0);
  assert.ok(h.indexOf('Prompt kopieren') < 0, 'Chat-Schritt im CC-Weg sichtbar');
});

/* Nicht nur die Anleitung haengt am Weg — die Werkzeuge auch. Ein Masterprompt
   mit Kopierknopf ist im Weg Claude Code irrefuehrend. */
test('im Claude-Code-Weg verschwindet der Masterprompt', () => {
  const cc = ansichten.einSchritt(mitWegen(), AFL, 3, null,
    { ordnerFehlt: false, dateien: [], weg: 'claude-code' });
  assert.ok(!/data-action="kopieren"/.test(cc), 'Kopierknopf im CC-Weg');
  assert.ok(cc.indexOf('skript-bauspec.txt') >= 0, 'kein Verweis auf den Bau-Auftrag');
});

test('im Chat-Weg bleibt der Masterprompt stehen', () => {
  const chat = ansichten.einSchritt(mitWegen(), AFL, 3, null,
    { ordnerFehlt: false, dateien: [], weg: 'chat' });
  assert.ok(/data-action="kopieren"/.test(chat), 'kein Masterprompt im Chat-Weg');
  assert.ok(chat.indexOf('greenfield-bauspec.txt') < 0, 'Bau-Auftrag im Chat-Weg');
});

test('Schritte mit nur einem Arbeitsweg zeigen keine Wahl', () => {
  const i = mitWegen();
  i['ablage-kontrakt'].schritte['6'] = { ordner: '06_moodle', datei: '{K}_export.mbz',
    format: 'binaer', wege: ['claude-code', 'hochladen'], gate: null };
  const h = ansichten.einSchritt(i, AFL, 6, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(!/data-action="weg"/.test(h), 'Wegwahl bei nur einem Arbeitsweg');
});

/* ---------- Z10: Chat wird Default-Weg in Schritt 2 (xlsx-Lieferobjekt) ----------
   Seit T12 liefert der Chat die .xlsx DIREKT: sein Ergebnis kommt ueber den Weg
   Hochladen herein, nie ueber die Chat-Text-Ablage (#ergebnis). Der Ablage-
   Kontrakt fuehrt fuer Schritt 2 seither 'chat' als ERSTEN Arbeitsweg — er wird
   damit zum Default-Tab, ohne dass die Ansicht irgendetwas hartkodiert (dieselbe
   arbeitswege()/anleitungSchritte()-Mechanik wie bei Schritt 3 oben). Die
   Fixture fuehrt fuer guide-2 noch kein stepsProWeg (SharePoint-Nachzug steht
   aus, s. CLAUDE.md) — hier wird das probeweise ergaenzt, um den Mechanismus
   Ende-zu-Ende zu belegen, ohne die geteilte Fixture staendig zu aendern. */
function mitChatSchritt2() {
  const i = JSON.parse(JSON.stringify(INHALT));
  const g = inhalt.anleitungVon(i, 2);
  g.stepsProWeg = {
    chat: ['Prompt kopieren', 'Antwort-Datei aus dem Chat herunterladen', 'Datei hochladen'],
    'claude-code': ['Auftrag ausfuehren lassen']
  };
  return i;
}

test('Schritt 2: Chat ist seit Z10 ein Arbeitsweg, und zwar der erste (Default-Tab)', () => {
  assert.deepStrictEqual(inhalt.arbeitswege(mitChatSchritt2(), 2), ['chat', 'claude-code', 'hand']);
});

test('Schritt-2-Ansicht (kein weg gewaehlt): der Chat-Tab ist vorgewaehlt', () => {
  const h = ansichten.einSchritt(mitChatSchritt2(), AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/data-weg="chat"/.test(h) && /data-weg="claude-code"/.test(h) && /data-weg="hand"/.test(h));
  assert.match(h, /class="ptab on" data-action="weg" data-weg="chat"/,
    'Chat ist nicht als Default-Tab vorgewaehlt');
});

test('Schritt-2-Ansicht zeigt KEINE Chat-Text-Ablage (#ergebnis) — xlsx ist eine Datei, kein Text', () => {
  const h = ansichten.einSchritt(mitChatSchritt2(), AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(!/id="ergebnis"/.test(h), 'Text-Ablagefeld erscheint trotz xlsx-Lieferobjekt');
});

test('Schritt-2-Ansicht bietet weiterhin den Hochladen-Block', () => {
  const h = ansichten.einSchritt(mitChatSchritt2(), AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/Datei hochladen/.test(h) && /data-action="hochladen"/.test(h),
    'der Hochladen-Block fuer die xlsx ist verschwunden');
});

test('ein textbasierter Schritt (Schritt 1, md) behaelt die Chat-Text-Ablage unveraendert', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/id="ergebnis"/.test(h), 'Text-Ablagefeld fehlt bei einem textbasierten Lieferobjekt');
});
