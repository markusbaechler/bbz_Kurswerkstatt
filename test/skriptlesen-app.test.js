const test = require('node:test');
const assert = require('node:assert');

/* skript-schema.js vorab requiren, damit root.skriptSchema steht, BEVOR
   skript-lesen.js geladen wird — dieselbe Reihenfolge wie in index.html
   (Muster xlsx-lesen.js/zip-lesen.js, Etappe 3 Task A1). */
require('../skript-schema.js');
const { skriptLesen } = require('../skript-lesen.js');

/* Nur die Kernfaelle — mechanische UMD-Portierung von
   IT_Architektur_bbz/output/tools/skript-lesen.cjs (Task B2). Die volle
   Abdeckung (17 Faelle) leistet die Tools-Suite selbst plus der
   Parity-Waechter (test/app-parity.test.js im Tools-Baum), der Verhalten
   UND Schema beider Fassungen woertlich vergleicht. */

function musterKapitel(ek) {
  return [
    '###KAPITEL nr=1 | ek=' + ek + ' | titel=Was ein Produkt kostet | bloom=2 | richtzeit=25',
    '###HERO', 'Eine Kundin fragt nach.',
    '###STORY', 'Am Tisch liegt der Auszug.',
    '###DEFINITION', 'Die Gebuehr ist die Summe der laufenden Kosten.',
    '###ERKLAERUNG', 'Sie wird laufend entnommen, nicht in Rechnung gestellt.',
    '###FEHLVORSTELLUNG', 'Ein Prozent kostet ein Prozent der Rendite. Falsch.',
    '###BEISPIEL', 'Bei 100000 Franken und 1.16 Prozent sind es 1160 Franken.',
    '###ABBILDUNG typ=kompositions-leiste | titel=Woraus sie besteht',
    'werte: Verwaltung 0.42 | Depotbank 0.08 | Vertrieb 0.55',
    '###INTERAKTION', 'Nimm deinen Auszug und rechne nach.',
    '###MERKSATZ', 'Die Gebuehr bemisst sich am Vermoegen.',
    '###DEEPDIVE', 'Handelskosten sind nicht enthalten.',
    '###WISSENSCHECK', 'frage: Was trifft zu?', 'a) nichts', 'b) alles',
    'loesung: b', 'begruendung: weil es so ist',
    '###ABSCHLUSS', 'Damit kannst du das erklaeren.',
    '###ENDE-KAPITEL',
  ].join('\n');
}

const RAHMEN = [
  '###SKRIPT kurs=VL-001 | variante=claude | titel=Vorsorge | rechtsstand=01.01.2026',
  '###QUELLEN',
  'gelesen: BSV Mitteilungen Nr. 168, 01.01.2026',
  'nicht-geoeffnet: alt.pdf - passwortgeschuetzt',
].join('\n');

const SCHLUSS = ['###ZUORDNUNG', 'Kapitel 1 | VL-001-EK-003 | Reihenfolge wie Contract',
  '###OFFEN', '1 | Groessenordnung Handelskosten - Quelle fehlt'].join('\n');

test('ein vollstaendiges Skript wird ohne Fehler gelesen (Kapitel + Teile)', () => {
  const r = skriptLesen.lies([RAHMEN, musterKapitel('VL-001-EK-003'), SCHLUSS].join('\n'));
  assert.deepStrictEqual(r.fehler, []);
  assert.strictEqual(r.skript.kurs, 'VL-001');
  assert.strictEqual(r.kapitel.length, 1);
  assert.strictEqual(r.kapitel[0].ek, 'VL-001-EK-003');
  assert.strictEqual(r.kapitel[0].teile.MERKSATZ, 'Die Gebuehr bemisst sich am Vermoegen.');
});

