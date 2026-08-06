/* Die kanonische Grammatik der Interaktions-Contracts (Schritt 5, Etappe 5) —
   mechanische UMD-Portierung von
   IT_Architektur_bbz/output/tools/didaktik-schema.cjs. Parity-Waechter im
   Tools-Baum haelt beide Fassungen im Gleichlauf — Aenderungen IMMER in
   beiden Baeumen (s. dort test/app-parity.test.js). Reine Daten, keine IO.

   Ein Interaktions-Contract beschreibt EIN interaktives Element eines
   Kapitels: welcher Typ (Regler, Rechner, ...), welche didaktische Absicht
   (kernaussage/zielhandlung/denkfehler/stuetztext, IMMER Pflicht) und
   welche typspezifischen Modell-Angaben (steuert/beobachtet/aha/
   vorhersage/konsequenz — bei jedem Typ AUSSER fliesstext Pflicht; bei
   fliesstext stattdessen begruendung). */
(function (root) {
  'use strict';

  /* Geschlossener Katalog der Interaktionstypen. Erweiterung =
     Schema-Aenderung, nicht nur ein neuer Wert in einer Konfigurationsdatei. */
  var PALETTE = [
    'regler', 'rechner', 'zuordnung', 'finde-den-fehler', 'umschalt-diagramm',
    'zerlegen', 'szenario', 'illustration', 'fliesstext'
  ];
  function istTyp(t) { return PALETTE.indexOf(t) >= 0; }

  /* Pflichtfelder, die JEDER Contract traegt, unabhaengig vom Typ. */
  var PFLICHT = ['kernaussage', 'zielhandlung', 'denkfehler', 'stuetztext'];

  /* Modell-Pflichtfelder — bei jedem Typ AUSSER fliesstext Pflicht (ein
     Fliesstext-Contract hat kein interaktives Modell, das gesteuert/
     beobachtet wird; dort ist stattdessen begruendung Pflicht, s.
     pflichtfelder()). */
  var PFLICHT_MODELL = ['steuert', 'beobachtet', 'aha', 'vorhersage', 'konsequenz'];

  /* PFLICHT immer; dazu PFLICHT_MODELL fuer jeden Typ ausser fliesstext; bei
     fliesstext stattdessen zusaetzlich begruendung. Ein unbekannter Typ
     liefert PFLICHT allein — die Typ-Pruefung selbst meldet den unbekannten
     Typ separat (didaktik-lesen.js), diese Funktion raet nie, was ein
     unbekannter Typ zusaetzlich verlangen wuerde. */
  function pflichtfelder(typ) {
    if (typ === 'fliesstext') return PFLICHT.concat(['begruendung']);
    if (istTyp(typ)) return PFLICHT.concat(PFLICHT_MODELL);
    return PFLICHT.slice();
  }

  var didaktikSchema = {
    PALETTE: PALETTE, PFLICHT: PFLICHT, PFLICHT_MODELL: PFLICHT_MODELL,
    istTyp: istTyp, pflichtfelder: pflichtfelder
  };

  root.didaktikSchema = didaktikSchema;
  if (typeof module !== 'undefined' && module.exports) module.exports = { didaktikSchema: didaktikSchema };
})(typeof globalThis !== 'undefined' ? globalThis : this);
