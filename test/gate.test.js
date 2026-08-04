'use strict';
/* Gate-Box-Controller (Etappe 2, Task 5): offen[]/entschieden[] sitzen im Dossier
   (Meta-Spec §3.2, Entscheid Markus 2026-07-30) — offenErfassen haengt einen Punkt an
   ein Gate oder einen Schritt, offenEntscheiden/offenVerschieben setzen ihn um. Alle
   drei schreiben ueber controller.dossierSchreiben (dieselbe Warteschlange wie
   quelleErfassen/quelleEntfernen). Kein Netz noetig: graph.ablegen wird ueberschrieben.

   Identitaets-Guard (Pflicht laut Task-Brief): der Index eines offenen Punkts kann sich
   zwischen Render und Ausfuehrung der Warteschlange verschoben haben (ein anderer Klick,
   ein 412-Retry). offenEntscheiden/offenVerschieben vergleichen deshalb das am Knopf
   mitgegebene data-was mit d.offen[index].was VOR dem eigentlichen Schreiben — stimmt es
   nicht mehr, bricht der Mutator mit null ab (kein PUT), statt am falschen Eintrag zu
   aendern. */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state, graph, auth } = require('../app.js');
require('../dossier.js');
require('../inhalt.js');
const { INHALT } = require('./fixture.js');

/* graph ist ein einziges, geteiltes Objekt ueber die ganze Datei — jeder Test, der
   graph.umbenennen durch eine Fake-Funktion ersetzt (Muster ueberall unten), ueberschreibt
   sie fuer JEDEN folgenden Test, bis sie explizit zurueckgesetzt wird. Die echte
   Implementierung wird deshalb hier, vor dem ersten ueberschreibenden Test, gesichert —
   der F2-Cache-Test unten braucht genau sie. */
const echteUmbenennen = graph.umbenennen;

function dossierMit(offen) {
  return { dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: offen || [], entschieden: [] };
}

function setzeKurs() {
  state.data.kurse = [{ id: '1', kursId: 'DBS-001', kurstitel: 'Derivate Basis',
    kompetenzfeld: 'Vermögen & Vorsorge', schritt: 2, status: 'inArbeit', prio: null, bemerkung: '' }];
  state.position.kursId = 'DBS-001';
}

function els(werte) {
  const melde = { hidden: true, textContent: '' };
  const felder = Object.assign({ 'offen-melde': melde }, werte || {});
  global.document = {
    getElementById: function (id) { return felder[id] || null; },
    querySelectorAll: function () { return []; }
  };
  return melde;
}

/* ---------- gateKlick (Etappe 2, Task 6): _final, _gate.md, Dossier-Status final ----------
   Schritt 2 des Fixture-Kontrakts fuehrt ein echtes Gate (Gate 1 · 4-Augen, Ordner
   02_lernziele, Lieferobjekt lernziele-drehbuch, Endung xlsx) — genau der Fall, den
   inhalt.gateAdressat(2) auf 'gate-1' abbildet. setzeKursMitInhalt() ergaenzt setzeKurs()
   um ein geladenes state.data.inhalt, das gateKlick fuer ablageVon/gateAdressat/
   geltendeDatei/finalName braucht — die Gate-Box-Tests oben brauchten das nie, weil
   offenErfassen & Co. nie in den Ablage-Kontrakt schauen. */

function setzeKursMitInhalt() {
  setzeKurs();
  state.data.inhalt = JSON.parse(JSON.stringify(INHALT));
  state.data.dateien = {};
  /* Der Lauf-Merker (F3, Fix-Runde 1) lebt in state, nicht pro Test — ohne diesen
     Reset koennte ein Merker aus einem vorigen Test (z. B. bei einer geworfenen
     Assertion) den naechsten Test faelschlich als "laeuft schon" blockieren. */
  state.gateLaeuft = {};
}

/* radios (Z9): das Fake-Dokument beantwortet querySelectorAll('[name="gate-version"]')
   mit den mitgegebenen Radio-Objekten ({ value, checked }) — controller.gateKlick liest
   darueber die GEWAEHLTE Fassung, statt automatisch die hoechste (inhalt.geltendeDatei)
   zu nehmen. Ohne radios-Argument bleibt querySelectorAll leer (kein DOM-Radio gefunden),
   was denselben Fehlerfall wie zuvor "keine versionierte Datei" ausloest. */
function elsGate(werte, radios) {
  const melde = { hidden: true, textContent: '' };
  const felder = Object.assign({ 'gate-melde': melde }, werte || {});
  global.document = {
    getElementById: function (id) { return felder[id] || null; },
    querySelectorAll: function (sel) {
      if (sel === '[name="gate-version"]') return radios || [];
      return [];
    }
  };
  return melde;
}

function radioGewaehlt(datei) {
  return [{ value: datei, checked: true }];
}

