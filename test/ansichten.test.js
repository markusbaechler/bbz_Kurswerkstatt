const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];   // Schritt 4, inArbeit
const AFL = KURSE[1];   // Schritt 1, offen

/* ---------- Kette ---------- */

test('die Kette zeigt alle 9 Schritte in 5 Phasen', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  assert.strictEqual((h.match(/data-action="schritt"/g) || []).length, 9);
  assert.strictEqual((h.match(/class="spanne/g) || []).length, 5);
});

test('die Kette faerbt nach dem echten Stand', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  assert.ok(/station fertig/.test(h), 'kein erledigter Schritt');
  assert.ok(/station inArbeit/.test(h), 'kein Schritt in Arbeit');
  assert.ok(/station offen/.test(h), 'kein offener Schritt');
});

test('die Kette markiert den aktiven Schritt', () => {
  var hh = ansichten.kette(INHALT, DBS, 4);
  assert.ok(/station inArbeit hier/.test(hh), 'aktive Station nicht markiert');
  assert.ok(/stbez inArbeit hier/.test(hh), 'Beschriftung der aktiven Station nicht markiert');
});

test('die Kette markiert die drei Gates', () => {
  assert.strictEqual((ansichten.kette(INHALT, DBS, null).match(/class="pruefzeichen"/g) || []).length, 3);
});

/* ---------- Alle Kurse ---------- */

test('jeder Kurs bekommt eine Zeile mit neun Punkten', () => {
  const h = ansichten.alleKurse(KURSE);
  assert.strictEqual((h.match(/data-action="kurs"/g) || []).length, 2);
  assert.strictEqual((h.match(/class="pkt /g) || []).length, 18);
});

test('der Fortschritt wird ausgewiesen', () => {
  const h = ansichten.alleKurse(KURSE);
  assert.ok(/3&#8202;\/&#8202;9/.test(h), 'DBS-001 muesste 3/9 stehen');
  assert.ok(/0&#8202;\/&#8202;9/.test(h), 'AFL-001 muesste 0/9 stehen');
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
  assert.ok(/3&#8202;\/&#8202;9/.test(h), 'Stand fehlt im Schriftfeld');
});

test('die Kursansicht zeigt, was als Naechstes dran ist', () => {
  const h = ansichten.einKurs(INHALT, DBS);
  assert.ok(/Als N&auml;chstes dran/.test(h));
  assert.ok(/Schritt 4/.test(h));
  assert.ok(/Hier weiterarbeiten/.test(h));
});

test('ein unbekannter Kurs erzeugt eine Meldung statt einer Ausnahme', () => {
  assert.ok(/Nicht gefunden/.test(ansichten.einKurs(INHALT, null)));
});

/* ---------- Ein Schritt ---------- */

test('der Kopf nennt Nummer und Namen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/Station 4 von 9/.test(h));
  assert.ok(/Green-field W-Content/.test(h));
});

test('die Schrittansicht traegt die Fertigungsstrasse mit', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.strictEqual((h.match(/class="spanne/g) || []).length, 5);
  assert.ok(/class="gleis"/.test(h), 'kein durchgehendes Gleis');
  assert.ok(/class="schriftfeld"/.test(h), 'kein Schriftfeld');
});

test('Woher und Wohin sind da und verlinkt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/Kommt herein/.test(h));
  assert.ok(/Geht weiter/.test(h));
  assert.ok(/Station 3 ansehen/.test(h));
  assert.ok(/Station 5 ansehen/.test(h));
});

test('Schritt 1 hat keinen Vorgaenger und sagt das', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null);
  assert.ok(/ausserhalb der Linie/.test(h));
  assert.ok(!/Station 0/.test(h));
});

test('die Anleitung steht ausgeklappt da, nicht als Klappe', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/So gehst du vor/.test(h));
  assert.ok(/Prompt kopieren<\/span>/.test(h), 'erster Anleitungsschritt fehlt');
  assert.ok(/class="ddc do"/.test(h), 'Do fehlt');
  assert.ok(/class="ddc dont"/.test(h), 'Dont fehlt');
});

test('der Masterprompt liegt inline, mit Kopier-Knopf', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/data-action="werkzeug" data-werkzeug="prompt-greenfield"/.test(h));
  assert.ok(/data-action="kopieren"/.test(h));
});

test('die Anleitung erscheint NICHT nochmals als Klappe', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(!/data-werkzeug="guide-4"/.test(h), 'Anleitung doppelt gezeigt');
});

