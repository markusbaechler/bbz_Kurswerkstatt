const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');

/* zip-lesen.js vorab requiren, damit root.zipLesen steht, BEVOR xlsx-lesen.js
   geladen wird — dieselbe Reihenfolge wie in index.html (Etappe 3, Task A1:
   der ZIP-Kern liegt seither dort, xlsx-lesen.js nutzt ihn ueber Z()). */
require('../zip-lesen.js');
const { xlsxLesen } = require('../xlsx-lesen.js');

/* ---------- Test-Helper: eine minimale xlsx als ArrayBuffer bauen ----------
   Kein ZIP-/xlsx-Werkzeug im Projekt (Konvention 1 — kein Paketmanager) und
   keins im Test noetig: dieselbe Handvoll ZIP-Strukturen, die xlsx-lesen.js
   selbst liest, hier einmal von Hand geschrieben statt gelesen. zlib dient
   NUR als Test-Datengenerator fuer den deflate-Pfad (Node-Bordmittel, laeuft
   nie im Browser mit) — xlsx-lesen.js selbst bleibt ohne jede Abhaengigkeit,
   es entpackt mit DecompressionStream. */

function localHeader(nameBuf, method, csize, usize) {
  const b = Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(0, 6);
  b.writeUInt16LE(method, 8);
  b.writeUInt16LE(0, 10);
  b.writeUInt16LE(0, 12);
  b.writeUInt32LE(0, 14);              // crc32 - vom Leser nie geprueft
  b.writeUInt32LE(csize, 18);
  b.writeUInt32LE(usize, 22);
  b.writeUInt16LE(nameBuf.length, 26);
  b.writeUInt16LE(0, 28);
  return b;
}

