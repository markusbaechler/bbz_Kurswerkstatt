const test = require('node:test');
const assert = require('node:assert');

/* Ladereihenfolge wie im Browser (index.html): das jeweilige Schema VOR dem
   Parser, der es lazy holt (Muster S()/Z() in xlsx-lesen.js/skript-lesen.js/
   didaktik-lesen.js). require('../inhalt.js') selbst braucht keine der
   beiden Schema-Dateien vorab — didaktikPruefe() ruft weder skriptSchema
   noch didaktikSchema, nur die bereits GEPARSTEN Ergebnisobjekte. Trotzdem
   vorab requiren, damit die Fixture-Builder unten (skriptLesen.lies()/
   didaktikLesen.lies()) echte Parser gegen echte Schemata laufen lassen. */
require('../skript-schema.js');
require('../didaktik-schema.js');
const { inhalt } = require('../inhalt.js');
const { skriptLesen } = require('../skript-lesen.js');
const { didaktikLesen } = require('../didaktik-lesen.js');
const { dossier } = require('../dossier.js');

/* ---------- inhalt.didaktikPruefe (D2, Etappe 5) ----------
   Reine Abnahme-Regeln fuer Schritt 5 (Didaktik/Interaktions-Contracts) —
   Gegenstueck zu validierungPruefe (Schritt 4). D1 (didaktik-lesen.js)
   prueft die Grammatik (Pflichtfelder, Typ-Katalog, ek+nr-Duplikate) schon
   selbst; didaktikPruefe uebernimmt nur die drei Kontext-Regeln, fuer die
   die Grammatik allein blind ist: R1 Abdeckung (Content <-> Contracts),
   R2 Zahlen-Schutz (Contract-Zahlen muessen im Content belegt sein),
   R3 Punkte-Abdeckung (Dossier-Punkte <-> ###PUNKTE). Fixtures ausschliess-
   lich ueber die ECHTEN Parser (skriptLesen.lies()/didaktikLesen.lies()),
   kein Handbau der gelesen-Objekte (Muster test/skriptpruefe.test.js). */

function worte(n, praefix) {
  var w = [];
  for (var i = 0; i < n; i++) w.push((praefix || 'wort') + i);
  return w.join(' ');
}

/* Ein einzelnes Content-Kapitel — alle zwoelf Pflichtbausteine mit knappem,
   aber nichtleerem Inhalt (das Wortbudget ist validierungPruefes Sache,
   nicht didaktikPruefes). opts.beispiel erlaubt einen frei gewaehlten
   BEISPIEL-Text, damit R2 (Zahlen-Schutz) gezielt Zahlen im Content
   platzieren kann. */
function kapitelBlock(opts) {
  opts = opts || {};
  var ek = opts.ek || 'VL-002-EK-001';
  var nr = opts.nr || 1;
  var beispiel = opts.beispiel != null ? opts.beispiel : worte(3, 'bsp');
  return [
    '###KAPITEL nr=' + nr + ' | ek=' + ek + ' | titel=Kapitel ' + nr + ' | bloom=2 | richtzeit=25',
    '###HERO', worte(3, 'hero'),
    '###STORY', worte(3, 'story'),
    '###DEFINITION', worte(3, 'def'),
    '###ERKLAERUNG', worte(3, 'erkl'),
    '###FEHLVORSTELLUNG', worte(3, 'fehl'),
    '###BEISPIEL', beispiel,
    '###ABBILDUNG typ=kompositions-leiste | titel=Verteilung',
    'werte: Teil eins 1 | Teil zwei 2',
    '###INTERAKTION', worte(3, 'inter'),
    '###MERKSATZ', worte(3, 'merk'),
    '###DEEPDIVE', worte(3, 'deep'),
    '###WISSENSCHECK', 'frage: Was trifft zu?', 'a) nichts', 'b) alles',
    'loesung: b', 'begruendung: weil es so ist',
    '###ABSCHLUSS', worte(3, 'schluss'),
    '###ENDE-KAPITEL'
  ].join('\n');
}

/* Der freigegebene Content (skriptLesen.lies()-Text) — ein ###SKRIPT-Kopf
   plus die uebergebenen Kapitel (je opts s. kapitelBlock). */
