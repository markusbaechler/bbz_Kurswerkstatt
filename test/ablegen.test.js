const test = require('node:test');
const assert = require('node:assert');

const { graph } = require('../app.js');
const { inhalt } = require('../inhalt.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];   // Schritt 4, inArbeit

function datei(name) { return { name: name }; }

/* ---------- Nächste Versionsnummer ---------- */

test('ein leerer Ordner ergibt v1', () => {
  assert.strictEqual(inhalt.naechsteVersion([], 'DBS-001', 'greenfield'), 1);
});

test('ein nicht gelesener Ordner ergibt ebenfalls v1', () => {
  assert.strictEqual(inhalt.naechsteVersion(null, 'DBS-001', 'greenfield'), 1);
  assert.strictEqual(inhalt.naechsteVersion(undefined, 'DBS-001', 'greenfield'), 1);
});

test('die hoechste vorhandene Nummer plus eins', () => {
  const d = [datei('DBS-001_greenfield_v1.md'), datei('DBS-001_greenfield_v2.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield'), 3);
});

test('Luecken werden nicht gefuellt — es zaehlt das Maximum', () => {
  const d = [datei('DBS-001_greenfield_v1.md'), datei('DBS-001_greenfield_v7.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield'), 8);
});

test('eine _final zaehlt nicht als Nummer, blockiert aber auch nicht', () => {
  const d = [datei('DBS-001_content_v1.md'), datei('DBS-001_content_final.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'content'), 2);
});

test('fremde Kurse und fremde Lieferobjekte zaehlen nicht mit', () => {
  const d = [datei('AFL-001_greenfield_v9.md'), datei('DBS-001_content_v5.md'),
             datei('DBS-001_greenfield_v2.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield'), 3);
});

test('eine andere Endung zaehlt MIT — die Version gilt dem Lieferobjekt', () => {
  const d = [datei('DBS-001_greenfield_v1.html')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield'), 2,
    'sonst entstuende ein zweites v1 fuer dasselbe Lieferobjekt');
});

test('Beistehendes wie _gate.md oder _verlauf stoert nicht', () => {
  const d = [datei('_gate.md'), datei('_hinweis.md'), datei('DBS-001_greenfield_v1.md')];
  assert.strictEqual(inhalt.naechsteVersion(d, 'DBS-001', 'greenfield'), 2);
});

/* ---------- Der konkrete Dateiname ---------- */

test('naechsteDatei baut Ordner und Namen aus dem Kontrakt', () => {
  /* Schritt 3 fuehrt Varianten — ohne Variante gibt es keinen Dateinamen. */
  const d = [datei('DBS-001_skript-claude_v1.docx')];
  const z = inhalt.naechsteDatei(INHALT, 3, 'DBS-001', d, 'claude');
  assert.strictEqual(z.ordner, '03_content');
  assert.strictEqual(z.datei, 'DBS-001_skript-claude_v2.docx');
  assert.strictEqual(z.version, 2);
});

/* Bis zur Reform (Auftrag 1) zielten Schritt 5 und 6 auf dieselbe Datei — sie
   teilten den Ordner 05_content. Mit acht eigenstaendigen Ordnern gibt es das
   nicht mehr, der Test entfaellt ersatzlos. */

test('naechsteDatei verweigert Schritte mit festem Dateinamen', () => {
  assert.strictEqual(inhalt.naechsteDatei(INHALT, 6, 'DBS-001', []), null);
  assert.strictEqual(inhalt.naechsteDatei(INHALT, 8, 'DBS-001', []), null);
});

/* ---------- Darf hier ueberhaupt abgelegt werden? ---------- */

test('Ablegen ist erlaubt, wo der Weg Chat vorgesehen ist', () => {
  assert.strictEqual(inhalt.darfAblegen(INHALT, 3), true);
  assert.strictEqual(inhalt.darfAblegen(INHALT, 5), true);
});

test('Ablegen ist gesperrt, wo nur Claude Code oder Handarbeit vorgesehen ist', () => {
  assert.strictEqual(inhalt.darfAblegen(INHALT, 2), false, 'Schritt 2 ist Excel');
  assert.strictEqual(inhalt.darfAblegen(INHALT, 6), false, 'Schritt 6 nur Claude Code');
});

test('Ablegen ist gesperrt, wo die Kurswerkstatt selbst schreibt', () => {
  assert.strictEqual(inhalt.darfAblegen(INHALT, 7), false);
});

/* ---------- Was das Ablegen am Stand aendert ---------- */

test('Ablegen auf einem spaeteren Schritt zieht den Kurs nach vorn', () => {
  const k = { schritt: 4, status: 'inArbeit' };
  assert.deepStrictEqual(graph.standNachAblage(k, 6), { Schritt: 6, Status: 'inArbeit' });
});

test('Ablegen auf dem aktuellen Schritt setzt ihn auf inArbeit', () => {
  const k = { schritt: 4, status: 'offen' };
  assert.deepStrictEqual(graph.standNachAblage(k, 4), { Schritt: 4, Status: 'inArbeit' });
});

test('Ablegen auf einem frueheren Schritt aendert den Stand NICHT', () => {
  const k = { schritt: 8, status: 'inArbeit' };
  assert.strictEqual(graph.standNachAblage(k, 4), null, 'Nacharbeit darf den Fortschritt nicht zuruecksetzen');
});

test('ein bereits fertiger aktueller Schritt wird durch Ablegen wieder inArbeit', () => {
  const k = { schritt: 9, status: 'fertig' };
  assert.deepStrictEqual(graph.standNachAblage(k, 9), { Schritt: 9, Status: 'inArbeit' });
});

/* ---------- Die Ablege-Fläche in der Ansicht ---------- */

const { ansichten } = require('../ansichten.js');

test('Schritt 3 bietet die Ablege-Flaeche an', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, { dateien: [] });
  assert.ok(/id="ergebnis"/.test(h), 'kein Eingabefeld');
  assert.ok(/data-action="ablegen"/.test(h), 'kein Ablegen-Knopf');
});

test('die Ablege-Flaeche nennt den Zieldateinamen vorab', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null,
    { dateien: [{ name: 'DBS-001_skript-claude_v1.docx' }] });
  assert.ok(/03_content\/DBS-001_skript-claude_v2\.docx/.test(h), 'Zielname fehlt oder falsch');
});

