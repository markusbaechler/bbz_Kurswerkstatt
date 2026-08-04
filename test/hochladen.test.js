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
  /* K2 (Etappe 4): .zip zusaetzlich zu .blocks/.txt/.png — ein ZIP-Paket ist
     seither die bevorzugte, alternative Lieferform (s. hochladenLaufB5-Tests
     "K2 (…)" weiter unten). */
  assert.ok(/accept="\.blocks,\.txt,\.png,\.zip"/.test(h), 'accept nennt nicht .blocks/.txt/.png/.zip');
});

test('K2: der Hinweistext am Block-Upload nennt beide Lieferformen (Einzelauswahl UND ZIP-Paket)', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/\.zip/.test(h), 'kein Hinweis auf das ZIP-Paket');
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

/* B9-F3 (d integration): viele Tests in dieser Datei ueberschreiben
   controller.render mit einem No-op, um Netzaufrufe aus dem Hochladen-Fluss
   zu vermeiden — der Ueberschrieb bleibt fuer den REST der Datei stehen, weil
   controller ein einziges, geteiltes Objekt ist. Fuer den einen Integrations-
   test, der den ECHTEN Render-Aufbau braucht, wird die Original-Implementierung
   deshalb hier, vor dem ersten ueberschreibenden Test, gesichert (Muster
   test/gate.test.js: echteUmbenennen). */
const echtesRender = controller.render;

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
async function hochladenLauf(n, dateiObjekt, inhOverride, dossierOverride, opts) {
  opts = opts || {};
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
    /* B9-F3-Nachzug-Testhilfe: opts.hochladenWirft laesst den einfachen
       xlsx-/mbz-Uploadpfad (weiterMitUpload) am Netzaufruf selbst scheitern,
       um dessen .catch(...) gezielt zu treffen — unabhaengig vom
       struktur-Befund-Pfad, der schon vorher abbricht. */
    if (opts.hochladenWirft) return Promise.reject(opts.hochladenWirft);
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

/* K2 (Etappe 4): ein ZIP-Paket als Pseudo-Datei — echter Round-trip ueber
   zipSchreiben.baue(), Muster test/zipschreiben.test.js. eintraege wie dort:
   [{name, daten}], daten String ODER Uint8Array. */
function zipDateiBauen(name, eintraege) {
  const buf = zipSchreiben.baue(eintraege).buffer;
  return {
    name: name,
    arrayBuffer: function () { return Promise.resolve(buf); }
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
    /* I3-Testhilfe: ab dem N-ten Aufruf (1-basiert) schlaegt graph.hochladen
       fehl — damit laesst sich der Teilfehler-Pfad (geschafft.length > 0,
       ein SPAETERER Ablage-Schritt scheitert) gezielt nachstellen. */
    if (opts.hochladenFehlerAb && hochladenRufe.length >= opts.hochladenFehlerAb) {
      return Promise.reject(new Error('Graph 500'));
    }
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

/* I2 (Fixwave 2026-08-04): der alte Wortlaut ("… nicht gefunden") klang
   endgueltig, obwohl `keineVorlage` hier ebenso einen Netz-Timeout wie eine
   wirklich fehlende Datei stehen koennte — graph.vorlageLaden() liefert in
   beiden Faellen null. Die neue Meldung sagt "erneut versuchen" statt
   "nicht gefunden". Der eigentliche Cache-Fix (kein Fehlschlag wird
   gecacht) ist auf der Netzwerk-Ebene in test/graph.test.js belegt — hier
   wird nur noch der Controller-Meldetext geprueft, weil graph.vorlageLaden
   in diesem Testharness komplett ueberschrieben ist (s. hochladenLaufB5). */
test('B5 (n) keine Vorlage gefunden: nichts wird hochgeladen', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())],
    { dossier: DOSSIER_OK, keineVorlage: true });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.strictEqual(l.rufe.ordnerInhalt, 0);
  assert.match(l.meldung, /Vorlage/);
  assert.match(l.meldung, /erneut versuchen/);
  assert.match(l.fehlerHinweis || '', /Vorlage/);
  assert.match(l.fehlerHinweis || '', /erneut versuchen/);
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

/* I3 (Fixwave 2026-08-04): docx/blocks sind VERSIONIERT (inhalt.hochladeZiel/
   naechsteVersion) — anders als die Bilder mit ihren festen Namen ueberschreibt
   ein erneuter Versuch die unvollstaendige Fassung NICHT, er legt die naechste
   Version daneben. Die alte Meldung ("erneutes Hochladen ist sicher, Graph
   überschreibt deterministisch") war fuer diesen Fall falsch. Hier: der docx-
   Upload gelingt (1. Aufruf), der blocks-Upload scheitert (2. Aufruf) —
   geschafft.length === 1, die Meldung muss die naechste-Version-Wahrheit
   nennen samt der konkreten unvollstaendigen Versionsnummer. */
test('I3: docx gelingt, blocks scheitert — die Meldung nennt "naechste Version", nicht "ueberschreibt sicher"', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())],
    { dossier: DOSSIER_OK, hochladenFehlerAb: 2 });
  assert.strictEqual(l.hochladenRufe.length, 2, 'docx haette gelingen, blocks scheitern sollen');
  assert.match(l.meldung, /Bereits abgelegt.*AFL-001_skript-claude_v1\.docx/);
  assert.match(l.meldung, /nächste, vollständige Version daneben/);
  assert.match(l.meldung, /überschreibt die unvollständige nicht/);
  assert.match(l.meldung, /unvollständige v1 in SharePoint von Hand löschen \(Papierkorb\)/);
  assert.doesNotMatch(l.meldung, /erneutes Hochladen ist sicher/);
  assert.match(l.fehlerHinweis || '', /nächste, vollständige Version daneben/);
});

