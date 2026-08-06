const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
require('../dossier.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];   // Schritt 3, inArbeit
const AFL = KURSE[1];   // Schritt 1, offen

/* ---------- Kette ---------- */

test('die Kette zeigt alle 8 Schritte in 5 Phasen', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  assert.strictEqual((h.match(/data-action="schritt"/g) || []).length, 8);
  assert.strictEqual((h.match(/class="spanne/g) || []).length, 5);
});

test('die Kette faerbt nach dem echten Stand', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  assert.ok(/station fertig/.test(h), 'kein erledigter Schritt');
  assert.ok(/station inArbeit/.test(h), 'kein Schritt in Arbeit');
  assert.ok(/station offen/.test(h), 'kein offener Schritt');
});

test('die Kette markiert den aktiven Schritt', () => {
  var hh = ansichten.kette(INHALT, DBS, 3);
  assert.ok(/station inArbeit hier/.test(hh), 'aktive Station nicht markiert');
  assert.ok(/stbez inArbeit hier/.test(hh), 'Beschriftung der aktiven Station nicht markiert');
});

test('die Kette markiert die drei Gates', () => {
  assert.strictEqual((ansichten.kette(INHALT, DBS, null).match(/class="pruefzeichen"/g) || []).length, 3);
});

/* ---------- Alle Kurse ---------- */

test('jeder Kurs bekommt eine Zeile mit acht Punkten', () => {
  const h = ansichten.alleKurse(KURSE);
  assert.strictEqual((h.match(/data-action="kurs"/g) || []).length, 2);
  assert.strictEqual((h.match(/class="pkt /g) || []).length, 16);
});

test('der Fortschritt wird ausgewiesen', () => {
  const h = ansichten.alleKurse(KURSE);
  assert.ok(/2&#8202;\/&#8202;8/.test(h), 'DBS-001 muesste 2/8 stehen');
  assert.ok(/0&#8202;\/&#8202;8/.test(h), 'AFL-001 muesste 0/8 stehen');
});

test('eine leere Liste erzeugt eine Meldung statt einer leeren Tabelle', () => {
  assert.ok(/Noch keine Kurse/.test(ansichten.alleKurse([])));
});

test('Kurstitel werden escaped', () => {
  const boes = [Object.assign({}, DBS, { kurstitel: '<script>a</script>' })];
  assert.ok(!/<script>a<\/script>/.test(ansichten.alleKurse(boes)));
});

/* ---------- Ein Kurs ---------- */

test('die Kursansicht nennt Kurs, Titel und Fortschritt', () => {
  const h = ansichten.einKurs(INHALT, DBS);
  assert.ok(/class="schriftfeld"/.test(h), 'kein Schriftfeld');
  assert.ok(/DBS-001/.test(h));
  assert.ok(/Derivate/.test(h));
  assert.ok(/2&#8202;\/&#8202;8/.test(h), 'Stand fehlt im Schriftfeld');
});

test('die Kursansicht zeigt, was als Naechstes dran ist', () => {
  const h = ansichten.einKurs(INHALT, DBS);
  assert.ok(/Als N&auml;chstes dran/.test(h));
  assert.ok(/Schritt 3/.test(h));
  assert.ok(/Hier weiterarbeiten/.test(h));
});

test('ein unbekannter Kurs erzeugt eine Meldung statt einer Ausnahme', () => {
  assert.ok(/Nicht gefunden/.test(ansichten.einKurs(INHALT, null)));
});

/* ---------- Quellenverzeichnis (Etappe 1b) ---------- */

test('die Kursansicht zeigt das Quellenverzeichnis, wenn ein Dossier geladen ist', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: 'sspa.pdf' }],
    status: {}, offen: [], entschieden: []
  } };
  const h = ansichten.einKurs(INHALT, DBS, props);
  assert.match(h, /Quellenverzeichnis/);
  assert.match(h, /Q-001/);
});

test('ohne geladenes Dossier bleibt das Quellenverzeichnis in der Kursansicht weg', () => {
  const h = ansichten.einKurs(INHALT, DBS, {});
  assert.doesNotMatch(h, /Quellenverzeichnis/);
});

test('eine Link-Quelle im Verzeichnis wird ein escapetes <a href>, kein Dateitext', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'Sch"one Seite', herausgeber: '', stand: '2026',
                url: 'https://x.ch/pfad?a="b"', abgerufen: '2026-07-30' }],
    status: {}, offen: [], entschieden: []
  } };
  const h = ansichten.einKurs(INHALT, DBS, props);
  assert.match(h, /<a href="https:\/\/x\.ch\/pfad\?a=&quot;b&quot;" target="_blank" rel="noopener">/);
  assert.doesNotMatch(h, /<a href="https:\/\/x\.ch\/pfad\?a="b""/, 'href nicht escaped');
  assert.match(h, /Sch&quot;one Seite/);
});

test('eine javascript:-URL wird NICHT als href gerendert, nur als sichtbarer Text (Fix-Runde 1)', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'Boese Quelle', herausgeber: '', stand: '2026',
                url: 'javascript:alert(1)', abgerufen: '2026-07-30' }],
    status: {}, offen: [], entschieden: []
  } };
  const h = ansichten.einKurs(INHALT, DBS, props);
  assert.doesNotMatch(h, /href="javascript:/i, 'javascript:-URL landet im href-Attribut');
  assert.match(h, /javascript:alert\(1\)/, 'die URL ist nicht einmal als Text sichtbar');
});

test('Schritt 3 zeigt dasselbe Quellenverzeichnis, lesend', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: 'sspa.pdf' }],
    status: {}, offen: [], entschieden: []
  } };
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, props);
  assert.match(h, /Quellenverzeichnis/);
  assert.match(h, /Q-001/);
  assert.doesNotMatch(h, /data-action="quelle-erfassen"/, 'Schritt 3 erfasst nicht, nur Schritt 1');
  assert.doesNotMatch(h, /data-action="quelle-entfernen"/, 'Schritt 3 entfernt nicht, nur Schritt 1');
});

/* ---------- Ein Schritt ---------- */

test('der Kopf nennt Nummer und Namen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);
  assert.ok(/Station 3 von 8/.test(h));
  assert.ok(/>Content</.test(h));
});

test('die Schrittansicht traegt die Fertigungsstrasse mit', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);
  assert.strictEqual((h.match(/class="spanne/g) || []).length, 5);
  assert.ok(/class="gleis"/.test(h), 'kein durchgehendes Gleis');
  assert.ok(/class="schriftfeld"/.test(h), 'kein Schriftfeld');
});

test('Woher und Wohin sind da und verlinkt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);
  assert.ok(/Kommt herein/.test(h));
  assert.ok(/Geht weiter/.test(h));
  assert.ok(/Station 2 ansehen/.test(h));
  assert.ok(/Station 4 ansehen/.test(h));
});

