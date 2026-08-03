/* Baut ein ZIP-Archiv dependency-frei — das Gegenstueck zu zip-lesen.js
   (Etappe 3b, Task B1). Store-only (Kompressionsmethode 0 = ungespeichert),
   bewusst kein Deflate: CompressionStream('deflate-raw') gaebe es zwar
   (dieselbe Browser-/Node-Bordmittel-Familie wie DecompressionStream in
   zip-lesen.js), aber Store haelt CRC/Laengen trivial korrekt — kein
   Streaming, keine Fehlerquelle beim Zurueckrechnen der komprimierten
   Groesse. Eine gebaute docx wird dadurch ~2-3x groesser als eine von Word
   selbst deflate-komprimierte, bleibt aber weit unter jeder fuer diese
   App relevanten Graph-Uploadgrenze (s. CLAUDE.md "Der Weg Hochladen").
   YAGNI: kein zweiter Kompressionspfad fuer einen Groessenvorteil, den
   niemand braucht.

   Datums-/Zeitfelder in den Headern stehen fest auf 0 (DOS-Datum/-Zeit
   1980-01-01 00:00:00) — das macht baue() deterministisch: derselbe Input
   erzeugt IMMER dieselben Bytes, was den Round-trip-Test und jede
   Byte-fuer-Byte-Diff-Pruefung vereinfacht. Kein Datenverlust: Word/Excel
   lesen ein ZIP unabhaengig vom Datumsfeld im Header korrekt. */
