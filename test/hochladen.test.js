const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1];
function datei(name) { return { name: name }; }

/* ---------- Wo Hochladen vorgesehen ist ---------- */

test('nur wo der Kontrakt den Weg nennt', () => {
  assert.strictEqual(inhalt.darfHochladen(INHALT, 2), true, 'Excel');
  assert.strictEqual(inhalt.darfHochladen(INHALT, 6), true, 'Moodle-Export');
  assert.strictEqual(inhalt.darfHochladen(INHALT, 3), true, 'Content — zwei Varianten, oft aus dem Chat');
  [1, 4, 5, 7, 8].forEach(function (n) {
    assert.strictEqual(inhalt.darfHochladen(INHALT, n), false, 'Schritt ' + n);
  });
});

test('Hochladen und der Weg Chat schliessen sich nicht aus', () => {
  /* Schritt 6 fuehrt 'chat' gar nicht in wege — kein Weg-Chat-Schritt.
     Schritt 2 fuehrt 'chat' seit Z10 sehr wohl (Chat liefert die .xlsx seit
     T12 direkt) — die Text-Ablage bleibt trotzdem gesperrt, weil das
     Lieferobjekt xlsx ist, nicht weil der Weg fehlte. */
  assert.strictEqual(inhalt.darfAblegen(INHALT, 6), false, 'Schritt 6 kennt den Weg Chat nicht');
  assert.strictEqual(inhalt.darfAblegen(INHALT, 2), false,
    'Schritt 2 fuehrt chat, aber die Text-Ablage bleibt fuer xlsx gesperrt (Z10)');
});

/* ---------- Der Zielname — der Mensch tippt ihn nie ---------- */

test('Schritt 2 zaehlt Versionen hoch', () => {
  const z = inhalt.hochladeZiel(INHALT, 2, 'AFL-001', []);
  assert.deepStrictEqual(z, {
    ordner: '02_lernziele', datei: 'AFL-001_lernziele-drehbuch_v1.xlsx',
    version: 1, format: 'excel'
  });
});

test('liegt schon ein v1, wird die naechste Datei v2', () => {
  const z = inhalt.hochladeZiel(INHALT, 2, 'AFL-001',
    [datei('AFL-001_lernziele-drehbuch_v1.xlsx')]);
  assert.strictEqual(z.datei, 'AFL-001_lernziele-drehbuch_v2.xlsx');
});

/* Genau der Fall, der am 2026-07-22 passiert ist: eine von Hand benannte Datei
   mit Unterstrich statt Bindestrich wird nicht mitgezaehlt. Der Weg Hochladen
   kann diesen Fehler nicht mehr machen, weil er den Namen selbst vergibt. */
test('ein von Hand falsch benanntes v1 wird nicht mitgezaehlt', () => {
  const z = inhalt.hochladeZiel(INHALT, 2, 'AFL-001',
    [datei('AFL-001_lernziele_drehbuch_v1.xlsx')]);
  assert.strictEqual(z.datei, 'AFL-001_lernziele-drehbuch_v1.xlsx',
    'der falsche Name darf die Zaehlung nicht beeinflussen');
});

test('Schritt 6 hat einen festen Namen ohne Version', () => {
  const z = inhalt.hochladeZiel(INHALT, 6, 'DBS-001', []);
  assert.strictEqual(z.ordner, '06_moodle');
  assert.strictEqual(z.datei, 'DBS-001_export.mbz');
  assert.strictEqual(z.version, null, 'der Export traegt keine Version');
});

test('der feste Name bleibt derselbe, egal was schon dort liegt', () => {
  const z = inhalt.hochladeZiel(INHALT, 6, 'DBS-001', [datei('DBS-001_export.mbz')]);
  assert.strictEqual(z.datei, 'DBS-001_export.mbz');
});

/* ---------- Erwartete Endung ---------- */

test('die Endung kommt aus dem Kontrakt — aus ext oder aus dem festen Namen', () => {
  assert.strictEqual(inhalt.erwarteteEndung(INHALT, 2), 'xlsx');
  assert.strictEqual(inhalt.erwarteteEndung(INHALT, 6), 'mbz');
});

/* ---------- Der Block in der Schrittansicht ---------- */

test('Schritt 2 bietet das Hochladen an und nennt das Ziel', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/data-action="hochladen"/.test(h), 'kein Knopf');
  assert.ok(/id="datei"/.test(h), 'kein Dateifeld');
  assert.ok(h.indexOf('<code>02_lernziele/AFL-001_lernziele-drehbuch_v1.xlsx</code>') >= 0,
    'nennt das Ziel nicht');
  assert.ok(/accept="\.xlsx"/.test(h), 'schlaegt die Endung nicht vor');
});

test('ohne gelesenen Ordner wird kein Zielname behauptet', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: false });
  assert.ok(/data-action="hochladen"/.test(h));
  assert.ok(h.indexOf('Ordner wird gelesen') >= 0, 'behauptet eine Version zu frueh');
});

