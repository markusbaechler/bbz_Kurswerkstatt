const test = require('node:test');
const assert = require('node:assert');

/* didaktik-schema.js vorab requiren, damit root.didaktikSchema steht, BEVOR
   didaktik-lesen.js geladen wird — dieselbe Reihenfolge wie in index.html
   (Muster xlsx-lesen.js/skript-lesen.js, Etappe 3/3b). */
require('../didaktik-schema.js');
const { didaktikLesen } = require('../didaktik-lesen.js');

/* Nur die Kernfaelle — mechanische UMD-Portierung von
   IT_Architektur_bbz/output/tools/didaktik-lesen.cjs (Task D1). Die volle
   Abdeckung (alle Fehler-Wortlaute, CLI-Modus) leistet die Tools-Suite
   selbst plus der Parity-Waechter (test/app-parity.test.js im Tools-Baum),
   der Verhalten UND Schema beider Fassungen woertlich vergleicht. */

const KOPF = '###CONTRACTS kurs=VL-002 | basiert_auf=VL-002_content_final.blocks';

const REGLER_VOLL = [
  '###CONTRACT ek=VL-002-EK-005 | nr=1 | typ=regler',
  'kernaussage: Die Praemie sinkt, wenn der Selbstbehalt steigt.',
  'zielhandlung: Regler bewegen und den Effekt beobachten.',
  'denkfehler: Ein hoeherer Selbstbehalt senkt die Praemie automatisch um denselben Betrag.',
  'stuetztext: Der Zusammenhang ist nicht linear, sondern haengt vom',
  'gewaehlten Modell ab.',
  'steuert: den Selbstbehalt in Franken',
  'beobachtet: die monatliche Praemie',
  'aha: bei kleinen Selbstbehalten aendert sich wenig',
  'vorhersage: Wie stark sinkt die Praemie?',
  'konsequenz: Ein zu hoher Selbstbehalt kann das Budget sprengen.',
  '###ENDE-CONTRACT',
].join('\n');

const FLIESSTEXT_VOLL = [
  '###CONTRACT ek=VL-002-EK-005 | nr=2 | typ=fliesstext',
  'kernaussage: Die Praemie ist Teil der laufenden Kosten.',
  'zielhandlung: Den Betrag im Budget einplanen.',
  'denkfehler: Die Praemie zahlt man nur einmal im Jahr.',
  'stuetztext: Sie wird monatlich fällig, auch wenn die Rechnung jaehrlich kommt.',
  'begruendung: Ein Rechenbeispiel reicht hier ohne interaktives Modell.',
  '###ENDE-CONTRACT',
].join('\n');

const PUNKTE_VOLL = [
  '###PUNKTE',
  'punkt: Soll der Rechner Franken oder Prozent zeigen?',
  'entscheid: Franken, wie im Contract.',
  'punkt: Fehlt eine Begruendung fuer die Verschiebung?',
  'verschieben: schritt-6',
  'begruendung: Gehoert zur Review-Ansicht, nicht zur Contract-Erstellung.',
].join('\n');

const SAUBER = [KOPF, REGLER_VOLL, FLIESSTEXT_VOLL, PUNKTE_VOLL].join('\n');

test('ein sauberer Durchlauf liefert Kopf, 2 Contracts (einer mehrzeilig) und PUNKTE mit entscheid UND verschieben', () => {
  const r = didaktikLesen.lies(SAUBER);
  assert.deepStrictEqual(r.fehler, []);
  assert.deepStrictEqual(r.kopf, { kurs: 'VL-002', basiertAuf: 'VL-002_content_final.blocks' });
  assert.strictEqual(r.contracts.length, 2);
  assert.strictEqual(r.contracts[0].felder.stuetztext,
    'Der Zusammenhang ist nicht linear, sondern haengt vom gewaehlten Modell ab.');
  assert.strictEqual(r.punkte.length, 2);
  assert.strictEqual(r.punkte[0].entscheid, 'Franken, wie im Contract.');
  assert.strictEqual(r.punkte[1].verschieben, 'schritt-6');
  assert.strictEqual(r.punkte[1].begruendung, 'Gehoert zur Review-Ansicht, nicht zur Contract-Erstellung.');
});

test('ein Text ganz ohne ###CONTRACTS wirft', () => {
  assert.throws(() => didaktikLesen.lies('###CONTRACT ek=VL-002-EK-005 | nr=1 | typ=regler\n###ENDE-CONTRACT'),
    /###CONTRACTS fehlt/);
});

test('fliesstext ohne begruendung ist ein Fehler', () => {
  const kaputt = FLIESSTEXT_VOLL.replace('begruendung: Ein Rechenbeispiel reicht hier ohne interaktives Modell.\n', '');
  const r = didaktikLesen.lies([KOPF, kaputt].join('\n'));
  assert.ok(r.fehler.some((f) => f === 'Contract 2 (VL-002-EK-005): typ fliesstext verlangt begruendung'),
    r.fehler.join(' | '));
});

test('regler ohne steuert ist ein Fehler, fliesstext ohne steuert ist KEIN Fehler', () => {
  const reglerOhneSteuert = REGLER_VOLL.replace('steuert: den Selbstbehalt in Franken\n', '');
  const r1 = didaktikLesen.lies([KOPF, reglerOhneSteuert].join('\n'));
  assert.ok(r1.fehler.some((f) => f === 'Contract 1 (VL-002-EK-005): Feld steuert fehlt'), r1.fehler.join(' | '));

  const r2 = didaktikLesen.lies([KOPF, FLIESSTEXT_VOLL].join('\n'));
  assert.ok(!r2.fehler.some((f) => /steuert/.test(f)), r2.fehler.join(' | '));
});

test('ek+nr-Duplikat wird gemeldet', () => {
  const r = didaktikLesen.lies([KOPF, REGLER_VOLL, REGLER_VOLL].join('\n'));
  assert.ok(r.fehler.some((f) => f === 'Contract: ek+nr doppelt: VL-002-EK-005/1'), r.fehler.join(' | '));
});
