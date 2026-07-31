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

  /* Eine Quelle pro Begriff (CLAUDE.md Konvention 9, Etappe 2 Task 3): der
     FACHQUELLEN-Block ist in briefingPromptKopf (Schritt 1) und
     lernzielePromptKopf (Schritt 2) wortgleich — beide Prompt-Koepfe erben
     dieselbe Erb-Quelle Dossier (d.quellen, d.content_modus). Herausgezogen aus
     briefingPromptKopf, wo der Block seit Etappe 1e Task 5 stand; der Wortlaut
     (inkl. "des Briefings" in der GENAU-Formulierung) bleibt unveraendert, weil
     bestehende Tests genau ihn pruefen — Konsistenz zwischen den zwei Koepfen
     wiegt hier schwerer als ein Schritt-2-genauerer Satz. */
  function fachquellenZeilen(d) {
    var z = [];
    var quellen = d.quellen || [];
    if (d.content_modus === 'quellenfrei') {
      z.push('MODUS QUELLENFREI: reiner KI-Entwurf ohne Fachquellen — das YAML-Feld ' +
             '\'quellen\' bleibt leer; erfinde keine.');
    } else if (quellen.length) {
      z.push('FACHQUELLEN (verbindlich — das YAML-Feld \'quellen\' des Briefings ist ' +
             'GENAU diese Liste, nichts anderes):');
      quellen.forEach(function (q) {
        var kopf = '- ' + q.id + ' · ' + q.titel +
                   (q.herausgeber ? ' (' + q.herausgeber + ')' : '') +
                   ' · Stand: ' + q.stand;
        z.push(q.url
          ? kopf + ' · Link: ' + q.url + ' (abgerufen ' + q.abgerufen + ')'
          : kopf + ' · Datei: ' + q.datei);
      });
    } else {
      z.push('FACHQUELLEN: noch keine erfasst — das YAML-Feld \'quellen\' bleibt leer; ' +
             'erfinde keine.');
    }
    return z;
  }

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
      /* Wo die zuletzt abgelegte Fassung gilt, heisst die neue direkt _final —
         und die bisherige _final wird vorher zurueckgestuft. */
      var letzteGilt = inhalt.letzteGiltAlsFinal(i, schrittId);
      var ziel = {
        ordner: e.ordner,
        datei: letzteGilt
          ? inhalt.finalName(kursId, lief, e.ext)
          : kursId + '_' + lief + '_v' + v + '.' + e.ext,
        version: letzteGilt ? null : v,
        format: e.format
      };
      if (letzteGilt) ziel.zurueckstufen = inhalt.finalZurueckstufen(dateien, kursId, lief);
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
      /* Schritte ohne Gate kennen keinen Abschluss: dort gilt immer die zuletzt
         abgelegte Fassung. Die Sperre wuerde die Arbeit blockieren, statt eine
         Freigabe zu schuetzen, die es nicht gibt. */
      if (inhalt.letzteGiltAlsFinal(i, schrittId)) return null;
      var lief = inhalt.lieferobjektVon(i, schrittId, variante);
      if (!lief) return null;
      return inhalt.finalVorhanden(dateien, kursId, lief);
    },

    /* --- Schritte, in denen die zuletzt abgelegte Fassung die geltende ist ---
       Das Briefing hat kein Gate. Es wird im Lauf des Kurses nachgezogen, und was
       zuletzt hochgeladen wurde, gilt — es traegt deshalb IMMER _final. Damit die
       Aufloesungsregel "final vor hoechster Nummer" nicht zwei geltende Fassungen
       kennt, wandert die bisherige _final vorher auf ihre Versionsnummer zurueck.
       Markus am 2026-07-29: "Da das Briefing kein Gate ist, ist immer die letzte
       Upload-Version die _final." */
    letzteGiltAlsFinal: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      return !!(e && e.letzteGiltAlsFinal);
    },

    /* Was vor dem Ablegen umbenannt werden muss, damit die neue Fassung _final
       heissen kann. Gibt {von, nach} oder null. */
    finalZurueckstufen: function (dateien, kursId, lieferobjekt) {
      var alt = inhalt.finalVorhanden(dateien, kursId, lieferobjekt);
      if (!alt) return null;
      var endung = (/\.([a-z0-9]+)$/i.exec(alt) || [])[1] || 'md';
      var n = inhalt.naechsteVersion(dateien, kursId, lieferobjekt);
      return { von: alt, nach: kursId + '_' + lieferobjekt + '_v' + n + '.' + endung };
    },

    /* Der Zielname beim Ablegen: in solchen Schritten direkt _final. */
    finalName: function (kursId, lieferobjekt, endung) {
      return kursId + '_' + lieferobjekt + '_final.' + (endung || 'md');
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

    /* --- Upload-Strukturpruefung fuer Contract-Excels (T11) ---
       Das Drift-Netz fuer chat-generierte Dateien: eine KI-Excel mit einer
       erfundenen Spalte ging bei AFL-001 unbemerkt durch Gate 1. struktur ist
       die Abschrift aus IT_Architektur_bbz/output/tools/contract-schema.cjs
       (kern[].name/spalten, katalog, steckbrief.name, reihenfolge) — dieselbe
       Form, die state.data.inhalt['ablage-kontrakt'].schritte['2'].struktur
       traegt. Kein Schritt fuehrt sie? Dann gibt es nichts zu pruefen. */
    strukturVon: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      return (e && e.struktur) || null;
    },

    /* Dieselben Regeln wie contract-pruefen.cjs (pruefe()), im Browser ohne
       Abhaengigkeit: unerlaubtes Blatt, fehlendes Pflichtblatt (Kern +
       Steckbrief), Kopfzeilen-Abgleich (woertlich, nur die ersten
       spalten.length Zellen), Blattreihenfolge, Steckbrief zuletzt. Prueft NIE
       Zellinhalte jenseits der Kopfzeile — das bleibt Fachurteil am Gate.
       blaetter kommt aus xlsxLesen.blaetterUndKoepfe(): [{name, kopf}]. Ohne
       struktur (Schritt fuehrt keine) liefert die Funktion null statt eines
       leeren, potenziell falsch als "geprueft und sauber" gelesenen Arrays —
       ein leeres Ergebnis ist nie ein gruenes (contract-pruefen.cjs-Kommentar,
       hier ebenso bindend). */
    strukturPruefe: function (blaetter, struktur) {
      if (!struktur) return null;
      var bl = Array.isArray(blaetter) ? blaetter : [];
      var fehler = [];
      var kern = Array.isArray(struktur.kern) ? struktur.kern : [];
      var katalog = Array.isArray(struktur.katalog) ? struktur.katalog : [];
      var steckbrief = struktur.steckbrief || null;
      var alle = kern.concat(katalog).concat(steckbrief ? [steckbrief] : []);
      var reihenfolge = Array.isArray(struktur.reihenfolge)
        ? struktur.reihenfolge
        : alle.map(function (b) { return b.name; });

      function istErlaubt(name) { return reihenfolge.indexOf(name) >= 0; }
      function blattSchema(name) {
        for (var n = 0; n < alle.length; n++) if (alle[n].name === name) return alle[n];
        return null;
      }
      function rang(name) { var r = reihenfolge.indexOf(name); return r < 0 ? 999 : r; }

      var namen = bl.map(function (b) { return b.name; });

      namen.forEach(function (n) {
        if (!istErlaubt(n)) fehler.push('Unerlaubtes Blatt: ' + n);
      });

      var pflicht = kern.map(function (b) { return b.name; });
      if (steckbrief) pflicht.push(steckbrief.name);
      pflicht.forEach(function (p) {
        if (namen.indexOf(p) < 0) fehler.push('Pflichtblatt fehlt: ' + p);
      });

      bl.forEach(function (b) {
        var s = blattSchema(b.name);
        if (!s || !Array.isArray(s.spalten)) return;
        var kopf = (b.kopf || []).slice(0, s.spalten.length)
          .map(function (c) { return c == null ? '' : String(c).trim(); });
        if (kopf.join('|') !== s.spalten.join('|')) {
          fehler.push('Blatt ' + b.name + ': Kopfzeile weicht vom Schema ab');
        }
      });

      var erlaubteInDatei = namen.filter(istErlaubt);
      var sollFolge = erlaubteInDatei.slice().sort(function (a, b) { return rang(a) - rang(b); });
      if (erlaubteInDatei.join('|') !== sollFolge.join('|')) {
        fehler.push('Blattreihenfolge weicht vom Schema ab');
      }

      if (steckbrief && namen.length && namen[namen.length - 1] !== steckbrief.name) {
        fehler.push('_steckbrief ist nicht das letzte Blatt');
      }

      return fehler;
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
      { id: 'zielgruppe', label: 'Zielgruppe', form: 'text', zeilen: 5, pflicht: true,
        hilfe: 'Rolle, Funktion, Erfahrungsstand — wer sitzt im Kurs?',
        beispiel: 'Kunden- und Anlageberatende mit praktischer Erfahrung im Anlagebereich; keine Mindestzahl an Berufsjahren.' },

      { id: 'vorkenntnisse', label: 'Vorkenntnisse', form: 'text', zeilen: 5, pflicht: true,
        hilfe: 'Was wird vorausgesetzt und deshalb NICHT unterrichtet?',
        beispiel: 'Saubere Risikoprofilierung, Anlagestrategien bestimmen, Basiswissen zu den gängigen Anlageklassen.' },

      { id: 'kurszweck', label: 'Kurszweck', form: 'text', zeilen: 5, pflicht: true,
        hilfe: 'Wozu befähigt der Kurs? Das Leistungsversprechen in ein bis drei Sätzen.',
        beispiel: 'Funktionsweise und Anwendung von Derivaten verstehen, Chancen und Risiken kundengerecht erläutern.' },

      { id: 'praesenz', label: 'Präsenzdauer', form: 'zahl', einheit: 'Tage', schritt: 0.5, pflicht: true,
        hilfe: 'In Tagen. Zwei Halbtage sind 1 Tag.',
        beispiel: '1' },

      { id: 'selbstlern', label: 'Umfang Selbstlernphase', form: 'zahl', einheit: 'Stunden', schritt: 0.5, pflicht: true,
        hilfe: 'In Stunden. Der W-Teil vor der Präsenz.',
        beispiel: '2' },

      { id: 'scope', label: 'Fachlicher Geltungsbereich', form: 'text', zeilen: 6, pflicht: true,
        hilfe: 'Was ist drin? Wenn eine Systematik die Grundlage ist, nenne sie mit Jahrgang.',
        beispiel: 'SSPA Swiss Derivative Map 2025, Kategorien Kapitalschutz, Renditeoptimierung, Partizipation, Hebel.' },

      /* Fester Rahmen, nur Zusätze werden gefragt — Entscheid Markus 2026-07-29.
         Der Rahmen gilt fuer jeden Kurs dieses Hauses; ihn jedes Mal zu erfragen
         erzeugt eine Frage, deren Antwort schon feststeht.

         ziel:'regulatorik' + speicherName (Etappe 1e, Task 6): dieses Feld
         schreibt NICHT nach scope, sondern nach dossier.regulatorik.zusatz —
         die Feld-ID reg_zusatz bleibt unveraendert (sie traegt schon die
         Bedeutung, s. Kommentar bei briefingFelderText weiter unten), nur der
         Ablageort im Dossier aendert sich. dossier.ausWerten() liest ziel und
         speicherName als Daten, ohne inhalt.js zu kennen — eine Quelle fuer
         die Zuordnung, hier, wo auch Label/Hilfe/Beispiel stehen. Der feste
         Rahmen-Satz selbst (oben, fest:) wird NIE ins Dossier geschrieben —
         reine Ansichtssache, damit er nicht in jeder einzelnen dossier.json
         als Kopie herumliegt, die still veralten koennte: die einzige Quelle
         bleibt dieser fest-Text hier. */
      { id: 'reg_zusatz', label: 'Regulatorische Zusätze', form: 'text', zeilen: 4, pflicht: false,
        ziel: 'regulatorik', speicherName: 'zusatz',
        fest: 'Schweizer Markt- und Beratungskontext. FIDLEG, GWG und VSB gelten als Rahmen.',
        hilfe: 'Nur Zusätze oder Abweichungen zum festen Rahmen. Leer lassen, wenn nichts dazukommt.',
        beispiel: 'Rezertifizierung für IK, Affluent, CWMA, KMU, CCoB. Keine FIDLEG-Vertiefung als Kursinhalt.' },

      /* Rechtsstand-Pflichtfeld und SAQ-Häkchen (Entscheide Markus, 2026-07-30,
         Etappe 1e Task 6 — governance-minimal: genau EIN neues Pflichtfeld
         plus EIN Häkchen). Beide gehören zur Regulatorik, nicht zum fachlichen
         Scope, deshalb ziel:'regulatorik' wie beim Zusatz oben. rechtsstand
         braucht speicherName:'stand' — das Schema (dossier.js) nennt den
         Schlüssel stand, nicht die Formular-id; saq_rezert braucht keinen
         eigenen speicherName, die id ist schon der gewünschte Schlüssel. */
      { id: 'rechtsstand', label: 'Rechtsstand', form: 'text', zeilen: 4, pflicht: true,
        ziel: 'regulatorik', speicherName: 'stand',
        hilfe: 'Auf diesen Stand werden alle Zahlen und Aussagen in Schritt 3 belegt.',
        beispiel: '1.1.2026' },

      { id: 'saq_rezert', label: 'SAQ-Rezertifizierung', form: 'haken', pflicht: false,
        ziel: 'regulatorik',
        hilfe: 'Zählt dieser Kurs für die SAQ-Rezertifizierung? Leer lassen heisst nein.' },

      { id: 'ausschluesse', label: 'Bewusste Ausschlüsse', form: 'text', zeilen: 5, pflicht: true,
        hilfe: 'Was ausdrücklich NICHT Teil ist. Begrenzt den Content-Umfang stärker als jede Positivliste.',
        beispiel: 'Theoretische und rechtliche Deep Dives; vertiefte Optionsbewertung; Anlageprodukte mit zusätzlichem Kreditrisiko.' },

      /* Z4 (Zusatzauftrag 2026-07-30 Punkt 6, Entscheid Markus: "Jede hinterlegte
         Quelle ist Scope."): kein Freitext-Eingabefeld mehr — Live-Beweis der
         Fehlerklasse an VL-002, wo ein von Hand getippter Bereich ("Q-001 bis
         Q-014") still veraltete, als Q-015 dazukam. form:'abgeleitet' traegt
         statt eines Formularfelds den Hook abgeleitet(d): EINE Funktion, die
         sowohl die Anzeige (ansichten.js, briefingFormular) als auch der
         zentrale Schreib-Stempel (app.js, _dossierVersuch, Muster
         identitaetSetzen) aufrufen — Konvention 9, eine Quelle pro Begriff,
         damit Anzeige und Gespeichertes nie auseinanderlaufen. Pflicht ist das
         Feld bewusst nicht mehr (wie 'haken', s. briefingFehlend): der
         abgeleitete Satz ist immer eine vollstaendige Antwort, auch wenn er
         "Noch keine Quellen erfasst" lautet. Kein Netz, kein Date, kein
         dossier.js-Zugriff hier drin (inhalt.js kennt dossier.js nicht, wie
         schon bei fachquellenZeilen) — nur die Felder von d selbst.

         Fix-Runde Z4 (Review-Finding, Important): ein Bereich "{erste} bis
         {letzte}" behauptet Lueckenlosigkeit, die es nicht gibt — Q-IDs werden
         NICHT neu vergeben (quelleEntfernen, s. dossier.js), nach dem Entfernen
         von Q-002 waere "Q-001 bis Q-003" falsch, weil es eine Quelle
         einschliesst, die nicht mehr existiert: exakt die Fehlerklasse, die
         Z4 beseitigen soll, nur einen Schritt spaeter. Der Hook zaehlt die
         tatsaechlichen IDs deshalb einzeln auf, nie einen Bereich. */
      { id: 'scope_quelle', label: 'Quelle des Scopes', form: 'abgeleitet', pflicht: false,
        hilfe: 'Wird automatisch aus dem erfassten Quellenbestand abgeleitet (Q-001, Q-002 …) — ' +
          'kein Eingabefeld mehr: jede erfasste Quelle ist Scope (Entscheid Markus 2026-07-30, Z4).',
        abgeleitet: function (d) {
          if (d && d.content_modus === 'quellenfrei') {
            return 'Modus quellenfrei — kein Quellen-Scope, der Content entsteht ohne Fachquellen.';
          }
          var quellen = (d && Array.isArray(d.quellen)) ? d.quellen.filter(function (q) { return q && q.id; }) : [];
          if (!quellen.length) return 'Noch keine Quellen erfasst.';
          var ids = quellen.map(function (q) { return q.id; });
          var zahl = ids.length === 1 ? '1 Quelle' : ids.length + ' Quellen';
          return 'Der erfasste Quellenbestand ist der Scope: ' + ids.join(', ') + ' (' + zahl + ').';
        } },
    ],

    briefingFeld: function (id) {
      return inhalt.BRIEFING_FELDER.filter(function (f) { return f.id === id; })[0] || null;
    },

    /* Welche Pflichtfelder noch leer sind. Leere Liste heisst: das Formular traegt.
       Ein Haekchen zaehlt NIE als offen (Etappe 1e, Task 6): ein Kaestchen kennt
       kein "leer" — nicht angehakt ist eine vollstaendige Antwort (nein), keine
       fehlende. Aktuell ist ohnehin kein Haken-Feld Pflicht; die Ausnahme steht
       trotzdem hier, nicht als Zufallsergebnis von pflicht:false.
       Ebenso ein form:'abgeleitet'-Feld (Z4, scope_quelle): es ist immer
       ableitbar, selbst als "Noch keine Quellen erfasst" — nie ein Fehlen. */
    briefingFehlend: function (werte) {
      werte = werte || {};
      return inhalt.BRIEFING_FELDER
        .filter(function (f) {
          return f.pflicht && f.form !== 'haken' && f.form !== 'abgeleitet' && !String(werte[f.id] || '').trim();
        })
        .map(function (f) { return f.label; });
    },

    /* Die Formularwerte AUS dem Dossier — die Ruecklesung zu dossier.ausWerten(),
       ueber dieselbe ziel/speicherName-Zuordnung der BRIEFING_FELDER-Eintraege
       (Etappe 1e, Task 6): ein Feld mit ziel:'regulatorik' liest aus
       d.regulatorik statt aus d.scope, unter speicherName (oder der eigenen id).
       EINE Stelle fuer diese Zuordnung in beide Richtungen — Schreiben
       (dossier.ausWerten) und Lesen (hier) koennen so nie auseinanderlaufen.
       Ein Haken-Feld kommt als String 'true'/'false' zurueck, damit das Formular
       (data-feld, String-Vergleich) es wie jedes andere Feld behandelt. */
    briefingWerteAusDossier: function (d) {
      var scope = (d && d.scope) || {};
      var regulatorik = (d && d.regulatorik) || {};
      var werte = {};
      inhalt.BRIEFING_FELDER.forEach(function (f) {
        var quelle = (f.ziel === 'regulatorik') ? regulatorik : scope;
        var name = f.speicherName || f.id;
        var v = quelle[name];
        if (f.form === 'haken') { werte[f.id] = v ? 'true' : 'false'; return; }
        if (v != null) werte[f.id] = v;
      });
      return werte;
    },

    /* --- Datei 01_briefing/{K}_briefing-felder.md ---
       Menschenlesbar UND maschinenlesbar: Abschnitte "## <id> · <Label>". Die ID
       traegt die Bedeutung, das Label ist fuer Menschen. Wer das Label aendert,
       zerstoert damit keine bestehende Datei. */
    /* Nur noch vom Einmal-Import gelesen? Nein: wird gar nicht mehr gerufen —
       Kandidat fuers Aufraeumen. */
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
       mehr. Leere Felder werden ausdruecklich benannt, damit sie nicht erfunden
       werden — und der Schlusssatz sagt, was zu tun ist. Am 29.07. lieferte die
       erste Fassung fuenf Fragerunden, weil er stattdessen zum Suchen einlud
       ("deine Entscheidliste enthaelt, was dir auffaellt").

       Erb-Quelle Dossier (Etappe 1e, Task 5, Audit A/F1/M4, Entscheid 1): das
       optionale dritte Argument d ist das geladene Kursdossier. Die Quellenliste
       ist NIE formular-editierbar — sie kommt ausschliesslich aus d.quellen,
       damit der Chat sie nicht anders liest als die App sie zeigt (dieselbe
       Formatierung wie in projektInstruktionen, s. u.). Der Rechtsstand
       dagegen bleibt ein Formularfeld (werte.rechtsstand, aus BRIEFING_FELDER,
       ziel:'regulatorik') — der Merge in controller._formularWerteMergen()
       gibt dem getippten Wert bereits Vorrang vor der Dossier-Basis, hier kommt
       nur die zusaetzliche Bauanweisung fuers YAML-Feld dazu — und nur, wenn
       werte.rechtsstand ueberhaupt gesetzt ist (Fix-Runde 1, Review-Finding):
       ist das Feld leer, steht es ohnehin schon unter NICHT ANGEGEBEN, eine
       Bauanweisung daneben verwiese auf eine nicht existierende Angabe. Ohne d
       (kein Dossier geladen, z. B. bestehende Aufrufer/Tests) bleibt das
       Verhalten exakt wie zuvor — der ganze Block entfaellt. */
    briefingPromptKopf: function (kurs, werte, d) {
      werte = werte || {};
      var z = [];
      z.push('=== ANGABEN AUS DER KURSWERKSTATT ===');
      z.push('Diese Werte sind gesetzt. Übernimm sie. Frage sie NICHT erneut ab, rechne sie');
      z.push('nicht um und bewerte sie nicht.');
      z.push('');
      z.push('Kurs: ' + (kurs && kurs.kursId || '?') + ' — ' + (kurs && kurs.kurstitel || '?'));
      z.push('Kompetenzfeld: ' + (kurs && kurs.kompetenzfeld || '?'));
      var offen = [];
      inhalt.BRIEFING_FELDER.forEach(function (f) {
        /* Ein Haekchen (form:'haken') ist NIE offen (C-NEU-1, Fix-Runde Final):
           `String(werte[f.id] || '')` behandelte ein echtes Bool false wie leer
           (false || '' wird zu '', weil false selbst falsy ist) und meldete den
           Normalfall "nicht angehakt" faelschlich als NICHT ANGEGEBEN; ein
           echtes true landete umgekehrt als englisches 'true' im Prompttext.
           Muster wie projektInstruktionen (s. o., regulatorik.saq_rezert ?
           'ja' : 'nein') — hier zusaetzlich robust gegen den String 'true'/
           'false', den briefingWerteAusDossier() fuer ein Haken-Feld liefert. */
        if (f.form === 'haken') {
          var an = (werte[f.id] === true) || (werte[f.id] === 'true');
          z.push(f.label + ': ' + (an ? 'ja' : 'nein'));
          return;
        }
        /* Ein form:'abgeleitet'-Feld (Z4, scope_quelle) ist NIE offen — es wird
           live aus d berechnet, nie aus werte gelesen: werte kennt es gar nicht
           mehr (kein Formularfeld), und der gesicherte Dossier-Stand koennte
           zwischen zwei Schreibvorgaengen veraltet sein. Ohne d (kein Dossier
           geladen) liefert abgeleitet(undefined) den Leer-Fall — sicher, kein
           Erfinden. */
        if (f.form === 'abgeleitet') {
          z.push(f.label + ': ' + (f.abgeleitet ? f.abgeleitet(d) : ''));
          return;
        }
        var v = String(werte[f.id] || '').trim();
        var fest = f.fest ? f.fest + (v ? ' ' + v : '') : v;
        if (!v && !f.fest) { offen.push(f.label); return; }
        z.push(f.label + (f.einheit ? ' (' + f.einheit + ')' : '') + ': ' + fest);
      });
      z.push('');
      if (d) {
        z.push.apply(z, fachquellenZeilen(d));
        if (String(werte.rechtsstand || '').trim()) {
          z.push('Das YAML-Feld \'rechtsstand\' ist GENAU aus der Angabe „Rechtsstand" oben zu ' +
                 'bauen, nicht aus einem anderen Datum.');
        }
        z.push('');
      }
      if (offen.length) {
        z.push('NICHT ANGEGEBEN: ' + offen.join(', ') + '.');
        z.push('Frage danach — höchstens drei Zeilen — und schreibe auf die Antwort das Briefing.');
      } else {
        z.push('ALLE FELDER SIND AUSGEFÜLLT. Schreibe jetzt das Briefing. Keine Rückfrage,');
        z.push('keine Feldübersicht, keine Liste. Nur die Datei.');
      }
      z.push('=== ENDE DER ANGABEN ===');
      z.push('');
      return z.join('\n');
    },

    /* Prompt-Kopf fuer Schritt 2 (Lernziele-Drehbuch), Etappe 2 Task 3 — dasselbe
       Prinzip wie briefingPromptKopf: Angaben, die die App schon hat, muss der
       Chat nicht erfragen. Schritt 2 startet erst NACH einem freigegebenen
       Briefing (s. ansichten.einSchritt, Kein-freigegebenes-Briefing-Kasten) —
       Titel/Kompetenzfeld (aus KWKurse, kurs), Rechtsstand/Zusatz/SAQ und die
       Fachquellenliste (aus dem Dossier, d) stehen zu diesem Zeitpunkt bereits
       fest, keines davon ist hier ein Formularfeld. Ohne Dossier (kein d) gibt
       es keinen Kopf — ohne Dossier ist Schritt 1 nie durchlaufen worden.

       Drittes, optionales Argument extras (T13, VL-002-Fund
       2026-07-30, Entscheid Markus "es muss IMMER von Beginn funktionieren"):
       im Live-Einsatz fragte der Chat nach dem Briefing-Dateinamen und setzte
       version=1, obwohl v1-v5 im Ordner lagen — beides weiss die App bereits
       aus den dateien-Caches, die die Schritt-2-Ansicht ohnehin laedt
       (ordnerNachladen fuer den Schritt-2-Ordner, briefingNachladen fuer
       01_briefing). extras = { version, basiertAuf } wird von app.js aus genau
       diesen Caches berechnet — ueber die bestehenden, einzigen Quellen
       inhalt.naechsteVersion()/inhalt.geltendeDatei(), nicht neu erfunden hier
       (Konvention 9: eine Quelle pro Begriff). Fehlt ein Cache, bleibt das
       jeweilige Feld in extras schlicht weg — die Funktion rät nie, sie
       schreibt nur, was ihr mitgegeben wird. Die PROJEKT-WISSEN-Zeile braucht
       kein extras: sie kommt wie FACHQUELLEN direkt aus d.quellen (Datei-Quellen
       ohne url) — dieselbe Erb-Quelle Dossier, kein zweiter Weg dorthin. */
    lernzielePromptKopf: function (kurs, d, extras) {
      if (!d) return '';
      extras = extras || {};
      var z = [];
      z.push('=== ANGABEN AUS DER KURSWERKSTATT ===');
      z.push('Diese Werte sind gesetzt. Übernimm sie. Frage sie NICHT erneut ab, rechne sie');
      z.push('nicht um und bewerte sie nicht.');
      z.push('');
      z.push('Kurs: ' + (kurs && kurs.kursId || '?') + ' — ' + (kurs && kurs.kurstitel || '?'));
      z.push('Kompetenzfeld: ' + (kurs && kurs.kompetenzfeld || '?'));
      var regulatorik = d.regulatorik || {};
      z.push('Rechtsstand: ' + (regulatorik.stand || 'NICHT ANGEGEBEN'));
      if (String(regulatorik.zusatz || '').trim()) {
        z.push('Zusatz: ' + regulatorik.zusatz);
      }
      z.push('SAQ-Rezertifizierung: ' + (regulatorik.saq_rezert ? 'ja' : 'nein'));
      /* Version/basiert_auf — nur, wenn app.js sie aus einem frischen
         dateien-Cache mitgibt (s. Kommentar oben). Feldnamen wie im
         Steckbrief-Schema (Prozess-Spec §3): version, basiert_auf. */
      if (typeof extras.version === 'number') {
        z.push('');
        z.push('Version des Lieferobjekts: ' + extras.version + '.');
        z.push('Setze im YAML-Feld \'version\' des _steckbrief GENAU diese Zahl, keine andere.');
      }
      if (extras.basiertAuf) {
        z.push('');
        z.push('basiert_auf: ' + extras.basiertAuf);
        z.push('Setze im YAML-Feld \'basiert_auf\' des _steckbrief GENAU diesen Dateinamen.');
      }
      z.push('');
      z.push.apply(z, fachquellenZeilen(d));
      /* PROJEKT-WISSEN (T13): nur Datei-Quellen — eine Link-Quelle wird direkt
         aufgerufen, nicht als Ablage im Projekt-Wissen erwartet. Muster wie
         dossier.positivliste(), hier ohne Abhaengigkeit zu dossier.js erneut
         gebildet (inhalt.js kennt dossier.js bewusst nicht, s. app.js-Aufrufer
         fuer die uebrigen Dossier-Funktionen). Ohne Dossier keine Zeile — kein
         zweiter if(d)-Zweig noetig, wir sind schon hinter dem fruehen return. */
      var projektWissen = (d.quellen || []).map(function (q) { return q.datei; }).filter(Boolean);
      if (projektWissen.length) {
        z.push('');
        z.push('PROJEKT-WISSEN: Diese Datei-Quellen müssen im Projekt-Wissen liegen: ' +
               projektWissen.join('; ') + '.');
        z.push('Fehlt dir eine davon: nenne sie in der Phase-1-Frageliste — lies nie eine ' +
               'andere an ihrer Stelle.');
      }
      z.push('');
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

    /* Die Gates liegen seit der Acht-Schritte-Reform (2026-07-29) bei 2, 4 und 7
       (s. CLAUDE.md "Kein `_final` auf Nicht-Gate-Schritten"). Die Slugs sind
       die Adressaten der offen[]-Punkte (dossier.ZIELE) — EINE Stelle statt
       einer Ableitung an jeder Aufrufstelle. */
    gateAdressat: function (schrittId) {
      return ({ '2': 'gate-1', '4': 'sign-off', '7': 'gate-2' })[String(schrittId)] || null;
    },

    /* Der Name des Gate-Protokolls neben der Datei — EINE Stelle statt eines
       Literals an jeder Aufrufstelle (bereits vorher an dieser Stelle als
       Inline-Fallback gelesen, s. projektInstruktionenTeile oben; Etappe 2
       Task 6 zieht ihn als Helfer heraus, damit controller.gateKlick nicht
       ein zweites Mal '_gate.md' hartkodiert). */
    gateDatei: function (i) {
      var k = (i && i['ablage-kontrakt']) || {};
      return k.gate_datei || '_gate.md';
    },

    /* Das Gate-Protokoll (Ablage-Kontrakt §5) — reine Funktion, kein Date
       hier drin: datum kommt als Parameter herein, der Controller ruft
       new Date() nie inhalt.js. p = { gate, kursId, von, nach, datum, person,
       zweitpruefung, geprueft, offen }. geprueft ist eine Liste von Zeilen
       (optional, leer bleibt nicht ohne Zeile — '—' markiert "nichts
       Ausdrueckliches vermerkt"); offen ist die Liste der zum Freigabezeitpunkt
       noch offenen Punkte (dossier.offenFuer o.ae.), 'keine' wenn leer. */
    gateProtokoll: function (p) {
      var z = [
        '# ' + p.gate + ' — ' + p.kursId, '',
        'Freigegeben:  ' + p.von,
        'Umbenannt in: ' + p.nach,
        'Datum:        ' + p.datum + ', ' + p.person,
        'Zweitprüfung: ' + p.zweitpruefung, '',
        'Geprüft:'
      ];
      ((p.geprueft && p.geprueft.length) ? p.geprueft : ['—']).forEach(function (g) { z.push('- ' + g); });
      z.push('', 'Offene Punkte:');
      if (p.offen && p.offen.length) {
        p.offen.forEach(function (o) {
          z.push('- ' + o.was + ' (' + o.wo + ') — an ' + o.fuer +
                 (o.begruendung ? ': ' + o.begruendung : ''));
        });
      } else z.push('- keine');
      return z.join('\n') + '\n';
    },

    /* Wohin Fachquellen kommen (Schritt 1) — EINE Stelle statt drei getippter
       (Audit I3). Vorher stand '03_content/quellen' woertlich in app.js
       (QUELLEN_ORDNER), im UI-Hinweistext von ansichten.js und im
       Instruktionstext hier — geaendert haette sich nur einer davon, wenn der
       Schritt-3-Ordner im Kontrakt sich aendert. Jetzt lesen alle drei von
       hier: der Ordner aus schritte['3'] plus '/quellen'. Fallback
       '03_content/quellen', falls der Kontrakt (noch) keinen Schritt 3 fuehrt. */
    quellenOrdner: function (i) {
      var k = (i && i['ablage-kontrakt']) || {};
      var s3 = (k.schritte || {})['3'] || {};
      return (s3.ordner || '03_content') + '/quellen';
    },

    /* --- Der Quellen-Spiegel-Waechter (Z7, Live-Befund VL-002, 2026-07-31) ---
       Zweimal live beobachtet: das Dossier bekam eine neue Quelle, aber das
       abgelegte Briefing (der Frontmatter-Spiegel, den die KI daraus schreibt)
       trug still die alten Quellen — niemand sah es, bis die KI-Ausgabe
       Widersprueche zeigte. quellenSpiegel(text, d) vergleicht per Q-ID
       (Regex \bQ-\d{3}\b ueber den ganzen Dokumenttext), NIE per Zeilen-Syntax:
       ein Briefing, das dieselbe Quelle mit einem anderen Trennzeichen, in
       YAML-Frontmatter oder mitten im Fliesstext nennt, zaehlt trotzdem als
       gespiegelt, solange die Q-ID irgendwo im Text vorkommt. Links und
       Datei-Quellen zaehlen gleich — jede Quelle hat eine Q-ID, die Art der
       Quelle spielt fuer den Spiegel-Check keine Rolle.

       text == null heisst "keine Aussage moeglich" (Briefing laedt noch oder
       wurde noch nicht nachgesehen) — die Ansicht zeigt dafuer bereits einen
       eigenen Hinweis (briefing == null, s. instruktionenBlock in ansichten.js);
       dieser Check darf nicht zusaetzlich mitreden. Ein leerer String ('' —
       nachgesehen, nichts gefunden) liefert dagegen ein echtes Ergebnis: alle
       Quellen gelten dann als fehlend, was inhaltlich stimmt, auch wenn die
       Ansicht dafuer aus gutem Grund den bestehenden "Kein freigegebenes
       Briefing"-Kasten zeigt statt diesen hier (s. ansichten.js).

       Der Contract-Steckbrief (xlsx, Schritt 2) ist im Browser nicht lesbar —
       diese Funktion prueft bewusst NUR das Briefing. Der Contract-Spiegel
       (Steckbrief gegen Dossier) laeuft ueber contract-pruefen/T11, nicht
       hier. */
    quellenSpiegel: function (text, d) {
      if (text == null) return null;
      var quellen = (d && d.quellen) || [];
      var gefunden = {};
      var re = /\bQ-\d{3}\b/g;
      var t = String(text);
      var m;
      while ((m = re.exec(t))) gefunden[m[0]] = true;
      var fehlend = quellen
        .map(function (q) { return q.id; })
        .filter(function (id) { return id && !gefunden[id]; });
      return { fehlend: fehlend, gesamt: quellen.length };
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
    projektInstruktionenTeile: function (i, kurs, briefing, ordnerName, d) {
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
      z.push('Gate-Protokolle liegen als ' + inhalt.gateDatei(i) + ' neben der ' +
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

      /* Die Fachquellen-Positivliste (Dossier, Schritt 1). Ohne Dossier bleibt dieser
         Teil ganz weg — Verhalten wie vor dem Dossier, kein Bruch fuer bestehende Aufrufer. */
      if (d) {
        teil('quellen', 'Fachquellen des Kurses');
        if (d.content_modus === 'quellenfrei') {
          z.push('Dieser Kurs läuft im Modus QUELLENFREI: es liegen keine validen Fachquellen ' +
                 'vor, der Content entsteht als reiner KI-Entwurf und wird in Schritt 4 ' +
                 'entsprechend strenger validiert. Erfinde keine Quellenangaben.');
        } else if ((d.quellen || []).length) {
          z.push('Massgebend sind AUSSCHLIESSLICH diese Quellen (Dateien in ' +
                 inhalt.quellenOrdner(i) + '/, Links direkt aufrufen). Keine anderen Quellen ' +
                 'beiziehen, keine erfinden; jede gehört in die Leseliste:');
          d.quellen.forEach(function (q) {
            var kopf = '- ' + q.id + ' · ' + q.titel +
                       (q.herausgeber ? ' (' + q.herausgeber + ')' : '') +
                       ' · Stand: ' + q.stand;
            z.push(q.url
              ? kopf + ' · Link: ' + q.url + ' (abgerufen ' + q.abgerufen + ')'
              : kopf + ' · Datei: ' + q.datei);
          });
        } else {
          z.push('Noch keine Fachquellen erfasst. Vor Schritt 3 in der Kurswerkstatt erfassen ' +
                 'oder den Modus quellenfrei setzen — nicht selbst welche wählen.');
        }
        /* Projekt-Wissen-Regeln (Etappe 2, Task Z6/Z8; Zusatzauftrag Punkt 8 +
           Live-Befund VL-002, 2026-07-30): ein Claude-/ChatGPT-Projekt hat KEINEN
           Zugriff auf SharePoint — eine Datei-Quelle ist fuer den Chat nur lesbar,
           wenn sie zusaetzlich als Projekt-Wissen in genau diesem Projekt hochgeladen
           wurde. Das stand bisher nirgends, obwohl "AUSSCHLIESSLICH diese Quellen"
           oben genau das voraussetzt.
           Fix-Runde 1 (Review): Satz 1 ist eine Ist-Behauptung ("Die Datei-Quellen
           liegen als Projekt-Wissen ...") — die darf nur stehen, wenn es ueberhaupt
           eine Datei-Quelle gibt. Unconditional kollidierte er im Modus quellenfrei
           mit "es liegen keine validen Fachquellen vor" und behauptete bei leerer
           oder reiner Link-Liste einen Bestand, den es nicht gibt — genau in dem
           Modus, der Halluzination verhindern soll. Die Filterung ist dieselbe wie
           bei der PROJEKT-WISSEN-Zeile in lernzielePromptKopf (Task T13): inhalt.js
           baut sie bewusst selbst aus d.quellen, statt dossier.positivliste() zu
           rufen — inhalt.js kennt dossier.js nirgends (s. Kommentar dort). Regel 2
           (eine nicht gelistete Datei im Projekt-Wissen melden) und Regel 3 (Dossier
           ist massgebend, Nachziehpflicht) sind reine Verhaltensregeln ohne
           Ist-Behauptung und bleiben deshalb unconditional — eine Karteileiche im
           Projekt-Wissen (Punkt 8b) ist auch im Modus quellenfrei oder ganz ohne
           erfasste Quellen ein Risiko. */
        var dateiQuellen = (d.quellen || []).map(function (q) { return q.datei; }).filter(Boolean);
        if (dateiQuellen.length) {
          z.push('Die Datei-Quellen liegen als Projekt-Wissen in diesem Projekt. Fehlt dir eine ' +
                 'davon, sag es — lies nie eine andere an ihrer Stelle.');
        }
        z.push('Liegt im Projekt-Wissen eine Datei, die NICHT in dieser Quellenliste steht: ' +
               'nutze sie nicht, sondern melde sie — sie gehört zuerst in der Kurswerkstatt ' +
               'erfasst.');
        z.push('Diese Instruktionen und das Projekt-Wissen sind ein Abzug des Kursdossiers. ' +
               'Massgebend ist immer das Dossier — nach jeder Quellen-Änderung werden ' +
               'Instruktionen und Projekt-Wissen neu übernommen.');
        /* Rechtsstand/SAQ (Etappe 1e, Task 6): steht im selben Teil wie die
           Fachquellen — beides sind Angaben aus dem Dossier, beide fehlen ganz,
           solange kein Dossier vorliegt (derselbe if (d) wie oben, keine zweite
           Bedingung dafuer). regulatorik.stand ist im Dossier nicht erzwungen
           (alte Dossiers haben keins) — hier steht dafuer ausdruecklich
           [OFFEN], nie ein erfundenes Datum. */
        var regulatorik = d.regulatorik || {};
        z.push('Rechtsstand: ' + (regulatorik.stand ? regulatorik.stand : '[OFFEN]') +
               ' · SAQ-Rezertifizierung: ' + (regulatorik.saq_rezert ? 'ja' : 'nein'));
      }

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
    projektInstruktionen: function (i, kurs, briefing, fassung, ordnerName, d) {
      var teile = inhalt.projektInstruktionenTeile(i, kurs, briefing, ordnerName, d);
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
