'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dossier } = require('../dossier.js');

test('neu() liefert ein leeres, gueltiges Dossier', () => {
  const d = dossier.neu('VL-001');
  assert.equal(d.kurs, 'VL-001');
  assert.equal(d.dossier, 1);
  assert.equal(d.content_modus, 'quellengestuetzt');
  assert.deepEqual(d.quellen, []);
  assert.deepEqual(dossier.pruefe(d), []);
});

test('ausWerten() uebernimmt Formularwerte in scope und bewahrt den Rest', () => {
  const alt = dossier.neu('VL-001');
  alt.quellen.push({ id: 'Q-001', titel: 'X', stand: '2026', datei: 'x.pdf' });
  const d = dossier.ausWerten('VL-001', { zielgruppe: ' Beratende ', leer: '' }, alt, '2026-07-29T18:00:00Z');
  assert.equal(d.scope.zielgruppe, 'Beratende');       /* getrimmt */
  assert.equal('leer' in d.scope, false);              /* Leeres faellt weg */
  assert.equal(d.quellen.length, 1);                   /* Quellen ueberleben das Formular */
  assert.equal(d.stand, '2026-07-29T18:00:00Z');
  assert.notEqual(d, alt);                             /* Kopie, kein Durchgriff */
});

test('text()/lesen() ist ein verlustfreier Kreis', () => {
  const d = dossier.ausWerten('VL-001', { kurszweck: 'Derivate verstehen' }, null, null);
  const zurueck = dossier.lesen(dossier.text(d));
  assert.deepEqual(zurueck, d);
});

test('lesen() weist Unbrauchbares ab statt es zu reparieren', () => {
  assert.equal(dossier.lesen('kein json'), null);
  assert.equal(dossier.lesen(''), null);
  assert.equal(dossier.lesen('{"dossier":99,"kurs":"X"}'), null);  /* fremde Schema-Version */
});

test('pruefe() benennt fehlende Pflichtteile', () => {
  const p = dossier.pruefe({ dossier: 1 });
  assert.ok(p.some(x => /kurs/.test(x)));
  assert.ok(p.some(x => /scope/.test(x)));
});

test('DATEI() baut den Dateinamen aus der Kurs-ID', () => {
  assert.equal(dossier.DATEI('VL-001'), 'VL-001_dossier.json');
});

test('statusVon() ist ohne Eintrag entwurf — nie undefined', () => {
  assert.equal(dossier.statusVon(dossier.neu('X'), 'briefing'), 'entwurf');
});

test('statusSetzen() schreibt nur bekannte Werte', () => {
  const d = dossier.neu('X');
  dossier.statusSetzen(d, 'briefing', 'final');
  assert.equal(dossier.statusVon(d, 'briefing'), 'final');
  assert.throws(() => dossier.statusSetzen(d, 'briefing', 'fertig'));  /* KWKurse-Vokabular ist hier falsch */
});

test('banner() wird gerendert, nie getippt: final ist bannerfrei', () => {
  assert.equal(dossier.banner('final'), null);
  assert.match(dossier.banner('entwurf'), /ENTWURF/);
  assert.match(dossier.banner('validiert'), /VALIDIERT/);
});

test('quelleNeu() vergibt fortlaufende IDs und verlangt titel, stand, datei', () => {
  const d = dossier.neu('X');
  const q = dossier.quelleNeu(d, { titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: 'sspa-map-2025.pdf' });
  assert.equal(q.id, 'Q-001');
  assert.equal(dossier.quelleNeu(d, { titel: 'B', stand: '2026', datei: 'b.pdf' }).id, 'Q-002');
  assert.throws(() => dossier.quelleNeu(d, { titel: 'ohne Stand', datei: 'x.pdf' }), /stand/);
});

test('positivliste() ist die Liste der Dateinamen — Eingabe fuer den Auftrag', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', datei: 'a.pdf' });
  assert.deepEqual(dossier.positivliste(d), ['a.pdf']);
});

