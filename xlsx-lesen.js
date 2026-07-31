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

   Eine xlsx ist ein ZIP. Dieselbe Zip-/XML-Logik wie
   IT_Architektur_bbz/output/tools/contract-lesen.cjs (dort mit zlib, weil
   Node-Tool) — hier mit DecompressionStream('deflate-raw'), nativ in Chrome/
   Edge und seit Node 18 auch im Test ohne Zusatzabhaengigkeit (node --test
   dieser Datei laeuft nativ dagegen, s. test/xlsxlesen.test.js). Kein
   Paketmanager, keine Abhaengigkeit — Konvention 1. */
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
    if (eo < 0) throw new Error('Keine xlsx-Datei: Zip-Verzeichnis nicht gefunden');
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
        'DecompressionStream nicht verfuegbar — deflate-komprimierte xlsx-Eintraege ' +
        'koennen in dieser Umgebung nicht entpackt werden.'));
    }
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  /* Methode 0 = ungespeichert, 8 = deflate — mehr erzeugt xlsx nie. */
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

  /* ---------- XML: nur so viel wie fuer Blattnamen + Kopfzeile noetig ---------- */

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
        wert = (c.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(text).join('').trim();
      } else if (typ === 's') {
        wert = ss[+(vM ? vM[1] : -1)] || '';
      } else if (vM !== undefined && vM !== null) {
        wert = text(vM[1]);
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
    var bytes = new Uint8Array(arrayBuffer);
    var view = new DataView(arrayBuffer);
    var e = zipEintraege(bytes, view);
    if (!e['xl/workbook.xml']) throw new Error('Keine xlsx-Datei: xl/workbook.xml fehlt');

    var wb = await entpacke(bytes, view, e['xl/workbook.xml']);
    var rels = await entpacke(bytes, view, e['xl/_rels/workbook.xml.rels']);
    var ssXml = e['xl/sharedStrings.xml'] ? await entpacke(bytes, view, e['xl/sharedStrings.xml']) : '';

    var ziel = {};
    (rels.match(/<Relationship[^>]*>/g) || []).forEach(function (r) {
      var idM = r.match(/Id="([^"]+)"/), tM = r.match(/Target="([^"]+)"/);
      if (idM && tM) ziel[idM[1]] = tM[1].replace(/^\/?xl\//, '').replace(/^\//, '');
    });

    var ss = (ssXml.match(/<si>[\s\S]*?<\/si>/g) || []).map(function (si) {
      return (si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(text).join('');
    });

    /* \s nach "sheet" verlangen, sonst matcht der Container <sheets> mit. */
    var sheetTags = wb.match(/<sheet\s[^>]*>/g) || [];
    var sheets = sheetTags.map(function (s) {
      var nameM = s.match(/name="([^"]*)"/);
      var ridM = s.match(/r:id="([^"]+)"/);
      var rid = ridM ? ridM[1] : null;
      var pfad = 'xl/' + (ziel[rid] || '');
      return { name: text(nameM ? nameM[1] : ''), pfad: pfad };
    });

    var out = [];
    for (var n = 0; n < sheets.length; n++) {
      var sh = sheets[n];
      if (!e[sh.pfad]) continue;
      var xml = await entpacke(bytes, view, e[sh.pfad]);
      var zeilenXml = xml.match(/<row[\s\S]*?<\/row>/g) || [];
      out.push({ name: sh.name, kopf: kopfzeile(zeilenXml, ss) });
    }
    return out;
  }

  var xlsxLesen = { blaetterUndKoepfe: blaetterUndKoepfe };

  root.xlsxLesen = xlsxLesen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { xlsxLesen: xlsxLesen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
