const test = require('node:test');
const assert = require('node:assert');

/* Ladereihenfolge wie in index.html (Etappe 3b, Task B4): zip-lesen vor
   zip-schreiben vor skript-schema vor skript-lesen vor docx-bauen. */
require('../zip-lesen.js');
require('../zip-schreiben.js');
require('../skript-schema.js');
require('../skript-lesen.js');
const { zipLesen } = require('../zip-lesen.js');
const { zipSchreiben } = require('../zip-schreiben.js');
const { skriptLesen } = require('../skript-lesen.js');
const { docxBauen } = require('../docx-bauen.js');

/* ---------- PFLICHT-VORAUFGABE: zipLesen.liesBytes() — der Byte-Beweis ----------
   B1 bewies nur den Text-Rundgang (zeichenidentisch nach UTF-8 hin und
   zurueck) — ein Binaerteil (Thumbnail, Font) verlangt bytegenaue Durchreiche,
   die textDecode()/TextEncoder() nicht garantieren (ungueltige UTF-8-Folgen
   werden beim Dekodieren ersetzt). Dieser Test faehrt deshalb alle 256
   Byte-Werte einmal durch schreiben -> liesBytes -> deepStrictEqual. */
test('liesBytes(): ein Binaer-Eintrag (Bytes 0-255) roundtrippt byte-identisch', async () => {
  const bin = new Uint8Array(256);
  for (let i = 0; i < 256; i++) bin[i] = i;
  const out = zipSchreiben.baue([{ name: 'word/media/dummy.bin', daten: bin }]);
  const zip = zipLesen.oeffne(out.buffer);
  const zurueck = await zip.liesBytes('word/media/dummy.bin');
  assert.ok(zurueck instanceof Uint8Array);
  assert.deepStrictEqual(zurueck, bin);
});

test('liesBytes(): ein fehlender Eintrag liefert ein leeres Uint8Array, wirft nicht', async () => {
  const out = zipSchreiben.baue([{ name: 'a.txt', daten: 'x' }]);
  const zip = zipLesen.oeffne(out.buffer);
  const zurueck = await zip.liesBytes('fehlt.bin');
  assert.deepStrictEqual(zurueck, new Uint8Array(0));
});

test('bestehende lies()-Textfunktion bleibt nach dem liesBytes()-Umbau unveraendert', async () => {
  const out = zipSchreiben.baue([{ name: 'x.txt', daten: 'Grüezi — Café ñ' }]);
  const zip = zipLesen.oeffne(out.buffer);
  assert.strictEqual(await zip.lies('x.txt'), 'Grüezi — Café ñ');
});

/* ---------- Mini-Vorlage als Test-ZIP (zipSchreiben) ---------- */

function fakePng(breite, hoehe) {
  const b = new Uint8Array(33);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) b[i] = sig[i];
  const dv = new DataView(b.buffer);
  dv.setUint32(8, 13, false);              // IHDR-Datenlaenge
  b[12] = 73; b[13] = 72; b[14] = 68; b[15] = 82; // 'IHDR'
  dv.setUint32(16, breite, false);
  dv.setUint32(20, hoehe, false);
  b[24] = 8; b[25] = 6; b[26] = 0; b[27] = 0; b[28] = 0; // Tiefe/Typ/Komp/Filter/Interlace
  return b; // Bytes 29-32 (CRC) bleiben 0 — vom Parser nie geprueft
}

const STYLES_XML = '<w:styles><w:style w:styleId="Titel"><w:name w:val="Title"/></w:style>' +
  '<w:style w:styleId="berschrift1"><w:name w:val="heading 1"/></w:style></w:styles>';