test('ohne Kursordner gibt es nichts hochzuladen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: true });
  assert.ok(!/data-action="hochladen"/.test(h), 'Hochladen ohne Ablage angeboten');
});

/* ---------- „Wohin es kommt" und die Weg-Chips ---------- */

/* Der Platzhalter _v{N} zwang zum Abtippen — und beim Abtippen wurde aus
   lernziele-drehbuch ein lernziele_drehbuch. */
test('ist der Ordner gelesen, steht dort der aufgeloeste Name statt _v{N}', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(h.indexOf('AFL-001_lernziele-drehbuch_v1.xlsx') >= 0, 'nicht aufgeloest');
  assert.ok(h.indexOf('_v{N}') < 0, 'zeigt weiterhin den Platzhalter');
});

test('solange nichts gelesen ist, bleibt der Platzhalter — nichts wird behauptet', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: false });
  assert.ok(h.indexOf('_v{N}') >= 0, 'behauptet eine Version, ohne nachgesehen zu haben');
});

test('liegt v1, nennt die Ansicht v2 als Ziel', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null,
    { ordnerFehlt: false, dateien: [datei('AFL-001_lernziele-drehbuch_v1.xlsx')] });
  assert.ok(h.indexOf('AFL-001_lernziele-drehbuch_v2.xlsx') >= 0);
});

/* wege steht in schritte.json UND im Ablage-Kontrakt. In Ablage-Fragen gilt der
   Kontrakt — sonst fehlt ein dort ergaenzter Weg in der Ansicht. */
test('die Weg-Chips kommen aus dem Kontrakt, nicht aus schritte.json', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(h.indexOf('Datei hochladen') >= 0, 'der Weg Hochladen fehlt als Chip');
});

test('ein unbekannter Weg wird roh gezeigt statt verschwiegen', () => {
  const anders = JSON.parse(JSON.stringify(INHALT));
  anders['ablage-kontrakt'].schritte['2'].wege = ['brieftaube'];
  const h = ansichten.einSchritt(anders, AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(h.indexOf('brieftaube') >= 0);
});

test('Schritte ohne den Weg bekommen kein Dateifeld', () => {
  [1, 5].forEach(function (n) {
    const h = ansichten.einSchritt(INHALT, AFL, n, null, { ordnerFehlt: false, dateien: [] });
    assert.ok(!/id="datei"/.test(h), 'Schritt ' + n);
  });
});

/* ---------- Schritt 3: der Datei-Input traegt multiple (B5) ---------- */

test('Schritt 3 (Blockdatei-Gate) traegt multiple + die passenden accept-Endungen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/id="datei"[^>]*\bmultiple\b/.test(h), 'kein multiple am Datei-Input');
  assert.ok(/accept="\.blocks,\.txt,\.png"/.test(h), 'accept nennt nicht .blocks/.txt/.png');
});

test('Schritt 2 (kein Blockdatei-Gate) traegt weiterhin KEIN multiple', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(!/id="datei"[^>]*\bmultiple\b/.test(h), 'Schritt 2 haette kein multiple tragen sollen');
});

/* ---------- controller.hochladen: Upload-Strukturpruefung (T11) ----------
   Das Drift-Netz fuer chat-generierte Contract-Excels: eine erfundene Spalte
   ging bei AFL-001 unbemerkt durch Gate 1. Nur wenn der Kontrakt fuer den
   Schritt ein struktur-Feld fuehrt UND die gewaehlte Datei eine .xlsx ist,
   greift die Pruefung — sonst unveraendertes Verhalten (bestehende Tests
   oben bleiben dafuer der Beleg: sie fuehren keine .arrayBuffer-Mocks und
   liefen schon vor T11 gruen). */

const { controller, state, graph } = require('../app.js');
const { xlsxLesen } = require('../xlsx-lesen.js');

function xlsxDatei(name, arrayBufferErgebnis) {
  return {
    name: name,
    arrayBuffer: function () {
      return arrayBufferErgebnis instanceof Error
        ? Promise.reject(arrayBufferErgebnis)
        : Promise.resolve(arrayBufferErgebnis || new ArrayBuffer(0));
    }
  };
}

/* Legt den Controller in einen Zustand, in dem nur noch der Klick auf
   "Hochladen" fehlt. inh wird pro Aufruf frisch geklont, damit ein Test das
   struktur-Feld gefahrlos entfernen/aendern kann, ohne INHALT fuer die
   anderen Tests der Datei zu verfaellschen. dossierOverride (A2) wird nach
   state.data.dossier['AFL-001'] gestempelt — undefined (Default) heisst "nicht
   geladen", wie im echten State (s. app.js state.data.dossier: {}). */
