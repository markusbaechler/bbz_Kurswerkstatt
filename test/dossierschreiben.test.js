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
