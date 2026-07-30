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
