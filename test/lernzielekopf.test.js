'use strict';
/* inhalt.lernzielePromptKopf(kurs, d) — der Angabenblock fuer Schritt 2
   (Lernziele-Drehbuch), Etappe 2 Task 3. Gleiches Prinzip wie briefingPromptKopf
   (inhalt.js, Schritt 1): was hier steht, muss der Chat nicht mehr erfragen.
   Titel/Kompetenzfeld kommen aus KWKurse (kurs), Rechtsstand/Zusatz/SAQ und die
   Fachquellenliste stammen GENAU aus dem Dossier — dieselbe Erb-Quelle wie beim
   Briefing-Kopf, s. CLAUDE.md "Etappe 2". Muster: test/briefingfelder.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { inhalt } = require('../inhalt.js');
const { dossier } = require('../dossier.js');

test('der Lernziele-Kopf traegt Kurs, Titel, Kompetenzfeld, Rechtsstand und die GENAU-Quellenliste', () => {
  const d = dossier.neu('VL-001');
  d.regulatorik = { stand: '1.1.2026', saq_rezert: false };
  d.quellen = [{ id: 'Q-001', titel: 'Kursausschreibung', stand: '2026', url: 'https://x.ch', abgerufen: '2026-07-30' }];
  const kopf = inhalt.lernzielePromptKopf({ kursId: 'VL-001', kurstitel: 'Vorsorge Basis', kompetenzfeld: 'Vorsorge' }, d);
  /* Wortlaut-Hinweis (Konvention 9, Fix in dieser Task): 'Stand 2026' aus der
     Brief-Vorlage trug keinen Doppelpunkt — briefingPromptKopf.test.js
     (Zeile 204) haelt den bestehenden, reviewer-freigegebenen Wortlaut
     'Stand: 2026' (mit Doppelpunkt) fest, und lernzielePromptKopf teilt sich
     GENAU diesen Zeilen-Builder (s. inhalt.js). Der bestehende Wortlaut hat
     Vorrang, der Test hier ist auf ihn abgestimmt. */
  for (const s of ['VL-001', 'Vorsorge Basis', 'Vorsorge', 'Rechtsstand: 1.1.2026',
                   'FACHQUELLEN', 'GENAU diese Liste', 'Q-001 · Kursausschreibung · Stand: 2026']) {
    assert.ok(kopf.includes(s), s + ' fehlt');
  }
});

test('quellenfrei heisst quellenfrei, nie eine leere Liste', () => {
  const d = dossier.neu('VL-001'); d.content_modus = 'quellenfrei';
  d.regulatorik = { stand: '1.1.2026' };
  const kopf = inhalt.lernzielePromptKopf(null, d);
  /* Derselbe Satz wie in briefingPromptKopf ("MODUS QUELLENFREI: ...", Grossbuchstaben,
     s. dortiger Test /MODUS QUELLENFREI/) — deshalb hier case-insensitiv geprueft,
     statt den bestehenden Wortlaut fuer diese Task zu aendern. */
  assert.match(kopf, /quellenfrei/i);
  assert.ok(!/GENAU diese Liste/.test(kopf));
});

test('ohne Dossier gibt es keinen Kopf', () => {
  assert.equal(inhalt.lernzielePromptKopf({ kursId: 'X' }, null), '');
});

/* T13 (VL-002, 2026-07-30, Entscheid Markus "es muss IMMER von Beginn
   funktionieren"): der Chat fragte im Live-Einsatz nach dem Briefing-Dateinamen
   und setzte version=1, obwohl v1-v5 im Ordner lagen — beides weiss die App
   schon aus den beiden dateien-Caches (01_briefing, Schritt-2-Ordner). Drittes,
   optionales Argument extras = { version, basiertAuf } — von app.js aus den
   bereits geladenen Caches berechnet (inhalt.naechsteVersion/geltendeDatei),
   nicht neu erfunden in dieser Funktion (Konvention 9: eine Quelle pro Begriff). */