/* ---------- K2 (Etappe 4): EIN ZIP-Paket statt Mehrfachauswahl ----------
   Der Chat liefert fuer Schritt 3 bisher .blocks + beliebig viele PNGs in
   EINER, fummeligen Mehrfachauswahl. Seither darf die Auswahl stattdessen
   GENAU EIN .zip-Paket sein — die App entpackt es browserseitig
   (zipLesen.oeffne) und speist die entpackten Eintraege unveraendert in die
   BESTEHENDE Klassifikation/Pruefkette (keine zweite Pruefstrecke). Die
   Mehrfachauswahl bleibt als zweiter, gleichwertiger Weg bestehen. */

test('K2 (1): ZIP mit 1 blocks + 2 PNGs entpackt und legt identisch zur Einzelauswahl ab', async () => {
  const paket = zipDateiBauen('paket.zip', [
    { name: 'egal.blocks', daten: blockText() },
    { name: 'bild1.png', daten: new Uint8Array([1, 2, 3, 4]) },
    { name: 'bild2.png', daten: new Uint8Array([5, 6, 7, 8]) }
  ]);
  const lZip = await hochladenLaufB5(3, [paket], { dossier: DOSSIER_OK });
  const lEinzel = await hochladenLaufB5(3,
    [blockDatei('egal.blocks', blockText()), pngDatei('bild1.png'), pngDatei('bild2.png')],
    { dossier: DOSSIER_OK });
  assert.strictEqual(lZip.meldung, '', 'kein Fehler erwartet: ' + lZip.meldung);
  assert.strictEqual(lZip.hochladenRufe.length, 5, 'docx + blocks + 1 Diagramm + 2 Illustrationen erwartet');
  assert.deepStrictEqual(
    lZip.hochladenRufe.map(function (r) { return r.ordner + '/' + r.datei; }),
    lEinzel.hochladenRufe.map(function (r) { return r.ordner + '/' + r.datei; }),
    'ZIP-Paket und Einzelauswahl haetten dieselbe Ablage erzeugen sollen'
  );
});

test('K2 (2): ZIP mit zwei .blocks-Dateien: Abbruch wie bei zwei Einzeldateien', async () => {
  const paket = zipDateiBauen('paket.zip', [
    { name: 'a.blocks', daten: blockText() },
    { name: 'b.blocks', daten: blockText() }
  ]);
  const l = await hochladenLaufB5(3, [paket], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /genau EINE Blockdatei/);
  assert.match(l.meldung, /gewählt wurden 2/);
});

test('K2 (3): Unterordner-Pfade im ZIP werden auf den Basisnamen reduziert', async () => {
  const paket = zipDateiBauen('paket.zip', [
    { name: 'unterordner/egal.blocks', daten: blockText() },
    { name: 'bilder/bild1.png', daten: new Uint8Array([1, 2, 3, 4]) }
  ]);
  const l = await hochladenLaufB5(3, [paket], { dossier: DOSSIER_OK });
  assert.strictEqual(l.meldung, '', 'kein Fehler erwartet: ' + l.meldung);
  assert.strictEqual(l.hochladenRufe.length, 4, 'docx + blocks + 1 Diagramm + 1 Illustration erwartet');
  assert.ok(l.hochladenRufe.some(function (r) { return r.datei === 'bild1.png'; }),
    'die Illustration haette unter dem Basisnamen (ohne "bilder/") abgelegt werden muessen');
});

test('K2 (3b): doppelte Basisnamen nach der Ordner-Reduktion: Abbruch mit beiden Pfaden', async () => {
  const paket = zipDateiBauen('paket.zip', [
    { name: 'a/bild.png', daten: new Uint8Array([1, 2, 3, 4]) },
    { name: 'b/bild.png', daten: new Uint8Array([5, 6, 7, 8]) },
    { name: 'egal.blocks', daten: blockText() }
  ]);
  const l = await hochladenLaufB5(3, [paket], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /doppelte Dateinamen/);
  assert.match(l.meldung, /a\/bild\.png/);
  assert.match(l.meldung, /b\/bild\.png/);
});