async function hochladenLauf(n, dateiObjekt, inhOverride, dossierOverride) {
  const meldung = { textContent: '', hidden: true };
  const hochgeladenMit = { ordner: null, datei: null };
  const rufe = { ordnerInhalt: 0 };

  state.data.inhalt = inhOverride || JSON.parse(JSON.stringify(INHALT));
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz',
                        schritt: +n, status: 'inArbeit' }];
  state.data.dateien = {};
  state.data.dossier = { 'AFL-001': dossierOverride };
  state.fehlerHinweis = null;
  state.hinweis = null;
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: String(n),
                     werkzeugId: null, werk: null, variante: null, weg: null };

  global.document = {
    getElementById: function (id) {
      if (id === 'datei') return { files: [dateiObjekt] };
      if (id === 'hochladefehler') return meldung;
      return null;
    }
  };

  graph.ordnerInhalt = function (kursId, ordner) {
    rufe.ordnerInhalt++;
    hochgeladenMit.ordnerGelesen = ordner;
    return Promise.resolve([]);
  };
  graph.hochladen = function (kursId, ordner, datei) {
    hochgeladenMit.ordner = ordner; hochgeladenMit.datei = datei;
    return Promise.resolve();
  };
  graph.standNachAblage = function () { return null; };
  graph.standSetzenRoh = function () { return Promise.resolve(); };
  controller.render = function () {};

  const knopf = { disabled: false, textContent: 'Hochladen' };
  controller.hochladen(String(n), knopf);
  await new Promise(function (r) { setTimeout(r, 30); });
  return { hochgeladenMit: hochgeladenMit, meldung: meldung.textContent,
           fehlerHinweis: state.fehlerHinweis, hinweis: state.hinweis,
           rufe: rufe, knopf: knopf };
}

