const test = require('node:test');
const assert = require('node:assert');

/* skript-schema.js vorab requiren, damit root.skriptSchema steht, BEVOR
   inhalt.js blocksPruefe() ruft — die Script-Tag-Reihenfolge in index.html
   (inhalt.js VOR skript-schema.js) spielt dank Lazy-Accessor (S() in
   inhalt.js) keine Rolle, s. dort. Node-`require` ist ebenfalls lazy
   innerhalb von S(), aber wir requiren hier trotzdem vorab, damit
   `root.skriptSchema` explizit steht wie im echten Browser-Lauf. */
require('../skript-schema.js');
const { inhalt } = require('../inhalt.js');
const { skriptLesen } = require('../skript-lesen.js');

/* ---------- inhalt.blocksPruefe (B5, Etappe 3b) ----------
   Ersetzt inhalt.skriptPruefe (A2): das Drift-Netz fuer den Chat-Weg von
   Schritt 3, jetzt gegen die BLOCKDATEI statt gegen die .docx (E5-Revision,
   Entscheid Markus 2026-08-03). skriptLesen.lies() prueft die
   Pflichtbausteine je Kapitel schon selbst (pruefeKapitel) — blocksPruefe
   uebernimmt nur, was danach noch fehlt: Q-ID-Abgleich, Marker-Verbot,
   Wortbudget. Reine Funktion hier, kein DOM, kein Netz. */

const D = () => ({ regulatorik: { stand: '1.1.2026' }, content_modus: 'quellengestuetzt',
  quellen: [{ id: 'Q-001' }, { id: 'Q-002' }] });

/* Ein Kapitel mit genug Woertern, um das Wortbudget (hartMin 500) sicher zu
   reissen — je nach Bedarf pro Test angepasst. Nutzt die echte
   skriptLesen-Kette (keine Handstruktur), damit blocksPruefe() gegen ein
   realistisches gelesen-Objekt getestet wird. */
function worte(n, praefix) {
  var w = [];
  for (var i = 0; i < n; i++) w.push((praefix || 'wort') + i);
  return w.join(' ');
}

function block(opts) {
  opts = opts || {};
  var gelesenZeile = opts.gelesen || 'BSV Mitteilungen Nr. 168, 01.01.2026 Q-001';
  var textmenge = opts.woerterJeTeil || 90; // 6 Textteile * 90 = 540 > 500
  return [
    '###SKRIPT kurs=VL-002 | variante=claude | titel=Vorsorge | rechtsstand=01.01.2026',
    '###QUELLEN',
    (opts.ohneGelesen ? '' : 'gelesen: ' + gelesenZeile),
    '###KAPITEL nr=1 | ek=VL-002-EK-001 | titel=Kapitel eins | bloom=2 | richtzeit=25',
    '###HERO', worte(textmenge, 'hero'),
    '###STORY', worte(textmenge, 'story'),
    '###DEFINITION', worte(textmenge, 'def'),
    '###ERKLAERUNG', worte(textmenge, 'erkl'),
    '###FEHLVORSTELLUNG', worte(textmenge, 'fehl'),
    '###BEISPIEL', worte(textmenge, 'bsp'),
    '###ABBILDUNG typ=kompositions-leiste | titel=Verteilung',
    'werte: Teil eins 1 | Teil zwei 2',
    '###INTERAKTION', worte(30, 'inter'),
    '###MERKSATZ', worte(30, 'merk'),
    '###DEEPDIVE', worte(30, 'deep'),
    '###WISSENSCHECK', 'frage: Was trifft zu?', 'a) nichts', 'b) alles',
    'loesung: b', 'begruendung: weil es so ist',
    '###ABSCHLUSS', worte(30, 'schluss'),
    '###ENDE-KAPITEL',
    (opts.marker ? '###OFFEN\n' + opts.marker : '')
  ].join('\n');
}

function gelesen(opts) { return skriptLesen.lies(block(opts)); }

test('sauberes Teil-Skript: keine Fehler, fehlende Q-IDs nur als Hinweis', () => {
  const g = gelesen();
  assert.deepStrictEqual(g.fehler, []);
  const r = inhalt.blocksPruefe(g, D());
  assert.deepStrictEqual(r.fehler, []);
  assert.ok(r.hinweise.some((h) => /Q-002/.test(h)));
});