test('gateKlick ohne geladenes Dossier bricht ab, kein Netzzugriff', () => {
  setzeKursMitInhalt();
  state.data.dossier = {};
  state.fehlerHinweis = null;
  const melde = elsGate({});
  let gerufen = false;
  graph.ordnerInhalt = function () { gerufen = true; return Promise.resolve([]); };

  controller.gateKlick('2', { disabled: false });

  assert.strictEqual(gerufen, false, 'trotz ungeladenem Dossier wurde der Ordner gelesen');
  assert.match(melde.textContent, /nicht geladen/);
  assert.match(state.fehlerHinweis || '', /nicht geladen/);
  delete global.document;
});

test('gateKlick mit einem offenen Punkt an diesem Gate blockiert ohne jeden Graph-Aufruf (S2)', () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }]) };
  state.fehlerHinweis = null;
  const melde = elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  let gerufen = false;
  graph.ordnerInhalt = function () { gerufen = true; return Promise.resolve([]); };

  controller.gateKlick('2', { disabled: false });

  assert.strictEqual(gerufen, false, 'trotz offenem Punkt wurde der Ordner gelesen');
  assert.match(melde.textContent, /Offene Punkte/);
  assert.match(state.fehlerHinweis || '', /Offene Punkte/);
  delete global.document;
});

test('gateKlick ohne "Freigabe erteilt durch" blockiert, kein Graph-Aufruf (Z9: die 4-Augen-Zweitpruefung, Feld-Id gate-zweitpruefung bleibt)', () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  const melde = elsGate({ 'gate-zweitpruefung': { value: '' } });
  let gerufen = false;
  graph.ordnerInhalt = function () { gerufen = true; return Promise.resolve([]); };

  controller.gateKlick('2', { disabled: false });

  assert.strictEqual(gerufen, false, 'trotz fehlender Freigabe-durch-Angabe wurde der Ordner gelesen');
  assert.match(melde.textContent, /Freigabe.*fehlt/);
  delete global.document;
});

test('voller Durchlauf: Protokoll ablegen -> umbenennen -> Dossier-Status final, genau in dieser Reihenfolge (Fix-Runde 1: Reihenfolge umgekehrt)', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_lernziele-drehbuch_v3.xlsx'));
  controller._bestaetige = function () { return true; };

  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) {
    rufe.push({ art: 'umbenennen', kursId: kursId, ordner: ordner, von: von, nach: nach });
    return Promise.resolve(nach);
  };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ art: 'ablegen', kursId: kursId, ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(rufe.length, 3, 'erwartet: Protokoll ablegen, umbenennen, Dossier ablegen — ' + JSON.stringify(rufe));
  assert.strictEqual(rufe[0].art, 'ablegen', 'das Protokoll muss VOR der Umbenennung geschrieben werden (Fix-Runde 1)');
  assert.strictEqual(rufe[0].ordner, '02_lernziele');
  assert.strictEqual(rufe[0].datei, '_gate.md');
  assert.match(rufe[0].text, /^# Gate 1 · 4-Augen — DBS-001/);
  assert.match(rufe[0].text, /Freigegeben:  DBS-001_lernziele-drehbuch_v3\.xlsx/);
  assert.match(rufe[0].text, /Umbenannt in: DBS-001_lernziele-drehbuch_final\.xlsx/);
  assert.strictEqual(rufe[1].art, 'umbenennen');
  assert.strictEqual(rufe[1].ordner, '02_lernziele');
  assert.strictEqual(rufe[1].von, 'DBS-001_lernziele-drehbuch_v3.xlsx');
  assert.strictEqual(rufe[1].nach, 'DBS-001_lernziele-drehbuch_final.xlsx');
  assert.strictEqual(rufe[2].art, 'ablegen');
  assert.strictEqual(rufe[2].ordner, '', 'der Dossier-Schreiber legt in der Kursordner-Wurzel ab');
  const dossierGeschrieben = JSON.parse(rufe[2].text);
  assert.strictEqual(dossierGeschrieben.status['lernziele-drehbuch'], 'final');
  assert.strictEqual(state.data.dossier['DBS-001'].status['lernziele-drehbuch'], 'final',
    'der State wurde nach dem Schreiben nicht aktualisiert');
  assert.match(state.hinweis || '', /Als final best.tigt.*DBS-001_lernziele-drehbuch_final\.xlsx/,
    'die Erfolgsmeldung muss den _final-Dateinamen nennen (Z9)');
  delete global.document;
});

/* ---------- Z9: gateKlick benennt die GEWAEHLTE Fassung um, nicht automatisch die hoechste ----------
   Mutationsprobe-Anker: ohne die Radio-Auswahl (liest man z. B. wieder
   inhalt.geltendeDatei() statt document.querySelectorAll('[name="gate-version"]'))
   wuerde dieser Test rot, weil er absichtlich NICHT die hoechste Fassung waehlt. */
