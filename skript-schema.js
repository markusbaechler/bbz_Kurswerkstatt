/* Die kanonische Struktur eines Selbstlernskripts (Schritt 4) — mechanische
   UMD-Portierung von IT_Architektur_bbz/output/tools/skript-schema.cjs
   (Etappe 3b, Task B2). Parity-Waechter im Tools-Baum haelt beide Fassungen
   im Gleichlauf — Aenderungen IMMER in beiden Baeumen (s. dort
   test/app-parity.test.js). Reine Daten, keine IO. */
(function (root) {
  'use strict';

  /* Reihenfolge = Reihenfolge im Dokument. Die Fehlvorstellung ist ein
     eigener Block, damit die Abnahme sie zaehlen kann, steht im Satz aber
     hinter der Erklaerung, zu der sie gehoert.

     ILLUSTRATION (B6, Etappe 3b): optional, kein stil (kein Text-Kasten,
     sondern ein Bild an der Hero-Position - vor dem Hero-Kasten selbst, s.
     docx-bauen.js::illustrationAbsatz). Variante C (Entscheid Markus
     2026-08-03): kuratierter Katalog PLUS Bild-KI-Szene je Kapitel. Felder
     (Feldzeilen wie ABBILDUNG): katalog: (Name aus dem Katalog) ODER szene:
     (Bild-Regie als Text), dazu datei: (der PNG-Dateiname der Lieferung) -
     skript-lesen.js validiert datei:/katalog: als Pflicht-ODER und weist
     eine Ziffernfolge >2 in szene: ab (eiserne Regel "Illustrationen tragen
     nie Fakten"). */
  var BAUSTEINE = [
    { block: 'HERO',            stil: 'Hero' },
    { block: 'ILLUSTRATION',    stil: null, pflicht: false },
    { block: 'STORY',           stil: 'Story' },
    { block: 'DEFINITION',      stil: null },
    { block: 'ERKLAERUNG',      stil: null },
    { block: 'FEHLVORSTELLUNG', stil: 'Fehlvorstellung' },
    { block: 'BEISPIEL',        stil: 'Beispiel' },
    { block: 'ABBILDUNG',       stil: null, mehrfach: true },
    { block: 'INTERAKTION',     stil: 'Wissenscheck' },
    { block: 'MERKSATZ',        stil: 'Merksatz' },
    { block: 'DEEPDIVE',        stil: 'DeepDive' },
    { block: 'WISSENSCHECK',    stil: 'Wissenscheck' },
    { block: 'ABSCHLUSS',       stil: 'Abschluss' }
  ].map(function (b) {
    return Object.assign({ pflicht: true, mehrfach: false, alsTabelle: false }, b);
  });

  /* Bloecke ausserhalb eines Kapitels. */
  var RAHMEN = ['SKRIPT', 'QUELLEN', 'KAPITEL', 'ENDE-KAPITEL', 'ZUORDNUNG', 'OFFEN'];

  /* Das feste Diagramm-Vokabular. Das Modell waehlt einen Typ und liefert
     Zahlen; gezeichnet wird vom Werkzeug. Die Vergleichstabelle wird KEIN
     Bild, sondern eine echte Word-Tabelle - Text bleibt so waehlbar und
     bricht sauber um. */
  var DIAGRAMMTYPEN = [
    { name: 'kompositions-leiste', felder: ['werte'],           zweck: 'woraus sich ein Ganzes zusammensetzt' },
    { name: 'drift',               felder: ['reihen'],          zweck: 'Entwicklung ueber Zeit, die Luecke zwischen zwei Groessen' },
    { name: 'vergleichstabelle',   felder: ['kopf', 'zeilen'],  zweck: 'Systematik, Gegenueberstellung', alsTabelle: true },
    { name: 'waage',               felder: ['links', 'rechts'], zweck: 'ein Trade-off, zwei Seiten' },
    { name: 'zeitachse',           felder: ['schritte'],        zweck: 'eine Reihenfolge von Schritten' },
    { name: 'payoff',              felder: ['punkte'],          zweck: 'ein Auszahlungs- oder Wirkungsverlauf' },
    { name: 'schema',              felder: ['ebenen'],          zweck: 'Ebenen und Beziehungen ohne Zahlen' }
  ].map(function (d) { return Object.assign({ alsTabelle: false }, d); });

  /* Woerter je Eingangskompetenz. Unter hartMin faellt die Abnahme durch;
     ausserhalb des weichen Fensters warnt sie nur. Das Mass ergaenzt die
     Substanzmarken, es ersetzt sie nicht: die Marken pruefen, DASS gerechnet
     und gezeigt wird, das Budget prueft, dass ueberhaupt ausgefuehrt wird. */
  var BUDGET = { hartMin: 500, weichMin: 700, weichMax: 1200 };

  /* Die Werkzeuge, mit denen ein Entwurf entstehen kann. Schritt 5
     vergleicht zwei unabhaengige Entwuerfe; er muss sie auseinanderhalten
     koennen, ohne sich auf den Dateinamen zu verlassen. */
  var VARIANTEN = ['claude', 'chatgpt'];
  function istVariante(name) { return VARIANTEN.indexOf(name) >= 0; }

  function baustein(name) {
    for (var i = 0; i < BAUSTEINE.length; i++) if (BAUSTEINE[i].block === name) return BAUSTEINE[i];
    return null;
  }
  function istBaustein(name) { return baustein(name) !== null; }
  function pflichtBausteine() {
    return BAUSTEINE.filter(function (b) { return b.pflicht; }).map(function (b) { return b.block; });
  }
  function diagrammTyp(name) {
    for (var i = 0; i < DIAGRAMMTYPEN.length; i++) if (DIAGRAMMTYPEN[i].name === name) return DIAGRAMMTYPEN[i];
    return null;
  }
  function istDiagrammtyp(name) { return diagrammTyp(name) !== null; }
  function pflichtfelder(typ) { var d = diagrammTyp(typ); return d ? d.felder : []; }

  var skriptSchema = {
    SCHEMA: {
      bausteine: BAUSTEINE, rahmen: RAHMEN, diagrammtypen: DIAGRAMMTYPEN, budget: BUDGET,
      varianten: VARIANTEN
    },
    baustein: baustein,
    istBaustein: istBaustein,
    pflichtBausteine: pflichtBausteine,
    diagrammTyp: diagrammTyp,
    istDiagrammtyp: istDiagrammtyp,
    pflichtfelder: pflichtfelder,
    istVariante: istVariante
  };

  root.skriptSchema = skriptSchema;
  if (typeof module !== 'undefined' && module.exports) module.exports = { skriptSchema: skriptSchema };
})(typeof globalThis !== 'undefined' ? globalThis : this);
