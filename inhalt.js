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

  /* Eine Quelle fuer die Q-ID-Wortgrenzen-Regel (Konvention 9 / Etappe-3-
     Global-Constraints: "Q-ID-Regex ... je genau eine Stelle"). quellenSpiegel
     (Z7) und blocksPruefe (B5, ersetzt skriptPruefe/A2) muessen exakt
     dieselbe Regel verwenden — sonst zaehlt "Q-0158" in der einen Pruefung
     als Treffer fuer Q-015 und in der anderen nicht. \bQ-\d{3}\b: ein
     Wortgrenzen-Regex, global ueber den ganzen Text, liefert eine Map
     { 'Q-001': true, ... } der GEFUNDENEN IDs. */
  function qIds(text) {
    var re = /\bQ-\d{3}\b/g;
    var gefunden = {};
    var t = String(text == null ? '' : text);
    var m;
    while ((m = re.exec(t))) gefunden[m[0]] = true;
    return gefunden;
  }

  /* Lazy-Accessor (Muster S() in skript-lesen.js/docx-bauen.js, Z() in
     xlsx-lesen.js): root.skriptSchema ist gesetzt, sobald skript-schema.js
     vorher geladen/ge-required wurde. blocksPruefe() braucht nur
     SCHEMA.budget.hartMin — der Aufruf ist lazy (erst beim Pruefen, nicht
     beim Laden von inhalt.js), deshalb spielt die Script-Tag-Reihenfolge in
     index.html (inhalt.js steht dort VOR skript-schema.js) keine Rolle: bis
     zum ersten echten Aufruf sind alle Script-Tags laengst ausgefuehrt. */
  function S() {
    if (root.skriptSchema) return root.skriptSchema;
    if (typeof module !== 'undefined' && module.exports) return require('./skript-schema.js').skriptSchema;
    throw new Error('skript-schema.js nicht geladen');
  }

  /* V2 (Etappe 4): Baustein-Namen, die reine Steuerdaten tragen — VALIDIERUNG
     (Herkunft/Beleg/Divergenz-Feldsyntax) und ILLUSTRATION (Bild-Regie-
     Feldsyntax), kein Fliesstext, den ein Mensch liest. Eine Stelle
     (Konvention 9): das Wortbudget (kapitelWortzahl) UND die Baustein-
     Zaehlung der Regressionsbremse (nichtLeereBausteine, validierungPruefe
     Regel 4a) nutzen dieselbe Ausschlussliste — Steuerdaten sind kein Content
     (V1-Review-Minor, hier geschlossen, s. CLAUDE.md "Task V2"). */
  var STEUER_BAUSTEINE = { VALIDIERUNG: true, ILLUSTRATION: true };

  /* Woerter eines Kapitels ueber alle NICHT-Steuer-Bausteine — eine Stelle
     fuer blocksPruefe (Schritt 3) UND validierungPruefe (Schritt 4). */
  function kapitelWortzahl(k) {
    var teile = (k && k.teile) || {};
    return Object.keys(teile).reduce(function (n, name) {
      if (STEUER_BAUSTEINE[name]) return n;
      var t = String(teile[name] || '').trim();
      return n + (t ? t.split(/\s+/).length : 0);
    }, 0);
  }

  /* Marker-Verbot (E6) — eine Stelle fuer blocksPruefe UND validierungPruefe:
     [ZU PRÜFEN darf in keinem Baustein-Text stehen — offene Punkte gehoeren
     gesammelt in ###OFFEN, nicht verstreut ueber die Kapitel. */
  function markerVerbotPruefe(kapitel, fehler) {
    kapitel.forEach(function (k) {
      var teile = k.teile || {};
      Object.keys(teile).forEach(function (name) {
        if (/\[ZU PR(Ü|UE)FEN/i.test(String(teile[name]))) {
          fehler.push('Kapitel ' + (k.ek || '?') + ': Marker "[ZU PRÜFEN" in ###' + name +
                       ' gefunden — offene Punkte gehören gesammelt in ###OFFEN.');
        }
      });
    });
  }

  /* Wortbudget je Kapitel (SCHEMA.budget.hartMin) — eine Stelle fuer
     blocksPruefe UND validierungPruefe. */
  function wortbudgetPruefe(kapitel, fehler, hartMin) {
    kapitel.forEach(function (k) {
      var worte = kapitelWortzahl(k);
      if (worte < hartMin) {
        fehler.push('Kapitel ' + (k.ek || '?') + ': Wortbudget ' + worte + ' Wörter unter ' +
                     'dem Minimum von ' + hartMin + '.');
      }
    });
  }

  /* Zahl der nicht-leeren INHALTS-Bausteine eines Kapitels (validierungPruefe
     Regel 4a) — dieselbe Steuerdaten-Ausschlussliste wie kapitelWortzahl. */
  function nichtLeereBausteine(k) {
    var teile = (k && k.teile) || {};
    return Object.keys(teile).filter(function (name) {
      if (STEUER_BAUSTEINE[name]) return false;
      return String(teile[name] || '').trim() !== '';
    }).length;
  }

  /* Ziffern-Zahlen in einem Text zaehlen (validierungPruefe Regel 4b) — eine
     Zahl darf ein Tausendertrennzeichen tragen (Punkt ODER Apostroph, z. B.
     34'128 oder 3.5) und zaehlt dabei als EINE Zahl, nicht mehrere.
     Oeffentlich (inhalt.zahlenImText) — validierungPruefe und ein eigener
     Test brauchen denselben Zaehler (Konvention 9). */
  function zahlenImText(text) {
    var t = String(text == null ? '' : text);
    var m = t.match(/\d+(?:[.']\d+)*/g);
    return m ? m.length : 0;
  }

  /* Ein Kapitel einer Variante ueber die EK-ID finden (validierungPruefe
     Regel 4) — fehlt es, zaehlt die Variante mit 0 (Brief: "hat eine
     Variante kein Kapitel zu dieser EK, zaehlt ihr Wert 0"). */
  function kapitelZuEk(gelesenVariante, ek) {
    var liste = (gelesenVariante && Array.isArray(gelesenVariante.kapitel)) ? gelesenVariante.kapitel : [];
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].ek === ek) return liste[i];
    }
    return null;
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

  /* Eine Quelle pro Begriff (A3, Etappe 3 — zweiter Aufrufer neben
     lernzielePromptKopf): Rechtsstand/Zusatz/SAQ, herausgezogen aus
     lernzielePromptKopf, wo der Block seit Etappe 2 stand. Wortlaut
     unveraendert — bestehende Tests (test/lernzielekopf.test.js) pruefen
     genau ihn. */
  function regulatorikZeilen(d) {
    var z = [];
    var regulatorik = d.regulatorik || {};
    z.push('Rechtsstand: ' + (regulatorik.stand || 'NICHT ANGEGEBEN'));
    if (String(regulatorik.zusatz || '').trim()) {
      z.push('Zusatz: ' + regulatorik.zusatz);
    }
    z.push('SAQ-Rezertifizierung: ' + (regulatorik.saq_rezert ? 'ja' : 'nein'));
    return z;
  }

  /* Eine Quelle pro Begriff (A3, Etappe 3 — zweiter Aufrufer neben
     lernzielePromptKopf): die PROJEKT-WISSEN-Zeile (T13), herausgezogen aus
     lernzielePromptKopf. Nur Datei-Quellen — eine Link-Quelle steht schon im
     FACHQUELLEN-Block und wird direkt aufgerufen, nicht als Ablage im
     Projekt-Wissen erwartet. Wortlaut unveraendert. */
  function projektWissenZeilen(d) {
    var z = [];
    var projektWissen = (d.quellen || []).map(function (q) { return q.datei; }).filter(Boolean);
    if (projektWissen.length) {
      z.push('');
      z.push('PROJEKT-WISSEN: Diese Datei-Quellen müssen im Projekt-Wissen liegen: ' +
             projektWissen.join('; ') + '.');
      z.push('Fehlt dir eine davon: nenne sie in der Phase-1-Frageliste — lies nie eine ' +
             'andere an ihrer Stelle.');
    }
    return z;
  }

  /* K1 (Etappe 4): das Briefing wortwoertlich eingebettet macht die ChatGPT-
     Fassung >15'000 Zeichen lang — zu lang fuer das 8000-Zeichen-Instruktions-
     feld eines ChatGPT-Projekts (Live-Befund). Die Kompaktfassung ersetzt
     darum NUR den kursbriefing-Teil durch einen Verweis auf die Projekt-
     Wissen-Datei (projektWissenDateiname); die Datei selbst traegt weiterhin
     den Volltext (projektInstruktionenLang). teileKompakt() ist die EINE
     Stelle, an der diese Ersetzung passiert — Kopieren (Ansicht) und
     Herunterladen (app.js) rufen beide projektInstruktionen()/
     projektInstruktionenLang(), nie eine eigene Kuerzungslogik. */
  function teileKompakt(teile, kurs) {
    return teile.map(function (t) {
      if (t.tag !== 'kursbriefing') return t;
      return {
        tag: t.tag,
        titel: t.titel,
        zeilen: [
          'Das freigegebene Kursbriefing (Volltext) liegt in der Projekt-Wissen-Datei ' +
          inhalt.projektWissenDateiname(kurs) + '. Lies sie zu Beginn jedes Chats; bei ' +
          'Widerspruch zwischen diesen Instruktionen und der Datei gilt die Datei.'
        ]
      };
    });
  }

  /* Kopf und Vorrangregel sind fuer alle drei Renderformen (Claude, ChatGPT-
     kompakt, ChatGPT-lang) identisch — eine Quelle statt dreier Kopien
     (Konvention 9). */
  function kopfUndArbeitsweise(kurs) {
    return {
      kopf: 'Projekt-Instruktionen — Kurs ' + kurs.kursId + ' — ' + kurs.kurstitel +
            '\nKompetenzfeld: ' + (kurs.kompetenzfeld || 'offen'),
      /* Einzige Stelle, an der die Vorrangregel steht (Konvention 9: eine
         Quelle pro Begriff) — nicht zusaetzlich noch einmal unter "Feste Regeln". */
      arbeitsweise: 'Halte dich in jedem Chat an den jeweiligen Masterprompt UND an diese ' +
        'Instruktionen. Bei Widerspruch gelten diese Instruktionen; benenne den Konflikt, ' +
        'statt ihn still aufzulösen. Bearbeite nur den angeforderten Schritt, nicht ' +
        'vorauseilend den nächsten.'
    };
  }

  function renderClaude(teile, kopf, arbeitsweise) {
    var z = [];
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
  }

  function renderChatgpt(teile, kopf, arbeitsweise) {
    var z = [];
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
      /* pruefung (A2, Etappe 3): durchgereichtes Kontrakt-Feld wie gate — die
         eine Stelle, an der controller.hochladen nachsieht, ob fuer dieses
         Lieferobjekt ein Struktur-Gate greift (T11: xlsx/struktur, A2:
         docx/skript), s. dort. */
      /* lieferobjekt (A3, Etappe 3): dasselbe aufgeloeste lief wie im
         Dateinamen — EINE Stelle statt eines zweiten inhalt.lieferobjektVon()-
         Aufrufs an jeder Stelle, die nur den Status/die Kennung dieses
         Lieferobjekts braucht (z. B. der Kaltstart-Kasten Schritt 3 in
         ansichten.js: dossier.statusVon(d, ablageVon(i,'2',k).lieferobjekt)). */
      return { ordner: e.ordner, datei: datei, format: e.format, gate: e.gate || null,
               wege: e.wege || [], variante: variante || null, pruefung: e.pruefung || null,
               lieferobjekt: lief };
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

    /* Alle vorhandenen v-Fassungen eines Lieferobjekts, absteigend sortiert
       (hoechste zuerst) — _final zaehlt nicht mit, das ist keine Fassung mehr
       zur Auswahl. Grundlage der Versions-Auswahl in der Gate-Box (Z9,
       Entscheid Markus 2026-07-30): dort waehlt der Mensch ausdruecklich,
       WELCHE Fassung final wird, statt dass geltendeDatei() (hoechste Nummer)
       das stillschweigend fuer ihn entscheidet. */
    versionenVon: function (dateien, kursId, lieferobjekt) {
      if (!Array.isArray(dateien)) return [];
      var re = new RegExp('^' + reEsc(kursId) + '_' + reEsc(lieferobjekt) +
                          '_v(\\d+)\\.[a-z0-9]+$', 'i');
      var treffer = [];
      dateien.forEach(function (d) {
        var m = re.exec(d.name || '');
        if (m) treffer.push({ name: d.name, version: parseInt(m[1], 10) });
      });
      treffer.sort(function (a, b) { return b.version - a.version; });
      return treffer;
    },

    /* Ist das Lieferobjekt dieses Schritts eine DATEI (kommt nie als Fliesstext
       aus dem Chat) statt Text? A2, Etappe 3 — die eine Stelle fuer diese
       Frage (Konvention 9): xlsx (Schritt 2, T11/T12) und docx (Schritt 3, E5
       — der Chat liefert das Skript direkt, die App prueft beim Hochladen).
       darfAblegen() nutzt sie statt einer eigenen, an dieselbe Endungsliste
       gebundenen Bedingung — waechst die Liste (ein drittes Dateiformat), gibt
       es nur eine Stelle zum Anpassen. */
    dateiLieferobjekt: function (i, schrittId) {
      var e = inhalt.erwarteteEndung(i, schrittId);
      return e === 'xlsx' || e === 'docx';
    },

    /* Der Weg Chat ist nur dort vorgesehen, wo der Kontrakt ihn nennt — UND nur
       fuer textbasierte Lieferobjekte (Z10, erweitert A2). Ein Chat liefert
       eine xlsx oder docx als DATEI — sein Ergebnis kommt ueber den Weg
       Hochladen herein; die Text-Ablagefläche wäre eine Sackgasse. Seit T12
       liefert der Chat die .xlsx fuer Schritt 2 direkt, seit A2 die .docx fuer
       Schritt 3 (E5); der Kontrakt fuehrt dort seither auch 'chat' in wege
       (Default-Weg), die Text-Ablage bleibt aber gesperrt. */
    darfAblegen: function (i, schrittId) {
      var e = ((i['ablage-kontrakt'] || {}).schritte || {})[String(schrittId)];
      if (!e || !Array.isArray(e.wege)) return false;
      return e.wege.indexOf('chat') >= 0 && !!e.lieferobjekt &&
             !inhalt.dateiLieferobjekt(i, schrittId);
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
       spalten.length Zellen) PLUS eine unbekannte Zusatzspalte danach (Fix-
       Runde 1, Finding F2 — s. u.), Blattreihenfolge, Steckbrief zuletzt.
       Prueft NIE Zellinhalte jenseits der Kopfzeile — das bleibt Fachurteil
       am Gate. blaetter kommt aus xlsxLesen.blaetterUndKoepfe():
       [{name, kopf}]. Ohne struktur (Schritt fuehrt keine) liefert die
       Funktion null statt eines leeren, potenziell falsch als "geprueft und
       sauber" gelesenen Arrays — ein leeres Ergebnis ist nie ein gruenes
       (contract-pruefen.cjs-Kommentar, hier ebenso bindend).

       F2 (Review opus, gemessen an der echten AFL-001-Datei): `slice(0,
       spalten.length)` allein schneidet eine ANGEHAENGTE erfundene Spalte
       einfach ab — die echte AFL-001-Kopfzeile traegt 'Lernort' als 8. Zelle
       nach den sieben erwarteten, der Vergleich sah nur die ersten sieben und
       befand []. Genau das war der Fall, den T11 eigentlich fangen sollte.
       Fix (Paritaetspflicht: dieselbe Regel steht jetzt auch in
       contract-pruefen.cjs, s. dort): jede Zelle AB Index spalten.length, die
       nichtleer ist, erzeugt einen eigenen Befund „unbekannte Zusatzspalte".
       Rein nachlaufende Leerzellen (die xlsx oft anhaengt) loesen nichts aus. */
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
        var voll = (b.kopf || []).map(function (c) { return c == null ? '' : String(c).trim(); });
        var kopf = voll.slice(0, s.spalten.length);
        if (kopf.join('|') !== s.spalten.join('|')) {
          fehler.push('Blatt ' + b.name + ': Kopfzeile weicht vom Schema ab');
        }
        for (var idx = s.spalten.length; idx < voll.length; idx++) {
          if (voll[idx] !== '') {
            fehler.push('Blatt ' + b.name + ': unbekannte Zusatzspalte \'' + voll[idx] + '\'');
          }
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
      z.push.apply(z, regulatorikZeilen(d));
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
      /* PROJEKT-WISSEN (T13, herausgezogen als projektWissenZeilen in A3):
         nur Datei-Quellen — eine Link-Quelle wird direkt aufgerufen, nicht
         als Ablage im Projekt-Wissen erwartet. Muster wie
         dossier.positivliste(), hier ohne Abhaengigkeit zu dossier.js erneut
         gebildet (inhalt.js kennt dossier.js bewusst nicht, s. app.js-Aufrufer
         fuer die uebrigen Dossier-Funktionen). */
      z.push.apply(z, projektWissenZeilen(d));
      z.push('');
      z.push('=== ENDE DER ANGABEN ===');
      z.push('');
      return z.join('\n');
    },

    /* Prompt-Kopf fuer Schritt 3 (Content-Skript), A3 Etappe 3 — dasselbe
       Prinzip wie briefingPromptKopf/lernzielePromptKopf: was die App schon
       weiss, muss der Chat nicht erfragen. Urspruenglich E5 (Entscheid
       Markus 2026-07-31): der Chat liefert die .docx direkt (wie Schritt 2
       die xlsx). Seit der E5-Revision (Markus, 2026-08-03, s. B5/B6 in
       CLAUDE.md) liefert der Chat stattdessen die BLOCKDATEI — die App baut
       das Word selbst und prueft die Blockdatei beim Hochladen
       (blocksPruefe, B5, ersetzt skriptPruefe/A2). Dieser Kopf ist der
       GESETZTE Teil, den blocksPruefe voraussetzt (Kurs-ID/Rechtsstand
       stehen jetzt in ###SKRIPT statt im Fliesstext, Quellen-Q-IDs
       weiterhin). Der Schluss-Satz "Liefere in Phase 2 DIREKT die Blockdatei
       … zum Herunterladen" (extras.zielname, unten) nennt seit B6 den
       .blocks-Namen, nicht mehr den .docx-Namen — der Chat liefert seit der
       E5-Revision keine .docx mehr, app.js uebergibt hier den Stamm mit
       .blocks-Endung (s. den kopieren-Handler dort). Direkt danach ein
       fester Satz zur Illustrations-Regie — seit der Fixwave 2026-08-04
       (C1, Etappe 3b Review) IMMER datei: PLUS szene:, nie mehr szene:
       allein: das Gate in skript-lesen.js verlangt datei: ODER katalog:,
       und katalog: wird seit derselben Fixwave (I1) nirgends mehr im
       Kontrakt beworben (die Validierung erlaubt es weiterhin, B7 baut den
       Katalog erst noch) — ein Prompt, der szene: allein als ausreichend
       hinstellte, liess jeden Claude-Weg-Upload mit Illustration am Gate
       scheitern. Der Handoff-Satz unterscheidet seither nach
       extras.variante: bei 'chatgpt' liefert der Chat das PNG im selben
       Upload mit, sonst (u. a. 'claude') erzeugt eine Person das Bild
       danach separat und speichert es GENAU unter dem genannten
       datei:-Namen. Der Wortlaut dieses Prompt-Kopfs selbst ist sonst
       nicht Teil von B5/B6 (Werkzeug-/Prompt-Texte sind ein eigener,
       freigabepflichtiger Schritt, s. CLAUDE.md "Offen").

       Rahmen und gemeinsame Saetze NICHT dupliziert (Konvention 9): Kurs/
       Kompetenzfeld-Zeilen wie in briefingPromptKopf/lernzielePromptKopf,
       Rechtsstand/Zusatz/SAQ ueber regulatorikZeilen(d) (zweiter Aufrufer),
       FACHQUELLEN GENAU-Block ueber fachquellenZeilen(d) (dritter Aufrufer),
       PROJEKT-WISSEN-Zeile ueber projektWissenZeilen(d) (zweiter Aufrufer).
       Ohne d (kein Dossier geladen — Schritt 1 nie durchlaufen) gibt es
       keinen Kopf.

       extras = { variante, version, basiertAuf, zielname } — reine
       Anzeigewerte, von app.js aus bereits geladenen dateien-Caches
       berechnet (T13-Muster: inhalt.gewaehlteVariante/naechsteVersion/
       geltendeDatei/hochladeZiel — nichts neu erfunden). Fehlt ein Feld,
       fehlt seine Zeile: die Funktion raet nie. Die Illustrations-Regie-
       Zeile haengt bewusst NICHT an extras.zielname (sie gilt unabhaengig
       vom Dateinamen), sondern steht immer, sobald ein Dossier vorliegt.

       Selbstlernphase (E3, Ruhe-Regel "Zeit immer indikativ, die Lernziele
       fuehren"): aus dem Dossier-Scope via briefingWerteAusDossier(d), Label
       und Einheit an der EINEN Stelle in BRIEFING_FELDER abgelesen (Feld-ID
       'selbstlern') — nie hier hartkodiert, aendert sich Label/Einheit dort,
       zieht dieser Kopf automatisch mit. Nur, wenn ein Wert gesetzt ist. */
    skriptPromptKopf: function (kurs, d, extras) {
      if (!d) return '';
      extras = extras || {};
      var z = [];
      z.push('=== ANGABEN AUS DER KURSWERKSTATT ===');
      z.push('Diese Werte sind gesetzt. Übernimm sie. Frage sie NICHT erneut ab, rechne sie');
      z.push('nicht um und bewerte sie nicht.');
      z.push('');
      z.push('Kurs: ' + (kurs && kurs.kursId || '?') + ' — ' + (kurs && kurs.kurstitel || '?'));
      z.push('Kompetenzfeld: ' + (kurs && kurs.kompetenzfeld || '?'));
      z.push.apply(z, regulatorikZeilen(d));
      z.push('');
      z.push('Nenne die Kurs-ID und den Rechtsstand GENAU in dieser Schreibweise sichtbar im ' +
             'Dokument (Titelbereich) — die Kurswerkstatt prüft beides beim Hochladen.');

      var selbstlernFeld = inhalt.briefingFeld('selbstlern');
      var selbstlernWert = inhalt.briefingWerteAusDossier(d).selbstlern;
      if (selbstlernFeld && String(selbstlernWert == null ? '' : selbstlernWert).trim()) {
        z.push('');
        z.push(selbstlernFeld.label + (selbstlernFeld.einheit ? ' (' + selbstlernFeld.einheit + ')' : '') +
               ': ' + selbstlernWert + ' (indikativ — die Lernziele führen).');
      }

      if (extras.variante) {
        z.push('');
        z.push('Variante: ' + extras.variante);
      }
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
      z.push.apply(z, projektWissenZeilen(d));
      if (extras.zielname) {
        z.push('');
        z.push('Liefere in Phase 2 DIREKT die Blockdatei ' + extras.zielname + ' zum Herunterladen.');
      }
      z.push('');
      var kursIdFuerDatei = (kurs && kurs.kursId) || '{kurs}';
      z.push('Jedes Kapitel trägt genau eine ###ILLUSTRATION mit datei: (IMMER Pflicht — vergib den ' +
             'Dateinamen selbst, Empfehlung: ' + kursIdFuerDatei + '-illu-<Kapitelnr>.png, kein ' +
             'Pflichtmuster) und szene: als Bild-Regie.');
      if (extras.variante === 'chatgpt') {
        z.push('Kannst du selbst Bilder erzeugen: liefere das PNG im selben Upload gleich mit, ' +
               'GENAU unter dem in datei: genannten Namen.');
      } else {
        z.push('Du selbst lieferst kein PNG — eine Person erzeugt das Bild danach mit dem ' +
               'Stil-Prompt in einem Bild-Werkzeug und speichert es GENAU unter dem in datei: ' +
               'genannten Namen, bevor sie hochlädt.');
      }
      z.push('');
      z.push('=== ENDE DER ANGABEN ===');
      z.push('');
      return z.join('\n');
    },

    /* Prompt-Kopf fuer Schritt 4 (Validierung), V3 Etappe 4 — dasselbe Prinzip
       wie briefingPromptKopf/lernzielePromptKopf/skriptPromptKopf: was die App
       schon weiss, muss der Chat nicht erfragen. Schritt 4 validiert GEGEN die
       beiden Schritt-3-Varianten und den freigegebenen Contract aus Schritt 2
       (s. inhalt.validierungPruefe, V2) — dieser Kopf ist der GESETZTE Teil,
       den validierungPruefe beim Pruefen voraussetzt (die Leseliste muss ALLE
       Dossier-Quellen nennen, ###VALIDIERUNG ist je Kapitel Pflicht).

       Rahmen und gemeinsame Saetze NICHT dupliziert (Konvention 9): Kurs-/
       Kompetenzfeld-Zeilen wie in den drei vorigen Koepfen, Rechtsstand/
       Zusatz/SAQ ueber regulatorikZeilen(d) (vierter Aufrufer), FACHQUELLEN
       GENAU-Block ueber fachquellenZeilen(d) (vierter Aufrufer),
       PROJEKT-WISSEN-Zeile ueber projektWissenZeilen(d) (dritter Aufrufer).
       Ohne d (kein Dossier geladen — Schritt 1 nie durchlaufen) gibt es
       keinen Kopf.

       extras = { basisClaude, basisChatgpt, contract, version, zielname } —
       reine Anzeigewerte, von app.js aus bereits geladenen dateien-Caches
       berechnet (T13/A3-Muster: inhalt.geltendeDatei/finalVorhanden/
       naechsteVersion/hochladeZiel — nichts wird hier neu erfunden). Fehlt
       ein Feld, fehlt seine Zeile: die Funktion raet nie.
       - basisClaude/basisChatgpt: die geltende .blocks-Fassung je
         Schritt-3-Variante (geltende .docx, Endung getauscht — B5-Invariante:
         beide liegen unter demselben Stamm).
       - contract: die _final-Fassung des Schritt-2-Lieferobjekts
         (finalVorhanden, NICHT die hoechste Version — ein Contract-Entwurf
         ohne Gate 1 ist kein Massstab fuer die Validierung).
       - version/zielname: Version und Zielname des Schritt-4-Lieferobjekts
         selbst (naechsteVersion/hochladeZiel im 04_validierung-Ordner);
         zielname nennt im Kopf das ZIP-Paket (Stamm mit .zip-Endung — das
         GEBAUTE Ablageformat bleibt docx, wie bei den anderen Koepfen ist der
         im Prompt genannte Name derselbe Stamm mit getauschter Endung).

       Drei feste Regeln, UNCONDITIONAL sobald d vorliegt (kein extras-Wert
       dahinter — Muster die Kurs-ID/Rechtsstand-Sichtbarkeits-Zeile in
       skriptPromptKopf, F1): Altmaterial ist Prüfstein, nicht Wahrheitsquelle
       (00_input/ dient dem Abgleich, keine Fundstelle darf sich darauf
       berufen, ohne Datei und Seite zu nennen) · die Leseliste muss ALLE
       Dossier-Quellen nennen (Schritt 4 ist der letzte Halt vor der
       fachlichen Freigabe, eine Teil-Lieferung wie in Schritt 3 ist hier
       nicht mehr akzeptabel, s. validierungPruefe Regel 2) · ###VALIDIERUNG
       ist je Kapitel Pflicht (umgekehrt zu Schritt 3, s. validierungPruefe
       Regel 1). */
    contentPromptKopf: function (kurs, d, extras) {
      if (!d) return '';
      extras = extras || {};
      var z = [];
      z.push('=== ANGABEN AUS DER KURSWERKSTATT ===');
      z.push('Diese Werte sind gesetzt. Übernimm sie. Frage sie NICHT erneut ab, rechne sie');
      z.push('nicht um und bewerte sie nicht.');
      z.push('');
      z.push('Kurs: ' + (kurs && kurs.kursId || '?') + ' — ' + (kurs && kurs.kurstitel || '?'));
      z.push('Kompetenzfeld: ' + (kurs && kurs.kompetenzfeld || '?'));
      z.push.apply(z, regulatorikZeilen(d));

      if (extras.basisClaude) {
        z.push('');
        z.push('Variante A (claude): ' + extras.basisClaude);
      }
      if (extras.basisChatgpt) {
        z.push('');
        z.push('Variante B (chatgpt): ' + extras.basisChatgpt);
      }
      if (extras.contract) {
        z.push('');
        z.push('Contract: ' + extras.contract);
      }
      if (typeof extras.version === 'number') {
        z.push('');
        z.push('Version des Lieferobjekts: ' + extras.version + '.');
        z.push('Setze im YAML-Feld \'version\' des _steckbrief GENAU diese Zahl, keine andere.');
      }

      z.push('');
      z.push('00_input/ ist Prüfstein, nicht Wahrheitsquelle — jede Fundstelle heisst Datei ' +
             'und Seite, nie \'laut Altmaterial\'.');
      z.push('Die Leseliste nennt ALLE Dossier-Quellen — Schritt 4 lässt keine Lücke mehr zu.');
      z.push('Jedes Kapitel trägt ###VALIDIERUNG — in Schritt 4 ist das Pflicht.');

      z.push('');
      z.push.apply(z, fachquellenZeilen(d));
      z.push.apply(z, projektWissenZeilen(d));

      if (extras.zielname) {
        z.push('');
        z.push('Liefere in Phase 2 DIREKT das ZIP-Paket ' + extras.zielname +
               ' (Blockdatei + neue PNGs) zum Herunterladen.');
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
      var gefunden = qIds(text);
      var fehlend = quellen
        .map(function (q) { return q.id; })
        .filter(function (id) { return id && !gefunden[id]; });
      return { fehlend: fehlend, gesamt: quellen.length };
    },

    /* --- Der Block-Pruefer (B5, Etappe 3b) — ersetzt skriptPruefe (A2) ---
       E5-Revision (Entscheid Markus 2026-08-03, ersetzt E5 vom 2026-07-31):
       der Chat liefert fuer Schritt 3 nicht mehr die .docx, sondern die
       BLOCKDATEI (.blocks/.txt) — die App baut das Word selbst (B3
       Diagramme, B4 docx-Bauen) und legt es zusammen mit der Blockdatei und
       den Abbildungen ab (controller.hochladen). Struktur-Drift ist damit
       KONSTRUKTIV unmoeglich: ein fehlender Baustein fehlt im gebauten Word
       genauso wie im Block, es gibt keinen zweiten Fliesstext mehr, in dem
       er sich verstecken koennte. blocksPruefe() prueft deshalb nur noch,
       was skriptLesen.lies() NICHT schon selbst sicherstellt (Pflicht-
       bausteine je Kapitel laufen dort ueber pruefeKapitel, s. dort) —
       Q-ID-Abgleich, Marker-Verbot, Wortbudget, plus (seit der Fixwave
       2026-08-04, I1) der Katalog-Verweis-Hinweis fuer eine ###ILLUSTRATION
       mit katalog: ohne datei:, s. u.

       Aufrufer-Vertrag (controller.hochladen, s. dort): blocksPruefe() wird
       NUR aufgerufen, wenn gelesen.fehler bereits leer ist — bei einem
       nicht-leeren gelesen.fehler bricht der Controller VORHER ab, mit
       genau dieser Liste. Pflichtbausteine sind hier deshalb kein Thema
       mehr (dokumentierter Regelwechsel zu A2, das denselben Fliesstext auf
       Marker/Abschnitts-Ueberschriften abklopfte — der ###-Block-Parser
       macht das jetzt strukturell).

       blocksPruefe(gelesen, d) -> { fehler: [], hinweise: [] } | null.
       null, wenn d kein (geladenes) Dossier ist — ungeprueft ist nie gruen,
       der Aufrufer MUSS diesen Fall behandeln (Muster strukturPruefe/T11,
       skriptPruefe/A2).

       Q-ID-Abgleich per Wortgrenze (\bQ-\d{3}\b, s. qIds() oben) — ueber die
       STRUKTURIERTE Leseliste (gelesen.quellen.gelesen), nicht mehr ueber
       den ganzen Fliesstext wie A2: die Blockdatei fuehrt dafuer eine eigene
       ###QUELLEN/gelesen:-Zeile, ein Freitext-Scan waere ein Rueckschritt
       gegenueber der strukturierten Form. Dieselbe Regel wie quellenSpiegel
       (Z7), damit ein "Q-0158" in keiner der beiden Pruefungen faelschlich
       als Treffer fuer "Q-015" zaehlt. */
    blocksPruefe: function (gelesen, d) {
      if (!d || typeof d !== 'object') return null;
      var fehler = [];
      var hinweise = [];
      var kapitel = (gelesen && Array.isArray(gelesen.kapitel)) ? gelesen.kapitel : [];
      var gelesenListe = (gelesen && gelesen.quellen && gelesen.quellen.gelesen) || [];

      /* V2 (Etappe 4): ###VALIDIERUNG gehoert erst in Schritt 4 (dort
         PFLICHT, s. validierungPruefe Regel 1) — in einem Schritt-3-Entwurf
         ist der Block ein Fehler, kein optionaler Baustein: Validierung ist
         noch nicht dran. */
      kapitel.forEach(function (k) {
        if (k.teile && k.teile.VALIDIERUNG) {
          fehler.push('Kapitel ' + (k.ek || '?') + ': ###VALIDIERUNG gehört nicht in einen ' +
                       'Entwurf — Validierung ist Schritt 4.');
        }
      });

      /* Marker-Verbot (E6) und Wortbudget (SCHEMA.budget.hartMin) —
         gemeinsame Helfer mit validierungPruefe (Konvention 9, s. oben). Das
         Wortbudget ergaenzt die Substanzmarken (Pflichtbausteine), es
         ersetzt sie nicht: die Marken pruefen, DASS gerechnet und gezeigt
         wird, das Budget prueft, dass ueberhaupt genug ausgefuehrt wird. */
      markerVerbotPruefe(kapitel, fehler);
      var hartMin = (S().SCHEMA.budget || {}).hartMin || 500;
      wortbudgetPruefe(kapitel, fehler, hartMin);

      /* Q-ID-Abgleich Leseliste gegen Dossier — Modus aus d.content_modus,
         wie A2. */
      var gefunden = {};
      gelesenListe.forEach(function (z) {
        var m = String(z).match(/\bQ-\d{3}\b/g) || [];
        m.forEach(function (id) { gefunden[id] = true; });
      });
      var gefundenListe = Object.keys(gefunden);

      if (d.content_modus === 'quellenfrei') {
        /* quellenfrei heisst: die Leseliste ist leer UND kein Q-Verweis
           taucht darin auf — kein Freitext-Ausweis mehr noetig wie bei A2
           ("quellenfrei" woertlich im Text), die Struktur sagt es selbst. */
        if (gelesenListe.length || gefundenListe.length) {
          fehler.push('Modus quellenfrei, aber eine Leseliste mit Quellen-Angaben ist gesetzt ' +
                       '— im Modus quellenfrei sind keine Quellen zulässig.');
        }
      } else {
        var dossierIds = (d.quellen || []).map(function (q) { return q && q.id; }).filter(Boolean);
        var dossierSet = {};
        dossierIds.forEach(function (id) { dossierSet[id] = true; });

        gefundenListe
          .filter(function (id) { return !dossierSet[id]; })
          .forEach(function (id) {
            fehler.push('Unbekannte Quellen-ID in der Leseliste: ' + id + ' — keine ' +
                         'Dossier-Quelle.');
          });

        /* Fehlende Dossier-Q-IDs sind ein HINWEIS, kein Fehler: eine
           Teil-Lieferung je Lerneinheit ist legitim (Parity zu A2). */
        dossierIds
          .filter(function (id) { return !gefunden[id]; })
          .forEach(function (id) {
            hinweise.push('Dossier-Quelle ' + id + ' erscheint nicht in der Leseliste — ' +
                           'Teil-Lieferung je Lerneinheit ist legitim, vor Schritt 4 ' +
                           'vervollständigen.');
          });
      }

      /* I1 (Fixwave 2026-08-04, Etappe-3b-Review): ein reiner katalog:-Verweis
         ist heute eine stille Sackgasse — es gibt noch keinen Katalog (B7
         baut ihn erst) und keine App-Auflösung dafuer: weder
         docxBauen.illustrationAbsatz() noch inhalt.illustrationenFehlend()
         lesen katalog:, beide kennen nur datei:. Ohne diesen Hinweis bliebe
         das fehlende Bild STILL — kein Fehler (die Pflicht-ODER-Regel in
         skript-lesen.js/.cjs ist mit katalog: allein bereits erfuellt), nur
         ein leeres Bild im gebauten Word, das niemand angekuendigt hat. Der
         Hinweis landet wie jeder andere hinweise-Eintrag am Ende der
         Erfolgsmeldung (app.js weiterMitSkriptBau) — nie blockierend, aber
         auch nie unsichtbar. */
      kapitel.forEach(function (k) {
        var illuRoh = k.teile && k.teile.ILLUSTRATION;
        if (!illuRoh) return;
        var hatDatei = /^datei:[ \t]*\S/m.test(String(illuRoh));
        var hatKatalog = /^katalog:[ \t]*\S/m.test(String(illuRoh));
        if (hatKatalog && !hatDatei) {
          hinweise.push('Kapitel ' + (k.ek || '?') + ': Katalog-Verweis wird in dieser Fassung ' +
                         'noch nicht gesetzt — Bild fehlt im Dokument.');
        }
      });

      return { fehler: fehler, hinweise: hinweise };
    },

    /* Welche ###ILLUSTRATION-Referenzen (B6: ein bekannter, optionaler
       Schema-Baustein, s. skript-schema.js) im Upload FEHLEN — dieselbe
       "datei:"-Feldsyntax wie docxBauen.illustrationAbsatz() dort liest
       (Parity, s. Kommentar dort). Anders als im gebauten Word (wo eine
       fehlende Illustration einfach nichts einfuegt) ist eine referenzierte,
       aber nicht mitgelieferte Illustration beim UPLOAD ein Fehler — der
       Chat hat sie versprochen, aber nicht mitgeschickt.

       illustrationenFehlend(gelesen, hochgeladeneNamen) -> string[] der
       fehlenden Dateinamen.

       Laeuft in controller.hochladen NACH dem gelesen.fehler-Gate (skript-
       lesen.js hat datei:/katalog: als Pflicht-ODER, die Zeichen-
       Erlaubnisliste und die Nie-Fakten-Regel schon geprueft) — jeder
       hier ankommende datei-Wert ist bereits ein gueltiger, sicherer
       Dateiname; dieser Check prueft nur noch, ob die Datei TATSAECHLICH im
       selben Upload mitkam. */
    illustrationenFehlend: function (gelesen, hochgeladeneNamen) {
      var vorhanden = {};
      (hochgeladeneNamen || []).forEach(function (n) { vorhanden[n] = true; });
      var fehlt = [];
      var kapitel = (gelesen && Array.isArray(gelesen.kapitel)) ? gelesen.kapitel : [];
      kapitel.forEach(function (k) {
        var roh = k.teile && k.teile.ILLUSTRATION;
        if (!roh) return;
        var m = String(roh).match(/^datei:[ \t]*(.+)$/m);
        if (!m) return;
        var name = m[1].trim();
        if (name && !vorhanden[name]) fehlt.push(name);
      });
      return fehlt;
    },

    /* Ziffern-Zahlen in einem Text zaehlen — s. Kommentar bei der privaten
       Funktion zahlenImText() oben (Regel 4b der Regressionsbremse). Hier
       oeffentlich gemacht fuer einen eigenen Test und fuer V4/spaetere
       Aufrufer (Konvention 9: eine Zaehlregel, ein Ort). */
    zahlenImText: zahlenImText,

    /* --- Der Validierungs-Pruefer (V2, Etappe 4) ---
       Schritt 4 (Validierung) baut auf den Grundregeln von blocksPruefe auf
       (Marker-Verbot, Wortbudget — dieselben Helfer, Konvention 9) und
       prueft zusaetzlich vier V1/V2-spezifische Regeln: ###VALIDIERUNG ist
       hier PFLICHT (umgekehrt zu Schritt 3, wo er verboten ist, s.
       blocksPruefe oben), die Leseliste muss VOLLSTAENDIG sein (kein
       Hinweis mehr wie in Schritt 3, sondern ein Fehler — Schritt 4 ist der
       letzte Halt vor der fachlichen Freigabe), jede offene Divergenz
       braucht einen ###OFFEN-Eintrag, und die Regressionsbremse verlangt,
       dass das validierte Kapitel mindestens so viel Substanz traegt wie
       das STAERKERE der beiden Schritt-3-Rohentwuerfe — je Marke einzeln,
       nicht insgesamt (ein Kapitel darf in Bausteinen von Variante A und in
       Zahlen von Variante B "lernen"). Bewusst KEINE Wortzahl-Marke
       (Entscheid 2026-07-24, s. Brief) — das Wortbudget oben deckt die
       Mindestmenge bereits ab, eine zweite Wortzahl-Schwelle waere
       redundant.

       validierungPruefe(gelesen, d, kursId, varianten) -> { fehler: [],
       hinweise: [] } | null. null ohne (geladenes) Dossier — ungeprueft ist
       nie gruen (Muster blocksPruefe/T11/A2). kursId wird heute von keiner
       Regel ausgewertet — Teil der Signatur, weil der Aufrufer (V4) ihn wie
       bei blocksPruefe/Schritt-3-Hochladen ohnehin zur Hand hat.

       varianten = { claude: gelesenA|null, chatgpt: gelesenB|null } — die
       BEREITS GEPARSTEN .blocks beider Schritt-3-Varianten; V4 laedt und
       parst sie (kein Netz, kein DOM hier). Fehlt eine Variante ganz, ist
       jeder Markenvergleich sinnlos (0 waere geraten, nicht gemessen) —
       Regel 4 bricht dann mit GENAU EINEM Fehler ab, ohne Marken-Fehler
       zusaetzlich. */
    validierungPruefe: function (gelesen, d, kursId, varianten) {
      if (!d || typeof d !== 'object') return null;
      var fehler = [];
      var hinweise = [];
      var kapitel = (gelesen && Array.isArray(gelesen.kapitel)) ? gelesen.kapitel : [];
      var gelesenListe = (gelesen && gelesen.quellen && gelesen.quellen.gelesen) || [];
      var offenListe = (gelesen && Array.isArray(gelesen.offen)) ? gelesen.offen : [];

      /* Grundregeln wie blocksPruefe (Konvention 9: gemeinsame Helfer, s.
         oben) — nicht dupliziert, dieselben Funktionen. */
      markerVerbotPruefe(kapitel, fehler);
      var hartMin = (S().SCHEMA.budget || {}).hartMin || 500;
      wortbudgetPruefe(kapitel, fehler, hartMin);

      /* Regel 1: ###VALIDIERUNG ist je Kapitel PFLICHT — umgekehrt zu
         Schritt 3 (blocksPruefe verbietet ihn dort). */
      kapitel.forEach(function (k) {
        if (!k.validierung) {
          fehler.push('Kapitel ' + (k.ek || '?') + ': ###VALIDIERUNG fehlt — Validierung ist ' +
                       'in Schritt 4 Pflicht.');
        }
      });

      /* Regel 2: Leseliste vollstaendig — fehlende Dossier-Q-IDs sind HIER
         ein Fehler (in Schritt 3/blocksPruefe nur ein Hinweis, s. dort). */
      var gefunden = {};
      gelesenListe.forEach(function (z) {
        var m = String(z).match(/\bQ-\d{3}\b/g) || [];
        m.forEach(function (id) { gefunden[id] = true; });
      });
      var dossierIds = (d.quellen || []).map(function (q) { return q && q.id; }).filter(Boolean);
      var fehlendeIds = dossierIds.filter(function (id) { return !gefunden[id]; });
      if (fehlendeIds.length) {
        fehler.push('Leseliste unvollständig — Dossier-Quelle(n) ' + fehlendeIds.join(', ') +
                     ' fehlen in der Leseliste.');
      }

      /* Regel 3: jede divergenz: offen braucht einen Eintrag in ###OFFEN —
         Abgleich ueber die EK-ID als Substring im Offen-Text (kein starres
         Format vorausgesetzt). */
      kapitel.forEach(function (k) {
        if (k.validierung && k.validierung.divergenz === 'offen') {
          var imOffen = offenListe.some(function (z) { return String(z).indexOf(k.ek) >= 0; });
          if (!imOffen) {
            fehler.push('offene Divergenz ' + k.ek + ' fehlt in ###OFFEN');
          }
        }
      });

      /* Regel 4: Regressionsbremse. */
      varianten = varianten || {};
      var fehlendeVarianten = [];
      if (!varianten.claude) fehlendeVarianten.push('claude');
      if (!varianten.chatgpt) fehlendeVarianten.push('chatgpt');
      if (fehlendeVarianten.length) {
        fehler.push('Variantenvergleich braucht beide Skript-Varianten — ' +
                     fehlendeVarianten.join(' und ') + ' fehlt in 03_content');
      } else {
        kapitel.forEach(function (k) {
          var kA = kapitelZuEk(varianten.claude, k.ek);
          var kB = kapitelZuEk(varianten.chatgpt, k.ek);
          var beispielIst = (k.teile && k.teile.BEISPIEL) || '';
          var beispielA = (kA && kA.teile && kA.teile.BEISPIEL) || '';
          var beispielB = (kB && kB.teile && kB.teile.BEISPIEL) || '';
          var marken = [
            { name: 'Bausteine', ist: nichtLeereBausteine(k), a: nichtLeereBausteine(kA), b: nichtLeereBausteine(kB) },
            { name: 'Zahlen im Beispiel', ist: zahlenImText(beispielIst), a: zahlenImText(beispielA), b: zahlenImText(beispielB) },
            { name: 'Abbildungen', ist: (k.abbildungen || []).length,
              a: (kA && kA.abbildungen) ? kA.abbildungen.length : 0,
              b: (kB && kB.abbildungen) ? kB.abbildungen.length : 0 }
          ];
          marken.forEach(function (m) {
            var untergrenze = Math.max(m.a, m.b);
            if (m.ist < untergrenze) {
              var quelle = m.a >= m.b ? 'claude' : 'chatgpt';
              fehler.push('Kapitel ' + k.ek + ': ' + m.name + ' ' + m.ist + ' < ' + untergrenze +
                           ' (Untergrenze aus Variante ' + quelle + ')');
            }
          });
        });
      }

      return { fehler: fehler, hinweise: hinweise };
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

    /* Die EINE Quelle fuer den Namen der Projekt-Wissen-Datei (K1) — der
       Verweis-Satz in der Kompaktfassung und der Download-Knopf (Ansicht/
       app.js) rufen beide diese Funktion, nie einen eigenen Namen. */
    projektWissenDateiname: function (kurs) {
      return kurs.kursId + '_projekt-instruktionen.md';
    },

    /* Die drei Renderformen. Gleicher Inhalt, andere Verpackung:
       Claude arbeitet mit XML-Tags, ChatGPT mit Trenn-Ueberschriften — dasselbe
       Tool-Tuning, das die Masterprompts schon benutzen.
       K1: die ChatGPT-Fassung ist seither die KOMPAKTFASSUNG — sie ersetzt den
       kursbriefing-Teil durch einen Verweis (teileKompakt), weil der
       eingebettete Volltext das 8000-Zeichen-Instruktionsfeld sprengt. Die
       Claude-Fassung bleibt unveraendert (kein Feldlimit dort). */
    projektInstruktionen: function (i, kurs, briefing, fassung, ordnerName, d) {
      var teile = inhalt.projektInstruktionenTeile(i, kurs, briefing, ordnerName, d);
      var ka = kopfUndArbeitsweise(kurs);
      if (fassung === 'chatgpt') {
        return renderChatgpt(teileKompakt(teile, kurs), ka.kopf, ka.arbeitsweise);
      }
      return renderClaude(teile, ka.kopf, ka.arbeitsweise);
    },

    /* Die vollstaendige ChatGPT-Fassung MIT eingebettetem Briefing-Volltext —
       fuer die Projekt-Wissen-Datei, die der Verweis-Satz der Kompaktfassung
       nennt. Bis K1 war das der Rueckgabewert von projektInstruktionen(...,
       'chatgpt', ...) selbst; die Renderform (Trenn-Ueberschriften, 100-Zeichen-
       Umbruch) ist unveraendert dieselbe. */
    projektInstruktionenLang: function (i, kurs, briefing, ordnerName, d) {
      var teile = inhalt.projektInstruktionenTeile(i, kurs, briefing, ordnerName, d);
      var ka = kopfUndArbeitsweise(kurs);
      return renderChatgpt(teile, ka.kopf, ka.arbeitsweise);
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