test('Schritt 1 hat keinen Vorgaenger und sagt das', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null);
  assert.ok(/ausserhalb der Linie/.test(h));
  assert.ok(!/Station 0/.test(h));
});

test('Schritt 1 zeigt den Briefing-Status aus dem Dossier', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: { briefing: 'final' }, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /Briefing:\s*final/);
  assert.ok(!/Briefing:\s*final[^<]*ENTWURF/.test(html), 'final zeigt keinen Banner');
});

test('ohne Status im Dossier gilt Entwurf, mit Banner', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /Briefing:\s*entwurf/);
  assert.match(html, /Briefing:\s*entwurf[^<]*ENTWURF/, 'Entwurf-Banner fehlt');
});

test('Schritt 1 zeigt die erfassten Quellen und den Erfassen-Knopf', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'SSPA <Map>', herausgeber: '', stand: '2025', datei: 'sspa.pdf' }],
    status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /Q-001/);
  assert.match(html, /SSPA &lt;Map&gt;/);            /* esc() ist Pflicht */
  assert.match(html, /data-action="quelle-erfassen"/);
  assert.match(html, /name="content-modus"/);
});

/* ---------- Reihenfolge: Quellen vor Leitplanken (Etappe 1d, Entscheid Markus 2026-07-30) ---------- */

test('der Quellen-Block steht VOR den Leitplanken — erst sammeln, was hereinkommt', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.ok(html.indexOf('id="quellen"') < html.indexOf('id="briefing-felder"'),
    'Quellen-Block muesste vor der Box "briefing-felder" stehen');
});

test('der Quellen-Block nennt, was als Fachquelle verlangt bzw. sinnvoll ist', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /Kursausschreibung/);
  assert.match(html, /Nicht hierher/);
});

/* ---------- Der Quellen-Ordnerpfad kommt aus dem Kontrakt (Audit I3) ----------
   Waechter-Test: aendert sich der Schritt-3-Ordner im Ablage-Kontrakt, muss der
   UI-Hinweistext mitgehen — und '03_content' darf danach nirgends mehr in der
   Ansicht stehen. Genau das haette die alte, fest getippte Fassung nicht
   gefangen: sie hiess ueberall '03_content/quellen', egal was im Kontrakt stand. */

test('der Quellen-Hinweistext nennt den Ordner aus dem Kontrakt', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /nach 03_content\/quellen\//);
});

test('aendert sich der Schritt-3-Ordner, folgt der UI-Hinweistext mit — 03_content taucht nirgends mehr auf', () => {
  const anders = JSON.parse(JSON.stringify(INHALT));
  anders['ablage-kontrakt'].schritte['3'].ordner = '99_anders';
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(anders, AFL, 1, null, props);
  assert.match(html, /nach 99_anders\/quellen\//);
  assert.doesNotMatch(html, /03_content/, 'traegt den alten Ordner trotzdem noch — die v0.2-Falle');
});

/* ---------- Entfernen-Knopf (Etappe 1c) ---------- */

test('Schritt 1 traegt je Quelle einen Entfernen-Knopf mit der richtigen id', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [
      { id: 'Q-001', titel: 'SSPA Map', herausgeber: '', stand: '2025', datei: 'sspa.pdf' },
      { id: 'Q-002', titel: 'B', herausgeber: '', stand: '2026', datei: 'b.pdf' }
    ],
    status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /data-action="quelle-entfernen" data-quelle="Q-001"/);
  assert.match(html, /data-action="quelle-entfernen" data-quelle="Q-002"/);
});

test('die Kursansicht zeigt keinen Entfernen-Knopf — lesend', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: 'sspa.pdf' }],
    status: {}, offen: [], entschieden: []
  } };
  const h = ansichten.einKurs(INHALT, DBS, props);
  assert.doesNotMatch(h, /data-action="quelle-entfernen"/);
});

/* ---------- Kaltstart-Hinweis in Schritt 1, wenn der Kursordner fehlt (Audit I7) ----------
   Vorher liessen Quellen-Block und Briefing-Formular sich ganz normal ausfuellen,
   auch ohne Kursordner — Sichern/Erfassen scheiterten erst beim Klick an den
   Guards in app.js (state.data.ordner[kursId] === null). Jetzt steht VORHER ein
   deutlicher Kasten da, und die Knoepfe/der Modus sind gleich disabled — die
   Controller-Guards bleiben unveraendert als Doppelschutz. */

test('fehlt der Kursordner, zeigt Schritt 1 den Kaltstart-Kasten vor Quellen und Formular', () => {
  const props = { ordnerFehlt: true, dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /Zuerst die Ablage anlegen/);
  assert.match(html, /Ohne Kursordner kann nichts gesichert werden/);
  const posKasten = html.indexOf('Zuerst die Ablage anlegen');
  const posQuellen = html.indexOf('id="quellen"');
  const posFormular = html.indexOf('id="briefing-felder"');
  assert.ok(posKasten >= 0 && posKasten < posQuellen, 'Kasten steht nicht vor dem Quellen-Block');
  assert.ok(posKasten < posFormular, 'Kasten steht nicht vor dem Formular');
});

test('fehlt der Kursordner, sind Erfassen, Entfernen, Sichern und der Modus disabled', () => {
  const props = { ordnerFehlt: true, dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: '', stand: '2025', datei: 'sspa.pdf' }],
    status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.match(html, /data-action="quelle-erfassen" disabled/, 'Erfassen-Knopf nicht disabled');
  assert.match(html, /data-action="quelle-entfernen" data-quelle="Q-001" disabled/, 'Entfernen-Knopf nicht disabled');
  assert.match(html, /data-action="briefing-felder-speichern" disabled/, 'Sichern-Knopf nicht disabled');
  assert.strictEqual((html.match(/name="content-modus"[^>]*disabled/g) || []).length, 2,
    'beide Modus-Radios muessten disabled sein');
});

test('mit Kursordner bleiben Kasten und disabled weg', () => {
  const props = { ordnerFehlt: false, dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: '', stand: '2025', datei: 'sspa.pdf' }],
    status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 1, null, props);
  assert.doesNotMatch(html, /Zuerst die Ablage anlegen/);
  assert.doesNotMatch(html, /data-action="quelle-erfassen" disabled/);
  assert.doesNotMatch(html, /data-action="quelle-entfernen" data-quelle="Q-001" disabled/);
  assert.doesNotMatch(html, /data-action="briefing-felder-speichern" disabled/);
  assert.doesNotMatch(html, /data-action="content-modus"[^>]*disabled/);
});

/* ---------- Etappe 2, Task 3: Schritt 2 erbt aus dem Dossier ---------- */

