/* Baut ein Word-Dokument (.docx) im Browser gegen eine Vorlage — der Kern der
   Baustrecke (Etappe 3b, Task B4). Kein Pandoc, kein LibreOffice: die Vorlage
   (reference.docx, Graph, B5 laedt sie aus `_zentral/vorlagen/`) wird mit
   `zip-lesen.js` geoeffnet, NUR `word/document.xml` wird neu erzeugt, alle
   uebrigen Teile (styles, numbering, fonts, Kopf-/Fusszeilen, Theme) reichen
   byte-identisch durch — die Formatvorlagen der Vorlage bleiben dadurch exakt
   erhalten, ohne dass dieser Bauer sie selbst kennen muesste. `media/` +
   `word/_rels/document.xml.rels` + `[Content_Types].xml` werden um die
   uebergebenen PNGs ergaenzt. Verpackt wird mit `zip-schreiben.js`.

   Verhaltensreferenz fuer die Inhalts-Abbildung: die markdown()-Funktion in
   IT_Architektur_bbz/output/tools/skript-bauen.cjs (WAS in welcher
   Reihenfolge gesetzt wird) — dieser Bauer erzeugt aber document.xml DIREKT,
   nicht Markdown fuer Pandoc. Kein Parity-Waechter im Tools-Baum: der
   Tools-Bauer setzt ueber Pandoc/Markdown, nicht ueber rohes OOXML — es gibt
   keine wortgleiche Gegenseite zum Spiegeln (anders als bei skript-schema.js/
   skript-lesen.js/diagramm-zeichnen.js, Task B2/B3).

   Styles der Vorlage: 'Titel' (Titelkopf), 'berschrift1'/'berschrift2'
   (Kapitel-/Zwischen-Ueberschrift — die styleId, NICHT der Name: deutsches
   Word eindeutscht beim Speichern die eingebauten Kennungen und laesst dabei
   das fuehrende „Ü" weg — „Überschrift1" wird zu styleId „berschrift1",
   „Title" zu „Titel". Dokumentiert in
   IT_Architektur_bbz/output/tools/pruefe-reference-vorlage.js: „Word
   eindeutscht beim Speichern die Kennungen (Heading1 wird zu berschrift1,
   Title zu Titel), behaelt aber den kanonischen Namen." Die Bausteinnamen
   (Hero, Story, Beispiel, Merksatz, Fehlvorstellung, DeepDive, Wissenscheck,
   Abschluss, Quelle) sind eigene, custom-style, NICHT eingebaute Kennungen —
   die eindeutscht Word nicht um. */
