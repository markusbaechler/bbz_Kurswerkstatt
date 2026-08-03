/* Zeichnet die Diagramme des Vokabulars aus reinen Daten — mechanische
   UMD-Portierung von IT_Architektur_bbz/output/tools/diagramm-rendern.cjs
   (Etappe 3b, Task B3). Parity-Waechter im Tools-Baum haelt beide Fassungen
   im Gleichlauf — Aenderungen IMMER in beiden Baeumen (s. dort
   test/app-parity.test.js).

   Die Vergleichstabelle (`vergleichstabelle`, `alsTabelle: true` im Schema)
   wird HIER — wie in der Tools-Fassung — nicht gezeichnet: svg() wirft.
   Sie wird eine echte Word-Tabelle, gebaut vom docx-Bauer (B4), nicht ein
   Bild.

   Farben NUR ueber style= oder als fester Wert. Als Praesentationsattribut
   loest der Browser var() nicht auf, die Linie bleibt unsichtbar
   (2026-07-24, s. diagramm-rendern.cjs).

   png() ist Browser-only (Image + Canvas) — dokumentierte Grenze: in Node
   gibt es kein DOM, die Funktion wirft dort eine klare Fehlermeldung statt
   eines ReferenceError (Muster DecompressionStream in xlsx-lesen.js/T11 —
   dort ist der Deflate-Pfad ebenfalls nur so weit geprueft, wie Node es
   nativ bereitstellt; hier gibt es in Node ueberhaupt keinen Pfad). Der
   Live-Beweis, dass ein damit erzeugtes PNG tatsaechlich ein Bild ist,
   ist Sache von Task B9 (s. CLAUDE.md). */
