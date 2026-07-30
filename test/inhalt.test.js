const test = require('node:test');
const assert = require('node:assert');

const { inhalt } = require('../inhalt.js');
const { INHALT } = require('./fixture.js');

function kopie() { return JSON.parse(JSON.stringify(INHALT)); }

test('vollstaendige Inhalte werden nicht beanstandet', () => {
  assert.deepStrictEqual(inhalt.pruefe(INHALT), []);
});

test('fehlende Inhalte werden beanstandet', () => {
  assert.ok(inhalt.pruefe(null).length > 0);
});

test('weniger als 8 Schritte faellt auf', () => {
  const i = kopie();
  i.schritte.schritte.pop();
  assert.ok(inhalt.pruefe(i).some(x => /7 statt 8/.test(x)));
});

test('ein Schritt ohne Zweck faellt auf', () => {
  const i = kopie();
  i.schritte.schritte[2].zweck = '';
  assert.ok(inhalt.pruefe(i).some(x => /Schritt 3: zweck fehlt/.test(x)));
});

test('HF in schritte.json faellt auf — es gehoert in hf.json', () => {
  const i = kopie();
  i.schritte.schritte[0].prim = ['HF8'];
  assert.ok(inhalt.pruefe(i).some(x => /HF gehoert nicht/.test(x)));
});

test('eine unaufloesbare Werkzeug-Referenz faellt auf', () => {
  const i = kopie();
  i.werkzeuge.schrittWerkzeuge['4'].push('gibtsnicht');
  assert.ok(inhalt.pruefe(i).some(x => /unbekanntes Werkzeug gibtsnicht/.test(x)));
});

test('doppelte Werkzeug-IDs fallen auf', () => {
  const i = kopie();
  i.werkzeuge.liste.push(i.werkzeuge.liste[0]);
  assert.ok(inhalt.pruefe(i).some(x => /doppelte IDs/.test(x)));
});

test('ein fehlendes Referenzwerk faellt auf', () => {
  const i = kopie();
  delete i.referenz.didaktik;
  assert.ok(inhalt.pruefe(i).some(x => /didaktik/.test(x)));
});

/* --- Zugriffshelfer --- */

test('schritt() findet ueber Zahl und Zeichenkette', () => {
  assert.strictEqual(inhalt.schritt(INHALT, 3).nm, 'Content');
  assert.strictEqual(inhalt.schritt(INHALT, '3').nm, 'Content');
});

test('schritt() liefert null statt einer Ausnahme', () => {
  assert.strictEqual(inhalt.schritt(INHALT, 99), null);
});

test('werkzeugeVon liefert die Werkzeuge des Schritts', () => {
  const w = inhalt.werkzeugeVon(INHALT, 3).map(x => x.id);
  assert.deepStrictEqual(w, ['guide-3', 'prompt-greenfield']);
});

test('anleitungVon liefert genau die Anleitung', () => {
  assert.strictEqual(inhalt.anleitungVon(INHALT, 3).id, 'guide-3');
});

test('hilfsmittelVon laesst die Anleitung weg', () => {
  const h = inhalt.hilfsmittelVon(INHALT, 3).map(x => x.id);
  assert.deepStrictEqual(h, ['prompt-greenfield']);
});

test('phaseVon ordnet den Schritt seiner Phase zu', () => {
  assert.strictEqual(inhalt.phaseVon(INHALT, 4).nm, 'Inhalt entwerfen');
  assert.strictEqual(inhalt.phaseVon(INHALT, 1).nm, 'Vorbereiten');
  assert.strictEqual(inhalt.phaseVon(INHALT, 8).nm, 'Abnehmen & sichern');
});

/* --- Ablage-Kontrakt --- */

test('ablageVon baut Ordner und Dateiname aus dem Kontrakt', () => {
  const a = inhalt.ablageVon(INHALT, 3, 'DBS-001');
  assert.strictEqual(a.ordner, '03_content');
  assert.strictEqual(a.format, 'word');
  assert.strictEqual(a.gate, null);
  /* Ohne gewaehlte Variante bleibt der Platzhalter stehen — der Name ist dann
     eine Schablone, keine Zusage. Mit Variante loest er sich auf. */
  assert.strictEqual(a.datei, 'DBS-001_skript-{variante}_v{N}.docx');
  const b = inhalt.ablageVon(INHALT, 3, 'DBS-001', 'chatgpt');
  assert.strictEqual(b.datei, 'DBS-001_skript-chatgpt_v{N}.docx');
});

