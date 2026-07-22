/* Ansichten. Reine String-Builder — kein DOM, deshalb in Node testbar.
   Interaktion ausschliesslich ueber data-action, Delegation liegt in app.js. */
(function (root) {
  'use strict';

  var esc = function (s) { return root.helpers.escapeHtml(s); };
  var G = function () { return root.graph; };
  var I = function () { return root.inhalt; };

  /* Referenztexte stammen aus dem alten Cockpit v0.2. Sie tragen Knoepfe, die
     dort Werkzeuge oeffneten — hier zeigen sie ins Leere. Ein Knopf, der nichts
     tut, ist schlimmer als kein Knopf: raus damit, der Text bleibt stehen. */
  function entschaerfe(html) {
    return String(html || '')
      .replace(/<button\b[^>]*class="[^"]*\blinklike\b[^"]*"[^>]*>([\s\S]*?)<\/button>/g,
               '<span class="verweis">$1</span>');
  }

  /* ---------- Die Linie: eine Fertigungsstrasse mit neun Stationen ----------
     Kein Kachelraster. Eine durchgehende Bahn, bis zur aktuellen Station gefuellt.
     Die Phasen stehen als Abschnitte darueber. */
  function kette(inh, kurs, aktiv) {
    var phasen = (inh.schritte && inh.schritte.phasen) || [];
    var alle = (inh.schritte && inh.schritte.schritte) || [];
    if (!alle.length) return '';
    var n = alle.length;
    var aktivePhase = aktiv ? I().phaseVon(inh, aktiv) : null;

    /* Ein durchgehendes Gleis. Die Fuellung endet auf dem letzten erledigten Punkt —
       Mitte der Spalte, deshalb (fertig - 0.5) / n. */
    var fertig = kurs ? G().fortschritt(kurs) : 0;
    var fuell = fertig > 0 ? ((fertig - 0.5) / n * 100) : 0;

    var h = '<div class="strasse' + (aktiv ? ' fokus' : '') + '"' +
            ' style="--spalten:' + n + '">';

    /* Zeile 1: die Phasen als Spannen ueber ihre Stationen */
    var spalte = 1;
    phasen.forEach(function (p) {
      var breite = p.ids.length;
      var an = aktivePhase && aktivePhase.nm === p.nm;
      h += '<div class="spanne' + (an ? ' an' : '') + '"' +
           ' style="grid-column:' + spalte + ' / span ' + breite + '">' +
           '<span class="spname">' + esc(p.nm) + '</span></div>';
      spalte += breite;
    });

    /* Zeile 2: das Gleis, quer ueber alle Spalten, hinter den Punkten */
    h += '<div class="gleis" style="grid-column:1 / -1"><i style="width:' +
         fuell.toFixed(2) + '%"></i></div>';

    /* Zeile 2: die Stationen, jede in ihrer Spalte */
    alle.forEach(function (s, i) {
      var st = kurs ? G().standVon(kurs, +s.id) : 'offen';
      var hier = String(aktiv) === String(s.id);
      h += '<button class="station ' + st + (hier ? ' hier' : '') + '"' +
           ' style="grid-column:' + (i + 1) + '"' +
           ' data-action="schritt" data-schritt="' + esc(s.id) + '"' +
           ' title="' + esc(s.nm) + '">' +
           '<span class="stempel">' + (st === 'fertig' ? '&#10003;' : esc(s.id)) + '</span>' +
           (s.gate ? '<span class="pruefzeichen" title="' + esc(s.gate) + '">&#9873;</span>' : '') +
           '</button>';
    });

    /* Zeile 3: die Beschriftungen, unter ihrer Station */
    alle.forEach(function (s, i) {
      var st = kurs ? G().standVon(kurs, +s.id) : 'offen';
      h += '<span class="stbez ' + st + (String(aktiv) === String(s.id) ? ' hier' : '') + '"' +
           ' style="grid-column:' + (i + 1) + '">' + esc(kurz(s.nm)) + '</span>';
    });

    return h + '</div>';
  }

  /* ---------- Dateien eines Schritt-Ordners ---------- */
  function dateiliste(dateien, ordnerUrl, ordner) {
    var kopf = '<div class="kblock dateien">' +
      '<div class="dkopf"><h3>Im Ordner</h3>' +
      (ordnerUrl ? '<a class="oeffnen" href="' + esc(ordnerUrl) + '" target="_blank" ' +
                   'rel="noopener">' + esc(ordner) + ' in SharePoint &#8599;</a>' : '') +
      '</div>';

    if (dateien === undefined) return kopf + '<p class="dim">wird geladen &hellip;</p></div>';
    if (dateien === null)      return kopf + '<p class="dim">Ordner nicht gefunden.</p></div>';
    if (!dateien.length)       return kopf + '<p class="dim">Noch leer &mdash; hier landet das Ergebnis dieses Schritts.</p></div>';

    return kopf + '<ul class="dliste">' + dateien.map(function (d) {
      return '<li><a href="' + esc(d.webUrl) + '" target="_blank" rel="noopener">' +
             esc(d.name) + '</a>' +
             '<span class="dmeta">' + Math.max(1, Math.round((d.size || 0) / 1024)) + ' KB' +
             (d.lastModifiedDateTime ? ' &middot; ' + root.helpers.datum(d.lastModifiedDateTime) : '') +
             '</span></li>';
    }).join('') + '</ul></div>';
  }

  /* ---------- Das Schriftfeld ----------
     Der Titelblock einer technischen Zeichnung: Kennung, Gegenstand, Stand.
     Kein Eyebrow-Titel-Lead — die Angaben sind Daten, keine Überschriften. */
  function schriftfeld(inh, kurs, s) {
    var f = [];
    if (kurs) {
      f.push(['Kurs', esc(kurs.kursId), 'kennung']);
      f.push(['Gegenstand', esc(kurs.kurstitel), '', true]);
      f.push(['Kompetenzfeld', esc(kurs.kompetenzfeld), '']);
      f.push(['Stand', G().fortschritt(kurs) + '&#8202;/&#8202;9', 'zahl']);
    }
    if (s) {
      var ph = I().phaseVon(inh, s.id);
      f.push(['Station', esc(s.id) + '&#8202;/&#8202;9', 'zahl']);
      if (ph) f.push(['Phase', esc(ph.nm), '']);
    }
    if (!f.length) return '';
    return '<div class="schriftfeld">' + f.map(function (x) {
      return '<div class="feld' + (x[3] ? ' weit' : '') + '">' +
             '<span class="fk">' + x[0] + '</span>' +
             '<span class="fw ' + (x[2] || '') + '">' + x[1] + '</span></div>';
    }).join('') + '</div>';
  }

  function kurz(nm) {
    return String(nm).split(/[&(,]/)[0].split(' ').slice(0, 2).join(' ').replace(/[:\-–]$/, '').trim();
  }

  /* ---------- Werkzeug ----------
     Der Masterprompt ist das Instrument des Schritts, kein Anhang. Er traegt
     den Akzent, den Kopier-Knopf im Kopf (ohne Aufklappen) und eigenes Gewicht.
     Vorlagen bleiben ruhig — sie sind Zubehoer. */
  function werkzeug(w, typMeta, offen) {
    var ty = (typMeta && typMeta[w.type]) || { short: w.type };
    var koerper = '';

    if (w.type === 'prompt') {
      var fass = [];
      if (w.claude)  fass.push({ k: 'claude',  t: 'Claude',  txt: w.claude });
      if (w.chatgpt) fass.push({ k: 'chatgpt', t: 'ChatGPT', txt: w.chatgpt });

      if (w.when) koerper += '<div class="when">' + w.when + '</div>';
      if (fass.length > 1) {
        koerper += '<div class="ptabs">' + fass.map(function (f, i) {
          return '<button class="ptab' + (i === 0 ? ' on' : '') + '" data-action="fassung" ' +
                 'data-fassung="' + f.k + '">' + f.t + '</button>';
        }).join('') + '</div>';
      }
      koerper += fass.map(function (f, i) {
        return '<pre class="prompt' + (i === 0 ? ' on' : '') + '" data-box="' + f.k + '">' +
               esc(f.txt) + '</pre>';
      }).join('');

      return '<div class="wtool instrument' + (offen ? ' auf' : '') + '" id="wt-' + esc(w.id) + '">' +
        '<div class="wkopf">' +
          '<span class="tt">' + esc(ty.short) + '</span>' +
          '<div class="wtitel"><h3>' + esc(w.title) + '</h3>' +
            (w.sub ? '<p>' + esc(w.sub) + '</p>' : '') + '</div>' +
          '<button class="knopf gross" data-action="kopieren" data-werkzeug="' + esc(w.id) + '">' +
            'Prompt kopieren</button>' +
          '<button class="ansehen" data-action="werkzeug" data-werkzeug="' + esc(w.id) + '">' +
            (offen ? 'zuklappen' : 'ansehen') + ' <span class="ar">&#9656;</span></button>' +
        '</div>' +
        '<div class="wbody">' + koerper + '</div></div>';
    }

    if (w.type === 'guide') {
      koerper += '<ol class="rezept">' + (w.steps || []).map(function (s) {
        return '<li><span>' + s + '</span></li>';
      }).join('') + '</ol>';
      if ((w.dos || []).length || (w.donts || []).length) {
        koerper += '<div class="dd">' +
          '<div class="ddc do"><h5>Do</h5><ul>' +
            (w.dos || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') +
          '</ul></div>' +
          '<div class="ddc dont"><h5>Don\'t</h5><ul>' +
            (w.donts || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') +
          '</ul></div></div>';
      }
      if (w.dod) koerper += '<div class="liefer"><span class="h">Fertig, wenn</span>' + esc(w.dod) + '</div>';

    } else {
      if (w.sub) koerper += '<p class="lead">' + esc(w.sub) + '</p>';
      (w.tables || []).forEach(function (tb) {
        koerper += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
          (tb.cols || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
          '</tr></thead></table></div>';
      });
    }

    return '<div class="wtool' + (offen ? ' auf' : '') + '" id="wt-' + esc(w.id) + '">' +
      '<button class="wbtn" data-action="werkzeug" data-werkzeug="' + esc(w.id) + '">' +
        '<span class="tt">' + esc(ty.short) + '</span>' +
        '<span class="wt">' + esc(w.title) +
          (w.sub && w.type !== 'template' ? '<em>' + esc(w.sub) + '</em>' : '') + '</span>' +
        '<span class="ar">&#9656;</span></button>' +
      '<div class="wbody">' + koerper + '</div></div>';
  }

  /* ---------- Standort: die Zeile, die immer sagt, wo man ist ----------
     Drei Zonen in einer Zeile: links der Raum, in dem man sich befindet
     (Arbeiten oder Nachschlagen — ein Umschalter, bewusst anders geformt als
     die Reiter im Seiteninhalt), in der Mitte der Weg dorthin, rechts der
     Sprung zur Nachbarstation. Die Zeile klebt oben; in einem langen Schritt
     ging die Orientierung sonst beim ersten Scrollen verloren. */
  function standort(inh, kurs, pos) {
    pos = pos || {};
    var nach = pos.bereich === 'nachschlagen';

    var h = '<div class="standort">';

    h += '<div class="raeume">' +
      raum('arbeiten', 'Arbeiten', !nach) +
      raum('nachschlagen', 'Nachschlagen', nach) + '</div>';

    var weg = spur(inh, kurs, pos, nach);
    h += '<nav class="spur">' + weg.map(function (x, i) {
      var letzt = i === weg.length - 1;
      if (letzt || !x.a) return '<span class="hier">' + x.t + '</span>';
      return '<button class="sprung" data-action="' + x.a + '"' +
             (x.kurs ? ' data-kurs="' + esc(x.kurs) + '"' : '') +
             (x.werk ? ' data-werk="' + esc(x.werk) + '"' : '') +
             '>' + x.t + '</button>';
    }).join('<i class="trenn">&rsaquo;</i>') + '</nav>';

    if (!nach && kurs && pos.schrittId) h += schrittSchalter(inh, pos.schrittId);

    return h + '</div>';
  }

  function raum(k, t, an) {
    return '<button class="' + (an ? 'an' : '') + '" data-action="bereich" ' +
           'data-bereich="' + k + '">' + t + '</button>';
  }

  function spur(inh, kurs, pos, nach) {
    if (nach) {
      var r = (inh && inh.referenz) || {};
      var id = r[pos.werk] ? pos.werk : ['didaktik', 'promptcraft', 'governance']
        .filter(function (k) { return r[k]; })[0];
      /* Kein 'Nachschlagen ›' davor — das steht schon im Raumumschalter daneben. */
      return id && r[id] ? [{ t: esc(r[id].titel), a: null }] : [{ t: 'Nachschlagen', a: null }];
    }
    var st = [{ t: 'Alle Kurse', a: kurs ? 'kurse' : null }];
    if (!kurs) return st;
    st.push({ t: '<b>' + esc(kurs.kursId) + '</b>', a: pos.schrittId ? 'kurs' : null,
              kurs: kurs.kursId });
    if (pos.schrittId) {
      var s = I().schritt(inh, pos.schrittId);
      st.push({ t: '<b>' + esc(pos.schrittId) + '</b>&#8202;&middot;&#8202;' +
                   esc(s ? s.nm : 'Schritt'), a: null });
    }
    return st;
  }

  /* Vor und zurueck, ohne den Umweg ueber die Laufkarte. */
  function schrittSchalter(inh, schrittId) {
    var alle = (inh.schritte && inh.schritte.schritte) || [];
    var n = alle.length;
    var i = 0;
    alle.forEach(function (s, x) { if (String(s.id) === String(schrittId)) i = x; });
    var zurueck = alle[i - 1], vor = alle[i + 1];

    var knopf = function (s, zeichen, was) {
      if (!s) return '<span class="wechsel aus">' + zeichen + '</span>';
      return '<button class="wechsel" data-action="schritt" data-schritt="' + esc(s.id) + '" ' +
             'title="' + was + ': ' + esc(s.id) + ' &middot; ' + esc(s.nm) + '">' + zeichen + '</button>';
    };
    return '<div class="stationswahl">' + knopf(zurueck, '&#8249;', 'Zur&uuml;ck') +
      '<span class="zaehler">' + esc(schrittId) + '&#8202;/&#8202;' + n + '</span>' +
      knopf(vor, '&#8250;', 'Weiter') + '</div>';
  }

  /* ---------- Ansicht: alle Kurse ---------- */
  function alleKurse(kurse) {
    if (!kurse.length) {
      return karte('Alle Kurse', 'Noch keine Kurse',
        'In der Liste KWKurse steht noch kein Eintrag.');
    }
    var fertig = kurse.filter(function (k) { return G().fortschritt(k) === 9; }).length;
    var zeilen = kurse.map(function (k) {
      var punkte = '';
      for (var n = 1; n <= 9; n++) {
        var st = G().standVon(k, n);
        punkte += '<span class="pkt ' + st + '">' + (st === 'fertig' ? '&#10003;' : n) + '</span>';
      }
      return '<tr class="klick" data-action="kurs" data-kurs="' + esc(k.kursId) + '">' +
        '<td><span class="kid">' + esc(k.kursId) + '</span></td>' +
        '<td>' + esc(k.kurstitel) + '</td>' +
        '<td class="dim">' + esc(k.kompetenzfeld) + '</td>' +
        '<td><div class="pkte">' + punkte + '</div></td>' +
        '<td class="mono fort">' + G().fortschritt(k) + '&#8202;/&#8202;9</td></tr>';
    }).join('');

    /* Auftragsbuch statt Eyebrow-Titel-Lead: dieselben Datenfelder wie das
       Schriftfeld der Laufkarte, damit die Liste und der einzelne Kurs
       erkennbar zur selben Werkstatt gehoeren. */
    var inArbeit = kurse.filter(function (k) {
      var f = G().fortschritt(k); return f > 0 && f < 9;
    }).length;

    return '<div class="laufkarte auftragsbuch">' +
        '<div class="schriftfeld">' +
          '<div class="feld"><span class="fk">Auftragsbuch</span>' +
            '<span class="fw kennung">Kursproduktion</span></div>' +
          '<div class="feld weit"><span class="fk">Kurse</span>' +
            '<span class="fw">' + kurse.length + ' erfasst</span></div>' +
          '<div class="feld"><span class="fk">In Arbeit</span>' +
            '<span class="fw zahl">' + inArbeit + '</span></div>' +
          '<div class="feld"><span class="fk">Fertig</span>' +
            '<span class="fw zahl">' + fertig + '&#8202;/&#8202;' + kurse.length + '</span></div>' +
        '</div>' +
        '<div class="tblwrap"><table class="tbl">' +
          '<thead><tr><th>Kurs</th><th>Titel</th><th>Kompetenzfeld</th>' +
          '<th>Schritt 1&thinsp;&ndash;&thinsp;9</th><th>Stand</th></tr></thead>' +
          '<tbody>' + zeilen + '</tbody></table></div>' +
      '</div>' + legende();
  }

  /* ---------- Ansicht: ein Kurs ---------- */
  function einKurs(inh, kurs, lage) {
    if (!kurs) return karte('Kurs', 'Nicht gefunden', 'Dieser Kurs steht nicht in KWKurse.');
    var naechster = I().schritt(inh, kurs.schritt);
    return '<div class="laufkarte">' + schriftfeld(inh, kurs, null) +
        kette(inh, kurs, null) + legende(true) + '</div>' +
      ((lage && lage.ordnerFehlt) ? ohneOrdner(inh, kurs) : '') +
      (naechster ? '<div class="card naechst">' +
        '<span class="eyebrow">Als N&auml;chstes dran</span>' +
        '<h3>Schritt ' + esc(naechster.id) + ' &middot; ' + esc(naechster.nm) + '</h3>' +
        '<p class="lead">' + naechster.zweck + '</p>' +
        '<div style="margin-top:14px"><button class="knopf" data-action="schritt" ' +
        'data-schritt="' + esc(naechster.id) + '">Hier weiterarbeiten &rarr;</button></div>' +
        '</div>' : '');
  }

  /* mitGate nur dort, wo die Pruefzeichen auch gezeichnet werden — in der
     Kursliste stehen neun schlichte Felder ohne Gate-Marke. */
  function legende(mitGate) {
    return '<div class="kettenote">' +
      '<span><i class="kdot fertig"></i>erledigt</span>' +
      '<span><i class="kdot inArbeit"></i>in Arbeit</span>' +
      '<span><i class="kdot"></i>offen</span>' +
      (mitGate ? '<span><i class="kdot gate"></i>&#9873; Gate &mdash; hier entscheidet ein Mensch</span>' : '') +
      '</div>';
  }

  /* ---------- Ansicht: ein Schritt ---------- */
  function einSchritt(inh, kurs, schrittId, offenesWerkzeug, ablageDaten) {
    ablageDaten = ablageDaten || {};
    var s = I().schritt(inh, schrittId);
    if (!s) return karte('Schritt', 'Unbekannt', 'Diesen Schritt gibt es nicht.');

    var stand = kurs ? G().standVon(kurs, +schrittId) : 'offen';
    var fertig = stand === 'fertig';
    var am = ((inh.schritte && inh.schritte.autoMeta) || {})[s.auto];
    var anleitung = I().anleitungVon(inh, schrittId);
    var hilfsmittel = I().hilfsmittelVon(inh, schrittId);
    var ablage = I().ablageVon(inh, schrittId, kurs ? kurs.kursId : '<Kurs>');
    var typMeta = (inh.werkzeuge && inh.werkzeuge.typMeta) || {};

    var zielUrl = (ablage && ablageDaten.basisUrl)
      ? ablageDaten.basisUrl + '/' + encodeURIComponent(ablage.ordner) : null;

    /* --- Die Laufkarte: Schriftfeld und Fertigungsstrasse --- */
    var h = '<div class="laufkarte">' +
      schriftfeld(inh, kurs, s) +
      kette(inh, kurs, schrittId) + '</div>';

    h += '<div class="werkbank">';

    /* --- ARBEIT: was tue ich, womit --- */
    h += '<div class="arbeit">';
    h += '<header class="sk"><span class="stelle">Station ' + esc(s.id) + ' von 9</span>' +
         '<h1>' + esc(s.nm) + '</h1>' +
         '<div class="marken">' +
           (am ? '<span class="marke ' + esc(s.auto) + '">' + esc(am.label) + '</span>' : '') +
           (s.tool ? '<span class="marke tool">' + esc(s.tool) + '</span>' : '') +
           (s.gate ? '<span class="marke pruefstelle">&#9873; ' + esc(s.gate) + '</span>' : '') +
         '</div></header>';

    h += '<p class="zweck">' + s.zweck + '</p>';

    var schritte = anleitung ? (anleitung.steps || []) : (s.taet || []);
    h += '<h2 class="tun">So gehst du vor</h2>';
    h += '<ol class="rezept">' + schritte.map(function (x) {
      return '<li><span>' + x + '</span></li>';
    }).join('') + '</ol>';

    /* Das Werkzeug steht direkt nach der Anleitung, die es erwaehnt —
       nicht hinter den Leitplanken. Der Masterprompt zuerst. */
    if (hilfsmittel.length) {
      var prompts = hilfsmittel.filter(function (w) { return w.type === 'prompt'; });
      var zubehoer = hilfsmittel.filter(function (w) { return w.type !== 'prompt'; });

      if (prompts.length) {
        h += '<h2 class="tun">' + (prompts.length > 1 ? 'Deine Masterprompts' : 'Dein Masterprompt') +
             '<span class="tun-sub">kopieren und in Claude oder ChatGPT einf&uuml;gen</span></h2>';
        h += '<div class="wtools">' + prompts.map(function (w) {
          return werkzeug(w, typMeta, offenesWerkzeug === w.id);
        }).join('') + '</div>';
      }
      if (zubehoer.length) {
        h += '<h2 class="tun">Dazu</h2>';
        h += '<div class="wtools">' + zubehoer.map(function (w) {
          return werkzeug(w, typMeta, offenesWerkzeug === w.id);
        }).join('') + '</div>';
      }
    }

    if (anleitung && (anleitung.dos || []).length) {
      h += '<h2 class="tun">Leitplanken</h2>';
      h += '<div class="dd">' +
        '<div class="ddc do"><h5>Do</h5><ul>' +
          anleitung.dos.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') +
        '</ul></div>' +
        '<div class="ddc dont"><h5>Don\'t</h5><ul>' +
          (anleitung.donts || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') +
        '</ul></div></div>';
    }

    /* --- Ergebnis ablegen: der Weg Chat --- */
    if (kurs && I().darfAblegen(inh, schrittId)) {
      /* Den Zielnamen erst nennen, wenn der Ordner wirklich gelesen ist —
         sonst verspricht die Ansicht _v1, obwohl dort schon _v3 liegt. */
      var ziel = Array.isArray(ablageDaten.dateien)
        ? I().naechsteDatei(inh, schrittId, kurs.kursId, ablageDaten.dateien)
        : null;
      h += '<h2 class="tun">Ergebnis ablegen' +
           '<span class="tun-sub">aus Claude oder ChatGPT hierher zur&uuml;ck</span></h2>';
      h += '<div class="ablegen">' +
        '<textarea id="ergebnis" rows="6" spellcheck="false" ' +
          'placeholder="Antwort der KI hier einf&uuml;gen &hellip;"></textarea>' +
        '<div class="arow">' +
          '<button class="knopf gross" data-action="ablegen" data-schritt="' + esc(schrittId) + '">' +
            'Ablegen</button>' +
          (ziel ? '<span class="zielname">wird zu <code>' + esc(ziel.ordner) + '/' +
                  esc(ziel.datei) + '</code></span>'
                : '<span class="dim">Ordner wird gelesen &hellip;</span>') +
        '</div>' +
        '<p class="klemmt" id="ablegefehler" hidden></p>' +
        '<p class="dim">Die Kurswerkstatt vergibt Ordner und Dateinamen nach dem ' +
        'Ablage-Kontrakt. Du tippst keinen Pfad.</p>' +
      '</div>';
    }

    /* --- Der Weg Hochladen: fuer Lieferobjekte, die nicht als Text entstehen ---
           Excel (Schritt 3) und der Moodle-Export (Schritt 7). Der Name wird
           angezeigt, nicht getippt — abgetippte Namen waren die Fehlerquelle. */
    if (kurs && I().darfHochladen(inh, schrittId) && !ablageDaten.ordnerFehlt) {
      var hziel = Array.isArray(ablageDaten.dateien)
        ? I().hochladeZiel(inh, schrittId, kurs.kursId, ablageDaten.dateien)
        : null;
      var endung = I().erwarteteEndung(inh, schrittId);
      h += '<h2 class="tun">Datei hochladen' +
           '<span class="tun-sub">die Kurswerkstatt vergibt Ordner und Namen</span></h2>';
      h += '<div class="ablegen">' +
        '<input type="file" id="datei"' +
          (endung ? ' accept=".' + esc(endung) + '"' : '') + ' />' +
        '<div class="arow">' +
          '<button class="knopf gross" data-action="hochladen" data-schritt="' +
            esc(schrittId) + '">Hochladen</button>' +
          (hziel ? '<span class="zielname">wird zu <code>' + esc(hziel.ordner) + '/' +
                   esc(hziel.datei) + '</code></span>'
                 : '<span class="dim">Ordner wird gelesen &hellip;</span>') +
        '</div>' +
        '<p class="klemmt" id="hochladefehler" hidden></p>' +
        '<p class="dim">Wie die Datei auf deinem Rechner heisst, spielt keine Rolle &mdash; ' +
        'abgelegt wird sie unter dem Namen aus dem Ablage-Kontrakt. ' +
        (hziel && hziel.version ? 'Das wird Version ' + hziel.version + '. ' : '') +
        'Du tippst keinen Pfad und keinen Dateinamen.</p>' +
      '</div>';
    }

    /* --- Schritt 2 schreibt eine Systemdatei, kein Dokument: Knopf statt Textfeld.
           Erst wenn der Ordner steht — sonst gehoert der Arbeitsplatz Schritt 1. --- */
    if (kurs && +schrittId === 2 && !ablageDaten.ordnerFehlt) {
      h += manifestBlock(inh, kurs);
      h += instruktionenBlock(inh, kurs, ablageDaten.briefing);
    }

    if (anleitung && anleitung.dod) {
      h += '<div class="dod"><span class="h">Fertig, wenn</span>' + esc(anleitung.dod) + '</div>';
    }

    h += '<div class="fuss">' +
      (kurs ? '<button class="haken' + (fertig ? ' an' : '') + '" data-action="erledigt" ' +
              'data-schritt="' + esc(s.id) + '"><span class="box">&#10003;</span>' +
              (fertig ? 'Schritt erledigt' : 'Als erledigt markieren') + '</button>' : '') +
      (+s.id < 9 ? '<button class="weiter" data-action="schritt" data-schritt="' + (+s.id + 1) + '"' +
                   (fertig ? '' : ' disabled') + '>Weiter zu Station ' + (+s.id + 1) + ' &rsaquo;</button>' : '') +
      '<p class="wirkung">' + (fertig
        ? 'Der Stand steht in KWKurse &mdash; alle sehen diesen Kurs jetzt weiter vorn.'
        : '&bdquo;Weiter&ldquo; wird frei, sobald der Schritt erledigt ist. So bleibt die Reihenfolge gewahrt.') +
      '</p></div>';
    h += '</div>';

    /* --- KONTEXT: schmale Spalte, keine Karten --- */
    h += '<aside class="kontext">';

    h += '<div class="kblock"><h3>Kommt herein</h3>' +
      (s.her || []).map(function (x) {
        if (!x.von) return '<p>' + esc(x.was) + '<em>von ausserhalb der Linie</em></p>';
        var vorAb = I().ablageVon(inh, x.von, kurs ? kurs.kursId : '<Kurs>');
        var url = ablageDaten.basisUrl && vorAb
          ? ablageDaten.basisUrl + '/' + encodeURIComponent(vorAb.ordner) : null;
        return '<p>' + esc(x.was) +
          '<a data-action="schritt" data-schritt="' + x.von + '">Station ' + x.von + ' ansehen</a>' +
          (url ? '<a class="oeffnen" href="' + esc(url) + '" target="_blank" rel="noopener">' +
                 esc(vorAb.ordner) + ' &#8599;</a>' : '') + '</p>';
      }).join('') + '</div>';

    h += '<div class="kblock"><h3>Geht weiter</h3>' +
      (s.hin || []).map(function (x) {
        return '<p>' + esc(x.was) + (x.an ? '<a data-action="schritt" data-schritt="' + x.an +
               '">Station ' + x.an + ' ansehen</a>' : '') + '</p>';
      }).join('') + '</div>';

    if (s.wege && s.wege.length) {
      h += '<div class="kblock"><h3>Weg</h3><div class="wege">' + s.wege.map(function (w) {
        var t = { chat: 'Im Chat', 'claude-code': 'Mit Claude Code', hand: 'Von Hand',
                  kurswerkstatt: 'Macht die Kurswerkstatt' }[w] || w;
        return '<span class="weg ' + esc(w) + '">' + esc(t) + '</span>';
      }).join('') + '</div></div>';
    }

    h += '<div class="kblock"><h3>Was entsteht</h3><p>' + s.lief + '</p></div>';

    if (ablage) {
      h += '<div class="kblock"><h3>Wohin es kommt</h3>' +
        (zielUrl
          ? '<a class="pfad" href="' + esc(zielUrl) + '" target="_blank" rel="noopener">' +
            esc(ablage.ordner) + '/<b>' + esc(ablage.datei) + '</b> &#8599;</a>'
          : '<span class="pfad">' + esc(ablage.ordner) + '/<b>' + esc(ablage.datei) + '</b></span>') +
        (ablageDaten.ordnerFehlt ? '' : '<em>Legt die Kurswerkstatt an &mdash; du tippst keinen Pfad.</em>') +
        '</div>';
      h += ablageDaten.ordnerFehlt ? ohneOrdner(inh, kurs) : dateiliste(ablageDaten.dateien, zielUrl, ablage.ordner);
    }

    h += '</aside></div>';
    return h;
  }

  /* Ein Kurs ohne Ordner in der Bibliothek. Das trifft jeden neu angelegten Kurs,
     und es traf bisher erst beim Klick auf Ablegen — also nachdem die Arbeit
     getan war. Lieber vorher sagen, was fehlt und wer es anlegen muss. */
  /* Der Kursordner fehlt — das ist kein Hinweis, sondern der erste Teil von Schritt 1.
     Deshalb steht hier ein Arbeitsplatz und kein Merkzettel. Vorgeschlagen wird der
     Name aus dem Kurstitel; bindend ist laut Kontrakt allein das Praefix. */
  function ohneOrdner(inh, kurs) {
    if (!kurs) return '';
    var id = esc(kurs.kursId);
    var vorschlag = I().kursordnerName(kurs.kursId, kurs.kurstitel);
    var ordner = I().ordnerliste(inh);

    return '<div class="fehlt"><h4>Ablage anlegen</h4>' +
      '<p>F&uuml;r <b>' + id + '</b> gibt es in der Bibliothek <b>Kursproduktion</b> ' +
      'noch keinen Ordner. Bevor etwas abgelegt werden kann, muss er stehen &mdash; ' +
      'das ist der erste Teil von Schritt 1.</p>' +
      '<div class="arow">' +
        '<input id="ordnername" type="text" spellcheck="false" value="' + esc(vorschlag) + '" />' +
        '<button class="knopf gross" data-action="ablage-anlegen">Ablage anlegen</button>' +
      '</div>' +
      '<p class="klemmt" id="ordnerfehler" hidden></p>' +
      '<p class="dim">Bindend ist nur <code>' + id + '_</code> &mdash; danach sind ' +
      'Kleinbuchstaben, Ziffern und Bindestriche erlaubt. Angelegt werden ' +
      ordner.length + ' Unterordner: <code>' + ordner.map(esc).join('</code> <code>') +
      '</code></p></div>';
  }

  /* Die Projekt-Instruktionen fuer die beiden KI-Projekte. Fertig erzeugt aus
     Kontrakt + KWKurse + dem eingelesenen Briefing — keine Platzhalter, keine
     Eingabefelder. Genau das war vorher Handarbeit an sechs Feldern. */
  function instruktionenBlock(inh, kurs, briefing) {
    /* Zwei Fassungen aus derselben Quelle — dieselben Umschalter wie beim Masterprompt,
       damit sie sich gleich bedienen und die Ereignisbehandlung wiederverwendet wird. */
    var fass = [
      { k: 'claude',  t: 'Claude'  },
      { k: 'chatgpt', t: 'ChatGPT' }
    ].map(function (f) {
      f.txt = I().projektInstruktionen(inh, kurs, briefing, f.k);
      return f;
    });
    var quelle = briefing === undefined
      ? '<span class="dim">Briefing wird gelesen &hellip;</span>'
      : (briefing
          ? '<span class="zielname">Briefing aus <code>01_briefing/</code> eingelesen &mdash; ' +
            briefing.length + ' Zeichen</span>'
          : '<span class="klemmt-inline">Kein freigegebenes Briefing in <code>01_briefing/</code> ' +
            '&mdash; die Instruktionen tragen an dieser Stelle einen Platzhalter.</span>');

    return '<h2 class="tun">Projekt-Instruktionen' +
        '<span class="tun-sub">in Claude und ChatGPT als Projekt-Anweisung einf&uuml;gen</span></h2>' +
      '<div class="wtool instrument auf">' +
        '<div class="wkopf">' +
          '<span class="tt">Instruktion</span>' +
          '<div class="wtitel"><h3>Projekt-Instruktionen &middot; ' + esc(kurs.kursId) + '</h3>' +
            '<p>Gleicher Inhalt, je Werkzeug zugeschnitten &mdash; fertig ausgef&uuml;llt</p></div>' +
          '<button class="knopf gross" data-action="kopieren-instruktionen">Kopieren</button>' +
        '</div>' +
        '<div class="wbody">' +
          '<div class="arow">' + quelle + '</div>' +
          '<div class="ptabs">' + fass.map(function (f, i) {
            return '<button class="ptab' + (i === 0 ? ' on' : '') + '" data-action="fassung" ' +
                   'data-fassung="' + f.k + '">' + f.t + '</button>';
          }).join('') + '</div>' +
          fass.map(function (f, i) {
            return '<pre class="prompt' + (i === 0 ? ' on' : '') + '" data-box="' + f.k + '">' +
                   esc(f.txt) + '</pre>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  /* Schritt 2 legt kein Dokument ab, sondern schreibt eine Systemdatei.
     Deshalb ein Knopf statt eines Textfelds. */
  function manifestBlock(inh, kurs) {
    var ab = I().ablageVon(inh, 2, kurs.kursId);
    if (!ab) return '';
    return '<h2 class="tun">Manifest schreiben' +
        '<span class="tun-sub">ohne KI &mdash; die Kurswerkstatt erledigt es selbst</span></h2>' +
      '<div class="ablegen">' +
        '<div class="arow">' +
          '<button class="knopf gross" data-action="manifest-schreiben">Manifest schreiben</button>' +
          '<span class="zielname">wird zu <code>' + esc(ab.ordner) + '/' +
            esc(ab.datei) + '</code></span>' +
        '</div>' +
        '<p class="klemmt" id="manifestfehler" hidden></p>' +
        '<p class="dim">Inhalt: Kurs-ID, Titel, Kompetenzfeld und Anlagedatum &mdash; ' +
        'alles aus <b>KWKurse</b>. Keine Version: eine Systemdatei ohne Entwurfsphase.</p>' +
      '</div>';
  }

  /* ---------- Ansicht: Nachschlagen ---------- */
  function nachschlagen(inh, werkId) {
    var r = inh.referenz || {};
    var werke = ['didaktik', 'promptcraft', 'governance'].filter(function (k) { return r[k]; });
    if (!werke.length) return karte('Nachschlagen', 'Keine Inhalte', 'referenz.json fehlt.');
    var aktiv = werke.indexOf(werkId) >= 0 ? werkId : werke[0];
    var w = r[aktiv];

    /* Kopf im Stil des Schriftfelds — dieselbe Sprache wie die Laufkarte. */
    var h = '<div class="werkkopf"><div class="schriftfeld">' +
      '<div class="feld"><span class="fk">Nachschlagewerk</span>' +
        '<span class="fw kennung">' + esc(aktiv) + '</span></div>' +
      '<div class="feld weit"><span class="fk">Titel</span>' +
        '<span class="fw">' + esc(w.titel) + '</span></div>' +
      '<div class="feld"><span class="fk">Kapitel</span>' +
        '<span class="fw zahl">' + w.abschnitte.length + '</span></div>' +
      '</div>' +
      '<nav class="werkwahl">' + werke.map(function (k) {
        return '<button class="' + (k === aktiv ? 'on' : '') + '" data-action="werk" ' +
               'data-werk="' + k + '">' + esc(r[k].titel) + '</button>';
      }).join('') + '</nav></div>';

    /* Inhaltsverzeichnis links, Text rechts — ein Nachschlagewerk liest man,
       man scrollt es nicht. */
    h += '<div class="werkbank werk">';
    h += '<div class="werktext">' + w.abschnitte.map(function (a, i) {
      return '<section class="kapitel" id="kap-' + i + '">' +
             '<h2><span class="knr">' + (i + 1) + '</span>' + a.h + '</h2>' +
             '<div class="inhalt">' + entschaerfe(a.html) + '</div></section>';
    }).join('') + '</div>';
    h += '<aside class="kontext"><div class="kblock"><h3>Kapitel</h3>' +
      '<ol class="kapliste">' + w.abschnitte.map(function (a, i) {
        return '<li><a href="#kap-' + i + '">' + a.h + '</a></li>';
      }).join('') + '</ol></div></aside>';
    return h + '</div>';
  }

  /* ---------- Hilfen ---------- */
  function abschnitt(t) {
    return '<div class="seclbl"><h3>' + t + '</h3><span class="rule"></span></div>';
  }
  function karte(eyebrow, titel, text) {
    return '<div class="card"><span class="eyebrow">' + esc(eyebrow) + '</span>' +
           '<h2>' + esc(titel) + '</h2><p class="lead">' + esc(text) + '</p></div>';
  }

  root.ansichten = {
    kette: kette, schriftfeld: schriftfeld, werkzeug: werkzeug, dateiliste: dateiliste,
    alleKurse: alleKurse, einKurs: einKurs, einSchritt: einSchritt, nachschlagen: nachschlagen,
    entschaerfe: entschaerfe, standort: standort, ohneOrdner: ohneOrdner
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { ansichten: root.ansichten };
})(typeof globalThis !== 'undefined' ? globalThis : this);