test('K2 (4): ZIP-Paket PLUS eine zusaetzliche Einzeldatei: Abbruch, nicht gemischt', async () => {
  const paket = zipDateiBauen('paket.zip', [{ name: 'egal.blocks', daten: blockText() }]);
  const l = await hochladenLaufB5(3, [paket, pngDatei('extra.png')], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /entweder das ZIP-Paket/);
});

test('K2 (5): kaputtes ZIP (kein Zip-Archiv): klare Meldung, kein Netzzugriff', async () => {
  const kaputt = {
    name: 'kaputt.zip',
    arrayBuffer: function () { return Promise.resolve(new TextEncoder().encode('kein zip').buffer); }
  };
  const l = await hochladenLaufB5(3, [kaputt], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.strictEqual(l.rufe.ordnerInhalt, 0);
  assert.match(l.meldung, /nicht lesbar/);
  assert.match(l.fehlerHinweis || '', /nicht lesbar/);
});

test('K2 (6): ZIP mit unerlaubter Dateiendung: Abbruch', async () => {
  const paket = zipDateiBauen('paket.zip', [
    { name: 'egal.blocks', daten: blockText() },
    { name: 'anhang.docx', daten: 'x' }
  ]);
  const l = await hochladenLaufB5(3, [paket], { dossier: DOSSIER_OK });
  assert.strictEqual(l.hochladenRufe.length, 0);
  assert.match(l.meldung, /unerwartete Dateiendung/);
  assert.match(l.meldung, /anhang\.docx/);
});

test('K2: Schritt 2 (kein Blockdatei-Gate) entpackt kein ZIP — bleibt bei der bestehenden xlsx-Abweisung', async () => {
  const l = await hochladenLauf(2, { name: 'paket.zip' });
  assert.strictEqual(l.hochgeladenMit.datei, null);
  assert.match(l.meldung, /\.xlsx-Datei/);
});

/* ---------- B9-F1: die Dateiauswahl ueberlebt keinen Render (Live-Befund) ----------
   controller.render() baut die Schritt-Ansicht als HTML-String neu — der Datei-Input
   #datei ist danach ein NEUES, leeres Element (Datei-Inputs sind nicht programmatisch
   wiederbefuellbar). Schritt 3 loest nach dem Oeffnen mehrere asynchrone Nachladen-
   Render aus (dossierNachladen, briefingNachladen, ordnerNachladen fuer zwei Ordner) —
   wer waehlt und erst NACH so einem Zwischen-Render klickt, traf bisher auf ein leeres
   feld.files und damit auf den Guard "if (!dateiListe.length) { feld.click(); return; }"
   statt auf einen Upload. Fix: File-Objekte leben im JS-Heap weiter, nur das Element
   stirbt — die Auswahl wird deshalb beim change-Event in state.data.dateiAuswahl
   gehoben (mit Positions-Stempel, Muster _formularSnapshot) und controller.hochladen
   liest sie dort zuerst, feld.files bleibt nur der Ruckfall. */

function hochladenLaufAuswahl(n, feldDateien, auswahlDateien) {
  const meldung = { textContent: '', hidden: true };
  const hochgeladenMit = { ordner: null, datei: null };

  state.data.inhalt = JSON.parse(JSON.stringify(INHALT));
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz',
                        schritt: +n, status: 'inArbeit' }];
  state.data.dateien = {};
  state.data.dossier = { 'AFL-001': undefined };
  state.data.dateiAuswahl = auswahlDateien
    ? { kursId: 'AFL-001', schrittId: String(n), dateien: auswahlDateien }
    : null;
  state.fehlerHinweis = null;
  state.hinweis = null;
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: String(n),
                     werkzeugId: null, werk: null, variante: null, weg: null };

  global.document = {
    getElementById: function (id) {
      if (id === 'datei') return { files: feldDateien, click: function () {} };
      if (id === 'hochladefehler') return meldung;
      return null;
    }
  };

  graph.ordnerInhalt = function () { return Promise.resolve([]); };
  graph.hochladen = function (kursId, ordner, datei) {
    hochgeladenMit.ordner = ordner; hochgeladenMit.datei = datei;
    return Promise.resolve();
  };
  graph.standNachAblage = function () { return null; };
  graph.standSetzenRoh = function () { return Promise.resolve(); };
  controller.render = function () {};

  const knopf = { disabled: false, textContent: 'Hochladen' };
  controller.hochladen(String(n), knopf);
  return new Promise(function (r) { setTimeout(r, 30); }).then(function () {
    return { hochgeladenMit: hochgeladenMit, meldung: meldung.textContent,
             dateiAuswahlNachher: state.data.dateiAuswahl };
  });
}