test('Schritt 2 ohne freigegebenes Briefing zeigt den Kein-freigegebenes-Briefing-Kasten', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 2, null, props);
  assert.match(html, /Kein freigegebenes Briefing/);
  assert.match(html, /class="box achtung"/, 'dieselbe Kasten-Optik wie der Kaltstart-Hinweis fehlt');
});

test('Schritt 2 mit freigegebenem Briefing (status.briefing final) zeigt keinen Kasten', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'AFL-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: { briefing: 'final' }, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, AFL, 2, null, props);
  assert.doesNotMatch(html, /Kein freigegebenes Briefing/);
});

/* ---------- A3, Etappe 3: Schritt 3 erbt aus dem Dossier + Contract ---------- */

test('Schritt 3 ohne freigegebenen Contract (Gate 1) zeigt den Kein-freigegebener-Contract-Kasten', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, DBS, 3, null, props);
  assert.match(html, /Kein freigegebener Contract/);
  assert.match(html, /class="box achtung"/, 'dieselbe Kasten-Optik wie der Schritt-2-Kaltstart-Hinweis fehlt');
  /* Knoepfe bleiben bedienbar (Muster Schritt-2-Kasten) — kein disabled im Kasten selbst. */
});

test('Schritt 3 mit freigegebenem Contract (status final, ueber ablageVon(2).lieferobjekt) zeigt keinen Kasten', () => {
  const lieferobjekt2 = INHALT['ablage-kontrakt'].schritte['2'].lieferobjekt;
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: { [lieferobjekt2]: 'final' }, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, DBS, 3, null, props);
  assert.doesNotMatch(html, /Kein freigegebener Contract/);
});

/* ---------- V3, Etappe 4: Schritt 4 erbt aus den Schritt-3-Varianten + Contract ---------- */

test('Schritt 4 zeigt KEINEN Kasten, wenn beide Skript-Varianten (docx + .blocks-Schwester) ' +
     'im 03_content-Cache liegen UND der Contract final ist', () => {
  const liefClaude = inhalt.lieferobjektVon(INHALT, '3', 'claude');
  const liefChatgpt = inhalt.lieferobjektVon(INHALT, '3', 'chatgpt');
  const lieferobjekt2 = INHALT['ablage-kontrakt'].schritte['2'].lieferobjekt;
  const props = {
    dossier: {
      dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
      quellen: [], status: {}, offen: [], entschieden: []
    },
    dateien03: [
      { name: `DBS-001_${liefClaude}_v2.docx` }, { name: `DBS-001_${liefClaude}_v2.blocks` },
      { name: `DBS-001_${liefChatgpt}_v1.docx` }, { name: `DBS-001_${liefChatgpt}_v1.blocks` }
    ],
    dateien02: [{ name: `DBS-001_${lieferobjekt2}_final.xlsx` }]
  };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.doesNotMatch(html, /Schritt 4 braucht beide Skript-Varianten/);
});

test('Schritt 4 zeigt den Kasten, wenn eine Skript-Variante fehlt (chatgpt hat keine .blocks-Schwester)', () => {
  const liefClaude = inhalt.lieferobjektVon(INHALT, '3', 'claude');
  const liefChatgpt = inhalt.lieferobjektVon(INHALT, '3', 'chatgpt');
  const lieferobjekt2 = INHALT['ablage-kontrakt'].schritte['2'].lieferobjekt;
  const props = {
    dossier: {
      dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
      quellen: [], status: {}, offen: [], entschieden: []
    },
    dateien03: [
      { name: `DBS-001_${liefClaude}_v2.docx` }, { name: `DBS-001_${liefClaude}_v2.blocks` },
      { name: `DBS-001_${liefChatgpt}_v1.docx` }   /* .blocks-Schwester fehlt */
    ],
    dateien02: [{ name: `DBS-001_${lieferobjekt2}_final.xlsx` }]
  };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /Schritt 4 braucht beide Skript-Varianten/);
  assert.match(html, /class="box achtung"/, 'dieselbe Kasten-Optik wie die Schritt-2\/3-Kaltstart-Hinweise fehlt');
});

test('Schritt 4 zeigt den Kasten, wenn beide Varianten liegen, der Contract aber nicht final ist', () => {
  const liefClaude = inhalt.lieferobjektVon(INHALT, '3', 'claude');
  const liefChatgpt = inhalt.lieferobjektVon(INHALT, '3', 'chatgpt');
  const lieferobjekt2 = INHALT['ablage-kontrakt'].schritte['2'].lieferobjekt;
  const props = {
    dossier: {
      dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
      quellen: [], status: {}, offen: [], entschieden: []
    },
    dateien03: [
      { name: `DBS-001_${liefClaude}_v2.docx` }, { name: `DBS-001_${liefClaude}_v2.blocks` },
      { name: `DBS-001_${liefChatgpt}_v1.docx` }, { name: `DBS-001_${liefChatgpt}_v1.blocks` }
    ],
    dateien02: [{ name: `DBS-001_${lieferobjekt2}_v3.xlsx` }]  /* kein _final */
  };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /Schritt 4 braucht beide Skript-Varianten/);
});

/* ---------- D4, Etappe 5: Schritt 5 startet erst nach dem Sign-off (Schritt 4) ---------- */

test('Schritt 5 zeigt den Kasten, solange die _final-Fassung des Contents (Schritt 4) fehlt', () => {
  const lieferobjekt4 = INHALT['ablage-kontrakt'].schritte['4'].lieferobjekt;
  const props = {
    dossier: {
      dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
      quellen: [], status: {}, offen: [], entschieden: []
    },
    dateien04: [{ name: `DBS-001_${lieferobjekt4}_v3.docx` }]  /* kein _final */
  };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /Kein freigegebener Content/);
  assert.match(html, /class="box achtung"/, 'dieselbe Kasten-Optik wie die Schritt-2\/3\/4-Kaltstart-Hinweise fehlt');
  assert.match(html, /Sign-off \(Schritt 4\)/);
});

test('Schritt 5 zeigt KEINEN Kasten, wenn die _final-Fassung des Contents (Schritt 4) vorliegt', () => {
  const lieferobjekt4 = INHALT['ablage-kontrakt'].schritte['4'].lieferobjekt;
  const props = {
    dossier: {
      dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
      quellen: [], status: {}, offen: [], entschieden: []
    },
    dateien04: [{ name: `DBS-001_${lieferobjekt4}_final.docx` }]
  };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.doesNotMatch(html, /Kein freigegebener Content/);
});

test('Schritt 5 zeigt den Kasten, wenn dateien04 gar nicht geladen ist (undefined)', () => {
  const props = {
    dossier: {
      dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
      quellen: [], status: {}, offen: [], entschieden: []
    }
  };
  const html = ansichten.einSchritt(INHALT, DBS, 5, null, props);
  assert.match(html, /Kein freigegebener Content/);
});