test('struktur vorhanden, Datei sauber: der Upload laeuft normal durch', async () => {
  xlsxLesen.blaetterUndKoepfe = function () {
    return Promise.resolve([
      { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Definition','Lernziel (handlungsorientiert)','Bloom-Stufe','Wie prüfbar (MC/MR)','Typisches Fehlverhalten'] },
      { name: '2_Eingangskompetenzen', kopf: ['EK-ID','Thema','Definition','Wissensziel','Bloom-Stufe','Wie prüfbar (MC/MR)','Wie lernbar bei Lücken?'] },
      { name: '3_Drehbuch', kopf: ['Uhrzeit','Dauer','Thema','Phase (W/U/G)','Lernziel-ID','Erwartetes Verhalten / Ergebnis','Aktivität Trainer / Moderation','Material & Hilfsmittel'] },
      { name: '_steckbrief', kopf: ['feld','wert'] }
    ]);
  };
  const l = await hochladenLauf(2, xlsxDatei('egal.xlsx'));
  assert.strictEqual(l.meldung, '', 'kein Upload-Fehler erwartet: ' + l.meldung);
  assert.strictEqual(l.hochgeladenMit.ordner, '02_lernziele');
  assert.strictEqual(l.hochgeladenMit.datei, 'AFL-001_lernziele-drehbuch_v1.xlsx');
  assert.strictEqual(l.knopf.disabled, true, 'der Knopf bleibt waehrend des Uploads gesperrt');
});

test('struktur vorhanden, Befunde: der Upload wird abgebrochen, nichts geht an graph.hochladen', async () => {
  xlsxLesen.blaetterUndKoepfe = function () {
    return Promise.resolve([
      { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Lernort','Definition'] }
    ]);
  };
  const l = await hochladenLauf(2, xlsxDatei('egal.xlsx'));
  assert.strictEqual(l.hochgeladenMit.datei, null, 'trotz Befund hochgeladen');
  assert.match(l.meldung, /Struktur weicht vom Contract ab/);
  assert.match(l.meldung, /Pflichtblatt fehlt/);
  assert.match(l.fehlerHinweis || '', /Struktur weicht vom Contract ab/,
    'state.fehlerHinweis fehlt — ein Zwischen-Render koennte sonst die Meldung verlieren');
  assert.strictEqual(l.knopf.disabled, false, 'der Knopf muss nach dem Abbruch wieder bedienbar sein');
});

test('die Datei selbst ist nicht lesbar: Upload wird abgebrochen, klare Meldung', async () => {
  const l = await hochladenLauf(2, xlsxDatei('egal.xlsx', new Error('kaputte Datei')));
  assert.strictEqual(l.hochgeladenMit.datei, null);
  assert.match(l.meldung, /nicht lesbar/);
  assert.match(l.meldung, /kaputte Datei/);
  assert.match(l.fehlerHinweis || '', /nicht lesbar/);
});

/* Fix-Runde 1, Finding F5: vorher liess eine .xls-Datei die Pruefung
   unbemerkt aus UND lief trotzdem normal durch (unter dem .xlsx-Zielnamen,
   ungeprueft) — ein Bypass. Jetzt: das Gate haengt an struktur-Feld +
   Kontrakt-ext 'xlsx', und ist es scharf, wird eine Nicht-xlsx-Datei laut
   abgewiesen statt still durchgelassen. */
test('F5: struktur vorhanden, aber die Datei ist keine .xlsx: laut abgewiesen, kein stiller Bypass', async () => {
  let gerufen = false;
  xlsxLesen.blaetterUndKoepfe = function () { gerufen = true; return Promise.resolve([]); };
  const l = await hochladenLauf(2, xlsxDatei('AFL-001_lernziele-drehbuch_v1.xls'));
  assert.strictEqual(gerufen, false, 'xlsxLesen haette fuer eine Nicht-xlsx nicht aufgerufen werden duerfen — die Endung allein reicht zur Abweisung');
  assert.strictEqual(l.hochgeladenMit.datei, null, 'die Datei haette NICHT hochgeladen werden duerfen');
  assert.match(l.meldung, /\.xlsx/);
  assert.match(l.meldung, /AFL-001_lernziele-drehbuch_v1\.xls/);
  assert.match(l.fehlerHinweis || '', /\.xlsx/);
  assert.strictEqual(l.knopf.disabled, false, 'der Knopf muss nach der Abweisung wieder bedienbar sein');
});

test('kein struktur-Feld am Schritt: keine Pruefung, auch bei .xlsx', async () => {
  let gerufen = false;
  xlsxLesen.blaetterUndKoepfe = function () { gerufen = true; return Promise.resolve([]); };
  const ohneStruktur = JSON.parse(JSON.stringify(INHALT));
  delete ohneStruktur['ablage-kontrakt'].schritte['2'].struktur;
  const l = await hochladenLauf(2, xlsxDatei('egal.xlsx'), ohneStruktur);
  assert.strictEqual(gerufen, false, 'xlsxLesen haette ohne struktur-Feld nicht aufgerufen werden duerfen');
  assert.strictEqual(l.hochgeladenMit.datei, 'AFL-001_lernziele-drehbuch_v1.xlsx');
});

/* F5, zweite Haelfte der Bindung: struktur allein reicht nicht — der
   Kontrakt muss fuer den Schritt AUCH 'xlsx' als Endung erwarten. Ein Schritt
   mit struktur-Feld, aber einer anderen Kontrakt-Endung (hier docx,
   hypothetisch/zukunftssicher), darf das Gate nicht scharf schalten. */
test('F5: struktur-Feld allein ohne Kontrakt-ext xlsx schaltet das Gate nicht scharf', async () => {
  let gerufen = false;
  xlsxLesen.blaetterUndKoepfe = function () { gerufen = true; return Promise.resolve([]); };
  const mitFremderEndung = JSON.parse(JSON.stringify(INHALT));
  mitFremderEndung['ablage-kontrakt'].schritte['3'] = Object.assign(
    {}, mitFremderEndung['ablage-kontrakt'].schritte['3'], { struktur: INHALT['ablage-kontrakt'].schritte['2'].struktur });
  /* Seit A2/B5 fuehrt Schritt 3 zusaetzlich pruefung:'skript' (das eigene
     Blockdatei-Gate, s. u.) — fuer DIESEN Test (der ausschliesslich das
     aeltere xlsx-Gate/T11 isoliert pruefen soll) wird es entfernt, sonst
     wuerde das neue Gate hier mitgreifen und den Upload ueber einen anderen
     Pfad (skriptLesen) blockieren, obwohl genau das nicht Gegenstand dieses
     Tests ist. */
  delete mitFremderEndung['ablage-kontrakt'].schritte['3'].pruefung;
  const l = await hochladenLauf(3, xlsxDatei('AFL-001_skript-claude_v1.docx'), mitFremderEndung);
  assert.strictEqual(gerufen, false, 'xlsxLesen haette nicht aufgerufen werden duerfen — Kontrakt erwartet docx, nicht xlsx');
  assert.strictEqual(l.hochgeladenMit.datei, 'AFL-001_skript-claude_v1.docx',
    'der Upload haette normal laufen sollen, das Gate ist hier nicht scharf');
});

/* ---------- controller.hochladen: Blockdatei-Gate fuer Schritt 3 (B5) ----------
   Ersetzt das A2-docx-Gate: seit der E5-Revision (Entscheid Markus
   2026-08-03) liefert der Chat die BLOCKDATEI (.blocks/.txt) statt der
   .docx — die App baut das Word selbst (Diagramme rendern, docx-Bauen) und
   legt Word + Blockdatei + Abbildungen in einem Vorgang ab. Das Gate haengt
   wie A2 am Kontrakt-Feld pruefung:'skript' PLUS der Kontrakt-Endung 'docx'
   (dasselbe F5-Muster) UND braucht zusaetzlich das geladene Dossier.

   Modul-Grenzen (Self-Review-Vorgabe): graph UND diagrammZeichnen.png
   werden gemockt (Netz bzw. Browser-only/Canvas) — skriptLesen.lies() und
   docxBauen.baue() laufen ECHT gegen einen echten, im Test gebauten
   Block-Text und eine echte (minimale) Vorlage. */

require('../zip-lesen.js');
require('../zip-schreiben.js');
require('../skript-schema.js');
require('../skript-lesen.js');
require('../diagramm-zeichnen.js');
require('../docx-bauen.js');
const { zipSchreiben } = require('../zip-schreiben.js');
const { skriptLesen } = require('../skript-lesen.js');
const { diagrammZeichnen } = require('../diagramm-zeichnen.js');

/* Eine minimale, aber gueltige docx-Vorlage (word/document.xml mit
   sectPr, [Content_Types].xml, leere rels) — genug fuer docxBauen.baue(),
   das jeden Vorlagenteil ausser den drei ersetzten byte-identisch
   durchreicht. Muster: test/docxbauen.test.js vorlageBauen(), hier ohne den
   dort zusaetzlich getesteten Binaerteil/png-Default. */
function vorlageBauen() {
  const docXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>Alter Inhalt</w:t></w:r></w:p>' +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr>' +
    '</w:body></w:document>';
  const relsXml = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '</Relationships>';
  const ctXml = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const eintraege = [
    { name: '[Content_Types].xml', daten: ctXml },
    { name: 'word/document.xml', daten: docXml },
    { name: 'word/_rels/document.xml.rels', daten: relsXml }
  ];
  return zipSchreiben.baue(eintraege).buffer;
}

/* Eine Vorlage OHNE word/document.xml — docxBauen.baue() lehnt sie ab. Fuer
   den Baufehler-Test (Mutationsprobe, s. u.). */
function kaputteVorlageBauen() {
  return zipSchreiben.baue([{ name: 'x.txt', daten: 'y' }]).buffer;
}

function woerter(n, praefix) {
  const w = [];
  for (let i = 0; i < n; i++) w.push((praefix || 'wort') + i);
  return w.join(' ');
}

/* Ein vollstaendiger, gueltiger Block-Text fuer AFL-001/claude — mit EINER
   nicht-tabellarischen ABBILDUNG (kompositions-leiste), damit der Bau-Pfad
   (svg -> png -> docxBauen) durchlaufen wird. woerterJeTeil steuert das
   Wortbudget je Kapitel absichtlich (Default weit ueber hartMin 500). */
function blockText(opts) {
  opts = opts || {};
  const kurs = opts.kurs || 'AFL-001';
  const variante = opts.variante || 'claude';
  const gelesenZeile = opts.gelesen === undefined ? 'BSV Mitteilungen Nr. 168, 01.01.2026 Q-001' : opts.gelesen;
  const n = opts.woerterJeTeil || 90;
  const zeilen = [
    '###SKRIPT kurs=' + kurs + ' | variante=' + variante + ' | titel=Testtitel | rechtsstand=1.1.2026',
    '###QUELLEN'
  ];
  if (gelesenZeile) zeilen.push('gelesen: ' + gelesenZeile);
  zeilen.push(
    '###KAPITEL nr=1 | ek=' + kurs + '-EK-001 | titel=Kapitel eins | bloom=2 | richtzeit=25',
    '###HERO', woerter(n, 'hero'),
    '###STORY', woerter(n, 'story'),
    '###DEFINITION', woerter(n, 'def'),
    '###ERKLAERUNG', woerter(n, 'erkl'),
    '###FEHLVORSTELLUNG', woerter(n, 'fehl'),
    '###BEISPIEL', woerter(n, 'bsp'),
    '###ABBILDUNG typ=kompositions-leiste | titel=Verteilung',
    'werte: Teil eins 1 | Teil zwei 2',
    '###INTERAKTION', woerter(30, 'inter')
  );
  if (opts.fehlendenBaustein !== 'MERKSATZ') zeilen.push('###MERKSATZ', woerter(30, 'merk'));
  zeilen.push(
    '###DEEPDIVE', woerter(30, 'deep'),
    '###WISSENSCHECK', 'frage: Was trifft zu?', 'a) nichts', 'b) alles',
    'loesung: b', 'begruendung: weil es so ist',
    '###ABSCHLUSS', woerter(30, 'schluss'),
    '###ENDE-KAPITEL'
  );
  return zeilen.join('\n');
}

function blockDatei(name, textOderFehler) {
  return {
    name: name,
    text: function () {
      return textOderFehler instanceof Error
        ? Promise.reject(textOderFehler)
        : Promise.resolve(textOderFehler);
    }
  };
}

function pngDatei(name) {
  return {
    name: name,
    arrayBuffer: function () { return Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer); }
  };
}

const DOSSIER_OK = {
  regulatorik: { stand: '1.1.2026' },
  content_modus: 'quellengestuetzt',
  quellen: [{ id: 'Q-001' }, { id: 'Q-002' }]
};

/* Legt den Controller in denselben Zustand wie hochladenLauf() oben, aber
   fuer mehrere Dateien (feld.files ist eine Liste) und mit den B5-eigenen
   Netz-/Browser-Mocks: graph.hochladen sammelt JEDEN Aufruf (nicht nur den
   letzten — es gibt jetzt mehrere: docx, blocks, Bilder), graph.vorlageLaden
   und diagrammZeichnen.png sind Testdoubles. */
async function hochladenLaufB5(n, dateiListe, opts) {
  opts = opts || {};
  const meldung = { textContent: '', hidden: true };
  const hochladenRufe = [];
  const rufe = { ordnerInhalt: 0, vorlageLaden: 0, pngRender: 0, pngAufrufe: [] };

  state.data.inhalt = opts.inhalt || JSON.parse(JSON.stringify(INHALT));
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz',
                        schritt: +n, status: 'inArbeit' }];
  state.data.dateien = {};
  state.data.dossier = { 'AFL-001': opts.dossier };
  state.data.vorlage = undefined;
  state.fehlerHinweis = null;
  state.hinweis = null;
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: String(n),
                     werkzeugId: null, werk: null, variante: opts.variante || null, weg: null };

  global.document = {
    getElementById: function (id) {
      if (id === 'datei') return { files: dateiListe };
      if (id === 'hochladefehler') return meldung;
      return null;
    }
  };

  graph.ordnerInhalt = function () {
    rufe.ordnerInhalt++;
    return Promise.resolve(opts.dateienImOrdner || []);
  };
  graph.hochladen = function (kursId, ordner, datei, blob) {
    hochladenRufe.push({ ordner: ordner, datei: datei, blob: blob });
    return Promise.resolve();
  };
  graph.vorlageLaden = function () {
    rufe.vorlageLaden++;
    if (opts.keineVorlage) return Promise.resolve(null);
    return Promise.resolve(opts.kaputteVorlage ? kaputteVorlageBauen() : vorlageBauen());
  };
  graph.standNachAblage = function () { return null; };
  graph.standSetzenRoh = function () { return Promise.resolve(); };
  controller.render = function () {};
  diagrammZeichnen.png = function (svgText, breite, hoehe) {
    rufe.pngRender++;
    rufe.pngAufrufe.push({ svgText: svgText, breite: breite, hoehe: hoehe });
    return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
  };

  const knopf = { disabled: false, textContent: 'Hochladen' };
  controller.hochladen(String(n), knopf);
  await new Promise(function (r) { setTimeout(r, 80); });
  return { hochladenRufe: hochladenRufe, meldung: meldung.textContent,
           fehlerHinweis: state.fehlerHinweis, hinweis: state.hinweis,
           rufe: rufe, knopf: knopf };
}