test('ablageVon kennt feste Dateinamen ohne Version', () => {
  const a = inhalt.ablageVon(INHALT, 6, 'DBS-001');
  assert.strictEqual(a.datei, 'DBS-001_export.mbz');
});

test('ablageVon gibt das Gate mit aus', () => {
  assert.strictEqual(inhalt.ablageVon(INHALT, 2, 'DBS-001').gate, 'Gate 1 · 4-Augen');
  assert.strictEqual(inhalt.ablageVon(INHALT, 4, 'DBS-001').gate, 'Sign-off');
});

/* Bis zur Reform teilten sich Schritt 5 und 6 den Ordner 05_content — mit den
   acht eigenstaendigen Ordnern (Auftrag 1) gibt es diese Teilung nicht mehr,
   jeder Schritt fuehrt seinen eigenen Ordner. Der Test entfaellt ersatzlos. */

test('ablageVon liefert die zulaessigen Wege', () => {
  assert.deepStrictEqual(inhalt.ablageVon(INHALT, 6, 'DBS-001').wege,
                         ['claude-code', 'hochladen']);
  assert.deepStrictEqual(inhalt.ablageVon(INHALT, 2, 'DBS-001').wege,
                         ['claude-code', 'hand', 'hochladen']);
});

/* --- quellenOrdner (Audit I3): EINE Stelle statt drei getippter --- */

test('quellenOrdner liest den Schritt-3-Ordner aus dem Kontrakt und haengt /quellen an', () => {
  assert.strictEqual(inhalt.quellenOrdner(INHALT), '03_content/quellen');
});

test('quellenOrdner folgt einem geaenderten Schritt-3-Ordner', () => {
  const anders = kopie();
  anders['ablage-kontrakt'].schritte['3'].ordner = '99_anders';
  assert.strictEqual(inhalt.quellenOrdner(anders), '99_anders/quellen');
});

test('quellenOrdner faellt ohne Kontrakt/Schritt-3-Ordner auf 03_content/quellen zurueck', () => {
  assert.strictEqual(inhalt.quellenOrdner(null), '03_content/quellen');
  assert.strictEqual(inhalt.quellenOrdner({}), '03_content/quellen');
});

/* --- Laden --- */

test('laden meldet fehlende Pflichtdateien beim Namen', async () => {
  const graphMock = { zentralLaden: () => Promise.resolve({ schritte: INHALT.schritte }) };
  await assert.rejects(() => inhalt.laden(graphMock), /fehlen: ablage-kontrakt, werkzeuge, referenz/);
});

test('laden verzeiht ein fehlendes hf.json — es ist abkoppelbar', async () => {
  const ohneHf = kopie();
  delete ohneHf.hf;
  const graphMock = { zentralLaden: () => Promise.resolve(ohneHf) };
  const r = await inhalt.laden(graphMock);
  assert.strictEqual(r.hf, undefined);
  assert.strictEqual(r.schritte.schritte.length, 8);
});

test('laden bricht bei inhaltlich kaputten Dateien ab', async () => {
  const kaputt = kopie();
  kaputt.schritte.schritte = [];
  const graphMock = { zentralLaden: () => Promise.resolve(kaputt) };
  await assert.rejects(() => inhalt.laden(graphMock), /unvollstaendig/);
});

/* ---------- Verschachtelung der Referenztexte ---------- */

test('verschachtelung erkennt einen sauberen Abschnitt', () => {
  const v = inhalt.verschachtelung('<div class="a"><div>x</div></div><p>y</p>');
  assert.deepStrictEqual(v, { ende: 0, tiefste: 0 });
});

test('verschachtelung erkennt einen offen gelassenen Behaelter', () => {
  assert.strictEqual(inhalt.verschachtelung('<div class="grid"><div class="card">x').ende, 2);
});

test('verschachtelung erkennt einen fremden Schliesser', () => {
  /* Genau der Fall aus v0.2: der Abschnitt schliesst einen Behaelter,
     den er nie geoeffnet hat, und reisst damit das Layout auf. */
  const v = inhalt.verschachtelung('<div class="bloomcal">x</div></div><div class="card">');
  assert.strictEqual(v.tiefste, -1);
});