test('die Anleitung steht ausgeklappt da, nicht als Klappe', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);
  assert.ok(/So gehst du vor/.test(h));
  assert.ok(/Prompt kopieren<\/span>/.test(h), 'erster Anleitungsschritt fehlt');
  assert.ok(/class="ddc do"/.test(h), 'Do fehlt');
  assert.ok(/class="ddc dont"/.test(h), 'Dont fehlt');
});

test('der Masterprompt liegt inline, mit Kopier-Knopf', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);
  assert.ok(/data-action="werkzeug" data-werkzeug="prompt-greenfield"/.test(h));
  assert.ok(/data-action="kopieren"/.test(h));
});

test('die Anleitung erscheint NICHT nochmals als Klappe', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);
  assert.ok(!/data-werkzeug="guide-3"/.test(h), 'Anleitung doppelt gezeigt');
});

test('das aufgeklappte Werkzeug ist markiert', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, 'prompt-greenfield');
  assert.ok(/class="wtool instrument auf"/.test(h), 'Masterprompt nicht als aufgeklappt markiert');
  assert.ok(/zuklappen/.test(h), 'Knopf sagt nicht zuklappen');
});

test('die Ablage nach Kontrakt wird angezeigt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);
  assert.ok(/03_content\/<b>DBS-001_skript-claude_v\{N\}\.docx<\/b>/.test(h));
});

test('das Uebergabekriterium steht da', () => {
  assert.ok(/Fertig, wenn/.test(ansichten.einSchritt(INHALT, DBS, 3, null)));
});

test('ein Gate-Schritt zeigt sein Gate, ein gate-loser nicht', () => {
  assert.ok(/Gate 1/.test(ansichten.einSchritt(INHALT, DBS, 2, null)));
  assert.ok(!/gatetag/.test(ansichten.einSchritt(INHALT, DBS, 3, null)));
});

test('Weiter ist gesperrt, solange der Schritt nicht erledigt ist', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);   // Schritt 3 inArbeit
  assert.ok(/class="weiter" data-action="schritt" data-schritt="4" disabled/.test(h));
});

test('Weiter ist frei, wenn der Schritt erledigt ist', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 2, null);   // 2 < 3, also fertig
  assert.ok(/data-schritt="3">Weiter/.test(h));
  assert.ok(!/data-schritt="3" disabled/.test(h));
});

test('Schritt 8 bietet kein Weiter an', () => {
  assert.ok(!/Weiter zu Schritt 9/.test(ansichten.einSchritt(INHALT, DBS, 8, null)));
});

test('ohne Kurs gibt es keinen Erledigt-Haken', () => {
  assert.ok(!/data-action="erledigt"/.test(ansichten.einSchritt(INHALT, null, 3, null)));
});

test('die zulaessigen Wege werden angezeigt', () => {
  assert.ok(/Im Chat/.test(ansichten.einSchritt(INHALT, DBS, 3, null)));
  assert.ok(/Mit Claude Code/.test(ansichten.einSchritt(INHALT, DBS, 3, null)));
  const s6 = ansichten.einSchritt(INHALT, DBS, 6, null);
  assert.ok(/Mit Claude Code/.test(s6));
  assert.ok(!/Im Chat/.test(s6), 'Schritt 6 laeuft nur ueber Claude Code');
});

test('ein unbekannter Schritt erzeugt eine Meldung statt einer Ausnahme', () => {
  assert.ok(/Unbekannt/.test(ansichten.einSchritt(INHALT, DBS, 99, null)));
});

/* ---------- Nachschlagen ---------- */

test('Nachschlagen zeigt alle drei Werke als Reiter', () => {
  const h = ansichten.nachschlagen(INHALT, null);
  assert.ok(/data-werk="didaktik"/.test(h));
  assert.ok(/data-werk="promptcraft"/.test(h));
  assert.ok(/data-werk="governance"/.test(h));
});

test('Nachschlagen zeigt Bloom im didaktischen Modell', () => {
  const h = ansichten.nachschlagen(INHALT, 'didaktik');
  assert.ok(/Bloom-Kalibrierung/.test(h));
  assert.ok(/Bloom-Anker/.test(h));
});

test('Nachschlagen wechselt das Werk', () => {
  const h = ansichten.nachschlagen(INHALT, 'governance');
  assert.ok(/Datenklassen/.test(h));
  assert.ok(/Governance-Richtlinien/.test(h));
});

test('ein unbekanntes Werk faellt auf das erste zurueck', () => {
  assert.ok(/Didaktisches Modell/.test(ansichten.nachschlagen(INHALT, 'gibtsnicht')));
});

test('tote Verweise aus v0.2 werden zu Text, der Wortlaut bleibt', () => {
  const roh = 'Die Prompts liegen in der <button class="linklike" data-open-tool="x" ' +
              'style="all:unset;color:teal">Toolbox</button> bereit.';
  const h = ansichten.entschaerfe(roh);
  assert.ok(!/<button/.test(h), 'Knopf noch da');
  assert.ok(/<span class="verweis">Toolbox<\/span>/.test(h), 'Wortlaut verloren');
  assert.ok(/Die Prompts liegen in der /.test(h) && /bereit\./.test(h), 'Satz zerschnitten');
});

test('entschaerfe laesst andere Knoepfe unberuehrt', () => {
  const roh = '<button class="knopf" data-action="ablegen">Ablegen</button>';
  assert.strictEqual(ansichten.entschaerfe(roh), roh);
});

test('Nachschlagen traegt dasselbe Schriftfeld wie die Laufkarte', () => {
  const h = ansichten.nachschlagen(INHALT, 'didaktik');
  assert.ok(/class="schriftfeld"/.test(h), 'kein Schriftfeld');
  assert.ok(/Nachschlagewerk/.test(h), 'Werk nicht benannt');
  assert.ok(!/class="eyebrow"/.test(h), 'alte Kopfvorlage noch da');
});

test('jedes Kapitel ist ankerbar und steht im Verzeichnis', () => {
  const h = ansichten.nachschlagen(INHALT, 'didaktik');
  const anz = INHALT.referenz.didaktik.abschnitte.length;
  assert.strictEqual((h.match(/id="kap-\d+"/g) || []).length, anz, 'Anker fehlen');
  assert.strictEqual((h.match(/href="#kap-\d+"/g) || []).length, anz, 'Verzeichnis unvollstaendig');
  assert.ok(/class="kapliste"/.test(h), 'kein Kapitelverzeichnis');
});

/* ---------- Standort und Ordner-Verknuepfung ---------- */

