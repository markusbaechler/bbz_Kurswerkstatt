'use strict';
/* register.js (Etappe 4, Task V7) — reine Funktionen fuer das zentrale
   Register (_zentral/register.json, eine Zeile je Kapitel/Eingangskompetenz,
   ueber alle Kurse hinweg). zeilenAus laeuft ueber die ECHTE
   skriptLesen.lies()-Kette (Muster jeder Etappe-4-Testdatei, kein Handbau
   der gelesen-Objekte) — die Fixtures unten fuehren nur so viel
   Blockgrammatik, wie fuer ein gueltiges ###SKRIPT und je Kapitel EK/Titel/
   VALIDIERUNG noetig ist; die zwoelf Pflichtbausteine bleiben absichtlich
   weg (gelesen.fehler ist fuer register.js irrelevant, s. app.js). */
const test = require('node:test');
const assert = require('node:assert');

const { register } = require('../register.js');
require('../skript-schema.js');
require('../skript-lesen.js');
const { skriptLesen } = require('../skript-lesen.js');

function blockText(opts) {
  opts = opts || {};
  const kurs = opts.kurs || 'VL-001';
  const zeilen = [
    '###SKRIPT kurs=' + kurs + ' | variante=claude | titel=Test | rechtsstand=1.1.2026',
    '###QUELLEN'
  ];
  if (opts.gelesenZeile !== undefined) zeilen.push('gelesen: ' + opts.gelesenZeile);
  zeilen.push('###KAPITEL nr=1 | ek=' + kurs + '-EK-001 | titel=Kapitel eins');
  if (opts.kapitel1Validierung !== false) {
    zeilen.push('###VALIDIERUNG', 'herkunft: bestaetigt');
  }
  zeilen.push('###ENDE-KAPITEL');
  zeilen.push('###KAPITEL nr=2 | ek=' + kurs + '-EK-002 | titel=Kapitel zwei');
  zeilen.push('###VALIDIERUNG', 'herkunft: korrigiert', 'beleg: Contract S.4');
  zeilen.push('###ENDE-KAPITEL');
  if (opts.zuordnung) zeilen.push('###ZUORDNUNG', opts.zuordnung.join('\n'));
  return zeilen.join('\n');
}

const DOSSIER = {
  regulatorik: { stand: '1.1.2026' },
  quellen: [
    { id: 'Q-001', stand: '2024' },
    { id: 'Q-002', stand: '2025' },
    { id: 'Q-003', stand: '2026' }
  ]
};

/* ---------- zeilenAus ---------- */

test('zeilenAus: Zuordnung greift — Q-IDs je EK kommen aus der passenden ###ZUORDNUNG-Zeile', () => {
  const gelesen = skriptLesen.lies(blockText({
    gelesenZeile: 'Q-001 Q-002 Q-003',
    zuordnung: [
      'Kapitel 1 | VL-001-EK-001 | Q-001',
      'Kapitel 2 | VL-001-EK-002 | Q-002 Q-003'
    ]
  }));
  const zeilen = register.zeilenAus(gelesen, DOSSIER, 'VL-001', 'validiert');
  assert.strictEqual(zeilen.length, 2);
  assert.deepStrictEqual(zeilen[0].quellen, [{ id: 'Q-001', stand: '2024' }]);
  assert.deepStrictEqual(zeilen[1].quellen, [
    { id: 'Q-002', stand: '2025' }, { id: 'Q-003', stand: '2026' }
  ]);
});

test('zeilenAus: Rueckfall auf die dokumentweite Leseliste, wenn keine ###ZUORDNUNG-Zeile die EK nennt', () => {
  const gelesen = skriptLesen.lies(blockText({ gelesenZeile: 'BSV Mitteilungen Q-001 Q-002' }));
  const zeilen = register.zeilenAus(gelesen, DOSSIER, 'VL-001', 'validiert');
  assert.deepStrictEqual(zeilen[0].quellen, [
    { id: 'Q-001', stand: '2024' }, { id: 'Q-002', stand: '2025' }
  ]);
  assert.deepStrictEqual(zeilen[1].quellen, [
    { id: 'Q-001', stand: '2024' }, { id: 'Q-002', stand: '2025' }
  ]);
});