test('das aufgeklappte Werkzeug ist markiert', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, 'prompt-greenfield');
  assert.ok(/class="wtool instrument auf"/.test(h), 'Masterprompt nicht als aufgeklappt markiert');
  assert.ok(/zuklappen/.test(h), 'Knopf sagt nicht zuklappen');
});

test('die Ablage nach Kontrakt wird angezeigt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);
  assert.ok(/04_greenfield\/<b>DBS-001_greenfield_v\{N\}\.md<\/b>/.test(h));
});

test('das Uebergabekriterium steht da', () => {
  assert.ok(/Fertig, wenn/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
});

test('ein Gate-Schritt zeigt sein Gate, ein gate-loser nicht', () => {
  assert.ok(/Gate 1/.test(ansichten.einSchritt(INHALT, DBS, 3, null)));
  assert.ok(!/gatetag/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
});

test('Weiter ist gesperrt, solange der Schritt nicht erledigt ist', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null);   // Schritt 4 inArbeit
  assert.ok(/class="weiter" data-action="schritt" data-schritt="5" disabled/.test(h));
});

test('Weiter ist frei, wenn der Schritt erledigt ist', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null);   // 3 < 4, also fertig
  assert.ok(/data-schritt="4">Weiter/.test(h));
  assert.ok(!/data-schritt="4" disabled/.test(h));
});

test('Schritt 9 bietet kein Weiter an', () => {
  assert.ok(!/Weiter zu Schritt 10/.test(ansichten.einSchritt(INHALT, DBS, 9, null)));
});

test('ohne Kurs gibt es keinen Erledigt-Haken', () => {
  assert.ok(!/data-action="erledigt"/.test(ansichten.einSchritt(INHALT, null, 4, null)));
});

test('die zulaessigen Wege werden angezeigt', () => {
  assert.ok(/Im Chat/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
  assert.ok(/Mit Claude Code/.test(ansichten.einSchritt(INHALT, DBS, 4, null)));
  const s7 = ansichten.einSchritt(INHALT, DBS, 7, null);
  assert.ok(/Mit Claude Code/.test(s7));
  assert.ok(!/Im Chat/.test(s7), 'Schritt 7 laeuft nur ueber Claude Code');
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
  const h = ansichten.kette(INHALT, DBS, 4);
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
  const h = ansichten.einSchritt(INHALT, DBS, 4, null,
    { basisUrl: 'https://sp/Kursproduktion/DBS-001_x', dateien: [] });
  assert.ok(/href="https:\/\/sp\/Kursproduktion\/DBS-001_x\/04_greenfield"/.test(h));
});

test('der Vorgaenger-Ordner ist aus Kommt-herein heraus zu oeffnen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null,
    { basisUrl: 'https://sp/Kursproduktion/DBS-001_x', dateien: [] });
  assert.ok(/href="https:\/\/sp\/Kursproduktion\/DBS-001_x\/03_contract"/.test(h),
    'Link auf den Contract-Ordner aus Schritt 3 fehlt');
});

test('ohne Basis-URL bleiben die Pfade lesbar, aber ohne Link', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, {});
  assert.ok(/04_greenfield\/<b>DBS-001_greenfield_v\{N\}\.md<\/b>/.test(h));
  assert.ok(!/href="undefined/.test(h));
});

/* ---------- Der Masterprompt ist das Instrument ---------- */