function vorlageBauen(opts) {
  opts = opts || {};
  const docXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>Alter Inhalt, wird ersetzt</w:t></w:r></w:p>' +
    (opts.ohneSectPr ? '' : '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr>') +
    '</w:body></w:document>';
  const relsXml = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
  const ctXml = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    (opts.mitPngDefault ? '<Default Extension="png" ContentType="image/png"/>' : '') +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const dummyBin = new Uint8Array(64);
  for (let i = 0; i < 64; i++) dummyBin[i] = (i * 7) % 256;

  const eintraege = [
    { name: '[Content_Types].xml', daten: ctXml },
    { name: 'word/document.xml', daten: docXml },
    { name: 'word/_rels/document.xml.rels', daten: relsXml },
    { name: 'word/styles.xml', daten: STYLES_XML },
    { name: 'word/media/vorlage-dummy.bin', daten: dummyBin }
  ];
  const buf = zipSchreiben.baue(eintraege);
  return { buffer: buf.buffer, dummyBin: dummyBin };
}

/* ---------- Fixture-`gelesen` ueber die echte skriptLesen-Kette ---------- */

const BLOCKTEXT = [
  '###SKRIPT kurs=BX-001 | variante=claude | titel=Testtitel | rechtsstand=01.01.2026',
  '###QUELLEN',
  'gelesen: Quelle A, 2026',
  'nicht-geoeffnet: Quelle B - gesperrt',
  '###KAPITEL nr=1 | ek=BX-001-EK-001 | titel=Kapitelname | bloom=2 | richtzeit=20',
  '###HERO', 'Eine Szene.',
  '###STORY', 'Eine Geschichte.',
  '###DEFINITION', 'Kurzdefinition.', 'Zweite Zeile Erklaerungstext.',
  '###ERKLAERUNG', 'Erklaerungstitel.', 'Details dazu.',
  '###FEHLVORSTELLUNG', 'Ein Irrtum.',
  '###BEISPIEL', 'Einleitungssatz.', '- Erster Punkt', '- Zweiter Punkt',
  '###ABBILDUNG typ=vergleichstabelle | titel=Vergleich',
  'kopf: A | B',
  'zeilen: 1 | 2',
  'zeilen: 3 | 4',
  '###ABBILDUNG typ=kompositions-leiste | titel=Verteilung',
  'werte: Teil eins 1 | Teil zwei 2',
  '###INTERAKTION', 'Mach mit.',
  '###MERKSATZ', 'Merke dir das.',
  '###DEEPDIVE', 'Tiefer graben.',
  '###WISSENSCHECK', 'frage: Stimmt das?', 'loesung: ja', 'begruendung: weil.',
  '###ABSCHLUSS', 'Zusammenfassung.',
  '###ENDE-KAPITEL',
  '###ZUORDNUNG', 'Kapitel 1 | BX-001-EK-001 | Reihenfolge wie Contract',
  '###OFFEN', 'Ein offener Punkt.'
].join('\n');

function gelesenFixture() {
  return skriptLesen.lies(BLOCKTEXT);
}

function bilderFixture() {
  const bilder = {};
  bilder[docxBauen.bildDateiname('BX-001', 'claude', 1)] = fakePng(200, 100);
  return bilder;
}

/* ---------- document.xml aus dem Ergebnis auslesen (Test-Helfer) ---------- */

async function docXmlAus(bytes) {
  const zip = zipLesen.oeffne(bytes.buffer);
  return zip.lies('word/document.xml');
}

/* ---------- Tests ---------- */

test('baue(): pStyle je Baustein steht im document.xml', async () => {
  const { buffer } = vorlageBauen();
  const gelesen = gelesenFixture();
  assert.deepStrictEqual(gelesen.fehler, []);
  const out = await docxBauen.baue(buffer, gelesen, bilderFixture());
  const xml = await docXmlAus(out);
  for (const stil of ['Titel', 'berschrift1', 'berschrift2', 'Hero', 'Story',
    'Fehlvorstellung', 'Beispiel', 'Wissenscheck', 'Merksatz', 'DeepDive', 'Abschluss', 'Quelle']) {
    assert.ok(xml.indexOf('w:pStyle w:val="' + stil + '"') >= 0, 'pStyle fehlt: ' + stil);
  }
});