(function (root) {
  'use strict';

  /* ---------- CRC32 (Tabelle im Modul, Standard-Polynom 0xEDB88320) ---------- */

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---------- Hilfsfunktionen ---------- */

  /* daten: Uint8Array wird unveraendert uebernommen, ein String ueber
     TextEncoder nach UTF-8 kodiert — dieselbe Kodierung, die zip-lesen.js
     beim Lesen erwartet (TextDecoder('utf-8')). */
  function nachBytes(daten) {
    if (typeof daten === 'string') return new TextEncoder().encode(daten);
    if (daten instanceof Uint8Array) return daten;
    throw new Error('zipSchreiben.baue: daten muss ein Uint8Array oder ein String sein');
  }

  /* Bit 11 (0x0800) im General-Purpose-Flag markiert einen UTF-8-Dateinamen —
     nur gesetzt, wenn der Name tatsaechlich Nicht-ASCII-Zeichen enthaelt. */
  function istNichtAscii(s) {
    for (var i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) > 0x7F) return true;
    }
    return false;
  }

  /* Ein 30-Byte lokaler Datei-Header (ohne Name/Extra), s. ZIP-Spec 4.3.7. */
  function lokalerHeader(e) {
    var b = new Uint8Array(30);
    var dv = new DataView(b.buffer);
    dv.setUint32(0, 0x04034b50, true);          // Signatur
    dv.setUint16(4, 20, true);                  // Version needed to extract
    dv.setUint16(6, e.flag, true);               // General purpose bit flag
    dv.setUint16(8, 0, true);                    // Methode 0 = ungespeichert (Store)
    dv.setUint16(10, 0, true);                   // Zeit — fest 0 (deterministisch, s. Kommentarkopf)
    dv.setUint16(12, 0, true);                   // Datum — fest 0
    dv.setUint32(14, e.crc, true);                // CRC-32
    dv.setUint32(18, e.daten.length, true);       // komprimierte Groesse (= unkomprimiert, Store)
    dv.setUint32(22, e.daten.length, true);       // unkomprimierte Groesse
    dv.setUint16(26, e.nameBytes.length, true);   // Namenslaenge
    dv.setUint16(28, 0, true);                    // Extra-Feld-Laenge
    return b;
  }

  /* Ein 46-Byte Central-Directory-Header (ohne Name/Extra/Kommentar), s.
     ZIP-Spec 4.3.12. localOffset = Position des zugehoerigen lokalen Headers. */
  function zentralerHeader(e, localOffset) {
    var b = new Uint8Array(46);
    var dv = new DataView(b.buffer);
    dv.setUint32(0, 0x02014b50, true);           // Signatur
    dv.setUint16(4, 20, true);                    // Version made by
    dv.setUint16(6, 20, true);                    // Version needed to extract
    dv.setUint16(8, e.flag, true);                // General purpose bit flag
    dv.setUint16(10, 0, true);                    // Methode 0 = ungespeichert
    dv.setUint16(12, 0, true);                    // Zeit — fest 0
    dv.setUint16(14, 0, true);                    // Datum — fest 0
    dv.setUint32(16, e.crc, true);                 // CRC-32
    dv.setUint32(20, e.daten.length, true);        // komprimierte Groesse
    dv.setUint32(24, e.daten.length, true);        // unkomprimierte Groesse
    dv.setUint16(28, e.nameBytes.length, true);    // Namenslaenge
    dv.setUint16(30, 0, true);                     // Extra-Feld-Laenge
    dv.setUint16(32, 0, true);                     // Kommentarlaenge
    dv.setUint16(34, 0, true);                     // Nummer der Diskette
    dv.setUint16(36, 0, true);                     // Interne Dateiattribute
    dv.setUint32(38, 0, true);                     // Externe Dateiattribute
    dv.setUint32(42, localOffset, true);           // Offset des lokalen Headers
    return b;
  }

  /* Ein 22-Byte End-of-Central-Directory-Record, s. ZIP-Spec 4.3.16. */
  function eocdRecord(anzahl, cdGroesse, cdOffset) {
    var b = new Uint8Array(22);
    var dv = new DataView(b.buffer);
    dv.setUint32(0, 0x06054b50, true);   // Signatur
    dv.setUint16(4, 0, true);             // Nummer dieser Diskette
    dv.setUint16(6, 0, true);             // Diskette mit Start des Central Directory
    dv.setUint16(8, anzahl, true);        // Eintraege in dieser Diskette
    dv.setUint16(10, anzahl, true);       // Eintraege insgesamt
    dv.setUint32(12, cdGroesse, true);    // Groesse des Central Directory
    dv.setUint32(16, cdOffset, true);     // Offset des Central Directory
    dv.setUint16(20, 0, true);            // Kommentarlaenge
    return b;
  }

  /* ---------- API ---------- */

  /* baue(eintraege) -> Uint8Array. eintraege = [{ name, daten }], daten ein
     Uint8Array ODER ein String (wird nach UTF-8 kodiert). Store-only —
     jeder Eintrag wird unkomprimiert abgelegt, CRC-32 selbst berechnet.
     Rundgang-Vertrag: zipLesen.oeffne(baue(eintraege).buffer).lies(name)
     liefert jeden Eintrag byte-identisch (bzw. bei String-Input zeichen-
     identisch nach UTF-8-Hin-und-Rueck) zurueck. */
  function baue(eintraege) {
    eintraege = eintraege || [];

    var vorbereitet = eintraege.map(function (e) {
      var name = String(e.name);
      var nameBytes = new TextEncoder().encode(name);
      var daten = nachBytes(e.daten);
      return {
        name: name,
        nameBytes: nameBytes,
        daten: daten,
        crc: crc32(daten),
        flag: istNichtAscii(name) ? 0x0800 : 0
      };
    });

    var teile = [];       // Ausgabe-Reihenfolge: alle lokalen Eintraege, dann Central Directory, dann EOCD
    var offsets = [];     // Offset des lokalen Headers je Eintrag (fuer den Central-Directory-Verweis)
    var pos = 0;

    vorbereitet.forEach(function (e) {
      offsets.push(pos);
      var header = lokalerHeader(e);
      teile.push(header, e.nameBytes, e.daten);
      pos += header.length + e.nameBytes.length + e.daten.length;
    });

    var cdStart = pos;
    vorbereitet.forEach(function (e, i) {
      var header = zentralerHeader(e, offsets[i]);
      teile.push(header, e.nameBytes);
      pos += header.length + e.nameBytes.length;
    });
    var cdGroesse = pos - cdStart;

    var eocd = eocdRecord(vorbereitet.length, cdGroesse, cdStart);
    teile.push(eocd);
    pos += eocd.length;

    var out = new Uint8Array(pos);
    var o = 0;
    teile.forEach(function (t) { out.set(t, o); o += t.length; });
    return out;
  }

  var zipSchreiben = { baue: baue };

  root.zipSchreiben = zipSchreiben;
  if (typeof module !== 'undefined' && module.exports) module.exports = { zipSchreiben: zipSchreiben };
})(typeof globalThis !== 'undefined' ? globalThis : this);