test('quellenDateiname() bereinigt wie der Ablage-Kontrakt es verlangt', () => {
  /* Unterstrich, Umlaute, Leerzeichen — genau die Faelle, an denen Dateien
     unsichtbar wurden (AFL-001_lernziele_drehbuch_v1.xlsx, 2026-07-22). */
  assert.equal(dossier.quellenDateiname('AHV Merkblatt_2.01 (gültig).pdf'), 'ahv-merkblatt-2-01-gueltig.pdf');
  assert.equal(dossier.quellenDateiname('map.PDF'), 'map.pdf');
});

/* ---------- Etappe 1b: Link-Quellen (Datei ODER Link) ---------- */

test('quelleNeu() legt eine Link-Quelle an: url + abgerufen, kein datei-Feld', () => {
  const d = dossier.neu('X');
  const q = dossier.quelleNeu(d, {
    titel: 'Ausschreibung SSPA', herausgeber: 'SSPA', stand: '2026',
    url: 'https://sspa.ch/ausschreibung', abgerufen: '2026-07-30'
  });
  assert.equal(q.id, 'Q-001');
  assert.equal(q.url, 'https://sspa.ch/ausschreibung');
  assert.equal(q.abgerufen, '2026-07-30');
  assert.equal('datei' in q, false);
});

test('quelleNeu() wirft, wenn Datei UND Link angegeben werden', () => {
  const d = dossier.neu('X');
  assert.throws(
    () => dossier.quelleNeu(d, { titel: 'X', stand: '2026', datei: 'x.pdf', url: 'https://x.ch' }),
    /entweder.*Datei.*Link|entweder.*Link.*Datei/i
  );
});

test('quelleNeu() wirft, wenn weder Datei noch Link angegeben werden', () => {
  const d = dossier.neu('X');
  assert.throws(
    () => dossier.quelleNeu(d, { titel: 'X', stand: '2026' }),
    /Datei.*Link|Link.*Datei/i
  );
});

test('quelleNeu() wirft bei einer URL ohne http(s)', () => {
  const d = dossier.neu('X');
  assert.throws(
    () => dossier.quelleNeu(d, { titel: 'X', stand: '2026', url: 'sspa.ch/seite', abgerufen: '2026-07-30' }),
    /http/i
  );
});

test('pruefe() verlangt bei einer Link-Quelle das Abrufdatum', () => {
  const d = dossier.neu('X');
  d.quellen.push({ id: 'Q-001', titel: 'X', stand: '2026', url: 'https://x.ch' });  /* abgerufen fehlt */
  const p = dossier.pruefe(d);
  assert.ok(p.some(x => /abgerufen/.test(x)), 'pruefe() meldet das fehlende Abrufdatum nicht');
});

test('positivliste() ignoriert Link-Quellen — nur Dateien gehen in die Leseliste', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', datei: 'a.pdf' });
  dossier.quelleNeu(d, { titel: 'B', stand: '2026', url: 'https://b.ch', abgerufen: '2026-07-30' });
  assert.deepEqual(dossier.positivliste(d), ['a.pdf']);
});

/* ---------- Fix-Runde 1: javascript:-URL wird auch beim Lesen abgewiesen ----------
   quelleNeu() (Schreibweg) prueft das Schema schon; ein von Hand in SharePoint
   editiertes dossier.json geht aber nie durch quelleNeu — pruefe()/lesen() muessen
   dieselbe Schema-Pruefung tragen, sonst liesse sich ausfuehrbarer Code einschleusen. */

test('pruefe() beanstandet eine url-Quelle mit fremdem Schema (javascript:)', () => {
  const d = dossier.neu('X');
  d.quellen.push({ id: 'Q-001', titel: 'X', stand: '2026', url: 'javascript:alert(1)', abgerufen: '2026-07-30' });
  const p = dossier.pruefe(d);
  assert.ok(p.some(x => /url|http/i.test(x)), 'pruefe() laesst javascript: klaglos durch');
});

test('lesen() weist ein Dossier mit javascript:-Quelle ab', () => {
  const d = dossier.neu('X');
  d.quellen.push({ id: 'Q-001', titel: 'X', stand: '2026', url: 'javascript:alert(1)', abgerufen: '2026-07-30' });
  assert.equal(dossier.lesen(dossier.text(d)), null);
});

