/* Baut das Interaktions-Drehbuch (.docx) fuer Fachverantwortliche ohne
   Werkstatt-Zugang, aus den geparsten Interaktions-Contracts (Schritt 5,
   Etappe 5, Task F3) — je Kapitel das intendierte Lernerlebnis als
   Drehbuch. Wird von der App beim Schritt-5-Upload GEBAUT ("Inhalt vom
   Modell, Form vom Werkzeug", Muster Schritt 3/4) und VOR der Blockdatei
   abgelegt. Es ist eine ANSICHT der Interaktions-Contracts, nie eine
   zweite Wahrheit — massgebend fuer Schritt 6 bleibt die .blocks-Datei
   (Entscheid Markus, 2026-08-07).

   Mechanik GENAU das Muster von docx-bauen.js (B4, Etappe 3b): die
   Vorlage (reference.docx, ueber graph.vorlageLaden — derselbe gecachte
   Helfer wie Schritt 3/4) wird mit zip-lesen.js geoeffnet, NUR
   word/document.xml wird neu erzeugt, jeder andere Vorlagen-Teil reicht
   byte-identisch durch (liesBytes). ANDERS als docx-bauen.js: KEINE
   Bilder, KEINE rels-/Content-Types-Aenderungen — das Interaktions-
   Drehbuch ist reiner Text, es gibt nichts einzubetten.

   Styles der Vorlage (styleIds, nicht die Namen — deutsches Word
   eindeutscht beim Speichern die eingebauten Kennungen, s.
   docx-bauen.js-Kommentarkopf): Titel (Titelkopf), berschrift1
   (Kapitel-Ueberschrift je Contract), Merksatz/Fehlvorstellung/Quelle
   (die Kasten-Formatvorlagen der Vorlage). */