function contentBlock(kapitelOptsListe) {
  var kopf = '###SKRIPT kurs=VL-002 | variante=claude | titel=Vorsorge | rechtsstand=01.01.2026';
  var quellen = '###QUELLEN\ngelesen: BSV Mitteilungen Nr. 168, 01.01.2026';
  return [kopf, quellen].concat(kapitelOptsListe.map(kapitelBlock)).join('\n');
}
function content(kapitelOptsListe) { return skriptLesen.lies(contentBlock(kapitelOptsListe)); }

/* Ein einzelner Interaktions-Contract — die vier R2-relevanten Felder
   (kernaussage/vorhersage/konsequenz/stuetztext) sind frei ueberschreibbar,
   damit R2 gezielt Zahlen im Contract platzieren kann. typ=fliesstext
   spart sich das Modell-Feldquintett (steuert/beobachtet/aha/vorhersage/
   konsequenz) zugunsten von begruendung — fuer R1/R3 irrelevant, deshalb
   bleibt der Standard-Typ regler. */
function contractText(opts) {
  opts = opts || {};
  var ek = opts.ek || 'VL-002-EK-001';
  var nr = opts.nr || 1;
  var typ = opts.typ || 'regler';
  var kernaussage = opts.kernaussage || 'Die Praemie sinkt, wenn der Selbstbehalt steigt.';
  var vorhersage = opts.vorhersage || 'Wie stark sinkt die Praemie?';
  var konsequenz = opts.konsequenz || 'Ein zu hoher Selbstbehalt kann das Budget sprengen.';
  var stuetztext = opts.stuetztext || 'Der Zusammenhang ist nicht linear, sondern haengt vom Modell ab.';
  var lines = [
    '###CONTRACT ek=' + ek + ' | nr=' + nr + ' | typ=' + typ,
    'kernaussage: ' + kernaussage,
    'zielhandlung: Regler bewegen und den Effekt beobachten.',
    'denkfehler: Ein hoeherer Selbstbehalt senkt die Praemie automatisch um denselben Betrag.',
    'stuetztext: ' + stuetztext
  ];
  if (typ === 'fliesstext') {
    lines.push('begruendung: Ein Rechenbeispiel reicht hier ohne interaktives Modell.');
  } else {
    lines.push('steuert: den Selbstbehalt in Franken');
    lines.push('beobachtet: die monatliche Praemie');
    lines.push('aha: bei kleinen Selbstbehalten aendert sich wenig');
    lines.push('vorhersage: ' + vorhersage);
    lines.push('konsequenz: ' + konsequenz);
  }
  lines.push('###ENDE-CONTRACT');
  return lines.join('\n');
}

/* ###PUNKTE — eine Liste { punkt, entscheid? , verschieben?, begruendung? }. */
function punkteBlock(eintraege) {
  var lines = ['###PUNKTE'];
  eintraege.forEach(function (e) {
    lines.push('punkt: ' + e.punkt);
    if (e.entscheid) lines.push('entscheid: ' + e.entscheid);
    if (e.verschieben) {
      lines.push('verschieben: ' + e.verschieben);
      lines.push('begruendung: ' + (e.begruendung || 'Begruendung.'));
    }
  });
  return lines.join('\n');
}

function didaktikBlock(opts) {
  opts = opts || {};
  var kopf = '###CONTRACTS kurs=VL-002 | basiert_auf=VL-002_content_final.blocks';
  var contracts = (opts.contracts || [contractText()]).join('\n');
  var text = [kopf, contracts].join('\n');
  if (opts.punkte) text += '\n' + opts.punkte;
  return text;
}
function didaktik(opts) { return didaktikLesen.lies(didaktikBlock(opts)); }

/* Minimales Dossier — regulatorik/content_modus/quellen sind fuer
   didaktikPruefe irrelevant (die liest nur d.offen), aber ein realistischer
   Rahmen schadet nicht. offenListe ist d.offen direkt. */
function D(offenListe) {
  return {
    regulatorik: { stand: '1.1.2026' }, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001' }], offen: offenListe || []
  };
}

const ZIELE = dossier.ZIELE;

/* ---------- null ohne d / ohne contentGelesen ---------- */

test('null ohne d (Dossier nicht geladen)', () => {
  const c = content([{ ek: 'VL-002-EK-001' }]);
  const g = didaktik({ contracts: [contractText()] });
  assert.strictEqual(inhalt.didaktikPruefe(g, null, 'VL-002', c, ZIELE), null);
  assert.strictEqual(inhalt.didaktikPruefe(g, undefined, 'VL-002', c, ZIELE), null);
});