test('Z9: bei mehreren Fassungen wird die GEWAEHLTE (nicht die hoechste) umbenannt', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  /* v3 gewaehlt, obwohl v5 (hoeher) ebenfalls im Ordner liegt. */
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_lernziele-drehbuch_v3.xlsx'));
  controller._bestaetige = function () { return true; };
  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_lernziele-drehbuch_v3.xlsx' },
      { name: 'DBS-001_lernziele-drehbuch_v4.xlsx' },
      { name: 'DBS-001_lernziele-drehbuch_v5.xlsx' }
    ]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) {
    rufe.push({ art: 'umbenennen', von: von, nach: nach });
    return Promise.resolve(nach);
  };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ art: 'ablegen', datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  const umbenennung = rufe.filter(function (r) { return r.art === 'umbenennen'; })[0];
  assert.ok(umbenennung, 'graph.umbenennen wurde nicht aufgerufen — ' + JSON.stringify(rufe));
  assert.strictEqual(umbenennung.von, 'DBS-001_lernziele-drehbuch_v3.xlsx',
    'die GEWAEHLTE Fassung (v3) haette umbenannt werden muessen, nicht die hoechste (v5)');
  assert.strictEqual(umbenennung.nach, 'DBS-001_lernziele-drehbuch_final.xlsx');
  const protokoll = rufe.filter(function (r) { return r.datei === '_gate.md'; })[0];
  assert.match(protokoll.text, /Freigegeben:  DBS-001_lernziele-drehbuch_v3\.xlsx/,
    'das Protokoll muss die GEWAEHLTE Fassung als "von" nennen');
  delete global.document;
});

test('Z9: ohne angehaktes Radio (kein DOM-Fund) bricht gateKlick mit derselben Fehlermeldung wie zuvor "keine versionierte Datei" ab', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.fehlerHinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });   /* keine radios mitgegeben */
  controller._bestaetige = function () { return true; };
  let geschrieben = false;
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }]);
  };
  graph.umbenennen = function () { geschrieben = true; return Promise.resolve(); };
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(geschrieben, false, 'trotz fehlender Auswahl wurde geschrieben');
  assert.match(state.fehlerHinweis || '', /keine Fassung ausgew.hlt/);
  delete global.document;
});

/* ---------- Fix-Runde Z9 (Review-Finding, Important): gewaehlt wird gegen die FRISCH
   gelesene Ordnerliste validiert ---------- */

test('Fix-Runde Z9: die Radio-Auswahl (Render-Zeitpunkt) existiert nicht mehr im frisch gelesenen Ordner — Abbruch OHNE Protokoll/Umbenennung, Merker frei', async () => {
  setzeKursMitInhalt();
  /* Szene aus dem Review: das Radio zeigt noch v5 (Stand beim Rendern), eine zweite
     Person hat die Datei zwischenzeitlich bereits umbenannt/geloescht — der frisch
     gelesene Ordner fuehrt nur noch v6 (kein _final, sonst waere final=true und dieser
     Zweig gar nicht erreicht). */
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_lernziele-drehbuch_v5.xlsx'));
  controller._bestaetige = function () { return true; };
  let ablegenGerufen = false;
  let umbenennenGerufen = false;
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_v6.xlsx' }]);
  };
  graph.ablegen = function () { ablegenGerufen = true; return Promise.resolve({ eTag: 'W/"1"' }); };
  graph.umbenennen = function () { umbenennenGerufen = true; return Promise.resolve(); };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(ablegenGerufen, false,
    'trotz veralteter Auswahl wurde ein Protokoll (oder ein Dossier-Schreiben) abgelegt');
  assert.strictEqual(umbenennenGerufen, false, 'trotz veralteter Auswahl wurde umbenannt');
  assert.match(state.fehlerHinweis || '', /gew.hlte Fassung DBS-001_lernziele-drehbuch_v5\.xlsx liegt nicht mehr im Ordner/);
  assert.strictEqual(state.gateLaeuft['DBS-001/2'], undefined,
    'der Lauf-Merker wurde nach dem Abbruch nicht wieder geloescht');
  delete global.document;
});

/* ---------- Fix-Runde 1: F2 — eine stale _gate.md unterdrueckt nie ein neues Protokoll ---------- */

test('F2: eine stale _gate.md von einem frueheren, von Hand zurueckgestuften Zyklus wird NICHT als bereits erledigt gewertet — das Protokoll wird neu geschrieben', async () => {
  setzeKursMitInhalt();
  /* Szenario aus CLAUDE.md ("Wer nach der Freigabe weiterarbeiten muss, setzt _final von
     Hand zurueck"): die Person hat _final manuell auf _v4 zurueckgestuft und weitergearbeitet.
     Die ALTE _gate.md vom vorigen, bereits abgeschlossenen Zyklus liegt unveraendert noch im
     Ordner — sie nennt die falsche, veraltete Version. */
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_lernziele-drehbuch_v4.xlsx'));
  controller._bestaetige = function () { return true; };
  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_lernziele-drehbuch_v4.xlsx' },
      { name: '_gate.md' }   /* stale, vom vorigen Zyklus */
    ]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) {
    rufe.push({ art: 'umbenennen', von: von, nach: nach });
    return Promise.resolve(nach);
  };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ art: 'ablegen', ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  const protokollAufrufe = rufe.filter(function (r) { return r.art === 'ablegen' && r.datei === '_gate.md'; });
  assert.strictEqual(protokollAufrufe.length, 1,
    'die stale _gate.md haette NICHT dazu fuehren duerfen, dass ein neues Protokoll uebersprungen wird — ' +
    JSON.stringify(rufe));
  assert.match(protokollAufrufe[0].text, /Freigegeben:  DBS-001_lernziele-drehbuch_v4\.xlsx/,
    'das neue Protokoll muss die AKTUELLE Version nennen, nicht die alte');
  assert.strictEqual(rufe.filter(function (r) { return r.art === 'umbenennen'; }).length, 1);
  delete global.document;
});

