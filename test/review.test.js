'use strict';
/* V5, Etappe 4 — die Review-Ansicht (Schritt 4, Sign-off). Rein lesend: baut
   aus der validierten Blockdatei (04_validierung), beiden Schritt-3-Varianten
   (03_content) und dem Dossier eine Uebersicht — Herkunfts-Zaehlung,
   Quellen-Deckung, offene Punkte vorn, je Kapitel Herkunft-Badge/Beleg/
   Divergenz mit aufklappbarem Varianten-Nebeneinander. Die App verwaltet
   nichts (Leitsatz): geaendert wird im Dokument, neu hochgeladen, die
   Ansicht rendert frisch.

   Blocktext-Fixtures laufen ueber die ECHTE skriptLesen.lies()-Kette
   (Task-Brief V5), kein Handbau der gelesen-Objekte — Muster
   test/skriptpruefe.test.js block()/gelesen(). Jedes Kapitel traegt hier nur
   HERO als Inhalt: die uebrigen elf Pflichtbausteine fehlen bewusst,
   gelesen.fehler ist fuer reviewBlock irrelevant (das Gate dafuer ist
   inhalt.validierungPruefe/V2, nicht diese Ansicht). */
const test = require('node:test');
const assert = require('node:assert/strict');

const { controller, state, graph } = require('../app.js');
const { inhalt } = require('../inhalt.js');
require('../dossier.js');
require('../skript-schema.js');
const { skriptLesen } = require('../skript-lesen.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0]; // DBS-001, s. ansichten.test.js

/* ---------- Blocktext-Fixtures ---------- */

function kapitelBlock(spec) {
  var z = ['###KAPITEL nr=' + (spec.nr || 1) + ' | ek=' + spec.ek + ' | titel=' + (spec.titel || spec.ek)];
  if (spec.validierung) {
    z.push('###VALIDIERUNG');
    z.push('herkunft: ' + spec.validierung.herkunft);
    if (spec.validierung.beleg) z.push('beleg: ' + spec.validierung.beleg);
    if (spec.validierung.divergenz) z.push('divergenz: ' + spec.validierung.divergenz);
    if (spec.validierung.begruendung) z.push('begruendung: ' + spec.validierung.begruendung);
  }
  z.push('###HERO');
  z.push(spec.hero || ('Hero-Text ' + spec.ek + '.'));
  z.push('###ENDE-KAPITEL');
  return z.join('\n');
}

function skriptText(kurs, variante, kapitelSpecs, opts) {
  opts = opts || {};
  var z = ['###SKRIPT kurs=' + kurs + ' | variante=' + variante + ' | titel=Test | rechtsstand=01.01.2026'];
  z.push('###QUELLEN');
  (opts.gelesen || []).forEach(function (g) { z.push('gelesen: ' + g); });
  kapitelSpecs.forEach(function (spec) { z.push(kapitelBlock(spec)); });
  if (opts.offen && opts.offen.length) {
    z.push('###OFFEN');
    opts.offen.forEach(function (o) { z.push(o); });
  }
  return z.join('\n');
}

function gelesenAus(kurs, variante, kapitelSpecs, opts) {
  return skriptLesen.lies(skriptText(kurs, variante, kapitelSpecs, opts));
}

function dossierMit(quellenIds) {
  return {
    dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: quellenIds.map(function (id, n) { return { id: id, titel: 'Quelle ' + n, stand: '2026' }; }),
    status: {}, offen: [], entschieden: []
  };
}

/* ---------- ansichten.reviewBlock (ueber einSchritt, Muster gateBlock/quellenSpiegelBox) ---------- */

test('V5: ohne validierte Fassung erscheint nur der Kurzhinweis', () => {
  const props = { dossier: dossierMit([]), review: { validiert: null, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /Review erscheint nach der ersten abgelegten validierten Fassung/);
  assert.doesNotMatch(html, /best&auml;tigt/);
});

test('V5: ohne geladenes Review ueberhaupt (null/fehlend) ebenfalls nur der Kurzhinweis', () => {
  const props = { dossier: dossierMit([]) };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /Review erscheint nach der ersten abgelegten validierten Fassung/);
});

test('V5: ohne Dossier (auch mit geladener validierter Fassung) nur der Kurzhinweis', () => {
  const validiert = gelesenAus('DBS-001', 'claude',
    [{ ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } }]);
  const props = { review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /Review erscheint nach der ersten abgelegten validierten Fassung/);
});

test('V5: reviewBlock erscheint nur an einem Schritt mit pruefung===validierung (Schritt 3 zeigt ihn nicht)', () => {
  const validiert = gelesenAus('DBS-001', 'claude',
    [{ ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } }]);
  const props = { dossier: dossierMit([]), review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 3, null, props);
  assert.doesNotMatch(html, /id="review-block"/);
});