test('B9-F1 (1): Aenderung am Datei-Input hebt die Auswahl mit Positions-Stempel in den State und rendert; die Ansicht zeigt beide Namen escaped', () => {
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '6', werkzeugId: null,
                     werk: null, variante: null, weg: null };
  state.data.dateiAuswahl = null;
  let renderRufe = 0;
  controller.render = function () { renderRufe++; };

  const el = { files: [{ name: 'export.mbz' }, { name: '<img onerror=alert(1)>.png' }] };
  controller.dateiGewaehlt(el);

  assert.strictEqual(renderRufe, 1, 'render haette genau einmal aufgerufen werden muessen');
  assert.deepStrictEqual(state.data.dateiAuswahl, {
    kursId: 'AFL-001', schrittId: '6',
    dateien: [{ name: 'export.mbz' }, { name: '<img onerror=alert(1)>.png' }]
  });

  const h = ansichten.einSchritt(INHALT, AFL, 6, null,
    { ordnerFehlt: false, dateien: [], dateiAuswahl: state.data.dateiAuswahl.dateien });
  assert.ok(h.indexOf('Gew&auml;hlt') >= 0, 'die Auswahl wird nicht angezeigt');
  assert.ok(h.indexOf('export.mbz') >= 0, 'Dateiname export.mbz fehlt');
  assert.ok(h.indexOf('(2 Dateien)') >= 0, 'Anzahl fehlt oder falsch');
  assert.ok(h.indexOf('&lt;img onerror=alert(1)&gt;.png') >= 0, 'Fremdwert nicht escaped');
  assert.ok(h.indexOf('<img onerror=alert(1)>.png') < 0, 'ungeescapter Fremdwert im HTML');
});

test('B9-F1 (2) DER BEFUND: Auswahl im State, Input nach Render leer — controller.hochladen laedt trotzdem', async () => {
  const l = await hochladenLaufAuswahl(6, [], [{ name: 'AFL-001_export.mbz' }]);
  assert.strictEqual(l.meldung, '', 'kein Upload-Fehler erwartet: ' + l.meldung);
  assert.strictEqual(l.hochgeladenMit.ordner, '06_moodle');
  assert.strictEqual(l.hochgeladenMit.datei, 'AFL-001_export.mbz');
});

test('B9-F1 (3): ein erfolgreicher Upload leert die State-Auswahl wieder', async () => {
  const l = await hochladenLaufAuswahl(6, [], [{ name: 'AFL-001_export.mbz' }]);
  assert.strictEqual(l.hochgeladenMit.datei, 'AFL-001_export.mbz', 'Testvoraussetzung: Upload lief durch');
  assert.strictEqual(l.dateiAuswahlNachher, null, 'die State-Auswahl haette nach Erfolg geleert werden muessen');

  const h = ansichten.einSchritt(INHALT, AFL, 6, null, { ordnerFehlt: false, dateien: [], dateiAuswahl: null });
  assert.ok(h.indexOf('Gew&auml;hlt') < 0, 'nach dem Leeren duerfen keine Geister-Namen mehr stehen');
});

test('B9-F1 (4) Stempel-Schutz: eine Auswahl von einem anderen Kurs/Schritt wird nicht verwendet', async () => {
  const meldung = { textContent: '', hidden: true };
  const hochgeladenMit = { ordner: null, datei: null };
  let geklickt = false;

  state.data.inhalt = JSON.parse(JSON.stringify(INHALT));
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz', schritt: 6, status: 'inArbeit' }];
  state.data.dateien = {};
  state.data.dossier = { 'AFL-001': undefined };
  /* Auswahl gehoert zu Kurs B (VL-001) bzw. einem anderen Schritt — fuer die aktuelle
     Ansicht (AFL-001, Schritt 6) darf sie nicht einspringen. */
  state.data.dateiAuswahl = { kursId: 'VL-001', schrittId: '6', dateien: [{ name: 'fremd.mbz' }] };
  state.fehlerHinweis = null;
  state.hinweis = null;
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '6', werkzeugId: null,
                     werk: null, variante: null, weg: null };

  global.document = {
    getElementById: function (id) {
      if (id === 'datei') return { files: [], click: function () { geklickt = true; } };
      if (id === 'hochladefehler') return meldung;
      return null;
    }
  };
  graph.ordnerInhalt = function () { return Promise.resolve([]); };
  graph.hochladen = function (kursId, ordner, datei) {
    hochgeladenMit.ordner = ordner; hochgeladenMit.datei = datei;
    return Promise.resolve();
  };
  controller.render = function () {};

  const knopf = { disabled: false, textContent: 'Hochladen' };
  controller.hochladen('6', knopf);
  await new Promise(function (r) { setTimeout(r, 30); });

  assert.strictEqual(hochgeladenMit.datei, null, 'die fremde Auswahl haette nicht hochgeladen werden duerfen');
  assert.strictEqual(geklickt, true, 'ohne passende Auswahl haette der Dateidialog erneut geoeffnet werden muessen (bisheriger Guard)');
});

