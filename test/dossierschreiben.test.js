'use strict';
/* controller.dossierSchreiben — die Warteschlange fuer serialisiertes Dossier-Schreiben
   (Etappe 1e, Task 1, Audit C1/I5/I8). Vier heutige Schreibstellen (dossierSpeichern,
   quelleErfassen, quelleEntfernen, contentModus) plus der Schritt-1-Zweig von ablegen
   riefen alle unkoordiniert graph.ablegen — zwei gleichzeitige Sicherungen konnten
   sich gegenseitig ueberschreiben (Lost Update). Diese Warteschlange serialisiert je
   Kurs: der Mutator bekommt eine frische Kopie des Dossiers ZUM AUSFUEHRUNGSZEITPUNKT,
   nicht zum Klickzeitpunkt. Bei HTTP 412 (If-Match schlaegt fehl) wird einmal frisch
   gelesen und der Mutator einmal erneut angewandt. Kein Netz noetig: graph.ablegen und
   graph.dateiLesenGenau werden ueberschrieben. */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state, graph } = require('../app.js');
require('../dossier.js');
/* Z4: _dossierVersuch stempelt seit dieser Task auch scope_quelle ueber
   root.inhalt.briefingFeld('scope_quelle') — ohne diesen Require waere
   root.inhalt in diesem Testprozess undefined (Muster wie in
   dossierspeichern.test.js/quelleerfassen.test.js). */
require('../inhalt.js');

function dossierMit(offen) {
  return { dossier: 1, kurs: 'DBS-001', stand: null, scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: offen || [], entschieden: [] };
}

function deferred() {
  var resolve, reject;
  var promise = new Promise(function (res, rej) { resolve = res; reject = rej; });
  return { promise: promise, resolve: resolve, reject: reject };
}

function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

test('zwei ueberlappende Aufrufe: der zweite Mutator sieht das Ergebnis des ersten (kein Lost Update)', async () => {
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  const schreibversuche = [];

  graph.ablegen = function (kursId, ordner, datei, text, eTagWert) {
    const d = deferred();
    schreibversuche.push({ kursId: kursId, ordner: ordner, datei: datei, text: text,
      eTagWert: eTagWert, resolve: d.resolve });
    return d.promise;
  };

  const p1 = controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('A'); return d; });
  const p2 = controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('B'); return d; });

  await tick();
  assert.strictEqual(schreibversuche.length, 1,
    'der zweite Aufruf hat parallel geschrieben, statt auf den ersten zu warten');
  assert.deepStrictEqual(JSON.parse(schreibversuche[0].text).offen, ['A']);

  schreibversuche[0].resolve({ eTag: 'W/"1"' });
  await p1;
  await tick();

  assert.strictEqual(schreibversuche.length, 2, 'der zweite Aufruf ist nach dem ersten nicht gestartet');
  assert.deepStrictEqual(JSON.parse(schreibversuche[1].text).offen, ['A', 'B'],
    'der zweite Mutator sah nicht das Ergebnis des ersten — Lost Update');
  assert.strictEqual(schreibversuche[1].eTagWert, 'W/"1"',
    'der zweite Schreibversuch nutzte nicht den frisch gemerkten eTag');

  schreibversuche[1].resolve({ eTag: 'W/"2"' });
  await p2;

  assert.deepStrictEqual(state.data.dossier['DBS-001'].offen, ['A', 'B']);
  assert.strictEqual(state.data.dossierETag['DBS-001'], 'W/"2"');
});

test('412 (If-Match schlaegt fehl): frisch lesen, Mutator einmal erneut anwenden, dann Erfolg', async () => {
  state.data.dossier = { 'DBS-001': dossierMit(['lokal-vorher']) };
  state.data.dossierETag = { 'DBS-001': 'W/"1"' };

  let anzahlAblegen = 0;
  const gesendeteEtags = [];
  graph.ablegen = function (kursId, ordner, datei, text, eTagWert) {
    anzahlAblegen++;
    gesendeteEtags.push(eTagWert);
    if (anzahlAblegen === 1) {
      const fehler = new Error('Nicht abgelegt (Graph 412)');
      fehler.status = 412;
      return Promise.reject(fehler);
    }
    return Promise.resolve({ eTag: 'W/"2"' });
  };
  graph.dateiLesenGenau = function () {
    return Promise.resolve({ ok: true, text: JSON.stringify(dossierMit(['extern'])), eTag: 'W/"neu"' });
  };

  let mutatorAufrufe = 0;
  const meldungen = [];
  const ergebnis = await controller.dossierSchreiben('DBS-001', function (d) {
    mutatorAufrufe++;
    d.offen.push('lokal');
    return d;
  }, function (t) { meldungen.push(t); });

  assert.strictEqual(anzahlAblegen, 2, 'nach 412 folgte kein zweiter Schreibversuch');
  assert.strictEqual(mutatorAufrufe, 2, 'der Mutator wurde nicht ein zweites Mal angewandt');
  assert.strictEqual(gesendeteEtags[1], 'W/"neu"', 'der zweite Versuch nutzte nicht den frisch gelesenen eTag');
  assert.deepStrictEqual(ergebnis.offen, ['extern', 'lokal'],
    'der zweite Mutator-Lauf sah nicht den frisch gelesenen Stand');
  assert.deepStrictEqual(state.data.dossier['DBS-001'].offen, ['extern', 'lokal']);
  assert.strictEqual(state.data.dossierETag['DBS-001'], 'W/"2"');
  assert.ok(meldungen.length, 'melde wurde beim Konflikt nicht aufgerufen');
});