/* ---------- Etappe 1c: Quelle entfernen ---------- */

test('quelleEntfernen() entfernt den Eintrag mit dieser id und gibt ihn zurueck', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', datei: 'a.pdf' });
  const q2 = dossier.quelleNeu(d, { titel: 'B', stand: '2026', datei: 'b.pdf' });
  const entfernt = dossier.quelleEntfernen(d, 'Q-001');
  assert.deepEqual(entfernt, { id: 'Q-001', titel: 'A', herausgeber: '', stand: '2025', datei: 'a.pdf' });
  assert.deepEqual(d.quellen, [q2]);
});

test('quelleEntfernen() mit unbekannter id liefert null, Liste bleibt unveraendert', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', datei: 'a.pdf' });
  const vorher = JSON.parse(JSON.stringify(d.quellen));
  const entfernt = dossier.quelleEntfernen(d, 'Q-099');
  assert.equal(entfernt, null);
  assert.deepEqual(d.quellen, vorher);
});

test('naechsteQuellenId() zaehlt nach dem Entfernen weiter hoch statt Luecken zu fuellen', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', datei: 'a.pdf' });   /* Q-001 */
  dossier.quelleNeu(d, { titel: 'B', stand: '2026', datei: 'b.pdf' });   /* Q-002 */
  dossier.quelleEntfernen(d, 'Q-001');
  assert.equal(dossier.naechsteQuellenId(d), 'Q-003');
});

/* ---------- Etappe 1e Haertung, Task 3: quellePruefe() gemeinsam, Duplikatschutz (C3, I6) ----------
   Audit I6: quelleNeu() (Schreibweg) und pruefe() (Leseweg) pruefen jetzt beide ueber
   dieselbe interne quellePruefe() — vorher war die Schreibseite laxer (url case-sensitiv,
   abgerufen nicht verlangt). Migration ist kein Thema: pruefe() verlangte abgerufen schon
   vorher, alles heute lesbare bleibt lesbar (bestaetigt: VL-001 in SharePoint hat 0 Quellen). */

test('quelleNeu() akzeptiert HTTPS:// gross beim Schreiben, pruefe() akzeptiert es beim Lesen', () => {
  const d = dossier.neu('X');
  const q = dossier.quelleNeu(d, {
    titel: 'X', stand: '2026', url: 'HTTPS://X.CH/seite', abgerufen: '2026-07-30'
  });
  assert.equal(q.url, 'HTTPS://X.CH/seite');
  assert.deepEqual(dossier.pruefe(d), []);
});

test('quelleNeu() wirft bei einer URL ohne abgerufen — auch beim Schreiben Pflicht (I6)', () => {
  const d = dossier.neu('X');
  assert.throws(
    () => dossier.quelleNeu(d, { titel: 'X', stand: '2026', url: 'https://x.ch' }),
    /abgerufen/
  );
});

test('quelleNeu() weist eine doppelte Datei ab und nennt die bestehende Q-ID (C3)', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', datei: 'a.pdf' });  /* Q-001 */
  assert.throws(
    () => dossier.quelleNeu(d, { titel: 'B', stand: '2026', datei: 'A.PDF' }),  /* case-insensitiv */
    /Q-001/
  );
  assert.equal(d.quellen.length, 1, 'die doppelte Datei wurde trotzdem angehaengt');
});

test('quelleNeu() weist eine doppelte URL ab und nennt die bestehende Q-ID (C3)', () => {
  const d = dossier.neu('X');
  dossier.quelleNeu(d, { titel: 'A', stand: '2025', url: 'https://sspa.ch/seite', abgerufen: '2026-07-30' });  /* Q-001 */
  assert.throws(
    () => dossier.quelleNeu(d, { titel: 'B', stand: '2026', url: 'HTTPS://SSPA.CH/seite', abgerufen: '2026-07-30' }),
    /Q-001/
  );
  assert.equal(d.quellen.length, 1, 'die doppelte URL wurde trotzdem angehaengt');
});

