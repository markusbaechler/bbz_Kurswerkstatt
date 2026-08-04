'use strict';
/* Kernfaelle je Diagrammtyp — mechanische UMD-Portierung von
   diagramm-rendern.cjs (Etappe 3b, Task B3). Volle Verhaltensabdeckung
   liegt beim Parity-Waechter im Tools-Baum (test/app-parity.test.js) plus
   der bestehenden 268er-Tools-Suite selbst (Muster B2,
   test/skriptlesen-app.test.js) — diese Datei prueft bewusst nur, dass
   jeder Typ zeichnet, escaped und bei fehlenden Pflichtdaten/negativen
   Werten wirft wie die Tools-Fassung, plus den klaren Wurf von png() in
   Node. Kein IO, keine Abhaengigkeit ausser dem Schema. */
const test = require('node:test');
const assert = require('node:assert');
const D = require('../diagramm-zeichnen.js').diagrammZeichnen;

function zeichnetEtwas(s) {
  return /<(rect|path|line|circle|polygon|polyline|text)\b/.test(s);
}

test('die Kompositions-Leiste zeichnet einen Balken je Wert und beschriftet ihn', () => {
  const s = D.svg({ typ: 'kompositions-leiste', titel: 'Aufbau',
    felder: { werte: 'Verwaltung 0.42 | Depotbank 0.08 | Vertrieb 0.55' } });
  assert.ok(zeichnetEtwas(s));
  assert.strictEqual((s.match(/<rect/g) || []).length >= 3, true);
  assert.ok(s.includes('Verwaltung'));
  assert.ok(s.includes('Aufbau'));
});

test('die Waage stellt zwei Seiten gegenueber', () => {
  const s = D.svg({ typ: 'waage', titel: 'Abwaegung',
    felder: { links: 'Nutzen: planbar', rechts: 'Kosten: 1.16 Prozent' } });
  assert.ok(zeichnetEtwas(s));
  assert.ok(s.includes('planbar') && s.includes('1.16'));
});

test('das Schema zeichnet einen Kasten je Ebene und beschriftet ihn', () => {
  const s = D.svg({ typ: 'schema', titel: 'Drei Saeulen',
    felder: { ebenen: 'Saeule 1: AHV | Saeule 2: BVG | Saeule 3: privat' } });
  assert.ok(zeichnetEtwas(s));
  assert.ok(s.includes('AHV') && s.includes('BVG') && s.includes('privat'));
});

test('das Drift-Diagramm zeichnet je Reihe einen Pfad und schattiert die Luecke', () => {
  const s = D.svg({ typ: 'drift', titel: 'Kostenluecke',
    felder: { reihen: 'ohne Kosten: 100,107,114,122 | mit Kosten: 100,106,112,118' } });
  assert.ok((s.match(/<(path|polyline)/g) || []).length >= 2, 'zwei Reihen erwartet');
  assert.ok(s.includes('ohne Kosten') && s.includes('mit Kosten'));
});

test('die Zeitachse zeichnet einen Punkt je Schritt', () => {
  const s = D.svg({ typ: 'zeitachse', titel: 'Ablauf',
    felder: { schritte: 'Antrag | Pruefung | Entscheid | Auszahlung' } });
  assert.ok((s.match(/<circle/g) || []).length >= 4);
  assert.ok(s.includes('Auszahlung'));
});

/* B9-F4 (2026-08-04): das Redesign auf vertikal mit Zeilenumbruch — mechanische
   Portierung der Tools-Tests (test/diagramm-rendern.test.js). Echtes Fixture
   aus der VL-002-Lieferung, Kapitel EK-005. */
const EK005_SCHRITTE = 'Jahreslohn | Eintrittsschwelle prüfen | Koordinationsabzug | Versicherter Lohn | ' +
  'Altersgutschrift nach Altersklasse | Altersguthaben samt Zins | Umwandlungssatz | Jährliche Altersrente';

function tspanTexte(s) {
  return Array.from(s.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)).map(m => m[1]);
}
function tspanYs(s) {
  return Array.from(s.matchAll(/<tspan x="[\d.]+" y="([\d.]+)"/g)).map(m => Number(m[1]));
}

