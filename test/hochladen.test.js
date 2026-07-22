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
  assert.strictEqual(inhalt.darfHochladen(INHALT, 3), true, 'Excel');
  assert.strictEqual(inhalt.darfHochladen(INHALT, 7), true, 'Moodle-Export');
  [1, 2, 4, 5, 6, 8, 9].forEach(function (n) {
    assert.strictEqual(inhalt.darfHochladen(INHALT, n), false, 'Schritt ' + n);
  });
});

test('Hochladen und der Weg Chat schliessen sich nicht aus, ueberschneiden sich hier aber nicht', () => {
  [3, 7].forEach(function (n) {
    assert.strictEqual(inhalt.darfAblegen(INHALT, n), false,
      'Schritt ' + n + ' ist kein Weg-Chat-Schritt');
  });
});

/* ---------- Der Zielname — der Mensch tippt ihn nie ---------- */

test('Schritt 3 zaehlt Versionen hoch', () => {
  const z = inhalt.hochladeZiel(INHALT, 3, 'AFL-001', []);
  assert.deepStrictEqual(z, {
    ordner: '03_contract', datei: 'AFL-001_lernziele-drehbuch_v1.xlsx',
    version: 1, format: 'excel'
  });
});

test('liegt schon ein v1, wird die naechste Datei v2', () => {
  const z = inhalt.hochladeZiel(INHALT, 3, 'AFL-001',
    [datei('AFL-001_lernziele-drehbuch_v1.xlsx')]);
  assert.strictEqual(z.datei, 'AFL-001_lernziele-drehbuch_v2.xlsx');
});

/* Genau der Fall, der am 2026-07-22 passiert ist: eine von Hand benannte Datei
   mit Unterstrich statt Bindestrich wird nicht mitgezaehlt. Der Weg Hochladen
   kann diesen Fehler nicht mehr machen, weil er den Namen selbst vergibt. */
test('ein von Hand falsch benanntes v1 wird nicht mitgezaehlt', () => {
  const z = inhalt.hochladeZiel(INHALT, 3, 'AFL-001',
    [datei('AFL-001_lernziele_drehbuch_v1.xlsx')]);
  assert.strictEqual(z.datei, 'AFL-001_lernziele-drehbuch_v1.xlsx',
    'der falsche Name darf die Zaehlung nicht beeinflussen');
});

test('Schritt 7 hat einen festen Namen ohne Version', () => {
  const z = inhalt.hochladeZiel(INHALT, 7, 'DBS-001', []);
  assert.strictEqual(z.ordner, '06_moodle');
  assert.strictEqual(z.datei, 'DBS-001_export.mbz');
  assert.strictEqual(z.version, null, 'der Export traegt keine Version');
});

test('der feste Name bleibt derselbe, egal was schon dort liegt', () => {
  const z = inhalt.hochladeZiel(INHALT, 7, 'DBS-001', [datei('DBS-001_export.mbz')]);
  assert.strictEqual(z.datei, 'DBS-001_export.mbz');
});

/* ---------- Erwartete Endung ---------- */

test('die Endung kommt aus dem Kontrakt — aus ext oder aus dem festen Namen', () => {
  assert.strictEqual(inhalt.erwarteteEndung(INHALT, 3), 'xlsx');
  assert.strictEqual(inhalt.erwarteteEndung(INHALT, 7), 'mbz');
});

/* ---------- Der Block in der Schrittansicht ---------- */

test('Schritt 3 bietet das Hochladen an und nennt das Ziel', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/data-action="hochladen"/.test(h), 'kein Knopf');
  assert.ok(/id="datei"/.test(h), 'kein Dateifeld');
  assert.ok(h.indexOf('<code>03_contract/AFL-001_lernziele-drehbuch_v1.xlsx</code>') >= 0,
    'nennt das Ziel nicht');
  assert.ok(/accept="\.xlsx"/.test(h), 'schlaegt die Endung nicht vor');
});

test('ohne gelesenen Ordner wird kein Zielname behauptet', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false });
  assert.ok(/data-action="hochladen"/.test(h));
  assert.ok(h.indexOf('Ordner wird gelesen') >= 0, 'behauptet eine Version zu frueh');
});

test('ohne Kursordner gibt es nichts hochzuladen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: true });
  assert.ok(!/data-action="hochladen"/.test(h), 'Hochladen ohne Ablage angeboten');
});

/* ---------- „Wohin es kommt" und die Weg-Chips ---------- */

/* Der Platzhalter _v{N} zwang zum Abtippen — und beim Abtippen wurde aus
   lernziele-drehbuch ein lernziele_drehbuch. */
test('ist der Ordner gelesen, steht dort der aufgeloeste Name statt _v{N}', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(h.indexOf('AFL-001_lernziele-drehbuch_v1.xlsx') >= 0, 'nicht aufgeloest');
  assert.ok(h.indexOf('_v{N}') < 0, 'zeigt weiterhin den Platzhalter');
});

test('solange nichts gelesen ist, bleibt der Platzhalter — nichts wird behauptet', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false });
  assert.ok(h.indexOf('_v{N}') >= 0, 'behauptet eine Version, ohne nachgesehen zu haben');
});

test('liegt v1, nennt die Ansicht v2 als Ziel', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null,
    { ordnerFehlt: false, dateien: [datei('AFL-001_lernziele-drehbuch_v1.xlsx')] });
  assert.ok(h.indexOf('AFL-001_lernziele-drehbuch_v2.xlsx') >= 0);
});

/* wege steht in schritte.json UND im Ablage-Kontrakt. In Ablage-Fragen gilt der
   Kontrakt — sonst fehlt ein dort ergaenzter Weg in der Ansicht. */
test('die Weg-Chips kommen aus dem Kontrakt, nicht aus schritte.json', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(h.indexOf('Datei hochladen') >= 0, 'der Weg Hochladen fehlt als Chip');
});

test('ein unbekannter Weg wird roh gezeigt statt verschwiegen', () => {
  const anders = JSON.parse(JSON.stringify(INHALT));
  anders['ablage-kontrakt'].schritte['3'].wege = ['brieftaube'];
  const h = ansichten.einSchritt(anders, AFL, 3, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(h.indexOf('brieftaube') >= 0);
});

test('Schritte ohne den Weg bekommen kein Dateifeld', () => {
  [1, 4, 6].forEach(function (n) {
    const h = ansichten.einSchritt(INHALT, AFL, n, null, { ordnerFehlt: false, dateien: [] });
    assert.ok(!/id="datei"/.test(h), 'Schritt ' + n);
  });
});
