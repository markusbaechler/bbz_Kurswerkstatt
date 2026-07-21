const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];   // Schritt 4, inArbeit
const AFL = KURSE[1];   // Schritt 1, offen

/* ---------- Kette ---------- */

test('die Kette zeigt alle 9 Schritte in 5 Phasen', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  assert.strictEqual((h.match(/data-action="schritt"/g) || []).length, 9);
  assert.strictEqual((h.match(/class="phl"/g) || []).length, 5);
});

test('die Kette faerbt nach dem echten Stand', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  assert.ok(/node fertig/.test(h), 'kein erledigter Schritt');
  assert.ok(/node inArbeit/.test(h), 'kein Schritt in Arbeit');
  assert.ok(/node offen/.test(h), 'kein offener Schritt');
});

test('die Kette markiert den aktiven Schritt', () => {
  assert.ok(/node inArbeit hier/.test(ansichten.kette(INHALT, DBS, 4)));
});

test('die Kette markiert die drei Gates', () => {
  assert.strictEqual((ansichten.kette(INHALT, DBS, null).match(/class="lock"/g) || []).length, 3);
});

/* ---------- Alle Kurse ---------- */

test('jeder Kurs bekommt eine Zeile mit neun Punkten', () => {
  const h = ansichten.alleKurse(KURSE);
  assert.strictEqual((h.match(/data-action="kurs"/g) || []).length, 2);
  assert.strictEqual((h.match(/class="pkt /g) || []).length, 18);
});

test('der Fortschritt wird ausgewiesen', () => {
  const h = ansichten.alleKurse(KURSE);
  assert.ok(/3&#8202;\/&#8202;9/.test(h), 'DBS-001 muesste 3/9 stehen');
  assert.ok(/0&#8202;\/&#8202;9/.test(h), 'AFL-001 muesste 0/9 stehen');
});

test('eine leere Liste erzeugt eine Meldung statt einer leeren Tabelle', () => {
  assert.ok(/Noch keine Kurse/.test(ansichten.alleKurse([])));
});

test('Kurstitel werden escaped', () => {
  const boes = [Object.assign({}, DBS, { kurstitel: '<script>a</script>' })];
  assert.ok(!/<script>a<\/script>/.test(ansichten.alleKurse(boes)));
});

/* ---------- Ein Kurs ---------- */

test('die Kursansicht nennt Kurs, Titel und Fortschritt', () => {
  const h = ansichten.einKurs(INHALT, DBS);
  assert.ok(/DBS-001/.test(h));
  assert.ok(/Derivate/.test(h));
  assert.ok(/3 von 9/.test(h));
});

test('die Kursansicht zeigt, was als Naechstes dran ist', () => {
  const h = ansichten.einKurs(INHALT, DBS);
  assert.ok(/Als N&auml;chstes dran/.test(h));
  assert.ok(/Schritt 4/.test(h));
  assert.ok(/Hier weiterarbeiten/.test(h));
});

test('ein unbekannter Kurs erzeugt eine Meldung statt einer Ausnahme', () => {
  assert.ok(/Nicht gefunden/.test(ansichten.einKurs(INHALT, null)));
});

/* ---------- Ein Schritt ---------- */

test('der Kopf nennt Nummer und Namen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/SCHRITT 4 \/ 9/.test(h));
  assert.ok(/Green-field W-Content/.test(h));
});

test('die Schrittansicht traegt die Kette mit', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.strictEqual((h.match(/class="phl"/g) || []).length, 5);
});

test('Woher und Wohin sind da und verlinkt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/Kommt herein/.test(h));
  assert.ok(/Geht weiter/.test(h));
  assert.ok(/aus Schritt 3/.test(h));
  assert.ok(/an Schritt 5/.test(h));
});

test('Schritt 1 hat keinen Vorgaenger und sagt das', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null);
  assert.ok(/von aussen/.test(h));
  assert.ok(!/aus Schritt 0/.test(h));
});

