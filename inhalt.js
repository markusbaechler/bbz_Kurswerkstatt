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

    /* Welche Wege erzeugen das Lieferobjekt? "hochladen" gehoert nicht dazu —
       es ist eine Art abzulegen, keine Art zu produzieren. */
    arbeitswege: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      var w = (e && e.wege) || [];
      return w.filter(function (x) { return x !== 'hochladen'; });
    },

    /* Die Anleitungsschritte fuer einen Weg. Ein gemischter Text schickt die
       Person im Chat zu einem Node-Befehl und die Person in Claude Code zum
       Kopierknopf — deshalb trennt der Guide sie in stepsProWeg. */
    anleitungSchritte: function (i, schrittId, weg) {
      var g = inhalt.anleitungVon(i, schrittId);
      if (!g) return [];
      var proWeg = g.stepsProWeg;
      if (proWeg) {
        if (weg && proWeg[weg]) return proWeg[weg];
        var erste = inhalt.arbeitswege(i, schrittId).filter(function (x) { return proWeg[x]; })[0];
        if (erste) return proWeg[erste];
      }
      return g.steps || [];
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
    ablageVon: function (i, schrittId, kursId, variante) {
      var k = i['ablage-kontrakt'];
      var e = k && k.schritte && k.schritte[String(schrittId)];
      if (!e) return null;
      /* Verlangt der Schritt eine Variante und ist keine gewaehlt, wird der
         Platzhalter sichtbar stehengelassen — aber als {variante}, nicht als
         halber Dateiname. Der Mensch soll sehen, dass hier noch etwas fehlt. */
      var lief = e.lieferobjekt
        ? (inhalt.lieferobjektVon(i, schrittId, variante) || e.lieferobjekt)
        : null;
      var datei = e.datei
        ? e.datei.replace('{K}', kursId)
        : (kursId + '_' + lief + '_v{N}.' + e.ext);
      return { ordner: e.ordner, datei: datei, format: e.format, gate: e.gate || null,
               wege: e.wege || [], variante: variante || null };
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

    /* Wohin die nächste Fassung kommt — null, wenn der Schritt keine Versionen
       führt oder eine Variante verlangt, die nicht gewählt ist. */
    naechsteDatei: function (i, schrittId, kursId, dateien, variante) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e || !e.lieferobjekt || !e.ext) return null;
      var lief = inhalt.lieferobjektVon(i, schrittId, variante);
      if (!lief) return null;
      var v = inhalt.naechsteVersion(dateien, kursId, lief);
      var ziel = {
        ordner: e.ordner,
        datei: kursId + '_' + lief + '_v' + v + '.' + e.ext,
        version: v,
        format: e.format
      };
      /* Nur setzen, wo es eine gibt — sonst aendert sich die Form fuer alle
         Schritte ohne Varianten. */
      if (variante) ziel.variante = variante;
      return ziel;
    },

    /* Welche Fassung gilt? Maschinenregel aus dem Kontrakt: gibt es _final, gilt sie;
       sonst die hoechste Nummer. Liefert den Dateinamen oder null. */
    geltendeDatei: function (dateien, kursId, lieferobjekt) {
      if (!Array.isArray(dateien)) return null;
      var f = new RegExp('^' + reEsc(kursId) + '_' + reEsc(lieferobjekt) + '_final\\.[a-z0-9]+$', 'i');
      var v = new RegExp('^' + reEsc(kursId) + '_' + reEsc(lieferobjekt) + '_v(\\d+)\\.[a-z0-9]+$', 'i');
      var final = null, best = null, max = 0;
      dateien.forEach(function (d) {
        var n = d.name || '';
        if (f.test(n)) { final = n; return; }
        var m = v.exec(n);
        if (m) { var x = parseInt(m[1], 10); if (x > max) { max = x; best = n; } }
      });
      return final || best;
    },

    /* Der Weg Chat ist nur dort vorgesehen, wo der Kontrakt ihn nennt. */
    darfAblegen: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e || !Array.isArray(e.wege)) return false;
      return e.wege.indexOf('chat') >= 0 && !!e.lieferobjekt;
    },

    /* Ebenso das Hochladen: nur wo der Kontrakt es nennt. Gedacht fuer die
       Lieferobjekte, die nicht als Text entstehen — Excel (Schritt 3) und der
       Moodle-Export (Schritt 7). */
    darfHochladen: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      return !!(e && Array.isArray(e.wege) && e.wege.indexOf('hochladen') >= 0);
    },

    /* --- Varianten ---
       Schritt 4 erzeugt bewusst mehrere Entwuerfe nebeneinander, je Werkzeug
       einen. Der Kontrakt schreibt das als lieferobjekt "greenfield-{variante}"
       plus varianten: ["claude","chatgpt"]. Jede Variante fuehrt ihre eigene
       Versionsreihe — sie sind keine Versionen voneinander. */
    varianten: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      return (e && Array.isArray(e.varianten) && e.varianten.length) ? e.varianten : null;
    },

    /* Das Lieferobjekt mit aufgeloester Variante. null, wenn der Kontrakt eine
       Variante verlangt und keine gewaehlt ist — dann darf nichts abgelegt
       werden, sonst stuende {variante} woertlich im Dateinamen. */
    lieferobjektVon: function (i, schrittId, variante) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e || !e.lieferobjekt) return null;
      if (e.lieferobjekt.indexOf('{variante}') < 0) return e.lieferobjekt;
      var erlaubt = inhalt.varianten(i, schrittId) || [];
      if (erlaubt.indexOf(variante) < 0) return null;
      return e.lieferobjekt.replace('{variante}', variante);
    },

    /* Wohin die hochgeladene Datei kommt. Drei Faelle: fester Dateiname aus dem
       Kontrakt (Schritt 7: {K}_export.mbz), versioniertes Lieferobjekt
       (Schritt 3) oder versioniertes Lieferobjekt mit Variante (Schritt 4).
       Der Mensch tippt in keinem Fall einen Namen. */
    hochladeZiel: function (i, schrittId, kursId, dateien, variante) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e) return null;
      if (e.datei) {
        return { ordner: e.ordner, datei: e.datei.replace('{K}', kursId), version: null };
      }
      return inhalt.naechsteDatei(i, schrittId, kursId, dateien, variante);
    },

    /* Die Endung, die der Kontrakt fuer diesen Schritt erwartet — als Vorauswahl
       im Dateidialog und fuer die Warnung, wenn etwas anderes gewaehlt wird. */
    erwarteteEndung: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e) return null;
      if (e.ext) return e.ext;
      var m = /\.([a-z0-9]+)$/i.exec(e.datei || '');
      return m ? m[1] : null;
    },

    /* --- Der Kursordner ---
       Bindend ist laut Kontrakt allein das Praefix {K}_ — nur danach sucht
       graph.kursOrdner(). Der Kurzname dahinter ist ein Vorschlag fuer Menschen;
       deshalb darf DBS-001_derivate-strukturierte-produkte stehenbleiben, obwohl
       er nicht der Ableitung aus dem Kurstitel entspricht. */

    /* Kurstitel zu Kurzname: Umlaute aufgeloest, klein, alles Uebrige zu
       Bindestrichen, hoechstens 40 Zeichen. */
    slug: function (titel) {
      var um = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'à': 'a', 'á': 'a',
                 'â': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'í': 'i', 'î': 'i',
                 'ï': 'i', 'ó': 'o', 'ô': 'o', 'ú': 'u', 'û': 'u', 'ç': 'c' };
      var s = String(titel || '').toLowerCase()
        .replace(/[äöüßàáâéèêíîïóôúûç]/g, function (c) { return um[c] || c; })
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (s.length > 40) s = s.slice(0, 40).replace(/-+$/, '');
      return s;
    },

    /* Der vorgeschlagene Ordnername. Ohne brauchbaren Titel bleibt es beim Praefix. */
    kursordnerName: function (kursId, titel) {
      var kurz = inhalt.slug(titel);
      return kurz ? kursId + '_' + kurz : String(kursId || '');
    },

    /* Prueft einen von Hand geaenderten Namen. null = in Ordnung, sonst der Grund. */
    kursordnerPruefe: function (i, kursId, name) {
      var k = ((i && i['ablage-kontrakt']) || {}).kursordner || {};
      var muster = (k.kurzname && k.kurzname.erlaubt) || '^[a-z0-9][a-z0-9-]{0,39}$';
      var praefix = kursId + '_';
      if (String(name || '').indexOf(praefix) !== 0) {
        return 'Der Ordner muss mit ' + praefix + ' beginnen.';
      }
      if (!new RegExp(muster).test(String(name).slice(praefix.length))) {
        return 'Nach ' + praefix + ' sind nur Kleinbuchstaben, Ziffern und ' +
               'Bindestriche erlaubt — hoechstens 40 Zeichen.';
      }
      return null;
    },

    /* Die Unterordner — abgeleitet, nicht aufgelistet. Acht stehen als Ziel in
       den Schritten (05_content zweimal, Schritt 5 und 6); 00_input gehoert zu
       keinem Schritt und steht deshalb als einziges im Kontrakt. Eine zweite
       Liste waere eine zweite Quelle fuer dieselbe Tatsache. */
    ordnerliste: function (i) {
      var k = (i && i['ablage-kontrakt']) || {};
      var l = ((k.kursordner && k.kursordner.zusatzordner) || []).slice();
      var s = k.schritte || {};
      Object.keys(s).forEach(function (n) {
        var o = s[n] && s[n].ordner;
        if (o && l.indexOf(o) < 0) l.push(o);
      });
      return l.sort();
    },

    /* Das Lieferobjekt von Schritt 2: reine Stammdaten, keine Version.
       Felder nach Prozess-Spec — Kurs-ID, Titel, Kompetenzfeld, Anlagedatum. */
    manifest: function (kurs, angelegt) {
      return {
        kursId: kurs.kursId,
        kurstitel: kurs.kurstitel || '',
        kompetenzfeld: kurs.kompetenzfeld || '',
        angelegt: angelegt
      };
    },

    /* --- Projekt-Instruktionen fuer die beiden KI-Projekte (Schritt 2) ---
       Uebernommen aus dem Generator des abgeloesten Cockpits v0.2 — aber die
       Ablage-Angaben werden ABGELEITET statt abgeschrieben. Die alte Fassung trug
       noch die Ordner 01_altunterlagen … 05_moodle-export und brachte damit beiden
       KI-Projekten eine Struktur bei, die es seit dem Ablage-Kontrakt nicht mehr
       gibt. Was aus dem Kontrakt kommt, kann nicht mehr veralten. */
    /* Der Inhalt entsteht EINMAL als Abschnitte. Die beiden Fassungen unterscheiden
       sich nur in der Verpackung — so koennen Claude und ChatGPT nicht auseinander-
       driften, obwohl jede ihre eigene Form bekommt. */
    projektInstruktionenTeile: function (i, kurs, briefing) {
      var kontrakt = (i && i['ablage-kontrakt']) || {};
      var schritte = (i && i.schritte && i.schritte.schritte) || [];
      var ordner = inhalt.ordnerliste(i);
      var kf = kurs.kompetenzfeld || 'offen';
      var teile = [];
      var z;

      function abs(n) { return n ? n : ''; }
      function teil(tag, titel) { z = []; teile.push({ tag: tag, titel: titel, zeilen: z }); }

      teil('rolle', 'Rolle & Kontext');
      z.push('Du bist didaktischer Co-Autor im bbz-Produktionsprozess „Lerninhalte umgiessen". ' +
             'Wir bauen diesen Weiterbildungskurs (Kompetenzfeld: ' + kf + ') nach dem W-U-G-Modell ' +
             'neu auf. Dieser Kurs ist allgemeine Weiterbildung (oeffentlich), kein bankinternes ' +
             'oder kundenspezifisches Material. Du lieferst Entwuerfe; final ist nur, was ein ' +
             'Mensch freigibt.');

      teil('modell', 'Didaktisches Modell W-U-G (Kompass, kein starres Klassifikationssystem)');
      z.push('W-U-G ist der didaktische Kompass fuers Kursdesign, keine 1:1-Bloom-Zuordnung. ' +
             'Bloom dient als Orientierungsanker; Ueberschneidungen zwischen U und G sind zulaessig.');
      z.push('- W = Wissen: Selbstlernphase VOR dem Kurs (Moodle/Web), im Fokus Bloom 1–2. ' +
             'Entspricht den Eingangskompetenzen. Dieser Sprint baut die W-Strecke.');
      z.push('- U = Urteil: Reflexion, Einordnung, begruendetes Urteil — haeufig Bloom 4–5. Praesenz.');
      z.push('- G = Gestalten: Anwendung und Gestaltung in der Praesenz — haeufig Bloom 3–6. ' +
             'Der KI-resistente Wertkern.');
      z.push('Test–Learn–Test: Eingangsdiagnose, formative Wissenschecks in der W-Strecke, ' +
             'Abschlusspruefung der angestrebten Kompetenzen.');
      z.push('Praesenz-Orientierung ~30% Input · 50% Anwendung · 20% Reflexion — Zielbild, ' +
             'kein Abnahmekriterium.');

      teil('schritte', 'Die neun Produktionsschritte');
      schritte.forEach(function (s) {
        var a = kontrakt.schritte && kontrakt.schritte[String(s.id)];
        var ziel = a ? (a.ordner + '/' + (a.datei || ('{K}_' + a.lieferobjekt + '_v{N}.' + a.ext))) : '';
        z.push('- Schritt ' + s.id + ' — ' + s.nm + (a && a.gate ? '  [' + a.gate + ']' : '') +
               (ziel ? '  →  ' + ziel.replace('{K}', kurs.kursId) : ''));
      });
      z.push('Sprint-Scope: Sprint 1 baut und gibt die W-Selbstlernstrecke frei. U- und ' +
             'G-Praesenzartefakte folgen nachgelagert im selben Projekt.');

      teil('ablage', 'Ablage — verbindlich');
      z.push('Bibliothek: ' + (kontrakt.bibliothek || 'Kursproduktion') + ' (SharePoint).');
      z.push('Kursordner dieses Kurses: ' + kurs.kursId + '_<kurzname>/');
      z.push('Unterordner: ' + ordner.join(' · '));
      z.push('Dateiname: ' + abs(kontrakt.benennung && kontrakt.benennung.muster) +
             ' — freigegeben: ' + abs(kontrakt.benennung && kontrakt.benennung.final) + '.');
      z.push('Aufloesung: gibt es eine _final, gilt sie; sonst die hoechste Versionsnummer. ' +
             '_final entsteht durch Umbenennen, nie durch Kopieren.');
      z.push('Verboten in Dateinamen: ' +
             ((kontrakt.benennung && kontrakt.benennung.verboten) || []).join(', ') + '.');
      z.push('Gate-Protokolle liegen als ' + (kontrakt.gate_datei || '_gate.md') +
             ' neben der Datei, ueber die sie urteilen.');
      z.push('Der Ordner sagt nie, ob etwas fertig ist — der Stand steht in der Liste KWKurse ' +
             '(Felder Schritt 1–9 und Status offen/inArbeit/fertig). Referenzen zeigen auf die ' +
             'Kurs-ID, nie auf einen Pfad.');

      teil('regeln', 'Feste Regeln');
      z.push('- Arbeite streng entlang der konkreten Lernziele und Eingangskompetenzen ' +
             '(Halluzinations-Bremse).');
      z.push('- Evidenzregel: Fachliche Aussagen, Zahlen, Fristen, regulatorische Angaben und ' +
             'Definitionen nur uebernehmen, wenn durch eine freigegebene Projektquelle belegt. ' +
             'Fehlt ein Beleg: [ZU PRUEFEN: Quelle fehlt]. Altmaterial ist Pruefgegenstand, ' +
             'NICHT automatisch Wahrheitsquelle.');
      z.push('- Fundament-Check (Orientierung, nicht mechanisch): in der Regel mindestens eine ' +
             'stuetzende Eingangskompetenz je Ausgangskompetenz; Abweichung im Contract begruendet.');
      z.push('- Vorrang bei Konflikt: Diese Projekt-Instruktionen gehen einzelnen Masterprompts ' +
             'vor. Ein Masterprompt darf konkretisieren, nicht aushebeln. Arbeite nur am ' +
             'angeforderten Schritt.');
      z.push('- Stabile IDs: Lernziel-ID ' + kurs.kursId + '-LZ-###, Eingangskompetenz-ID ' +
             kurs.kursId + '-EK-###, Baustein-ID ' + kurs.kursId + '-BS-###. IDs bleiben bei ' +
             'Textaenderung bestehen und werden nie wiederverwendet. EK zu LZ ist n:m.');
      z.push('- Die KI vergibt NIE einen Freigabestatus. „fertig" erst nach menschlicher Freigabe.');
      z.push('- Standard-Kennzeichnungen woertlich: [ENTWURF — unvalidiert] · [ZU PRUEFEN: …] · ' +
             '[NEU — Sign-off noetig] · [FREIGEGEBEN DURCH: … / DATUM: …].');
      z.push('- Fehlende Angaben werden NICHT geraten → „offen".');

      teil('freigabe', 'Menschliche Freigabe (nicht verhandelbar)');
      z.push('Fachliche Freigabe durch den Menschen an den Gates. Nichts gilt ohne menschliche ' +
             'Freigabe als final. Ist eine benoetigte Projektdatei nicht auffindbar, benenne die ' +
             'fehlende Grundlage — rekonstruiere ihren Inhalt NICHT aus Vermutungen.');

      teil('kursbriefing', 'Das freigegebene Kursbriefing');
      if (briefing) {
        z.push('Aus ' + kurs.kursId + '_briefing (Schritt 1). Es ist die Leitplanke fuer alles ' +
               'Weitere — bei Widerspruch zu einer Annahme gilt das Briefing.');
        z.push('');
        z.push(briefing);
      } else {
        z.push('[FEHLT — in Schritt 1 noch nicht abgelegt. Ohne freigegebenes Kursbriefing ' +
               'nicht mit Schritt 3 beginnen.]');
      }
      return teile;
    },

    /* Die zwei Fassungen. Gleicher Inhalt, andere Verpackung:
       Claude arbeitet mit XML-Tags, ChatGPT mit Trenn-Ueberschriften — dasselbe
       Tool-Tuning, das die Masterprompts schon benutzen. */
    projektInstruktionen: function (i, kurs, briefing, fassung) {
      var teile = inhalt.projektInstruktionenTeile(i, kurs, briefing);
      var kopf = 'Projekt-Instruktionen — Kurs ' + kurs.kursId + ' — ' + kurs.kurstitel +
                 '\nKompetenzfeld: ' + (kurs.kompetenzfeld || 'offen');
      var z = [];

      if (fassung === 'chatgpt') {
        z.push('=== ' + kopf.split('\n')[0].toUpperCase() + ' ===');
        z.push(kopf.split('\n')[1]);
        teile.forEach(function (t, n) {
          z.push('');
          z.push('=== ' + (n + 1) + '. ' + t.titel.toUpperCase() + ' ===');
          z.push(t.zeilen.join('\n'));
        });
        z.push('');
        z.push('=== ARBEITSWEISE ===');
        z.push('Halte dich in jedem Chat an den jeweiligen Masterprompt UND an diese ' +
               'Instruktionen. Bei Widerspruch gelten diese Instruktionen; benenne den ' +
               'Konflikt, statt ihn still aufzuloesen.');
        return z.join('\n');
      }

      /* Claude */
      z.push('# ' + kopf);
      teile.forEach(function (t) {
        z.push('');
        z.push('<' + t.tag + '>');
        z.push('<!-- ' + t.titel + ' -->');
        z.push(t.zeilen.join('\n'));
        z.push('</' + t.tag + '>');
      });
      z.push('');
      z.push('<arbeitsweise>');
      z.push('Halte dich in jedem Chat an den jeweiligen Masterprompt UND an diese ' +
             'Instruktionen. Bei Widerspruch gelten diese Instruktionen; benenne den ' +
             'Konflikt, statt ihn still aufzuloesen.');
      z.push('</arbeitsweise>');
      return z.join('\n');
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
