'use strict';
/* inhalt.didaktikPromptKopf(kurs, d, extras) — der GESETZTE Angabenblock fuer
   Schritt 5 (Didaktik/Interaktions-Contracts), D4 Etappe 5. Gleiches Prinzip
   wie briefingPromptKopf/lernzielePromptKopf/skriptPromptKopf/
   contentPromptKopf: was hier steht, muss der Chat nicht erfragen. Dieser
   Kopf ist der GESETZTE Teil, den didaktikPruefe (D2) beim Pruefen
   voraussetzt (Interaktionstyp-Palette geschlossen, die an schritt-5
   adressierten Dossier-Punkte muessen GENAU wiederkehren). Muster:
   test/contentkopf.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { inhalt } = require('../inhalt.js');
const { dossier } = require('../dossier.js');

test('voller Kopf mit allen extras traegt Kurs/Kompetenzfeld/Rechtsstand, Basis, ' +
     'Version, Palette wörtlich, beide Punkte-Zeilen wörtlich, die drei festen Regeln ' +
     'und den Schluss-Satz', () => {
  const d = dossier.neu('AFL-001');
  d.regulatorik = { stand: '1.1.2026', saq_rezert: false };
  dossier.offenNeu(d, { was: 'EK-002: Zahl 34128 pruefen', wo: 'AFL-001_content_final.docx', fuer: 'schritt-5' });
  dossier.offenNeu(d, { was: 'EK-003: Divergenz Rechtsstand klaeren', wo: 'AFL-001_content_final.docx', fuer: 'schritt-5' });
  /* Ein Punkt an ein ANDERES Ziel darf nicht mitgezählt werden. */
  dossier.offenNeu(d, { was: 'Ganz anderer Punkt', wo: 'x', fuer: 'schritt-6' });

  const kurs = { kursId: 'AFL-001', kurstitel: 'Anlagefonds', kompetenzfeld: 'Anlegen' };
  const extras = {
    basiertAuf: 'AFL-001_content_final.blocks',
    version: 1,
    zielname: 'AFL-001_didaktik_v1.blocks',
    palette: ['regler', 'rechner', 'zuordnung', 'finde-den-fehler', 'umschalt-diagramm',
              'zerlegen', 'szenario', 'illustration', 'fliesstext']
  };
  const kopf = inhalt.didaktikPromptKopf(kurs, d, extras);

  assert.ok(kopf.includes('AFL-001'), 'Kurs-ID fehlt');
  assert.ok(kopf.includes('Anlagefonds'), 'Kurstitel fehlt');
  assert.ok(kopf.includes('Anlegen'), 'Kompetenzfeld fehlt');
  assert.ok(kopf.includes('Rechtsstand: 1.1.2026'), 'Rechtsstand fehlt');

  assert.ok(kopf.includes('Basis: AFL-001_content_final.blocks'), 'Basis fehlt');
  assert.ok(kopf.includes('Version des Lieferobjekts: 1'), 'Version fehlt');
  assert.ok(kopf.includes('Interaktionstypen (GENAU diese, nichts anderes): regler, rechner, ' +
    'zuordnung, finde-den-fehler, umschalt-diagramm, zerlegen, szenario, illustration, fliesstext'),
    'Palette-Zeile fehlt oder weicht ab');

  /* Beide Punkte-Zeilen woertlich: die Aufzaehlung UND die Uebernahme-Anweisung. */
  assert.ok(kopf.includes('- EK-002: Zahl 34128 pruefen'), 'erster Punkt fehlt woertlich');
  assert.ok(kopf.includes('- EK-003: Divergenz Rechtsstand klaeren'), 'zweiter Punkt fehlt woertlich');
  assert.ok(!kopf.includes('Ganz anderer Punkt'), 'ein Punkt eines ANDEREN Ziels ist mitgerutscht');
  assert.ok(kopf.includes('Übernimm jeden Punkt GENAU in ###PUNKTE und versieh ihn mit ' +
    'entscheid: ODER verschieben: + begruendung: — lass keinen aus, erfinde keinen dazu.'),
    'Uebernahme-Anweisung fehlt woertlich');

  assert.ok(kopf.includes('Fakten sind final — du übersetzt den freigegebenen Content, du erfindest nicht.'),
    'erste feste Regel fehlt');
  assert.ok(kopf.includes('Interaktion ist der Standard — typ fliesstext nur mit begruendung.'),
    'zweite feste Regel fehlt');
  assert.ok(kopf.includes('Jede Eingangskompetenz braucht mindestens einen Interaktions-Contract.'),
    'dritte feste Regel fehlt');

  assert.ok(kopf.includes('Liefere in Phase 2 DIREKT die Blockdatei AFL-001_didaktik_v1.blocks ' +
    'zum Herunterladen.'), 'Schluss-Satz fehlt');
});

test('ohne extras fehlen Basis, Version, Palette und der Schluss-Satz — der Rest bleibt', () => {
  const d = dossier.neu('AFL-001');
  d.regulatorik = { stand: '1.1.2026' };
  const kurs = { kursId: 'AFL-001', kurstitel: 'Anlagefonds', kompetenzfeld: 'Anlegen' };

  const ohneExtras = inhalt.didaktikPromptKopf(kurs, d);
  for (const s of ['Basis:', 'Version des Lieferobjekts', 'Interaktionstypen (GENAU diese',
                    'Liefere in Phase 2']) {
    assert.ok(!ohneExtras.includes(s), s + ' wurde geraten');
  }
  assert.ok(ohneExtras.includes('AFL-001'), 'der Rest (Kurs-ID) fehlt');
  assert.ok(ohneExtras.includes('Rechtsstand: 1.1.2026'), 'der Rest (Rechtsstand) fehlt');
  assert.ok(ohneExtras.includes('Fakten sind final'), 'die festen Regeln fehlen unconditional');

  const leereExtras = inhalt.didaktikPromptKopf(kurs, d, {});
  for (const s of ['Basis:', 'Version des Lieferobjekts', 'Interaktionstypen (GENAU diese',
                    'Liefere in Phase 2']) {
    assert.ok(!leereExtras.includes(s), s + ' wurde geraten (leere extras)');
  }
});

test('ohne Dossier gibt es keinen Kopf', () => {
  assert.equal(inhalt.didaktikPromptKopf({ kursId: 'AFL-001' }, null, {
    basiertAuf: 'x', version: 1, zielname: 'x.blocks', palette: ['regler']
  }), '');
});

test('ohne schritt-5-Punkte fehlt der PUNKTE-Block ganz', () => {
  const d = dossier.neu('AFL-001');
  d.regulatorik = { stand: '1.1.2026' };
  const kopf = inhalt.didaktikPromptKopf({ kursId: 'AFL-001' }, d);
  assert.ok(!kopf.includes('PUNKTE AUS SCHRITT 4'), 'PUNKTE-Block ohne Punkte haette fehlen sollen');
  assert.ok(!kopf.includes('Übernimm jeden Punkt GENAU'), 'die Uebernahme-Anweisung haette fehlen sollen');

  /* Nur ein Punkt an ein ANDERES Ziel — der Block bleibt weiterhin weg. */
  dossier.offenNeu(d, { was: 'Fremder Punkt', wo: 'x', fuer: 'schritt-6' });
  const kopf2 = inhalt.didaktikPromptKopf({ kursId: 'AFL-001' }, d);
  assert.ok(!kopf2.includes('PUNKTE AUS SCHRITT 4'), 'ein Punkt an ein anderes Ziel darf den Block nicht ausloesen');
});