test('die Kette sagt im Klartext, wo man ist', () => {
  const h = ansichten.kette(INHALT, DBS, 3);
  assert.ok(/station inArbeit hier/.test(h), 'aktive Station fehlt');
  assert.ok(/spanne an/.test(h), 'aktive Phase nicht markiert');
  assert.ok(/Inhalt entwerfen/.test(h), 'Phase fehlt');
});

test('ohne aktiven Schritt gibt es keine Standort-Marke', () => {
  assert.ok(!/ hier"/.test(ansichten.kette(INHALT, DBS, null)), 'ohne aktiven Schritt darf nichts markiert sein');
});

test('die Phase des aktiven Schritts wird hervorgehoben', () => {
  const h = ansichten.kette(INHALT, DBS, 4);
  assert.ok(/class="strasse fokus"/.test(h));
  assert.strictEqual((h.match(/spanne an"/g) || []).length, 1, 'genau eine Phase aktiv');
});

test('die Dateiliste zeigt Ladezustand, Leere und Inhalt unterschiedlich', () => {
  assert.ok(/wird geladen/.test(ansichten.dateiliste(undefined, null, '04_greenfield')));
  assert.ok(/nicht gefunden/.test(ansichten.dateiliste(null, null, '04_greenfield')));
  assert.ok(/Noch leer/.test(ansichten.dateiliste([], null, '04_greenfield')));
});

test('die Dateiliste verlinkt jede Datei nach SharePoint', () => {
  const h = ansichten.dateiliste(
    [{ name: 'DBS-001_greenfield_v1.md', webUrl: 'https://x/y.md', size: 2048,
       lastModifiedDateTime: '2026-07-21T10:00:00Z' }],
    'https://x/04_greenfield', '04_greenfield');
  assert.ok(/href="https:\/\/x\/y\.md"/.test(h));
  assert.ok(/DBS-001_greenfield_v1\.md/.test(h));
  assert.ok(/2 KB/.test(h));
  assert.ok(/21\.07\.2026/.test(h));
  assert.ok(/href="https:\/\/x\/04_greenfield"/.test(h), 'Ordner-Link fehlt');
});

test('der Zielordner ist aus der Schrittansicht heraus zu oeffnen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null,
    { basisUrl: 'https://sp/Kursproduktion/DBS-001_x', dateien: [] });
  assert.ok(/href="https:\/\/sp\/Kursproduktion\/DBS-001_x\/03_content"/.test(h));
});

test('der Vorgaenger-Ordner ist aus Kommt-herein heraus zu oeffnen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null,
    { basisUrl: 'https://sp/Kursproduktion/DBS-001_x', dateien: [] });
  assert.ok(/href="https:\/\/sp\/Kursproduktion\/DBS-001_x\/02_lernziele"/.test(h),
    'Link auf den Lernziele-Ordner aus Schritt 2 fehlt');
});

test('ohne Basis-URL bleiben die Pfade lesbar, aber ohne Link', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, {});
  assert.ok(/03_content\/<b>DBS-001_skript-claude_v\{N\}\.docx<\/b>/.test(h));
  assert.ok(!/href="undefined/.test(h));
});

/* ---------- Der Masterprompt ist das Instrument ---------- */

test('der Masterprompt traegt eigenes Gewicht, nicht die Zeilendarstellung', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, {});
  assert.ok(/class="wtool instrument/.test(h), 'Masterprompt nicht als Instrument ausgezeichnet');
  assert.ok(/class="wtitel"><h3>/.test(h), 'Titel nicht als Ueberschrift');
});

test('der Prompt ist kopierbar OHNE ihn aufzuklappen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, {});   // nichts aufgeklappt
  const kopf = h.slice(h.indexOf('class="wkopf"'), h.indexOf('class="wbody"'));
  assert.ok(/data-action="kopieren"/.test(kopf), 'Kopier-Knopf steckt im aufklappbaren Teil');
});

test('der Masterprompt steht VOR den Leitplanken', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, {});
  assert.ok(h.indexOf('Dein Masterprompt') < h.indexOf('Leitplanken'),
    'Do/Dont steht vor dem Werkzeug');
});

test('der Masterprompt steht NACH der Anleitung, die ihn erwaehnt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, {});
  assert.ok(h.indexOf('So gehst du vor') < h.indexOf('Dein Masterprompt'));
});

test('Vorlagen bleiben ruhig — kein Instrument', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 2, null, {});
  assert.ok(/data-werkzeug="tpl-contract"/.test(h), 'Vorlage fehlt');
  const karte = h.slice(h.indexOf('wt-tpl-contract'));
  assert.ok(!/instrument/.test(karte.slice(0, 200)), 'Vorlage faelschlich als Instrument');
});

test('ohne Masterprompt gibt es auch keine Masterprompt-Ueberschrift', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 5, null, {});
  assert.ok(!/Dein Masterprompt/.test(h));
});

/* ---------- Die Laufkarte: Schriftfeld und Gleis ---------- */

test('das Schriftfeld nennt Kennung, Gegenstand und Stand', () => {
  const h = ansichten.schriftfeld(INHALT, DBS, null);
  assert.ok(/class="fk">Kurs</.test(h));
  assert.ok(/class="fk">Gegenstand</.test(h));
  assert.ok(/class="fk">Stand</.test(h));
  assert.ok(/fw kennung">DBS-001/.test(h), 'Kurs-ID nicht als Kennung ausgezeichnet');
});

test('in der Schrittansicht kommen Station und Phase dazu', () => {
  const s = { id: '4', nm: 'Green-field W-Content' };
  const h = ansichten.schriftfeld(INHALT, DBS, s);
  assert.ok(/class="fk">Station</.test(h));
  assert.ok(/class="fk">Phase</.test(h));
  assert.ok(/Inhalt entwerfen/.test(h));
});

test('ohne Kurs und ohne Schritt bleibt das Schriftfeld leer', () => {
  assert.strictEqual(ansichten.schriftfeld(INHALT, null, null), '');
});

test('das Gleis ist gefuellt bis zum letzten erledigten Punkt', () => {
  const h = ansichten.kette(INHALT, DBS, null);   // 2 von 8 erledigt
  const m = /<i style="width:([\d.]+)%"/.exec(h);
  assert.ok(m, 'keine Fuellung im Gleis');
  const soll = ((2 - 0.5) / 8 * 100).toFixed(2);
  assert.strictEqual(m[1], soll, 'Fuellung endet nicht auf dem zweiten Punkt');
});

test('ohne Kurs ist das Gleis leer', () => {
  const h = ansichten.kette(INHALT, null, null);
  assert.ok(/<i style="width:0.00%"/.test(h));
});

test('jede Station steht in ihrer eigenen Rasterspalte', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  for (let i = 1; i <= 8; i++) {
    assert.ok(h.indexOf('grid-column:' + i + '"') >= 0, 'Spalte ' + i + ' fehlt');
  }
});