test('V5: Kopf zaehlt 2 bestaetigt / 1 korrigiert / 0 ergaenzt / 1 offen von 4 Eingangskompetenzen', () => {
  const validiert = gelesenAus('DBS-001', 'claude', [
    { ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } },
    { ek: 'DBS-001-EK-002', validierung: { herkunft: 'bestaetigt' } },
    { ek: 'DBS-001-EK-003', validierung: { herkunft: 'korrigiert', beleg: 'Contract S. 3' } },
    { ek: 'DBS-001-EK-004', validierung: { herkunft: 'offen' } }
  ]);
  const props = { dossier: dossierMit([]), review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /2 best&auml;tigt/);
  assert.match(html, /1 korrigiert/);
  assert.match(html, /0 erg&auml;nzt/);
  assert.match(html, /1 offen von 4 Eingangskompetenzen/);
});

test('V5: Quellen-Deckung zeigt beide Richtungen — fehlende Dossier-Q-IDs UND unbekannte Q-IDs im Text', () => {
  const validiert = gelesenAus('DBS-001', 'claude',
    [{ ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } }],
    { gelesen: ['Q-001 gelesen', 'Q-099 unbekannt'] });
  const props = {
    dossier: dossierMit(['Q-001', 'Q-002']),
    review: { validiert: validiert, claude: null, chatgpt: null }
  };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /Quellen-Deckung: 1 von 2 Dossier-Quellen/);
  assert.match(html, /fehlend: Q-002/);
  assert.match(html, /unbekannt im Text: Q-099/);
});

test('V5: die Zahl der [NEU-Marken wird ueber alle Bausteintexte der validierten Fassung gezaehlt', () => {
  const validiert = gelesenAus('DBS-001', 'claude', [
    { ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' }, hero: 'Text [NEU] mit einer Marke.' },
    { ek: 'DBS-001-EK-002', validierung: { herkunft: 'bestaetigt' }, hero: 'Zwei [NEU] Marken [NEU] hier.' }
  ]);
  const props = { dossier: dossierMit([]), review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /3 \[NEU\]-Marken im Text/);
});

test('V5: offene Punkte fuehren validiert/claude/chatgpt UND ein Divergenz-offen-Kapitel mit Herkunftsausweis zusammen', () => {
  const validiert = gelesenAus('DBS-001', 'claude', [
    { ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } },
    { ek: 'DBS-001-EK-002', titel: 'Kapitel zwei', validierung: { herkunft: 'ergaenzt', divergenz: 'offen' } }
  ], { offen: ['Punkt aus der validierten Fassung'] });
  const claude = gelesenAus('DBS-001', 'claude', [{ ek: 'DBS-001-EK-001' }], { offen: ['Punkt aus Claude'] });
  const chatgpt = gelesenAus('DBS-001', 'chatgpt', [{ ek: 'DBS-001-EK-001' }], { offen: ['Punkt aus ChatGPT'] });
  const props = {
    dossier: dossierMit([]),
    review: { validiert: validiert, claude: claude, chatgpt: chatgpt }
  };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /\[validiert\][\s\S]{0,20}Punkt aus der validierten Fassung/);
  assert.match(html, /\[claude\][\s\S]{0,20}Punkt aus Claude/);
  assert.match(html, /\[chatgpt\][\s\S]{0,20}Punkt aus ChatGPT/);
  assert.match(html, /Divergenz offen: DBS-001-EK-002/);
});

test('V5: ohne jeden offenen Punkt zeigt der Block das ausdruecklich, keine leere Liste', () => {
  const validiert = gelesenAus('DBS-001', 'claude',
    [{ ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } }]);
  const props = { dossier: dossierMit([]), review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /Keine offenen Punkte/);
});

test('V5: eine aufgeklappte Kapitel-Zeile zeigt beide Variantentexte escaped (Fremdwert-Probe <img>)', () => {
  const boesesHero = 'Normaler Text <img src=x onerror=alert(1)> Ende.';
  const validiert = gelesenAus('DBS-001', 'claude', [{
    ek: 'DBS-001-EK-001', titel: 'Kapitel eins',
    validierung: { herkunft: 'korrigiert', beleg: 'Contract S. 5', divergenz: 'entschieden', begruendung: 'Fachlich geklaert.' }
  }]);
  const claude = gelesenAus('DBS-001', 'claude', [{ ek: 'DBS-001-EK-001', hero: boesesHero }]);
  const chatgpt = gelesenAus('DBS-001', 'chatgpt', [{ ek: 'DBS-001-EK-001', hero: 'Chatgpt-Variante ohne Boesartigkeit.' }]);
  const props = {
    dossier: dossierMit([]),
    review: { validiert: validiert, claude: claude, chatgpt: chatgpt }
  };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /<details class="review-kapitelzeile">/);
  assert.match(html, /Variante claude/);
  assert.match(html, /Variante chatgpt/);
  assert.ok(!html.includes('<img src=x'), 'unescaped <img> im Ausgabe-HTML gefunden — XSS-Luecke');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /Beleg: Contract S\. 5/);
  assert.match(html, /Divergenz: entschieden/);
  assert.match(html, /Begr&uuml;ndung: Fachlich geklaert\./);
});

