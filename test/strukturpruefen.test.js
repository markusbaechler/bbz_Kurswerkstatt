const test = require('node:test');
const assert = require('node:assert');

const { inhalt } = require('../inhalt.js');
const { INHALT } = require('./fixture.js');

const STRUKTUR = INHALT['ablage-kontrakt'].schritte['2'].struktur;

/* Ein vollstaendiger, sauberer Satz Blaetter — Basis fuer die einzelnen
   Abweichungs-Tests unten (jeweils EINE Sache kaputt machen). */
function saubereBlaetter() {
  return [
    { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Definition','Lernziel (handlungsorientiert)','Bloom-Stufe','Wie prüfbar (MC/MR)','Typisches Fehlverhalten'] },
    { name: '2_Eingangskompetenzen', kopf: ['EK-ID','Thema','Definition','Wissensziel','Bloom-Stufe','Wie prüfbar (MC/MR)','Wie lernbar bei Lücken?'] },
    { name: '3_Drehbuch', kopf: ['Uhrzeit','Dauer','Thema','Phase (W/U/G)','Lernziel-ID','Erwartetes Verhalten / Ergebnis','Aktivität Trainer / Moderation','Material & Hilfsmittel'] },
    { name: '_steckbrief', kopf: ['feld','wert'] }
  ];
}

test('kein struktur-Feld am Schritt -> keine Pruefung (null)', () => {
  assert.strictEqual(inhalt.strukturPruefe(saubereBlaetter(), null), null);
  assert.strictEqual(inhalt.strukturVon(INHALT, 1), null, 'Schritt 1 fuehrt keine struktur');
});

test('strukturVon liest das Feld aus dem Kontrakt', () => {
  assert.strictEqual(inhalt.strukturVon(INHALT, 2), STRUKTUR);
});

test('ein sauberer Satz Blaetter hat keine Befunde', () => {
  const f = inhalt.strukturPruefe(saubereBlaetter(), STRUKTUR);
  assert.deepStrictEqual(f, []);
});

test('optionale Katalog-Blaetter (4_Rechtsstand, _aenderungen) sind erlaubt und aendern nichts', () => {
  const bl = saubereBlaetter();
  bl.splice(3, 0,
    { name: '4_Rechtsstand', kopf: ['Regelwerk / Norm','Stand (Datum)','Fundstelle','Bezug (LZ/EK-ID)'] },
    { name: '_aenderungen', kopf: ['Version','Datum','Person','Was','Warum'] });
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.deepStrictEqual(f, []);
});

test('ein unerlaubtes Blatt wird gemeldet', () => {
  const bl = saubereBlaetter();
  bl.splice(1, 0, { name: 'W-Strecke_Aufbau', kopf: ['irgendwas'] });
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.some((x) => x === 'Unerlaubtes Blatt: W-Strecke_Aufbau'), f.join(' | '));
});

test('ein fehlendes Pflichtblatt (Kern) wird gemeldet', () => {
  const bl = saubereBlaetter().filter((b) => b.name !== '3_Drehbuch');
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.includes('Pflichtblatt fehlt: 3_Drehbuch'), f.join(' | '));
});

test('ein fehlender Steckbrief wird gemeldet', () => {
  const bl = saubereBlaetter().filter((b) => b.name !== '_steckbrief');
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.includes('Pflichtblatt fehlt: _steckbrief'), f.join(' | '));
});

/* Der AFL-001-Fall: eine erfundene Spalte in der Kopfzeile. Genau das Netz,
   das T11 auswirft. */
test('eine erfundene/fehlende Spalte in der Kopfzeile wird gemeldet', () => {
  const bl = saubereBlaetter();
  bl[0] = { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Lernort','Definition','Lernziel (handlungsorientiert)','Bloom-Stufe','Wie prüfbar (MC/MR)','Typisches Fehlverhalten'] };
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.includes('Blatt 1_Lernziele: Kopfzeile weicht vom Schema ab'), f.join(' | '));
});

test('eine vertauschte Blattreihenfolge wird gemeldet', () => {
  const bl = saubereBlaetter();
  const tmp = bl[0]; bl[0] = bl[1]; bl[1] = tmp;
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.includes('Blattreihenfolge weicht vom Schema ab'), f.join(' | '));
});

test('_steckbrief nicht als letztes Blatt wird gemeldet', () => {
  const bl = saubereBlaetter();
  const steckbrief = bl.pop();
  bl.splice(1, 0, steckbrief);
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.includes('_steckbrief ist nicht das letzte Blatt'), f.join(' | '));
});

/* ---------- Fix-Runde 1 (Review opus, Finding F2, an der echten AFL-001-
   Datei gemessen): eine ANGEHAENGTE Spalte nach den erwarteten wurde bisher
   von slice(0, spalten.length) einfach abgeschnitten — Befund []. Genau der
   Fall, den T11 eigentlich fangen sollte. ---------- */

test('F2: eine angehaengte, erfundene Spalte NACH den erwarteten wird gemeldet (echter AFL-001-Fall)', () => {
  const bl = saubereBlaetter();
  /* Die ersten sieben Zellen sind wortwoertlich korrekt — nur die achte,
     'Lernort', ist erfunden und haengt hinten dran (wie in der echten
     AFL-001-Datei gemessen). */
  bl[0] = { name: '1_Lernziele', kopf: ['Lernziel-ID','Thema','Definition','Lernziel (handlungsorientiert)','Bloom-Stufe','Wie prüfbar (MC/MR)','Typisches Fehlverhalten','Lernort'] };
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.includes("Blatt 1_Lernziele: unbekannte Zusatzspalte 'Lernort'"), f.join(' | '));
  assert.ok(!f.includes('Blatt 1_Lernziele: Kopfzeile weicht vom Schema ab'),
    'die ersten sieben Zellen sind korrekt — dieser Befund waere hier falsch: ' + f.join(' | '));
});

test('F2: rein nachlaufende Leerzellen nach den erwarteten Spalten sind KEIN Befund', () => {
  const bl = saubereBlaetter();
  bl[3] = { name: '_steckbrief', kopf: ['feld', 'wert', '', ''] };
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.deepStrictEqual(f, [], 'nachlaufende Leerzellen duerfen keinen Befund ausloesen: ' + f.join(' | '));
});

test('F2: mehrere angehaengte, nichtleere Spalten erzeugen je einen eigenen Befund', () => {
  const bl = saubereBlaetter();
  bl[3] = { name: '_steckbrief', kopf: ['feld', 'wert', 'Extra1', 'Extra2'] };
  const f = inhalt.strukturPruefe(bl, STRUKTUR);
  assert.ok(f.includes("Blatt _steckbrief: unbekannte Zusatzspalte 'Extra1'"), f.join(' | '));
  assert.ok(f.includes("Blatt _steckbrief: unbekannte Zusatzspalte 'Extra2'"), f.join(' | '));
});

/* ---------- Mutationsprobe (im Report belegt) ----------
   Wird die Kopfzeilen-Abgleich-Regel auskommentiert (den `if (kopf.join('|')
   !== s.spalten.join('|'))`-Block in inhalt.strukturPruefe ausser Kraft
   gesetzt), muss GENAU der Test "eine erfundene/fehlende Spalte in der
   Kopfzeile wird gemeldet" fehlschlagen — das ist der Beleg, dass der Test
   die Regel wirklich scharf stellt und nicht nur zufaellig gruen ist. */