test('F2: graph.umbenennen (echte Implementierung) leert den Dateien-Cache wie graph.ablegen/dateiLoeschen', async () => {
  graph.umbenennen = echteUmbenennen;   /* frueheren Test-Fakes zum Trotz die echte Funktion */
  graph.driveId = function () { return Promise.resolve('DID'); };
  graph.kursOrdner = function () { return Promise.resolve({ id: 'ORD' }); };
  auth.token = function () { return Promise.resolve('TOKEN'); };
  global.fetch = function () { return Promise.resolve({ ok: true }); };
  state.data.dateien['DBS-001/02_lernziele'] = ['irgendwas'];

  const neu = await graph.umbenennen('DBS-001', '02_lernziele', 'alt.xlsx', 'neu.xlsx');

  assert.strictEqual(neu, 'neu.xlsx');
  assert.strictEqual('DBS-001/02_lernziele' in state.data.dateien, false,
    'der Dateien-Cache fuer diesen Ordner haette nach der Umbenennung geleert werden muessen');
  delete global.fetch;
});

/* ---------- Fix-Runde 1: F3 — Lauf-Merker gegen einen zweiten, ueberlappenden Klick ---------- */

test('F3: ein zweiter Klick waehrend ein Lauf noch aktiv ist loest keinen zweiten Graph-Aufruf aus', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  controller._bestaetige = function () { return true; };
  let ordnerInhaltAufrufe = 0;
  let geloest;
  graph.ordnerInhalt = function () {
    ordnerInhaltAufrufe++;
    return new Promise(function (resolve) { geloest = resolve; });
  };
  graph.umbenennen = function (kursId, ordner, von, nach) { return Promise.resolve(nach); };
  graph.ablegen = function () { return Promise.resolve({ eTag: 'W/"1"' }); };

  const erster = controller.gateKlick('2', { disabled: false });
  /* Ein zweiter Klick, waehrend der erste noch auf graph.ordnerInhalt wartet — genau die
     Szene aus dem Review-Finding: ein Zwischen-Render koennte den Knopf wieder enabled
     zeigen, bevor der erste Lauf fertig ist. */
  const melde2 = elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } },
    radioGewaehlt('DBS-001_lernziele-drehbuch_v3.xlsx'));
  controller.gateKlick('2', { disabled: false });

  assert.strictEqual(ordnerInhaltAufrufe, 1,
    'ein zweiter, ueberlappender Lauf hat einen zweiten Graph-Aufruf ausgeloest');
  assert.match(melde2.textContent, /Gate läuft/);

  geloest([{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }]);
  await erster;
  assert.strictEqual(state.gateLaeuft['DBS-001/2'], undefined,
    'der Lauf-Merker wurde nach Abschluss nicht wieder geloescht');
  delete global.document;
});

test('bricht die Person die Bestaetigung ab, wird nichts geschrieben und keine Erfolgsmeldung gezeigt', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_lernziele-drehbuch_v3.xlsx'));
  controller._bestaetige = function () { return false; };
  let geschrieben = false;
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }]);
  };
  graph.umbenennen = function () { geschrieben = true; return Promise.resolve(); };
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(geschrieben, false, 'trotz abgebrochener Bestaetigung wurde geschrieben');
  assert.strictEqual(state.hinweis, null, 'trotz Abbruch wurde eine Erfolgsmeldung gesetzt');
  assert.strictEqual(state.gateLaeuft['DBS-001/2'], undefined,
    'der Lauf-Merker wurde nach einem Abbruch der Bestaetigung nicht wieder geloescht');
  controller._bestaetige = function () { return true; };
  delete global.document;
});

/* ---------- A-1 (finale Fix-Welle Etappe 2): laufBeenden() im .catch-Zweig ----------
   Ohne diesen Test blieben alle Tests gruen, wenn laufBeenden() aus dem .catch entfernt
   wuerde (per Mutationsprobe belegt) — ein Netzfehler haette dann state.gateLaeuft fuer
   die restliche Sitzung gesperrt gelassen, denn F3 prueft den Merker VOR jedem weiteren
   Graph-Aufruf. Der Test wirft einen echten Fehler aus graph.ordnerInhalt und prueft
   danach (1) den Merker ist wieder frei, (2) ein zweiter Klick erreicht wieder
   graph.ordnerInhalt, statt am Merker abzuprallen. */