test('Schritt 2 bietet keine Ablege-Flaeche — Excel', () => {
  assert.ok(!/data-action="ablegen"/.test(ansichten.einSchritt(INHALT, DBS, 2, null, { dateien: [] })));
});

test('Schritt 6 bietet keine Ablege-Flaeche — nur Claude Code', () => {
  assert.ok(!/data-action="ablegen"/.test(ansichten.einSchritt(INHALT, DBS, 6, null, { dateien: [] })));
});

test('ohne Kurs gibt es keine Ablege-Flaeche', () => {
  assert.ok(!/data-action="ablegen"/.test(ansichten.einSchritt(INHALT, null, 3, null, {})));
});

test('solange der Ordner nicht gelesen ist, steht kein Zielname da', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, {});
  assert.ok(/Ordner wird gelesen/.test(h));
});

/* ---------- Der Controller legt unter der gewaehlten Variante ab ----------
   Die Ansicht kann den Namen richtig anzeigen und der Knopf trotzdem scheitern —
   beides berechnet ihn getrennt. Deshalb hier der Weg durch controller.ablegen,
   mit gestelltem Graph und gestelltem Dokument. */

const { controller, state } = require('../app.js');

function mitVarianten() {
  const i = JSON.parse(JSON.stringify(INHALT));
  i['ablage-kontrakt'].schritte['3'] = {
    ordner: '03_content', lieferobjekt: 'greenfield-{variante}',
    varianten: ['claude', 'chatgpt'], ext: 'html', format: 'html',
    wege: ['chat', 'claude-code', 'hochladen'], gate: null
  };
  return i;
}

/* Legt den Controller in einen Zustand, in dem nur noch der Klick fehlt.
   Gibt zurueck, was bei graph.ablegen ankam — und was in der Fehlerzeile steht. */
async function ablegenLauf(variante, dateien) {
  const abgelegt = { ordner: null, datei: null, text: null };
  const meldung = { textContent: '', hidden: true };

  state.data.inhalt = mitVarianten();
  state.data.kurse = [{ kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz',
                        schritt: 3, status: 'inArbeit' }];
  state.data.dateien = {};
  state.position = { bereich: 'arbeiten', kursId: 'AFL-001', schrittId: '3',
                     werkzeugId: null, werk: null, variante: variante, weg: null };

  global.document = {
    getElementById: function (id) {
      if (id === 'ergebnis') return { value: 'Entwurf aus dem Chat', focus: function () {} };
      if (id === 'ablegefehler') return meldung;
      return null;
    }
  };

  graph.ordnerInhalt = function () { return Promise.resolve(dateien || []); };
  graph.ablegen = function (kursId, ordner, datei, text) {
    abgelegt.ordner = ordner; abgelegt.datei = datei; abgelegt.text = text;
    return Promise.resolve();
  };
  graph.standSetzenRoh = function () { return Promise.resolve(); };
  controller.render = function () {};

  controller.ablegen('3', { disabled: false, textContent: 'Ablegen' });
  await new Promise(function (r) { setTimeout(r, 20); });
  return { abgelegt: abgelegt, meldung: meldung.textContent };
}

test('der Weg Chat legt unter der gewaehlten Variante ab', async () => {
  const l = await ablegenLauf('chatgpt', []);
  assert.strictEqual(l.meldung, '', 'Ablegen ist gescheitert: ' + l.meldung);
  assert.strictEqual(l.abgelegt.ordner, '03_content');
  assert.strictEqual(l.abgelegt.datei, 'AFL-001_greenfield-chatgpt_v1.html');
});

test('ohne getroffene Wahl legt der Weg Chat unter der ersten Variante ab', async () => {
  const l = await ablegenLauf(null, []);
  assert.strictEqual(l.abgelegt.datei, 'AFL-001_greenfield-claude_v1.html');
});

test('der Controller zaehlt je Variante hoch', async () => {
  const l = await ablegenLauf('claude', [{ name: 'AFL-001_greenfield-claude_v1.html' },
                                         { name: 'AFL-001_greenfield-chatgpt_v1.html' }]);
  assert.strictEqual(l.abgelegt.datei, 'AFL-001_greenfield-claude_v2.html');
});

test('der Controller legt nichts neben eine freigegebene Fassung', async () => {
  const l = await ablegenLauf('claude', [{ name: 'AFL-001_greenfield-claude_final.html' }]);
  assert.strictEqual(l.abgelegt.datei, null, 'trotz _final abgelegt');
  assert.ok(/Abgeschlossen/.test(l.meldung), 'kein Sperrhinweis: ' + l.meldung);
});
