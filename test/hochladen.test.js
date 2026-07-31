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
   anderen Tests der Datei zu verfaellschen. */
async function hochladenLauf(n, dateiObjekt, inhOverride) {
  const meldung = { textContent: '', hidden: true };
  const hochgeladenMit = { ordner: null, datei: null };

  state.data.inhalt = inhOverride || JSON.parse(JSON.stringify(INHALT));
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz',
                        schritt: +n, status: 'inArbeit' }];
  state.data.dateien = {};
  state.fehlerHinweis = null;
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
           fehlerHinweis: state.fehlerHinweis, knopf: knopf };
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
  const l = await hochladenLauf(3, xlsxDatei('AFL-001_skript-claude_v1.docx'), mitFremderEndung);
  assert.strictEqual(gerufen, false, 'xlsxLesen haette nicht aufgerufen werden duerfen — Kontrakt erwartet docx, nicht xlsx');
  assert.strictEqual(l.hochgeladenMit.datei, 'AFL-001_skript-claude_v1.docx',
    'der Upload haette normal laufen sollen, das Gate ist hier nicht scharf');
});
