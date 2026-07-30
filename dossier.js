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
        regulatorik: {},
        content_modus: 'quellengestuetzt',
        quellen: [],
        status: {},
        offen: [],
        entschieden: []
      };
    },

    /* Formularwerte nach scope UND regulatorik uebernehmen (Etappe 1e, Task 6).
       Standardmaessig geht jedes Feld nach scope, wie bisher. Das optionale
       fuenfte Argument felder (z. B. inhalt.BRIEFING_FELDER) darf Eintraege mit
       ziel:'regulatorik' tragen — die werden stattdessen unter speicherName
       (oder, fehlt der, unter der eigenen id) nach d.regulatorik geschrieben.
       dossier.js bleibt dabei rein: es kennt nur das Attribut ziel/speicherName,
       nie inhalt.js selbst — die Feldliste kommt als Daten herein, kein require.
       Bool-Werte (das SAQ-Haekchen) bleiben bool und werden nie wegen Leere
       verworfen (false ist eine vollstaendige Antwort, kein Fehlen); alles
       andere wird wie bisher getrimmt, Leeres faellt weg. Alles ausser
       scope/regulatorik bleibt unangetastet — das Formular ist nicht die
       einzige Schreibstelle, aber jede Schreibstelle schreibt nur ihren Teil.
       stand kommt als Parameter (kein Date hier drin). */
    ausWerten: function (kursId, werte, alt, stand, felder) {
      var d = alt ? JSON.parse(JSON.stringify(alt)) : dossier.neu(kursId);
      d.kurs = String(kursId || d.kurs);
      d.scope = {};
      var regulatorikNeu = {};
      Object.keys(werte || {}).forEach(function (k) {
        var roh = werte[k];
        var f = (felder || []).filter(function (x) { return x && x.id === k; })[0];
        var regulatorikZiel = !!(f && f.ziel === 'regulatorik');
        var name = (f && f.speicherName) || k;
        if (typeof roh === 'boolean') {
          if (regulatorikZiel) regulatorikNeu[name] = roh; else d.scope[k] = roh;
          return;
        }
        var v = String(roh == null ? '' : roh).trim();
        if (!v) return;
        if (regulatorikZiel) regulatorikNeu[name] = v; else d.scope[k] = v;
      });
      d.regulatorik = regulatorikNeu;
      if (stand) d.stand = stand;
      return d;
    },

    text: function (d) { return JSON.stringify(d, null, 2) + '\n'; },

    /* Unbrauchbares wird abgewiesen, nie still repariert — ein kaputtes Dossier
       still zu ersetzen hiesse, Quellen und Status zu verlieren.

       EINE Ausnahme, dokumentiert (Etappe 1e, Task 6): Schema-ERWEITERUNG ist
       keine Reparatur. dossier.SCHEMA bleibt bewusst 1 — regulatorik ist rein
       additiv, kein Bruch mit dem, was vorher galt. Vor diesem Feld
       geschriebene Dossiers (z. B. VL-001 in SharePoint, Stand 2026-07-30)
       tragen gar kein regulatorik; ein fehlendes oder falsch typisiertes Objekt
       wird zu {} ergaenzt, und ein vorhandenes scope.reg_zusatz wandert nach
       regulatorik.zusatz (derselbe Feldinhalt, neuer Platz — das Formular
       schreibt seit diesem Feld dorthin, s. inhalt.BRIEFING_FELDER/ziel) und
       verschwindet aus scope. Das unterscheidet sich von echtem Reparieren:
       hier gab es das Feld zum Zeitpunkt des Schreibens schlicht noch nicht;
       pruefe() weist jeden ECHTEN Fehler weiterhin unveraendert ab. */
    lesen: function (text) {
      if (!text) return null;
      var d;
      try { d = JSON.parse(text); } catch (e) { return null; }
      if (d && typeof d === 'object' && (!d.regulatorik || typeof d.regulatorik !== 'object')) {
        d.regulatorik = {};
        if (d.scope && typeof d.scope === 'object' && d.scope.reg_zusatz) {
          d.regulatorik.zusatz = d.scope.reg_zusatz;
          delete d.scope.reg_zusatz;
        }
      }
      return dossier.pruefe(d).length ? null : d;
    },

    /* Eine Quelle pro Begriff (CLAUDE.md Konvention 9): quelleNeu (Schreibweg) und
       pruefe (Leseweg, u.a. fuer von Hand editierte dossier.json) muessen dieselbe
       Regel pruefen, sonst entsteht genau die Asymmetrie, die Audit I6 fand — pruefe
       verlangte abgerufen und akzeptierte die URL nur case-insensitiv, quelleNeu
       verlangte abgerufen NICHT und prüfte die URL case-sensitiv. url-Vergleich ist
       case-insensitiv (/i), weil https:// und HTTPS:// dieselbe Quelle sind. */
    quellePruefe: function (q, n) {
      var p = [];
      var praefix = 'Quelle' + (n == null ? '' : ' ' + n) + ': ';
      ['titel', 'stand'].forEach(function (f) {
        if (!q || !String(q[f] || '').trim()) p.push(praefix + f + ' fehlt');
      });
      var hatDatei = !!(q && String(q.datei || '').trim());
      var hatUrl = !!(q && String(q.url || '').trim());
      if (hatDatei === hatUrl) {
        p.push(praefix + 'entweder datei oder url');
      } else if (hatUrl) {
        if (!/^https?:\/\//i.test(String(q.url).trim())) {
          p.push(praefix + 'url muss mit http:// oder https:// beginnen');
        }
        /* abgerufen ist bei einer URL immer Pflicht, auch beim Schreiben — die App
           liefert es ohnehin mit (app.js: new Date().toISOString()), aber ein von
           Hand editiertes dossier.json muss genauso abgewiesen werden. */
        if (!String((q || {}).abgerufen || '').trim()) p.push(praefix + 'abgerufen fehlt');
      }
      return p;
    },

    pruefe: function (d) {
      var p = [];
      if (!d || typeof d !== 'object') return ['kein Objekt'];
      if (d.dossier !== dossier.SCHEMA) p.push('unbekannte Schema-Version: ' + d.dossier);
      if (!d.kurs) p.push('kurs fehlt');
      if (!d.scope || typeof d.scope !== 'object') p.push('scope fehlt');
      /* regulatorik.stand ist NICHT hier Pflicht (Etappe 1e, Task 6, Entscheid
         Markus): alte Dossiers haben keins, lesen() darf sie nicht abweisen.
         Pflicht ist es nur im Formular-Zaehler (inhalt.briefingFehlend) — nach
         der Migration in lesen() ist ein fehlendes regulatorik-Objekt ohnehin
         unmoeglich, dieser Check trifft nur ein von Hand kaputt editiertes. */
      if (!d.regulatorik || typeof d.regulatorik !== 'object') p.push('regulatorik fehlt');
      /* identitaet ist additiv wie regulatorik (Etappe 2, Task 3): ein Alt-Dossier
         ganz ohne den Schluessel bleibt lesbar, nur ein falsch typisiertes wird
         abgewiesen — dieselbe Schema-ERWEITERUNG-Logik wie bei regulatorik. */
      if (d.identitaet != null && typeof d.identitaet !== 'object') p.push('identitaet ist kein Objekt');
      if (dossier.MODI.indexOf(d.content_modus) < 0) p.push('content_modus unbekannt: ' + d.content_modus);
      if (!Array.isArray(d.quellen)) p.push('quellen ist keine Liste');
      else {
        /* Duplikat ist eine Eigenschaft der LISTE, nicht der einzelnen Quelle
           (Etappe 2, Task 7, Handover §4.4) — quelleNeu() (Schreibweg) wies
           Duplikate schon ab (Etappe 1e, Audit C3), pruefe() (Leseweg, u.a.
           fuer von Hand editierte dossier.json) noch nicht. Case-insensitiv
           ueber datei/url, dieselbe Vergleichslogik wie im Schreibweg. */
        var gesehen = {};
        d.quellen.forEach(function (q, n) {
          if (!q || !String(q.id || '').trim()) p.push('Quelle ' + (n + 1) + ': id fehlt');
          p.push.apply(p, dossier.quellePruefe(q, n + 1));
          ['datei', 'url'].forEach(function (f) {
            var v = String((q || {})[f] || '').trim().toLowerCase();
            if (!v) return;
            var schl = f + ':' + v;
            if (gesehen[schl]) p.push('Quelle ' + (n + 1) + ': ' + f + ' doppelt (schon als ' + gesehen[schl] + ' erfasst)');
            else gesehen[schl] = q.id || ('Quelle ' + (n + 1));
          });
        });
      }
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

    /* Identitaet: Titel und Kompetenzfeld stammen aus KWKurse und werden von der
       App bei jedem Schreiben gestempelt — nie im Dossier gepflegt (Meta-Spec §3:
       "aus KWKurse, nie doppelt gepflegt"). So koennen die CC-Werkzeuge
       (dossier-steckbrief.cjs) alles aus einer Datei erben. */
    identitaetSetzen: function (d, kurs) {
      if (!kurs) return d;
      d.identitaet = {
        titel: String(kurs.kurstitel || ''),
        kompetenzfeld: String(kurs.kompetenzfeld || '')
      };
      return d;
    },

    /* Der Banner fuer generierte Ansichten. null heisst: nichts anzeigen. */
    banner: function (status) {
      if (status === 'final') return null;
      if (status === 'validiert') return '[VALIDIERT — Freigabe steht aus]';
      return '[ENTWURF — unvalidiert]';
    },

    /* offen[]/entschieden[] werden AM GATE erfasst (Entscheid Markus 2026-07-30);
       Traeger ist das Dossier, nicht mehr der Dokument-Steckbrief (Meta-Spec §3.2).
       S1: jeder Punkt adressiert ein Gate ODER einen Schritt. S2 setzt das Gate um:
       entscheiden (Person+Datum) oder begruendet verschieben — nie stilles Liegenlassen. */
    ZIELE: ['gate-1', 'sign-off', 'gate-2', 'schritt-3', 'schritt-4', 'schritt-5',
            'schritt-6', 'schritt-7', 'schritt-8'],

    offenNeu: function (d, p) {
      p = p || {};
      var was = String(p.was || '').trim();
      var wo = String(p.wo || '').trim();
      var fuer = String(p.fuer || '').trim();
      if (!was) throw new Error('Offener Punkt: was fehlt');
      if (!wo) throw new Error('Offener Punkt: wo fehlt (Modul, LZ/EK-ID oder Blatt)');
      if (dossier.ZIELE.indexOf(fuer) < 0) {
        throw new Error('Offener Punkt: fuer muss ein Gate oder Schritt sein (' + dossier.ZIELE.join(', ') + ')');
      }
      var e = { was: was, wo: wo, fuer: fuer };
      d.offen.push(e);
      return e;
    },

    offenFuer: function (d, ziel) {
      return ((d && d.offen) || []).filter(function (e) { return e.fuer === ziel; });
    },

    offenEntscheiden: function (d, index, p) {
      p = p || {};
      if (!d.offen[index]) return null;
      var wer = String(p.wer || '').trim();
      var wann = String(p.wann || '').trim();
      if (!wer) throw new Error('Entscheid: wer fehlt');
      if (!wann) throw new Error('Entscheid: wann fehlt');
      var alt = d.offen.splice(index, 1)[0];
      var e = { was: alt.was, wo: alt.wo, wer: wer, wann: wann };
      d.entschieden.push(e);
      return e;
    },

    offenVerschieben: function (d, index, neuesZiel, begruendung) {
      if (!d.offen[index]) return null;
      if (dossier.ZIELE.indexOf(String(neuesZiel || '').trim()) < 0) {
        throw new Error('Verschieben: Ziel muss ein Gate oder Schritt sein');
      }
      if (!String(begruendung || '').trim()) throw new Error('Verschieben: Begruendung fehlt (S2)');
      d.offen[index].fuer = String(neuesZiel).trim();
      d.offen[index].begruendung = String(begruendung).trim();
      return d.offen[index];
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
       keine Pflicht.
       Das Gate ist quellePruefe() — dieselbe Funktion wie in pruefe() (Audit I6:
       vorher war die Schreibseite hier laxer als die Leseseite: url case-sensitiv,
       abgerufen nicht verlangt). Ist die Quelle gueltig, folgt der Duplikatschutz
       (Audit C3): dieselbe Datei oder derselbe Link darf nicht zweimal erfasst
       werden — die Meldung nennt die bestehende Q-ID, statt den Datensatz
       stillschweigend zu verdoppeln. */
    quelleNeu: function (d, q) {
      q = q || {};
      var hatDatei = !!String(q.datei || '').trim();
      var hatUrl = !!String(q.url || '').trim();
      if (dossier.quellePruefe(q).length) {
        if (hatDatei === hatUrl) {
          throw new Error(hatDatei
            ? 'Quelle: entweder Datei oder Link, nicht beides'
            : 'Quelle: Datei oder Link angeben');
        }
        var fehlt = ['titel', 'stand'].filter(function (f) {
          return !String(q[f] || '').trim();
        });
        if (fehlt.length) throw new Error('Quelle unvollständig: ' + fehlt.join(', ') + ' fehlt');
        if (!/^https?:\/\//i.test(String(q.url || '').trim())) {
          throw new Error('Link muss mit http:// oder https:// beginnen');
        }
        /* Fallback-Zweig (Nebenauftrag T3-Review, Etappe 1e Task 6): alle
           vorstehenden, wortlaut-geprueften Faelle sind bereits abgefangen —
           was hier ankommt, ist ausschliesslich das fehlende abgerufen. Statt
           das hart zu benennen, meldet quellePruefe() selbst die Problemliste:
           waechst dessen Regelwerk kuenftig (z. B. eine Stand-Formatregel),
           bleibt dieser Zweig automatisch richtig, statt eine veraltete
           Meldung auszugeben. */
        throw new Error(dossier.quellePruefe(q).join(' · '));
      }
      if (hatDatei) {
        var dateiNeu = String(q.datei).trim().toLowerCase();
        var glDatei = (d.quellen || []).find(function (e2) {
          return String(e2.datei || '').trim().toLowerCase() === dateiNeu;
        });
        if (glDatei) throw new Error('Datei bereits als ' + glDatei.id + ' erfasst');
      } else {
        var urlNeu = String(q.url).trim().toLowerCase();
        var glUrl = (d.quellen || []).find(function (e2) {
          return String(e2.url || '').trim().toLowerCase() === urlNeu;
        });
        if (glUrl) throw new Error('Link bereits als ' + glUrl.id + ' erfasst');
      }
      var e = {
        id: dossier.naechsteQuellenId(d),
        titel: String(q.titel).trim(),
        herausgeber: String(q.herausgeber || '').trim(),
        stand: String(q.stand).trim()
      };
      if (hatUrl) {
        e.url = String(q.url).trim();
        e.abgerufen = String(q.abgerufen || '').trim();
      } else {
        e.datei = String(q.datei).trim();
      }
      d.quellen.push(e);
      return e;
    },

    /* Entfernt den Eintrag mit dieser id aus d.quellen und gibt ihn zurueck;
       unbekannte id liefert null, d bleibt unveraendert. IDs werden NICHT neu
       vergeben — Q-002 bleibt Q-002, auch wenn Q-001 verschwindet;
       naechsteQuellenId zaehlt ohnehin max+1, nie die Lueckenzahl. */
    quelleEntfernen: function (d, id) {
      var ql = (d && d.quellen) || [];
      var i = ql.findIndex(function (q) { return q.id === id; });
      if (i < 0) return null;
      return ql.splice(i, 1)[0];
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