test('A-1: ein Graph-Fehler gibt den Lauf-Merker frei — ein zweiter Klick erreicht wieder graph.ordnerInhalt', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  controller._bestaetige = function () { return true; };
  let ordnerInhaltAufrufe = 0;
  graph.ordnerInhalt = function () {
    ordnerInhaltAufrufe++;
    return Promise.reject(new Error('Netzfehler (Testfall)'));
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(ordnerInhaltAufrufe, 1);
  assert.match(state.fehlerHinweis || '', /nicht \(vollst.ndig\) durchlaufen/);
  assert.strictEqual(state.gateLaeuft['DBS-001/2'], undefined,
    'der Lauf-Merker wurde nach einem Graph-Fehler im .catch-Zweig nicht wieder geloescht');

  /* Zweiter Klick, NACH dem Fehler: ohne laufBeenden() im .catch bliebe der Merker
     gesetzt und F3 wuerde diesen Aufruf mit "Gate laeuft bereits" abweisen, OHNE
     graph.ordnerInhalt je ein zweites Mal zu rufen. */
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(ordnerInhaltAufrufe, 2,
    'ein zweiter Klick nach einem Graph-Fehler haette wieder graph.ordnerInhalt erreichen ' +
    'muessen — der Lauf-Merker blieb offenbar gesetzt');
  delete global.document;
});

/* ---------- Idempotenz: Wiedereinstieg nach einem Teilfehler doppelt nichts ---------- */

test('Wiedereinstieg (a): _final liegt schon, das Protokoll fehlt -> Umbenennung entfaellt, Protokoll und Status werden nachgezogen', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  let umbenannt = false;
  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_final.xlsx' }]);
  };
  graph.umbenennen = function () { umbenannt = true; return Promise.resolve(); };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(umbenannt, false, 'bei bereits vorhandener _final haette nicht umbenannt werden duerfen');
  assert.strictEqual(rufe.length, 2, 'Protokoll und Dossier-Status — ' + JSON.stringify(rufe));
  assert.strictEqual(rufe[0].ordner, '02_lernziele');
  assert.strictEqual(rufe[0].datei, '_gate.md');
  assert.match(rufe[0].text, /Freigegeben:  unbekannt \(Wiedereinstieg\)/,
    'der von-Name ist ohne die _vN-Datei nicht mehr rekonstruierbar');
  assert.match(rufe[0].text, /Umbenannt in: DBS-001_lernziele-drehbuch_final\.xlsx/);
  assert.strictEqual(rufe[1].ordner, '');
  const dossierGeschrieben = JSON.parse(rufe[1].text);
  assert.strictEqual(dossierGeschrieben.status['lernziele-drehbuch'], 'final');
  delete global.document;
});

