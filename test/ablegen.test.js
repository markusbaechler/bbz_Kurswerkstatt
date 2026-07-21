const test = require('node:test');
const assert = require('node:assert');

const { graph } = require('../app.js');
const { inhalt } = require('../inhalt.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];   // Schritt 4, inArbeit

function datei(name) { return { name: name }; }

/* ---------- Nächste Versionsnummer ---------- */

test('ein leerer Ordner ergibt v1', () => {
  assert.strictEqual(inhalt.naechsteVersion([], 'DBS-001', 'greenfield', 'md'), 1);
});

test('ein nicht gelesener Ordner ergibt ebenfalls v1', () => {
  assert.strictEqual(inhalt.naechsteVersion(null, 'DBS-001', 'greenfield', 'md'), 1);
  assert.strictEqual(inhalt.naechsteVersion(undefined, 'DBS-001', 'greenfield', 'md'), 1);
});

test('die hoechste vorhandene Nummer plus eins', () => {
  const d = [datei('DBS-001_greenfield_v1.md'), datei('DBS-001_greenfield_v2.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield', 'md'), 3);
});

test('Luecken werden nicht gefuellt — es zaehlt das Maximum', () => {
  const d = [datei('DBS-001_greenfield_v1.md'), datei('DBS-001_greenfield_v7.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield', 'md'), 8);
});

test('eine _final zaehlt nicht als Nummer, blockiert aber auch nicht', () => {
  const d = [datei('DBS-001_content_v1.md'), datei('DBS-001_content_final.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'content', 'md'), 2);
});

test('fremde Kurse und fremde Lieferobjekte zaehlen nicht mit', () => {
  const d = [datei('AFL-001_greenfield_v9.md'), datei('DBS-001_content_v5.md'),
             datei('DBS-001_greenfield_v2.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield', 'md'), 3);
});

test('eine andere Endung zaehlt nicht mit', () => {
  const d = [datei('DBS-001_greenfield_v4.html')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield', 'md'), 1);
});

test('Beistehendes wie _gate.md oder _verlauf stoert nicht', () => {
  const d = [datei('_gate.md'), datei('_hinweis.md'), datei('DBS-001_greenfield_v1.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield', 'md'), 2);
});

/* ---------- Der konkrete Dateiname ---------- */

test('naechsteDatei baut Ordner und Namen aus dem Kontrakt', () => {
  const d = [datei('DBS-001_greenfield_v1.md')];
  const z = inhalt.naechsteDatei(INHALT, 4, 'DBS-001', d);
  assert.strictEqual(z.ordner, '04_greenfield');
  assert.strictEqual(z.datei, 'DBS-001_greenfield_v2.md');
  assert.strictEqual(z.version, 2);
});

test('naechsteDatei fuer Schritt 5 und 6 zielt auf dieselbe Datei', () => {
  const z5 = inhalt.naechsteDatei(INHALT, 5, 'DBS-001', []);
  const z6 = inhalt.naechsteDatei(INHALT, 6, 'DBS-001', []);
  assert.strictEqual(z5.datei, z6.datei);
  assert.strictEqual(z5.ordner, '05_content');
});

test('naechsteDatei verweigert Schritte mit festem Dateinamen', () => {
  assert.strictEqual(inhalt.naechsteDatei(INHALT, 2, 'DBS-001', []), null);
  assert.strictEqual(inhalt.naechsteDatei(INHALT, 7, 'DBS-001', []), null);
});

/* ---------- Darf hier ueberhaupt abgelegt werden? ---------- */

test('Ablegen ist erlaubt, wo der Weg Chat vorgesehen ist', () => {
  assert.strictEqual(inhalt.darfAblegen(INHALT, 4), true);
  assert.strictEqual(inhalt.darfAblegen(INHALT, 6), true);
});

test('Ablegen ist gesperrt, wo nur Claude Code oder Handarbeit vorgesehen ist', () => {
  assert.strictEqual(inhalt.darfAblegen(INHALT, 3), false, 'Schritt 3 ist Excel');
  assert.strictEqual(inhalt.darfAblegen(INHALT, 7), false, 'Schritt 7 nur Claude Code');
});

test('Ablegen ist gesperrt, wo die Kurswerkstatt selbst schreibt', () => {
  assert.strictEqual(inhalt.darfAblegen(INHALT, 2), false);
  assert.strictEqual(inhalt.darfAblegen(INHALT, 8), false);
});

/* ---------- Was das Ablegen am Stand aendert ---------- */

test('Ablegen auf einem spaeteren Schritt zieht den Kurs nach vorn', () => {
  const k = { schritt: 4, status: 'inArbeit' };
  assert.deepStrictEqual(graph.standNachAblage(k, 6), { Schritt: 6, Status: 'inArbeit' });
});

test('Ablegen auf dem aktuellen Schritt setzt ihn auf inArbeit', () => {
  const k = { schritt: 4, status: 'offen' };
  assert.deepStrictEqual(graph.standNachAblage(k, 4), { Schritt: 4, Status: 'inArbeit' });
});

test('Ablegen auf einem frueheren Schritt aendert den Stand NICHT', () => {
  const k = { schritt: 8, status: 'inArbeit' };
  assert.strictEqual(graph.standNachAblage(k, 4), null, 'Nacharbeit darf den Fortschritt nicht zuruecksetzen');
});

test('ein bereits fertiger aktueller Schritt wird durch Ablegen wieder inArbeit', () => {
  const k = { schritt: 9, status: 'fertig' };
  assert.deepStrictEqual(graph.standNachAblage(k, 9), { Schritt: 9, Status: 'inArbeit' });
});

/* ---------- Die Ablege-Fläche in der Ansicht ---------- */

const { ansichten } = require('../ansichten.js');

test('Schritt 4 bietet die Ablege-Flaeche an', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, { dateien: [] });
  assert.ok(/id="ergebnis"/.test(h), 'kein Eingabefeld');
  assert.ok(/data-action="ablegen"/.test(h), 'kein Ablegen-Knopf');
});

test('die Ablege-Flaeche nennt den Zieldateinamen vorab', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null,
    { dateien: [{ name: 'DBS-001_greenfield_v1.md' }] });
  assert.ok(/04_greenfield\/DBS-001_greenfield_v2\.md/.test(h), 'Zielname fehlt oder falsch');
});

test('Schritt 3 bietet keine Ablege-Flaeche — Excel', () => {
  assert.ok(!/data-action="ablegen"/.test(ansichten.einSchritt(INHALT, DBS, 3, null, { dateien: [] })));
});

test('Schritt 7 bietet keine Ablege-Flaeche — nur Claude Code', () => {
  assert.ok(!/data-action="ablegen"/.test(ansichten.einSchritt(INHALT, DBS, 7, null, { dateien: [] })));
});

test('ohne Kurs gibt es keine Ablege-Flaeche', () => {
  assert.ok(!/data-action="ablegen"/.test(ansichten.einSchritt(INHALT, null, 4, null, {})));
});

test('solange der Ordner nicht gelesen ist, steht kein Zielname da', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, {});
  assert.ok(/Ordner wird gelesen/.test(h));
});