test('B5 (a) sauber: docx + blocks + Diagramm-PNG in EINEM Lauf abgelegt, Hinweise angehängt', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())], { dossier: DOSSIER_OK });
  assert.strictEqual(l.meldung, '', 'kein Fehler erwartet: ' + l.meldung);
  assert.strictEqual(l.hochladenRufe.length, 3, 'docx + blocks + ein Diagramm-Bild erwartet');
  assert.deepStrictEqual(
    l.hochladenRufe.map(function (r) { return r.ordner + '/' + r.datei; }),
    [
      '03_content/AFL-001_skript-claude_v1.docx',
      '03_content/AFL-001_skript-claude_v1.blocks',
      '03_content/abbildungen/AFL-001-claude-abb-001.png'
    ]
  );
  assert.strictEqual(l.rufe.pngRender, 1, 'genau ein Diagramm haette gerendert werden muessen');
  assert.match(l.hinweis || '', /Hochgeladen als AFL-001_skript-claude_v1\.docx/);
  assert.match(l.hinweis || '', /AFL-001_skript-claude_v1\.blocks/);
  assert.match(l.hinweis || '', /1 Bild/);
  assert.match(l.hinweis || '', /Q-002/, 'die fehlende Dossier-Quelle Q-002 sollte als Hinweis erscheinen');
});