(function (root) {
  'use strict';

  /* Lazy-Accessoren (Muster Z()/S() in xlsx-lesen.js/skript-lesen.js):
     root.zipLesen/zipSchreiben/skriptSchema sind gesetzt, sobald die
     jeweilige Datei vorher geladen/ge-required wurde — im Browser per
     Script-Tag-Reihenfolge (index.html), in Node per require-Kopf im Test. */
  function Z() {
    if (root.zipLesen) return root.zipLesen;
    if (typeof module !== 'undefined' && module.exports) return require('./zip-lesen.js').zipLesen;
    throw new Error('zip-lesen.js nicht geladen');
  }
  function ZS() {
    if (root.zipSchreiben) return root.zipSchreiben;
    if (typeof module !== 'undefined' && module.exports) return require('./zip-schreiben.js').zipSchreiben;
    throw new Error('zip-schreiben.js nicht geladen');
  }
  function S() {
    if (root.skriptSchema) return root.skriptSchema;
    if (typeof module !== 'undefined' && module.exports) return require('./skript-schema.js').skriptSchema;
    throw new Error('skript-schema.js nicht geladen');
  }

  var STYLE_TITEL = 'Titel';
  var STYLE_H1 = 'berschrift1';
  var STYLE_H2 = 'berschrift2';
  var STYLE_QUELLE = 'Quelle';

  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var REL_IMAGE_TYPE = NS_R + '/image';

  var LEERE_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  var DOC_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="' + NS_R + '" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">';

  /* ---------- XML-Escaping — eigene Funktion, JEDER Textknoten laeuft hindurch ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- kleine Bau-Helfer ---------- */

  function pAbsatz(text, pStyle) {
    var t = text == null ? '' : String(text);
    return '<w:p>' + (pStyle ? '<w:pPr><w:pStyle w:val="' + esc(pStyle) + '"/></w:pPr>' : '') +
      '<w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r></w:p>';
  }

  /* "- Punkt" -> "– Punkt" (Bullet-Glyph als Textpraefix, KEINE numbering.xml-
     Manipulation — YAGNI, s. Task-Brief). Andere Zeilen bleiben getrimmt. */
  function zeilenText(z) {
    var t = String(z).trim();
    var m = t.match(/^-\s+(.*)$/);
    return m ? '– ' + m[1] : t;
  }

  /* Ein Baustein-Teiltext (mehrzeilig) -> Absaetze.
     WICHTIG (behebt die Politur-Stelle vom 2026-08-03 BY CONSTRUCTION):
     jede Zeile eines Kasten-Bausteins (b.stil !== null) traegt DENSELBEN
     Kasten-pStyle — auch eine "- "-Listenzeile. Es gibt hier keinen
     zweiten, listen-eigenen pStyle-Zweig, der die Kasten-Zugehoerigkeit
     verlieren koennte.
     Ist b.stil null (DEFINITION/ERKLAERUNG, reiner Fliesstext): die ERSTE
     Zeile des Teils traegt Überschrift2 (STYLE_H2), der Rest sind normale
     Absaetze ohne pStyle. */
  function bausteinAbsaetze(b, inhalt) {
    if (!inhalt) return '';
    var zeilen = String(inhalt).split('\n').filter(function (z) { return z.trim() !== ''; });
    if (!zeilen.length) return '';
    if (b.stil === null) {
      var out = pAbsatz(zeilenText(zeilen[0]), STYLE_H2);
      for (var i = 1; i < zeilen.length; i++) out += pAbsatz(zeilenText(zeilen[i]), null);
      return out;
    }
    var out2 = '';
    for (var j = 0; j < zeilen.length; j++) out2 += pAbsatz(zeilenText(zeilen[j]), b.stil);
    return out2;
  }

  /* ---------- sectPr aus der Vorlage ---------- */

  /* Nimmt das LETZTE <w:sectPr> im Vorlagen-document.xml (die abschliessende
     Abschnitts-/Seiteneinrichtung eines einfachen, einabschnittigen
     Dokuments) und haengt es unveraendert an das Ende des neuen w:body —
     Seitenraender/-format bleiben so Vorlagen-Sache (Task-Brief). Fehlt ein
     sectPr ganz, ist die Vorlage keine brauchbare Grundlage — kein
     Rateversuch, ein klarer Wurf statt einer stillen Fallback-Seiteneinrichtung. */
  function sectPrVon(xml) {
    var alle = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g);
    if (!alle || !alle.length) return null;
    return alle[alle.length - 1];
  }

  /* ---------- Bild-Groesse aus dem PNG-Header (IHDR) ---------- */

  var PNG_SIGNATUR = [137, 80, 78, 71, 13, 10, 26, 10];
  var FALLBACK_BREITE = 900, FALLBACK_HOEHE = 300; /* Standardbreite der SVG-Zeichner
     (diagramm-zeichnen.js) — Fallback, wenn Bytes kein lesbares PNG-IHDR tragen
     (z. B. ein Nicht-PNG-Testdouble). Dokumentierte Grenze, kein Rateversuch an
     echten Bildern: ein echtes PNG traegt sein IHDR immer an fester Position. */
  function pngMasse(bytes) {
    if (bytes && bytes.length >= 24) {
      var istPng = true;
      for (var i = 0; i < 8; i++) if (bytes[i] !== PNG_SIGNATUR[i]) { istPng = false; break; }
      if (istPng) {
        var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var breite = dv.getUint32(16, false), hoehe = dv.getUint32(20, false);
        if (breite > 0 && hoehe > 0) return { breite: breite, hoehe: hoehe };
      }
    }
    return { breite: FALLBACK_BREITE, hoehe: FALLBACK_HOEHE };
  }

  /* EMU = Pixel * 9525 (96 dpi) — Koordinator-Vorgabe (Task-Brief). Bekannte,
     bewusst nicht in dieser Task geloeste Feinheit: diagrammZeichnen.png()
     rendert mit Canvas-Faktor 2 fuer Bildschaerfe — die PNG-Pixelmasse sind
     dadurch doppelt so gross wie die logische SVG-Groesse. Diese Funktion
     rechnet die PNG-Pixel direkt in EMU um, ohne den Faktor herauszurechnen;
     ob das im Dokument zu gross wirkt, klaert die Live-Probe (B9)/der
     Design-Feinschliff (B7). */
  function drawingAbsatz(rid, dateiname, breitePx, hoehePx, docPrId) {
    var emuB = breitePx * 9525, emuH = hoehePx * 9525;
    return '<w:p><w:r><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + emuB + '" cy="' + emuH + '"/>' +
      '<wp:docPr id="' + docPrId + '" name="' + esc(dateiname) + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic>' +
      '<pic:nvPicPr><pic:cNvPr id="' + docPrId + '" name="' + esc(dateiname) + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + emuB + '" cy="' + emuH + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }

  /* Registriert (einmalig je Dateiname) eine Bild-Relationship und liefert
     den Drawing-Absatz. ctx.docPrZaehler zaehlt JEDE Einbettung (auch eine
     Wiederverwendung derselben Datei) hoch — jedes <wp:docPr id> muss im
     Dokument eindeutig sein, unabhaengig von der Relationship-Wiederverwendung. */
  function bildAbsatzAusBytes(dateiname, bytes, ctx) {
    var rid = ctx.relIds[dateiname];
    if (!rid) {
      rid = 'rId' + ctx.naechsteRid;
      ctx.naechsteRid += 1;
      ctx.relIds[dateiname] = rid;
      ctx.neueBilder.push({ dateiname: dateiname, bytes: bytes });
    }
    ctx.docPrZaehler += 1;
    var masse = pngMasse(bytes);
    return drawingAbsatz(rid, dateiname, masse.breite, masse.hoehe, ctx.docPrZaehler);
  }

  /* Dateiname-Konvention der gerenderten Diagramm-PNGs — oeffentlich
     (docxBauen.bildDateiname), damit B5 beim Rendern denselben Namen
     erzeugt, den dieser Bauer beim Nachschlagen in `bilder` erwartet. Muster
     wortgleich mit bildDateiname() in skript-bauen.cjs (Tools-Baum). */
  function bildDateiname(kurs, variante, nr) {
    return kurs + '-' + variante + '-abb-' + String(nr).padStart(3, '0') + '.png';
  }

  /* ---------- vergleichstabelle als w:tbl ---------- */

  var TABELLE_GESAMTBREITE_DXA = 9026; /* ~6.27in Inhaltsbreite, uebliches A4-Mass */

  function zelleXml(text, breiteDxa, kopfzeile) {
    return '<w:tc><w:tcPr><w:tcW w:w="' + breiteDxa + '" w:type="dxa"/></w:tcPr>' +
      '<w:p>' + (kopfzeile ? '<w:pPr><w:rPr><w:b/></w:rPr></w:pPr>' : '') +
      '<w:r>' + (kopfzeile ? '<w:rPr><w:b/></w:rPr>' : '') +
      '<w:t xml:space="preserve">' + esc(text || '') + '</w:t></w:r></w:p></w:tc>';
  }

  function tabelleAbsatz(abbildung) {
    var kopf = String((abbildung.felder && abbildung.felder.kopf) || '').split('|')
      .map(function (s) { return s.trim(); });
    var zeilenRoh = String((abbildung.felder && abbildung.felder.zeilen) || '').split('\n')
      .map(function (z) { return z.split('|').map(function (s) { return s.trim(); }); })
      .filter(function (z) { return z.length > 1; });
    var n = kopf.length || 1;
    var breiteJeSpalte = Math.floor(TABELLE_GESAMTBREITE_DXA / n);
    var grid = '';
    for (var i = 0; i < n; i++) grid += '<w:gridCol w:w="' + breiteJeSpalte + '"/>';
    function zeile(zellen, kopfzeile) {
      var tr = '<w:tr>';
      for (var i2 = 0; i2 < n; i2++) tr += zelleXml(zellen[i2], breiteJeSpalte, kopfzeile);
      return tr + '</w:tr>';
    }
    var tbl = '<w:tbl><w:tblPr><w:tblW w:w="' + TABELLE_GESAMTBREITE_DXA + '" w:type="dxa"/>' +
      '<w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
      '</w:tblBorders></w:tblPr>' +
      '<w:tblGrid>' + grid + '</w:tblGrid>' +
      zeile(kopf, true) +
      zeilenRoh.map(function (z) { return zeile(z, false); }).join('') +
      '</w:tbl>';
    var titelP = abbildung.titel ? pAbsatz(abbildung.titel, STYLE_QUELLE) : '';
    return tbl + titelP;
  }

  /* ---------- ABBILDUNG (nicht Tabelle) ---------- */

  function abbildungAbsatz(k, a, ctx) {
    ctx.bildNr += 1;
    var dateiname = bildDateiname(ctx.kurs, ctx.variante, ctx.bildNr);
    var bytes = ctx.bilder[dateiname];
    if (!bytes) {
      throw new Error('docxBauen.baue: Bild fehlt in bilder: "' + dateiname +
        '" (Kapitel ' + (k.ek || '?') + ')');
    }
    var absatz = bildAbsatzAusBytes(dateiname, bytes, ctx);
    return absatz + (a.titel ? pAbsatz(a.titel, STYLE_QUELLE) : '');
  }

  /* ---------- ILLUSTRATION (B6, tolerant behandeln) ---------- */

  /* k.teile.ILLUSTRATION existiert heute (vor B6) nie — skript-schema.js
     kennt den Block noch nicht, skript-lesen.js wuerde ihn als "Unbekannter
     Block" abweisen und NICHT in teile ablegen. Dieser Code ist bewusst
     vorgezogen und tolerant: fehlt der Teil oder das Feld "datei:" oder die
     Datei in `bilder`, wird schlicht nichts eingefuegt — kein Fehler, kein
     Abbruch (Task-Brief: "tolerant behandeln"). */
  function illustrationAbsatz(k, ctx) {
    var roh = k.teile && k.teile.ILLUSTRATION;
    if (!roh) return '';
    var m = String(roh).match(/^datei:[ \t]*(.+)$/m);
    if (!m) return '';
    var dateiname = m[1].trim();
    if (!dateiname) return '';
    var bytes = ctx.bilder[dateiname];
    if (!bytes) return '';
    return bildAbsatzAusBytes(dateiname, bytes, ctx);
  }

  /* ---------- Titelkopf, Kapitel, Anhang ---------- */

  function titelkopfAbsaetze(g) {
    var titel = g.skript.titel || g.skript.kurs || '';
    var zeile = 'Kurs ' + (g.skript.kurs || '') + ' · Rechtsstand: ' + (g.skript.rechtsstand || 'offen');
    return pAbsatz(titel, STYLE_TITEL) + pAbsatz(zeile, null);
  }

  function kapitelKopfAbsaetze(k) {
    var titel = 'Kapitel ' + (k.nr || '') + ' · ' + (k.titel || '');
    var meta = (k.ek || '') + ' · Bloom ' + (k.bloom || '') + ' · Richtzeit ' +
      (k.richtzeit || '') + ' Minuten';
    return pAbsatz(titel, STYLE_H1) + pAbsatz(meta, STYLE_QUELLE);
  }

  /* Wortlaut wie der Tools-Bauer (skript-bauen.cjs markdown()): "Gelesene
     Quellen" / "Nicht geöffnet" als Unterabschnitte von "Quellenverzeichnis". */
  function quellenverzeichnisAbsaetze(g) {
    var out = pAbsatz('Quellenverzeichnis', STYLE_H1);
    var gelesen = (g.quellen && g.quellen.gelesen) || [];
    var nicht = (g.quellen && g.quellen.nichtGeoeffnet) || [];
    if (gelesen.length) {
      out += pAbsatz('Gelesene Quellen', STYLE_H2);
      gelesen.forEach(function (z) { out += pAbsatz(z, null); });
    }
    if (nicht.length) {
      out += pAbsatz('Nicht geöffnet', STYLE_H2);
      nicht.forEach(function (z) { out += pAbsatz(z, null); });
    }
    return out;
  }

  /* OFFEN -> "Ergänzungen" (E6, wie der Tools-Bauer). Leerfall "- keine"
     (Koordinator-Vorgabe fuer den docx-Bauer — anders als markdown(), das
     bei leerer Liste stillschweigend nichts ausgibt: eine leere Ueberschrift
     ohne jede Zeile waere im fertigen Word irritierend). */
  function ergaenzungenAbsaetze(g) {
    var out = pAbsatz('Ergänzungen', STYLE_H1);
    var offen = g.offen || [];
    if (offen.length) offen.forEach(function (z) { out += pAbsatz(z, null); });
    else out += pAbsatz('- keine', null);
    return out;
  }

  /* ---------- Bausteine eines Kapitels in Schema-Reihenfolge ---------- */

  function kapitelAbsaetze(k, ctx) {
    var out = kapitelKopfAbsaetze(k);
    out += illustrationAbsatz(k, ctx); /* an Hero-Position: vor dem Hero-Baustein selbst */
    S().SCHEMA.bausteine.forEach(function (b) {
      if (b.block === 'ABBILDUNG') {
        (k.abbildungen || []).forEach(function (a) {
          var typ = S().diagrammTyp(a.typ);
          if (typ && typ.alsTabelle) { out += tabelleAbsatz(a); return; }
          out += abbildungAbsatz(k, a, ctx);
        });
        return;
      }
      out += bausteinAbsaetze(b, k.teile[b.block]);
    });
    return out;
  }

  function bodyAbsaetze(gelesen, ctx) {
    var out = titelkopfAbsaetze(gelesen);
    (gelesen.kapitel || []).forEach(function (k) { out += kapitelAbsaetze(k, ctx); });
    out += quellenverzeichnisAbsaetze(gelesen);
    out += ergaenzungenAbsaetze(gelesen);
    return out;
  }

  /* ---------- rels/[Content_Types].xml ---------- */

  function naechsteRidAus(relsXml) {
    var re = /Id="rId(\d+)"/g, m, max = 0;
    while ((m = re.exec(relsXml))) { var n = parseInt(m[1], 10); if (n > max) max = n; }
    return max + 1;
  }

  /* ---------- API ---------- */

  /* baue(vorlageArrayBuffer, gelesen, bilder) -> Promise<Uint8Array>.
     gelesen = Ergebnis von skriptLesen.lies(); bilder = { dateiname ->
     Uint8Array } (gerenderte Diagramm-PNGs aus B3 + hochgeladene
     Illustrations-PNGs aus B5). Wirft, wenn die Vorlage kein
     word/document.xml, kein [Content_Types].xml oder kein <w:sectPr> traegt,
     oder wenn ein nicht-tabellarisches ABBILDUNG-Bild in `bilder` fehlt. */
  async function baue(vorlageArrayBuffer, gelesen, bilder) {
    bilder = bilder || {};
    var zip = Z().oeffne(vorlageArrayBuffer);
    if (!zip.eintraege['word/document.xml']) {
      throw new Error('docxBauen.baue: Vorlage ist keine gueltige docx — word/document.xml fehlt');
    }
    if (!zip.eintraege['[Content_Types].xml']) {
      throw new Error('docxBauen.baue: Vorlage ohne [Content_Types].xml');
    }

    var vorlageXml = await zip.lies('word/document.xml');
    var sectPr = sectPrVon(vorlageXml);
    if (!sectPr) {
      throw new Error('docxBauen.baue: Vorlage document.xml enthaelt kein <w:sectPr> — ' +
        'Seiteneinrichtung fehlt.');
    }
    var relsXml = await zip.lies('word/_rels/document.xml.rels');
    if (!relsXml) relsXml = LEERE_RELS;
    var ctXml = await zip.lies('[Content_Types].xml');

    var ctx = {
      kurs: gelesen.skript.kurs, variante: gelesen.skript.variante, bilder: bilder,
      relIds: {}, naechsteRid: naechsteRidAus(relsXml),
      bildNr: 0, docPrZaehler: 0, neueBilder: []
    };

    var body = bodyAbsaetze(gelesen, ctx);
    var docXml = DOC_KOPF + '<w:body>' + body + sectPr + '</w:body></w:document>';

    var relEintraege = ctx.neueBilder.map(function (b) {
      return '<Relationship Id="' + ctx.relIds[b.dateiname] + '" Type="' + REL_IMAGE_TYPE +
        '" Target="media/' + esc(b.dateiname) + '"/>';
    }).join('');
    var neuRelsXml = relsXml.indexOf('</Relationships>') >= 0
      ? relsXml.replace('</Relationships>', relEintraege + '</Relationships>')
      : relsXml + relEintraege;
    var neuCtXml = /<Default[^>]*Extension="png"/i.test(ctXml) ? ctXml
      : ctXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');

    /* Alle Vorlagen-Teile ausser den drei ersetzten byte-identisch uebernehmen
       (liesBytes — s. zip-lesen.js, PFLICHT-VORAUFGABE B4). */
    var namen = Object.keys(zip.eintraege).filter(function (n) {
      return n !== 'word/document.xml' && n !== 'word/_rels/document.xml.rels' &&
        n !== '[Content_Types].xml';
    });
    var bytesListe = await Promise.all(namen.map(function (n) { return zip.liesBytes(n); }));
    var eintraege = namen.map(function (n, i) { return { name: n, daten: bytesListe[i] }; });
    eintraege.push({ name: 'word/document.xml', daten: docXml });
    eintraege.push({ name: 'word/_rels/document.xml.rels', daten: neuRelsXml });
    eintraege.push({ name: '[Content_Types].xml', daten: neuCtXml });
    ctx.neueBilder.forEach(function (b) {
      eintraege.push({ name: 'word/media/' + b.dateiname, daten: b.bytes });
    });

    return ZS().baue(eintraege);
  }

  var docxBauen = { baue: baue, bildDateiname: bildDateiname };

  root.docxBauen = docxBauen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { docxBauen: docxBauen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