/* ---------- Fix-Runde T3: der Fallback-Throw in quelleNeu() nutzt quellePruefe() ---------- */

test('quelleNeu() wirft beim Fallback (nur abgerufen fehlt) dieselbe Meldung wie quellePruefe()', () => {
  const d = dossier.neu('X');
  const q = { titel: 'X', stand: '2026', url: 'https://x.ch' };
  let meldung = null;
  try { dossier.quelleNeu(d, q); } catch (e) { meldung = e.message; }
  assert.equal(meldung, dossier.quellePruefe(q).join(' · '));
});

/* ---------- Etappe 1e, Task 6: regulatorik (Schema-Erweiterung, Entscheid Markus
   2026-07-30 — governance-minimal: genau EIN neues Pflichtfeld [Rechtsstand] +
   EIN Haekchen [SAQ-Rezertifizierung]). dossier.SCHEMA bleibt bewusst 1: das
   Feld ist rein additiv, kein Bruch mit dem, was vorher galt. ---------- */

test('neu() traegt ein leeres regulatorik-Objekt, pruefe() akzeptiert es', () => {
  const d = dossier.neu('X');
  assert.deepEqual(d.regulatorik, {});
  assert.deepEqual(dossier.pruefe(d), []);
});

test('pruefe() beanstandet ein fehlendes regulatorik (von Hand kaputt editiert)', () => {
  const d = dossier.neu('X');
  delete d.regulatorik;
  assert.ok(dossier.pruefe(d).some(x => /regulatorik/.test(x)));
});

test('pruefe() verlangt regulatorik.stand NICHT — alte Dossiers haben keins', () => {
  const d = dossier.neu('X');
  d.regulatorik = { zusatz: 'Rezert IK' };   /* kein stand */
  assert.deepEqual(dossier.pruefe(d), []);
});

test('ausWerten() ohne felder-Parameter bleibt rueckwaertskompatibel: alles nach scope', () => {
  const d = dossier.ausWerten('X', { reg_zusatz: 'Text', zielgruppe: 'Berater' }, null, null);
  assert.equal(d.scope.reg_zusatz, 'Text');
  assert.deepEqual(d.regulatorik, {});
});

test('ausWerten() routet ziel:regulatorik ueber speicherName, alles andere bleibt scope', () => {
  const felder = [
    { id: 'reg_zusatz', ziel: 'regulatorik', speicherName: 'zusatz' },
    { id: 'rechtsstand', ziel: 'regulatorik', speicherName: 'stand' },
    { id: 'saq_rezert', ziel: 'regulatorik' },
    { id: 'zielgruppe' }
  ];
  const d = dossier.ausWerten('X',
    { reg_zusatz: 'Rezert IK', rechtsstand: '1.1.2026', saq_rezert: true, zielgruppe: 'Berater' },
    null, null, felder);
  assert.deepEqual(d.regulatorik, { zusatz: 'Rezert IK', stand: '1.1.2026', saq_rezert: true });
  assert.deepEqual(d.scope, { zielgruppe: 'Berater' });
});

test('ausWerten() haelt ein explizites saq_rezert:false fest, statt es wegzulassen', () => {
  const felder = [{ id: 'saq_rezert', ziel: 'regulatorik' }];
  const d = dossier.ausWerten('X', { saq_rezert: false }, null, null, felder);
  assert.strictEqual(d.regulatorik.saq_rezert, false, 'false ist eine vollstaendige Antwort, kein Fehlen');
});

/* ---------- Migration bestehender Dossiers ohne regulatorik (Pflicht-Test) ----------
   Ein heute in SharePoint liegendes Dossier (VL-001-artig: dossier:1, scope.reg_zusatz
   gesetzt, KEIN regulatorik-Schluessel ueberhaupt — geschrieben, bevor dieses Feld
   existierte) muss weiterhin lesbar bleiben. lesen() ergaenzt regulatorik als {}
   und uebernimmt scope.reg_zusatz nach regulatorik.zusatz, entfernt es aus scope. */

