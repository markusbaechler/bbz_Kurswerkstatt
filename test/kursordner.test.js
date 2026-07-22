const test = require('node:test');
const assert = require('node:assert');

const { inhalt } = require('../inhalt.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];   // Derivate & Strukturierte Produkte Basis
const AFL = KURSE[1];   // Anlagefondslizenz

/* ---------- Kurzname aus dem Kurstitel ---------- */

test('der einfache Fall: ein Wort, klein', () => {
  assert.strictEqual(inhalt.slug('Anlagefondslizenz'), 'anlagefondslizenz');
});

test('Umlaute werden aufgeloest, nicht entfernt', () => {
  assert.strictEqual(inhalt.slug('Vermögen & Vorsorge'), 'vermoegen-vorsorge');
  assert.strictEqual(inhalt.slug('Übergrösse'), 'uebergroesse');
});

test('Sonderzeichen werden zu einem einzigen Bindestrich', () => {
  assert.strictEqual(inhalt.slug('Derivate & Strukturierte  Produkte'),
                     'derivate-strukturierte-produkte');
});

test('kein Bindestrich am Anfang oder Ende', () => {
  assert.strictEqual(inhalt.slug('  — Recht & Compliance —  '), 'recht-compliance');
});

test('bei 40 Zeichen wird gekuerzt, ohne Bindestrich am Rand', () => {
  const s = inhalt.slug('Anlagefonds und Kollektive Kapitalanlagen fuer Fortgeschrittene');
  assert.ok(s.length <= 40, 'zu lang: ' + s.length);
  assert.ok(!/-$/.test(s), 'endet auf Bindestrich: ' + s);
});

test('ohne brauchbaren Titel bleibt es bei der Kurs-ID', () => {
  assert.strictEqual(inhalt.kursordnerName('AFL-001', ''), 'AFL-001');
  assert.strictEqual(inhalt.kursordnerName('AFL-001', '???'), 'AFL-001');
});

test('der Vorschlag fuer AFL-001', () => {
  assert.strictEqual(inhalt.kursordnerName(AFL.kursId, AFL.kurstitel),
                     'AFL-001_anlagefondslizenz');
});

/* ---------- Pruefung eines von Hand geaenderten Namens ---------- */

test('der Vorschlag besteht die eigene Pruefung', () => {
  const n = inhalt.kursordnerName(AFL.kursId, AFL.kurstitel);
  assert.strictEqual(inhalt.kursordnerPruefe(INHALT, AFL.kursId, n), null);
});

test('ein fehlendes Praefix wird beanstandet', () => {
  const m = inhalt.kursordnerPruefe(INHALT, 'AFL-001', 'anlagefondslizenz');
  assert.ok(m && /AFL-001_/.test(m), m);
});

test('das Praefix eines fremden Kurses zaehlt nicht', () => {
  assert.ok(inhalt.kursordnerPruefe(INHALT, 'AFL-001', 'DBS-001_derivate'));
});

test('Grossbuchstaben, Leerzeichen und Umlaute im Kurznamen sind unzulaessig', () => {
  ['AFL-001_Anlagefonds', 'AFL-001_anlage fonds', 'AFL-001_anlagefonds_lizenz',
   'AFL-001_grösse'].forEach(function (n) {
    assert.ok(inhalt.kursordnerPruefe(INHALT, 'AFL-001', n), 'haette klemmen muessen: ' + n);
  });
});

test('ein leerer Kurzname ist unzulaessig — der blosse Unterstrich reicht nicht', () => {
  assert.ok(inhalt.kursordnerPruefe(INHALT, 'AFL-001', 'AFL-001_'));
});

test('mehr als 40 Zeichen im Kurznamen werden beanstandet', () => {
  assert.ok(inhalt.kursordnerPruefe(INHALT, 'AFL-001', 'AFL-001_' + 'a'.repeat(41)));
  assert.strictEqual(inhalt.kursordnerPruefe(INHALT, 'AFL-001', 'AFL-001_' + 'a'.repeat(40)), null);
});

/* Der Grund fuer die ganze Konstruktion: der einzige existierende Kursordner
   entspricht NICHT der Ableitung aus seinem Kurstitel — und muss trotzdem gelten. */
test('der bestehende DBS-Ordner bleibt gueltig, obwohl er vom Vorschlag abweicht', () => {
  const echt = 'DBS-001_derivate-strukturierte-produkte';
  const vorschlag = inhalt.kursordnerName(DBS.kursId, DBS.kurstitel);
  assert.notStrictEqual(echt, vorschlag, 'Testannahme hinfaellig: sie sind gleich');
  assert.strictEqual(inhalt.kursordnerPruefe(INHALT, DBS.kursId, echt), null);
});

/* ---------- Die Unterordner: abgeleitet, nicht aufgelistet ---------- */

test('neun Unterordner, in Reihenfolge', () => {
  assert.deepStrictEqual(inhalt.ordnerliste(INHALT), [
    '00_input', '01_briefing', '02_setup', '03_contract', '04_greenfield',
    '05_content', '06_moodle', '07_abnahme', '08_backbone'
  ]);
});

test('05_content steht einmal, obwohl Schritt 5 und 6 hineinschreiben', () => {
  const l = inhalt.ordnerliste(INHALT);
  assert.strictEqual(l.filter(function (o) { return o === '05_content'; }).length, 1);
});

test('00_input kommt aus zusatzordner — kein Schritt liefert es', () => {
  const ohne = JSON.parse(JSON.stringify(INHALT));
  ohne['ablage-kontrakt'].kursordner.zusatzordner = [];
  assert.ok(inhalt.ordnerliste(ohne).indexOf('00_input') < 0,
            '00_input darf nicht aus den Schritten stammen');
  assert.strictEqual(inhalt.ordnerliste(ohne).length, 8);
});

/* ---------- Das Manifest von Schritt 2 ---------- */

test('das Manifest traegt Kurs-ID, Titel, Kompetenzfeld und Anlagedatum', () => {
  const m = inhalt.manifest(AFL, '2026-07-22');
  assert.deepStrictEqual(m, {
    kursId: 'AFL-001',
    kurstitel: 'Anlagefondslizenz',
    kompetenzfeld: 'Vermögen & Vorsorge',
    angelegt: '2026-07-22'
  });
});

test('das Manifest traegt keine Version — es ist eine Systemdatei', () => {
  const m = inhalt.manifest(AFL, '2026-07-22');
  assert.ok(!('version' in m) && !('v' in m));
});
