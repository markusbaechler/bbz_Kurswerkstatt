'use strict';
/* inhalt.contentPromptKopf(kurs, d, extras) — der GESETZTE Angabenblock fuer
   Schritt 4 (Validierung), V3 Etappe 4. Gleiches Prinzip wie
   briefingPromptKopf/lernzielePromptKopf/skriptPromptKopf: was hier steht,
   muss der Chat nicht erfragen. Dieser Kopf ist der GESETZTE Teil, den
   validierungPruefe (V2) beim Pruefen voraussetzt (Leseliste MUSS vollstaendig
   sein, ###VALIDIERUNG ist Pflicht je Kapitel). Muster: test/skriptkopf.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { inhalt } = require('../inhalt.js');
const { dossier } = require('../dossier.js');

test('voller Kopf mit allen extras traegt Kurs/Kompetenzfeld/Rechtsstand, ' +
     'Variante A/B, Contract, Version, die drei festen Regeln, FACHQUELLEN, ' +
     'PROJEKT-WISSEN und den ZIP-Schluss-Satz', () => {
  const d = dossier.neu('AFL-001');
  d.regulatorik = { stand: '1.1.2026', saq_rezert: false };
  d.quellen = [
    { id: 'Q-001', titel: 'Kursausschreibung', stand: '2026', datei: 'a.pdf' },
    { id: 'Q-002', titel: 'Verordnung', stand: '2026', url: 'https://x.ch', abgerufen: '2026-07-30' }
  ];
  const kurs = { kursId: 'AFL-001', kurstitel: 'Anlagefonds', kompetenzfeld: 'Anlegen' };
  const extras = {
    basisClaude: 'AFL-001_skript-claude_v2.blocks',
    basisChatgpt: 'AFL-001_skript-chatgpt_v1.blocks',
    contract: 'AFL-001_lernziele-drehbuch_final.xlsx',
    version: 1,
    zielname: 'AFL-001_content_v1.zip'
  };
  const kopf = inhalt.contentPromptKopf(kurs, d, extras);

  assert.ok(kopf.includes('AFL-001'), 'Kurs-ID fehlt');
  assert.ok(kopf.includes('Anlagefonds'), 'Kurstitel fehlt');
  assert.ok(kopf.includes('Anlegen'), 'Kompetenzfeld fehlt');
  assert.ok(kopf.includes('Rechtsstand: 1.1.2026'), 'Rechtsstand fehlt');

  assert.ok(kopf.includes('Variante A (claude): AFL-001_skript-claude_v2.blocks'), 'Variante A fehlt');
  assert.ok(kopf.includes('Variante B (chatgpt): AFL-001_skript-chatgpt_v1.blocks'), 'Variante B fehlt');
  assert.ok(kopf.includes('Contract: AFL-001_lernziele-drehbuch_final.xlsx'), 'Contract fehlt');
  assert.ok(kopf.includes('Version des Lieferobjekts: 1'), 'Version fehlt');
  assert.match(kopf, /YAML-Feld 'version'/);

  /* Drei feste Regeln (Brief V3) — unconditional sobald d vorliegt, kein
     extras-Wert dahinter. Die Altmaterial-Zeile wird NUR hier geprueft
     (Mutationsprobe-Isolation: kommentiert man sie im Code aus, darf genau
     dieser eine Test rot werden, kein anderer). */
  assert.ok(kopf.includes('Prüfstein, nicht Wahrheitsquelle'), 'Altmaterial-Regel fehlt');
  assert.ok(kopf.includes("nie 'laut Altmaterial'"), 'Altmaterial-Fundstellen-Satz fehlt');
  assert.ok(kopf.includes('Die Leseliste nennt ALLE Dossier-Quellen'), 'Leselisten-Pflicht fehlt');
  assert.match(kopf, /###VALIDIERUNG/, '###VALIDIERUNG-Pflicht-Satz fehlt');
  assert.match(kopf, /###VALIDIERUNG.*Pflicht/, '###VALIDIERUNG-Pflicht-Satz nennt "Pflicht" nicht');

  assert.match(kopf, /FACHQUELLEN \(verbindlich/, 'FACHQUELLEN-Block fehlt');
  assert.ok(kopf.includes('Q-001 · Kursausschreibung · Stand: 2026'), 'FACHQUELLEN-Zeile fehlt');
  const projektWissenZeile = kopf.split('\n').filter((z) => z.indexOf('PROJEKT-WISSEN:') === 0)[0];
  assert.ok(projektWissenZeile, 'PROJEKT-WISSEN-Zeile fehlt');
  assert.ok(projektWissenZeile.includes('a.pdf'), 'a.pdf fehlt in der Projekt-Wissen-Liste');

  assert.ok(kopf.includes(
    'Liefere in Phase 2 DIREKT das ZIP-Paket AFL-001_content_v1.zip (Blockdatei + neue PNGs) ' +
    'zum Herunterladen.'), 'ZIP-Schluss-Satz fehlt');
});

test('ohne extras fehlen Variante A/B, Contract, Version und der Schluss-Satz — der Rest bleibt', () => {
  const d = dossier.neu('AFL-001');
  d.regulatorik = { stand: '1.1.2026' };
  const kurs = { kursId: 'AFL-001', kurstitel: 'Anlagefonds', kompetenzfeld: 'Anlegen' };

  const ohneExtras = inhalt.contentPromptKopf(kurs, d);
  for (const s of ['Variante A (claude):', 'Variante B (chatgpt):', 'Contract:',
                   'Version des Lieferobjekts', 'Liefere in Phase 2']) {
    assert.ok(!ohneExtras.includes(s), s + ' wurde geraten');
  }
  assert.ok(ohneExtras.includes('AFL-001'), 'der Rest (Kurs-ID) fehlt');
  assert.ok(ohneExtras.includes('Rechtsstand: 1.1.2026'), 'der Rest (Rechtsstand) fehlt');

  const leereExtras = inhalt.contentPromptKopf(kurs, d, {});
  for (const s of ['Variante A (claude):', 'Variante B (chatgpt):', 'Contract:',
                   'Version des Lieferobjekts', 'Liefere in Phase 2']) {
    assert.ok(!leereExtras.includes(s), s + ' wurde geraten (leere extras)');
  }
});

test('ohne Dossier gibt es keinen Kopf', () => {
  assert.equal(inhalt.contentPromptKopf({ kursId: 'AFL-001' }, null, {
    basisClaude: 'x', basisChatgpt: 'y', contract: 'z', version: 1, zielname: 'x.zip'
  }), '');
});

test('quellenfrei zeigt den Quellenfrei-Satz, keine GENAU-Liste', () => {
  const d = dossier.neu('AFL-001');
  d.regulatorik = { stand: '1.1.2026' };
  d.content_modus = 'quellenfrei';
  const kopf = inhalt.contentPromptKopf({ kursId: 'AFL-001' }, d);
  assert.match(kopf, /quellenfrei/i);
  assert.ok(!/GENAU diese Liste/.test(kopf));
});
