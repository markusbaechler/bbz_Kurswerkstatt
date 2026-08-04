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
  assert.ok(inhalt.abgeschlossen(INHALT, 2, 'AFL-001',
    d('AFL-001_lernziele-drehbuch_final.xlsx')));
  assert.strictEqual(inhalt.abgeschlossen(INHALT, 2, 'AFL-001',
    d('AFL-001_lernziele-drehbuch_v1.xlsx')), null);
});

/* Der Schaden, den die Sperre verhindert. */
test('genau dieser stille Schaden waere sonst entstanden', () => {
  const nurFinal = d('AFL-001_lernziele-drehbuch_final.xlsx');
  /* naechsteVersion zaehlt _final bewusst nicht mit -> wieder v1 ... */
  assert.strictEqual(
    inhalt.naechsteDatei(INHALT, 2, 'AFL-001', nurFinal).datei,
    'AFL-001_lernziele-drehbuch_v1.xlsx');
  /* ... und die Aufloesungsregel wuerde diese v1 verdecken. */
  assert.strictEqual(
    inhalt.geltendeDatei(nurFinal.concat(d('AFL-001_lernziele-drehbuch_v1.xlsx')),
                         'AFL-001', 'lernziele-drehbuch'),
    'AFL-001_lernziele-drehbuch_final.xlsx');
  /* Deshalb sperrt die App vorher. */
  assert.ok(inhalt.abgeschlossen(INHALT, 2, 'AFL-001', nurFinal));
});

/* ---------- versionenVon (Z9): Grundlage der Versions-Auswahl in der Gate-Box ----------
   Anders als geltendeDatei() (entscheidet die hoechste Nummer sei "die geltende")
   liefert versionenVon() ALLE vorhandenen v-Fassungen, absteigend sortiert — der
   Mensch waehlt in der Gate-Box explizit eine davon aus, statt dass die Maschine
   das fuer ihn tut. */

test('versionenVon listet alle v-Fassungen absteigend, _final zaehlt nicht mit', () => {
  const dateien = d('AFL-001_lernziele-drehbuch_v1.xlsx', 'AFL-001_lernziele-drehbuch_v3.xlsx',
                     'AFL-001_lernziele-drehbuch_v2.xlsx', 'AFL-001_lernziele-drehbuch_final.xlsx');
  assert.deepStrictEqual(inhalt.versionenVon(dateien, 'AFL-001', 'lernziele-drehbuch'), [
    { name: 'AFL-001_lernziele-drehbuch_v3.xlsx', version: 3 },
    { name: 'AFL-001_lernziele-drehbuch_v2.xlsx', version: 2 },
    { name: 'AFL-001_lernziele-drehbuch_v1.xlsx', version: 1 }
  ]);
});

test('versionenVon ignoriert fremde Kurse/Lieferobjekte und liefert [] ohne Array', () => {
  assert.deepStrictEqual(
    inhalt.versionenVon(d('DBS-001_lernziele-drehbuch_v1.xlsx', 'AFL-001_content_v1.xlsx'),
                        'AFL-001', 'lernziele-drehbuch'), []);
  assert.deepStrictEqual(inhalt.versionenVon(null, 'AFL-001', 'lernziele-drehbuch'), []);
  assert.deepStrictEqual(inhalt.versionenVon(undefined, 'AFL-001', 'lernziele-drehbuch'), []);
});

/* V6 Fix-Runde 1 (CRITICAL-Fix): ohne endung-Filter matcht die Regex JEDE Endung —
   bei einem Lieferobjekt mit mehreren Dateien je Versionsstamm (Schritt 4: docx UND
   blocks, B5/V4) lieferte versionenVon() dieselbe Version bisher ZWEIMAL, einmal je
   Endung. Der optionale vierte Parameter grenzt auf die erwartete Kontrakt-Endung
   ein — genau die Grundlage, auf der ansichten.gateFreigabe die Radio-Liste seither
   aufbaut. */
