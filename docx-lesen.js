/* Liest eine .docx dependency-frei — Absaetze mit Stil und Text, in
   Dokumentreihenfolge (Etappe 3, Task A1). Kein vollwertiger docx-Parser:
   keine Tabellen, keine Listen-Nummerierung, keine Bilder — nur Fliesstext
   je Absatz, wie ihn word/document.xml traegt. Eine docx ist wie eine xlsx
   ein ZIP; der ZIP-/XML-Text-Kern kommt aus zip-lesen.js (eine ZIP-Quelle,
   Konvention 9), diese Datei enthaelt nur die docx-eigene XML-Auswertung. */
(function (root) {
  'use strict';

  /* Lazy-Accessor (Muster I() in ansichten.js): root.zipLesen ist gesetzt,
     sobald zip-lesen.js vorher geladen/ge-required wurde — im Browser per
     Script-Tag-Reihenfolge (index.html), in Node per require-Kopf im Test. */
  function Z() {
    if (root.zipLesen) return root.zipLesen;
    if (typeof module !== 'undefined' && module.exports) return require('./zip-lesen.js').zipLesen;
    throw new Error('zip-lesen.js nicht geladen');
  }

  /* absaetze(arrayBuffer) -> Promise<[{stil, text}]>. Wirft (verwirft die
     Promise), wenn arrayBuffer kein Zip ist oder word/document.xml fehlt.
     Ein selbstschliessender leerer Absatz (<w:p/>) taucht NICHT im Ergebnis
     auf — der Regex unten verlangt "<w:p " oder "<w:p>", ein "/>" matcht
     nicht. Das ist gewollt: ein Absatz ohne jeden Lauf traegt ohnehin keinen
     Text und keinen Stil, den ein Steckbrief-Auszug bräuchte. */
  async function absaetze(arrayBuffer) {
    var zip = Z().oeffne(arrayBuffer);
    if (!zip.eintraege['word/document.xml']) throw new Error('Keine docx-Datei: word/document.xml fehlt');
    var xml = await zip.lies('word/document.xml');
    var ps = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
    return ps.map(function (p) {
      var stilM = p.match(/<w:pStyle w:val="([^"]+)"/);
      /* Erst ALLE <w:t>-Fragmente eines Absatzes zusammenfuegen, dann EINMAL
         durch Z().text() dekodieren — nicht je Fragment einzeln (Z().text()
         trimmt am Ende jedes Aufrufs; ein "<w:t>Erster </w:t><w:t>Satz.</w:t>"
         verlor so das Leerzeichen an der Run-Grenze, "ErsterSatz." statt
         "Erster Satz."). Ueber den zusammengefuegten Rohtext strippt EIN
         Text()-Aufruf die Tags und deren umschliessende Grenze bleibt als
         inneres Leerzeichen erhalten — nur Anfang/Ende des GANZEN Absatzes
         werden getrimmt, wie bei jedem anderen Text()-Aufruf auch. */
      var roh = (p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || []).join('');
      var texte = Z().text(roh);
      return { stil: stilM ? stilM[1] : null, text: texte };
    });
  }

  var docxLesen = { absaetze: absaetze };

  root.docxLesen = docxLesen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { docxLesen: docxLesen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
