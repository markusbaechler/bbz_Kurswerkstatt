'use strict';
/* inhalt.skriptPromptKopf(kurs, d, extras) — der GESETZTE Angabenblock fuer
   Schritt 3 (Content-Skript), A3 Etappe 3. Gleiches Prinzip wie
   briefingPromptKopf/lernzielePromptKopf: was hier steht, muss der Chat nicht
   erfragen. E5 (Entscheid Markus 2026-07-31): der Chat liefert die .docx
   direkt — dieser Kopf ist der GESETZTE Teil, den skriptPruefe (A2) beim
   Pruefen voraussetzt (Kurs-ID, Rechtsstand, Quellen-Q-IDs). Muster:
   test/lernzielekopf.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { inhalt } = require('../inhalt.js');
const { dossier } = require('../dossier.js');

test('der Skript-Kopf traegt Kurs, Titel, Kompetenzfeld, Rechtsstand und die GENAU-Quellenliste', () => {
  const d = dossier.neu('VL-002');
  d.regulatorik = { stand: '1.1.2026', saq_rezert: false };
  d.quellen = [{ id: 'Q-001', titel: 'Kursausschreibung', stand: '2026', url: 'https://x.ch', abgerufen: '2026-07-30' }];
  const kopf = inhalt.skriptPromptKopf({ kursId: 'VL-002', kurstitel: 'Vorsorge Aufbau', kompetenzfeld: 'Vorsorge' }, d);
  for (const s of ['VL-002', 'Vorsorge Aufbau', 'Vorsorge', 'Rechtsstand: 1.1.2026',
                   'FACHQUELLEN', 'GENAU diese Liste', 'Q-001 · Kursausschreibung · Stand: 2026']) {
    assert.ok(kopf.includes(s), s + ' fehlt');
  }
});

test('mit vollem extras traegt der Kopf Variante, Version, basiert_auf, Zielname, Modus-Satz, ' +
     'FACHQUELLEN, PROJEKT-WISSEN und die indikative Selbstlernphase', () => {
  const d = dossier.neu('VL-002');
  d.regulatorik = { stand: '1.1.2026' };
  d.scope = { selbstlern: '4' };
  d.quellen = [
    { id: 'Q-001', titel: 'Kursausschreibung', stand: '2026', datei: 'a.pdf' },
    { id: 'Q-002', titel: 'Deep Dive', stand: '2026', datei: 'b.pdf' },
    { id: 'Q-003', titel: 'Verordnung', stand: '2026', url: 'https://x.ch', abgerufen: '2026-07-30' }
  ];
  const kopf = inhalt.skriptPromptKopf(
    { kursId: 'VL-002', kurstitel: 'Vorsorge Aufbau', kompetenzfeld: 'Vorsorge' },
    d,
    {
      variante: 'claude',
      version: 2,
      basiertAuf: 'VL-002_lernziele-drehbuch_final.xlsx',
      zielname: 'VL-002_skript-claude_v2.blocks'
    }
  );
  assert.ok(kopf.includes('Variante: claude'), 'Variante fehlt');
  assert.ok(kopf.includes('Version des Lieferobjekts: 2'), 'Version fehlt');
  assert.match(kopf, /YAML-Feld 'version'/);
  assert.ok(kopf.includes('basiert_auf: VL-002_lernziele-drehbuch_final.xlsx'), 'basiert_auf fehlt');
  assert.match(kopf, /YAML-Feld 'basiert_auf'/);
  assert.ok(kopf.includes(
    'Liefere in Phase 2 DIREKT die Blockdatei VL-002_skript-claude_v2.blocks zum Herunterladen.'),
    'Schluss-Satz fehlt');
  assert.match(kopf, /###ILLUSTRATION/, 'Illustrations-Regie-Satz fehlt');
  assert.match(kopf, /szene:/, 'Hinweis auf die szene:-Regie fehlt');
  assert.match(kopf, /datei:/, 'Hinweis auf das mitgelieferte PNG (datei:) fehlt');
  assert.match(kopf, /FACHQUELLEN \(verbindlich/, 'Modus-Satz (quellengestuetzt) fehlt');
  const zeile = kopf.split('\n').filter((z) => z.indexOf('PROJEKT-WISSEN:') === 0)[0];
  assert.ok(zeile, 'PROJEKT-WISSEN-Zeile fehlt');
  assert.ok(zeile.includes('a.pdf'), 'a.pdf fehlt in der Projekt-Wissen-Liste');
  assert.ok(zeile.includes('b.pdf'), 'b.pdf fehlt in der Projekt-Wissen-Liste');
  assert.ok(!zeile.includes('Verordnung'), 'Link-Quelle darf nicht in der Projekt-Wissen-Liste stehen');
  assert.match(kopf, /Selbstlernphase.*: 4 \(indikativ — die Lernziele führen\)\./,
    'Selbstlernphase mit indikativ-Zusatz fehlt');
});

test('ohne extras fehlen Variante, Version, basiert_auf und der Schluss-Satz — kein Raten, der Rest steht', () => {
  const d = dossier.neu('VL-002');
  d.regulatorik = { stand: '1.1.2026' };
  const kopfOhneExtras = inhalt.skriptPromptKopf(
    { kursId: 'VL-002', kurstitel: 'Vorsorge Aufbau', kompetenzfeld: 'Vorsorge' }, d
  );
  assert.ok(!kopfOhneExtras.includes('Variante:'), 'Variante wurde geraten');
  assert.ok(!kopfOhneExtras.includes('Version des Lieferobjekts'), 'Version wurde geraten');
  assert.ok(!kopfOhneExtras.includes('basiert_auf:'), 'basiert_auf wurde geraten');
  assert.ok(!kopfOhneExtras.includes('Liefere in Phase 2'), 'Schluss-Satz wurde geraten');
  assert.ok(kopfOhneExtras.includes('Rechtsstand: 1.1.2026'), 'der Rest (Rechtsstand) fehlt');
  assert.ok(kopfOhneExtras.includes('VL-002'), 'der Rest (Kurs-ID) fehlt');
  /* Die Illustrations-Regie (B6) haengt NICHT an extras.zielname — sie gilt
     strukturell, sobald ein Dossier vorliegt, unabhaengig vom Dateinamen. */
  assert.match(kopfOhneExtras, /###ILLUSTRATION/, 'Illustrations-Regie-Satz fehlt ohne extras');

  const kopfLeereExtras = inhalt.skriptPromptKopf(
    { kursId: 'VL-002', kurstitel: 'Vorsorge Aufbau', kompetenzfeld: 'Vorsorge' }, d, {}
  );
  assert.ok(!kopfLeereExtras.includes('Variante:'), 'Variante wurde geraten (leere extras)');
  assert.ok(!kopfLeereExtras.includes('Version des Lieferobjekts'), 'Version wurde geraten (leere extras)');
  assert.ok(!kopfLeereExtras.includes('basiert_auf:'), 'basiert_auf wurde geraten (leere extras)');
});