test('lesen() eines Alt-Dossiers ohne regulatorik bleibt lesbar und migriert reg_zusatz', () => {
  const alt = {
    dossier: 1, kurs: 'VL-001', stand: null,
    scope: { zielgruppe: 'Berater', reg_zusatz: 'Rezertifizierung IK' },
    content_modus: 'quellengestuetzt', quellen: [], status: {}, offen: [], entschieden: []
  };
  const d = dossier.lesen(JSON.stringify(alt));
  assert.ok(d, 'ein Alt-Dossier ohne regulatorik wurde faelschlich abgewiesen');
  assert.deepEqual(d.regulatorik, { zusatz: 'Rezertifizierung IK' });
  assert.equal('reg_zusatz' in d.scope, false, 'reg_zusatz haette aus scope verschwinden sollen');
  assert.equal(d.scope.zielgruppe, 'Berater', 'unbeteiligte scope-Felder wurden angetastet');
});

test('lesen() eines Alt-Dossiers ohne jedes reg_zusatz ergibt ein leeres regulatorik', () => {
  const alt = {
    dossier: 1, kurs: 'VL-001', stand: null, scope: {},
    content_modus: 'quellengestuetzt', quellen: [], status: {}, offen: [], entschieden: []
  };
  const d = dossier.lesen(JSON.stringify(alt));
  assert.ok(d);
  assert.deepEqual(d.regulatorik, {});
});

test('lesen() eines bereits migrierten Dossiers (regulatorik vorhanden) laesst es unangetastet', () => {
  const heutig = {
    dossier: 1, kurs: 'VL-001', stand: null, scope: {},
    regulatorik: { zusatz: 'X', stand: '1.1.2026', saq_rezert: true },
    content_modus: 'quellengestuetzt', quellen: [], status: {}, offen: [], entschieden: []
  };
  const d = dossier.lesen(JSON.stringify(heutig));
  assert.deepEqual(d.regulatorik, { zusatz: 'X', stand: '1.1.2026', saq_rezert: true });
});

/* Mutationsprobe (Fix-Runde 1, I-1: tatsaechlich ausgefuehrt, nicht nur behauptet —
   der urspruengliche Kommentar hier nannte "drei rote Tests" ohne den Lauf wirklich
   gemacht zu haben; das war falsch). Migrationsblock in dossier.lesen() entfernt
   (die Zeilen, die d.regulatorik = {} setzen und scope.reg_zusatz uebernehmen),
   `node --test` ausgefuehrt: **5 Tests rot**, nicht 3 — dossier.pruefe() meldet
   "regulatorik fehlt" fuer jedes Dossier-Objekt ohne den Schluessel, und dieses
   Muster (rohe JSON-Fixtures im Testcode, ohne regulatorik, so wie ein echtes
   Alt-Dossier) kommt an mehr Stellen vor als in diesem Abschnitt:
   - die zwei Migrations-Tests direkt oben in dieser Datei
   - `test/dossiernachladen.test.js`: "nach einem Fehler ruft ein zweiter Aufruf
     von dossierNachladen tatsaechlich erneut ab" (rohes JSON im Mock von
     graph.dateiLesenGenau)
   - `test/dossierschreiben.test.js`: die zwei 412-Retry-Tests ("frisch lesen,
     Mutator einmal erneut anwenden, dann Erfolg" und "zwei 412 in Folge …") —
     ebenfalls rohes JSON ohne regulatorik im Mock.
   Wieder hergestellt: `node --test` erneut gruen, 428/428. Die Lehre, nicht nur
   fuer diesen Kommentar: eine Mutationsprobe ist nur so viel wert wie der
   tatsaechlich ausgefuehrte Lauf — eine plausibel klingende Zahl ohne echten
   Testlauf ist eine Behauptung, kein Beleg. */

/* ---------- Etappe 2, Task 3: identitaet (Titel/Kompetenzfeld aus KWKurse) ---------- */

