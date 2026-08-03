const test = require('node:test');
const assert = require('node:assert');

const { graph, state } = require('../app.js');

/* Echtes Element aus KWKurse, Site /sites/ffentlicheAngebote */
const SP_ITEM = {
  id: '1',
  fields: {
    Title: 'DBS-001',
    Kurstitel: 'Derivate & Strukturierte Produkte Basis',
    Kompetenzfeld: 'Vermögen & Vorsorge',
    Schritt: 4,
    Status: 'inArbeit',
    Prio: null,
    Bemerkung: null
  }
};

test('mapKurs liest die Stammdaten', () => {
  const k = graph.mapKurs(SP_ITEM);
  assert.strictEqual(k.id, '1');
  assert.strictEqual(k.kursId, 'DBS-001');
  assert.strictEqual(k.kurstitel, 'Derivate & Strukturierte Produkte Basis');
  assert.strictEqual(k.kompetenzfeld, 'Vermögen & Vorsorge');
  assert.strictEqual(k.schritt, 4);
  assert.strictEqual(k.status, 'inArbeit');
});

test('fehlende Textfelder werden zu leeren Strings, nicht zu undefined', () => {
  const k = graph.mapKurs({ id: '9', fields: { Title: 'X-1' } });
  assert.strictEqual(k.kurstitel, '');
  assert.strictEqual(k.bemerkung, '');
  assert.strictEqual(k.prio, null);
});

test('ein fehlender Schritt gilt als 1, ein fehlender Status als offen', () => {
  const k = graph.mapKurs({ id: '9', fields: { Title: 'X-1' } });
  assert.strictEqual(k.schritt, 1);
  assert.strictEqual(k.status, 'offen');
});

test('unzulaessige Werte werden normalisiert statt uebernommen', () => {
  const k = graph.mapKurs({ id: '9', fields: { Title: 'X', Schritt: 99, Status: 'Quatsch' } });
  assert.strictEqual(k.schritt, 1);
  assert.strictEqual(k.status, 'offen');
});

/* --- Der Stand je Schritt wird berechnet, nicht gespeichert (Variante B) --- */

test('standVon: Schritte vor dem aktuellen sind fertig', () => {
  const k = graph.mapKurs(SP_ITEM);          // Schritt 4, inArbeit
  assert.strictEqual(graph.standVon(k, 1), 'fertig');
  assert.strictEqual(graph.standVon(k, 3), 'fertig');
});

test('standVon: der aktuelle Schritt traegt den Status des Kurses', () => {
  assert.strictEqual(graph.standVon(graph.mapKurs(SP_ITEM), 4), 'inArbeit');
});

test('standVon: Schritte nach dem aktuellen sind offen', () => {
  const k = graph.mapKurs(SP_ITEM);
  assert.strictEqual(graph.standVon(k, 5), 'offen');
  assert.strictEqual(graph.standVon(k, 9), 'offen');
});

test('fortschritt zaehlt die abgeschlossenen Schritte', () => {
  assert.strictEqual(graph.fortschritt(graph.mapKurs(SP_ITEM)), 3);
});

test('fortschritt zaehlt den aktuellen Schritt mit, wenn er fertig ist', () => {
  const k = graph.mapKurs({ id: '2', fields: { Title: 'X', Schritt: 4, Status: 'fertig' } });
  assert.strictEqual(graph.fortschritt(k), 4);
});

test('ein Kurs am Anfang steht auf 0 von 8', () => {
  const k = graph.mapKurs({ id: '2', fields: { Title: 'AFL-001', Schritt: 1, Status: 'offen' } });
  assert.strictEqual(graph.fortschritt(k), 0);
});

test('ein abgeschlossener Kurs steht auf 8 von 8', () => {
  const k = graph.mapKurs({ id: '2', fields: { Title: 'X', Schritt: 8, Status: 'fertig' } });
  assert.strictEqual(graph.fortschritt(k), 8);
});