function centralHeader(nameBuf, method, csize, usize, localOffset) {
  const b = Buffer.alloc(46);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(20, 6);
  b.writeUInt16LE(0, 8);
  b.writeUInt16LE(method, 10);
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

/* entries: [{ name, data (string), method: 0|8 }] */
function buildZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.from(entry.data, 'utf8');
    const method = entry.method || 0;
    const dataBuf = method === 8 ? zlib.deflateRawSync(rawBuf) : rawBuf;

    const lh = localHeader(nameBuf, method, dataBuf.length, rawBuf.length);
    const localOffset = offset;
    parts.push(lh, nameBuf, dataBuf);
    offset += lh.length + nameBuf.length + dataBuf.length;

    central.push(centralHeader(nameBuf, method, dataBuf.length, rawBuf.length, localOffset), nameBuf);
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

function colLetter(n) {
  let s = '', k = n + 1;
  while (k > 0) {
    const rem = (k - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    k = Math.floor((k - 1) / 26);
  }
  return s;
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Eine Zelle: entweder ein Klartext (inlineStr) oder { shared: idx } fuer
   eine Referenz in die sharedStrings-Tabelle (t="s") — Finding F3. */
function cellXml(colIndex, rowIndex, spec) {
  const ref = colLetter(colIndex) + rowIndex;
  if (spec === null || spec === undefined || spec === '') return '';
  if (typeof spec === 'object' && spec.shared !== undefined) {
    return '<c r="' + ref + '" t="s"><v>' + spec.shared + '</v></c>';
  }
  return '<c r="' + ref + '" t="inlineStr"><is><t>' + escXml(spec) + '</t></is></c>';
}

function rowXml(rowIndex, cells) {
  const cellsXml = cells.map((v, i) => cellXml(i, rowIndex, v)).join('');
  return '<row r="' + rowIndex + '">' + cellsXml + '</row>';
}

/* strings: Eintraege sind entweder ein Klartext (<si><t>…</t></si>) oder ein
   Array von Runs fuer Rich-Text (<si><r><t>…</t></r><r><t>…</t></r></si>) —
   Finding F3 verlangt genau diesen Rich-Text-Fall. */
function sharedStringsXml(strings) {
  const siList = strings.map((s) => {
    if (Array.isArray(s)) {
      return '<si>' + s.map((run) => '<r><t>' + escXml(run) + '</t></r>').join('') + '</si>';
    }
    return '<si><t>' + escXml(s) + '</t></si>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
         '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
         'count="' + strings.length + '" uniqueCount="' + strings.length + '">' +
         siList + '</sst>';
}

function sheetXml(rows) {
  const rowsXml = rows.map((r, i) => rowXml(i + 1, r)).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
         '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
         '<sheetData>' + rowsXml + '</sheetData></worksheet>';
}

function workbookXml(sheetNames) {
  const sheetsXml = sheetNames.map((name, i) =>
    '<sheet name="' + escXml(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
         '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
         'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
         '<sheets>' + sheetsXml + '</sheets></workbook>';
}

function relsXml(count) {
  const rels = [];
  for (let i = 1; i <= count; i++) {
    rels.push('<Relationship Id="rId' + i + '" Type="http://schemas.openxmlformats.org/' +
      'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + i + '.xml"/>');
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
         rels.join('') + '</Relationships>';
}

/* sheets: [{ name, rows: [[..], ...] }] */
function buildXlsx(sheets, method) {
  const entries = [
    { name: 'xl/workbook.xml', data: workbookXml(sheets.map((s) => s.name)), method: method },
    { name: 'xl/_rels/workbook.xml.rels', data: relsXml(sheets.length), method: method }
  ];
  sheets.forEach((s, i) => {
    entries.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s.rows), method: method });
  });
  return buildZip(entries);
}

/* ---------- Tests ---------- */

const SHEETS = [
  { name: '1_Lernziele', rows: [
    ['Lernziel-ID', 'Thema', 'Definition'],
    ['LZ-001', 'Basiswissen', 'irgendwas']
  ] },
  { name: '_steckbrief', rows: [
    ['feld', 'wert'],
    ['kurs', 'AFL-001']
  ] }
];

test('store-only (Methode 0): Blattnamen in Reihenfolge und Kopfzeile je Blatt', async () => {
  const buf = buildXlsx(SHEETS, 0);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl.map((b) => b.name), ['1_Lernziele', '_steckbrief']);
  assert.deepStrictEqual(bl[0].kopf, ['Lernziel-ID', 'Thema', 'Definition']);
  assert.deepStrictEqual(bl[1].kopf, ['feld', 'wert']);
});

/* Grenze (dokumentiert, s. CLAUDE.md T11): dieser Test deckt den
   DecompressionStream('deflate-raw')-Pfad nur so ab, wie Node 18+ ihn nativ
   bereitstellt — eine echte Browser-Verifikation (Chrome/Edge) fand nicht
   statt. Die API ist dieselbe; ein tatsaechlicher Engine-Unterschied waere
   trotzdem denkbar und ist mit dieser Testsuite nicht auszuschliessen. */
test('deflate (Methode 8): derselbe Inhalt, komprimiert', async () => {
  const buf = buildXlsx(SHEETS, 8);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl.map((b) => b.name), ['1_Lernziele', '_steckbrief']);
  assert.deepStrictEqual(bl[0].kopf, ['Lernziel-ID', 'Thema', 'Definition']);
});

test('ein Blatt ohne Zeilen liefert eine leere Kopfzeile, keinen Crash', async () => {
  const buf = buildXlsx([{ name: 'leer', rows: [] }], 0);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl, [{ name: 'leer', kopf: [] }]);
});

test('kein Zip-Archiv: die Promise wird abgelehnt (M6: Wortlaut nennt "Zip", nicht "xlsx" — dieselbe Funktion liest auch docx)', async () => {
  const text = Buffer.from('das ist kein Zip', 'utf8');
  const buf = text.buffer.slice(text.byteOffset, text.byteOffset + text.byteLength);
  await assert.rejects(() => xlsxLesen.blaetterUndKoepfe(buf), /Kein Zip-Archiv: Zip-Verzeichnis nicht gefunden/);
});

test('ein Zip ohne xl/workbook.xml: die Promise wird abgelehnt', async () => {
  const buf = buildZip([{ name: 'irgendwas.xml', data: '<x/>', method: 0 }]);
  await assert.rejects(() => xlsxLesen.blaetterUndKoepfe(buf), /xl\/workbook\.xml fehlt/);
});

test('eine nicht unterstuetzte Zip-Kompressionsmethode wird klar gemeldet', async () => {
  const entries = [
    { name: 'xl/workbook.xml', data: workbookXml(['x']), method: 0 },
    { name: 'xl/_rels/workbook.xml.rels', data: relsXml(1), method: 0 },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml([['a']]), method: 99 }
  ];
  const buf = buildZip(entries);
  await assert.rejects(
    () => xlsxLesen.blaetterUndKoepfe(buf),
    /Methode 99/
  );
});

/* ---------- Mutationsprobe (im Report belegt) ----------
   Vertauscht man in buildXlsx() die Reihenfolge der beiden Sheets in SHEETS
   nicht — sondern kommentiert stattdessen im Modul xlsx-lesen.js die Zeile
   `if (!e[sh.pfad]) continue;` innerhalb der Blattschleife aus (ersetzt durch
   ein bedingungsloses Weiterlesen), muss der Test "ein Blatt ohne Zeilen…"
   NICHT betroffen sein, aber ein zusaetzlicher, gezielter Test unten auf ein
   fehlendes rels-Target faengt genau das ab: fehlt eine Zuordnung, wird das
   Blatt heute uebersprungen statt einen Crash auf leerem Pfad zu erzeugen. */
test('ein Sheet ohne aufloesbares rels-Target wird uebersprungen, kein Crash', async () => {
  const entries = [
    { name: 'xl/workbook.xml', data: workbookXml(['a', 'b']), method: 0 },
    /* nur EINE Relationship fuer zwei sheets */
    { name: 'xl/_rels/workbook.xml.rels', data: relsXml(1), method: 0 },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml([['nur', 'a']]), method: 0 }
  ];
  const buf = buildZip(entries);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl.map((b) => b.name), ['a']);
});