/* Review-Finding 1: docxBauen.abbildungAbsatz() setzt den Abbildungstitel
   bereits als Bildunterschrift (pStyle="Quelle") — das gerenderte Diagramm
   selbst darf ihn deshalb NICHT tragen (Referenz skript-bauen.cjs), sonst
   steht er im fertigen Word doppelt. svg() muss mit {mitTitel:false}
   gerufen werden; das schrumpft die SVG-Hoehe (rahmen(), diagramm-
   zeichnen.js) um KOPF=55px — die Massextraktion in app.js liest genau
   diesen geschrumpften String, bleibt also automatisch konsistent. */
test('B5 (o) Diagrammtitel wird nicht doppelt gesetzt — svg() laeuft mit mitTitel:false', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())], { dossier: DOSSIER_OK });
  assert.strictEqual(l.rufe.pngAufrufe.length, 1);
  const aufruf = l.rufe.pngAufrufe[0];
  assert.strictEqual(aufruf.svgText.indexOf('Verteilung'), -1,
    'der Abbildungstitel "Verteilung" haette NICHT im Diagramm selbst stehen duerfen');
  assert.strictEqual(aufruf.hoehe, 195, 'die an docxBauen uebergebene Hoehe haette die geschrumpfte (mitTitel:false) sein muessen, nicht 250');
});