test('null ohne contentGelesen (Content nicht geladen)', () => {
  const g = didaktik({ contracts: [contractText()] });
  assert.strictEqual(inhalt.didaktikPruefe(g, D(), 'VL-002', null, ZIELE), null);
  assert.strictEqual(inhalt.didaktikPruefe(g, D(), 'VL-002', undefined, ZIELE), null);
});

/* ---------- R1: Abdeckung ---------- */

test('R1: eine Content-EK ohne Contract ist ein Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-001' }, { ek: 'VL-002-EK-002', nr: 2 }]);
  assert.deepStrictEqual(c.fehler, []);
  const g = didaktik({ contracts: [contractText({ ek: 'VL-002-EK-001', nr: 1 })] });
  assert.deepStrictEqual(g.fehler, []);
  const r = inhalt.didaktikPruefe(g, D(), 'VL-002', c, ZIELE);
  assert.ok(r.fehler.some((f) => f === 'Eingangskompetenz VL-002-EK-002: kein Interaktions-Contract vorhanden.'),
    r.fehler.join(' | '));
});

test('R1 Gegenprobe: jede Content-EK hat einen Contract — kein Fehlend-Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-001' }]);
  const g = didaktik({ contracts: [contractText({ ek: 'VL-002-EK-001', nr: 1 })] });
  const r = inhalt.didaktikPruefe(g, D(), 'VL-002', c, ZIELE);
  assert.ok(!r.fehler.some((f) => /kein Interaktions-Contract vorhanden/.test(f)), r.fehler.join(' | '));
});

test('R1: ein Contract auf eine nicht existierende EK ist ein Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-001' }]);
  const g = didaktik({
    contracts: [
      contractText({ ek: 'VL-002-EK-001', nr: 1 }),
      contractText({ ek: 'VL-002-EK-999', nr: 2 })
    ]
  });
  assert.deepStrictEqual(g.fehler, []);
  const r = inhalt.didaktikPruefe(g, D(), 'VL-002', c, ZIELE);
  assert.ok(r.fehler.some((f) => f === 'Contract 2: Eingangskompetenz "VL-002-EK-999" existiert nicht im freigegebenen Content.'),
    r.fehler.join(' | '));
});

test('R1 Gegenprobe: jeder Contract zeigt auf eine existierende EK — kein Erfunden-Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-001' }]);
  const g = didaktik({ contracts: [contractText({ ek: 'VL-002-EK-001', nr: 1 })] });
  const r = inhalt.didaktikPruefe(g, D(), 'VL-002', c, ZIELE);
  assert.ok(!r.fehler.some((f) => /existiert nicht im freigegebenen Content/.test(f)), r.fehler.join(' | '));
});

/* ---------- R2: Zahlen-Schutz ---------- */

test('R2: das Zahlenpaar 22\'680 (Contract) / 22680 (Content) ist normalisiert KEIN Fehler; eine erfundene 99999 ist ein Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-005', beispiel: 'Der Jahreslohn betraegt 22680 Franken im Beispielfall.' }]);
  const g = didaktik({
    contracts: [contractText({
      ek: 'VL-002-EK-005', nr: 1,
      kernaussage: 'Der massgebende Lohn liegt bei 22\'680 Franken.',
      vorhersage: 'Steigt der Wert je auf 99999?'
    })]
  });
  assert.deepStrictEqual(g.fehler, []);
  const r = inhalt.didaktikPruefe(g, D(), 'VL-002', c, ZIELE);
  assert.ok(!r.fehler.some((f) => /22'680/.test(f)),
    'normalisiertes Zahlenpaar haette keinen Fehler erzeugen duerfen: ' + r.fehler.join(' | '));
  assert.ok(r.fehler.some((f) => f === 'Contract 1 (VL-002-EK-005): Zahl 99999 kommt im freigegebenen Content nicht vor.'),
    r.fehler.join(' | '));
});

/* ---------- R3: Punkte-Abdeckung ---------- */

test('R3: ein offener Dossier-Punkt ohne passende punkt:-Zeile ist ein Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-010' }]);
  const g = didaktik({ contracts: [contractText({ ek: 'VL-002-EK-010', nr: 1 })] });
  const was = 'Soll der Rechner Franken oder Prozent zeigen?';
  const d = D([{ was: was, wo: 'Contract 1', fuer: 'schritt-5' }]);
  const r = inhalt.didaktikPruefe(g, d, 'VL-002', c, ZIELE);
  assert.ok(r.fehler.some((f) => f === 'Offener Punkt nicht behandelt: "' + was + '"'), r.fehler.join(' | '));
});

