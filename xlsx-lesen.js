/* Liest eine .xlsx dependency-frei — fuer die Upload-Strukturpruefung (T11).
   Kein vollwertiger xlsx-Parser: nur Blattnamen in Reihenfolge und die
   Kopfzeile je Blatt. Zellinhalte jenseits der Kopfzeile werden nie gelesen —
   das ist bewusst, s. CLAUDE.md T11.

   Kopfzeile = dieselbe Regel wie contract-pruefen.cjs kopfzeile() (Fix-Runde 1,
   Finding F1, mit Messung an der echten AFL-001-Datei belegt): die ERSTE Zeile
   mit mindestens zwei nichtleeren Zellen — nicht einfach <row> Nummer 1. Eine
   Titelzeile ("TABELLE 2 - Eingangskompetenzen", eine Zelle) oder eine leere
   erste Zeile werden uebersprungen, sonst erzeugte jede Contract-Excel mit
   einer Titelzeile vier Fehlalarme, die contract-pruefen.cjs nicht kennt.

   Eine xlsx ist ein ZIP. Der ZIP-Kern (Central-Directory-Parsing, Entpacken,
   XML-Text-Dekoder) lebt seit Etappe 3 (Task A1) in zip-lesen.js — geteilt mit
   docx-lesen.js, eine ZIP-Quelle statt zweier Kopien (Konvention 9). Diese
   Datei enthaelt nur noch die xlsx-eigene XML-Auswertung (Blaetter, Zeilen,
   Zellen, Kopfzeilen-Regel). Kein Paketmanager, keine Abhaengigkeit —
   Konvention 1. */
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

  /* ---------- XML: nur so viel wie fuer Blattnamen + Kopfzeile noetig ---------- */

  function spalteNr(ref) {
    var n = 0, buchstaben = ref.replace(/\d+/g, '');
    for (var i = 0; i < buchstaben.length; i++) n = n * 26 + (buchstaben.charCodeAt(i) - 64);
    return n - 1;
  }

  function zellen(rowXml, ss) {
    var out = [];
    var cs = rowXml.match(/<c[\s>][\s\S]*?(?:\/>|<\/c>)/g) || [];
    cs.forEach(function (c) {
      var refM = c.match(/r="([A-Z]+)\d+"/);
      var spalte = refM ? spalteNr(refM[1]) : out.length;
      var typM = c.match(/ t="([^"]+)"/);
      var typ = typM ? typM[1] : null;
      var vM = c.match(/<v>([\s\S]*?)<\/v>/);
      var wert = '';
      if (typ === 'inlineStr') {
        wert = (c.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(Z().text).join('').trim();
      } else if (typ === 's') {
        wert = ss[+(vM ? vM[1] : -1)] || '';
      } else if (vM !== undefined && vM !== null) {
        wert = Z().text(vM[1]);
      }
      while (out.length < spalte) out.push('');
      out[spalte] = wert;
    });
    return out;
  }

  /* Erste Zeile mit mindestens zwei nichtleeren Zellen — wortgleiche Regel zu
     contract-pruefen.cjs kopfzeile() (Parity-Pflicht, F1). Keine Zeile
     qualifiziert: leere Kopfzeile, wie kopfzeile() dort auch [] liefert. */
  function kopfzeile(zeilenXml, ss) {
    for (var ri = 0; ri < zeilenXml.length; ri++) {
      var zeile = zellen(zeilenXml[ri], ss);
      var nichtleer = zeile.filter(function (c) { return c != null && String(c).trim() !== ''; }).length;
      if (nichtleer >= 2) {
        return zeile.map(function (c) { return c == null ? '' : String(c).trim(); });
      }
    }
    return [];
  }

  /* ---------- API ---------- */

  /* Blattnamen in Reihenfolge + Kopfzeile je Blatt (s. kopfzeile() oben).
     Wirft (verwirft die Promise), wenn arrayBuffer kein Zip ist,
     xl/workbook.xml fehlt, oder ein Eintrag weder store noch deflate ist
     bzw. sich nicht entpacken laesst. Async/await statt einer .then-Kette
     (Konvention 3 gilt fuer Views, nicht fuer diese Netz-/Binaerlogik) — eine
     mehrstufige Entpack-Pipeline (workbook, rels, je Blatt) blieb sonst
     schwer lesbar verschachtelt. */
  async function blaetterUndKoepfe(arrayBuffer) {
    var zip = Z().oeffne(arrayBuffer);
    var e = zip.eintraege;
    if (!e['xl/workbook.xml']) throw new Error('Keine xlsx-Datei: xl/workbook.xml fehlt');

    var wb = await zip.lies('xl/workbook.xml');
    var rels = await zip.lies('xl/_rels/workbook.xml.rels');
    var ssXml = e['xl/sharedStrings.xml'] ? await zip.lies('xl/sharedStrings.xml') : '';

    var ziel = {};
    (rels.match(/<Relationship[^>]*>/g) || []).forEach(function (r) {
      var idM = r.match(/Id="([^"]+)"/), tM = r.match(/Target="([^"]+)"/);
      if (idM && tM) ziel[idM[1]] = tM[1].replace(/^\/?xl\//, '').replace(/^\//, '');
    });

    var ss = (ssXml.match(/<si>[\s\S]*?<\/si>/g) || []).map(function (si) {
      return (si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(Z().text).join('');
    });

    /* \s nach "sheet" verlangen, sonst matcht der Container <sheets> mit. */
    var sheetTags = wb.match(/<sheet\s[^>]*>/g) || [];
    var sheets = sheetTags.map(function (s) {
      var nameM = s.match(/name="([^"]*)"/);
      var ridM = s.match(/r:id="([^"]+)"/);
      var rid = ridM ? ridM[1] : null;
      var pfad = 'xl/' + (ziel[rid] || '');
      return { name: Z().text(nameM ? nameM[1] : ''), pfad: pfad };
    });

    var out = [];
    for (var n = 0; n < sheets.length; n++) {
      var sh = sheets[n];
      if (!e[sh.pfad]) continue;
      var xml = await zip.lies(sh.pfad);
      var zeilenXml = xml.match(/<row[\s\S]*?<\/row>/g) || [];
      out.push({ name: sh.name, kopf: kopfzeile(zeilenXml, ss) });
    }
    return out;
  }

  var xlsxLesen = { blaetterUndKoepfe: blaetterUndKoepfe };

  root.xlsxLesen = xlsxLesen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { xlsxLesen: xlsxLesen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
