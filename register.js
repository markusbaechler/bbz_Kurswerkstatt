/* Das zentrale Register — eine maschinenlesbare Zeile je Kapitel/Eingangs-
   kompetenz, ueber ALLE Kurse hinweg, als Nebenprodukt der Schritt-4-
   Validierung gespeist (Meta-Architektur, Etappe 4, Task V7). Liegt als
   `_zentral/register.json` in SharePoint — EINE Datei, kursuebergreifend,
   anders als das Kursdossier (eine Datei je Kurs). Reine Funktionen, ohne
   Netz und ohne Date — deshalb testbar wie dossier.js. Kein UI (Design
   §7.7): reiner Datenbestand fuer eine spaetere Impact-Analyse. */
(function (root) {
  'use strict';

  /* Dieselbe Wortgrenzen-Regel wie inhalt.js (quellenSpiegel/blocksPruefe) und
     ansichten.js (reviewQIds) — bewusst eine EIGENE, kleine Kopie statt eines
     Exports, wie schon bei reviewQIds begruendet (Etappe 4, Task V5): register.js
     ist wie dossier.js eine reine Funktionsbibliothek ohne Abhaengigkeit zu
     inhalt.js, eine vierte Kopie derselben zwei Zeilen ist kein Drift-Risiko,
     das einen Export rechtfertigt. */
  var Q_ID = /\bQ-\d{3}\b/g;
  function qIds(text) {
    var m = String(text || '').match(Q_ID);
    return m || [];
  }

  function uniq(liste) {
    var gesehen = {};
    var out = [];
    liste.forEach(function (x) {
      if (!gesehen[x]) { gesehen[x] = true; out.push(x); }
    });
    return out;
  }

  var register = {
    SCHEMA: 1,

    /* Anders als dossier.DATEI(kursId) ist das Register EINE Datei fuer alle
       Kurse — kein Funktionsaufruf mit Parameter noetig. */
    DATEI: 'register.json',

    neu: function () {
      return { schema: register.SCHEMA, zeilen: [] };
    },

    /* Q-IDs je Eingangskompetenz (EK): ###ZUORDNUNG-Zeilen ("Kapitel N | EK |
       Text") werden per Substring auf die EK gematcht — kein starres Format
       vorausgesetzt, dieselbe Konvention wie bei OFFEN/ZUORDNUNG sonst ueblich
       (V2 Regel 3, CLAUDE.md). Aus jeder treffenden Zeile werden Q-IDs
       extrahiert. Kein Treffer (weder eine passende Zeile noch darin eine
       Q-ID — der Regelfall in der heutigen Blockgrammatik, ###ZUORDNUNG traegt
       bisher nur einen freien "wie Contract"-Text, keine Q-IDs): Rueckfall auf
       die dokumentweite Leseliste (gelesen.quellen.gelesen) — besser eine zu
       grosse Liste (alle gelesenen Quellen des Skripts) als eine leere, die
       Impact-Analyse soll keine Quelle unter den Tisch fallen lassen. */
    qIdsFuerEk: function (gelesen, ek) {
      var zuordnung = (gelesen && gelesen.zuordnung) || [];
      var treffer = [];
      zuordnung.forEach(function (zeile) {
        if (ek && String(zeile || '').indexOf(ek) >= 0) {
          treffer.push.apply(treffer, qIds(zeile));
        }
      });
      treffer = uniq(treffer);
      if (treffer.length) return treffer;
      var gelesenListe = (gelesen && gelesen.quellen && gelesen.quellen.gelesen) || [];
      var fallback = [];
      gelesenListe.forEach(function (zeile) { fallback.push.apply(fallback, qIds(zeile)); });
      return uniq(fallback);
    },

    /* Eine Zeile je Kapitel der validierten Fassung — Kurs-ID, EK, Titel,
       Quellen (mit Stand aus dem Dossier), Rechtsstand, Herkunft/Beleg (aus
       kapitel.validierung, V1) und der uebergebene Status. verbaut_in bleibt
       IMMER null — das Feld ist fuer eine spaetere Etappe (welches
       Lieferobjekt eines FOLGENDEN Kurses diese Zeile tatsaechlich verbaut),
       diese Task fuellt es nie. */
    zeilenAus: function (gelesen, d, kurs, status) {
      var kapitel = (gelesen && gelesen.kapitel) || [];
      var quellen = (d && d.quellen) || [];
      var rechtsstand = (d && d.regulatorik && d.regulatorik.stand) || null;
      var kursId = String(kurs || '');
      return kapitel.map(function (k) {
        var ids = register.qIdsFuerEk(gelesen, k.ek);
        var qz = ids.map(function (id) {
          var treffer = quellen.filter(function (q) { return q && q.id === id; })[0];
          return { id: id, stand: (treffer && treffer.stand) || null };
        });
        var val = k.validierung || null;
        return {
          kurs: kursId,
          ek: k.ek,
          titel: k.titel || '',
          quellen: qz,
          rechtsstand: rechtsstand,
          herkunft: (val && val.herkunft) || null,
          beleg: (val && val.beleg) || null,
          status: status,
          verbaut_in: null
        };
      });
    },

    /* Fuegt zeilen in bestand ein — ersetzt ALLE Zeilen desselben Kurses,
       deren EK in zeilen vorkommt, laesst jede andere Zeile UNBERUEHRT
       (fremde Kurse, fremde EKs desselben Kurses). Kein Mutieren von
       bestand/zeilen selbst — ein neues Objekt kommt heraus, unveraenderte
       Alteintraege bleiben als dieselben Objekte erhalten (Referenzgleichheit
       ok, kein Deep-Clone noetig). Stabil sortiert nach (kurs, dann ek) —
       Array.prototype.sort ist seit ES2019 stabil, kein zusaetzlicher
       Tie-Breaker noetig. */
    einpflegen: function (bestand, zeilen) {
      var basis = bestand && Array.isArray(bestand.zeilen) ? bestand : register.neu();
      var neu = zeilen || [];
      var schluessel = {};
      neu.forEach(function (z) { schluessel[z.kurs + '|' + z.ek] = true; });
      var behalten = basis.zeilen.filter(function (z) {
        return !schluessel[z.kurs + '|' + z.ek];
      });
      var alle = behalten.concat(neu);
      alle.sort(function (a, b) {
        if (a.kurs !== b.kurs) return a.kurs < b.kurs ? -1 : 1;
        if (a.ek !== b.ek) return a.ek < b.ek ? -1 : 1;
        return 0;
      });
      return { schema: register.SCHEMA, zeilen: alle };
    },

    text: function (b) { return JSON.stringify(b, null, 2) + '\n'; },

    /* Unbrauchbares wird abgewiesen, nie still repariert (Muster dossier.pruefe) —
       nur schema/zeilen als Liste sind Pflicht, die einzelne Zeile wird nur auf
       kurs/ek/quellen (Liste) geprueft, nicht auf jedes Feld einzeln. */
    pruefe: function (d) {
      var p = [];
      if (!d || typeof d !== 'object') return ['kein Objekt'];
      if (d.schema !== register.SCHEMA) p.push('unbekannte Schema-Version: ' + d.schema);
      if (!Array.isArray(d.zeilen)) p.push('zeilen ist keine Liste');
      else d.zeilen.forEach(function (z, i) {
        if (!z || !String(z.kurs || '').trim()) p.push('Zeile ' + (i + 1) + ': kurs fehlt');
        if (!z || !String(z.ek || '').trim()) p.push('Zeile ' + (i + 1) + ': ek fehlt');
        if (!z || !Array.isArray(z.quellen)) p.push('Zeile ' + (i + 1) + ': quellen ist keine Liste');
      });
      return p;
    },

    /* Toleriert eine fehlende Datei (text ist null/leer/undefined) als
       Erstanlage — anders als dossier.lesen(), das dafuer null liefert
       (dort bedeutet null "Dossier noch nicht angelegt", vom Aufrufer
       unterschieden ueber inhalt.dossierNachladen). Fuer das Register gibt es
       keinen solchen Unterschied noetig: eine fehlende Datei UND ein frisch
       leerer Bestand sind fuer jeden Schreiber dasselbe, ein Erstanlage-Objekt.
       Kaputtes JSON oder ein falsches Schema bleibt echt null — der Aufrufer
       (controller._registerBasis) behandelt das als Lesefehler, nicht als
       Erstanlage, und schreibt nie blind darueber. */
    lesen: function (text) {
      if (!text) return register.neu();
      var d;
      try { d = JSON.parse(text); } catch (e) { return null; }
      return register.pruefe(d).length ? null : d;
    }
  };

  root.register = register;
  if (typeof module !== 'undefined' && module.exports) module.exports = { register: register };
})(typeof globalThis !== 'undefined' ? globalThis : this);
