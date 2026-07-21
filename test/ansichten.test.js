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
  assert.strictEqual((h.match(/class="abname"/g) || []).length, 5);
});

test('die Kette faerbt nach dem echten Stand', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  assert.ok(/stn fertig/.test(h), 'kein erledigter Schritt');
  assert.ok(/stn inArbeit/.test(h), 'kein Schritt in Arbeit');
  assert.ok(/stn offen/.test(h), 'kein offener Schritt');
});

test('die Kette markiert den aktiven Schritt', () => {
  var hh = ansichten.kette(INHALT, DBS, 4);
  assert.ok(/stn inArbeit hier/.test(hh), 'aktive Station nicht markiert');
  assert.ok(/class="zeiger"/.test(hh), 'Zeiger auf die aktive Station fehlt');
});

test('die Kette markiert die drei Gates', () => {
  assert.strictEqual((ansichten.kette(INHALT, DBS, null).match(/class="pruef"/g) || []).length, 3);
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
  assert.ok(/Station 4 von 9/.test(h));
  assert.ok(/Green-field W-Content/.test(h));
});

test('die Schrittansicht traegt die Kette mit', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.strictEqual((h.match(/class="abname"/g) || []).length, 5);
});

test('Woher und Wohin sind da und verlinkt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/Kommt herein/.test(h));
  assert.ok(/Geht weiter/.test(h));
  assert.ok(/Station 3 ansehen/.test(h));
  assert.ok(/Station 5 ansehen/.test(h));
});

test('Schritt 1 hat keinen Vorgaenger und sagt das', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null);
  assert.ok(/ausserhalb der Linie/.test(h));
  assert.ok(!/Station 0/.test(h));
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
  assert.ok(/04_greenfield\/<b>DBS-001_greenfield_v\{N\}\.md<\/b>/.test(h));
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

/* ---------- Standort und Ordner-Verknuepfung ---------- */

test('die Kette sagt im Klartext, wo man ist', () => {
  const h = ansichten.kette(INHALT, DBS, 4);
  assert.ok(/class="zeiger"/.test(h), 'Zeiger fehlt');
  assert.ok(/abschnitt an/.test(h), 'aktive Phase nicht markiert');
  assert.ok(/Inhalt entwerfen/.test(h), 'Phase fehlt');
});

test('ohne aktiven Schritt gibt es keine Standort-Marke', () => {
  assert.ok(!/class="zeiger"/.test(ansichten.kette(INHALT, DBS, null)));
});

test('die Phase des aktiven Schritts wird hervorgehoben', () => {
  const h = ansichten.kette(INHALT, DBS, 4);
  assert.ok(/class="linie fokus"/.test(h));
  assert.strictEqual((h.match(/abschnitt an"/g) || []).length, 1, 'genau eine Phase aktiv');
});

test('die Dateiliste zeigt Ladezustand, Leere und Inhalt unterschiedlich', () => {
  assert.ok(/wird geladen/.test(ansichten.dateiliste(undefined, null, '04_greenfield')));
  assert.ok(/nicht gefunden/.test(ansichten.dateiliste(null, null, '04_greenfield')));
  assert.ok(/Noch leer/.test(ansichten.dateiliste([], null, '04_greenfield')));
});

test('die Dateiliste verlinkt jede Datei nach SharePoint', () => {
  const h = ansichten.dateiliste(
    [{ name: 'DBS-001_greenfield_v1.md', webUrl: 'https://x/y.md', size: 2048,
       lastModifiedDateTime: '2026-07-21T10:00:00Z' }],
    'https://x/04_greenfield', '04_greenfield');
  assert.ok(/href="https:\/\/x\/y\.md"/.test(h));
  assert.ok(/DBS-001_greenfield_v1\.md/.test(h));
  assert.ok(/2 KB/.test(h));
  assert.ok(/21\.07\.2026/.test(h));
  assert.ok(/href="https:\/\/x\/04_greenfield"/.test(h), 'Ordner-Link fehlt');
});

test('der Zielordner ist aus der Schrittansicht heraus zu oeffnen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null,
    { basisUrl: 'https://sp/Kursproduktion/DBS-001_x', dateien: [] });
  assert.ok(/href="https:\/\/sp\/Kursproduktion\/DBS-001_x\/04_greenfield"/.test(h));
});

test('der Vorgaenger-Ordner ist aus Kommt-herein heraus zu oeffnen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null,
    { basisUrl: 'https://sp/Kursproduktion/DBS-001_x', dateien: [] });
  assert.ok(/href="https:\/\/sp\/Kursproduktion\/DBS-001_x\/03_contract"/.test(h),
    'Link auf den Contract-Ordner aus Schritt 3 fehlt');
});

test('ohne Basis-URL bleiben die Pfade lesbar, aber ohne Link', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, {});
  assert.ok(/04_greenfield\/<b>DBS-001_greenfield_v\{N\}\.md<\/b>/.test(h));
  assert.ok(!/href="undefined/.test(h));
});
