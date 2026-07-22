const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1];

/* Schritt 4 fuehrt laut Kontrakt zwei Entwuerfe nebeneinander. */
function mitVarianten() {
  const i = JSON.parse(JSON.stringify(INHALT));
  i['ablage-kontrakt'].schritte['4'] = {
    ordner: '04_greenfield', lieferobjekt: 'greenfield-{variante}',
    varianten: ['claude', 'chatgpt'], ext: 'html', format: 'html',
    wege: ['chat', 'claude-code', 'hochladen'], gate: null
  };
  return i;
}

test('ohne Varianten im Kontrakt bleibt alles wie bisher', () => {
  assert.strictEqual(inhalt.varianten(INHALT, 3), null);
  assert.strictEqual(inhalt.lieferobjektVon(INHALT, 3), 'lernziele-drehbuch');
});

test('der Kontrakt gibt die erlaubten Varianten vor', () => {
  assert.deepStrictEqual(inhalt.varianten(mitVarianten(), 4), ['claude', 'chatgpt']);
});

test('der Platzhalter wird durch die Variante ersetzt', () => {
  const i = mitVarianten();
  assert.strictEqual(inhalt.lieferobjektVon(i, 4, 'claude'), 'greenfield-claude');
  assert.strictEqual(inhalt.lieferobjektVon(i, 4, 'chatgpt'), 'greenfield-chatgpt');
});

/* Der Fehler, den das verhindern soll: {variante} woertlich im Dateinamen. */
test('ohne Variante entsteht KEIN Dateiname', () => {
  const i = mitVarianten();
  assert.strictEqual(inhalt.lieferobjektVon(i, 4), null);
  assert.strictEqual(inhalt.naechsteDatei(i, 4, 'AFL-001', []), null);
  assert.strictEqual(inhalt.hochladeZiel(i, 4, 'AFL-001', [], undefined), null);
});

test('eine erfundene Variante wird nicht akzeptiert', () => {
  const i = mitVarianten();
  assert.strictEqual(inhalt.lieferobjektVon(i, 4, 'gemini'), null);
  assert.strictEqual(inhalt.hochladeZiel(i, 4, 'AFL-001', [], 'gemini'), null);
});

test('der Zielname traegt die Variante', () => {
  const z = inhalt.hochladeZiel(mitVarianten(), 4, 'AFL-001', [], 'claude');
  assert.strictEqual(z.ordner, '04_greenfield');
  assert.strictEqual(z.datei, 'AFL-001_greenfield-claude_v1.html');
  assert.strictEqual(z.variante, 'claude');
});

/* Der Kern der Entscheidung: die Varianten sind KEINE Versionen voneinander. */
test('jede Variante fuehrt ihre eigene Nummernreihe', () => {
  const i = mitVarianten();
  const da = [{ name: 'AFL-001_greenfield-claude_v1.html' },
              { name: 'AFL-001_greenfield-claude_v2.html' },
              { name: 'AFL-001_greenfield-chatgpt_v1.html' }];
  assert.strictEqual(inhalt.hochladeZiel(i, 4, 'AFL-001', da, 'claude').datei,
                     'AFL-001_greenfield-claude_v3.html');
  assert.strictEqual(inhalt.hochladeZiel(i, 4, 'AFL-001', da, 'chatgpt').datei,
                     'AFL-001_greenfield-chatgpt_v2.html');
});

test('die geltende Fassung wird je Variante bestimmt, nicht darueber hinweg', () => {
  const da = [{ name: 'AFL-001_greenfield-claude_v3.html' },
              { name: 'AFL-001_greenfield-chatgpt_final.html' }];
  assert.strictEqual(inhalt.geltendeDatei(da, 'AFL-001', 'greenfield-claude'),
                     'AFL-001_greenfield-claude_v3.html');
  assert.strictEqual(inhalt.geltendeDatei(da, 'AFL-001', 'greenfield-chatgpt'),
                     'AFL-001_greenfield-chatgpt_final.html');
});

test('die Endung kommt aus dem Kontrakt', () => {
  assert.strictEqual(inhalt.erwarteteEndung(mitVarianten(), 4), 'html');
});

/* ---------- Ansicht ---------- */

test('Schritt 4 bietet die Variantenwahl an', () => {
  const h = ansichten.einSchritt(mitVarianten(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [] });
  assert.ok(/data-action="variante"/.test(h), 'keine Variantenwahl');
  assert.ok(/data-variante="claude"/.test(h) && /data-variante="chatgpt"/.test(h));
  /* Genau auf die Variantenreiter zielen — die Masterprompts bringen eigene
     .ptab-Reiter mit (Claude/ChatGPT-Fassung), die hier nicht mitzaehlen. */
  assert.strictEqual((h.match(/class="ptab on" data-action="variante"/g) || []).length, 1,
                     'genau eine Variante muss vorgewaehlt sein');
});