/* Regressionsbeleg (5): bestehende Wege setzen feld.files direkt und klicken sofort,
   ohne je state.data.dateiAuswahl zu befuellen — der Ruckfall-Pfad deckt sie weiterhin,
   unveraendert gegenueber vor B9-F1. */
test('B9-F1 (5): ohne State-Auswahl bleibt feld.files der Weg — Regressionsbeleg', async () => {
  state.data.dateiAuswahl = null;
  const l = await hochladenLaufAuswahl(6, [{ name: 'AFL-001_export.mbz' }], null);
  assert.strictEqual(l.meldung, '', 'kein Upload-Fehler erwartet: ' + l.meldung);
  assert.strictEqual(l.hochgeladenMit.datei, 'AFL-001_export.mbz');
});

/* ---------- B9-F1 Fix-Runde 1 (Review-Finding): dateiAuswahl ist navigations-fluechtig ----------
   Der urspruengliche Fix (s. o.) loeschte state.data.dateiAuswahl nur in den Erfolgspfaden von
   controller.hochladen — controller.zu() (der Navigations-Handler) fasste sie nirgends an.
   Szenario: Datei gewaehlt, Upload scheitert (Netz), Person navigiert weg, kommt SPAETER zur
   selben Kurs/Schritt-Kombination zurueck — der Positions-Stempel passt wieder, "Gewaehlt:
   {alte Datei}" erscheint erneut, ein Klick laedt die laengst vergessene Datei hoch. Fix:
   controller.zu() vergleicht kursId/schrittId VOR und NACH der Positions-Mutation — verlaesst
   einer der beiden die aktuelle Position, wird die Auswahl geloescht; ein erneuter Aufruf mit
   unveraenderter Position sowie ein reiner Varianten-/Weg-Wechsel (beide beruehren weder kursId
   noch schrittId) loeschen nichts. */

test('B9-F1 Fix-Runde 1 (a): Kurswechsel und Rueckkehr zur selben Kombination loescht die alte Auswahl', () => {
  controller.render = function () {};
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '3', werkzeugId: null,
                     werk: null, variante: null, weg: null };
  controller.dateiGewaehlt({ files: [{ name: 'alt.blocks' }] });
  assert.ok(state.data.dateiAuswahl, 'Testvoraussetzung: die Auswahl wurde gesetzt');

  controller.zu({ kursId: 'DBS-001', schrittId: null });
  assert.strictEqual(state.data.dateiAuswahl, null,
    'beim Wegnavigieren zu einem anderen Kurs haette die Auswahl geloescht werden muessen');

  controller.zu({ kursId: 'AFL-001', schrittId: '3' });
  assert.strictEqual(state.data.dateiAuswahl, null,
    'nach der Rueckkehr zur selben Kurs/Schritt-Kombination darf die alte Datei nicht wieder auftauchen');
});

test('B9-F1 Fix-Runde 1 (a\'): Schrittwechsel innerhalb desselben Kurses loescht die Auswahl ebenso', () => {
  controller.render = function () {};
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '3', werkzeugId: null,
                     werk: null, variante: null, weg: null };
  controller.dateiGewaehlt({ files: [{ name: 'alt.blocks' }] });
  assert.ok(state.data.dateiAuswahl, 'Testvoraussetzung: die Auswahl wurde gesetzt');

  controller.zu({ schrittId: '6' });
  assert.strictEqual(state.data.dateiAuswahl, null,
    'ein reiner Schrittwechsel (derselbe Kurs) haette die Auswahl ebenfalls loeschen muessen');
});

test('B9-F1 Fix-Runde 1 (b) Gegenprobe: unveraenderte Position sowie Varianten-/Weg-Wechsel behalten die Auswahl', () => {
  controller.render = function () {};
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '3', werkzeugId: null,
                     werk: null, variante: null, weg: null };
  controller.dateiGewaehlt({ files: [{ name: 'egal.blocks' }] });
  assert.ok(state.data.dateiAuswahl, 'Testvoraussetzung: die Auswahl wurde gesetzt');

  controller.zu({ schrittId: '3' });
  assert.ok(state.data.dateiAuswahl,
    'ein erneuter Aufruf mit unveraenderter Position haette nichts loeschen duerfen');

  controller.zu({ variante: 'claude' });
  assert.ok(state.data.dateiAuswahl,
    'ein Variantenwechsel innerhalb des Schritts haette nichts loeschen duerfen');

  controller.zu({ weg: 'chat' });
  assert.ok(state.data.dateiAuswahl,
    'ein Wegwechsel innerhalb des Schritts haette nichts loeschen duerfen');
});