/* ---------- Fix-Runde 1 (Review opus, Messungen an VL-002/AFL-001) ---------- */

/* F1 — gemessen an der echten AFL-001-Datei: eine Titelzeile vor der
   Kopfzeile erzeugte vier Fehlalarme, weil xlsx-lesen.js bisher stur <row>
   Nummer 1 nahm statt wie contract-pruefen.cjs kopfzeile() die erste Zeile
   mit mindestens zwei nichtleeren Zellen zu suchen. */
test('F1: eine Titelzeile vor der echten Kopfzeile wird uebersprungen (AFL-001-Fall)', async () => {
  const buf = buildXlsx([{ name: '2_Eingangskompetenzen', rows: [
    ['TABELLE 2 - Eingangskompetenzen'],                          /* nur 1 nichtleere Zelle */
    ['EK-ID', 'Thema', 'Definition', 'Wissensziel']
  ] }], 0);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl[0].kopf, ['EK-ID', 'Thema', 'Definition', 'Wissensziel']);
});

test('F1: eine leere erste Zeile (<row r="1"></row>) wird uebersprungen, nicht als Kopfzeile gewertet', async () => {
  const buf = buildXlsx([{ name: 'x', rows: [[], ['Lernziel-ID', 'Thema']] }], 0);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl[0].kopf, ['Lernziel-ID', 'Thema']);
});

test('F1: keine Zeile qualifiziert -> leere Kopfzeile, wie kopfzeile() in contract-pruefen.cjs', async () => {
  const buf = buildXlsx([{ name: 'x', rows: [['nur eine Zelle'], ['auch nur eine']] }], 0);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl[0].kopf, []);
});

/* F3 — Mutationsprobe im vorherigen Report zeigte: der t==="s"-Zweig war
   ungetestet, obwohl JEDE echte Contract-Excel shared strings nutzt. Test
   deckt beides ab: eine einfache shared-string-Referenz und Rich-Text (ein
   <si> mit mehreren <r><t>-Runs). */