/* --- Schreibpfad: reine Funktionen --- */

test('naechsterStand: erledigt-Haken schiebt auf den naechsten Schritt', () => {
  const k = graph.mapKurs(SP_ITEM);                 // Schritt 4, inArbeit
  assert.deepStrictEqual(graph.naechsterStand(k, 4), { Schritt: 5, Status: 'offen' });
});

test('naechsterStand: erneutes Klicken nimmt die Erledigung zurueck', () => {
  const k = graph.mapKurs({ id: '2', fields: { Title: 'X', Schritt: 5, Status: 'offen' } });
  assert.deepStrictEqual(graph.naechsterStand(k, 4), { Schritt: 4, Status: 'offen' });
});

test('naechsterStand: der letzte Schritt schliesst den Kurs ab', () => {
  const k = graph.mapKurs({ id: '2', fields: { Title: 'X', Schritt: 8, Status: 'inArbeit' } });
  assert.deepStrictEqual(graph.naechsterStand(k, 8), { Schritt: 8, Status: 'fertig' });
});

test('graph.siteUrl baut den Graph-Pfad aus der CONFIG', () => {
  assert.strictEqual(graph.siteUrl(),
    'https://graph.microsoft.com/v1.0/sites/bbzsg.sharepoint.com:/sites/ffentlicheAngebote');
});

test('pfadImKursordner(): leerer Ordner heisst Kursordner-Wurzel, ohne fuehrenden Schraegstrich', () => {
  assert.strictEqual(graph.pfadImKursordner('01_briefing', 'x.md'), '01_briefing/x.md');
  assert.strictEqual(graph.pfadImKursordner('', 'VL-001_dossier.json'), 'VL-001_dossier.json');
});

/* ---------- graph.vorlageLaden: nur ein Erfolg wird gecacht (Fixwave 2026-08-04, I2) ----------
   Vorher cachte vorlageLaden() JEDES Ergebnis, auch null bei einem Fehlschlag (Netz-Timeout,
   Datei fehlt) — ein einziger Fehlschlag blockierte damit jeden weiteren Schritt-3-Upload der
   ganzen Sitzung mit derselben Meldung. graph.zentralDateiRoh wird hier direkt ueberschrieben
   (statt driveId/token/fetch zu mocken, s. test/ablegen.test.js fuer das schwergewichtigere
   Muster) — vorlageLaden() selbst ruft nur diese eine Funktion auf. */
test('vorlageLaden: ein Fehlschlag (null) wird NICHT gecacht — ein zweiter Versuch laedt erneut', async () => {
  const echt = graph.zentralDateiRoh;
  let aufrufe = 0;
  graph.zentralDateiRoh = function () {
    aufrufe++;
    return Promise.resolve(aufrufe === 1 ? null : new ArrayBuffer(4));
  };
  state.data.vorlage = undefined;
  try {
    const erster = await graph.vorlageLaden();
    assert.strictEqual(erster, null, 'erster Versuch sollte null liefern (Fehlschlag simuliert)');
    assert.strictEqual(state.data.vorlage, undefined,
      'ein Fehlschlag haette NICHT gecacht werden duerfen');
    assert.strictEqual(aufrufe, 1);

    const zweiter = await graph.vorlageLaden();
    assert.ok(zweiter, 'zweiter Versuch haette die Vorlage liefern muessen');
    assert.strictEqual(aufrufe, 2, 'der zweite Versuch haette erneut laden muessen, nicht aus dem Cache');
    assert.strictEqual(state.data.vorlage, zweiter, 'ein Erfolg wird gecacht');

    const dritter = await graph.vorlageLaden();
    assert.strictEqual(aufrufe, 2, 'ein dritter Aufruf nach Erfolg haette den Cache nutzen muessen');
    assert.strictEqual(dritter, zweiter);
  } finally {
    graph.zentralDateiRoh = echt;
    state.data.vorlage = undefined;
  }
});