test('identitaetSetzen stempelt Titel und Kompetenzfeld aus KWKurse', () => {
  const d = dossier.neu('VL-001');
  dossier.identitaetSetzen(d, { kursId: 'VL-001', kurstitel: 'Vorsorge Basis', kompetenzfeld: 'Vorsorge' });
  assert.deepEqual(d.identitaet, { titel: 'Vorsorge Basis', kompetenzfeld: 'Vorsorge' });
  assert.equal(dossier.pruefe(d).length, 0);
});

test('identitaetSetzen ohne Kurs laesst das Dossier unangetastet', () => {
  const d = dossier.neu('VL-001');
  dossier.identitaetSetzen(d, null);
  assert.equal(d.identitaet, undefined);
});

test('ein Alt-Dossier ohne identitaet bleibt lesbar', () => {
  const alt = JSON.stringify(dossier.neu('VL-001'));
  assert.ok(dossier.lesen(alt));
});

/* ---------- Etappe 2, Task 7: Duplikat-Leseweg (Handover §4.4) ----------
   Duplikat ist eine Eigenschaft der LISTE, nicht der einzelnen Quelle — quelleNeu()
   (Schreibweg) wies Duplikate schon ab (Etappe 1e, Audit C3); pruefe() (Leseweg, u.a.
   fuer von Hand editierte dossier.json) noch nicht. Sitz der Regel ist deshalb die
   Quellen-Schleife in pruefe(), die quellePruefe() je Eintrag ohnehin schon aufruft —
   dieselbe case-insensitive Vergleichslogik wie beim Schreibweg (datei/url). */

test('pruefe() weist doppelte Datei und doppelten Link ab — Leseweg wie Schreibweg', () => {
  const d = dossier.neu('VL-001');
  d.quellen = [
    { id: 'Q-001', titel: 'A', stand: '2026', datei: 'a.pdf' },
    { id: 'Q-002', titel: 'B', stand: '2026', datei: 'A.PDF' },
  ];
  assert.ok(dossier.pruefe(d).some(p => /doppelt/.test(p)));
  d.quellen = [
    { id: 'Q-001', titel: 'A', stand: '2026', url: 'https://x.ch', abgerufen: '2026-07-30' },
    { id: 'Q-002', titel: 'B', stand: '2026', url: 'HTTPS://X.CH', abgerufen: '2026-07-30' },
  ];
  assert.ok(dossier.pruefe(d).some(p => /doppelt/.test(p)));
});

/* Migrationsprobe (Brief Task 7): lesen() weist ein Dossier mit Duplikat kuenftig ab
   (null -> sichtbare Fehlermeldung ueber den bestehenden Nicht-sticky-Pfad, kein
   stiller Import) — das ist das gewollte Verhalten, kein Regressionsrisiko: ein
   VL-001-artiges Fixture-Dossier OHNE Duplikate (wie das echte VL-001 in SharePoint,
   Stand 2026-07-30) bleibt lesbar. */
test('lesen() weist ein Dossier mit doppelter Quelle ab, ein VL-001-artiges ohne Duplikate bleibt lesbar', () => {
  const mitDuplikat = dossier.neu('VL-001');
  mitDuplikat.quellen = [
    { id: 'Q-001', titel: 'A', stand: '2026', datei: 'a.pdf' },
    { id: 'Q-002', titel: 'B', stand: '2026', datei: 'a.pdf' },
  ];
  assert.equal(dossier.lesen(dossier.text(mitDuplikat)), null);

  const vl001 = dossier.neu('VL-001');
  dossier.quelleNeu(vl001, { titel: 'SSPA Map', stand: '2025', datei: 'sspa-map-2025.pdf' });
  dossier.quelleNeu(vl001, {
    titel: 'Ausschreibung', stand: '2026',
    url: 'https://sspa.ch/ausschreibung', abgerufen: '2026-07-30'
  });
  const zurueck = dossier.lesen(dossier.text(vl001));
  assert.ok(zurueck, 'ein VL-001-artiges Dossier ohne Duplikate wurde faelschlich abgewiesen');
  assert.equal(zurueck.quellen.length, 2);
});