test('zwei 412 in Folge: nach dem einmaligen Wiederholen wird der Fehler weitergereicht', async () => {
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = { 'DBS-001': 'W/"1"' };

  graph.ablegen = function () {
    const fehler = new Error('Nicht abgelegt (Graph 412)');
    fehler.status = 412;
    return Promise.reject(fehler);
  };
  let neuGelesen = 0;
  graph.dateiLesenGenau = function () {
    neuGelesen++;
    return Promise.resolve({ ok: true, text: JSON.stringify(dossierMit([])), eTag: 'W/"neu"' });
  };

  await assert.rejects(
    () => controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('X'); return d; }),
    /412/
  );
  assert.strictEqual(neuGelesen, 1, 'der Mutator haette nur einmal erneut versucht werden duerfen');
});

test('Mutator gibt null zurueck: kein PUT, State und eTag bleiben unveraendert', async () => {
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = { 'DBS-001': 'W/"1"' };
  let aufgerufen = false;
  graph.ablegen = function () { aufgerufen = true; return Promise.resolve({ eTag: 'W/"x"' }); };

  const ergebnis = await controller.dossierSchreiben('DBS-001', function () { return null; });

  assert.strictEqual(aufgerufen, false, 'graph.ablegen wurde trotz Abbruch durch den Mutator aufgerufen');
  assert.strictEqual(ergebnis, null);
  assert.deepStrictEqual(state.data.dossier['DBS-001'].offen, []);
  assert.strictEqual(state.data.dossierETag['DBS-001'], 'W/"1"', 'der eTag wurde trotz Abbruch veraendert');
});

test('Fehler beim Schreiben (kein 412): State bleibt unveraendert, melde wird aufgerufen, Fehler geht an den Aufrufer', async () => {
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = { 'DBS-001': 'W/"1"' };
  graph.ablegen = function () { return Promise.reject(new Error('Graph 500')); };
  const meldungen = [];

  await assert.rejects(
    () => controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('X'); return d; },
      function (t) { meldungen.push(t); }),
    /Graph 500/
  );

  assert.deepStrictEqual(state.data.dossier['DBS-001'].offen, [], 'der State wurde trotz gescheitertem Schreiben veraendert');
  assert.strictEqual(state.data.dossierETag['DBS-001'], 'W/"1"', 'der eTag wurde trotz gescheitertem Schreiben veraendert');
  assert.ok(meldungen.some(function (t) { return /Graph 500/.test(t); }), 'melde wurde nicht mit der Fehlermeldung aufgerufen');
});

test('ein Fehler im ersten Aufruf blockiert die Warteschlange nicht fuer den naechsten Kurs-Aufruf', async () => {
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  let anruf = 0;
  graph.ablegen = function (kursId, ordner, datei, text) {
    anruf++;
    if (anruf === 1) return Promise.reject(new Error('Graph 500'));
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await assert.rejects(
    () => controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('scheitert'); return d; }),
    /Graph 500/
  );

  const ergebnis = await controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('klappt'); return d; });

  assert.deepStrictEqual(ergebnis.offen, ['klappt'],
    'der zweite Aufruf haette gegen den unveraenderten Stand laufen muessen, nicht haengen bleiben');
  assert.deepStrictEqual(state.data.dossier['DBS-001'].offen, ['klappt']);
});

/* Mutationsprobe (Etappe 2, Task 3): die Zeile "root.dossier.identitaetSetzen(neu,
   kursObj);" in _dossierVersuch auskommentiert — `node --test` blieb dabei komplett
   gruen, 471/471, kein einziger Test rot. Deshalb dieser eigene Test: er haelt genau
   die Zeile fest, die sonst durch nichts geschuetzt war. */