/* ---------- Standort: die Navigationszeile ---------- */

test('Standort zeigt beide Raeume, der aktive ist markiert', () => {
  const h = ansichten.standort(INHALT, null, { bereich: 'arbeiten' });
  assert.ok(/data-bereich="arbeiten"/.test(h) && /data-bereich="nachschlagen"/.test(h));
  assert.ok(/class="an" data-action="bereich" data-bereich="arbeiten"/.test(h),
            'Arbeiten nicht als aktiver Raum markiert');
});

test('Standort zeigt den Weg schon auf der obersten Ebene', () => {
  /* Die alte Leiste blendete den Pfad aus, solange man nicht tief drin war —
     genau dann fehlte die Auskunft, wo man ist. */
  const h = ansichten.standort(INHALT, null, { bereich: 'arbeiten' });
  assert.ok(/class="spur"/.test(h), 'keine Spur');
  assert.ok(/Alle Kurse/.test(h));
});

test('Standort fuehrt vom Schritt ueber den Kurs zurueck zur Liste', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '3' });
  assert.ok(/data-action="kurse"/.test(h), 'kein Rueckweg zur Liste');
  assert.ok(/data-action="kurs" data-kurs="DBS-001"/.test(h), 'kein Rueckweg zum Kurs');
  assert.ok(/class="hier">.*Content/.test(h),
            'aktuelle Station nicht als Standort markiert');
});

test('im Kurs ist der Kurs selbst der Standort, nicht mehr anklickbar', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten' });
  assert.ok(!/data-action="kurs"/.test(h), 'Kurs verweist auf sich selbst');
  assert.ok(/class="hier"[^>]*>.*DBS-001/.test(h), 'Kurs nicht als Standort markiert');
});

test('Stationswahl springt zu Nachbarschritten', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '3' });
  assert.ok(/data-action="schritt" data-schritt="2"/.test(h), 'kein Weg zurueck');
  assert.ok(/data-action="schritt" data-schritt="4"/.test(h), 'kein Weg vorwaerts');
  assert.ok(/3&#8202;\/&#8202;8/.test(h), 'Zaehler fehlt');
});

test('an den Enden der Strasse zeigt die Stationswahl ins Leere', () => {
  const erst = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '1' });
  assert.ok(/class="wechsel aus"/.test(erst), 'vor Schritt 1 muesste tot sein');
  assert.ok(/data-schritt="2"/.test(erst));
  const letzt = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '8' });
  assert.ok(/class="wechsel aus"/.test(letzt), 'nach Schritt 8 muesste tot sein');
  assert.ok(/data-schritt="7"/.test(letzt));
});

test('ohne Schritt gibt es keine Stationswahl', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten' });
  assert.ok(!/class="stationswahl"/.test(h));
});

test('im Nachschlagen nennt die Spur das Werk statt eines Kurses', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'nachschlagen', werk: 'promptcraft' });
  assert.ok(/Prompt-Handwerk/.test(h), 'Werk nicht benannt');
  assert.ok(!/class="hier">Nachschlagen</.test(h), 'Raumname doppelt: Umschalter und Spur');
  assert.ok(!/DBS-001/.test(h), 'Kurs gehoert nicht in diesen Raum');
  assert.ok(!/class="stationswahl"/.test(h), 'Stationswahl gehoert nicht in diesen Raum');
});

test('ein unbekanntes Werk faellt in der Spur auf das erste zurueck', () => {
  const h = ansichten.standort(INHALT, null, { bereich: 'nachschlagen', werk: 'gibtsnicht' });
  assert.ok(/Didaktisches Modell/.test(h));
});

test('die Kursliste traegt das Schriftfeld, nicht die alte Vorlage', () => {
  const h = ansichten.alleKurse([DBS]);
  assert.ok(/class="schriftfeld"/.test(h), 'kein Schriftfeld');
  assert.ok(/Auftragsbuch/.test(h));
  assert.ok(!/class="eyebrow"/.test(h), 'alte Vorlage noch da');
  assert.ok(!/kdot gate/.test(h), 'Gate-Legende passt nicht zur Liste');
});

/* ---------- Fehlender Kursordner ---------- */

test('fehlt der Kursordner, bietet die Kursansicht das Anlegen an', () => {
  const h = ansichten.einKurs(INHALT, DBS, { ordnerFehlt: true });
  assert.ok(/class="fehlt"/.test(h), 'keine Sperre');
  assert.ok(/data-action="ablage-anlegen"/.test(h), 'kein Knopf zum Anlegen');
  assert.ok(/id="ordnername"/.test(h), 'kein Feld fuer den Ordnernamen');
});

test('der vorgeschlagene Name steht im Feld und ist der abgeleitete', () => {
  const h = ansichten.einKurs(INHALT, AFL, { ordnerFehlt: true });
  assert.ok(h.indexOf('value="AFL-001_anlagefondslizenz"') >= 0, 'kein Vorschlag im Feld');
});

test('die Sperre nennt alle acht Unterordner, die entstehen', () => {
  const h = ansichten.einKurs(INHALT, AFL, { ordnerFehlt: true });
  ['00_input', '01_briefing', '02_lernziele', '03_content', '04_validierung',
   '05_didaktik', '06_moodle', '07_abnahme', '08_backbone'].forEach(function (o) {
    assert.ok(h.indexOf('<code>' + o + '</code>') >= 0, o + ' fehlt');
  });
});

test('das alte Versprechen „von Hand anlegen" ist verschwunden', () => {
  const h = ansichten.einKurs(INHALT, AFL, { ordnerFehlt: true });
  assert.ok(!/von Hand anlegen/.test(h));
  assert.ok(!/kann ihn noch nicht selbst anlegen/.test(h));
});

/* Der Manifest-Knopf von Schritt 2 ist mit der Reform (Auftrag 1) entfallen:
   der bisherige eigene Schritt dafuer ist in Schritt 1 aufgegangen, sein
   einziges echtes Lieferobjekt (02_setup/{K}_manifest.json) hat keinen Ordner
   der neuen Acht mehr. data-action="manifest-schreiben" gibt es nicht mehr,
   die vier Tests dazu entfallen ersatzlos. Was blieb — die Projekt-Instruktionen
   — steht jetzt in Schritt 1 und ist dort in test/instruktionen.test.js
   abgedeckt ("Der Block in Schritt 1"). */

test('solange nichts nachgesehen wurde, wird nichts behauptet', () => {
  /* undefined heisst „noch nicht nachgesehen" — daraus darf keine Warnung werden. */
  assert.ok(!/class="fehlt"/.test(ansichten.einKurs(INHALT, DBS, {})));
  assert.ok(!/class="fehlt"/.test(ansichten.einKurs(INHALT, DBS)));
  assert.ok(!/class="fehlt"/.test(ansichten.einKurs(INHALT, DBS, { ordnerFehlt: false })));
});