test('unbekannte Q-ID in der Leseliste ist ein Fehler', () => {
  const g = gelesen({ gelesen: 'BSV Mitteilungen Q-001 Q-009' });
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /Q-009/.test(f) && /Unbekannte/.test(f)));
});

test('Marker "[ZU PRÜFEN" in einem Baustein ist ein Fehler', () => {
  const g = gelesen();
  g.kapitel[0].teile.MERKSATZ += ' [ZU PRÜFEN: Betrag pruefen]';
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /ZU PR/i.test(f) && /MERKSATZ/.test(f)));
});

test('Wortbudget unter 500: eigener Fehler je Kapitel', () => {
  const g = gelesen({ woerterJeTeil: 5 }); // 6*5=30 Woerter, weit unter hartMin
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /Wortbudget/.test(f) && /VL-002-EK-001/.test(f)));
});

test('Wortbudget erreicht (>= 500): kein Budget-Fehler', () => {
  const g = gelesen({ woerterJeTeil: 90 });
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(!r.fehler.some((f) => /Wortbudget/.test(f)));
});

test('quellenfrei: leere Leseliste ohne Q-Verweis ist sauber', () => {
  const d = D(); d.content_modus = 'quellenfrei'; d.quellen = [];
  const g = gelesen({ ohneGelesen: true });
  const r = inhalt.blocksPruefe(g, d);
  assert.deepStrictEqual(r.fehler.filter((f) => /quellenfrei/.test(f)), []);
});

test('quellenfrei, aber eine Leseliste mit Q-ID ist gesetzt: Fehler', () => {
  const d = D(); d.content_modus = 'quellenfrei'; d.quellen = [];
  const g = gelesen({ gelesen: 'Q-001 irgendwas' });
  const r = inhalt.blocksPruefe(g, d);
  assert.ok(r.fehler.some((f) => /quellenfrei/.test(f)));
});

test('ohne Dossier keine Aussage: null, nie ein leeres gruenes Ergebnis', () => {
  const g = gelesen();
  assert.strictEqual(inhalt.blocksPruefe(g, null), null);
});

test('Q-0158 ist nicht Q-015 — Wortgrenze wie quellenSpiegel', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [{ id: 'Q-015' }] };
  const g = gelesen({ gelesen: 'Q-0158 und Q-015' });
  const r = inhalt.blocksPruefe(g, d);
  assert.ok(!r.fehler.some((f) => /Q-0158/.test(f)));
  assert.ok(!r.fehler.some((f) => /Unbekannte.*Q-015\b/.test(f)));
});

test('leeres gelesen-Objekt (kein Kapitel) fuehrt nicht zum Crash', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [] };
  const r = inhalt.blocksPruefe({}, d);
  assert.deepStrictEqual(r.fehler, []);
  assert.deepStrictEqual(r.hinweise, []);
});

/* ---------- inhalt.illustrationenFehlend (B5, B6-Vorgriff) ----------
   ###ILLUSTRATION ist heute (vor B6) kein bekannter Baustein — echter Text
   damit wuerde skriptLesen.lies() schon als "Unbekannter Block" abweisen,
   bevor dieser Check ueberhaupt laeuft (s. Kommentarkopf in inhalt.js).
   Die Funktion ist trotzdem einzeln testbar: gelesen.kapitel[].teile.
   ILLUSTRATION wird direkt gesetzt, wie es der docxBauen-Test fuer denselben
   Vorgriff schon tut (test/docxbauen.test.js). */

test('illustrationenFehlend: referenzierte, aber nicht hochgeladene Datei fehlt', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'datei: szene.png';
  const fehlt = inhalt.illustrationenFehlend(g, ['anderes.png']);
  assert.deepStrictEqual(fehlt, ['szene.png']);
});

test('illustrationenFehlend: liegt die Datei im Upload, fehlt nichts', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'datei: szene.png';
  const fehlt = inhalt.illustrationenFehlend(g, ['szene.png']);
  assert.deepStrictEqual(fehlt, []);
});

test('illustrationenFehlend: ohne ILLUSTRATION-Teil gibt es nichts zu vermissen', () => {
  const g = gelesen();
  const fehlt = inhalt.illustrationenFehlend(g, []);
  assert.deepStrictEqual(fehlt, []);
});

test('illustrationenFehlend: ILLUSTRATION ohne "datei:"-Zeile wird toleriert (kein Fehlen)', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'keine datei-Zeile hier';
  const fehlt = inhalt.illustrationenFehlend(g, []);
  assert.deepStrictEqual(fehlt, []);
});