test('pruefe meldet unsaubere Referenz-Verschachtelung', () => {
  const k = JSON.parse(JSON.stringify(INHALT));
  k.referenz.didaktik.abschnitte[1].html = '<div class="bloomcal">x</div></div>';
  const p = inhalt.pruefe(k);
  assert.ok(p.some(x => /didaktik Abschnitt 2/.test(x) && /Verschachtelung/.test(x)),
            'Fehler nicht gemeldet: ' + p.join(' | '));
});

/* ---------- Bauauftrag fuer den Weg Claude-Code ----------
   Am 2026-07-29 nannte die Schrittansicht fuer JEDEN Schritt
   "greenfield-bauspec.txt" — ein fest eingetragener Name, den es nach der
   Umbenennung nicht mehr gab. Der Name muss aus dem Schritt folgen. */

test('der Bauauftrag folgt dem Schritt, nicht einem festen Namen', () => {
  const a = inhalt.bauauftrag(INHALT, 3);
  const b = inhalt.bauauftrag(INHALT, 4);
  assert.strictEqual(a.bauspec, 'skript-bauspec.txt');
  assert.strictEqual(b.bauspec, 'content-bauspec.txt');
  assert.notStrictEqual(a.bauspec, b.bauspec,
    'beide Schritte nennen dieselbe Datei — der Name haengt nicht am Schritt');
  assert.strictEqual(a.inhaltskontrakt, 'skript-inhaltskontrakt.txt');
  assert.ok(a.pfad.indexOf('_zentral/prompt-bibliothek/') === 0, 'Pfad unvollstaendig: ' + a.pfad);
});

test('ohne Inhaltskontrakt wird kein Dateiname geraten', () => {
  assert.strictEqual(inhalt.bauauftrag(INHALT, 1), null, 'Schritt 1 hat keinen Inhaltskontrakt');
  assert.strictEqual(inhalt.bauauftrag(INHALT, 6), null, 'Schritt 6 hat keinen Inhaltskontrakt');
  assert.strictEqual(inhalt.bauauftrag(INHALT, 99), null, 'unbekannter Schritt');
});

/* ---------- gateProtokoll (Etappe 2, Task 6) ----------
   Reine Funktion nach Ablage-Kontrakt §5 — kein Date hier drin, datum kommt
   als Parameter herein (der Controller ruft new Date(), inhalt.js nie). */

test('das Gate-Protokoll folgt dem Ablage-Kontrakt §5', () => {
  const md = inhalt.gateProtokoll({
    gate: 'Gate 1 · 4-Augen', kursId: 'VL-001',
    von: 'VL-001_lernziele-drehbuch_v3.xlsx', nach: 'VL-001_lernziele-drehbuch_final.xlsx',
    datum: '2026-07-30', person: 'Markus Baechler', zweitpruefung: 'N. N.',
    geprueft: ['9 Lernziele, Bloom-Stufen begruendet'],
    offen: [{ was: 'Zeitbudget M05', wo: '3_Drehbuch', fuer: 'gate-2', begruendung: 'braucht Content' }]
  });
  assert.ok(md.startsWith('# Gate 1 · 4-Augen — VL-001'));
  for (const z of ['Freigegeben:  VL-001_lernziele-drehbuch_v3.xlsx',
                   'Umbenannt in: VL-001_lernziele-drehbuch_final.xlsx',
                   'Datum:        2026-07-30, Markus Baechler',
                   'Zweitprüfung: N. N.', 'Geprüft:', '- 9 Lernziele',
                   'Offene Punkte:', '- Zeitbudget M05 (3_Drehbuch) — an gate-2: braucht Content']) {
    assert.ok(md.includes(z), z + ' fehlt');
  }
});

test('ohne offene Punkte sagt das Protokoll das ausdruecklich', () => {
  const md = inhalt.gateProtokoll({ gate: 'G', kursId: 'X', von: 'a', nach: 'b',
    datum: 'd', person: 'p', zweitpruefung: 'z', geprueft: [], offen: [] });
  assert.ok(md.includes('- keine'));
});
