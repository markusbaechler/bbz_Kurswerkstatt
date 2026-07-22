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