test('zeilenAus: eine Q-ID, die weder in der Zuordnung noch als Dossier-Quelle bekannt ist, traegt stand: null', () => {
  const gelesen = skriptLesen.lies(blockText({
    zuordnung: ['Kapitel 1 | VL-001-EK-001 | Q-099']
  }));
  const zeilen = register.zeilenAus(gelesen, DOSSIER, 'VL-001', 'validiert');
  assert.deepStrictEqual(zeilen[0].quellen, [{ id: 'Q-099', stand: null }]);
});

test('zeilenAus: rechtsstand kommt aus d.regulatorik.stand, fehlt er ist er null (nie erfunden)', () => {
  const gelesen = skriptLesen.lies(blockText());
  const mitStand = register.zeilenAus(gelesen, DOSSIER, 'VL-001', 'validiert');
  assert.strictEqual(mitStand[0].rechtsstand, '1.1.2026');
  const ohneStand = register.zeilenAus(gelesen, { regulatorik: {}, quellen: [] }, 'VL-001', 'validiert');
  assert.strictEqual(ohneStand[0].rechtsstand, null);
});

test('zeilenAus: herkunft/beleg kommen aus kapitel.validierung, null-sicher ohne ###VALIDIERUNG', () => {
  const gelesen = skriptLesen.lies(blockText({ kapitel1Validierung: false }));
  const zeilen = register.zeilenAus(gelesen, DOSSIER, 'VL-001', 'validiert');
  assert.strictEqual(zeilen[0].herkunft, null);
  assert.strictEqual(zeilen[0].beleg, null);
  assert.strictEqual(zeilen[1].herkunft, 'korrigiert');
  assert.strictEqual(zeilen[1].beleg, 'Contract S.4');
});

test('zeilenAus: kurs/ek/titel/status wörtlich übernommen, verbaut_in immer null', () => {
  const gelesen = skriptLesen.lies(blockText());
  const zeilen = register.zeilenAus(gelesen, DOSSIER, 'VL-001', 'final');
  assert.strictEqual(zeilen[0].kurs, 'VL-001');
  assert.strictEqual(zeilen[0].ek, 'VL-001-EK-001');
  assert.strictEqual(zeilen[0].titel, 'Kapitel eins');
  assert.strictEqual(zeilen[0].status, 'final');
  assert.strictEqual(zeilen[0].verbaut_in, null);
  assert.strictEqual(zeilen[1].titel, 'Kapitel zwei');
});

test('zeilenAus: kein Kapitel -> leere Liste, kein Crash', () => {
  const gelesen = { kapitel: [], zuordnung: [], quellen: { gelesen: [] } };
  assert.deepStrictEqual(register.zeilenAus(gelesen, DOSSIER, 'VL-001', 'validiert'), []);
});

/* ---------- einpflegen ---------- */

function zeile(kurs, ek, status) {
  return { kurs: kurs, ek: ek, titel: 't', quellen: [], rechtsstand: null,
    herkunft: null, beleg: null, status: status, verbaut_in: null };
}

test('einpflegen: Erstanlage aus null — schema 1, zeilen sortiert', () => {
  const b = register.einpflegen(null, [zeile('VL-001', 'VL-001-EK-002', 'validiert'),
    zeile('VL-001', 'VL-001-EK-001', 'validiert')]);
  assert.strictEqual(b.schema, 1);
  assert.deepStrictEqual(b.zeilen.map(function (z) { return z.ek; }),
    ['VL-001-EK-001', 'VL-001-EK-002']);
});