/* ---------- B9-F3: persistente Upload-Antwort AM Hochladen-Block ----------
   Live-Befund (dritter Vorfall derselben Klasse): jede Upload-Antwort (Erfolg wie
   Abweisung) landete nur im Meldungsblock OBEN ueber der Ansicht — klemmtSichtbar
   ruft controller.render() SOFORT nach dem Setzen von meld.textContent, der
   Neuaufbau ersetzt den lokalen #hochladefehler-Knoten dabei durch einen neuen,
   leeren. Die Person steht beim Hochladen-Block UNTEN und sieht dort: nichts.
   Fix: state.data.uploadMeldung = { typ: 'ok'|'fehler', text } — gesetzt an jeder
   Stelle, die heute klemmtSichtbar bzw. die Erfolgsmeldung setzt (EIN Punkt fuer
   klemmtSichtbar selbst deckt alle ihre Aufrufer ab, Konvention 9), gerendert IM
   Hochladen-Block (ansichten.js), NICHT beim Rendern konsumiert. Geleert bei:
   neuem Hochladen-Klick (Start), neuer Dateiauswahl (change) und Navigation weg
   von der Kurs/Schritt-Kombination (dasselbe controller.zu()-Muster wie bei
   dateiAuswahl, Fix-Runde 1). */