(function (root) {
  'use strict';

  /* Lazy-Accessoren (Muster Z()/ZS() in docx-bauen.js): root.zipLesen/
     zipSchreiben sind gesetzt, sobald die jeweilige Datei vorher
     geladen/ge-required wurde — im Browser per Script-Tag-Reihenfolge
     (index.html), in Node per require-Kopf im Test. */
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

  var STYLE_TITEL = 'Titel';
  var STYLE_H1 = 'berschrift1';
  var STYLE_MERKSATZ = 'Merksatz';
  var STYLE_FEHLVORSTELLUNG = 'Fehlvorstellung';
  var STYLE_QUELLE = 'Quelle';

  /* Kein r:/wp:/a:/pic:-Namespace noetig — dieses Dokument bettet keine
     Bilder ein (anders als docx-bauen.js), reiner Fliesstext. */
  var DOC_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">';

  /* ---------- XML-Escaping — eigene Kopie (Task-Brief: Module teilen
     keinen Code ueber Globals hinaus, jedes fuehrt seine eigene
     Escaping-Funktion). FUENF Zeichen (docx-bauen.js escaped kein
     Apostroph — hier vom Task-Brief ausdruecklich verlangt, Muster
     helpers.escapeHtml in app.js). ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pAbsatz(text, pStyle) {
    var t = text == null ? '' : String(text);
    return '<w:p>' + (pStyle ? '<w:pPr><w:pStyle w:val="' + esc(pStyle) + '"/></w:pPr>' : '') +
      '<w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r></w:p>';
  }

  /* Eingerueckter Absatz OHNE Named Style (direkte Formatierung) — die
     Entscheid-/Verschoben-Zeile unter einem behandelten offenen Punkt. */
  function pAbsatzEingerueckt(text) {
    var t = text == null ? '' : String(text);
    return '<w:p><w:pPr><w:ind w:left="360"/></w:pPr>' +
      '<w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r></w:p>';
  }

  /* Ein Absatz aus zwei Runs: fett gesetzte Beschriftung + normaler Text
     — Muster pAbsatzMitFettPraefix()/wissenscheckAbsaetze() in
     docx-bauen.js. */
  function pAbsatzMitFettPraefix(fett, rest, pStyle) {
    return '<w:p>' + (pStyle ? '<w:pPr><w:pStyle w:val="' + esc(pStyle) + '"/></w:pPr>' : '') +
      '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + esc(fett) + '</w:t></w:r>' +
      '<w:r><w:t xml:space="preserve">' + esc(rest) + '</w:t></w:r></w:p>';
  }

  /* Eine Dramaturgie-Zeile NUR, wenn der Wert nicht leer ist — "Fehlende
     optionale Felder (leer): Zeile weglassen, nie undefined rendern"
     (Task-Brief). */
  function fettZeileWennGesetzt(out, label, wert) {
    if (wert == null || String(wert).trim() === '') return out;
    return out + pAbsatzMitFettPraefix(label, ' ' + wert, null);
  }

  /* ---------- sectPr aus der Vorlage — wortgleich docx-bauen.js sectPrVon() ---------- */
  function sectPrVon(xml) {
    var alle = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g);
    if (!alle || !alle.length) return null;
    return alle[alle.length - 1];
  }

  /* ---------- Titelkopf ---------- */
  function kopfAbsaetze(gelesen) {
    var kurs = (gelesen.kopf && gelesen.kopf.kurs) || '';
    var n = (gelesen.contracts || []).length;
    var basis = (gelesen.kopf && gelesen.kopf.basiertAuf) || '';
    var out = pAbsatz('Interaktions-Drehbuch · ' + kurs, STYLE_TITEL);
    out += pAbsatz('Basis: ' + basis + ' · ' + n + ' Interaktions-Contracts', null);
    out += pAbsatz('Ansicht der Interaktions-Contracts — massgebend ist die .blocks-Datei; ' +
      'die endgültige Aufgabenform gestaltet Schritt 6.', null);
    return out;
  }

  /* Das Content-Kapitel zu einem Contract — Match ueber die ek (Task-Brief).
     contentGelesen = skriptLesen.lies()-Ergebnis der geltenden
     content_final.blocks; kein Treffer liefert null (dann faellt die H1
     auf die ek zurueck, s. contractAbsaetze). */
  function kapitelVon(contentGelesen, ek) {
    var liste = (contentGelesen && contentGelesen.kapitel) || [];
    for (var i = 0; i < liste.length; i++) {
      if (liste[i] && liste[i].ek === ek) return liste[i];
    }
    return null;
  }

  /* ---------- ein Interaktions-Contract als Drehbuch-Absaetze ---------- */
  function contractAbsaetze(c, contentGelesen) {
    var kap = kapitelVon(contentGelesen, c.ek);
    var h1 = kap ? ('Kapitel ' + (kap.nr || '') + ' · ' + (kap.titel || '')) : c.ek;
    var out = pAbsatz(h1, STYLE_H1);
    out += pAbsatz(c.ek + ' · Interaktionstyp: ' + c.typ, STYLE_QUELLE);

    var f = c.felder || {};
    if (c.typ === 'fliesstext') {
      /* statt der sechs Dramaturgie-Zeilen genau EIN Absatz (Task-Brief). */
      out += pAbsatz('Bewusste Ausnahme ohne Interaktion — Begründung: ' + (f.begruendung || ''),
        STYLE_FEHLVORSTELLUNG);
    } else {
      out = fettZeileWennGesetzt(out, 'Zielhandlung:', f.zielhandlung);
      out = fettZeileWennGesetzt(out, 'Einstiegsfrage:', f.vorhersage);
      out = fettZeileWennGesetzt(out, 'Du stellst ein:', f.steuert);
      out = fettZeileWennGesetzt(out, 'Du siehst:', f.beobachtet);
      out = fettZeileWennGesetzt(out, 'Der Aha-Moment:', f.aha);
      out = fettZeileWennGesetzt(out, 'Auflösung:', f.konsequenz);
    }

    /* Merksatz/Denkfehler/Stuetztext — wie oben, unabhaengig vom Typ
       (kernaussage/denkfehler/stuetztext sind bei JEDEM Contract Pflicht,
       Task-Brief "Merksatz/Denkfehler/Stuetztext wie oben"). Leer ->
       Zeile weglassen. */
    if (f.kernaussage) out += pAbsatz(f.kernaussage, STYLE_MERKSATZ);
    if (f.denkfehler) out += pAbsatz('Typischer Denkfehler: ' + f.denkfehler, STYLE_FEHLVORSTELLUNG);
    if (f.stuetztext) out += pAbsatz('Stütztext: ' + f.stuetztext, STYLE_QUELLE);
    return out;
  }

  /* ---------- Behandelte offene Punkte (nur wenn gelesen.punkte.length) ---------- */
  function punkteAbsaetze(gelesen) {
    var punkte = gelesen.punkte || [];
    if (!punkte.length) return '';
    var out = pAbsatz('Behandelte offene Punkte', STYLE_H1);
    punkte.forEach(function (p) {
      out += pAbsatz('- ' + (p.punkt || ''), null);
      if (p.entscheid) {
        out += pAbsatzEingerueckt('Entscheid: ' + p.entscheid);
      } else if (p.verschieben) {
        out += pAbsatzEingerueckt('Verschoben an ' + p.verschieben + ': ' + (p.begruendung || ''));
      }
    });
    return out;
  }

  function bodyAbsaetze(gelesen, contentGelesen) {
    var out = kopfAbsaetze(gelesen);
    (gelesen.contracts || []).forEach(function (c) { out += contractAbsaetze(c, contentGelesen); });
    out += punkteAbsaetze(gelesen);
    return out;
  }

  /* ---------- API ---------- */

  /* baue(vorlageArrayBuffer, gelesen, contentGelesen) -> Promise<Uint8Array>.
     gelesen = Ergebnis von didaktikLesen.lies() (kopf, contracts, punkte);
     contentGelesen = skriptLesen.lies() der geltenden content_final.blocks
     (liefert Kapitel-Titel/-Nummern fuer den Match ueber ek, s.
     kapitelVon()). Wirft, wenn die Vorlage kein word/document.xml oder
     kein <w:sectPr> traegt — Muster docx-bauen.js baue(). */
  async function baue(vorlageArrayBuffer, gelesen, contentGelesen) {
    var zip = Z().oeffne(vorlageArrayBuffer);
    if (!zip.eintraege['word/document.xml']) {
      throw new Error('didaktikDrehbuch.baue: Vorlage ist keine gueltige docx — word/document.xml fehlt');
    }

    var vorlageXml = await zip.lies('word/document.xml');
    var sectPr = sectPrVon(vorlageXml);
    if (!sectPr) {
      throw new Error('didaktikDrehbuch.baue: Vorlage document.xml enthaelt kein <w:sectPr> — ' +
        'Seiteneinrichtung fehlt.');
    }

    var body = bodyAbsaetze(gelesen, contentGelesen);
    var docXml = DOC_KOPF + '<w:body>' + body + sectPr + '</w:body></w:document>';

    /* Alle Vorlagen-Teile ausser word/document.xml byte-identisch
       uebernehmen (liesBytes) — KEINE rels-/Content-Types-Aenderungen,
       dieses Dokument bettet keine Bilder ein (anders als docx-bauen.js). */
    var namen = Object.keys(zip.eintraege).filter(function (n) { return n !== 'word/document.xml'; });
    var bytesListe = await Promise.all(namen.map(function (n) { return zip.liesBytes(n); }));
    var eintraege = namen.map(function (n, i) { return { name: n, daten: bytesListe[i] }; });
    eintraege.push({ name: 'word/document.xml', daten: docXml });

    return ZS().baue(eintraege);
  }

  var didaktikDrehbuch = { baue: baue };

  root.didaktikDrehbuch = didaktikDrehbuch;
  if (typeof module !== 'undefined' && module.exports) module.exports = { didaktikDrehbuch: didaktikDrehbuch };
})(typeof globalThis !== 'undefined' ? globalThis : this);