test('B5 (b) skriptLesen.lies() wirft (kein ###SKRIPT): Abbruch vor jedem Netzzugriff', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', '###QUELLEN\ngelesen: x')], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.strictEqual(l.rufe.ordnerInhalt, 0);
  assert.strictEqual(l.rufe.vorlageLaden, 0, 'die Vorlage haette nie geladen werden duerfen');
  assert.match(l.meldung, /nicht lesbar/);
  assert.match(l.meldung, /###SKRIPT fehlt/);
  assert.match(l.fehlerHinweis || '', /nicht lesbar/);
});

test('B5 (c) gelesen.fehler nicht leer (fehlender Pflichtbaustein): Abbruch MIT Liste, vor jedem Netzzugriff', async () => {
  const l = await hochladenLaufB5(3,
    [blockDatei('egal.blocks', blockText({ fehlendenBaustein: 'MERKSATZ' }))], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.strictEqual(l.rufe.ordnerInhalt, 0);
  assert.match(l.meldung, /weicht vom Schema ab/);
  assert.match(l.meldung, /MERKSATZ/);
  assert.match(l.fehlerHinweis || '', /weicht vom Schema ab/);
});

test('B5 (d) UI-Variante ≠ Block-Variante: Abbruch, kein stilles Bevorzugen', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText({ variante: 'claude' }))],
    { dossier: DOSSIER_OK, variante: 'chatgpt' });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.strictEqual(l.rufe.ordnerInhalt, 0);
  assert.match(l.meldung, /Variante "claude"/);
  assert.match(l.meldung, /ausgewählt ist "chatgpt"/);
});

test('B5 (e) unbekannte Quellen-ID in der Leseliste: Abbruch', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText({ gelesen: 'Q-099 irgendwas' }))],
    { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /weicht vom Kontrakt ab/);
  assert.match(l.meldung, /Q-099/);
  assert.match(l.fehlerHinweis || '', /Q-099/);
});

test('B5 (f) Wortbudget unter 500: Abbruch', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText({ woerterJeTeil: 5 }))],
    { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /weicht vom Kontrakt ab/);
  assert.match(l.meldung, /Wortbudget/);
});

/* (g) referenziertes Bild fehlt — "soweit bis B6 abbildbar" (Task-Brief):
   ###ILLUSTRATION ist heute kein bekannter Baustein, ein echter Text damit
   waere schon in (c) (gelesen.fehler) abgefangen. skriptLesen.lies() wird
   deshalb NUR fuer diesen einen Test temporaer umhuellt — echter Text wird
   echt geparst, danach wird eine ILLUSTRATION-Referenz nachtraeglich
   angehaengt (Muster test/docxbauen.test.js: gelesen.kapitel[].teile.
   ILLUSTRATION wird dort ebenfalls direkt gesetzt statt geparst). */
test('B5 (g) referenzierte Illustration fehlt im Upload: Abbruch (B6-Vorgriff, tolerant)', async () => {
  const echtLies = skriptLesen.lies;
  skriptLesen.lies = function (text) {
    const g = echtLies(text);
    g.kapitel[0].teile.ILLUSTRATION = 'datei: szene.png';
    return g;
  };
  try {
    const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())], { dossier: DOSSIER_OK });
    assert.strictEqual(l.hochladenRufe.length, 0);
    assert.strictEqual(l.rufe.ordnerInhalt, 0);
    assert.match(l.meldung, /Illustration/);
    assert.match(l.meldung, /szene\.png/);
  } finally {
    skriptLesen.lies = echtLies;
  }
});

test('B5 (g\') liegt die referenzierte Illustration im Upload, laeuft es durch', async () => {
  const echtLies = skriptLesen.lies;
  skriptLesen.lies = function (text) {
    const g = echtLies(text);
    g.kapitel[0].teile.ILLUSTRATION = 'datei: szene.png';
    return g;
  };
  try {
    const l = await hochladenLaufB5(3,
      [blockDatei('egal.blocks', blockText()), pngDatei('szene.png')], { dossier: DOSSIER_OK });
    assert.strictEqual(l.meldung, '', 'kein Fehler erwartet: ' + l.meldung);
    assert.ok(l.hochladenRufe.some(function (r) { return r.datei === 'szene.png'; }),
      'die Illustration haette mit hochgeladen werden muessen');
  } finally {
    skriptLesen.lies = echtLies;
  }
});

test('B5 (h) mehr als eine Blockdatei: Abbruch', async () => {
  const l = await hochladenLaufB5(3,
    [blockDatei('a.blocks', blockText()), blockDatei('b.blocks', blockText())], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /genau EINE Blockdatei/);
  assert.match(l.meldung, /gewählt wurden 2/);
});