test('_dossierVersuch stempelt identitaet aus state.data.kurse in JEDES Schreiben (Etappe 2, Task 3)', async () => {
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.data.kurse = [{ id: '1', kursId: 'DBS-001', kurstitel: 'Derivate Basis',
    kompetenzfeld: 'Vermögen & Vorsorge', schritt: 1, status: 'offen', prio: null, bemerkung: '' }];
  const schreibversuche = [];
  graph.ablegen = function (kursId, ordner, datei, text) {
    schreibversuche.push(text);
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.dossierSchreiben('DBS-001', function (d) { return d; });

  assert.strictEqual(schreibversuche.length, 1);
  const geschrieben = JSON.parse(schreibversuche[0]);
  assert.deepStrictEqual(geschrieben.identitaet, { titel: 'Derivate Basis', kompetenzfeld: 'Vermögen & Vorsorge' });
  assert.deepStrictEqual(state.data.dossier['DBS-001'].identitaet,
    { titel: 'Derivate Basis', kompetenzfeld: 'Vermögen & Vorsorge' });
});

/* ---------- Z4: scope_quelle wird bei JEDEM Schreiben zentral gestempelt ----------
   Zusatzauftrag 2026-07-30 Punkt 6, Entscheid Markus: "Jede hinterlegte Quelle ist
   Scope." Dasselbe Muster wie identitaetSetzen direkt darueber: EINE Stelle
   (_dossierVersuch), durch die jedes Dossier-Schreiben laeuft, ueberschreibt
   d.scope.scope_quelle mit inhalt.briefingFeld('scope_quelle').abgeleitet(d) —
   unabhaengig davon, was der Mutator selbst tat. Ein Handwert (z. B. aus einem
   Alt-Dossier oder dem Einmal-Import von {K}_briefing-felder.md) wird dabei
   ueberschrieben: genau die Fehlerklasse, die an VL-002 live beobachtet wurde
   (ein getippter Bereich "Q-001 bis Q-014" veraltete still, als Q-015 dazukam). */
test('_dossierVersuch stempelt scope_quelle aus dem Quellenbestand in JEDES Schreiben (Z4)', async () => {
  state.data.dossier = {
    'DBS-001': Object.assign(dossierMit([]), {
      scope: { scope_quelle: 'Q-001 bis Q-014' },   /* Handwert, wie an VL-002 gefunden */
      quellen: [{ id: 'Q-001' }, { id: 'Q-002' }, { id: 'Q-015' }]
    })
  };
  state.data.dossierETag = {};
  const schreibversuche = [];
  graph.ablegen = function (kursId, ordner, datei, text) {
    schreibversuche.push(text);
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.dossierSchreiben('DBS-001', function (d) { return d; });

  assert.strictEqual(schreibversuche.length, 1);
  const geschrieben = JSON.parse(schreibversuche[0]);
  /* Fix-Runde Z4: Aufzaehlung mit Zaehler statt Bereich — die Fixture traegt
     bewusst eine Luecke (Q-002 → Q-015), damit ein "bis" hier sofort auffiele. */
  assert.strictEqual(geschrieben.scope.scope_quelle,
    'Der erfasste Quellenbestand ist der Scope: Q-001, Q-002, Q-015 (3 Quellen).',
    'der Handwert haette durch den abgeleiteten Wert ersetzt werden muessen');
  assert.strictEqual(state.data.dossier['DBS-001'].scope.scope_quelle,
    'Der erfasste Quellenbestand ist der Scope: Q-001, Q-002, Q-015 (3 Quellen).');
});

/* Mutationsprobe (tatsaechlich durchgefuehrt): den scope_quelle-Stempel-Block
   in _dossierVersuch auskommentiert (die drei Zeilen ab
   "if (scopeQuelleFeld && scopeQuelleFeld.abgeleitet)") —
   `node --test test/dossierschreiben.test.js` fiel bei GENAU diesem einen Test
   rot:
     ✖ _dossierVersuch stempelt scope_quelle aus dem Quellenbestand in JEDES Schreiben (Z4)
       AssertionError [ERR_ASSERTION]: der Handwert haette durch den abgeleiteten Wert ersetzt werden muessen
       + actual - expected
       + 'Q-001 bis Q-014'
       - 'Der erfasste Quellenbestand ist der Scope: Q-001, Q-002, Q-015 (3 Quellen).'
       ℹ tests 11
       ℹ pass 10
       ℹ fail 1
   Danach wiederhergestellt, wieder 11/11 in dieser Datei. (Testkommentar-Fix,
   Reviewer-Hinweis Fix-Runde Z4: die vorherige Fassung dieses Kommentars nannte
   faelschlich "550/550 gesamt" — die tatsaechliche Gesamtzahl steht am Ende
   dieser Datei bzw. im CLAUDE.md-Abschnitt "Task Z4"/"Fix-Runde Z4", nicht
   hier dupliziert, um genau dieses Auseinanderlaufen kuenftig zu vermeiden.) */

/* ---------- Etappe 2, Task 7: Dossier-Erstanlage mit conflictBehavior=fail ----------
   Bisher schrieb der allererste Schreiber (kein eTag im State — Datei nie geladen oder
   noch gar nicht angelegt) unbedingt, ohne If-Match: zwei Sitzungen, die gleichzeitig
   zum ersten Mal ein Dossier fuer denselben Kurs anlegen, konnten sich gegenseitig
   ueberschreiben (CLAUDE.md „Offen": Restluecke ausserhalb des behobenen Lost-Update).
   _dossierVersuch gibt jetzt nurNeu=true mit, wenn kein eTag da ist — graph.ablegen
   haengt dann '?@microsoft.graph.conflictBehavior=fail' an, Graph antwortet 409, wenn
   die Datei inzwischen von woanders angelegt wurde. Die Wiederholung laeuft ueber
   denselben Mechanismus wie 412: einmal frisch lesen, Mutator einmal erneut anwenden —
   danach mit dem frisch gelesenen eTag, also nicht mehr nurNeu. */

test('Erstanlage (kein Dossier im State) ruft graph.ablegen mit nurNeu === true auf', async () => {
  state.data.dossier = {};
  state.data.dossierETag = {};
  let gesehenEtag, gesehenNurNeu;
  graph.ablegen = function (kursId, ordner, datei, text, eTagWert, nurNeu) {
    gesehenEtag = eTagWert;
    gesehenNurNeu = nurNeu;
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('A'); return d; });

  assert.strictEqual(gesehenEtag, undefined, 'die Erstanlage haette keinen eTag mitgeben duerfen');
  assert.strictEqual(gesehenNurNeu, true, 'die Erstanlage haette nurNeu=true mitgeben muessen');
});

test('409 bei der Erstanlage (zwei gleichzeitige erste Schreiber): frisch lesen, Mutator einmal erneut anwenden, dann Erfolg mit eTag', async () => {
  state.data.dossier = {};
  state.data.dossierETag = {};

  let anzahlAblegen = 0;
  const gesendeteNurNeu = [];
  const gesendeteEtags = [];
  graph.ablegen = function (kursId, ordner, datei, text, eTagWert, nurNeu) {
    anzahlAblegen++;
    gesendeteEtags.push(eTagWert);
    gesendeteNurNeu.push(nurNeu);
    if (anzahlAblegen === 1) {
      const fehler = new Error('Nicht abgelegt (Graph 409)');
      fehler.status = 409;
      return Promise.reject(fehler);
    }
    return Promise.resolve({ eTag: 'W/"2"' });
  };
  graph.dateiLesenGenau = function () {
    return Promise.resolve({ ok: true, text: JSON.stringify(dossierMit(['extern'])), eTag: 'W/"neu"' });
  };

  let mutatorAufrufe = 0;
  const ergebnis = await controller.dossierSchreiben('DBS-001', function (d) {
    mutatorAufrufe++;
    d.offen.push('lokal');
    return d;
  });

  assert.strictEqual(anzahlAblegen, 2, 'nach 409 folgte kein zweiter Schreibversuch');
  assert.strictEqual(mutatorAufrufe, 2, 'der Mutator wurde nicht ein zweites Mal angewandt');
  assert.strictEqual(gesendeteNurNeu[0], true, 'der erste Versuch (Erstanlage) haette nurNeu=true senden muessen');
  assert.strictEqual(gesendeteEtags[1], 'W/"neu"', 'der zweite Versuch nutzte nicht den frisch gelesenen eTag');
  assert.deepStrictEqual(ergebnis.offen, ['extern', 'lokal'],
    'der zweite Mutator-Lauf sah nicht den frisch gelesenen Stand');
  assert.deepStrictEqual(state.data.dossier['DBS-001'].offen, ['extern', 'lokal']);
  assert.strictEqual(state.data.dossierETag['DBS-001'], 'W/"2"');
});

test('je Kurs eine eigene Warteschlange — zwei verschiedene Kurse laufen unabhaengig', async () => {
  state.data.dossier = { 'DBS-001': dossierMit([]), 'AFL-001': dossierMit([]) };
  state.data.dossierETag = {};
  const laeuft = [];
  graph.ablegen = function (kursId, ordner, datei, text) {
    laeuft.push(kursId);
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await Promise.all([
    controller.dossierSchreiben('DBS-001', function (d) { d.offen.push('D'); return d; }),
    controller.dossierSchreiben('AFL-001', function (d) { d.offen.push('A'); return d; })
  ]);

  assert.deepStrictEqual(state.data.dossier['DBS-001'].offen, ['D']);
  assert.deepStrictEqual(state.data.dossier['AFL-001'].offen, ['A']);
});