test('der angezeigte Zielname folgt der gewaehlten Variante', () => {
  const i = mitVarianten();
  const a = ansichten.einSchritt(i, AFL, 4, null,
    { ordnerFehlt: false, dateien: [], variante: 'chatgpt' });
  assert.ok(a.indexOf('AFL-001_greenfield-chatgpt_v1.html') >= 0, 'falscher Zielname');
  assert.ok(a.indexOf('{variante}') < 0, 'Platzhalter im Dateinamen sichtbar');
});

test('Schritte ohne Varianten zeigen keine Wahl', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/data-action="hochladen"/.test(h), 'kein Upload auf Schritt 3');
  assert.ok(!/data-action="variante"/.test(h), 'Variantenwahl ohne Varianten im Kontrakt');
});

/* ---------- Der Weg Chat ----------
   Er war auf Schritt 4 funktionslos: Zielname und Sperre wurden ohne Variante
   berechnet, also gab lieferobjektVon null zurueck. Die Flaeche blieb bei
   "Ordner wird gelesen", Ablegen scheiterte immer, und "final ist final"
   griff nur im Weg Hochladen. Gefunden bei der Konsistenzpruefung 2026-07-22. */

/* Die effektive Variante — eine Quelle statt drei Kopien von
   `vari ? (gewaehlt || vari[0]) : undefined`. */
test('ohne Varianten im Kontrakt gibt es keine gewaehlte Variante', () => {
  assert.strictEqual(inhalt.gewaehlteVariante(INHALT, 3), undefined);
});

test('ohne getroffene Wahl gilt die erste Variante des Kontrakts', () => {
  assert.strictEqual(inhalt.gewaehlteVariante(mitVarianten(), 4), 'claude');
  assert.strictEqual(inhalt.gewaehlteVariante(mitVarianten(), 4, null), 'claude');
});

test('eine getroffene Wahl gilt', () => {
  assert.strictEqual(inhalt.gewaehlteVariante(mitVarianten(), 4, 'chatgpt'), 'chatgpt');
});

test('eine erfundene Wahl faellt auf die erste zurueck', () => {
  assert.strictEqual(inhalt.gewaehlteVariante(mitVarianten(), 4, 'gemini'), 'claude');
});

function chatFlaeche(h) {
  const a = h.indexOf('id="ergebnis"');
  const b = h.indexOf('Datei hochladen');
  return a < 0 ? '' : h.slice(a, b < 0 ? h.length : b);
}

test('der Weg Chat nennt den Zielnamen mit Variante', () => {
  const h = ansichten.einSchritt(mitVarianten(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [], variante: 'chatgpt' });
  const c = chatFlaeche(h);
  assert.ok(c.indexOf('AFL-001_greenfield-chatgpt_v1.html') >= 0, 'Zielname fehlt im Weg Chat');
  assert.ok(c.indexOf('Ordner wird gelesen') < 0, 'Weg Chat haengt bei "Ordner wird gelesen"');
});

test('der Zielname im Weg Chat zaehlt je Variante hoch', () => {
  const da = [{ name: 'AFL-001_greenfield-claude_v1.html' },
              { name: 'AFL-001_greenfield-claude_v2.html' }];
  const h = ansichten.einSchritt(mitVarianten(), AFL, 4, null,
    { ordnerFehlt: false, dateien: da, variante: 'claude' });
  assert.ok(chatFlaeche(h).indexOf('AFL-001_greenfield-claude_v3.html') >= 0, 'falsche Nummer');
});

test('final ist final sperrt auch den Weg Chat', () => {
  const h = ansichten.einSchritt(mitVarianten(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [{ name: 'AFL-001_greenfield-claude_final.html' }],
      variante: 'claude' });
  assert.ok(!/id="ergebnis"/.test(h), 'Textfeld trotz freigegebener Fassung');
  assert.ok(h.indexOf('<span class="bt">Final ist final</span>') >= 0,
            'kein Sperrhinweis im Weg Chat');
});

test('die Sperre gilt je Variante, nicht ueber beide hinweg', () => {
  const h = ansichten.einSchritt(mitVarianten(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [{ name: 'AFL-001_greenfield-claude_final.html' }],
      variante: 'chatgpt' });
  assert.ok(/id="ergebnis"/.test(h), 'die andere Variante wurde mitgesperrt');
});

test('die Variantenwahl steht vor der Ablege-Flaeche und genau einmal', () => {
  const h = ansichten.einSchritt(mitVarianten(), AFL, 4, null,
    { ordnerFehlt: false, dateien: [] });
  assert.ok(h.indexOf('data-action="variante"') < h.indexOf('data-action="ablegen"'),
            'die Wahl steht hinter dem Feld, in das das Ergebnis kommt');
  assert.strictEqual((h.match(/data-action="variante"/g) || []).length, 2,
                     'zwei Reihen Variantenreiter sind zwei Quellen fuer dieselbe Wahl');
});