test('quellenfrei heisst quellenfrei, nie eine leere Liste', () => {
  const d = dossier.neu('VL-002'); d.content_modus = 'quellenfrei';
  d.regulatorik = { stand: '1.1.2026' };
  const kopf = inhalt.skriptPromptKopf(null, d);
  /* Derselbe Satz wie in briefingPromptKopf/lernzielePromptKopf ("MODUS
     QUELLENFREI: ...", Grossbuchstaben) — case-insensitiv geprueft, wie
     dort. */
  assert.match(kopf, /quellenfrei/i);
  assert.ok(!/GENAU diese Liste/.test(kopf));
});

test('ohne Dossier gibt es keinen Kopf', () => {
  assert.equal(inhalt.skriptPromptKopf({ kursId: 'X' }, null), '');
});

/* F1 (Fixwave-Review): skriptPruefe (A2) verlangt Kurs-ID und Rechtsstand
   wörtlich im Dokument — aber ohne diese Zeile fordert kein Prompt-Baustein
   das ein. Der Chat weiss nicht, dass beides sichtbar im Titelbereich stehen
   muss, bis das Hochladen-Gate es abweist. */
test('F1: der Kopf verlangt Kurs-ID und Rechtsstand sichtbar im Titelbereich (mit d), fehlt ohne d', () => {
  const d = dossier.neu('VL-002');
  d.regulatorik = { stand: '1.1.2026' };
  const kopf = inhalt.skriptPromptKopf({ kursId: 'VL-002', kurstitel: 'Vorsorge Aufbau', kompetenzfeld: 'Vorsorge' }, d);
  assert.match(kopf, /Nenne die Kurs-ID und den Rechtsstand GENAU in dieser Schreibweise sichtbar im Dokument \(Titelbereich\)/);
  assert.match(kopf, /die Kurswerkstatt prüft beides beim Hochladen/);

  const kopfOhneD = inhalt.skriptPromptKopf({ kursId: 'VL-002' }, null);
  assert.equal(kopfOhneD, '');
  assert.ok(!/Kurs-ID und den Rechtsstand GENAU/.test(kopfOhneD));
});

test('ohne gesetzte Selbstlernphase bleibt die Zeile weg', () => {
  const d = dossier.neu('VL-002');
  d.regulatorik = { stand: '1.1.2026' };
  const kopf = inhalt.skriptPromptKopf({ kursId: 'VL-002' }, d);
  assert.ok(!/Selbstlernphase/.test(kopf));
});