test('der Masterprompt traegt eigenes Gewicht, nicht die Zeilendarstellung', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, {});
  assert.ok(/class="wtool instrument/.test(h), 'Masterprompt nicht als Instrument ausgezeichnet');
  assert.ok(/class="wtitel"><h3>/.test(h), 'Titel nicht als Ueberschrift');
});

test('der Prompt ist kopierbar OHNE ihn aufzuklappen', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, {});   // nichts aufgeklappt
  const kopf = h.slice(h.indexOf('class="wkopf"'), h.indexOf('class="wbody"'));
  assert.ok(/data-action="kopieren"/.test(kopf), 'Kopier-Knopf steckt im aufklappbaren Teil');
});

test('der Masterprompt steht VOR den Leitplanken', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, {});
  assert.ok(h.indexOf('Dein Masterprompt') < h.indexOf('Leitplanken'),
    'Do/Dont steht vor dem Werkzeug');
});

test('der Masterprompt steht NACH der Anleitung, die ihn erwaehnt', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 4, null, {});
  assert.ok(h.indexOf('So gehst du vor') < h.indexOf('Dein Masterprompt'));
});

test('Vorlagen bleiben ruhig — kein Instrument', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 3, null, {});
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
  const h = ansichten.kette(INHALT, DBS, null);   // 3 von 9 erledigt
  const m = /<i style="width:([\d.]+)%"/.exec(h);
  assert.ok(m, 'keine Fuellung im Gleis');
  const soll = ((3 - 0.5) / 9 * 100).toFixed(2);
  assert.strictEqual(m[1], soll, 'Fuellung endet nicht auf dem dritten Punkt');
});

test('ohne Kurs ist das Gleis leer', () => {
  const h = ansichten.kette(INHALT, null, null);
  assert.ok(/<i style="width:0.00%"/.test(h));
});

test('jede Station steht in ihrer eigenen Rasterspalte', () => {
  const h = ansichten.kette(INHALT, DBS, null);
  for (let i = 1; i <= 9; i++) {
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
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '4' });
  assert.ok(/data-action="kurse"/.test(h), 'kein Rueckweg zur Liste');
  assert.ok(/data-action="kurs" data-kurs="DBS-001"/.test(h), 'kein Rueckweg zum Kurs');
  assert.ok(/class="hier">.*Green-field W-Content/.test(h),
            'aktuelle Station nicht als Standort markiert');
});

test('im Kurs ist der Kurs selbst der Standort, nicht mehr anklickbar', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten' });
  assert.ok(!/data-action="kurs"/.test(h), 'Kurs verweist auf sich selbst');
  assert.ok(/class="hier"[^>]*>.*DBS-001/.test(h), 'Kurs nicht als Standort markiert');
});

test('Stationswahl springt zu Nachbarschritten', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '4' });
  assert.ok(/data-action="schritt" data-schritt="3"/.test(h), 'kein Weg zurueck');
  assert.ok(/data-action="schritt" data-schritt="5"/.test(h), 'kein Weg vorwaerts');
  assert.ok(/4&#8202;\/&#8202;9/.test(h), 'Zaehler fehlt');
});

test('an den Enden der Strasse zeigt die Stationswahl ins Leere', () => {
  const erst = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '1' });
  assert.ok(/class="wechsel aus"/.test(erst), 'vor Schritt 1 muesste tot sein');
  assert.ok(/data-schritt="2"/.test(erst));
  const letzt = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten', schrittId: '9' });
  assert.ok(/class="wechsel aus"/.test(letzt), 'nach Schritt 9 muesste tot sein');
  assert.ok(/data-schritt="8"/.test(letzt));
});

test('ohne Schritt gibt es keine Stationswahl', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'arbeiten' });
  assert.ok(!/class="stationswahl"/.test(h));
});

test('im Nachschlagen nennt die Spur das Werk statt eines Kurses', () => {
  const h = ansichten.standort(INHALT, DBS, { bereich: 'nachschlagen', werk: 'promptcraft' });
  assert.ok(/Prompt-Handwerk/.test(h), 'Werk nicht benannt');
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
