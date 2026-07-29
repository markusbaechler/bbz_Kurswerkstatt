/* Das Kursdossier — die eine maschinenlesbare Wahrheit je Kurs (Meta-Architektur-Spec
   2026-07-29, §3). Geschrieben wird es nur ueber das Formular der App plus definierte
   Uebernahmen (Gate-Klick); keine KI schreibt je direkt hinein. Alles Lesbare
   (Briefing-Prompt, Projekt-Instruktionen) ist generierte Ansicht dieses Datensatzes.
   Reine Funktionen, ohne Netz und ohne Date — deshalb testbar. */
(function (root) {
  'use strict';

  var dossier = {
    SCHEMA: 1,
    STATUS: ['entwurf', 'validiert', 'final'],
    MODI: ['quellengestuetzt', 'quellenfrei'],

    DATEI: function (kursId) { return kursId + '_dossier.json'; },

    neu: function (kursId) {
      return {
        dossier: dossier.SCHEMA,
        kurs: String(kursId || ''),
        stand: null,
        scope: {},
        content_modus: 'quellengestuetzt',
        quellen: [],
        status: {},
        offen: [],
        entschieden: []
      };
    },

    /* Formularwerte nach scope uebernehmen. Alles ausser scope bleibt unangetastet —
       das Formular ist nicht die einzige Schreibstelle, aber jede Schreibstelle
       schreibt nur ihren Teil. stand kommt als Parameter (kein Date hier drin). */
    ausWerten: function (kursId, werte, alt, stand) {
      var d = alt ? JSON.parse(JSON.stringify(alt)) : dossier.neu(kursId);
      d.kurs = String(kursId || d.kurs);
      d.scope = {};
      Object.keys(werte || {}).forEach(function (k) {
        var v = String(werte[k] == null ? '' : werte[k]).trim();
        if (v) d.scope[k] = v;
      });
      if (stand) d.stand = stand;
      return d;
    },

    text: function (d) { return JSON.stringify(d, null, 2) + '\n'; },

    /* Unbrauchbares wird abgewiesen, nie still repariert — ein kaputtes Dossier
       still zu ersetzen hiesse, Quellen und Status zu verlieren. */
    lesen: function (text) {
      if (!text) return null;
      var d;
      try { d = JSON.parse(text); } catch (e) { return null; }
      return dossier.pruefe(d).length ? null : d;
    },

    pruefe: function (d) {
      var p = [];
      if (!d || typeof d !== 'object') return ['kein Objekt'];
      if (d.dossier !== dossier.SCHEMA) p.push('unbekannte Schema-Version: ' + d.dossier);
      if (!d.kurs) p.push('kurs fehlt');
      if (!d.scope || typeof d.scope !== 'object') p.push('scope fehlt');
      if (dossier.MODI.indexOf(d.content_modus) < 0) p.push('content_modus unbekannt: ' + d.content_modus);
      if (!Array.isArray(d.quellen)) p.push('quellen ist keine Liste');
      else d.quellen.forEach(function (q, n) {
        ['id', 'titel', 'stand', 'datei'].forEach(function (f) {
          if (!q || !String(q[f] || '').trim()) p.push('Quelle ' + (n + 1) + ': ' + f + ' fehlt');
        });
      });
      if (!d.status || typeof d.status !== 'object') p.push('status fehlt');
      else Object.keys(d.status).forEach(function (k) {
        if (dossier.STATUS.indexOf(d.status[k]) < 0) p.push('status.' + k + ': unbekannter Wert ' + d.status[k]);
      });
      if (!Array.isArray(d.offen)) p.push('offen ist keine Liste');
      if (!Array.isArray(d.entschieden)) p.push('entschieden ist keine Liste');
      return p;
    },

    /* Status ist ein Datum, nie ein Satz im Dokument (Spec §3). */
    statusVon: function (d, lieferobjekt) {
      return (d && d.status && d.status[lieferobjekt]) || 'entwurf';
    },

    statusSetzen: function (d, lieferobjekt, status) {
      if (dossier.STATUS.indexOf(status) < 0) throw new Error('unbekannter Status: ' + status);
      d.status[lieferobjekt] = status;
      return d;
    },

    /* Der Banner fuer generierte Ansichten. null heisst: nichts anzeigen. */
    banner: function (status) {
      if (status === 'final') return null;
      if (status === 'validiert') return '[VALIDIERT — Freigabe steht aus]';
      return '[ENTWURF — unvalidiert]';
    }
  };

  root.dossier = dossier;
  if (typeof module !== 'undefined' && module.exports) module.exports = { dossier: dossier };
})(typeof globalThis !== 'undefined' ? globalThis : this);