test('Zeitachse (B9-F4, echtes EK-005-Fixture): ein Punkt je Schritt, kein Label ueber ~76 Zeichen, ' +
  'Hoehe waechst dynamisch, keine zwei tspan-Y-Positionen fallen zusammen', () => {
  const s = D.svg({ typ: 'zeitachse', titel: 'Die Rechenkette der beruflichen Vorsorge',
    felder: { schritte: EK005_SCHRITTE } });
  assert.strictEqual((s.match(/<circle/g) || []).length, 8, 'acht Schritte, acht Punkte');
  const texte = tspanTexte(s);
  assert.ok(texte.length > 0);
  for (const t of texte) {
    assert.ok(t.length <= 76, 'Zeile laenger als der Umbruch erlaubt: "' + t + '" (' + t.length + ')');
  }
  const hoehe = Number(s.match(/height="(\d+)"/)[1]);
  assert.ok(hoehe > 430, 'SVG-Hoehe haette dynamisch ueber 430 wachsen sollen, ist ' + hoehe);
  const ys = tspanYs(s);
  assert.strictEqual(new Set(ys).size, ys.length, 'zwei tspan-Y-Positionen fallen exakt zusammen');
});

test('Zeitachse (B9-F4): eine lange Beschriftung wird auf mehrere Zeilen umgebrochen, an Wortgrenzen', () => {
  const lang = 'Ohne Meldung: Stiftung Auffangeinrichtung nach sechs Monaten, spätestens nach zwei Jahren';
  const s = D.svg({ typ: 'zeitachse', titel: 't', felder: { schritte: lang + ' | Kurz' } });
  const texte = tspanTexte(s);
  assert.ok(texte.length >= 3, 'die lange Beschriftung haette mindestens zwei Zeilen ergeben muessen');
  for (const t of texte) {
    assert.ok(t.length <= 76, 'Zeile laenger als der Umbruch erlaubt: "' + t + '"');
  }
  assert.strictEqual(texte.join(' '), lang + ' Kurz', 'kein Wort darf beim Umbruch verlorengehen');
});

test('das Payoff-Diagramm zeichnet den Verlauf und die Nulllinie', () => {
  const s = D.svg({ typ: 'payoff', titel: 'Auszahlung',
    felder: { punkte: '0,-10 | 90,-10 | 110,10 | 150,50' } });
  assert.ok((s.match(/<(path|polyline)/g) || []).length >= 1);
  assert.ok((s.match(/<line/g) || []).length >= 1, 'Nulllinie erwartet');
});

