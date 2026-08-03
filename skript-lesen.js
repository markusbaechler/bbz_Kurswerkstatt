/* Parst die ###-Bloecke eines Selbstlernskripts und prueft sie gegen das
   kanonische Schema — mechanische UMD-Portierung von
   IT_Architektur_bbz/output/tools/skript-lesen.cjs (Etappe 3b, Task B2).
   Parity-Waechter im Tools-Baum haelt beide Fassungen im Gleichlauf —
   Aenderungen IMMER in beiden Baeumen (s. dort test/app-parity.test.js).
   Kein IO, keine Abhaengigkeit ausser dem Schema. */
(function (root) {
  'use strict';

  /* Lazy-Accessor (Muster Z() in xlsx-lesen.js): root.skriptSchema ist
     gesetzt, sobald skript-schema.js vorher geladen/ge-required wurde — im
     Browser per Script-Tag-Reihenfolge (index.html), in Node per
     require-Kopf im Test. */
  function S() {
    if (root.skriptSchema) return root.skriptSchema;
    if (typeof module !== 'undefined' && module.exports) return require('./skript-schema.js').skriptSchema;
    throw new Error('skript-schema.js nicht geladen');
  }

  /* "nr=1 | ek=VL-001-EK-003 | titel=Was ein Produkt kostet" */
  function attribute(zeile) {
    var a = {};
    var stuecke = (zeile || '').split('|');
    for (var i = 0; i < stuecke.length; i++) {
      var stueck = stuecke[i];
      var g = stueck.indexOf('=');
      if (g < 0) continue;
      a[stueck.slice(0, g).trim()] = stueck.slice(g + 1).trim();
    }
    return a;
  }

  /* Zerlegt den Text in { name, attr, zeilen } - eine Zeile mit ### oeffnet
     den naechsten Block, alles bis dahin gehoert zum vorigen. */
  function zerlege(text) {
    var roh = [];
    var aktuell = null;
    var zeilenRoh = text.split('\n');
    for (var i = 0; i < zeilenRoh.length; i++) {
      var zeile = zeilenRoh[i].replace(/\r$/, '');
      var kopf = zeile.match(/^###([A-Z-]+)[ \t]*(.*)$/);
      if (kopf) {
        aktuell = { name: kopf[1], attr: attribute(kopf[2]), zeilen: [] };
        roh.push(aktuell);
      } else if (aktuell) {
        aktuell.zeilen.push(zeile);
      }
    }
    return roh;
  }

  function text(bl) { return bl.zeilen.join('\n').trim(); }

  /* "werte: a | b" und "loesung: b" - Feldzeilen innerhalb eines Blocks.
     Kommt derselbe Schluessel mehrfach vor, werden die Werte mit
     Zeilenumbruch gesammelt: eine Vergleichstabelle hat mehrere
     "zeilen:"-Zeilen, und die letzte darf die vorigen nicht ueberschreiben. */
  function felder(bl) {
    var f = {};
    for (var i = 0; i < bl.zeilen.length; i++) {
      var z = bl.zeilen[i];
      var m = z.match(/^([a-zA-Z-]+):[ \t]*(.*)$/);
      if (!m) continue;
      var key = m[1].toLowerCase();
      f[key] = f[key] === undefined ? m[2].trim() : f[key] + '\n' + m[2].trim();
    }
    return f;
  }

  /* ILLUSTRATION-Feldvalidierung (B6). Der Dateiname wird spaeter
     unveraendert als Zip-/Ablagepfad benutzt (docx-bauen.js/app.js,
     Ledger-Hinweis aus B4) - die Zeichen-Erlaubnisliste sitzt deshalb HIER,
     an der einen Stelle, wo die Feldzeile entsteht: kein "/", kein "\",
     kein "..", nur [A-Za-z0-9._-]. Ist gelesen.fehler leer, ist jeder
     verbliebene datei-Wert bereits sicher. */
  var DATEI_ZEICHEN = /^[A-Za-z0-9._-]+$/;
  function dateiGueltig(name) { return DATEI_ZEICHEN.test(name) && name.indexOf('..') < 0; }
  /* Nie-Fakten-Regel maschinell (Entscheid Markus 2026-08-03, Illustrationen
     = Variante C): eine Ziffernfolge laenger als zwei Stellen in der
     Bild-Regie waere ein Zahlenwert, der ins Bild rutscht. */
  var ZIFFERNFOLGE = /\d{3,}/;

  function lies(quelltext) {
    var fehler = [];
    var roh = zerlege(quelltext);
    var ergebnis = {
      skript: { kurs: '', titel: '', rechtsstand: '', variante: '' },
      quellen: { gelesen: [], nichtGeoeffnet: [] },
      kapitel: [], zuordnung: [], offen: [], fehler: fehler
    };

    var kapitel = null;
    var skriptGesehen = false;
    /* Set statt Plain-Object (Ledger-Hinweis aus B2): ein Plain-Object
       kollidiert mit ek="constructor" (oder jedem anderen geerbten
       Prototype-Namen) - {}.constructor ist die Object-Funktion, also
       wahrheitswertig, OHNE dass sie je gesetzt wurde. Ein solches Kapitel
       waere faelschlich als "doppelt" gemeldet. Die Tools-Fassung
       (skript-lesen.cjs) nutzt bereits ein echtes Set - hier angeglichen. */
    var gesehen = new Set();

    for (var i = 0; i < roh.length; i++) {
      var bl = roh[i];
      var bekannt = S().istBaustein(bl.name) || S().SCHEMA.rahmen.indexOf(bl.name) >= 0;
      if (!bekannt) { fehler.push('Unbekannter Block: ###' + bl.name); continue; }

      if (bl.name === 'SKRIPT') {
        skriptGesehen = true;
        ergebnis.skript = {
          kurs: bl.attr.kurs || '', titel: bl.attr.titel || '',
          rechtsstand: bl.attr.rechtsstand || '',
          variante: bl.attr.variante || ''
        };
        if (!ergebnis.skript.kurs) fehler.push('###SKRIPT ohne kurs=');
        if (!ergebnis.skript.variante) {
          fehler.push('###SKRIPT ohne variante= (claude oder chatgpt)');
        } else if (!S().istVariante(ergebnis.skript.variante)) {
          fehler.push('###SKRIPT: unbekannte variante "' + ergebnis.skript.variante + '"');
        }
        continue;
      }
      if (bl.name === 'QUELLEN') {
        for (var q = 0; q < bl.zeilen.length; q++) {
          var z = bl.zeilen[q];
          var m = z.match(/^(gelesen|nicht-geoeffnet):[ \t]*(.+)$/);
          if (!m) continue;
          if (m[1] === 'gelesen') ergebnis.quellen.gelesen.push(m[2].trim());
          else ergebnis.quellen.nichtGeoeffnet.push(m[2].trim());
        }
        continue;
      }
      if (bl.name === 'KAPITEL') {
        kapitel = {
          nr: bl.attr.nr || '', ek: bl.attr.ek || '', titel: bl.attr.titel || '',
          bloom: bl.attr.bloom || '', richtzeit: bl.attr.richtzeit || '',
          teile: {}, abbildungen: []
        };
        if (!kapitel.ek) fehler.push('###KAPITEL ohne ek=');
        else if (gesehen.has(kapitel.ek)) fehler.push('Kompetenz doppelt: ' + kapitel.ek);
        else gesehen.add(kapitel.ek);
        ergebnis.kapitel.push(kapitel);
        continue;
      }
      if (bl.name === 'ENDE-KAPITEL') {
        if (kapitel) pruefeKapitel(kapitel, fehler);
        kapitel = null;
        continue;
      }
      if (bl.name === 'ZUORDNUNG') {
        ergebnis.zuordnung = bl.zeilen.filter(function (z) { return z.trim() !== ''; });
        continue;
      }
      if (bl.name === 'OFFEN') {
        ergebnis.offen = bl.zeilen.filter(function (z) { return z.trim() !== ''; });
        continue;
      }

      /* ab hier: Bausteine innerhalb eines Kapitels */
      if (!kapitel) { fehler.push('###' + bl.name + ' steht ausserhalb eines Kapitels'); continue; }
      if (bl.name === 'ABBILDUNG') {
        var typ = bl.attr.typ || '';
        if (!S().istDiagrammtyp(typ)) {
          fehler.push('Kapitel ' + kapitel.ek + ': unbekannter Diagrammtyp "' + typ + '"');
          continue;
        }
        var f = felder(bl);
        var pflichtfelder = S().pflichtfelder(typ);
        for (var p = 0; p < pflichtfelder.length; p++) {
          if (!f[pflichtfelder[p]]) fehler.push('Kapitel ' + kapitel.ek + ': Abbildung "' + typ + '" ohne Feld ' + pflichtfelder[p]);
        }
        kapitel.abbildungen.push({ typ: typ, titel: bl.attr.titel || '', felder: f });
        continue;
      }
      if (bl.name === 'ILLUSTRATION') {
        var fIllu = felder(bl);
        if (!fIllu.datei && !fIllu.katalog) {
          fehler.push('Kapitel ' + kapitel.ek + ': Illustration ohne Feld datei oder katalog');
        }
        if (fIllu.szene && ZIFFERNFOLGE.test(fIllu.szene)) {
          fehler.push('Kapitel ' + kapitel.ek + ': Illustration: Zahlen gehoeren nicht ins Bild');
        }
        if (fIllu.datei && !dateiGueltig(fIllu.datei)) {
          fehler.push('Kapitel ' + kapitel.ek + ': Illustration: datei "' + fIllu.datei +
            '" enthaelt unzulaessige Zeichen (erlaubt: A-Z a-z 0-9 . _ -, kein "..")');
        }
        /* KEIN continue - faellt in die generische Mehrfach-Pruefung/Ablage
           unten durch: ILLUSTRATION ist "einfach" (nicht mehrfach wie
           ABBILDUNG) und speichert seinen Rohtext wie DEFINITION/ERKLAERUNG
           in kapitel.teile.ILLUSTRATION - genau die Form, die docx-bauen.js
           per "datei:"-Feldzeile daraus liest. */
      }
      if (kapitel.teile[bl.name] !== undefined) {
        fehler.push('Kapitel ' + kapitel.ek + ': ###' + bl.name + ' kommt mehrfach vor');
        continue;
      }
      kapitel.teile[bl.name] = text(bl);
    }

    if (kapitel) pruefeKapitel(kapitel, fehler);

    /* Etappe 3 / Task W2 (2026-07-31): ein Text ganz ohne ###SKRIPT-Block
       lieferte bisher still kurs: '' - ein Aufrufer haette das als
       "irgendein Kurs" missverstehen koennen, statt als "keine gueltige
       Blockdatei". Ein fehlendes Attribut (kurs=, variante=) INNERHALB
       eines vorhandenen ###SKRIPT-Blocks bleibt wie bisher ein Fehler in
       fehler[], kein Wurf - nur der ganz fehlende Block wirft. */
    if (!skriptGesehen) {
      throw new Error('###SKRIPT fehlt - kurs= und variante= sind Pflicht');
    }
    return ergebnis;
  }

  /* Jeder Pflichtbaustein genau einmal, mit Inhalt. Die Abbildung zaehlt
     ueber die eigene Liste, weil sie mehrfach vorkommen darf. */
  function pruefeKapitel(k, fehler) {
    var pflichtBausteine = S().pflichtBausteine();
    for (var i = 0; i < pflichtBausteine.length; i++) {
      var name = pflichtBausteine[i];
      if (name === 'ABBILDUNG') {
        if (k.abbildungen.length === 0) fehler.push('Kapitel ' + k.ek + ': kein ###ABBILDUNG');
        continue;
      }
      if (!k.teile[name]) fehler.push('Kapitel ' + k.ek + ': ###' + name + ' fehlt oder ist leer');
    }
  }

  var skriptLesen = { lies: lies, attribute: attribute };

  root.skriptLesen = skriptLesen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { skriptLesen: skriptLesen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
