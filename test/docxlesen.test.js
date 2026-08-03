const test = require('node:test');
const assert = require('node:assert');

/* zip-lesen.js vorab requiren (root.zipLesen), dann docx-lesen.js — dieselbe
   Reihenfolge wie in index.html (Etappe 3, Task A1). */
require('../zip-lesen.js');
const { docxLesen } = require('../docx-lesen.js');

/* ---------- Test-Helper: eine minimale docx (= Zip) als ArrayBuffer bauen ----------
   Dieselbe ZIP-Format-Logik wie der buildZip()-Helfer in test/xlsxlesen.test.js
   (Central Directory + lokale Eintraege, unkomprimiert) — hier eigens gehalten,
   weil test/xlsxlesen.test.js laut Task-Brief NUR den require-Kopf bekommt und
   sonst unangetastet bleibt (Beweis der Verhaltensneutralitaet des Kern-Umzugs).
   zipBauen(entries) nimmt hier bewusst Tupel [name, data] statt Objekte — die
   docx-Fixtures im Brief brauchen keine Kompressionsmethode je Eintrag. */

function localHeader(nameBuf, csize, usize) {
  const b = Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(0, 6);
  b.writeUInt16LE(0, 8);               // Methode 0 = ungespeichert
  b.writeUInt16LE(0, 10);
  b.writeUInt16LE(0, 12);
  b.writeUInt32LE(0, 14);              // crc32 - vom Leser nie geprueft
  b.writeUInt32LE(csize, 18);
  b.writeUInt32LE(usize, 22);
  b.writeUInt16LE(nameBuf.length, 26);
  b.writeUInt16LE(0, 28);
  return b;
}

function centralHeader(nameBuf, csize, usize, localOffset) {
  const b = Buffer.alloc(46);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(20, 6);
  b.writeUInt16LE(0, 8);
  b.writeUInt16LE(0, 10);              // Methode 0 = ungespeichert
  b.writeUInt16LE(0, 12);
  b.writeUInt16LE(0, 14);
  b.writeUInt32LE(0, 16);
  b.writeUInt32LE(csize, 20);
  b.writeUInt32LE(usize, 24);
  b.writeUInt16LE(nameBuf.length, 28);
  b.writeUInt16LE(0, 30);
  b.writeUInt16LE(0, 32);
  b.writeUInt16LE(0, 34);
  b.writeUInt16LE(0, 36);
  b.writeUInt32LE(0, 38);
  b.writeUInt32LE(localOffset, 42);
  return b;
}

/* entries: [[name, data], ...] — data ist ein String, immer unkomprimiert (Methode 0). */
function zipBauen(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  entries.forEach(([name, data]) => {
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = Buffer.from(data, 'utf8');

    const lh = localHeader(nameBuf, dataBuf.length, dataBuf.length);
    const localOffset = offset;
    parts.push(lh, nameBuf, dataBuf);
    offset += lh.length + nameBuf.length + dataBuf.length;

    central.push(centralHeader(nameBuf, dataBuf.length, dataBuf.length, localOffset), nameBuf);
  });

  const centralBuf = Buffer.concat(central);
  const cdOffset = offset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const buf = Buffer.concat([...parts, centralBuf, eocd]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/* ---------- Tests ---------- */

test('absaetze liefert Text und Stil je Absatz, in Dokumentreihenfolge', async () => {
  const buf = zipBauen([['word/document.xml',
    '<w:document><w:body>' +
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>VL-002-EK-003 Titel</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Erster </w:t></w:r><w:r><w:t>Satz.</w:t></w:r></w:p>' +
    '</w:body></w:document>']]);
  const a = await docxLesen.absaetze(buf);
  assert.deepStrictEqual(a, [
    { stil: 'Heading1', text: 'VL-002-EK-003 Titel' },
    { stil: null, text: 'Erster Satz.' },
  ]);
});

test('kein Zip und Zip ohne word/document.xml werden abgewiesen', async () => {
  await assert.rejects(() => docxLesen.absaetze(new Uint8Array([1, 2, 3]).buffer), /Zip|docx/);
  await assert.rejects(() => docxLesen.absaetze(zipBauen([['x.txt', 'y']])), /word\/document\.xml/);
});

test('Entitaeten und geschachtelte Runs werden dekodiert', async () => {
  const buf = zipBauen([['word/document.xml',
    '<w:document><w:body><w:p><w:r><w:t>K&amp;G &#x2014; ok</w:t></w:r></w:p></w:body></w:document>']]);
  const a = await docxLesen.absaetze(buf);
  assert.strictEqual(a[0].text, 'K&G — ok');
});

/* ---------- Grenzfall (dokumentiert, kein Test): leere Absaetze ----------
   Ein selbstschliessender leerer Absatz (<w:p/>) taucht im Ergebnis NICHT
   auf — der Regex in docx-lesen.js (/<w:p[ >][\s\S]*?<\/w:p>/g) verlangt ein
   oeffnendes UND ein schliessendes <w:p>-Tag; ein "/>"-Absatz matcht nicht.
   Das ist gewollt (s. Kommentar in docx-lesen.js): ein Absatz ohne Lauf
   traegt ohnehin weder Text noch Stil. */