test('B9-F3 (a): eine Abweisung setzt state.data.uploadMeldung mit typ fehler', async () => {
  xlsxLesen.blaetterUndKoepfe = function () {
    return Promise.resolve([
      { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Lernort','Definition'] }
    ]);
  };
  const l = await hochladenLauf(2, xlsxDatei('egal.xlsx'));
  assert.match(l.meldung, /Struktur weicht vom Contract ab/, 'Testvoraussetzung: Abweisung');
  assert.deepStrictEqual(state.data.uploadMeldung, { typ: 'fehler', text: l.meldung },
    'uploadMeldung haette denselben Text wie die lokale Meldung tragen sollen');
});

test('B9-F3 (b): ein erfolgreicher xlsx-Upload setzt state.data.uploadMeldung mit typ ok', async () => {
  xlsxLesen.blaetterUndKoepfe = function () {
    return Promise.resolve([
      { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Definition','Lernziel (handlungsorientiert)','Bloom-Stufe','Wie prüfbar (MC/MR)','Typisches Fehlverhalten'] },
      { name: '2_Eingangskompetenzen', kopf: ['EK-ID','Thema','Definition','Wissensziel','Bloom-Stufe','Wie prüfbar (MC/MR)','Wie lernbar bei Lücken?'] },
      { name: '3_Drehbuch', kopf: ['Uhrzeit','Dauer','Thema','Phase (W/U/G)','Lernziel-ID','Erwartetes Verhalten / Ergebnis','Aktivität Trainer / Moderation','Material & Hilfsmittel'] },
      { name: '_steckbrief', kopf: ['feld','wert'] }
    ]);
  };
  const l = await hochladenLauf(2, xlsxDatei('egal.xlsx'));
  assert.match(l.hinweis || '', /Hochgeladen als/, 'Testvoraussetzung: Erfolg');
  assert.deepStrictEqual(state.data.uploadMeldung, { typ: 'ok', text: l.hinweis });
});

/* B9-F3-Nachzug (Review-Fund, F3): der .catch(...) des einfachen xlsx-/
   mbz-Uploadpfads (weiterMitUpload) rief bisher nur klemmt(...) statt
   klemmtSichtbar(...) — ein Netz-/Business-Fehler NACH dem struktur-Befund-
   Gate (z. B. graph.hochladen schlaegt fehl) setzte weder
   state.fehlerHinweis noch state.data.uploadMeldung, nur den lokalen
   #hochladefehler-Knoten ohne render(). Der Erfolgspfad (B9-F3 (b) oben)
   war bereits korrekt auf klemmtSichtbar-Niveau (uploadMeldung typ 'ok') —
   hier fehlte nur der Fehler-Zweig. */
test('B9-F3-Nachzug (a): der xlsx-Uploadpfad scheitert am Netzaufruf — state.fehlerHinweis UND uploadMeldung typ fehler', async () => {
  xlsxLesen.blaetterUndKoepfe = function () {
    return Promise.resolve([
      { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Definition','Lernziel (handlungsorientiert)','Bloom-Stufe','Wie prüfbar (MC/MR)','Typisches Fehlverhalten'] },
      { name: '2_Eingangskompetenzen', kopf: ['EK-ID','Thema','Definition','Wissensziel','Bloom-Stufe','Wie prüfbar (MC/MR)','Wie lernbar bei Lücken?'] },
      { name: '3_Drehbuch', kopf: ['Uhrzeit','Dauer','Thema','Phase (W/U/G)','Lernziel-ID','Erwartetes Verhalten / Ergebnis','Aktivität Trainer / Moderation','Material & Hilfsmittel'] },
      { name: '_steckbrief', kopf: ['feld','wert'] }
    ]);
  };
  const l = await hochladenLauf(2, xlsxDatei('egal.xlsx'), undefined, undefined,
    { hochladenWirft: new Error('Graph 500') });
  assert.strictEqual(l.hochgeladenMit.datei, null, 'Testvoraussetzung: der Netzaufruf ist gescheitert');
  assert.match(l.meldung, /Nicht hochgeladen\..*Graph 500/, 'lokale Meldung fehlt oder nennt den Fehler nicht');
  assert.match(l.fehlerHinweis || '', /Graph 500/,
    'state.fehlerHinweis fehlt — ein Zwischen-Render koennte sonst die Meldung verlieren (wie im struktur-Befund-Pfad)');
  assert.deepStrictEqual(state.data.uploadMeldung, { typ: 'fehler', text: l.meldung },
    'uploadMeldung haette denselben Text wie die lokale Meldung tragen sollen');
  assert.strictEqual(l.knopf.disabled, false, 'der Knopf muss nach dem Fehler wieder bedienbar sein');
});

test('B9-F3 (b\'): ein erfolgreicher B5-Upload traegt die Hinweise-Anhaenge in uploadMeldung', async () => {
  const l = await hochladenLaufB5(3, [blockDatei('egal.blocks', blockText())], { dossier: DOSSIER_OK });
  assert.match(l.hinweis || '', /Hochgeladen als AFL-001_skript-claude_v1\.docx/);
  assert.match(l.hinweis || '', /Q-002/, 'Testvoraussetzung: der Hinweise-Anhang steht im Erfolgstext');
  assert.deepStrictEqual(state.data.uploadMeldung, { typ: 'ok', text: l.hinweis },
    'uploadMeldung haette denselben (inkl. Hinweise-Anhang) Text wie state.hinweis tragen sollen');
});

test('B9-F3 (c): die Ansicht zeigt die Meldung im Hochladen-Block — Fehler mit .klemmt, Erfolg mit .hinweis, ohne Haekchen-Doppelung, escaped', () => {
  const fehlerHtml = ansichten.einSchritt(INHALT, AFL, 6, null,
    { ordnerFehlt: false, dateien: [],
      uploadMeldung: { typ: 'fehler', text: 'Nicht hochgeladen: <script>alert(1)</script> kaputt.' } });
  assert.ok(fehlerHtml.indexOf('class="klemmt">Nicht hochgeladen') >= 0,
    'die Fehlermeldung erscheint nicht in der .klemmt-Optik im Block');
  assert.ok(fehlerHtml.indexOf('&lt;script&gt;alert(1)&lt;/script&gt;') >= 0, 'Fremdwert nicht escaped');
  assert.ok(fehlerHtml.indexOf('<script>alert(1)</script>') < 0, 'ungeescapter Fremdwert im HTML');

  const okHtml = ansichten.einSchritt(INHALT, AFL, 6, null,
    { ordnerFehlt: false, dateien: [],
      uploadMeldung: { typ: 'ok', text: 'Hochgeladen als AFL-001_export.mbz' } });
  const okMarke = 'class="hinweis">Hochgeladen als AFL-001_export.mbz</p>';
  assert.ok(okHtml.indexOf(okMarke) >= 0,
    'die Erfolgsmeldung erscheint nicht unveraendert (ohne Haekchen) in der .hinweis-Optik im Block');
  /* Keine Haekchen-Doppelung mit dem oberen Meldungsblock (Auftrag B9-F3): der
     obere Block traegt bereits <b>&#10003;</b> vor state.hinweis — geprueft wird
     hier gezielt der lokale Block selbst (das Segment um okMarke), nicht die
     gesamte Ansicht — die fuehrt an anderer Stelle (Kette, Steckbrief-
     Vollstaendigkeit) ganz legitim eigene Haekchen. */
  const okBlockStart = okHtml.indexOf(okMarke);
  const okUmgebung = okHtml.slice(Math.max(0, okBlockStart - 40), okBlockStart);
  assert.ok(okUmgebung.indexOf('&#10003;') < 0,
    'kein Haekchen unmittelbar vor der lokalen Upload-Erfolgsmeldung erwartet');
});

test('B9-F3 (c\'): ohne uploadMeldung fehlt der Block ganz', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 6, null, { ordnerFehlt: false, dateien: [], uploadMeldung: null });
  assert.ok(h.indexOf('id="hochladefehler"') >= 0, 'der bestehende lokale Fehlerknoten bleibt erhalten');
  assert.ok(h.indexOf('Hochgeladen als') < 0, 'ohne uploadMeldung darf kein Erfolgstext auftauchen');
});

test('B9-F3 (d integration): uploadMeldung uebersteht einen echten controller.render()-Aufruf und erscheint im Hochladen-Block', () => {
  state.auth.account = { name: 'Test' };
  state.data.inhalt = JSON.parse(JSON.stringify(INHALT));
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz', schritt: 2, status: 'inArbeit' }];
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '2', werkzeugId: null,
                     werk: null, variante: null, weg: null };
  /* ordner selbst muss ein geladenes Objekt sein (nicht null), sonst zeigt die
     Ansicht den Kaltstart-Kasten statt des Hochladen-Blocks (ordnerFehlt).
     dossier/briefing dagegen auf null (= "nachgesehen, nichts da") — das
     verhindert echte, ungemockte Netzaufruf-Versuche aus dossierNachladen/
     briefingNachladen heraus (Muster test/formularerhalt.test.js). */
  state.data.ordner = { 'AFL-001': { name: 'AFL-001_test', webUrl: 'https://x' } };
  state.data.dateien = { 'AFL-001/02_lernziele': [] };
  state.data.dossier = { 'AFL-001': null };
  state.data.briefing = { 'AFL-001': null };
  state.hinweis = null; state.fehlerHinweis = null;
  state.data.uploadMeldung = { typ: 'fehler', text: 'Struktur weicht vom Contract ab — Pflichtblatt fehlt.' };

  let geschrieben = '';
  const app = {};
  Object.defineProperty(app, 'innerHTML', { set: function (v) { geschrieben = v; } });
  global.document = {
    getElementById: function (id) {
      if (id === 'app') return app;
      if (id === 'nav') return { innerHTML: '' };
      return null;
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    activeElement: null
  };

  echtesRender();

  assert.deepStrictEqual(state.data.uploadMeldung,
    { typ: 'fehler', text: 'Struktur weicht vom Contract ab — Pflichtblatt fehlt.' },
    'uploadMeldung haette einen echten render()-Aufruf ueberleben muessen (nicht konsumiert wie hinweis/fehlerHinweis)');
  assert.ok(geschrieben.indexOf('Struktur weicht vom Contract ab') >= 0,
    'die Meldung haette im Hochladen-Block der gerenderten Ansicht erscheinen muessen');

  delete global.document;
  state.auth.account = null;
  state.data.uploadMeldung = null;
});

test('B9-F3 (e): eine neue Dateiauswahl (change) leert eine stehende Upload-Meldung', () => {
  controller.render = function () {};
  state.data.uploadMeldung = { typ: 'fehler', text: 'alt' };
  controller.dateiGewaehlt({ files: [{ name: 'neu.blocks' }] });
  assert.strictEqual(state.data.uploadMeldung, null,
    'eine neue Dateiauswahl haette die alte Upload-Meldung leeren sollen');
});

test('B9-F3 (f): ein Kurs-/Schrittwechsel leert die Upload-Meldung, unveraenderte Position/Varianten-/Wegwechsel behalten sie', () => {
  controller.render = function () {};
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '3', werkzeugId: null,
                     werk: null, variante: null, weg: null };
  state.data.uploadMeldung = { typ: 'ok', text: 'Hochgeladen als egal.docx' };

  controller.zu({ schrittId: '3' });
  assert.ok(state.data.uploadMeldung, 'unveraenderte Position haette nichts loeschen duerfen');

  controller.zu({ variante: 'claude' });
  assert.ok(state.data.uploadMeldung, 'ein Variantenwechsel haette nichts loeschen duerfen');

  controller.zu({ schrittId: '6' });
  assert.strictEqual(state.data.uploadMeldung, null,
    'ein Schrittwechsel haette die Upload-Meldung loeschen sollen');
});

