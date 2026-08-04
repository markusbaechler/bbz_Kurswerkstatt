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

/* Default-sectPr: A4 (11906 Twips) mit 1417-Twips-Raendern (2.5 cm) —
   Textbreite 11906 - 2*1417 = 9072 Twips = 5760720 EMU. opts.sectPr
   ueberschreibt das komplett (B9-F2: eigene pgSz/pgMar je Test moeglich). */
function vorlageBauen(opts) {
  opts = opts || {};
  const sectPr = opts.ohneSectPr ? '' : (opts.sectPr ||
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr>');
  const docXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>Alter Inhalt, wird ersetzt</w:t></w:r></w:p>' +
    sectPr +
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
  '###WISSENSCHECK', 'frage: Was trifft zu?', 'a) nichts', 'b) alles',
  'loesung: b', 'begruendung: weil es so ist',
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
  // IHDR traegt den Canvas-Faktor 2 aus diagrammZeichnen.png() (200x100) — die
  // LOGISCHE Groesse (die B5 mitliefert) ist die Haelfte davon (100x50). Bildet
  // damit den realen Anwendungsfall nach, den Finding 1 der Review adressiert:
  // wird die logische Groesse ignoriert, waere das Bild im Word doppelt so gross.
  bilder[docxBauen.bildDateiname('BX-001', 'claude', 1)] =
    { bytes: fakePng(200, 100), breite: 100, hoehe: 50 };
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

test('baue(): WISSENSCHECK wird formatgleich zum Tools-Bauer gerendert (Finding 2) — keine rohe Feldsyntax im Text', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const xml = await docXmlAus(out);
  // die rohen Feld-Praefixe duerfen nirgends im Leserdokument stehen
  assert.strictEqual(xml.indexOf('frage:'), -1);
  assert.strictEqual(xml.indexOf('loesung:'), -1);
  assert.strictEqual(xml.indexOf('begruendung:'), -1);
  // Frage, Antwortoptionen, Loesungsbuchstabe und Begruendung stehen als Text
  assert.ok(xml.indexOf('Was trifft zu?') >= 0);
  assert.ok(xml.indexOf('a) nichts') >= 0 && xml.indexOf('b) alles') >= 0);
  assert.ok(xml.indexOf('Lösung: b.') >= 0);
  assert.ok(xml.indexOf('weil es so ist') >= 0);
  // "Frage." und "Lösung: b." stehen als eigener fetter Run (<w:b/>), gefolgt vom normalen Text
  assert.ok(/<w:r><w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">Frage\.<\/w:t><\/w:r>/.test(xml));
  assert.ok(/<w:r><w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">Lösung: b\.<\/w:t><\/w:r>/.test(xml));
});

test('baue(): INTERAKTION bleibt generisch (keine Feldsyntax-Formatierung wie WISSENSCHECK)', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('Mach mit.') >= 0); // INTERAKTION-Inhalt aus der Fixture, unveraendert als Absatz
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

test('baue(): das Bild liegt unter word/media/, Extent-EMU stammen aus den LOGISCHEN Massen (Finding 1)', async () => {
  const { buffer } = vorlageBauen();
  const out = await docxBauen.baue(buffer, gelesenFixture(), bilderFixture());
  const zip = zipLesen.oeffne(out.buffer);
  assert.ok(zip.eintraege['word/media/BX-001-claude-abb-001.png']);
  const xml = await docXmlAus(out);
  // bilderFixture() liefert breite=100/hoehe=50 (logisch) bei einem IHDR von 200x100
  // (Canvas-Faktor 2) — der Extent MUSS aus der logischen Groesse kommen, nicht aus
  // dem verdoppelten IHDR (das waere cx="1905000" cy="952500").
  assert.ok(xml.indexOf('<wp:extent cx="952500" cy="476250"/>') >= 0); // 100*9525, 50*9525
  assert.strictEqual(xml.indexOf('cx="1905000"'), -1, 'Extent kam faelschlich aus dem verdoppelten IHDR');
});

test('baue(): ohne logische Masse im bilder-Kontrakt faellt der Extent auf das PNG-IHDR zurueck', async () => {
  const { buffer } = vorlageBauen();
  const gelesen = gelesenFixture();
  const bilder = { [docxBauen.bildDateiname('BX-001', 'claude', 1)]: { bytes: fakePng(300, 150) } };
  const out = await docxBauen.baue(buffer, gelesen, bilder);
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('<wp:extent cx="2857500" cy="1428750"/>') >= 0); // 300*9525, 150*9525
});

/* ---------- B9-F2: Deckel auf den Satzspiegel der Vorlage ---------- */

test('baue(): ein Bild breiter als die Textbreite wird proportional auf die Textbreite heruntergedeckelt', async () => {
  // US-Letter-Vorlage (12240 Twips) mit 1440-Twips-Raendern (1 Zoll) — bewusst ein
  // ANDERES sectPr als das A4-Standard-Fixture, um zu belegen, dass die Textbreite
  // tatsaechlich aus DIESEM sectPr gelesen wird: Textbreite = 12240-2*1440 = 9360
  // Twips = 5943600 EMU.
  const { buffer } = vorlageBauen({
    sectPr: '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
  });
  const gelesen = gelesenFixture();
  // 900x300 logisch (Standardbreite der SVG-Zeichner) -> roh 8572500x2857500 EMU,
  // klar ueber der Textbreite von 5943600 EMU. Seitenverhaeltnis 3:1 bleibt erhalten.
  const bilder = { [docxBauen.bildDateiname('BX-001', 'claude', 1)]: { breite: 900, hoehe: 300, bytes: fakePng(900, 300) } };
  const out = await docxBauen.baue(buffer, gelesen, bilder);
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('<wp:extent cx="5943600" cy="1981200"/>') >= 0,
    'cx muss exakt die Textbreite treffen, cy proportional (900:300 = 3:1 -> 5943600:1981200)');
  assert.strictEqual(xml.indexOf('cx="8572500"'), -1, 'die ungedeckelte, zu grosse Breite darf nicht stehen');
});

test('baue(): ein kleines Bild bleibt unveraendert — kein Hochskalieren auf die Textbreite', async () => {
  const { buffer } = vorlageBauen(); // Default-sectPr, Textbreite 5760720 EMU
  const gelesen = gelesenFixture();
  const bilder = { [docxBauen.bildDateiname('BX-001', 'claude', 1)]: { breite: 300, hoehe: 200, bytes: fakePng(300, 200) } };
  const out = await docxBauen.baue(buffer, gelesen, bilder);
  const xml = await docXmlAus(out);
  assert.ok(xml.indexOf('<wp:extent cx="2857500" cy="1905000"/>') >= 0); // 300*9525, 200*9525, unveraendert
});

test('baue(): der Deckel greift auch im IHDR-Rueckfall (F2-Kernfall — Faktor-2-Illustration ohne logische Masse)', async () => {
  const { buffer } = vorlageBauen(); // Default-sectPr, Textbreite 5760720 EMU
  const gelesen = gelesenFixture();
  // Exakt die im Live-Befund gemessenen IHDR-Masse einer Faktor-2-gerenderten
  // Illustration (1800x860 px) OHNE mitgelieferte logische Groesse — vorher
  // landete das ungedeckelt bei genau den im Befund gemeldeten 17145000x8191500 EMU.
  const bilder = { [docxBauen.bildDateiname('BX-001', 'claude', 1)]: { bytes: fakePng(1800, 860) } };
  const out = await docxBauen.baue(buffer, gelesen, bilder);
  const xml = await docXmlAus(out);
  assert.strictEqual(xml.indexOf('cx="17145000"'), -1, 'der Live-Befund (18.9 Zoll) darf nicht mehr auftreten');
  assert.ok(xml.indexOf('<wp:extent cx="5760720" cy="2752344"/>') >= 0);
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

test('baue(): ILLUSTRATION an Hero-Position, wenn datei: gesetzt UND in bilder vorhanden (B6)', async () => {
  const { buffer } = vorlageBauen();
  const gelesen = gelesenFixture();
  gelesen.kapitel[0].teile.ILLUSTRATION = 'datei: illustration.png';
  const bilder = bilderFixture();
  bilder['illustration.png'] = { bytes: fakePng(400, 200), breite: 400, hoehe: 200 };
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

/* Seit skript-schema.js ILLUSTRATION als eigenen Baustein fuehrt (B6), laeuft
   der generische Schleifen-Durchlauf ueber S().SCHEMA.bausteine auch ueber
   ILLUSTRATION (b.stil === null) — OHNE eigene Ausnahme wuerde
   bausteinAbsaetze() die ROHE Feldsyntax ("katalog: ...") ein zweites Mal
   als sichtbaren Fliesstext (Ueberschrift2 + Absatz) ins Dokument setzen,
   zusaetzlich zum Bild-Absatz von illustrationAbsatz() an der
   Hero-Position. Eigener Test, unabhaengig vom "stillschweigend
   uebersprungen"-Fall oben (der nur den Bild-Absatz prueft, nicht die
   Abwesenheit von rohem Fliesstext). */
test('baue(): die rohe ILLUSTRATION-Feldsyntax (katalog:/datei:) landet nie ein zweites Mal als Fliesstext (B6)', async () => {
  const { buffer } = vorlageBauen();
  const gelesen = gelesenFixture();
  gelesen.kapitel[0].teile.ILLUSTRATION = 'katalog: geld-und-vertrauen\ndatei: illustration.png';
  const bilder = bilderFixture();
  bilder['illustration.png'] = { bytes: fakePng(400, 200), breite: 400, hoehe: 200 };
  const out = await docxBauen.baue(buffer, gelesen, bilder);
  const xml = await docXmlAus(out);
  assert.strictEqual(xml.indexOf('katalog: geld-und-vertrauen'), -1, xml);
  /* Der Bild-Absatz selbst nennt den Dateinamen zweimal (wp:docPr name= UND
     pic:cNvPr name=, s. drawingAbsatz()) — ein dritter Treffer waere die
     geleakte Fliesstext-Zeile "datei: illustration.png". */
  assert.strictEqual((xml.match(/illustration\.png/g) || []).length, 2,
    'illustration.png sollte nur aus dem Bild-Absatz kommen (2x), nicht zusaetzlich als Fliesstext');
});

test('baue(): Vorlage ohne word/document.xml wird abgelehnt', async () => {
  const buf = zipSchreiben.baue([{ name: 'x.txt', daten: 'y' }]);
  await assert.rejects(() => docxBauen.baue(buf.buffer, gelesenFixture(), {}), /word\/document\.xml/);
});