test('baue(): kein "###" im erzeugten document.xml', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const xml = await docXmlAus(out);
  assert.strictEqual(xml.indexOf('###'), -1);
});

test('baue(): Listenabsatz in einem Kasten behaelt den Kasten-pStyle (Politur-Fix)', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const xml = await docXmlAus(out);
  // Der Absatz mit dem Bullet-Text traegt denselben pStyle="Beispiel" wie der Rest des Kastens.
  const re = /<w:p><w:pPr><w:pStyle w:val="Beispiel"\/><\/w:pPr><w:r><w:t xml:space="preserve">– Erster Punkt<\/w:t><\/w:r><\/w:p>/;
  assert.ok(re.test(xml), 'Listenabsatz mit Kasten-pStyle nicht gefunden: ' + xml.slice(0, 0));
  assert.ok(xml.indexOf('– Erster Punkt') >= 0, 'Bullet-Glyph-Praefix fehlt');
  assert.ok(xml.indexOf('- Erster Punkt') === -1, 'roher Bindestrich-Praefix haette ersetzt werden muessen');
});

test('baue(): sectPr der Vorlage wird uebernommen', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('<w:pgSz w:w="11906" w:h="16838"/>') >= 0);
  // genau ein sectPr, ganz am Ende von w:body
  const anzahl = (xml.match(/<w:sectPr/g) || []).length;
  assert.strictEqual(anzahl, 1);
});

test('baue(): styles.xml und ein Binaer-Vorlagenteil sind byte-identisch durchgereicht', async () => {
  const { buffer, dummyBin } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const zip = zipLesen.oeffne(out.buffer);
  assert.strictEqual(await zip.lies('word/styles.xml'), STYLES_XML);
  const zurueck = await zip.liesBytes('word/media/vorlage-dummy.bin');
  assert.deepStrictEqual(zurueck, dummyBin);
});

test('baue(): bestehende Relationship (rId1, styles.xml) bleibt erhalten, Bild-Relationship kommt dazu', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const zip = zipLesen.oeffne(out.buffer);
  const rels = await zip.lies('word/_rels/document.xml.rels');
  assert.ok(rels.indexOf('Id="rId1"') >= 0 && rels.indexOf('Target="styles.xml"') >= 0);
  assert.ok(/Id="rId2"[^>]*Type="[^"]*\/image"[^>]*Target="media\/BX-001-claude-abb-001\.png"/.test(rels));
});

test('baue(): [Content_Types].xml bekommt den png-Default ergaenzt', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const zip = zipLesen.oeffne(out.buffer);
  const ct = await zip.lies('[Content_Types].xml');
  assert.ok(/<Default Extension="png" ContentType="image\/png"\/>/.test(ct));
});

test('baue(): ein bereits vorhandener png-Default wird NICHT verdoppelt', async () => {
  const { buffer } = vorlageBauen({ mitPngDefault: true });
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const zip = zipLesen.oeffne(out.buffer);
  const ct = await zip.lies('[Content_Types].xml');
  const anzahl = (ct.match(/Extension="png"/g) || []).length;
  assert.strictEqual(anzahl, 1);
});

test('baue(): das Bild liegt unter word/media/ und die Extent-EMU stammen aus dem PNG-IHDR (px * 9525)', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const zip = zipLesen.oeffne(out.buffer);
  assert.ok(zip.eintraege['word/media/BX-001-claude-abb-001.png']);
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('<wp:extent cx="1905000" cy="952500"/>') >= 0); // 200*9525, 100*9525
});

test('baue(): vergleichstabelle wird eine w:tbl, keine Abbildung', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('<w:tbl>') >= 0);
  assert.ok(xml.indexOf('<w:gridCol') >= 0 && xml.indexOf('w:type="dxa"') >= 0);
  assert.ok(xml.indexOf('>A<') >= 0 && xml.indexOf('>B<') >= 0);
  assert.ok(xml.indexOf('>1<') >= 0 && xml.indexOf('>4<') >= 0);
});