test('B5 (i) unbekannte Dateiendung im Upload: Abbruch', async () => {
  const l = await hochladenLaufB5(3,
    [blockDatei('egal.blocks', blockText()), { name: 'anhang.docx' }], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /unbekannte Dateiendung/);
  assert.match(l.meldung, /anhang\.docx/);
});

test('B5 (j) Dossier nicht geladen (undefined): Abbruch VOR jedem Netzzugriff', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())], { dossier: undefined });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.strictEqual(l.rufe.ordnerInhalt, 0);
  assert.match(l.meldung, /Prüfung braucht das Dossier/);
  assert.match(l.fehlerHinweis || '', /Prüfung braucht das Dossier/);
});

test('B5 (k) Blockdatei selbst nicht lesbar (.text() lehnt ab): Abbruch, klare Meldung', async () => {
  const l = await hochladenLaufB5(3,
    [blockDatei('egal.blocks', new Error('kaputte Datei'))], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /nicht lesbar/);
  assert.match(l.meldung, /kaputte Datei/);
});

test('B5 (l) kein pruefung-Feld am Schritt: kein Gate, laeuft ueber den normalen Weg wie vor B5', async () => {
  const ohnePruefung = JSON.parse(JSON.stringify(INHALT));
  delete ohnePruefung['ablage-kontrakt'].schritte['3'].pruefung;
  const l = await hochladenLaufB5(3, [{ name: 'AFL-001_skript-claude_v1.docx' }],
    { inhalt: ohnePruefung, dossier: undefined });
  assert.strictEqual(l.rufe.vorlageLaden, 0, 'ohne Gate wird nie gebaut');
  assert.ok(l.hochladenRufe.some(function (r) { return r.datei === 'AFL-001_skript-claude_v1.docx'; }),
    'der Upload haette normal (unveraendert) laufen sollen');
});

/* (m) Baufehler → NICHTS hochgeladen — der Mutationsprobe-Fall aus dem
   Task-Brief: eine kaputte Vorlage laesst docxBauen.baue() ablehnen, BEVOR
   irgendein Netzzugriff zur Ablage passiert. */
test('B5 (m) Baufehler (kaputte Vorlage): nichts wird hochgeladen', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())],
    { dossier: DOSSIER_OK, kaputteVorlage: true });
  assert.strictEqual(l.hochladenRufe.length, 0, 'trotz Baufehler wurde etwas hochgeladen');
  assert.strictEqual(l.rufe.ordnerInhalt, 0, 'kein Ordner-Lesen ohne gebautes Word');
  assert.match(l.meldung, /Nicht hochgeladen/);
  assert.match(l.meldung, /word\/document\.xml/);
  /* Review-Finding 2: Baufehler muessen ebenfalls state.fehlerHinweis setzen
     (beide Meldekanaele), nicht nur den lokalen #hochladefehler-Knoten. */
  assert.match(l.fehlerHinweis || '', /Nicht hochgeladen/);
  assert.match(l.fehlerHinweis || '', /word\/document\.xml/);
});

test('B5 (n) keine Vorlage gefunden: nichts wird hochgeladen', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())],
    { dossier: DOSSIER_OK, keineVorlage: true });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.strictEqual(l.rufe.ordnerInhalt, 0);
  assert.match(l.meldung, /Vorlage/);
  assert.match(l.meldung, /nicht gefunden/);
  assert.match(l.fehlerHinweis || '', /Vorlage/);
  assert.match(l.fehlerHinweis || '', /nicht gefunden/);
});

/* Review-Finding 3: die Blockdatei eines FREMDEN Kurses darf nicht klaglos
   in diesen Kurs gebaut/abgelegt werden — sonst traegt jedes Diagramm ein
   falsches Bildnamens-Praefix (docxBauen.bildDateiname nimmt
   gelesen.skript.kurs), und die Ablage laeuft am falschen Ort. Muster:
   derselbe Guard-Stil wie die Varianten-Pruefung direkt daneben. */
test('B5 (p) Kurs-ID der Blockdatei weicht vom aktuellen Kurs ab: Abbruch, kein Netzzugriff', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText({ kurs: 'VL-001' }))],
    { dossier: DOSSIER_OK }); // hochladenLaufB5 setzt den aktuellen Kurs auf AFL-001
  assert.strictEqual(l.hochladenRufe.length, 0, 'trotz Kurs-Mismatch wurde etwas hochgeladen');
  assert.strictEqual(l.rufe.ordnerInhalt, 0, 'kein Netzzugriff bei falschem Kurs');
  assert.strictEqual(l.rufe.vorlageLaden, 0, 'die Vorlage haette nie geladen werden duerfen');
  assert.match(l.meldung, /VL-001/);
  assert.match(l.meldung, /AFL-001/);
  assert.match(l.fehlerHinweis || '', /VL-001/);
  assert.match(l.fehlerHinweis || '', /AFL-001/);
});