test('ein Text ganz ohne ###SKRIPT-Block wirft', () => {
  assert.throws(() => skriptLesen.lies('###QUELLEN\ngelesen: x'), /###SKRIPT fehlt/);
});

test('ein fehlender Baustein wird in fehler[] gemeldet, nicht stillschweigend geschluckt', () => {
  const ohneMerksatz = musterKapitel('VL-001-EK-003')
    .replace('###MERKSATZ\nDie Gebuehr bemisst sich am Vermoegen.\n', '');
  const r = skriptLesen.lies([RAHMEN, ohneMerksatz, SCHLUSS].join('\n'));
  assert.ok(r.fehler.some(f => /MERKSATZ/.test(f)), r.fehler.join(' | '));
});

test('attribute() trennt am Strich', () => {
  const a = skriptLesen.attribute('nr=1 | ek=VL-001-EK-003 | titel=Was ein Produkt kostet');
  assert.strictEqual(a.nr, '1');
  assert.strictEqual(a.ek, 'VL-001-EK-003');
  assert.strictEqual(a.titel, 'Was ein Produkt kostet');
});

/* --- B6: ###ILLUSTRATION — nur die Kernfaelle, volle Abdeckung in der
   Tools-Suite (test/skript-lesen.test.js) plus der Parity-Waechter. --- */

test('eine Illustration mit datei: ist gueltig und landet als Rohtext in teile.ILLUSTRATION', () => {
  const mitIllustration = musterKapitel('VL-001-EK-003').replace(
    '###HERO\nEine Kundin fragt nach.\n###STORY',
    '###HERO\nEine Kundin fragt nach.\n###ILLUSTRATION\ndatei: VL-001-illustration-01.png\n###STORY'
  );
  const r = skriptLesen.lies([RAHMEN, mitIllustration, SCHLUSS].join('\n'));
  assert.deepStrictEqual(r.fehler, []);
  assert.strictEqual(r.kapitel[0].teile.ILLUSTRATION, 'datei: VL-001-illustration-01.png');
});

test('eine Illustration ohne datei: und ohne katalog: wird abgewiesen', () => {
  const ohneFeld = musterKapitel('VL-001-EK-003').replace(
    '###HERO\nEine Kundin fragt nach.\n###STORY',
    '###HERO\nEine Kundin fragt nach.\n###ILLUSTRATION\nszene: Eine Kundin am Beratungstisch\n###STORY'
  );
  const r = skriptLesen.lies([RAHMEN, ohneFeld, SCHLUSS].join('\n'));
  assert.ok(r.fehler.some((f) => /Illustration ohne Feld datei oder katalog/.test(f)), r.fehler.join(' | '));
});

test('eine Ziffernfolge laenger als zwei Stellen in szene: wird abgewiesen — die Nie-Fakten-Regel (B6)', () => {
  const mitZahl = musterKapitel('VL-001-EK-003').replace(
    '###HERO\nEine Kundin fragt nach.\n###STORY',
    '###HERO\nEine Kundin fragt nach.\n###ILLUSTRATION\nkatalog: geld\nszene: Der Wert 1160 im Bild\n###STORY'
  );
  const r = skriptLesen.lies([RAHMEN, mitZahl, SCHLUSS].join('\n'));
  assert.ok(r.fehler.some((f) => f === 'Kapitel VL-001-EK-003: Illustration: Zahlen gehoeren nicht ins Bild'),
    r.fehler.join(' | '));
});

test('eine datei: mit unzulaessigen Zeichen wird abgewiesen (Ledger-Hinweis aus B4: Sanitisierung)', () => {
  const mitPfad = musterKapitel('VL-001-EK-003').replace(
    '###HERO\nEine Kundin fragt nach.\n###STORY',
    '###HERO\nEine Kundin fragt nach.\n###ILLUSTRATION\ndatei: ../geheim/illustration.png\n###STORY'
  );
  const r = skriptLesen.lies([RAHMEN, mitPfad, SCHLUSS].join('\n'));
  assert.ok(r.fehler.some((f) => /unzulaessige Zeichen/.test(f)), r.fehler.join(' | '));
});

/* Ledger-Hinweis aus B2: gesehen-EKs muessen ueber ein echtes Set laufen,
   nicht ueber ein Plain-Object — sonst kollidiert ek="constructor" mit dem
   geerbten Object.prototype.constructor (wahrheitswertig, ohne je gesetzt
   worden zu sein) und meldet faelschlich "doppelt" beim ERSTEN Kapitel. */
test('ek="constructor" kollidiert nicht mit dem Object-Prototype (Ledger-Hinweis aus B2)', () => {
  const einzeln = musterKapitel('constructor');
  const r = skriptLesen.lies([RAHMEN.replace('kurs=VL-001', 'kurs=VL-001'), einzeln,
    '###ZUORDNUNG', 'Kapitel 1 | constructor | Reihenfolge wie Contract',
    '###OFFEN', '1 | Test'].join('\n'));
  assert.deepStrictEqual(r.fehler, []);
  assert.strictEqual(r.kapitel.length, 1);
});
