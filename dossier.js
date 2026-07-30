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
        ['id', 'titel', 'stand'].forEach(function (f) {
          if (!q || !String(q[f] || '').trim()) p.push('Quelle ' + (n + 1) + ': ' + f + ' fehlt');
        });
        var hatDatei = !!(q && String(q.datei || '').trim());
        var hatUrl = !!(q && String(q.url || '').trim());
        if (hatDatei === hatUrl) {
          p.push('Quelle ' + (n + 1) + ': entweder datei oder url');
        } else if (hatUrl && !String((q || {}).abgerufen || '').trim()) {
          p.push('Quelle ' + (n + 1) + ': abgerufen fehlt');
        }
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
    },

    naechsteQuellenId: function (d) {
      var max = 0;
      ((d && d.quellen) || []).forEach(function (q) {
        var m = /^Q-(\d+)$/.exec(q.id || '');
        if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
      });
      return 'Q-' + ('00' + (max + 1)).slice(-3);
    },

    /* Datei ablegen + Dossier-Eintrag ist EIN Vorgang (Spec §5.6) — dieser Helfer
       ist die Dossier-Haelfte davon und weist Unvollstaendiges ab, bevor etwas
       hochgeladen wird. Eine Quelle ist Datei ODER Link (Entscheid Markus,
       2026-07-30): Links tragen statt datei ein url-Feld plus das Abrufdatum
       (abgerufen kommt fertig herein — kein Date in dossier.js), eine Kopie ist
       keine Pflicht. */
    quelleNeu: function (d, q) {
      q = q || {};
      var hatDatei = !!String(q.datei || '').trim();
      var hatUrl = !!String(q.url || '').trim();
      if (hatDatei && hatUrl) throw new Error('Quelle: entweder Datei oder Link, nicht beides');
      if (!hatDatei && !hatUrl) throw new Error('Quelle: Datei oder Link angeben');
      var fehlt = ['titel', 'stand'].filter(function (f) {
        return !String(q[f] || '').trim();
      });
      if (fehlt.length) throw new Error('Quelle unvollständig: ' + fehlt.join(', ') + ' fehlt');
      var e = {
        id: dossier.naechsteQuellenId(d),
        titel: String(q.titel).trim(),
        herausgeber: String(q.herausgeber || '').trim(),
        stand: String(q.stand).trim()
      };
      if (hatUrl) {
        var url = String(q.url).trim();
        if (!/^https?:\/\//.test(url)) throw new Error('Link muss mit http:// oder https:// beginnen');
        e.url = url;
        e.abgerufen = String(q.abgerufen || '').trim();
      } else {
        e.datei = String(q.datei).trim();
      }
      d.quellen.push(e);
      return e;
    },

    /* Die Positivliste: genau diese Dateien liest der Auftrag, keine andere.
       Link-Quellen tragen kein datei-Feld und bleiben aussen vor — Auftraege
       behandeln Links separat (direkt aufrufen, nicht als Ablage lesen). */
    positivliste: function (d) {
      return ((d && d.quellen) || []).map(function (q) { return q.datei; }).filter(Boolean);
    },

    /* Der Mensch tippt keinen Dateinamen — die Bereinigung uebernimmt die App.
       Unterstriche, Umlaute und Leerzeichen haben Dateien schon unsichtbar gemacht. */
    quellenDateiname: function (original) {
      var m = /^(.*?)(\.[a-z0-9]+)?$/i.exec(String(original || '').trim());
      var um = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      var basis = (m[1] || 'quelle').toLowerCase()
        .replace(/[äöüß]/g, function (c) { return um[c]; })
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return (basis || 'quelle') + (m[2] || '').toLowerCase();
    }
  };

  root.dossier = dossier;
  if (typeof module !== 'undefined' && module.exports) module.exports = { dossier: dossier };
})(typeof globalThis !== 'undefined' ? globalThis : this);