test('die Schrittansicht warnt statt ein Versprechen zu geben', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, { ordnerFehlt: true });
  assert.ok(/class="fehlt"/.test(h), 'keine Sperre in der Schrittansicht');
  assert.ok(!/Legt die Kurswerkstatt an/.test(h),
            'verspricht Ablage, obwohl der Ordner fehlt');
});

test('mit Ordner bleibt das Versprechen stehen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, { ordnerFehlt: false });
  assert.ok(/Legt die Kurswerkstatt an/.test(h));
  assert.ok(!/class="fehlt"/.test(h));
});

/* Schritt 3 selbst bietet seit A2 (docx-Lieferobjekt) keinen Ablegen-Block
   mehr an (s. test/ablegen.test.js) — Schritt 5 trug bis zur Fixwave nach dem
   Etappe-5-Review (C-1) noch die Ablege-Flaeche, seither ist auch sein
   Lieferobjekt eine Datei (blocks). Schritt 1 (md) bleibt textbasiert und
   traegt die Ablege-Flaeche unveraendert, deshalb hier als Beleg fuer den
   generellen Mechanismus. */
test('die Schrittansicht haelt einen Platz fuer die Fehlermeldung bereit', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null);
  assert.ok(/id="ablegefehler"/.test(h), 'kein Platz fuer die Meldung');
  assert.ok(/id="ablegefehler" hidden/.test(h), 'Meldung ist nicht von Anfang an versteckt');
});

/* ---------- Etappe 2, Task 5 -> Z9: Gate-Box ----------
   Z9 (Entscheid Markus, 2026-07-30, Live-Einsatz "das schaut kein Schwein an"):
   die Pruefliste/Erfassung offener Punkte (Task 5) ist VOLLSTAENDIG aus der
   Gate-Box entfernt — auch nicht eingeklappt, auch nicht bedingt. Die Tests
   dafuer (Punkt-Text, offen-was/-erfassen/-entscheiden/-verschieben,
   Leerfall-Text, Escaping eines offenen Punkts) sind ersatzlos entfallen; die
   Schutzwirkung (Escaping von Fremdwerten) bleibt an anderer Stelle bestehen
   (Dossier-Felder werden nach wie vor durchgehend escaped, s. Quellen-/
   Regulatorik-Tests). Was bleibt: dossier.offenNeu/offenFuer/offenEntscheiden/
   offenVerschieben und die gleichnamigen Controller-Handler (Datentraeger fuer
   die Etappe-4-Review-Vorlage, s. test/gate.test.js) sowie die S2-Sperre in
   controller.gateKlick — beide unveraendert. */

test('Schritt 3 (kein Gate im Kontrakt) zeigt keine Gate-Box', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, DBS, 3, null, props);
  assert.doesNotMatch(html, /id="gate-block"/);
});

test('Gate-Box ohne Dossier zeigt den kurzen Hinweis statt des Freigabe-Teils', () => {
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, {});
  assert.match(html, /id="gate-block"/);
  assert.match(html, /Gate braucht das Dossier/);
  assert.doesNotMatch(html, /id="gate-zweitpruefung"/);
});

