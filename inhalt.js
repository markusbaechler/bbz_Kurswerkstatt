/* Laedt die Inhalte aus der SharePoint-Bibliothek Kursproduktion/_zentral.
   Weg B: nichts davon liegt im oeffentlichen Repo — Masterprompts, Regelwerk und
   Prozessbeschreibung kommen erst nach der Anmeldung.
   Die Pruefungen sind rein und ohne Netz, deshalb testbar. */
(function (root) {
  'use strict';

  /* Sonderzeichen fuer den Einsatz in einem regulaeren Ausdruck entschaerfen. */
  function reEsc(x) {
    return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  var DATEIEN = ['ablage-kontrakt', 'schritte', 'werkzeuge', 'referenz', 'hf'];
  var PFLICHT = ['ablage-kontrakt', 'schritte', 'werkzeuge', 'referenz'];  /* hf darf fehlen */

  var inhalt = {
    dateien: DATEIEN,

    /* --- Pruefung: liefert eine Liste von Beanstandungen, leer = in Ordnung --- */
    pruefe: function (i) {
      var p = [];
      if (!i) return ['keine Inhalte geladen'];

      var s = i.schritte;
      if (!s || !Array.isArray(s.schritte)) p.push('schritte.json: kein Schritt-Array');
      else {
        if (s.schritte.length !== 9) p.push('schritte.json: ' + s.schritte.length + ' statt 9 Schritte');
        s.schritte.forEach(function (x) {
          ['nm', 'zweck', 'lief'].forEach(function (f) {
            if (!x[f]) p.push('Schritt ' + x.id + ': ' + f + ' fehlt');
          });
          if (!Array.isArray(x.taet) || !x.taet.length) p.push('Schritt ' + x.id + ': keine Taetigkeiten');
          if (x.prim || x.ber) p.push('Schritt ' + x.id + ': HF gehoert nicht in schritte.json');
        });
        if (!Array.isArray(s.phasen) || !s.phasen.length) p.push('schritte.json: keine Phasen');
      }

      var w = i.werkzeuge;
      if (!w || !Array.isArray(w.liste)) p.push('werkzeuge.json: keine Liste');
      else {
        var ids = w.liste.map(function (t) { return t.id; });
        if (new Set(ids).size !== ids.length) p.push('werkzeuge.json: doppelte IDs');
        Object.keys(w.schrittWerkzeuge || {}).forEach(function (k) {
          w.schrittWerkzeuge[k].forEach(function (id) {
            if (ids.indexOf(id) < 0) p.push('Schritt ' + k + ' verweist auf unbekanntes Werkzeug ' + id);
          });
        });
      }

      var r = i.referenz;
      if (!r) p.push('referenz.json fehlt');
      else ['didaktik', 'promptcraft', 'governance'].forEach(function (k) {
        if (!r[k] || !Array.isArray(r[k].abschnitte) || !r[k].abschnitte.length) {
          p.push('referenz.json: ' + k + ' fehlt oder ist leer');
          return;
        }
        r[k].abschnitte.forEach(function (a, n) {
          var v = inhalt.verschachtelung(a.html);
          if (v.ende !== 0 || v.tiefste < 0) {
            p.push('referenz.json: ' + k + ' Abschnitt ' + (n + 1) + ' hat unsaubere div-Verschachtelung');
          }
        });
      });

      var k = i['ablage-kontrakt'];
      if (!k || !k.schritte) p.push('ablage-kontrakt.json: keine Schritt-Zuordnung');

      return p;
    },

    /* Ein Referenzabschnitt wird als Bruchstueck in eine Spalte gehaengt. Faellt die
       Tiefe dabei unter null, schliesst er einen fremden Behaelter und reisst das
       Layout auf — genau so ist beim Uebernehmen aus v0.2 die Seitenspalte
       herausgefallen. Ende !== 0 heisst: er laesst etwas offen. */
    verschachtelung: function (html) {
      var re = /<(\/?)div\b[^>]*>/gi, m, d = 0, min = 0;
      while ((m = re.exec(String(html || '')))) {
        d += m[1] ? -1 : 1;
        if (d < min) min = d;
      }
      return { ende: d, tiefste: min };
    },

    /* --- Zugriffshelfer --- */
    schritt: function (i, id) {
      var l = (i.schritte && i.schritte.schritte) || [];
      for (var n = 0; n < l.length; n++) if (String(l[n].id) === String(id)) return l[n];
      return null;
    },

    werkzeug: function (i, id) {
      var l = (i.werkzeuge && i.werkzeuge.liste) || [];
      for (var n = 0; n < l.length; n++) if (l[n].id === id) return l[n];
      return null;
    },

    werkzeugeVon: function (i, schrittId) {
      var ids = ((i.werkzeuge && i.werkzeuge.schrittWerkzeuge) || {})[String(schrittId)] || [];
      return ids.map(function (x) { return inhalt.werkzeug(i, x); }).filter(Boolean);
    },

    anleitungVon: function (i, schrittId) {
      return inhalt.werkzeugeVon(i, schrittId).filter(function (t) { return t.type === 'guide'; })[0] || null;
    },

    /* Werkzeuge ohne die Anleitung — die wird separat und ausgeklappt gezeigt. */
    hilfsmittelVon: function (i, schrittId) {
      return inhalt.werkzeugeVon(i, schrittId).filter(function (t) { return t.type !== 'guide'; });
    },

    phaseVon: function (i, schrittId) {
      var ph = (i.schritte && i.schritte.phasen) || [];
      for (var n = 0; n < ph.length; n++) {
        if (ph[n].ids.indexOf(String(schrittId)) >= 0) return ph[n];
      }
      return null;
    },

    /* Wohin gehoert das Lieferobjekt dieses Schritts, nach Ablage-Kontrakt. */
    ablageVon: function (i, schrittId, kursId) {
      var k = i['ablage-kontrakt'];
      var e = k && k.schritte && k.schritte[String(schrittId)];
      if (!e) return null;
      var datei = e.datei
        ? e.datei.replace('{K}', kursId)
        : (kursId + '_' + e.lieferobjekt + '_v{N}.' + e.ext);
      return { ordner: e.ordner, datei: datei, format: e.format, gate: e.gate || null,
               wege: e.wege || [] };
    },

    /* --- Ablegen: welche Version, welcher Name --- */

    /* Höchste vorhandene Nummer + 1. Lücken werden nicht gefüllt, _final zählt nicht mit.
       Die Endung ist bewusst NICHT Teil des Musters: die Version zählt das Lieferobjekt,
       nicht das Dateiformat. Sonst stünde neben einem migrierten _v1.html ein neues
       _v1.md — zweimal Version 1 für dasselbe Lieferobjekt. */
    naechsteVersion: function (dateien, kursId, lieferobjekt) {
      if (!Array.isArray(dateien)) return 1;
      var muster = new RegExp('^' + reEsc(kursId) + '_' + reEsc(lieferobjekt) +
                              '_v(\\d+)\\.[a-z0-9]+$', 'i');
      var max = 0;
      dateien.forEach(function (d) {
        var m = muster.exec(d.name || '');
        if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
      });
      return max + 1;
    },

    /* Wohin die nächste Fassung kommt — null, wenn der Schritt keine Versionen führt. */
    naechsteDatei: function (i, schrittId, kursId, dateien) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e || !e.lieferobjekt || !e.ext) return null;
      var v = inhalt.naechsteVersion(dateien, kursId, e.lieferobjekt);
      return {
        ordner: e.ordner,
        datei: kursId + '_' + e.lieferobjekt + '_v' + v + '.' + e.ext,
        version: v,
        format: e.format
      };
    },

    /* Der Weg Chat ist nur dort vorgesehen, wo der Kontrakt ihn nennt. */
    darfAblegen: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e || !Array.isArray(e.wege)) return false;
      return e.wege.indexOf('chat') >= 0 && !!e.lieferobjekt;
    },

    /* --- Netz --- */
    laden: function (graph) {
      return graph.zentralLaden(DATEIEN).then(function (geladen) {
        var fehlend = PFLICHT.filter(function (n) { return !geladen[n]; });
        if (fehlend.length) {
          throw new Error('In Kursproduktion/_zentral fehlen: ' + fehlend.join(', ') + '.json');
        }
        var p = inhalt.pruefe(geladen);
        if (p.length) throw new Error('Inhalte unvollstaendig — ' + p.slice(0, 3).join(' · '));
        return geladen;
      });
    }
  };

  root.inhalt = inhalt;
  if (typeof module !== 'undefined' && module.exports) module.exports = { inhalt: inhalt };
})(typeof globalThis !== 'undefined' ? globalThis : this);