test('jedes SVG traegt xmlns, Breite, Hoehe und viewBox', () => {
  const s = D.svg({ typ: 'schema', titel: 'Drei Saeulen',
    felder: { ebenen: 'Saeule 1: AHV | Saeule 2: BVG | Saeule 3: privat' } });
  assert.ok(s.startsWith('<svg'));
  assert.ok(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(s));
  assert.ok(/width="\d+"/.test(s) && /height="\d+"/.test(s) && /viewBox="/.test(s));
});

test('spitze Klammern und Ampersand im Titel werden maskiert', () => {
  const s = D.svg({ typ: 'kompositions-leiste', titel: 'Kosten < 1 % & mehr',
    felder: { werte: 'A 1 | B 2' } });
  assert.ok(s.includes('Kosten &lt; 1 % &amp; mehr'), 'Titel nicht maskiert');
  assert.ok(!s.includes('Kosten < 1'), 'roher Titel im SVG');
});

test('auch Beschriftungen aus den Werten werden maskiert', () => {
  const s = D.svg({ typ: 'kompositions-leiste', titel: 't',
    felder: { werte: 'Anteil <Rest> 1 | B 2' } });
  assert.ok(s.includes('&lt;Rest&gt;'));
});

test('negative Werte erzeugen einen Fehler (wie die Tools-Fassung)', () => {
  assert.throws(() => D.svg({ typ: 'kompositions-leiste', titel: 't',
    felder: { werte: 'A 5 | B -5' } }), /negative/);
});

test('nicht-numerische Werte werden abgewiesen', () => {
  assert.throws(() => D.svg({ typ: 'kompositions-leiste', titel: 't',
    felder: { werte: 'A abc' } }), /Nicht-numerisch/);
});

test('leere Pflichtdaten werden je Typ abgewiesen', () => {
  assert.throws(() => D.svg({ typ: 'kompositions-leiste', titel: 't',
    felder: { werte: '' } }), /keine Werte/);
  assert.throws(() => D.svg({ typ: 'schema', titel: 't',
    felder: { ebenen: '' } }), /keine Ebenen/);
  assert.throws(() => D.svg({ typ: 'waage', titel: 't',
    felder: { links: '', rechts: '' } }), /beide Seiten/);
  assert.throws(() => D.svg({ typ: 'drift', titel: 't',
    felder: { reihen: '' } }), /keine Reihe mit Zahlen/);
  assert.throws(() => D.svg({ typ: 'zeitachse', titel: 't',
    felder: { schritte: '' } }), /keine Schritte/);
  assert.throws(() => D.svg({ typ: 'payoff', titel: 't',
    felder: { punkte: '' } }), /keine Punkte/);
});

test('Payoff wirft Fehler bei Punkt ohne Komma', () => {
  assert.throws(() => D.svg({ typ: 'payoff', titel: 't',
    felder: { punkte: '10 | 90,-10 | 150,50' } }), /kein Komma/);
});

test('die Vergleichstabelle wird nicht gezeichnet — svg() wirft (B4 baut daraus eine Word-Tabelle)', () => {
  assert.throws(() => D.svg({ typ: 'vergleichstabelle', titel: 't',
    felder: { kopf: 'a | b', zeilen: 'x | y' } }), /Tabelle/);
});

test('ein unbekannter Diagrammtyp wirft', () => {
  assert.throws(() => D.svg({ typ: 'irgendwas', titel: 't', felder: {} }), /Unbekannter Diagrammtyp/);
});

test('mitTitel:false laesst den Titeltext im SVG weg, ohne die Option steht er drin', () => {
  const mit = D.svg({ typ: 'schema', titel: 'Aufbau der Kosten', felder: { ebenen: 'Saeule 1 | Saeule 2' } });
  const ohne = D.svg({ typ: 'schema', titel: 'Aufbau der Kosten', felder: { ebenen: 'Saeule 1 | Saeule 2' } },
    { mitTitel: false });
  assert.ok(mit.includes('Aufbau der Kosten'));
  assert.ok(!ohne.includes('Aufbau der Kosten'));
});

test('kein SVG benutzt var() als Praesentationsattribut (2026-07-24)', () => {
  for (const a of [
    { typ: 'kompositions-leiste', titel: 't', felder: { werte: 'A 1 | B 2' } },
    { typ: 'waage', titel: 't', felder: { links: 'Nutzen: klar', rechts: 'Kosten: hoch' } },
    { typ: 'schema', titel: 't', felder: { ebenen: 'Saeule 1 | Saeule 2' } },
  ]) {
    assert.ok(!/\b(fill|stroke)\s*=\s*"[^"]*var\(/.test(D.svg(a)), a.typ + ' nutzt var() als Attribut');
  }
});

test('Wertepaare werden aus der Feldzeile gelesen', () => {
  assert.deepStrictEqual(D.wertePaare('Verwaltung 0.42 | Depotbank 0.08'),
    [{ name: 'Verwaltung', wert: 0.42 }, { name: 'Depotbank', wert: 0.08 }]);
});

/* png() ist Browser-only (Image + Canvas) — dokumentierte Grenze (s. Kommentarkopf
   diagramm-zeichnen.js, Muster DecompressionStream in xlsx-lesen.js/T11). In Node
   (kein document/Image/Canvas) muss die Promise klar ablehnen, nie einen
   ReferenceError werfen. Der Live-Beweis eines echten Bildes ist Sache von B9. */
test('png() lehnt in Node klar ab — kein Browser (document/Image/Canvas) vorhanden', async () => {
  await assert.rejects(
    D.png('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 900, 250),
    /Browser/
  );
});
