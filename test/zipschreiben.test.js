const test = require('node:test');
const assert = require('node:assert');

/* zip-lesen.js vorab requiren (root.zipLesen), damit der Rundgang-Test
   zip-lesen.js als Pruefstein nutzen kann — dieselbe Reihenfolge wie in
   index.html (Etappe 3b, Task B1: zip-schreiben.js steht dort neben
   zip-lesen.js). */
require('../zip-lesen.js');
const { zipSchreiben } = require('../zip-schreiben.js');
const { zipLesen } = require('../zip-lesen.js');

/* Liest das 4-Byte-CRC-32-Feld des ERSTEN lokalen Headers direkt aus den
   gebauten Bytes (Offset 14, s. ZIP-Spec 4.3.7) — unabhaengig von
   zipLesen, das CRCs beim Lesen nie prueft (s. Kommentar in zip-lesen.js/
   entpacke: "Methode 0 ... liefert textDecode(roh)", kein CRC-Check). Ein
   kaputt gerechneter CRC wuerde im blossen Rundgang-Test NICHT auffallen —
   dieser Test ist deshalb Pflicht, nicht nur Zierde (s. Task-Brief B1). */
function crcAusLokalemHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint32(14, true);
}

/* Liest das General-Purpose-Flag-Feld des ERSTEN lokalen Headers (Offset 6). */
function flagAusLokalemHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint16(6, true);
}

test('CRC-32 von "abc" ist der bekannte Vektor 0x352441C2', () => {
  const out = zipSchreiben.baue([{ name: 'a.txt', daten: 'abc' }]);
  assert.strictEqual(crcAusLokalemHeader(out), 0x352441C2);
});

test('Rundgang ueber zipLesen: ein Text-Eintrag kommt zeichenidentisch zurueck', async () => {
  const out = zipSchreiben.baue([{ name: 'word/document.xml', daten: '<x>Hallo Welt</x>' }]);
  const zip = zipLesen.oeffne(out.buffer);
  const text = await zip.lies('word/document.xml');
  assert.strictEqual(text, '<x>Hallo Welt</x>');
});

test('Rundgang mit mehreren Eintraegen: jeder Eintrag ist einzeln und komplett lesbar', async () => {
  const out = zipSchreiben.baue([
    { name: '[Content_Types].xml', daten: '<Types/>' },
    { name: 'word/document.xml', daten: '<w:document><w:body><w:p><w:r><w:t>Text</w:t></w:r></w:p></w:body></w:document>' },
    { name: 'word/_rels/document.xml.rels', daten: '<Relationships/>' }
  ]);
  const zip = zipLesen.oeffne(out.buffer);
  assert.strictEqual(Object.keys(zip.eintraege).length, 3);
  assert.strictEqual(await zip.lies('[Content_Types].xml'), '<Types/>');
  assert.strictEqual(await zip.lies('word/document.xml'),
    '<w:document><w:body><w:p><w:r><w:t>Text</w:t></w:r></w:p></w:body></w:document>');
  assert.strictEqual(await zip.lies('word/_rels/document.xml.rels'), '<Relationships/>');
});

test('leerer Eintrag (Sonderfall): eine leere Datei bleibt eine leere Datei', async () => {
  const out = zipSchreiben.baue([{ name: 'leer.txt', daten: '' }]);
  assert.strictEqual(crcAusLokalemHeader(out), 0); // CRC-32 des leeren Inputs ist 0
  const zip = zipLesen.oeffne(out.buffer);
  assert.strictEqual(await zip.lies('leer.txt'), '');
});

test('Umlaut-Name (Sonderfall): UTF-8-Flag (Bit 11) gesetzt, Name bleibt lesbar', async () => {
  const out = zipSchreiben.baue([{ name: 'Übersicht ä ö ü.txt', daten: 'Grüezi mitenand' }]);
  assert.strictEqual(flagAusLokalemHeader(out) & 0x0800, 0x0800);
  const zip = zipLesen.oeffne(out.buffer);
  assert.ok(zip.eintraege['Übersicht ä ö ü.txt']);
  assert.strictEqual(await zip.lies('Übersicht ä ö ü.txt'), 'Grüezi mitenand');
});

test('rein ASCII-Name traegt das UTF-8-Flag NICHT', () => {
  const out = zipSchreiben.baue([{ name: 'plain.txt', daten: 'x' }]);
  assert.strictEqual(flagAusLokalemHeader(out) & 0x0800, 0);
});

test('daten mit Nicht-ASCII-Inhalt (String) wird nach UTF-8 kodiert und zeichenidentisch zurueckgelesen', async () => {
  const out = zipSchreiben.baue([{ name: 'x.txt', daten: 'Grüezi — Café ñ' }]);
  const zip = zipLesen.oeffne(out.buffer);
  assert.strictEqual(await zip.lies('x.txt'), 'Grüezi — Café ñ');
});

test('daten als Uint8Array (statt String) wird unveraendert uebernommen', async () => {
  const bytes = new TextEncoder().encode('Hallo als Uint8Array');
  const out = zipSchreiben.baue([{ name: 'y.txt', daten: bytes }]);
  const zip = zipLesen.oeffne(out.buffer);
  assert.strictEqual(await zip.lies('y.txt'), 'Hallo als Uint8Array');
});

test('kein Eintrag: baue([]) liefert ein gueltiges, leeres Zip-Archiv', () => {
  const out = zipSchreiben.baue([]);
  const zip = zipLesen.oeffne(out.buffer);
  assert.deepStrictEqual(Object.keys(zip.eintraege), []);
});

test('kein Eintrag-Argument (undefined) verhaelt sich wie ein leeres Array', () => {
  const out = zipSchreiben.baue();
  const zip = zipLesen.oeffne(out.buffer);
  assert.deepStrictEqual(Object.keys(zip.eintraege), []);
});

test('Methode ist in jedem Eintrag Store (0) — keine Kompression', async () => {
  const out = zipSchreiben.baue([{ name: 'store.txt', daten: 'unkomprimiert' }]);
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  assert.strictEqual(dv.getUint16(8, true), 0); // Methode im lokalen Header
  const zip = zipLesen.oeffne(out.buffer);
  assert.strictEqual(zip.eintraege['store.txt'].methode, 0);
});