test('einpflegen: ersetzt eine bestehende Zeile desselben Kurses/derselben EK', () => {
  const bestand = { schema: 1, zeilen: [zeile('VL-001', 'VL-001-EK-001', 'validiert')] };
  const neu = register.einpflegen(bestand, [zeile('VL-001', 'VL-001-EK-001', 'final')]);
  assert.strictEqual(neu.zeilen.length, 1);
  assert.strictEqual(neu.zeilen[0].status, 'final');
});

test('einpflegen: ein FREMDER Kurs bleibt unberührt — dieselbe Zeile (Referenzgleichheit)', () => {
  const zeileFremd = zeile('AFL-001', 'AFL-001-EK-001', 'validiert');
  const bestand = { schema: 1, zeilen: [zeileFremd, zeile('VL-001', 'VL-001-EK-001', 'validiert')] };
  const neu = register.einpflegen(bestand, [zeile('VL-001', 'VL-001-EK-001', 'final')]);
  const gefunden = neu.zeilen.filter(function (z) { return z.kurs === 'AFL-001'; })[0];
  assert.strictEqual(gefunden, zeileFremd, 'die AFL-001-Zeile haette dieselbe Objektreferenz behalten muessen');
  assert.strictEqual(neu.zeilen.length, 2);
});

test('einpflegen: eine FREMDE EK desselben Kurses bleibt unberührt', () => {
  const zeileAndereEk = zeile('VL-001', 'VL-001-EK-002', 'validiert');
  const bestand = { schema: 1, zeilen: [zeile('VL-001', 'VL-001-EK-001', 'validiert'), zeileAndereEk] };
  const neu = register.einpflegen(bestand, [zeile('VL-001', 'VL-001-EK-001', 'final')]);
  const gefunden = neu.zeilen.filter(function (z) { return z.ek === 'VL-001-EK-002'; })[0];
  assert.strictEqual(gefunden, zeileAndereEk);
});

test('einpflegen: sortiert stabil nach (kurs, dann ek)', () => {
  const bestand = { schema: 1, zeilen: [
    zeile('B-001', 'B-001-EK-001', 'validiert'),
    zeile('A-001', 'A-001-EK-002', 'validiert')
  ] };
  const neu = register.einpflegen(bestand, [zeile('A-001', 'A-001-EK-001', 'validiert')]);
  assert.deepStrictEqual(neu.zeilen.map(function (z) { return z.kurs + '/' + z.ek; }), [
    'A-001/A-001-EK-001', 'A-001/A-001-EK-002', 'B-001/B-001-EK-001'
  ]);
});

test('einpflegen: bestand ohne gueltige zeilen-Liste wird wie eine Erstanlage behandelt', () => {
  const neu = register.einpflegen({}, [zeile('VL-001', 'VL-001-EK-001', 'validiert')]);
  assert.strictEqual(neu.zeilen.length, 1);
});

/* ---------- lesen ---------- */

test('lesen: fehlende/leere Datei ist eine Erstanlage, kein null', () => {
  assert.deepStrictEqual(register.lesen(null), { schema: 1, zeilen: [] });
  assert.deepStrictEqual(register.lesen(''), { schema: 1, zeilen: [] });
  assert.deepStrictEqual(register.lesen(undefined), { schema: 1, zeilen: [] });
});

test('lesen: ein gueltiger Bestand wird geparst', () => {
  const b = { schema: 1, zeilen: [zeile('VL-001', 'VL-001-EK-001', 'validiert')] };
  const gelesen = register.lesen(register.text(b));
  assert.deepStrictEqual(gelesen, b);
});

test('lesen: kaputtes JSON wird abgewiesen (null)', () => {
  assert.strictEqual(register.lesen('{kaputt'), null);
});

test('lesen: unbekannte Schema-Version wird abgewiesen (null)', () => {
  assert.strictEqual(register.lesen(JSON.stringify({ schema: 2, zeilen: [] })), null);
});

test('lesen: zeilen als Nicht-Liste wird abgewiesen (null)', () => {
  assert.strictEqual(register.lesen(JSON.stringify({ schema: 1, zeilen: {} })), null);
});