test('V5: jede Herkunft traegt ihre eigene Badge-Klasse (Katalogwert)', () => {
  const validiert = gelesenAus('DBS-001', 'claude', [
    { ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } },
    { ek: 'DBS-001-EK-002', validierung: { herkunft: 'korrigiert', beleg: 'x' } },
    { ek: 'DBS-001-EK-003', validierung: { herkunft: 'ergaenzt', beleg: 'y' } },
    { ek: 'DBS-001-EK-004', validierung: { herkunft: 'offen' } }
  ]);
  const props = { dossier: dossierMit([]), review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  ['bestaetigt', 'korrigiert', 'ergaenzt', 'offen'].forEach(function (k) {
    assert.match(html, new RegExp('class="badge badge-' + k + '"'), 'Badge-Klasse fuer ' + k + ' fehlt');
  });
});

test('V5: ein Kapitel ohne (oder mit unbekanntem) herkunft-Wert faellt auf die Badge "offen" zurueck', () => {
  const validiert = gelesenAus('DBS-001', 'claude', [{ ek: 'DBS-001-EK-001' }]); // kein ###VALIDIERUNG
  const props = { dossier: dossierMit([]), review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /class="badge badge-offen"/);
});

test('V5: die Gate-Box bleibt unveraendert UNTERHALB des Review-Blocks stehen', () => {
  const validiert = gelesenAus('DBS-001', 'claude',
    [{ ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } }]);
  const props = { dossier: dossierMit([]), review: { validiert: validiert, claude: null, chatgpt: null } };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /id="gate-block"/);
  assert.ok(html.indexOf('id="review-block"') >= 0 && html.indexOf('id="gate-block"') >= 0);
  assert.ok(html.indexOf('id="review-block"') < html.indexOf('id="gate-block"'),
    'Der Review-Block muss VOR der Gate-Box stehen');
});

/* ---------- controller.reviewNachladen (Cache, Nicht-sticky-Fehlerpfad, Muster dossiernachladen.test.js) ---------- */

function vorbereitenController() {
  state.position.kursId = 'DBS-001';
  state.position.schrittId = '4';
  state.data.inhalt = INHALT;
  state.data.review = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  global.document = undefined;   /* controller.render() muss auch ohne DOM auskommen */
}

test('reviewNachladen laedt validiert/claude/chatgpt getrennt und cacht das Ergebnis unter dem Kurs', async () => {
  vorbereitenController();
  const liefClaude = inhalt.lieferobjektVon(INHALT, '3', 'claude');
  const liefChatgpt = inhalt.lieferobjektVon(INHALT, '3', 'chatgpt');
  const lief4 = inhalt.ablageVon(INHALT, '4', 'DBS-001').lieferobjekt;

  graph.ordnerInhalt = function (kursId, ordner) {
    if (ordner === '04_validierung') return Promise.resolve([{ name: 'DBS-001_' + lief4 + '_v1.docx' }]);
    if (ordner === '03_content') {
      return Promise.resolve([
        { name: 'DBS-001_' + liefClaude + '_v2.docx' },
        { name: 'DBS-001_' + liefChatgpt + '_v1.docx' }
      ]);
    }
    return Promise.resolve([]);
  };
  graph.dateiLesen = function (kursId, ordner, datei) {
    if (datei === 'DBS-001_' + lief4 + '_v1.blocks') {
      return Promise.resolve(skriptText('DBS-001', 'claude',
        [{ ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } }]));
    }
    if (datei === 'DBS-001_' + liefClaude + '_v2.blocks') {
      return Promise.resolve(skriptText('DBS-001', 'claude', [{ ek: 'DBS-001-EK-001' }]));
    }
    if (datei === 'DBS-001_' + liefChatgpt + '_v1.blocks') {
      return Promise.resolve(skriptText('DBS-001', 'chatgpt', [{ ek: 'DBS-001-EK-001' }]));
    }
    return Promise.resolve(null);
  };

  await controller.reviewNachladen('DBS-001');

  const r = state.data.review['DBS-001'];
  assert.ok(r, 'kein Review-Objekt im Cache');
  assert.ok(r.validiert, 'validiert fehlt');
  assert.ok(r.claude, 'claude fehlt');
  assert.ok(r.chatgpt, 'chatgpt fehlt');
  assert.strictEqual(r.validiert.kapitel[0].ek, 'DBS-001-EK-001');
  assert.strictEqual(r.claude.skript.variante, 'claude');
  assert.strictEqual(r.chatgpt.skript.variante, 'chatgpt');
});

