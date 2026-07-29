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
        if (s.schritte.length !== 8) p.push('schritte.json: ' + s.schritte.length + ' statt 8 Schritte');
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

    /* Final ist final. Liegt eine _final-Fassung, ist das Lieferobjekt
       abgeschlossen — es wird nichts mehr daneben abgelegt.

       Ohne diese Sperre entstuende ein stiller Schaden: _final zaehlt bei
       naechsteVersion() bewusst nicht mit, eine neue Ablage bekaeme also wieder
       _v1 — und die Aufloesungsregel "final vor hoechster Nummer" wuerde sie
       verdecken. Man arbeitete an einer Datei, die niemand liest.

       Wer nach der Freigabe weiterarbeiten muss, setzt _final von Hand zurueck.
       Das ist ein bewusster Eingriff und soll einer bleiben. */
    finalVorhanden: function (dateien, kursId, lieferobjekt) {
      if (!Array.isArray(dateien)) return null;
      var re = new RegExp('^' + reEsc(kursId) + '_' + reEsc(lieferobjekt) +
                          '_final\\.[a-z0-9]+$', 'i');
      var t = dateien.filter(function (d) { return re.test(d.name || ''); })[0];
      return t ? t.name : null;
    },

    /* Ist dieser Schritt fuer diesen Kurs abgeschlossen? Beruecksichtigt die
       Variante, wo der Kontrakt welche fuehrt. */
    abgeschlossen: function (i, schrittId, kursId, dateien, variante) {
      var lief = inhalt.lieferobjektVon(i, schrittId, variante);
      if (!lief) return null;
      return inhalt.finalVorhanden(dateien, kursId, lief);
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

    /* Welche Variante gilt gerade: die getroffene Wahl, sonst die erste des
       Kontrakts. Fuehrt der Schritt keine Varianten, ist die Antwort undefined.
       Eine Quelle — Ansicht, Ablegen und Hochladen fragen dieselbe Stelle.
       Vorher stand dieselbe Zeile dreimal im Code, und an einer der drei
       fehlte sie: der Weg Chat rechnete ohne Variante und legte deshalb nie ab. */
    gewaehlteVariante: function (i, schrittId, gewaehlt) {
      var v = inhalt.varianten(i, schrittId);
      if (!v) return undefined;
      return v.indexOf(gewaehlt) >= 0 ? gewaehlt : v[0];
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
       Kontrakt (Schritt 6: {K}_export.mbz), versioniertes Lieferobjekt
       (Schritt 2) oder versioniertes Lieferobjekt mit Variante (Schritt 3).
       Der Mensch tippt in keinem Fall einen Namen. */
    hochladeZiel: function (i, schrittId, kursId, dateien, variante) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e) return null;
      if (e.datei) {
        return { ordner: e.ordner, datei: e.datei.replace('{K}', kursId), version: null };
      }
      return inhalt.naechsteDatei(i, schrittId, kursId, dateien, variante);
    },

    /* --- Die Briefing-Felder (Schritt 1) ---
       Acht generische Angaben, die kein Urteil brauchen, sondern nur gewusst werden
       muessen. Sie werden in der Kurswerkstatt gefragt, nicht im Chat: ein Prompt,
       der sie erfragt, erzeugt Rueckfragen ohne Erkenntnis — Markus am 2026-07-29
       ("das ist mir zu schwabbelig"). Was danach im Chat passiert, ist Formulieren
       und Widersprueche finden, nicht Abfragen.

       EINE Quelle: Formular, Datei und Prompt-Einspeisung lesen alle hier.
       Reihenfolge = Reihenfolge im Formular. */
    BRIEFING_FELDER: [
      { id: 'zielgruppe', label: 'Zielgruppe', form: 'text', zeilen: 3, pflicht: true,
        hilfe: 'Rolle, Funktion, Erfahrungsstand — wer sitzt im Kurs?',
        beispiel: 'Kunden- und Anlageberatende mit praktischer Erfahrung im Anlagebereich; keine Mindestzahl an Berufsjahren.' },

      { id: 'vorkenntnisse', label: 'Vorkenntnisse', form: 'text', zeilen: 3, pflicht: true,
        hilfe: 'Was wird vorausgesetzt und deshalb NICHT unterrichtet?',
        beispiel: 'Saubere Risikoprofilierung, Anlagestrategien bestimmen, Basiswissen zu den gaengigen Anlageklassen.' },

      { id: 'kurszweck', label: 'Kurszweck', form: 'text', zeilen: 3, pflicht: true,
        hilfe: 'Wozu befaehigt der Kurs? Das Leistungsversprechen in ein bis drei Saetzen.',
        beispiel: 'Funktionsweise und Anwendung von Derivaten verstehen, Chancen und Risiken kundengerecht erlaeutern.' },

      { id: 'praesenz', label: 'Praesenzdauer', form: 'zahl', einheit: 'Tage', schritt: 0.5, pflicht: true,
        hilfe: 'In Tagen. Zwei Halbtage sind 1 Tag.',
        beispiel: '1' },

      { id: 'selbstlern', label: 'Umfang Selbstlernphase', form: 'zahl', einheit: 'Stunden', schritt: 0.5, pflicht: true,
        hilfe: 'In Stunden. Der W-Teil vor der Praesenz.',
        beispiel: '2' },

      { id: 'scope', label: 'Fachlicher Geltungsbereich', form: 'text', zeilen: 4, pflicht: true,
        hilfe: 'Was ist drin? Wenn eine Systematik die Grundlage ist, nenne sie mit Jahrgang.',
        beispiel: 'SSPA Swiss Derivative Map 2025, Kategorien Kapitalschutz, Renditeoptimierung, Partizipation, Hebel.' },

      /* Fester Rahmen, nur Zusaetze werden gefragt — Entscheid Markus 2026-07-29.
         Der Rahmen gilt fuer jeden Kurs dieses Hauses; ihn jedes Mal zu erfragen
         erzeugt eine Frage, deren Antwort schon feststeht. */
      { id: 'reg_zusatz', label: 'Regulatorische Zusaetze', form: 'text', zeilen: 2, pflicht: false,
        fest: 'Schweizer Markt- und Beratungskontext. FIDLEG, GWG und VSB gelten als Rahmen.',
        hilfe: 'Nur Zusaetze oder Abweichungen zum festen Rahmen. Leer lassen, wenn nichts dazukommt.',
        beispiel: 'Rezertifizierung fuer IK, Affluent, CWMA, KMU, CCoB. Keine FIDLEG-Vertiefung als Kursinhalt.' },

      { id: 'ausschluesse', label: 'Bewusste Ausschluesse', form: 'text', zeilen: 3, pflicht: true,
        hilfe: 'Was ausdruecklich NICHT Teil ist. Begrenzt den Content-Umfang staerker als jede Positivliste.',
        beispiel: 'Theoretische und rechtliche Deep Dives; vertiefte Optionsbewertung; Anlageprodukte mit zusaetzlichem Kreditrisiko.' },

      { id: 'scope_quelle', label: 'Quelle des Scopes', form: 'text', zeilen: 2, pflicht: true,
        hilfe: 'Woher stammt der Geltungsbereich? Dokument mit Stand. Ohne Quelle ist er nicht belegt.',
        beispiel: 'Kursausschreibung (verbindlich); SSPA Swiss Derivative Map 2025 als fachliche Referenz.' },
    ],

    briefingFeld: function (id) {
      return inhalt.BRIEFING_FELDER.filter(function (f) { return f.id === id; })[0] || null;
    },

    /* Welche Pflichtfelder noch leer sind. Leere Liste heisst: das Formular traegt. */
    briefingFehlend: function (werte) {
      werte = werte || {};
      return inhalt.BRIEFING_FELDER
        .filter(function (f) { return f.pflicht && !String(werte[f.id] || '').trim(); })
        .map(function (f) { return f.label; });
    },

    /* --- Datei 01_briefing/{K}_briefing-felder.md ---
       Menschenlesbar UND maschinenlesbar: Abschnitte "## <id> · <Label>". Die ID
       traegt die Bedeutung, das Label ist fuer Menschen. Wer das Label aendert,
       zerstoert damit keine bestehende Datei. */
    briefingFelderText: function (kursId, werte) {
      werte = werte || {};
      var z = [];
      z.push('# Briefing-Felder ' + kursId);
      z.push('');
      z.push('<!-- Erzeugt von der Kurswerkstatt (Schritt 1). In der App bearbeiten, nicht hier. -->');
      z.push('<!-- Diese Datei traegt keine Version: sie ist der aktuelle Stand der Angaben, -->');
      z.push('<!-- nicht ein Entwurf. Das Briefing selbst ist versioniert. -->');
      inhalt.BRIEFING_FELDER.forEach(function (f) {
        z.push('');
        z.push('## ' + f.id + ' · ' + f.label + (f.einheit ? ' (' + f.einheit + ')' : ''));
        if (f.fest) z.push(f.fest);
        var v = String(werte[f.id] || '').trim();
        z.push(v || '[OFFEN]');
      });
      z.push('');
      return z.join('\n');
    },

    briefingFelderLesen: function (text) {
      var werte = {};
      if (!text) return werte;
      var stuecke = String(text).split(/^## ([a-z_]+)[^\n]*$/m);
      for (var i = 1; i < stuecke.length; i += 2) {
        var id = stuecke[i].trim();
        var f = inhalt.briefingFeld(id);
        if (!f) continue;                       /* unbekanntes Feld still uebergehen */
        var roh = String(stuecke[i + 1] || '').trim();
        if (f.fest && roh.indexOf(f.fest) === 0) roh = roh.slice(f.fest.length).trim();
        werte[id] = roh === '[OFFEN]' ? '' : roh;
      }
      return werte;
    },

    /* --- Der Prompt bekommt die Felder mit ---
       Das ist der Zweck der ganzen Uebung: was hier steht, fragt der Chat nicht
       mehr. Leere Felder werden ausdruecklich als offen benannt, damit sie in der
       Entscheidliste landen statt erfunden zu werden. */
    briefingPromptKopf: function (kurs, werte) {
      werte = werte || {};
      var z = [];
      z.push('=== ANGABEN AUS DER KURSWERKSTATT ===');
      z.push('Diese Werte sind gesetzt. Frage sie NICHT erneut ab und formuliere sie nicht um,');
      z.push('ausser du findest einen Widerspruch — den benenne.');
      z.push('');
      z.push('Kurs: ' + (kurs && kurs.kursId || '?') + ' — ' + (kurs && kurs.kurstitel || '?'));
      z.push('Kompetenzfeld: ' + (kurs && kurs.kompetenzfeld || '?'));
      var offen = [];
      inhalt.BRIEFING_FELDER.forEach(function (f) {
        var v = String(werte[f.id] || '').trim();
        var fest = f.fest ? f.fest + (v ? ' ' + v : '') : v;
        if (!v && !f.fest) { offen.push(f.label); return; }
        z.push(f.label + (f.einheit ? ' (' + f.einheit + ')' : '') + ': ' + fest);
      });
      z.push('');
      if (offen.length) {
        z.push('NOCH OFFEN — diese gehoeren in die Entscheidliste: ' + offen.join(', ') + '.');
      } else {
        z.push('Alle Felder sind ausgefuellt. Deine Entscheidliste enthaelt nur noch, was dir');
        z.push('beim Lesen als Widerspruch, Luecke oder unbelegte Angabe auffaellt — im Zweifel');
        z.push('ist sie kurz oder leer. Eine leere Entscheidliste ist ein gutes Ergebnis, kein Mangel.');
      }
      z.push('=== ENDE DER ANGABEN ===');
      z.push('');
      return z.join('\n');
    },

    /* Bricht zu lange Zeilen an Wortgrenzen um. Vorhandene Zeilenenden bleiben
       stehen; eine Aufzaehlung behaelt ihre Einrueckung, damit die Fortsetzung
       nicht wie ein neuer Punkt aussieht. Ein einzelnes Wort, das laenger ist
       als die Breite, wird nicht zerschnitten — lieber eine lange Zeile als ein
       zerrissener Dateiname. */
    umbrechen: function (text, breite) {
      breite = breite || 100;
      return String(text).split('\n').map(function (zeile) {
        if (zeile.length <= breite) return zeile;
        var m = /^(\s*(?:[-*·]\s+|\d+\.\s+)?)/.exec(zeile);
        var einzug = new Array(m[1].length + 1).join(' ');
        var worte = zeile.split(' ');
        var raus = [];
        var akt = '';
        worte.forEach(function (w) {
          var kandidat = akt ? akt + ' ' + w : w;
          if (akt && kandidat.length > breite) { raus.push(akt); akt = einzug + w; }
          else { akt = kandidat; }
        });
        if (akt) raus.push(akt);
        return raus.join('\n');
      }).join('\n');
    },

    /* Auf dem Weg Claude-Code kopiert niemand einen Prompt — man gibt einen
       Bauauftrag. Wie die Auftragsdatei heisst, steht nicht hier: sie wird aus
       dem Inhaltskontrakt des Schritts abgeleitet (qualitaet im Ablage-Kontrakt),
       weil ein fest eingetragener Name veraltet, sobald ein Schritt umbenannt
       wird. Genau das ist am 2026-07-29 aufgefallen: die Ansicht nannte fuer
       JEDEN Schritt "greenfield-bauspec.txt" — eine Datei, die es nicht mehr gibt.
       Ohne qualitaet-Eintrag wird kein Name genannt, statt einen zu raten. */
    bauauftrag: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      var q = e && e.qualitaet;
      if (!q || q.indexOf('-inhaltskontrakt.txt') < 0) return null;
      return {
        inhaltskontrakt: q.split('/').pop(),
        bauspec: q.split('/').pop().replace('-inhaltskontrakt.txt', '-bauspec.txt'),
        pfad: q.replace('-inhaltskontrakt.txt', '-bauspec.txt'),
      };
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

    /* --- Projekt-Instruktionen fuer die beiden KI-Projekte (Schritt 1) ---
       Uebernommen aus dem Generator des abgeloesten Cockpits v0.2 — aber die
       Ablage-Angaben werden ABGELEITET statt abgeschrieben. Die alte Fassung trug
       noch die Ordner 01_altunterlagen … 05_moodle-export und brachte damit beiden
       KI-Projekten eine Struktur bei, die es seit dem Ablage-Kontrakt nicht mehr
       gibt. Was aus dem Kontrakt kommt, kann nicht mehr veralten.
       Reform 2026-07-29: der fruehere eigene Schritt dafuer ("Kurs-Projekt &
       Manifest") ist in Schritt 1 aufgegangen. Er versprach mit wege: ['kurswerkstatt']
       eine Automatisierung, die die App nicht bietet — sie kann Text fuer die
       KI-Projekte erzeugen, aber kein KI-Projekt selbst anlegen. Das Manifest
       (02_setup/{K}_manifest.json) war die einzige echte Ablage dieses Schritts
       und ist mit ihm entfallen; kein Ordner der neuen Acht fuehrt es mehr. */
    /* Der Inhalt entsteht EINMAL als Abschnitte. Die beiden Fassungen unterscheiden
       sich nur in der Verpackung — so koennen Claude und ChatGPT nicht auseinander-
       driften, obwohl jede ihre eigene Form bekommt. */
    /* Massstab je Zeile: gilt das fuer JEDEN Chat in diesem Projekt, ueber alle
       Schritte hinweg — oder ist es nur in einem einzelnen Schritt wahr? Nur
       Ersteres gehoert hierher. Je-Schritt-Wahres (genaues Ablageziel, Methodik
       eines Schritts) steht im Masterprompt, der ohnehin je Schritt frisch
       eingefuegt wird, oder in der Anleitung, die der Mensch in der App liest. */
    projektInstruktionenTeile: function (i, kurs, briefing, ordnerName) {
      var kontrakt = (i && i['ablage-kontrakt']) || {};
      var schritte = (i && i.schritte && i.schritte.schritte) || [];
      var ordner = inhalt.ordnerliste(i);
      var kf = kurs.kompetenzfeld || 'offen';
      var teile = [];
      var z;

      function abs(n) { return n ? n : ''; }
      function teil(tag, titel) { z = []; teile.push({ tag: tag, titel: titel, zeilen: z }); }

      teil('rolle', 'Rolle & Kontext');
      z.push('Du bist didaktischer Co-Autor im bbz-Produktionsprozess „Lerninhalte umgiessen" ' +
             'für diesen Weiterbildungskurs (Kompetenzfeld: ' + kf + '), gebaut nach dem ' +
             'W-U-G-Modell. Öffentliche Weiterbildung, kein bankinternes oder ' +
             'kundenspezifisches Material. Du lieferst Entwürfe; final wird nur, was ein ' +
             'Mensch freigibt.');

      /* Nur Name, Gate und Weg je Schritt — das gilt fuer jeden Chat im Projekt
         (Orientierung: bin ich hier ueberhaupt zustaendig?). Wohin genau ein
         Ergebnis abgelegt wird, ist je Schritt verschieden und steht deshalb im
         Masterprompt dieses Schritts, nicht hier fuer alle acht auf Vorrat. */
      teil('schritte', 'Die acht Produktionsschritte');
      schritte.forEach(function (s) {
        var a = kontrakt.schritte && kontrakt.schritte[String(s.id)];
        var wege = (a && a.wege || []).filter(function (x) { return x !== 'hochladen'; });
        z.push('- Schritt ' + s.id + ' — ' + s.nm + (a && a.gate ? '  [' + a.gate + ']' : '') +
               (wege.length ? '  (' + wege.join(', ') + ')' : ''));
      });
      z.push('Wohin genau (Ordner, Dateiname) ein Ergebnis kommt, sagt der Masterprompt des ' +
             'jeweiligen Schritts — das allgemeine Muster dazu steht unter „Ablage".');

      teil('ablage', 'Ablage — verbindlich');
      z.push('Bibliothek ' + (kontrakt.bibliothek || 'Kursproduktion') + ' (SharePoint), ' +
             'Kursordner ' + (ordnerName || (kurs.kursId + '_<kurzname>')) + '/' +
             (ordnerName ? '' : '  [noch nicht angelegt — Schritt 1]') + '.');
      /* Den Hinweis "nicht erfunden" ausdruecklich mitgeben: ein Platzhalter oder
         eine geratene Struktur wird von beiden KI-Projekten als Pfad gelernt und
         weitergereicht. */
      z.push('Unterordner: ' + ordner.join(' · ') + '. Diese Struktur kommt aus dem ' +
             'Ablage-Kontrakt — nicht selbst erfinden oder ergänzen.');
      z.push('Dateiname: ' + abs(kontrakt.benennung && kontrakt.benennung.muster) +
             ', freigegeben: ' + abs(kontrakt.benennung && kontrakt.benennung.final) +
             '. Gibt es eine _final, gilt sie (entsteht durch Umbenennen, nie durch ' +
             'Kopieren); sonst die höchste Versionsnummer. Verboten darin: ' +
             ((kontrakt.benennung && kontrakt.benennung.verboten) || []).join(', ') + '.');
      z.push('Gate-Protokolle liegen als ' + (kontrakt.gate_datei || '_gate.md') + ' neben der ' +
             'Datei. Der Stand steht in KWKurse (Schritt, Status), nie im Ordner; Referenzen ' +
             'zeigen auf die Kurs-ID, nie auf einen Pfad.');

      teil('regeln', 'Feste Regeln');
      z.push('- Belegregel: Fachliche Aussagen, Zahlen, Fristen und Definitionen nur aus einer ' +
             'freigegebenen Projektquelle. Fehlt der Beleg: [ZU PRÜFEN: <was> — Quelle fehlt], ' +
             'nie raten. Kennzeichnungen wörtlich: [ENTWURF — unvalidiert] · ' +
             '[NEU — Sign-off nötig] · [FREIGEGEBEN DURCH: … / DATUM: …].');
      z.push('- Sprache: Deutsch (Schweiz) — „ss" statt „ß", echte Umlaute im Fliesstext.');
      z.push('- IDs bleiben bei Textänderung bestehen und werden nie wiederverwendet: ' +
             'Lernziel ' + kurs.kursId + '-LZ-###, Eingangskompetenz ' + kurs.kursId + '-EK-###.');
      z.push('- Nur ein Mensch gibt frei; die KI vergibt nie „fertig". Fehlt eine Projektdatei, ' +
             'benenne die Lücke — nicht rekonstruieren.');

      teil('kursbriefing', 'Das freigegebene Kursbriefing');
      if (briefing) {
        z.push('Aus ' + kurs.kursId + '_briefing (Schritt 1). Es ist die Leitplanke für alles ' +
               'Weitere — bei Widerspruch zu einer Annahme gilt das Briefing.');
        z.push('');
        z.push(briefing);
      } else {
        z.push('[FEHLT — in Schritt 1 noch nicht abgelegt. Ohne freigegebenes Kursbriefing ' +
               'nicht mit Schritt 2 beginnen.]');
      }
      return teile;
    },

    /* Die zwei Fassungen. Gleicher Inhalt, andere Verpackung:
       Claude arbeitet mit XML-Tags, ChatGPT mit Trenn-Ueberschriften — dasselbe
       Tool-Tuning, das die Masterprompts schon benutzen. */
    projektInstruktionen: function (i, kurs, briefing, fassung, ordnerName) {
      var teile = inhalt.projektInstruktionenTeile(i, kurs, briefing, ordnerName);
      var kopf = 'Projekt-Instruktionen — Kurs ' + kurs.kursId + ' — ' + kurs.kurstitel +
                 '\nKompetenzfeld: ' + (kurs.kompetenzfeld || 'offen');
      /* Einzige Stelle, an der die Vorrangregel steht (Konvention 9: eine Quelle
         pro Begriff) — nicht zusaetzlich noch einmal unter "Feste Regeln". */
      var arbeitsweise = 'Halte dich in jedem Chat an den jeweiligen Masterprompt UND an diese ' +
             'Instruktionen. Bei Widerspruch gelten diese Instruktionen; benenne den Konflikt, ' +
             'statt ihn still aufzulösen. Bearbeite nur den angeforderten Schritt, nicht ' +
             'vorauseilend den nächsten.';
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
        z.push(arbeitsweise);
        /* Das Eingabefeld der ChatGPT-Projekteinstellungen bricht nicht um;
           Zeilen von 300 Zeichen sind dort unlesbar. Markus am 2026-07-29. */
        return inhalt.umbrechen(z.join('\n'), 100);
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
      z.push(arbeitsweise);
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