test('mit extras traegt der Kopf Version, basiert_auf und die Projekt-Wissen-Liste', () => {
  const d = dossier.neu('VL-001');
  d.regulatorik = { stand: '1.1.2026' };
  d.quellen = [
    { id: 'Q-001', titel: 'Kursausschreibung', stand: '2026', datei: 'a.pdf' },
    { id: 'Q-002', titel: 'Deep Dive', stand: '2026', datei: 'b.pdf' },
    { id: 'Q-003', titel: 'Verordnung', stand: '2026', url: 'https://x.ch', abgerufen: '2026-07-30' }
  ];
  const kopf = inhalt.lernzielePromptKopf(
    { kursId: 'VL-001', kurstitel: 'Vorsorge Basis', kompetenzfeld: 'Vorsorge' },
    d,
    { version: 6, basiertAuf: 'VL-001_briefing_v2.md' }
  );
  assert.ok(kopf.includes('Version des Lieferobjekts: 6'), 'Version fehlt');
  assert.match(kopf, /YAML-Feld 'version'/);
  assert.ok(kopf.includes('basiert_auf: VL-001_briefing_v2.md'), 'basiert_auf fehlt');
  assert.match(kopf, /YAML-Feld 'basiert_auf'/);
  const zeile = kopf.split('\n').filter((z) => z.indexOf('PROJEKT-WISSEN:') === 0)[0];
  assert.ok(zeile, 'PROJEKT-WISSEN-Zeile fehlt');
  assert.ok(zeile.includes('a.pdf'), 'a.pdf fehlt in der Projekt-Wissen-Liste');
  assert.ok(zeile.includes('b.pdf'), 'b.pdf fehlt in der Projekt-Wissen-Liste');
  /* Nur Datei-Quellen — die Link-Quelle Q-003 hat kein datei-Feld und darf in
     GENAU dieser Zeile nicht auftauchen (sie steht schon im FACHQUELLEN-Block). */
  assert.ok(!zeile.includes('Verordnung'), 'Link-Quelle darf nicht in der Projekt-Wissen-Liste stehen');
  assert.ok(kopf.includes('Fehlt dir eine davon: nenne sie in der Phase-1-Frageliste'), 'Hinweissatz fehlt');
});

test('ohne extras (oder bei fehlendem Cache) fehlen Version und basiert_auf — kein Raten', () => {
  const d = dossier.neu('VL-001');
  d.regulatorik = { stand: '1.1.2026' };
  const kopfOhneExtras = inhalt.lernzielePromptKopf(
    { kursId: 'VL-001', kurstitel: 'Vorsorge Basis', kompetenzfeld: 'Vorsorge' }, d
  );
  assert.ok(!kopfOhneExtras.includes('Version des Lieferobjekts'), 'Version wurde geraten');
  assert.ok(!kopfOhneExtras.includes('basiert_auf:'), 'basiert_auf wurde geraten');

  const kopfLeereExtras = inhalt.lernzielePromptKopf(
    { kursId: 'VL-001', kurstitel: 'Vorsorge Basis', kompetenzfeld: 'Vorsorge' }, d, {}
  );
  assert.ok(!kopfLeereExtras.includes('Version des Lieferobjekts'), 'Version wurde geraten (leere extras)');
  assert.ok(!kopfLeereExtras.includes('basiert_auf:'), 'basiert_auf wurde geraten (leere extras)');
});

test('ohne Datei-Quellen bleibt die Projekt-Wissen-Zeile weg', () => {
  const d = dossier.neu('VL-001');
  d.regulatorik = { stand: '1.1.2026' };
  d.quellen = [{ id: 'Q-001', titel: 'Verordnung', stand: '2026', url: 'https://x.ch', abgerufen: '2026-07-30' }];
  const kopf = inhalt.lernzielePromptKopf(
    { kursId: 'VL-001', kurstitel: 'Vorsorge Basis', kompetenzfeld: 'Vorsorge' }, d, { version: 1 }
  );
  assert.ok(!kopf.includes('PROJEKT-WISSEN:'), 'Projekt-Wissen-Zeile ohne Datei-Quelle sollte fehlen');
});