test('Wiedereinstieg (b): _final UND Protokoll liegen schon -> nur noch der Dossier-Status', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  let umbenannt = false;
  const rufe = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_lernziele-drehbuch_final.xlsx' },
      { name: '_gate.md' }
    ]);
  };
  graph.umbenennen = function () { umbenannt = true; return Promise.resolve(); };
  graph.ablegen = function (kursId, ordner, datei, text) {
    rufe.push({ ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(umbenannt, false);
  assert.strictEqual(rufe.length, 1, 'es haette nur noch der Dossier-Status geschrieben werden duerfen — ' + JSON.stringify(rufe));
  assert.strictEqual(rufe[0].ordner, '', 'das einzige Schreiben muss der Dossier-Schreiber sein, kein zweites Protokoll');
  const dossierGeschrieben = JSON.parse(rufe[0].text);
  assert.strictEqual(dossierGeschrieben.status['lernziele-drehbuch'], 'final');
  delete global.document;
});

/* ---------- offenErfassen ---------- */

test('offenErfassen ohne geladenes Dossier bricht ab, kein PUT (Guard wie quelleErfassen/dossierSpeichern)', () => {
  setzeKurs();
  state.data.dossier = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  const melde = els({ 'offen-was': { value: 'X' }, 'offen-wo': { value: 'LZ-001' }, 'offen-fuer': { value: 'gate-1' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  controller.offenErfassen({ dataset: {} });

  assert.strictEqual(geschrieben, false, 'graph.ablegen wurde trotz ungeladenem Dossier aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /noch nicht geladen/);
  delete global.document;
});

test('offenErfassen schreibt einen neuen Punkt durch die Warteschlange', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-was': { value: 'Bloom-Stufe pruefen' }, 'offen-wo': { value: 'LZ-004' },
        'offen-fuer': { value: 'gate-1' } });
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.offenErfassen({ dataset: {} });

  assert.ok(abgelegtMit, 'graph.ablegen (ueber dossierSchreiben) wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.offen.length, 1);
  assert.deepStrictEqual(d.offen[0], { was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' });
  assert.strictEqual(state.data.dossier['DBS-001'].offen.length, 1,
    'der State wurde nach dem Schreiben nicht aktualisiert');
  assert.match(state.hinweis || '', /erfasst/);
  delete global.document;
});

test('offenErfassen ohne "was" (S1-Verstoss aus dossier.offenNeu) meldet in state.fehlerHinweis, kein PUT', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.fehlerHinweis = null;
  const melde = els({ 'offen-was': { value: '' }, 'offen-wo': { value: 'LZ-004' },
        'offen-fuer': { value: 'gate-1' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.offenErfassen({ dataset: {} });

  assert.strictEqual(geschrieben, false, 'graph.ablegen wurde trotz fehlendem "was" aufgerufen');
  assert.strictEqual(melde.hidden, false);
  assert.match(melde.textContent, /was fehlt/);
  assert.match(state.fehlerHinweis || '', /was fehlt/,
    'der S1-Fehler aus dossier.offenNeu landet nicht in state.fehlerHinweis');
  delete global.document;
});

/* ---------- offenEntscheiden ---------- */

test('offenEntscheiden ohne geladenes Dossier bricht ab, kein PUT', () => {
  setzeKurs();
  state.data.dossier = {};
  state.fehlerHinweis = null;
  const melde = els({});
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  controller.offenEntscheiden({ dataset: { index: '0', was: 'X' } });

  assert.strictEqual(geschrieben, false);
  assert.match(melde.textContent, /noch nicht geladen/);
  delete global.document;
});

test('offenEntscheiden setzt wer/wann, verschiebt den Punkt nach entschieden[]', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-wer-0': { value: 'Markus' }, 'offen-wann-0': { value: '2026-07-30' } });
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.offenEntscheiden({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.offen.length, 0);
  assert.strictEqual(d.entschieden.length, 1);
  assert.deepStrictEqual(d.entschieden[0],
    { was: 'Bloom-Stufe pruefen', wo: 'LZ-004', wer: 'Markus', wann: '2026-07-30' });
  assert.match(state.hinweis || '', /Entschieden/);
  delete global.document;
});

/* ---------- Identitaets-Guard: Mutationsprobe-Anker ----------
   Diese beiden Tests sind der Beweis, dass der Guard wirklich schreibt: ohne ihn
   (Zeile "if (!eintrag || eintrag.was !== wasErwartet) return null;" entfernt oder
   auskommentiert) veraendert offenEntscheiden/offenVerschieben den FALSCHEN Eintrag,
   statt abzubrechen — beide Tests werden dann rot. Kommando + Beleg im Report. */

test('offenEntscheiden mit verschobenem Index (Identitaet stimmt nicht mehr) bricht OHNE Schreiben ab', async () => {
  setzeKurs();
  /* Zwischen Render und Klick hat sich die Liste veraendert: an Index 0 steht jetzt
     ein ANDERER Punkt als der, den die Person im Formular sah (data-was). */
  state.data.dossier = { 'DBS-001': dossierMit([
    { was: 'Anderer Punkt (zwischenzeitlich verschoben)', wo: 'LZ-009', fuer: 'gate-1' }
  ]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-wer-0': { value: 'Markus' }, 'offen-wann-0': { value: '2026-07-30' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.offenEntscheiden({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.strictEqual(geschrieben, false, 'trotz veraltetem Index wurde geschrieben — der Identitaets-Guard fehlt');
  assert.strictEqual(state.data.dossier['DBS-001'].offen.length, 1,
    'der falsche Eintrag wurde trotzdem veraendert');
  assert.strictEqual(state.data.dossier['DBS-001'].offen[0].was, 'Anderer Punkt (zwischenzeitlich verschoben)');
  assert.match(state.fehlerHinweis || '', /Liste hat sich ge.ndert/);
  delete global.document;
});

test('offenVerschieben mit verschobenem Index bricht OHNE Schreiben ab', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([
    { was: 'Anderer Punkt (zwischenzeitlich verschoben)', wo: 'LZ-009', fuer: 'gate-1' }
  ]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-ziel-0': { value: 'schritt-3' }, 'offen-begruendung-0': { value: 'gehoert zu Schritt 3' } });
  let geschrieben = false;
  graph.ablegen = function () { geschrieben = true; return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.offenVerschieben({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.strictEqual(geschrieben, false, 'trotz veraltetem Index wurde geschrieben — der Identitaets-Guard fehlt');
  assert.strictEqual(state.data.dossier['DBS-001'].offen[0].fuer, 'gate-1',
    'der falsche Eintrag wurde trotzdem verschoben');
  assert.match(state.fehlerHinweis || '', /Liste hat sich ge.ndert/);
  delete global.document;
});

/* ---------- offenVerschieben (Erfolgsfall) ---------- */

test('offenVerschieben setzt neues Ziel und Begruendung am richtigen Eintrag', async () => {
  setzeKurs();
  state.data.dossier = { 'DBS-001': dossierMit([{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }]) };
  state.data.dossierETag = {};
  state.hinweis = null;
  state.fehlerHinweis = null;
  els({ 'offen-ziel-0': { value: 'schritt-3' }, 'offen-begruendung-0': { value: 'gehoert zu Schritt 3' } });
  let abgelegtMit = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegtMit = { kursId, ordner, datei, text };
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.offenVerschieben({ dataset: { index: '0', was: 'Bloom-Stufe pruefen' } });

  assert.ok(abgelegtMit, 'graph.ablegen wurde nicht aufgerufen');
  const d = JSON.parse(abgelegtMit.text);
  assert.strictEqual(d.offen.length, 1);
  assert.strictEqual(d.offen[0].fuer, 'schritt-3');
  assert.strictEqual(d.offen[0].begruendung, 'gehoert zu Schritt 3');
  assert.match(state.hinweis || '', /Verschoben/);
  delete global.document;
});

/* ---------- V6 (Etappe 4): gateKlick Schritt 4 — Stamm-Umbenennung + Offen-Speisung ----------
   Schritt 4 des Fixture-Kontrakts (04_validierung, Lieferobjekt 'content', ext docx,
   gate 'Sign-off' -> inhalt.gateAdressat('4') === 'sign-off') legt docx UND blocks unter
   demselben _vN-Versionsstamm ab (B5) — der Gate-Klick muss beim Freigeben BEIDE auf
   _final drehen (Stamm-Umbenennung) und speist bei diesem Gate zusaetzlich die offenen
   Punkte der final werdenden Fassung als schritt-5-Punkte ins Dossier (Offen-Speisung). */

test('V6: voller Durchlauf Schritt 4 benennt docx UND blocks (gleicher Versionsstamm) gemeinsam auf _final um', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  /* Review-Cache liegt vor, aber ohne offene Punkte — dieser Test prueft nur die
     Stamm-Umbenennung, nicht die Offen-Speisung (die hat einen eigenen Test unten). */
  state.data.review = { 'DBS-001': { validiert: { offen: [], kapitel: [] }, claude: null, chatgpt: null } };
  state.hinweis = null;
  state.fehlerHinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_content_v3.docx'));
  controller._bestaetige = function () { return true; };
  const umbenennungen = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_content_v3.docx' },
      { name: 'DBS-001_content_v3.blocks' }
    ]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) {
    umbenennungen.push({ von: von, nach: nach });
    return Promise.resolve(nach);
  };
  graph.ablegen = function () { return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.gateKlick('4', { disabled: false });

  assert.strictEqual(umbenennungen.length, 2,
    'erwartet: docx UND blocks umbenannt — ' + JSON.stringify(umbenennungen));
  assert.deepStrictEqual(umbenennungen.map(function (u) { return u.von; }).sort(),
    ['DBS-001_content_v3.blocks', 'DBS-001_content_v3.docx']);
  assert.deepStrictEqual(umbenennungen.map(function (u) { return u.nach; }).sort(),
    ['DBS-001_content_final.blocks', 'DBS-001_content_final.docx']);
  assert.match(state.hinweis || '', /Als final best.tigt.*DBS-001_content_final\.docx/);
  delete global.document;
});

test('V6: Schritt-2-Fixture (eine Datei je Stamm) bleibt Rueckwaertskompatibel — keine Geschwister-Umbenennung', async () => {
  /* Kein neuer Test noetig fuer den Beleg selbst (die bestehenden Gate-Tests oben
     bleiben unveraendert gruen), aber dieser Test macht die Aussage aus dem Brief
     ("Schritt-2-Fixture (eine Datei) -> Verhalten byte-identisch zu heute")
     ausdruecklich sichtbar: mit einer zweiten, NICHT verwandten Datei im selben Ordner
     (anderes Lieferobjekt) darf trotzdem nur die gewaehlte Datei selbst umbenannt werden. */
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.data.review = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_lernziele-drehbuch_v3.xlsx'));
  controller._bestaetige = function () { return true; };
  const umbenennungen = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_lernziele-drehbuch_v3.xlsx' },
      { name: 'DBS-001_irgendein-anderes-lieferobjekt_v1.md' }
    ]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) {
    umbenennungen.push({ von: von, nach: nach });
    return Promise.resolve(nach);
  };
  graph.ablegen = function () { return Promise.resolve({ eTag: 'W/"1"' }); };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(umbenennungen.length, 1, 'nur die gewaehlte Datei selbst — ' + JSON.stringify(umbenennungen));
  assert.strictEqual(umbenennungen[0].von, 'DBS-001_lernziele-drehbuch_v3.xlsx');
  assert.strictEqual(umbenennungen[0].nach, 'DBS-001_lernziele-drehbuch_final.xlsx');
  delete global.document;
});

test('V6: Wiedereinstieg Schritt 4 — docx bereits final, blocks noch nicht: nur blocks wird nachgezogen, kein zweites Protokoll', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.data.review = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  const umbenennungen = [];
  const ablagen = [];
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_content_final.docx' },
      { name: '_gate.md' },
      { name: 'DBS-001_content_v3.blocks' }
    ]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) {
    umbenennungen.push({ von: von, nach: nach });
    return Promise.resolve(nach);
  };
  graph.ablegen = function (kursId, ordner, datei, text) {
    ablagen.push({ ordner: ordner, datei: datei, text: text });
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('4', { disabled: false });

  assert.strictEqual(umbenennungen.length, 1,
    'erwartet: nur die noch fehlende blocks-Umbenennung — ' + JSON.stringify(umbenennungen));
  assert.strictEqual(umbenennungen[0].von, 'DBS-001_content_v3.blocks');
  assert.strictEqual(umbenennungen[0].nach, 'DBS-001_content_final.blocks');
  const gateProtokolle = ablagen.filter(function (a) { return a.datei === '_gate.md'; });
  assert.strictEqual(gateProtokolle.length, 0, 'kein zweites Protokoll — es liegt bereits eins (' + JSON.stringify(ablagen) + ')');
  const dossierSchreibversuche = ablagen.filter(function (a) { return a.ordner === ''; });
  assert.strictEqual(dossierSchreibversuche.length, 1);
  delete global.document;
});

test('V6: Offen-Speisung — offene Punkte der final werdenden Fassung landen mit fuer="schritt-5" im Dossier-Mutator, beim zweiten Klick nicht doppelt', async () => {
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  const gelesen = {
    offen: ['Rechtsstand fuer Kapitel 3 pruefen'],
    kapitel: [
      { ek: 'AFL-001-EK-002', titel: 'Freizuegigkeit', validierung: { herkunft: 'bestaetigt', divergenz: 'offen' } },
      { ek: 'AFL-001-EK-003', titel: 'Vorbezug', validierung: { herkunft: 'bestaetigt', divergenz: 'keine' } }
    ]
  };
  state.data.review = { 'DBS-001': { validiert: gelesen, claude: null, chatgpt: null } };
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_content_v3.docx'));
  controller._bestaetige = function () { return true; };
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_content_v3.docx' },
      { name: 'DBS-001_content_v3.blocks' }
    ]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) { return Promise.resolve(nach); };
  let dossierText = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    if (ordner === '') dossierText = text;
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('4', { disabled: false });

  assert.ok(dossierText, 'der Dossier-Schreiber wurde nicht aufgerufen');
  const d1 = JSON.parse(dossierText);
  assert.strictEqual(d1.offen.length, 2, JSON.stringify(d1.offen));
  assert.deepStrictEqual(d1.offen[0],
    { was: 'Rechtsstand fuer Kapitel 3 pruefen', wo: 'DBS-001_content_final.docx', fuer: 'schritt-5' });
  assert.deepStrictEqual(d1.offen[1],
    { was: 'Divergenz offen: AFL-001-EK-002 · Freizuegigkeit', wo: 'DBS-001_content_final.docx', fuer: 'schritt-5' });
  assert.strictEqual(d1.status.content, 'final');
  assert.strictEqual(state.data.dossier['DBS-001'].offen.length, 2,
    'der State wurde nach dem Schreiben nicht aktualisiert');

  /* Zweiter Klick: die Fassung ist jetzt final, das Dossier traegt die beiden Punkte
     bereits (state.data.dossier wurde nach dem ersten Schreiben aktualisiert) — der
     Review-Cache (neu geladen, wie es die echte Review-Ansicht taete) liefert dieselben
     zwei Punkte erneut, sie duerfen NICHT doppelt entstehen. */
  state.data.review = { 'DBS-001': { validiert: gelesen, claude: null, chatgpt: null } };
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } });
  graph.ordnerInhalt = function () {
    return Promise.resolve([
      { name: 'DBS-001_content_final.docx' },
      { name: '_gate.md' },
      { name: 'DBS-001_content_final.blocks' }
    ]);
  };
  let dossierText2 = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    if (ordner === '') dossierText2 = text;
    return Promise.resolve({ eTag: 'W/"3"' });
  };

  await controller.gateKlick('4', { disabled: false });

  assert.ok(dossierText2, 'der Dossier-Schreiber wurde beim zweiten Klick nicht aufgerufen');
  const d2 = JSON.parse(dossierText2);
  assert.strictEqual(d2.offen.length, 2,
    'beim zweiten Klick duerfen keine Duplikate entstehen — ' + JSON.stringify(d2.offen));
  delete global.document;
});