(function (root) {
  'use strict';

  /* Lazy-Accessor (Muster S() in skript-lesen.js, Z() in xlsx-lesen.js):
     root.skriptSchema ist gesetzt, sobald skript-schema.js vorher
     geladen/ge-required wurde — im Browser per Script-Tag-Reihenfolge
     (index.html), in Node per require-Kopf im Test. */
  function S() {
    if (root.skriptSchema) return root.skriptSchema;
    if (typeof module !== 'undefined' && module.exports) return require('./skript-schema.js').skriptSchema;
    throw new Error('skript-schema.js nicht geladen');
  }

  var AKZENT = '#1F5C8B';
  var PALETTE = ['#1F5C8B', '#3E86B5', '#7FB2D4', '#BBD5E7'];
  var TEXT = '#15222C';
  var GRAU = '#5A6870';
  var SCHRIFT = "'Segoe UI',sans-serif";

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* "Verwaltung 0.42 | Depotbank 0.08" -> [{name, wert}] */
  function wertePaare(zeile) {
    return String(zeile || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var m = s.match(/^(.*?)[\s:]+(-?[\d.,]+)$/);
      if (!m) throw new Error('Nicht-numerischer Wert: ' + s);
      var wert = parseFloat(m[2].replace(',', '.'));
      if (isNaN(wert)) throw new Error('Nicht-numerischer Wert: ' + m[2]);
      return { name: m[1].trim(), wert: wert };
    });
  }

  /* "Saeule 1: AHV | Saeule 2: BVG" -> ["Saeule 1: AHV", "Saeule 2: BVG"] */
  function zeilenListe(zeile) {
    return String(zeile || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* Ohne Titel wird der obere Streifen, den sonst die Ueberschrift braucht,
     weggeschnitten statt als leerer Rand stehen zu bleiben: die
     Zeichenflaeche wandert per transform nach oben, viewBox und Hoehe
     schrumpfen mit. Alle Zeichner legen ihren Inhalt ab y=70 an — KOPF=55
     laesst etwas Luft, ohne je in eine Form zu schneiden (gemessen an
     allen sieben Diagrammtypen). */
  var KOPF = 55;

  function rahmen(breite, hoehe, titel, innen, mitTitel) {
    if (mitTitel === undefined) mitTitel = true;
    if (!mitTitel) {
      var h2 = hoehe - KOPF;
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + breite + '" height="' + h2 +
        '" viewBox="0 0 ' + breite + ' ' + h2 + '">' +
        '<rect width="' + breite + '" height="' + h2 + '" style="fill:#ffffff"/>' +
        '<g transform="translate(0,-' + KOPF + ')">' + innen + '</g></svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + breite + '" height="' + hoehe +
      '" viewBox="0 0 ' + breite + ' ' + hoehe + '">' +
      '<rect width="' + breite + '" height="' + hoehe + '" style="fill:#ffffff"/>' +
      '<text x="40" y="42" style="fill:' + AKZENT + ';font:600 21px ' + SCHRIFT + '">' + esc(titel) + '</text>' +
      innen + '</svg>';
  }

  function kompositionsLeiste(a, opts) {
    var werte = wertePaare(a.felder.werte);
    if (werte.length === 0) throw new Error('kompositions-leiste: keine Werte vorhanden');
    for (var i = 0; i < werte.length; i++) {
      if (werte[i].wert < 0) throw new Error('kompositions-leiste: negative Werte nicht erlaubt');
    }
    var B = 900, RAND = 40, H = 250, LEISTE = 74;
    var nutz = B - 2 * RAND;
    var summe = werte.reduce(function (s, w) { return s + w.wert; }, 0);
    if (summe <= 0) throw new Error('kompositions-leiste: Summe muss groesser als null sein');
    var x = RAND, balken = '', legende = '';
    werte.forEach(function (w, i) {
      var br = (w.wert / summe) * nutz;
      var farbe = PALETTE[i % PALETTE.length];
      balken += '<rect x="' + x.toFixed(1) + '" y="70" width="' + br.toFixed(1) +
        '" height="' + LEISTE + '" style="fill:' + farbe + '"/>';
      if (br > 46) {
        balken += '<text x="' + (x + br / 2).toFixed(1) + '" y="' + (70 + LEISTE / 2 + 6) +
          '" text-anchor="middle" style="fill:#fff;font:600 17px ' + SCHRIFT + '">' +
          esc(w.wert) + '</text>';
      }
      var lx = RAND + i * (nutz / werte.length);
      legende += '<rect x="' + lx + '" y="182" width="13" height="13" style="fill:' + farbe + '"/>' +
        '<text x="' + (lx + 19) + '" y="193" style="fill:' + TEXT + ';font:400 15px ' + SCHRIFT + '">' +
        esc(w.name) + '</text>';
      x += br;
    });
    var achse = '<line x1="' + RAND + '" y1="158" x2="' + (B - RAND) + '" y2="158" style="stroke:' +
      GRAU + ';stroke-width:1"/>';
    return rahmen(B, H, a.titel, balken + achse + legende, opts && opts.mitTitel);
  }

  function waage(a, opts) {
    var B = 900, H = 260;
    var links = zeilenListe(a.felder.links), rechts = zeilenListe(a.felder.rechts);
    if (links.length === 0 && rechts.length === 0) throw new Error('waage: beide Seiten sind leer');
    function seite(x, eintraege, farbe) {
      var s = '<rect x="' + x + '" y="70" width="380" height="150" rx="10" style="fill:' + farbe +
        ';stroke:' + GRAU + ';stroke-width:1"/>';
      eintraege.forEach(function (e, i) {
        s += '<text x="' + (x + 20) + '" y="' + (105 + i * 26) + '" style="fill:' + TEXT +
          ';font:400 16px ' + SCHRIFT + '">' + esc(e) + '</text>';
      });
      return s;
    }
    var mitte = '<line x1="450" y1="60" x2="450" y2="230" style="stroke:' + GRAU +
      ';stroke-width:2;stroke-dasharray:6 5"/>';
    return rahmen(B, H, a.titel, seite(40, links, '#EAF1F7') + mitte + seite(480, rechts, '#F7F3EA'),
      opts && opts.mitTitel);
  }

  function schema(a, opts) {
    var ebenen = zeilenListe(a.felder.ebenen);
    if (ebenen.length === 0) throw new Error('schema: keine Ebenen vorhanden');
    var B = 900, oben = 70, hoehe = 62, luecke = 14;
    var H = oben + ebenen.length * (hoehe + luecke) + 20;
    var innen = '';
    ebenen.forEach(function (e, i) {
      var y = oben + i * (hoehe + luecke);
      var farbe = PALETTE[i % PALETTE.length];
      innen += '<rect x="40" y="' + y + '" width="820" height="' + hoehe + '" rx="8" style="fill:' +
        farbe + '"/>' +
        '<text x="62" y="' + (y + hoehe / 2 + 7) + '" style="fill:#ffffff;font:600 18px ' +
        SCHRIFT + '">' + esc(e) + '</text>';
      if (i < ebenen.length - 1) {
        innen += '<line x1="450" y1="' + (y + hoehe) + '" x2="450" y2="' + (y + hoehe + luecke) +
          '" style="stroke:' + GRAU + ';stroke-width:2"/>';
      }
    });
    return rahmen(B, H, a.titel, innen, opts && opts.mitTitel);
  }

  /* "ohne Kosten: 100,107,114 | mit Kosten: 100,106,112" */
  function reihenListe(zeile) {
    return zeilenListe(zeile).map(function (s) {
      var i = s.indexOf(':');
      var name = i < 0 ? s : s.slice(0, i).trim();
      var raw = i < 0 ? '' : s.slice(i + 1);
      var zahlen = raw.split(',').filter(function (z) { return z.trim(); }).map(function (z) {
        var trimmed = z.trim().replace(',', '.');
        var num = parseFloat(trimmed);
        if (isNaN(num)) throw new Error('Nicht-numerischer Wert: ' + z.trim());
        return num;
      });
      return { name: name, zahlen: zahlen };
    });
  }

  function drift(a, opts) {
    var reihen = reihenListe(a.felder.reihen);
    var gueltig = reihen.filter(function (r) { return r.zahlen.length > 0; });
    if (gueltig.length === 0) throw new Error('drift: keine Reihe mit Zahlen vorhanden');
    var B = 900, H = 300, L = 60, R2 = 40, O = 70, U = 60;
    var alle = gueltig.reduce(function (acc, r) { return acc.concat(r.zahlen); }, []);
    var max = Math.max.apply(null, alle);
    var min = Math.min.apply(null, alle);
    var spanne = (max - min) || 1;
    var luft = spanne * 0.05;
    var minSkaliert = min - luft;
    var maxSkaliert = max + luft;
    var panneSkaliert = (maxSkaliert - minSkaliert) || 1;
    var n = Math.max.apply(null, gueltig.map(function (r) { return r.zahlen.length; }).concat([2]));
    var px = function (i) { return L + (i / (n - 1)) * (B - L - R2); };
    var py = function (v) { return (H - U) - ((v - minSkaliert) / panneSkaliert) * (H - U - O); };

    var innen = '', legende = '';
    var bahnen = gueltig.map(function (r) {
      return r.zahlen.map(function (v, i) { return px(i).toFixed(1) + ',' + py(v).toFixed(1); });
    });
    if (bahnen.length >= 2) {
      var flaeche = bahnen[0].join(' ') + ' ' + bahnen[1].slice().reverse().join(' ');
      innen += '<polygon points="' + flaeche + '" style="fill:' + PALETTE[2] + ';opacity:0.35"/>';
    }
    gueltig.forEach(function (r, i) {
      var farbe = PALETTE[i % PALETTE.length];
      innen += '<polyline points="' + bahnen[i].join(' ') + '" style="fill:none;stroke:' +
        farbe + ';stroke-width:3"/>';
      legende += '<rect x="' + (L + i * 240) + '" y="' + (H - 28) + '" width="13" height="13" style="fill:' +
        farbe + '"/>' +
        '<text x="' + (L + i * 240 + 19) + '" y="' + (H - 17) + '" style="fill:' + TEXT +
        ';font:400 15px ' + SCHRIFT + '">' + esc(r.name) + '</text>';
    });
    var achse = '<line x1="' + L + '" y1="' + (H - U) + '" x2="' + (B - R2) + '" y2="' + (H - U) +
      '" style="stroke:' + GRAU + ';stroke-width:1"/>';
    return rahmen(B, H, a.titel, innen + achse + legende, opts && opts.mitTitel);
  }

  function zeitachse(a, opts) {
    var schritte = zeilenListe(a.felder.schritte);
    if (schritte.length === 0) throw new Error('zeitachse: keine Schritte vorhanden');
    var B = 900, H = 220, y = 130, L = 60, R2 = 60;
    var n = Math.max(schritte.length, 2);
    var innen = '<line x1="' + L + '" y1="' + y + '" x2="' + (B - R2) + '" y2="' + y +
      '" style="stroke:' + GRAU + ';stroke-width:2"/>';
    schritte.forEach(function (s, i) {
      var x = L + (i / (n - 1)) * (B - L - R2);
      innen += '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="11" style="fill:' +
        PALETTE[i % PALETTE.length] + '"/>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y - 26) + '" text-anchor="middle" style="fill:' +
        TEXT + ';font:400 15px ' + SCHRIFT + '">' + esc(s) + '</text>';
    });
    return rahmen(B, H, a.titel, innen, opts && opts.mitTitel);
  }

  function payoff(a, opts) {
    var punkte = zeilenListe(a.felder.punkte).map(function (p) {
      var teile = p.split(',');
      if (teile.length < 2) throw new Error('Punkt hat kein Komma: ' + p);
      var x = parseFloat(teile[0].trim());
      var y = parseFloat(teile[1].trim());
      if (isNaN(x)) throw new Error('Nicht-numerischer Wert: ' + teile[0].trim());
      if (isNaN(y)) throw new Error('Nicht-numerischer Wert: ' + teile[1].trim());
      return { x: x, y: y };
    });
    if (punkte.length === 0) throw new Error('payoff: keine Punkte vorhanden');
    var B = 900, H = 300, L = 60, R2 = 40, O = 70, U = 50;
    var xs = punkte.map(function (p) { return p.x; }), ys = punkte.map(function (p) { return p.y; });
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    var ySpanne = (yMax - yMin) || 1;
    var yLuft = ySpanne * 0.05;
    var yMinSkaliert = yMin - yLuft;
    var yMaxSkaliert = yMax + yLuft;
    var ySpanneSkaliert = (yMaxSkaliert - yMinSkaliert) || 1;
    var px = function (v) { return L + ((v - xMin) / ((xMax - xMin) || 1)) * (B - L - R2); };
    var py = function (v) { return (H - U) - ((v - yMinSkaliert) / ySpanneSkaliert) * (H - U - O); };
    var bahn = punkte.map(function (p) { return px(p.x).toFixed(1) + ',' + py(p.y).toFixed(1); }).join(' ');
    var null0 = '<line x1="' + L + '" y1="' + py(0).toFixed(1) + '" x2="' + (B - R2) + '" y2="' +
      py(0).toFixed(1) + '" style="stroke:' + GRAU + ';stroke-width:1;stroke-dasharray:5 4"/>';
    var kurve = '<polyline points="' + bahn + '" style="fill:none;stroke:' + AKZENT +
      ';stroke-width:3"/>';
    return rahmen(B, H, a.titel, null0 + kurve, opts && opts.mitTitel);
  }

  var ZEICHNER = {
    'kompositions-leiste': kompositionsLeiste,
    'waage': waage,
    'schema': schema,
    'drift': drift,
    'zeitachse': zeitachse,
    'payoff': payoff
  };

  function svg(abbildung, opts) {
    var typ = S().diagrammTyp(abbildung.typ);
    if (!typ) throw new Error('Unbekannter Diagrammtyp: ' + abbildung.typ);
    if (typ.alsTabelle) throw new Error('Typ "' + abbildung.typ + '" wird als Tabelle gesetzt, nicht gezeichnet');
    var zeichner = ZEICHNER[abbildung.typ];
    if (!zeichner) throw new Error('Kein Zeichner fuer Typ: ' + abbildung.typ);
    return zeichner(abbildung, opts);
  }

  /* Browser-only: SVG -> PNG ueber Image()+Canvas, Faktor 2 (scharf auch bei
     Zoom/Retina). Kein Node-Pfad — wirft dort eine klare Fehlermeldung statt
     eines ReferenceError auf `document`/`Image`/`URL`. */
  function png(svgText, breite, hoehe) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function' ||
        typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
        reject(new Error('diagrammZeichnen.png() braucht einen Browser (document/Image/Canvas) — in Node nicht verfuegbar.'));
        return;
      }
      var faktor = 2;
      var canvas = document.createElement('canvas');
      canvas.width = breite * faktor;
      canvas.height = hoehe * faktor;
      var ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('diagrammZeichnen.png(): 2D-Canvas-Kontext nicht verfuegbar.'));
        return;
      }
      var blob = new Blob([svgText], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var bild = new Image();
      bild.onload = function () {
        ctx.scale(faktor, faktor);
        ctx.drawImage(bild, 0, 0, breite, hoehe);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (pngBlob) {
          if (!pngBlob) { reject(new Error('diagrammZeichnen.png(): canvas.toBlob() lieferte kein Ergebnis.')); return; }
          pngBlob.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); }, reject);
        }, 'image/png');
      };
      bild.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('diagrammZeichnen.png(): SVG liess sich nicht als Bild laden.'));
      };
      bild.src = url;
    });
  }

  var diagrammZeichnen = { svg: svg, png: png, wertePaare: wertePaare, zeilenListe: zeilenListe, ZEICHNER: ZEICHNER };

  root.diagrammZeichnen = diagrammZeichnen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { diagrammZeichnen: diagrammZeichnen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