test('reviewNachladen: fehlt eine geltende Datei, ist genau dieser Slot null — die anderen bleiben unberuehrt', async () => {
  vorbereitenController();
  const lief4 = inhalt.ablageVon(INHALT, '4', 'DBS-001').lieferobjekt;
  graph.ordnerInhalt = function (kursId, ordner) {
    if (ordner === '04_validierung') return Promise.resolve([{ name: 'DBS-001_' + lief4 + '_v1.docx' }]);
    return Promise.resolve([]);   /* 03_content leer: keine der beiden Varianten liegt */
  };
  graph.dateiLesen = function (kursId, ordner, datei) {
    if (datei === 'DBS-001_' + lief4 + '_v1.blocks') {
      return Promise.resolve(skriptText('DBS-001', 'claude',
        [{ ek: 'DBS-001-EK-001', validierung: { herkunft: 'bestaetigt' } }]));
    }
    return Promise.resolve(null);
  };

  await controller.reviewNachladen('DBS-001');

  const r = state.data.review['DBS-001'];
  assert.ok(r.validiert, 'validiert haette trotz fehlender Varianten geladen werden sollen');
  assert.strictEqual(r.claude, null);
  assert.strictEqual(r.chatgpt, null);
});

test('reviewNachladen: Doppelabruf-Schutz — ein zweiter Aufruf waehrend des Ladens loest keine weiteren Netzzugriffe aus', async () => {
  vorbereitenController();
  let aufrufe = 0;
  const resolvers = [];
  graph.ordnerInhalt = function () {
    aufrufe++;
    return new Promise(function (res) { resolvers.push(res); });
  };
  graph.dateiLesen = function () { return Promise.resolve(null); };

  const p1 = controller.reviewNachladen('DBS-001');
  assert.strictEqual(state.data.review['DBS-001'], null, 'der Zwischenzustand null (laedt) fehlt');
  const anzahlNachErstemAufruf = aufrufe;

  controller.reviewNachladen('DBS-001');   /* Guard: !== undefined -> return, ohne Netzzugriff */
  assert.strictEqual(aufrufe, anzahlNachErstemAufruf,
    'ein zweiter Aufruf waehrend des Ladens hat erneut Netzzugriffe ausgeloest');

  resolvers.forEach(function (r) { r([]); });
  await p1;
});

test('reviewNachladen: ein Kettenfehler setzt fehlerHinweis, rendert und faellt danach auf undefined zurueck (I1-Muster)', async () => {
  vorbereitenController();
  graph.ordnerInhalt = function () { return Promise.reject(new Error('Netz weg')); };
  graph.dateiLesen = function () { return Promise.resolve(null); };

  await controller.reviewNachladen('DBS-001');

  assert.strictEqual(state.data.review['DBS-001'], undefined,
    'sticky null: ein erneuter Ansichtswechsel koennte nie wieder nachladen');
  assert.match(state.fehlerHinweis, /Review/);
});

test('reviewNachladen: nach einem Fehler ruft ein zweiter Aufruf tatsaechlich erneut ab', async () => {
  vorbereitenController();
  let aufrufe = 0;
  graph.ordnerInhalt = function () {
    aufrufe++;
    if (aufrufe <= 3) return Promise.reject(new Error('Netz weg'));   /* erster Versuch: alle drei Ladeblocks scheitern */
    return Promise.resolve([]);
  };
  graph.dateiLesen = function () { return Promise.resolve(null); };

  await controller.reviewNachladen('DBS-001');
  assert.strictEqual(state.data.review['DBS-001'], undefined,
    'nach dem Fehler muss der Zustand wieder undefined sein, sonst blockiert der Doppelabruf-Guard');

  await controller.reviewNachladen('DBS-001');
  assert.ok(aufrufe > 3, 'der zweite Aufruf haette erneut abfragen sollen — stattdessen sticky null/Guard');
  assert.ok(state.data.review['DBS-001'], 'der zweite Versuch haette ein Ergebnis-Objekt liefern sollen');
});