test('B9-F3 (g): ein neuer Hochladen-Klick leert eine stehende Meldung sofort, VOR jedem Netzzugriff', () => {
  const meldung = { textContent: '', hidden: true };
  state.data.inhalt = JSON.parse(JSON.stringify(INHALT));
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz', schritt: 6, status: 'inArbeit' }];
  state.data.dateien = {};
  state.data.dossier = { 'AFL-001': undefined };
  state.data.dateiAuswahl = null;
  state.data.uploadMeldung = { typ: 'fehler', text: 'ganz alt' };
  state.fehlerHinweis = null;
  state.hinweis = null;
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '6', werkzeugId: null,
                     werk: null, variante: null, weg: null };

  global.document = {
    getElementById: function (id) {
      if (id === 'datei') return { files: [{ name: 'AFL-001_export.mbz' }] };
      if (id === 'hochladefehler') return meldung;
      return null;
    }
  };
  graph.ordnerInhalt = function () { return new Promise(function () {}); }; /* haengt absichtlich */
  controller.render = function () {};

  controller.hochladen('6', { disabled: false, textContent: 'Hochladen' });

  assert.strictEqual(state.data.uploadMeldung, null,
    'die alte Meldung haette synchron, vor jedem Netzzugriff, geleert werden sollen');
});
