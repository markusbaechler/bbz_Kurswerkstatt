const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1];
const d = (...n) => n.map(x => ({ name: x }));

/* Entscheid Markus, 2026-07-22: "final ist final... das muss sonst manuell
   zurueckgesetzt werden." Die App legt nichts mehr daneben. */

test('ohne _final ist nichts gesperrt', () => {
  assert.strictEqual(
    inhalt.finalVorhanden(d('AFL-001_briefing_v1.md', 'AFL-001_briefing_v2.md'),
                          'AFL-001', 'briefing'), null);
});

test('_final wird erkannt, unabhaengig von der Endung', () => {
  assert.strictEqual(
    inhalt.finalVorhanden(d('AFL-001_lernziele-drehbuch_final.xlsx'),
                          'AFL-001', 'lernziele-drehbuch'),
    'AFL-001_lernziele-drehbuch_final.xlsx');
});

test('ein fremdes Lieferobjekt sperrt nicht', () => {
  assert.strictEqual(
    inhalt.finalVorhanden(d('AFL-001_content_final.md'), 'AFL-001', 'briefing'), null);
});

test('ein fremder Kurs sperrt nicht', () => {
  assert.strictEqual(
    inhalt.finalVorhanden(d('DBS-001_briefing_final.md'), 'AFL-001', 'briefing'), null);
});

test('abgeschlossen() liest das Lieferobjekt aus dem Kontrakt', () => {
  assert.ok(inhalt.abgeschlossen(INHALT, 3, 'AFL-001',
    d('AFL-001_lernziele-drehbuch_final.xlsx')));
  assert.strictEqual(inhalt.abgeschlossen(INHALT, 3, 'AFL-001',
    d('AFL-001_lernziele-drehbuch_v1.xlsx')), null);
});

/* Der Schaden, den die Sperre verhindert. */
test('genau dieser stille Schaden waere sonst entstanden', () => {
  const nurFinal = d('AFL-001_lernziele-drehbuch_final.xlsx');
  /* naechsteVersion zaehlt _final bewusst nicht mit -> wieder v1 ... */
  assert.strictEqual(
    inhalt.naechsteDatei(INHALT, 3, 'AFL-001', nurFinal).datei,
    'AFL-001_lernziele-drehbuch_v1.xlsx');
  /* ... und die Aufloesungsregel wuerde diese v1 verdecken. */
  assert.strictEqual(
    inhalt.geltendeDatei(nurFinal.concat(d('AFL-001_lernziele-drehbuch_v1.xlsx')),
                         'AFL-001', 'lernziele-drehbuch'),
    'AFL-001_lernziele-drehbuch_final.xlsx');
  /* Deshalb sperrt die App vorher. */
  assert.ok(inhalt.abgeschlossen(INHALT, 3, 'AFL-001', nurFinal));
});

/* ---------- Ansicht: Weg Hochladen ---------- */

test('bei _final zeigt der Upload die Sperre statt eines Zielnamens', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null,
    { ordnerFehlt: false, dateien: d('AFL-001_lernziele-drehbuch_final.xlsx') });
  assert.ok(h.indexOf('final ist final') >= 0, 'keine Sperrmeldung');
  assert.ok(!/data-action="hochladen"/.test(h), 'Hochladen trotz Freigabe angeboten');
  assert.ok(h.indexOf('von Hand') >= 0, 'sagt nicht, wie man zuruecksetzt');
});

test('ohne _final bleibt der Upload offen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null,
    { ordnerFehlt: false, dateien: d('AFL-001_lernziele-drehbuch_v1.xlsx') });
  assert.ok(/data-action="hochladen"/.test(h), 'Upload fehlt');
  assert.ok(h.indexOf('final ist final') < 0, 'sperrt ohne Grund');
  assert.ok(h.indexOf('AFL-001_lernziele-drehbuch_v2.xlsx') >= 0, 'falsche naechste Nummer');
});

/* ---------- Ansicht: Weg Chat ---------- */

test('bei _final zeigt auch der Weg Chat die Sperre', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 4, null,
    { ordnerFehlt: false, dateien: d('AFL-001_greenfield_final.md') });
  assert.ok(h.indexOf('Final ist final') >= 0, 'keine Sperrmeldung im Weg Chat');
  assert.ok(!/id="ergebnis"/.test(h), 'Textfeld trotz Freigabe angeboten');
});

test('ohne _final bleibt der Weg Chat offen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 4, null, { ordnerFehlt: false, dateien: [] });
  assert.ok(/id="ergebnis"/.test(h), 'Ablegen-Feld fehlt');
  assert.ok(h.indexOf('Final ist final') < 0);
});
