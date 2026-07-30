'use strict';
/* dossierNachladen darf ein bestehendes Dossier nie durch einen Import-Fallback
   ersetzen, wenn es nur gerade nicht lesbar ist (I-1, Final-Review). graph.dateiLesen
   liefert null sowohl bei "Datei fehlt" als auch bei jedem anderen Fehler (Token,
   5xx, Netz) — dossierNachladen muss ueber graph.dateiLesenGenau die drei Faelle
   auseinanderhalten: fehlt -> Import, Fehler -> state bleibt null + Meldung,
   korrupte Datei -> ebenfalls state bleibt null + Meldung. Reiner Guard-Test,
   kein Netz noetig: graph.dateiLesenGenau/graph.dateiLesen werden ueberschrieben. */
const test = require('node:test');
const assert = require('node:assert');

const { controller, state, graph } = require('../app.js');
require('../dossier.js');
require('../inhalt.js');   /* der Import-Fallback ruft inhalt.briefingFelderLesen */
const { INHALT } = require('./fixture.js');

function vorbereiten() {
  state.position.kursId = 'DBS-001';
  state.data.inhalt = INHALT;
  state.data.dossier = {};
  state.hinweis = null;
  global.document = undefined;   /* controller.render() muss auch ohne DOM auskommen */
}

test('fehlt (404 / kein Kursordner) — Import-Fallback laeuft wie bisher', async () => {
  vorbereiten();
  let altGelesenMit = null;
  graph.dateiLesenGenau = function () { return Promise.resolve({ ok: false, fehlt: true }); };
  graph.dateiLesen = function (kursId, ordner, datei) {
    altGelesenMit = { kursId, ordner, datei };
    return Promise.resolve('## scope_quelle · Quelle des Scopes\nKursausschreibung\n');
  };

  await controller.dossierNachladen('DBS-001');

  assert.ok(altGelesenMit, 'die Altdatei wurde nicht gelesen — kein Import-Versuch');
  assert.strictEqual(altGelesenMit.ordner, '01_briefing');
  assert.strictEqual(altGelesenMit.datei, 'DBS-001_briefing-felder.md');
  const d = state.data.dossier['DBS-001'];
  assert.ok(d, 'nach einem echten "fehlt" muss ein importiertes Dossier im State stehen');
  assert.strictEqual(d.kurs, 'DBS-001');
  assert.strictEqual(d.scope.scope_quelle, 'Kursausschreibung');
});

test('fehlt:false (echter Lesefehler) — state bleibt null, kein Import, sichtbare Meldung', async () => {
  vorbereiten();
  let altGelesen = false;
  graph.dateiLesenGenau = function () { return Promise.resolve({ ok: false, fehlt: false }); };
  graph.dateiLesen = function () { altGelesen = true; return Promise.resolve(null); };

  const vorherMutationsprobe = state.data.dossier;   /* Mutationsprobe: Referenz vor dem Aufruf */
  await controller.dossierNachladen('DBS-001');

  assert.strictEqual(altGelesen, false, 'der Import-Fallback wurde trotz echtem Fehler angestossen');
  assert.strictEqual(state.data.dossier['DBS-001'], null, 'ein Platzhalter-Dossier wurde geschrieben');
  assert.strictEqual(state.data.dossier, vorherMutationsprobe, 'dossierNachladen hat das dossier-Objekt selbst ersetzt statt nur den Eintrag zu setzen');
  assert.match(state.hinweis, /nicht gelesen werden/);
});

test('korruptes JSON (Datei da, dossier.lesen() liefert null) — state bleibt null, kein Import, andere Meldung', async () => {
  vorbereiten();
  let altGelesen = false;
  graph.dateiLesenGenau = function () { return Promise.resolve({ ok: true, text: '{ das ist kein gueltiges Dossier' }); };
  graph.dateiLesen = function () { altGelesen = true; return Promise.resolve(null); };

  await controller.dossierNachladen('DBS-001');

  assert.strictEqual(altGelesen, false, 'der Import-Fallback wurde trotz vorhandener, aber kaputter Datei angestossen');
  assert.strictEqual(state.data.dossier['DBS-001'], null, 'die korrupte Datei wurde still durch ein neues Dossier ersetzt');
  assert.match(state.hinweis, /unlesbar/);
});

test('Netzfehler in der Kette selbst (Promise-Reject) — faengt das fehlende .catch am Ende auf', async () => {
  vorbereiten();
  graph.dateiLesenGenau = function () { return Promise.reject(new Error('Netz weg')); };
  graph.dateiLesen = function () { return Promise.resolve(null); };

  await controller.dossierNachladen('DBS-001');

  assert.strictEqual(state.data.dossier['DBS-001'], null);
  assert.match(state.hinweis, /nicht gelesen werden/);
});

/* ---------- Etappe 1b: dossierNachladen haengt auch an Kursansicht und Schritt 3 ----------
   "Wenn eine Ansicht Daten zeigt, muss der Ladevorgang an derselben Ansicht haengen"
   (dieselbe Lehre wie beim Briefing-Nachladen, s. briefingversion.test.js) — die
   Kursansicht und Schritt 3 zeigen jetzt das Quellenverzeichnis, also muessen sie
   das Dossier auch selbst nachladen, nicht nur Schritt 1. Geprueft wird die
   Bedingung im Quelltext, wie beim Briefing-Test. */

test('der Ladevorgang wird auf Schritt 1 UND 3 angestossen', () => {
  const quelle = require('fs').readFileSync(__dirname + '/../app.js', 'utf8');
  const stelle = quelle.slice(quelle.indexOf('controller.dossierNachladen(k.kursId)') - 400,
                             quelle.indexOf('controller.dossierNachladen(k.kursId)'));
  assert.ok(/p\.schrittId\) === '1'/.test(stelle),
    'Schritt 1 stoesst das Dossier-Nachladen nicht an');
  assert.ok(/p\.schrittId\) === '3'/.test(stelle),
    'Schritt 3 stoesst das Dossier-Nachladen nicht an — das Quellenverzeichnis bliebe leer');
});

test('die Kursansicht stoesst dossierNachladen ebenfalls an und reicht das Dossier an die Ansicht weiter', () => {
  const quelle = require('fs').readFileSync(__dirname + '/../app.js', 'utf8');
  const kursblock = quelle.slice(quelle.indexOf("} else if (p.kursId) {"),
                                  quelle.indexOf('} else {', quelle.indexOf("} else if (p.kursId) {")));
  assert.ok(/controller\.dossierNachladen\(kk\.kursId\)/.test(kursblock),
    'die Kursansicht stoesst dossierNachladen nicht an — das Quellenverzeichnis bliebe leer');
  assert.ok(/dossier:/.test(kursblock),
    'die Kursansicht reicht kein dossier-Prop an ansichten.einKurs weiter');
});