test('V6 Fix-Runde 1: versionenVon mit endung-Filter zeigt nur die Fassungen dieser Endung, nicht die Geschwisterdatei gleichen Stamms', () => {
  const dateien = d(
    'DBS-001_content_v3.docx', 'DBS-001_content_v3.blocks',
    'DBS-001_content_v2.docx', 'DBS-001_content_v2.blocks'
  );
  assert.deepStrictEqual(inhalt.versionenVon(dateien, 'DBS-001', 'content', 'docx'), [
    { name: 'DBS-001_content_v3.docx', version: 3 },
    { name: 'DBS-001_content_v2.docx', version: 2 }
  ]);
  assert.deepStrictEqual(inhalt.versionenVon(dateien, 'DBS-001', 'content', 'blocks'), [
    { name: 'DBS-001_content_v3.blocks', version: 3 },
    { name: 'DBS-001_content_v2.blocks', version: 2 }
  ]);
});

test('V6 Fix-Runde 1: versionenVon OHNE endung-Parameter bleibt rueckwaertskompatibel (bestehendes Verhalten unveraendert)', () => {
  const dateien = d('AFL-001_lernziele-drehbuch_v1.xlsx', 'AFL-001_lernziele-drehbuch_v2.xlsx');
  assert.deepStrictEqual(inhalt.versionenVon(dateien, 'AFL-001', 'lernziele-drehbuch'), [
    { name: 'AFL-001_lernziele-drehbuch_v2.xlsx', version: 2 },
    { name: 'AFL-001_lernziele-drehbuch_v1.xlsx', version: 1 }
  ]);
});

/* ---------- Ansicht: Weg Hochladen ---------- */

test('bei _final zeigt der Upload die Sperre statt eines Zielnamens', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null,
    { ordnerFehlt: false, dateien: d('AFL-001_lernziele-drehbuch_final.xlsx') });
  assert.ok(h.indexOf('final ist final') >= 0, 'keine Sperrmeldung');
  assert.ok(!/data-action="hochladen"/.test(h), 'Hochladen trotz Freigabe angeboten');
  assert.ok(h.indexOf('von Hand') >= 0, 'sagt nicht, wie man zuruecksetzt');
});

test('ohne _final bleibt der Upload offen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null,
    { ordnerFehlt: false, dateien: d('AFL-001_lernziele-drehbuch_v1.xlsx') });
  assert.ok(/data-action="hochladen"/.test(h), 'Upload fehlt');
  assert.ok(h.indexOf('final ist final') < 0, 'sperrt ohne Grund');
  assert.ok(h.indexOf('AFL-001_lernziele-drehbuch_v2.xlsx') >= 0, 'falsche naechste Nummer');
});

/* ---------- Ansicht: Weg Hochladen fuer Schritt 3 (A2) ----------
   Bis A2 war Schritt 3 ein Text-Lieferobjekt mit einem eigenen Chat-Ablege-
   Block (id="ergebnis"), der hier die Final-Sperre zeigte. Seit A2 ist Schritt
   3 ein docx-Lieferobjekt wie Schritt 2 die xlsx — der Chat-Text-Block ist
   verschwunden (s. test/ablegen.test.js), "final ist final" gilt jetzt im
   Hochladen-Block, weiterhin je Variante getrennt gesperrt. */

test('bei _final zeigt der Hochladen-Block fuer Schritt 3 die Sperre', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null,
    { ordnerFehlt: false, dateien: d('AFL-001_skript-claude_final.docx'), variante: 'claude' });
  assert.ok(h.indexOf('final ist final') >= 0, 'keine Sperrmeldung im Hochladen-Block');
  assert.ok(!/id="datei"/.test(h), 'Datei-Input trotz Freigabe angeboten');
});

test('ohne _final bleibt der Hochladen-Block fuer Schritt 3 offen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null,
    { ordnerFehlt: false, dateien: [], variante: 'claude' });
  assert.ok(/id="datei"/.test(h), 'Datei-Input fehlt');
  assert.ok(h.indexOf('final ist final') < 0, 'sperrt ohne Grund');
});

test('die Sperre bei Schritt 3 gilt je Variante, nicht ueber beide hinweg', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 3, null,
    { ordnerFehlt: false, dateien: d('AFL-001_skript-claude_final.docx'), variante: 'chatgpt' });
  assert.ok(/id="datei"/.test(h), 'die andere Variante wurde mitgesperrt');
});