test('Gate-Box bleibt aussen vor, solange der Kursordner fehlt', () => {
  const props = { ordnerFehlt: true, dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.match(html, /Gate braucht das Dossier/);
  assert.doesNotMatch(html, /id="gate-zweitpruefung"/);
});

test('Z9: die Gate-Box zeigt keinerlei Punkte-UI mehr — kein offen-was/-erfassen, keine Liste, kein "Keine offenen Punkte"-Satz', () => {
  const props = { dossier: {
    dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [{ was: 'Bloom-Stufe 3 pruefen', wo: 'LZ-004', fuer: 'gate-1' }],
    entschieden: []
  } };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.doesNotMatch(html, /Bloom-Stufe 3 pruefen/, 'ein offener Punkt wird nicht mehr gerendert');
  assert.doesNotMatch(html, /id="offen-was"/);
  assert.doesNotMatch(html, /data-action="offen-erfassen"/);
  assert.doesNotMatch(html, /data-action="offen-entscheiden"/);
  assert.doesNotMatch(html, /data-action="offen-verschieben"/);
  assert.doesNotMatch(html, /Keine offenen Punkte/);
});

test('Z9: offene Punkte im Dossier sperren den Gate-Knopf in der ANSICHT NICHT mehr — S2 bleibt reiner Controller-Waechter', () => {
  const d = dossierOhneOffen();
  d.offen = [{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }];
  const props = { dossier: d, dateien: [{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }] };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.doesNotMatch(html, /data-action="gate-klick"[^>]*disabled/,
    'die Ansicht sperrt wegen offener Punkte — das darf sie seit Z9 nicht mehr, die Sperre bleibt im Controller');
});

/* ---------- Etappe 2, Task 6: der Freigabe-Teil der Gate-Box ---------- */

function dossierOhneOffen() {
  return { dossier: 1, kurs: 'DBS-001', scope: {}, regulatorik: {}, content_modus: 'quellengestuetzt',
    quellen: [], status: {}, offen: [], entschieden: [] };
}

/* ---------- Z9: Radio-Liste, "Freigabe erteilt durch", "Als final bestaetigen" ---------- */

test('mit genau einer versionierten Datei zeigt die Gate-Box sie vorausgewaehlt, das Namensfeld und einen freien Knopf', () => {
  const props = { dossier: dossierOhneOffen(), dateien: [{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }] };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.match(html, /name="gate-version"[^>]*value="DBS-001_lernziele-drehbuch_v3\.xlsx"[^>]*checked/);
  assert.match(html, /Wird zu:.*DBS-001_lernziele-drehbuch_final\.xlsx/s);
  assert.match(html, /data-action="gate-klick"[^>]*data-schritt="2"/);
  assert.doesNotMatch(html, /data-action="gate-klick"[^>]*disabled/);
  assert.match(html, /Freigabe erteilt durch/);
  assert.match(html, /id="gate-zweitpruefung"[^>]*data-gate-feld/);
  assert.doesNotMatch(html, /id="gate-geprueft"/, 'das Geprueft-Textfeld ist mit Z9 entfernt');
  assert.match(html, />Als final best&auml;tigen</);
  assert.match(html, /id="gate-melde"/);
});

test('mit mehreren Fassungen ist die hoechste vorausgewaehlt, jede niedrigere traegt einen Hinweis auf die hoehere', () => {
  const props = { dossier: dossierOhneOffen(), dateien: [
    { name: 'DBS-001_lernziele-drehbuch_v3.xlsx' },
    { name: 'DBS-001_lernziele-drehbuch_v5.xlsx' },
    { name: 'DBS-001_lernziele-drehbuch_v4.xlsx' }
  ] };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  const v5 = /<label[^>]*><input type="radio" name="gate-version" value="DBS-001_lernziele-drehbuch_v5\.xlsx"[^>]*checked[^>]*>[^<]*<code>DBS-001_lernziele-drehbuch_v5\.xlsx<\/code>\s*<\/label>/;
  assert.match(html, v5, 'die hoechste Fassung (v5) ist nicht vorausgewaehlt bzw. traegt selbst einen Hinweis');
  assert.match(html, /value="DBS-001_lernziele-drehbuch_v4\.xlsx"[^>]*>[\s\S]*?es existiert bereits DBS-001_lernziele-drehbuch_v5\.xlsx/);
  assert.match(html, /value="DBS-001_lernziele-drehbuch_v3\.xlsx"[^>]*>[\s\S]*?es existiert bereits DBS-001_lernziele-drehbuch_v5\.xlsx/);
});

/* V6 Fix-Runde 1 (CRITICAL-Fix): Schritt 4 legt docx UND blocks unter demselben
   _vN-Versionsstamm ab (B5/V4) — ohne endung-Filter in versionenVon() zeigte die
   Radio-Liste beide Dateien als zwei separate, gleichwertige "Fassungen" derselben
   Version, und ob docx oder blocks auf Platz 0 (vorausgewaehlt/checked) landete,
   hing von der Reihenfolge ab, in der Graph den Ordner zurueckgab. Wurde die
   .blocks-Datei bestaetigt, benannte gateKlick sie zur Word-Endung um —
   Datenverlust-Risiko im Normalbetrieb (unabhaengiger Review). Seit dem Fix zeigt
   die Radio-Liste ausschliesslich Fassungen der erwarteten Kontrakt-Endung. */
test('V6 Fix-Runde 1 (CRITICAL): Schritt 4 zeigt in der Radio-Liste NUR die docx-Hauptfassung, nie die .blocks-Geschwisterdatei desselben Stamms', () => {
  const props = { dossier: dossierOhneOffen(), dateien: [
    { name: 'DBS-001_content_v3.docx' },
    { name: 'DBS-001_content_v3.blocks' }
  ] };
  const html = ansichten.einSchritt(INHALT, DBS, 4, null, props);
  assert.match(html, /name="gate-version"[^>]*value="DBS-001_content_v3\.docx"[^>]*checked/,
    'die docx-Fassung fehlt oder ist nicht vorausgewaehlt');
  assert.doesNotMatch(html, /value="DBS-001_content_v3\.blocks"/,
    'die Blockdatei darf nie als eigene, waehlbare Fassung erscheinen');
  const radioCount = (html.match(/name="gate-version"/g) || []).length;
  assert.strictEqual(radioCount, 1, 'nur EIN Radio je Versionsstamm, nicht eins je Endung');
});

test('Z9: offene Punkte im Dossier sperren den Gate-Knopf in der Ansicht nicht mehr (S2 bleibt Controller-Waechter, s. o.)', () => {
  const d = dossierOhneOffen();
  d.offen = [{ was: 'Bloom-Stufe pruefen', wo: 'LZ-004', fuer: 'gate-1' }];
  const props = { dossier: d, dateien: [{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }] };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.doesNotMatch(html, /data-action="gate-klick"[^>]*disabled/);
  assert.doesNotMatch(html, /entscheiden oder begr.ndet verschieben/);
});

/* F1 (Fix-Runde 1, Review-Finding): "bereits freigegeben" darf den Knopf nur sperren, wenn
   die Freigabe WIRKLICH vollstaendig ist — _final UND Protokoll UND Dossier-Status final.
   Vorher sperrte schon `finalVorhanden` allein, und genau dort leben die Wiedereinstiegs-
   Zweige von controller.gateKlick (Teilfehler: Umbenennung durch, Rest fehlt) — der Knopf
   waere dann fuer immer zu gewesen, ohne dass die Reise je ueber die UI abgeschlossen
   werden koennte. */
function dossierVollstaendigFreigegeben() {
  const d = dossierOhneOffen();
  d.status = { 'lernziele-drehbuch': 'final' };
  return d;
}

test('_final, Protokoll UND Dossier-Status final liegen vor — jetzt ist der Gate-Knopf wirklich gesperrt', () => {
  const props = { dossier: dossierVollstaendigFreigegeben(),
    dateien: [
      { name: 'DBS-001_lernziele-drehbuch_final.xlsx' },
      { name: '_gate.md' }
    ] };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.match(html, /data-action="gate-klick"[^>]*disabled/);
  assert.match(html, /bereits freigegeben: DBS-001_lernziele-drehbuch_final\.xlsx/);
});

test('F1: _final liegt, aber der Dossier-Status ist noch nicht final -> der Knopf bleibt offen ("Freigabe abschliessen")', () => {
  const props = { dossier: dossierOhneOffen(),   // status: {} — noch nicht final
    dateien: [
      { name: 'DBS-001_lernziele-drehbuch_final.xlsx' },
      { name: '_gate.md' }
    ] };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.doesNotMatch(html, /data-action="gate-klick"[^>]*disabled/,
    'der Knopf ist gesperrt, obwohl die Freigabe noch nicht vollstaendig ist — Wiedereinstieg waere ueber die UI unerreichbar');
  assert.match(html, /data-action="gate-klick"[^>]*>Freigabe abschliessen</);
});

test('F1: _final liegt, das Protokoll fehlt noch -> der Knopf bleibt ebenfalls offen', () => {
  const props = { dossier: dossierVollstaendigFreigegeben(),
    dateien: [{ name: 'DBS-001_lernziele-drehbuch_final.xlsx' }] };   /* kein _gate.md */
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.doesNotMatch(html, /data-action="gate-klick"[^>]*disabled/);
  assert.match(html, /data-action="gate-klick"[^>]*>Freigabe abschliessen</);
});

test('F3: waehrend ein Lauf aktiv ist (state.gateLaeuft), ist der Knopf gesperrt mit "Gate läuft"', () => {
  const props = { dossier: dossierOhneOffen(), dateien: [{ name: 'DBS-001_lernziele-drehbuch_v3.xlsx' }],
    gateLaeuft: true };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.match(html, /data-action="gate-klick"[^>]*disabled/);
  assert.match(html, /Gate läuft/);
});

test('ohne jede versionierte Datei ist der Gate-Knopf gesperrt', () => {
  const props = { dossier: dossierOhneOffen(), dateien: [] };
  const html = ansichten.einSchritt(INHALT, DBS, 2, null, props);
  assert.match(html, /data-action="gate-klick"[^>]*disabled/);
  assert.match(html, /keine versionierte Datei/);
});
