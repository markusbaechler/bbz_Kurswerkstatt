/* Parst die ###-Bloecke einer Interaktions-Contract-Datei (Schritt 5,
   Etappe 5) gegen didaktik-schema.js — mechanische UMD-Portierung von
   IT_Architektur_bbz/output/tools/didaktik-lesen.cjs. Parity-Waechter im
   Tools-Baum haelt beide Fassungen im Gleichlauf — Aenderungen IMMER in
   beiden Baeumen (s. dort test/app-parity.test.js). Kein IO, keine
   Abhaengigkeit ausser dem Schema. didaktik-lesen kennt NUR die eigene
   Grammatik: ###CONTRACTS/###CONTRACT/###ENDE-CONTRACT/###PUNKTE sind eine
   eigene, kollisionsfreie Grammatik, nie durch skript-lesen.js gelesen
   (und umgekehrt). */
(function (root) {
  'use strict';

  /* Lazy-Accessor (Muster S() in skript-lesen.js): root.didaktikSchema ist
     gesetzt, sobald didaktik-schema.js vorher geladen/ge-required wurde —
     im Browser per Script-Tag-Reihenfolge (index.html), in Node per
     require-Kopf im Test. */
  function S() {
    if (root.didaktikSchema) return root.didaktikSchema;
    if (typeof module !== 'undefined' && module.exports) return require('./didaktik-schema.js').didaktikSchema;
    throw new Error('didaktik-schema.js nicht geladen');
  }

  /* "kurs=VL-002 | basiert_auf=VL-002_content_final.blocks" — identische
     Trennlogik wie skript-lesen.js attribute(). */
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
     den naechsten Block, alles bis dahin gehoert zum vorigen. Identisch zu
     skript-lesen.js zerlege(). */
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

  /* Bekannte Feldnamen eines ###CONTRACT-Blocks — die Vereinigung aus
     PFLICHT, PFLICHT_MODELL und begruendung (bei fliesstext Pflicht, sonst
     optional). NUR diese Namen duerfen eine Folgezeile als neues Feld
     eroeffnen; jede andere Zeile (auch eine, die zufaellig wie
     "name: wert" aussieht) gilt als Fortsetzung des zuletzt eroeffneten
     Feldes. */
  function contractFeldnamen() {
    var s = S();
    var namen = {};
    var i;
    for (i = 0; i < s.PFLICHT.length; i++) namen[s.PFLICHT[i]] = true;
    for (i = 0; i < s.PFLICHT_MODELL.length; i++) namen[s.PFLICHT_MODELL[i]] = true;
    namen.begruendung = true;
    return namen;
  }

  /* Feldzeilen eines ###CONTRACT-Blocks. Mehrzeiliger Wert: eine Folgezeile,
     die NICHT mit einem bekannten Feldnamen (oder punkt:/entscheid:/
     verschieben:/begruendung: — die gehoeren zu ###PUNKTE, nicht hierher,
     aber ein Contract-Block enthaelt sie ohnehin nie) beginnt, wird mit
     EINEM Leerzeichen an das zuletzt eroeffnete Feld angehaengt, trimmt
     dabei fuehrende/nachlaufende Leerzeichen. Leerzeilen beenden kein Feld
     — sie werden uebersprungen, ohne etwas anzuhaengen. Eine Zeile VOR dem
     ersten erkannten Feld wird verworfen (Muster skript-lesen.js felder():
     eine Zeile ohne Treffer wird einfach uebersprungen). */
  function contractFelder(zeilen) {
    var bekannt = contractFeldnamen();
    var f = {};
    var letzter = null;
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i];
      if (z.trim() === '') continue;
      var m = z.match(/^([a-z]+):[ \t]*(.*)$/);
      if (m && bekannt[m[1]]) {
        f[m[1]] = m[2].trim();
        letzter = m[1];
        continue;
      }
      if (letzter) f[letzter] = f[letzter] + ' ' + z.trim();
    }
    return f;
  }

  /* ###PUNKTE: Gruppen aus punkt: gefolgt von entscheid: ODER
     verschieben:+begruendung:. Dieselbe Mehrzeilen-Regel wie bei
     contractFelder — eine Folgezeile ohne eigenen Markennamen
     (punkt:/entscheid:/verschieben:/begruendung:) haengt sich mit einem
     Leerzeichen an das zuletzt eroeffnete Feld der aktuellen Gruppe an. */
  var PUNKT_FELDER = /^(punkt|entscheid|verschieben|begruendung):[ \t]*(.*)$/;

  function liesPunkte(zeilen, fehler) {
    var gruppen = [];
    var aktuell = null;
    var letzter = null;

    function abschliessen(g) {
      if (!g.entscheid && !g.verschieben) {
        fehler.push('###PUNKTE: punkt ohne entscheid oder verschieben: "' + g.punkt + '"');
      }
      if (g.verschieben && !g.begruendung) {
        fehler.push('###PUNKTE: verschieben ohne begruendung: "' + g.punkt + '"');
      }
      gruppen.push({
        punkt: g.punkt, entscheid: g.entscheid || null,
        verschieben: g.verschieben || null, begruendung: g.begruendung || null
      });
    }

    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i];
      if (z.trim() === '') continue;
      var m = z.match(PUNKT_FELDER);
      if (m) {
        var key = m[1];
        var wert = m[2].trim();
        if (key === 'punkt') {
          if (aktuell) abschliessen(aktuell);
          aktuell = { punkt: wert, entscheid: '', verschieben: '', begruendung: '' };
          letzter = 'punkt';
          continue;
        }
        if (!aktuell) continue; // Feldzeile vor dem ersten punkt: - verworfen
        aktuell[key] = wert;
        letzter = key;
        continue;
      }
      if (aktuell && letzter) aktuell[letzter] = aktuell[letzter] + ' ' + z.trim();
    }
    if (aktuell) abschliessen(aktuell);
    return gruppen;
  }

  /* Prueft EINEN geschlossenen Contract: Typ bekannt, Pflichtfelder
     vollstaendig (die fliesstext-begruendung-Pflicht traegt einen eigenen
     Wortlaut, kein generisches "Feld X fehlt"), ek+nr nicht doppelt. */
  function pruefeContract(c, fehler, gesehen) {
    if (!S().istTyp(c.typ)) {
      fehler.push('Contract ' + c.nr + ': unbekannter typ "' + c.typ + '"');
    }
    var pflicht = S().pflichtfelder(c.typ);
    for (var i = 0; i < pflicht.length; i++) {
      var name = pflicht[i];
      if (c.typ === 'fliesstext' && name === 'begruendung') {
        if (!c.felder.begruendung) {
          fehler.push('Contract ' + c.nr + ' (' + c.ek + '): typ fliesstext verlangt begruendung');
        }
        continue;
      }
      if (!c.felder[name]) fehler.push('Contract ' + c.nr + ' (' + c.ek + '): Feld ' + name + ' fehlt');
    }
    var schluessel = c.ek + '/' + c.nr;
    if (gesehen[schluessel]) {
      fehler.push('Contract: ek+nr doppelt: ' + c.ek + '/' + c.nr);
    } else {
      gesehen[schluessel] = true;
    }
  }

  function lies(quelltext) {
    var fehler = [];
    var roh = zerlege(quelltext);
    var ergebnis = { kopf: null, contracts: [], punkte: [], fehler: fehler };

    var kopfGesehen = false;
    var offen = null; // { ek, nr, typ, felder } - der gerade geoeffnete, noch nicht geschlossene Contract
    var gesehenEkNr = {};
    var BEKANNT = { CONTRACTS: true, CONTRACT: true, 'ENDE-CONTRACT': true, PUNKTE: true };

    for (var i = 0; i < roh.length; i++) {
      var bl = roh[i];
      if (!BEKANNT[bl.name]) { fehler.push('Unbekannter Block: ###' + bl.name); continue; }

      if (bl.name === 'CONTRACTS') {
        kopfGesehen = true;
        ergebnis.kopf = { kurs: bl.attr.kurs || '', basiertAuf: bl.attr.basiert_auf || '' };
        continue;
      }
      if (bl.name === 'CONTRACT') {
        if (offen) fehler.push('###CONTRACT ohne ###ENDE-CONTRACT');
        offen = {
          ek: bl.attr.ek || '', nr: Number(bl.attr.nr), typ: bl.attr.typ || '',
          felder: contractFelder(bl.zeilen)
        };
        continue;
      }
      if (bl.name === 'ENDE-CONTRACT') {
        if (offen) {
          pruefeContract(offen, fehler, gesehenEkNr);
          ergebnis.contracts.push(offen);
          offen = null;
        }
        continue;
      }
      if (bl.name === 'PUNKTE') {
        ergebnis.punkte = liesPunkte(bl.zeilen, fehler);
        continue;
      }
    }

    if (offen) fehler.push('###CONTRACT ohne ###ENDE-CONTRACT');

    if (!kopfGesehen) {
      throw new Error('###CONTRACTS fehlt - kurs= und basiert_auf= sind Pflicht');
    }
    return ergebnis;
  }

  var didaktikLesen = { lies: lies, attribute: attribute };

  root.didaktikLesen = didaktikLesen;
  if (typeof module !== 'undefined' && module.exports) module.exports = { didaktikLesen: didaktikLesen };
})(typeof globalThis !== 'undefined' ? globalThis : this);