test('R3: ein Punkt mit unbekanntem Wortlaut in ###PUNKTE ist ein Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-010' }]);
  const punkt = 'Ein Punkt, den das Dossier nicht kennt.';
  const g = didaktik({
    contracts: [contractText({ ek: 'VL-002-EK-010', nr: 1 })],
    punkte: punkteBlock([{ punkt: punkt, entscheid: 'Erledigt.' }])
  });
  assert.deepStrictEqual(g.fehler, []);
  const r = inhalt.didaktikPruefe(g, D([]), 'VL-002', c, ZIELE);
  assert.ok(r.fehler.some((f) => f === 'Unbekannter Punkt in ###PUNKTE: "' + punkt + '"'), r.fehler.join(' | '));
});

test('R3: ein doppelt behandelter Punkt ist ein Fehler', () => {
  const c = content([{ ek: 'VL-002-EK-010' }]);
  const was = 'Soll der Rechner Franken oder Prozent zeigen?';
  const g = didaktik({
    contracts: [contractText({ ek: 'VL-002-EK-010', nr: 1 })],
    punkte: punkteBlock([
      { punkt: was, entscheid: 'Franken.' },
      { punkt: was, entscheid: 'Nochmal Franken.' }
    ])
  });
  assert.deepStrictEqual(g.fehler, []);
  const d = D([{ was: was, wo: 'Contract 1', fuer: 'schritt-5' }]);
  const r = inhalt.didaktikPruefe(g, d, 'VL-002', c, ZIELE);
  assert.ok(r.fehler.some((f) => f === 'Punkt doppelt behandelt: "' + was + '"'), r.fehler.join(' | '));
});

test('R3: ein ungueltiges Verschiebe-Ziel ist ein Fehler — unbekanntes Ziel UND schritt-5 selbst', () => {
  const c = content([{ ek: 'VL-002-EK-010' }]);
  const was1 = 'Punkt A — gehoert nicht hierher.';
  const was2 = 'Punkt B — bleibt eigentlich hier.';
  const g = didaktik({
    contracts: [contractText({ ek: 'VL-002-EK-010', nr: 1 })],
    punkte: punkteBlock([
      { punkt: was1, verschieben: 'schritt-99', begruendung: 'Kein gueltiges Ziel.' },
      { punkt: was2, verschieben: 'schritt-5', begruendung: 'Verschiebt an sich selbst.' }
    ])
  });
  assert.deepStrictEqual(g.fehler, []);
  const d = D([
    { was: was1, wo: 'Contract 1', fuer: 'schritt-5' },
    { was: was2, wo: 'Contract 1', fuer: 'schritt-5' }
  ]);
  const r = inhalt.didaktikPruefe(g, d, 'VL-002', c, ZIELE);
  assert.ok(r.fehler.some((f) => f === 'Punkt "' + was1 + '": ungültiges Verschiebe-Ziel "schritt-99"'), r.fehler.join(' | '));
  assert.ok(r.fehler.some((f) => f === 'Punkt "' + was2 + '": ungültiges Verschiebe-Ziel "schritt-5"'), r.fehler.join(' | '));
});

test('Vollzufriedenheits-Fall: jeder Punkt genau einmal behandelt, gueltige Ziele — fehler: []', () => {
  const c = content([{ ek: 'VL-002-EK-010' }]);
  const was1 = 'Punkt A — wird entschieden.';
  const was2 = 'Punkt B — wird verschoben.';
  const g = didaktik({
    contracts: [contractText({ ek: 'VL-002-EK-010', nr: 1 })],
    punkte: punkteBlock([
      { punkt: was1, entscheid: 'Erledigt.' },
      { punkt: was2, verschieben: 'schritt-6', begruendung: 'Gehoert zur Review-Ansicht, nicht zur Contract-Erstellung.' }
    ])
  });
  assert.deepStrictEqual(g.fehler, []);
  const d = D([
    { was: was1, wo: 'Contract 1', fuer: 'schritt-5' },
    { was: was2, wo: 'Contract 1', fuer: 'schritt-5' }
  ]);
  const r = inhalt.didaktikPruefe(g, d, 'VL-002', c, ZIELE);
  assert.deepStrictEqual(r, { fehler: [], hinweise: [] });
});