test('die Anleitung steht ausgeklappt da, nicht als Klappe', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/So gehst du vor/.test(h));
  assert.ok(/Prompt kopieren<\/span>/.test(h), 'erster Anleitungsschritt fehlt');
  assert.ok(/class="ddc do"/.test(h), 'Do fehlt');
  assert.ok(/class="ddc dont"/.test(h), 'Dont fehlt');
});

test('der Masterprompt liegt inline, mit Kopier-Knopf', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/data-action="werkzeug" data-werkzeug="prompt-greenfield"/.test(h));
  assert.ok(/data-action="kopieren"/.test(h));
});

test('die Anleitung erscheint NICHT nochmals als Klappe', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(!/data-werkzeug="guide-4"/.test(h), 'Anleitung doppelt gezeigt');
});

test('das aufgeklappte Werkzeug ist markiert', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, 'prompt-greenfield');
  assert.ok(/class="wtool auf"/.test(h));
});

test('die Ablage nach Kontrakt wird angezeigt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/04_greenfield\/DBS-001_greenfield_v\{N\}\.md/.test(h));
});

test('das Uebergabekriterium steht da', () => {
  assert.ok(/Fertig, wenn/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
});

test('ein Gate-Schritt zeigt sein Gate, ein gate-loser nicht', () => {
  assert.ok(/Gate 1/.test(ansichten.einSchritt(INHALT, DBS, 3, null)));
  assert.ok(!/gatetag/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
});

test('Weiter ist gesperrt, solange der Schritt nicht erledigt ist', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);   // Schritt 4 inArbeit
  assert.ok(/class="weiter" data-action="schritt" data-schritt="5" disabled/.test(h));
});

test('Weiter ist frei, wenn der Schritt erledigt ist', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);   // 3 < 4, also fertig
  assert.ok(/data-schritt="4">Weiter/.test(h));
  assert.ok(!/data-schritt="4" disabled/.test(h));
});

test('Schritt 9 bietet kein Weiter an', () => {
  assert.ok(!/Weiter zu Schritt 10/.test(ansichten.einSchritt(INHALT, DBS, 9, null)));
});

test('ohne Kurs gibt es keinen Erledigt-Haken', () => {
  assert.ok(!/data-action="erledigt"/.test(ansichten.einSchritt(INHALT, null, 4, null)));
});

test('die zulaessigen Wege werden angezeigt', () => {
  assert.ok(/Im Chat/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
  assert.ok(/Mit Claude Code/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
  const s7 = ansichten.einSchritt(INHALT, DBS, 7, null);
  assert.ok(/Mit Claude Code/.test(s7));
  assert.ok(!/Im Chat/.test(s7), 'Schritt 7 laeuft nur ueber Claude Code');
});

test('ein unbekannter Schritt erzeugt eine Meldung statt einer Ausnahme', () => {
  assert.ok(/Unbekannt/.test(ansichten.einSchritt(INHALT, DBS, 99, null)));
});

/* ---------- Nachschlagen ---------- */

test('Nachschlagen zeigt alle drei Werke als Reiter', () => {
  const h = ansichten.nachschlagen(INHALT, null);
  assert.ok(/data-werk="didaktik"/.test(h));
  assert.ok(/data-werk="promptcraft"/.test(h));
  assert.ok(/data-werk="governance"/.test(h));
});

test('Nachschlagen zeigt Bloom im didaktischen Modell', () => {
  const h = ansichten.nachschlagen(INHALT, 'didaktik');
  assert.ok(/Bloom-Kalibrierung/.test(h));
  assert.ok(/Bloom-Anker/.test(h));
});

test('Nachschlagen wechselt das Werk', () => {
  const h = ansichten.nachschlagen(INHALT, 'governance');
  assert.ok(/Datenklassen/.test(h));
  assert.ok(/Governance-Richtlinien/.test(h));
});

test('ein unbekanntes Werk faellt auf das erste zurueck', () => {
  assert.ok(/Didaktisches Modell/.test(ansichten.nachschlagen(INHALT, 'gibtsnicht')));
});
