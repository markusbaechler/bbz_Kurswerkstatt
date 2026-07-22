const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1];

/* Schritt 4 nach dem Umbau: zwei Arbeitswege, dazu Hochladen als Ablageweg. */
function mitWegen() {
  const i = JSON.parse(JSON.stringify(INHALT));
  i['ablage-kontrakt'].schritte['4'] = {
    ordner: '04_greenfield', lieferobjekt: 'greenfield-{variante}',
    varianten: ['claude', 'chatgpt'], ext: 'html', format: 'html',
    wege: ['chat', 'claude-code', 'hochladen'], gate: null
  };
  /* Den Guide ueber die Funktion holen, nicht ueber eine ID: die Fixture nennt
     ihn guide-4, SharePoint nennt ihn guide-2a. */
  const g = inhalt.anleitungVon(i, 4);
  g.stepsProWeg = {
    'chat': ['Prompt kopieren', 'Modul einsetzen', 'Datei hochladen'],
    'claude-code': ['Bauspec ausfuehren lassen', 'Abnahme verlangen']
  };
  return i;
}

/* Hochladen ist eine Art abzulegen, keine Art zu produzieren. */
test('Hochladen zaehlt nicht als Arbeitsweg', () => {
  assert.deepStrictEqual(inhalt.arbeitswege(mitWegen(), 4), ['chat', 'claude-code']);
});

test('Schritte ohne stepsProWeg verhalten sich wie bisher', () => {
  const g = inhalt.anleitungVon(INHALT, 4);
  assert.deepStrictEqual(inhalt.anleitungSchritte(INHALT, 4), g.steps);
});

test('jeder Weg bekommt seine eigenen Schritte', () => {
  const i = mitWegen();
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 4, 'chat'),
    ['Prompt kopieren', 'Modul einsetzen', 'Datei hochladen']);
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 4, 'claude-code'),
    ['Bauspec ausfuehren lassen', 'Abnahme verlangen']);
});

test('ohne Wahl gilt der erste Arbeitsweg aus dem Kontrakt', () => {
  const i = mitWegen();
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 4),
                         inhalt.anleitungSchritte(i, 4, 'chat'));
});

test('ein unbekannter Weg faellt auf den ersten zurueck, statt leer zu bleiben', () => {
  const i = mitWegen();
  assert.deepStrictEqual(inhalt.anleitungSchritte(i, 4, 'brieftaube'),
                         inhalt.anleitungSchritte(i, 4, 'chat'));
});

/* ---------- Ansicht ---------- */

test('bei zwei Arbeitswegen erscheint die Wegwahl', () => {
  const h = ansichten.einSchritt(mitWegen(), AFL, 4, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/data-action="weg"/.test(h), 'keine Wegwahl');
  assert.ok(/data-weg="chat"/.test(h) && /data-weg="claude-code"/.test(h));
  assert.strictEqual((h.match(/class="ptab on" data-action="weg"/g) || []).length, 1,
                     'genau ein Weg muss vorgewaehlt sein');
  assert.ok(!/data-weg="hochladen"/.test(h), 'Hochladen darf nicht als Arbeitsweg erscheinen');
});

/* Der Kern: kein gemischter Text mehr. */
test('der Chat-Weg zeigt keine Claude-Code-Handgriffe', () => {
  const h = ansichten.einSchritt(mitWegen(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [], weg: 'chat' });
  assert.ok(h.indexOf('Prompt kopieren') >= 0);
  assert.ok(h.indexOf('Bauspec ausfuehren lassen') < 0, 'CC-Schritt im Chat-Weg sichtbar');
});

test('der Claude-Code-Weg zeigt keinen Kopierknopf-Handgriff', () => {
  const h = ansichten.einSchritt(mitWegen(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [], weg: 'claude-code' });
  assert.ok(h.indexOf('Bauspec ausfuehren lassen') >= 0);
  assert.ok(h.indexOf('Prompt kopieren') < 0, 'Chat-Schritt im CC-Weg sichtbar');
});

/* Nicht nur die Anleitung haengt am Weg — die Werkzeuge auch. Ein Masterprompt
   mit Kopierknopf ist im Weg Claude Code irrefuehrend. */
test('im Claude-Code-Weg verschwindet der Masterprompt', () => {
  const cc = ansichten.einSchritt(mitWegen(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [], weg: 'claude-code' });
  assert.ok(!/data-action="kopieren"/.test(cc), 'Kopierknopf im CC-Weg');
  assert.ok(cc.indexOf('greenfield-bauspec.txt') >= 0, 'kein Verweis auf den Bau-Auftrag');
});

test('im Chat-Weg bleibt der Masterprompt stehen', () => {
  const chat = ansichten.einSchritt(mitWegen(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [], weg: 'chat' });
  assert.ok(/data-action="kopieren"/.test(chat), 'kein Masterprompt im Chat-Weg');
  assert.ok(chat.indexOf('greenfield-bauspec.txt') < 0, 'Bau-Auftrag im Chat-Weg');
});

test('Schritte mit nur einem Arbeitsweg zeigen keine Wahl', () => {
  const i = mitWegen();
  i['ablage-kontrakt'].schritte['7'] = { ordner: '06_moodle', datei: '{K}_export.mbz',
    format: 'binaer', wege: ['claude-code', 'hochladen'], gate: null };
  const h = ansichten.einSchritt(i, AFL, 7, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(!/data-action="weg"/.test(h), 'Wegwahl bei nur einem Arbeitsweg');
});
