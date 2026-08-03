/* ZIP-Kern + XML-Text-Dekoder — dependency-frei, Konvention 1.
   Herkunft: xlsx-lesen.js (T11). Seit Etappe 3 (Task A1) hierher ausgelagert,
   weil docx-lesen.js denselben Kern braucht (eine docx ist ebenso ein ZIP) —
   EINE Quelle fuer die ZIP-/XML-Text-Logik statt zweier Kopien (Konvention 9).
   Wortlaut und Verhalten sind gegenueber xlsx-lesen.js UNVERAENDERT verschoben.

   Central-Directory-Parsing + lokale Eintraege, Entpacken mit
   DecompressionStream('deflate-raw') — nativ in Chrome/Edge und seit Node 18
   auch im Test ohne Zusatzabhaengigkeit (node --test dieser Datei laeuft
   nativ dagegen, s. test/xlsxlesen.test.js/test/docxlesen.test.js). */
(function (root) {
  'use strict';

  function leU16(view, o) { return view.getUint16(o, true); }
  function leU32(view, o) { return view.getUint32(o, true); }

  function textDecode(bytes) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  /* ---------- ZIP: Central Directory + lokale Eintraege ---------- */

  /* Sucht das End-of-Central-Directory-Record vom Dateiende her (es kann ein
     ZIP-Kommentar dahinterstehen — deshalb keine feste Position). */
  function zipEintraege(bytes, view) {
    var eo = -1;
    for (var i = bytes.length - 22; i >= 0; i--) {
      if (leU32(view, i) === 0x06054b50) { eo = i; break; }
    }
    if (eo < 0) throw new Error('Kein Zip-Archiv: Zip-Verzeichnis nicht gefunden');
    var anzahl = leU16(view, eo + 10);
    var p = leU32(view, eo + 16);
    var e = {};
    for (var k = 0; k < anzahl; k++) {
      var nl = leU16(view, p + 28), el = leU16(view, p + 30), cl = leU16(view, p + 32);
      var name = textDecode(bytes.subarray(p + 46, p + 46 + nl));
      e[name] = {
        name: name,
        lho: leU32(view, p + 42),
        methode: leU16(view, p + 10),
        csize: leU32(view, p + 20)
      };
      p += 46 + nl + el + cl;
    }
    return e;
  }

  /* Die Groesse aus der Central Directory gilt, nicht die aus dem lokalen
     Header — bei gesetztem Data-Descriptor-Bit (gp flag bit 3) steht dort 0. */
  function rohBytes(bytes, view, eintrag) {
    var nl = leU16(view, eintrag.lho + 26), el = leU16(view, eintrag.lho + 28);
    var start = eintrag.lho + 30 + nl + el;
    return bytes.subarray(start, start + eintrag.csize);
  }

  function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error(
        'DecompressionStream nicht verfuegbar — deflate-komprimierte Zip-Eintraege ' +
        'koennen in dieser Umgebung nicht entpackt werden.'));
    }
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  /* Methode 0 = ungespeichert, 8 = deflate — mehr erzeugt xlsx/docx nie. Ein
     fehlender Eintrag (eintrag undefined) liefert bewusst '' statt zu werfen —
     Aufrufer wie ssXml in xlsx-lesen.js verlassen sich darauf. */
  function entpacke(bytes, view, eintrag) {
    if (!eintrag) return Promise.resolve('');
    var roh = rohBytes(bytes, view, eintrag);
    if (eintrag.methode === 0) return Promise.resolve(textDecode(roh));
    if (eintrag.methode !== 8) {
      return Promise.reject(new Error('Nicht unterstuetzte Zip-Kompression in "' +
        eintrag.name + '": Methode ' + eintrag.methode +
        ' (erwartet 0 = ungespeichert oder 8 = deflate).'));
    }
    return inflateRaw(roh).then(textDecode).catch(function (err) {
      throw new Error('Eintrag "' + eintrag.name + '" liess sich nicht entpacken ' +
        '(deflate-Fehler): ' + (err && err.message ? err.message : err));
    });
  }

  /* ---------- XML: Text aus einem Fragment (Tags strippen, Entitaeten) ---------- */

  function text(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, '')
      .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')            /* zuletzt, sonst doppelt aufgeloest */
      .replace(/\s+/g, ' ').trim();
  }

  /* ---------- API ---------- */

  /* oeffne(arrayBuffer) -> { eintraege, lies(name) -> Promise<string> }.
     eintraege ist das Central-Directory-Verzeichnis (Name -> {lho, methode,
     csize}), lies() entpackt einen Eintrag on-demand (fehlender Name ->
     Promise.resolve('')). Wirft synchron, wenn arrayBuffer kein Zip ist. */
  function oeffne(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var view = new DataView(arrayBuffer);
    var eintraege = zipEintraege(bytes, view);
    return {
      eintraege: eintraege,
      lies: function (name) { return entpacke(bytes, view, eintraege[name]); }
    };
  }

  var zipLesen = { oeffne: oeffne, text: text };

  root.zipLesen = zipLesen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { zipLesen: zipLesen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