test('F3: Kopfzelle mit t="s" (shared strings), inkl. Rich-Text-<si> mit mehreren Runs', async () => {
  const ss = [
    'Lernziel-ID',                 /* Index 0 */
    ['Thema', '(Pflicht)'],        /* Index 1 — Rich-Text: zwei <r>-Runs in EINEM <si> */
    'Definition'                   /* Index 2 */
  ];
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' +
    rowXml(1, [{ shared: 0 }, { shared: 1 }, { shared: 2 }]) +
    rowXml(2, ['LZ-001', 'Basiswissen', 'irgendwas']) +
    '</sheetData></worksheet>';
  const entries = [
    { name: 'xl/workbook.xml', data: workbookXml(['1_Lernziele']), method: 0 },
    { name: 'xl/_rels/workbook.xml.rels', data: relsXml(1), method: 0 },
    { name: 'xl/sharedStrings.xml', data: sharedStringsXml(ss), method: 0 },
    { name: 'xl/worksheets/sheet1.xml', data: sheet, method: 0 }
  ];
  const buf = buildZip(entries);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  /* Bekannte, von contract-lesen.cjs geerbte Grenze (nicht Teil dieser Task):
     text() trimmt JEDEN <t>-Fragment-Text einzeln vor dem Zusammenfuegen der
     Runs — ein Leerzeichen an einer Run-Grenze geht dabei verloren, auch mit
     xml:space="preserve". Deshalb hier bewusst ohne Leerzeichen an der Grenze:
     der Test beweist, dass mehrere Runs ueberhaupt zusammengefuegt werden
     (das war der ungetestete Pfad, F3), nicht dass Leerraum erhalten bleibt. */
  assert.deepStrictEqual(bl[0].kopf, ['Lernziel-ID', 'Thema(Pflicht)', 'Definition']);
});

/* F4 — Mutationsprobe im vorherigen Report zeigte: ein Positionsraten
   (sheetN.xml nach Deklarationsreihenfolge statt ueber r:id/rels) blieb
   unentdeckt. Dieser Test verdreht rels absichtlich gegen die "natuerliche"
   Reihenfolge: sheet1.xml gehoert zum ZWEITEN deklarierten Blatt, sheet2.xml
   zum ERSTEN. Nur eine echte r:id-Aufloesung liefert die richtige Zuordnung. */
test('F4: r:id/rels-Aufloesung ist bindend, nicht die Position in <sheets> oder im Dateinamen', async () => {
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    '<sheet name="Erstes" sheetId="1" r:id="rId1"/>' +
    '<sheet name="Zweites" sheetId="2" r:id="rId2"/>' +
    '</sheets></workbook>';
  /* absichtlich verdreht: rId1 (erstes deklariertes Blatt) zeigt auf
     sheet2.xml, rId2 (zweites) auf sheet1.xml */
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/' +
    'relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/' +
    'relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>';
  const entries = [
    { name: 'xl/workbook.xml', data: workbook, method: 0 },
    { name: 'xl/_rels/workbook.xml.rels', data: rels, method: 0 },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml([['Z-ID', 'ZThema']]), method: 0 },
    { name: 'xl/worksheets/sheet2.xml', data: sheetXml([['E-ID', 'EThema']]), method: 0 }
  ];
  const buf = buildZip(entries);
  const bl = await xlsxLesen.blaetterUndKoepfe(buf);
  assert.deepStrictEqual(bl.map((b) => b.name), ['Erstes', 'Zweites']);
  assert.deepStrictEqual(bl[0].kopf, ['E-ID', 'EThema'], 'Erstes (rId1) muss sheet2.xml bekommen');
  assert.deepStrictEqual(bl[1].kopf, ['Z-ID', 'ZThema'], 'Zweites (rId2) muss sheet1.xml bekommen');
});