test('V6: ohne Review-Cache und ohne S2-Sperre (Schritt 2) bleibt die Offen-Speisung stumm — kein graph.dateiLesen-Aufruf', async () => {
  /* gateAdressat('2') === 'gate-1', nicht 'sign-off' — offenePunkteQuelle() darf fuer
     Schritt 2 gar nicht erst versuchen, eine .blocks-Datei zu lesen (die es dort auch
     gar nicht gibt). */
  setzeKursMitInhalt();
  state.data.dossier = { 'DBS-001': dossierMit([]) };
  state.data.dossierETag = {};
  state.data.review = {};
  state.hinweis = null;
  elsGate({ 'gate-zweitpruefung': { value: 'N. N.' } }, radioGewaehlt('DBS-001_lernziele-drehbuch_v3.xlsx'));
  controller._bestaetige = function () { return true; };
  let dateiLesenGerufen = false;
  graph.dateiLesen = function () { dateiLesenGerufen = true; return Promise.resolve(null); };
  graph.ordnerInhalt = function () {
    return Promise.resolve([{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }]);
  };
  graph.umbenennen = function (kursId, ordner, von, nach) { return Promise.resolve(nach); };
  let dossierText = null;
  graph.ablegen = function (kursId, ordner, datei, text) {
    if (ordner === '') dossierText = text;
    return Promise.resolve({ eTag: 'W/"1"' });
  };

  await controller.gateKlick('2', { disabled: false });

  assert.strictEqual(dateiLesenGerufen, false, 'Schritt 2 haette nie versuchen duerfen, eine .blocks-Datei zu lesen');
  assert.ok(dossierText, 'der Dossier-Schreiber wurde nicht aufgerufen');
  const d = JSON.parse(dossierText);
  assert.strictEqual((d.offen || []).length, 0, 'Schritt 2 darf keine schritt-5-Punkte anlegen');
  delete global.document;
});