test('baue(): Quellenverzeichnis und Ergaenzungen (mit Inhalt) stehen im Dokument', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('Quellenverzeichnis') >= 0);
  assert.ok(xml.indexOf('Gelesene Quellen') >= 0 && xml.indexOf('Quelle A, 2026') >= 0);
  assert.ok(xml.indexOf('Nicht ge') >= 0 && xml.indexOf('Quelle B - gesperrt') >= 0);
  assert.ok(xml.indexOf('Erg') >= 0 && xml.indexOf('Ein offener Punkt.') >= 0);
});

test('baue(): Ergaenzungen ohne offene Punkte zeigt "- keine"', async () => {
  const { buffer } = vorlageBauen();
  const gelesen = gelesenFixture();
  gelesen.offen = [];
  const out = await docxBauen.baue(buffer, gelesen, bilderFixture());
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('- keine') >= 0);
});

test('baue(): ohne <w:sectPr> in der Vorlage wird abgelehnt', async () => {
  const { buffer } = vorlageBauen({ ohneSectPr: true });
  await assert.rejects(() => docxBauen.baue(buffer, gelesenFixture(), bilderFixture()), /sectPr/);
});

test('baue(): fehlt ein Bild fuer eine nicht-tabellarische Abbildung, wird abgebrochen', async () => {
  const { buffer } = vorlageBauen();
  await assert.rejects(() => docxBauen.baue(buffer, gelesenFixture(), {}), /Bild fehlt/);
});

test('baue(): ILLUSTRATION an Hero-Position, wenn datei: gesetzt UND in bilder vorhanden (B6-Vorgriff, tolerant)', async () => {
  const { buffer } = vorlageBauen();
  const gelesen = gelesenFixture();
  gelesen.kapitel[0].teile.ILLUSTRATION = 'datei: illustration.png';
  const bilder = bilderFixture();
  bilder['illustration.png'] = fakePng(400, 200);
  const out = await docxBauen.baue(buffer, gelesen, bilder);
  const zip = zipLesen.oeffne(out.buffer);
  assert.ok(zip.eintraege['word/media/illustration.png']);
  const xml = await docXmlAus(out);
  const posIllu = xml.indexOf('illustration.png');
  const posHero = xml.indexOf('Eine Szene.'); // HERO-Inhalt aus der Fixture
  assert.ok(posIllu >= 0 && posHero >= 0 && posIllu < posHero,
    'Illustration sollte vor dem Hero-Absatz stehen');
});

test('baue(): ILLUSTRATION ohne "datei:"-Feld oder ohne passendes Bild wird stillschweigend uebersprungen', async () => {
  const { buffer } = vorlageBauen();
  const gelesen1 = gelesenFixture();
  gelesen1.kapitel[0].teile.ILLUSTRATION = 'keine datei-Zeile hier';
  const out1 = await docxBauen.baue(buffer, gelesen1, bilderFixture());
  assert.ok(out1 instanceof Uint8Array); // kein Wurf

  const gelesen2 = gelesenFixture();
  gelesen2.kapitel[0].teile.ILLUSTRATION = 'datei: fehlt-in-bilder.png';
  const out2 = await docxBauen.baue(buffer, gelesen2, bilderFixture());
  const xml2 = await docXmlAus(out2);
  assert.strictEqual(xml2.indexOf('fehlt-in-bilder.png'), -1);
});

test('baue(): Vorlage ohne word/document.xml wird abgelehnt', async () => {
  const buf = zipSchreiben.baue([{ name: 'x.txt', daten: 'y' }]);
  await assert.rejects(() => docxBauen.baue(buf.buffer, gelesenFixture(), {}), /word\/document\.xml/);
});
