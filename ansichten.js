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

  /* ---------- Die Linie: eine Fertigungsstrasse mit acht Stationen ----------
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
      f.push(['Stand', G().fortschritt(kurs) + '&#8202;/&#8202;8', 'zahl']);
    }
    if (s) {
      var ph = I().phaseVon(inh, s.id);
      f.push(['Station', esc(s.id) + '&#8202;/&#8202;8', 'zahl']);
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
    var fertig = kurse.filter(function (k) { return G().fortschritt(k) === 8; }).length;
    var zeilen = kurse.map(function (k) {
      var punkte = '';
      for (var n = 1; n <= 8; n++) {
        var st = G().standVon(k, n);
        punkte += '<span class="pkt ' + st + '">' + (st === 'fertig' ? '&#10003;' : n) + '</span>';
      }
      return '<tr class="klick" data-action="kurs" data-kurs="' + esc(k.kursId) + '">' +
        '<td><span class="kid">' + esc(k.kursId) + '</span></td>' +
        '<td>' + esc(k.kurstitel) + '</td>' +
        '<td class="dim">' + esc(k.kompetenzfeld) + '</td>' +
        '<td><div class="pkte">' + punkte + '</div></td>' +
        '<td class="mono fort">' + G().fortschritt(k) + '&#8202;/&#8202;8</td></tr>';
    }).join('');

    /* Auftragsbuch statt Eyebrow-Titel-Lead: dieselben Datenfelder wie das
       Schriftfeld der Laufkarte, damit die Liste und der einzelne Kurs
       erkennbar zur selben Werkstatt gehoeren. */
    var inArbeit = kurse.filter(function (k) {
      var f = G().fortschritt(k); return f > 0 && f < 8;
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
          '<th>Schritt 1&thinsp;&ndash;&thinsp;8</th><th>Stand</th></tr></thead>' +
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
      ((lage && lage.dossier) ? quellenVerzeichnisBlock(lage.dossier) : '') +
      (naechster ? '<div class="card naechst">' +
        '<span class="eyebrow">Als N&auml;chstes dran</span>' +
        '<h3>Schritt ' + esc(naechster.id) + ' &middot; ' + esc(naechster.nm) + '</h3>' +
        '<p class="lead">' + naechster.zweck + '</p>' +
        '<div style="margin-top:14px"><button class="knopf" data-action="schritt" ' +
        'data-schritt="' + esc(naechster.id) + '">Hier weiterarbeiten &rarr;</button></div>' +
        '</div>' : '');
  }

  /* mitGate nur dort, wo die Pruefzeichen auch gezeichnet werden — in der
     Kursliste stehen acht schlichte Felder ohne Gate-Marke. */
  function legende(mitGate) {
    return '<div class="kettenote">' +
      '<span><i class="kdot fertig"></i>erledigt</span>' +
      '<span><i class="kdot inArbeit"></i>in Arbeit</span>' +
      '<span><i class="kdot"></i>offen</span>' +
      (mitGate ? '<span><i class="kdot gate"></i>&#9873; Gate &mdash; hier entscheidet ein Mensch</span>' : '') +
      '</div>';
  }

  /* ---------- Das Briefing-Formular (Schritt 1) ----------
     Acht generische Angaben plus die Scope-Quelle. Sie werden hier gefragt, weil
     sie kein Urteil brauchen — und weil ein Chat, der sie erfragt, Rueckfragen
     ohne Erkenntnis erzeugt (Markus, 2026-07-29). */
  function briefingFormular(inh, kurs, ablageDaten) {
    var I2 = I();
    var werte = (ablageDaten && ablageDaten.briefingFelder) || {};
    var gelesen = ablageDaten && ablageDaten.briefingFelderGelesen;
    var fehlend = I2.briefingFehlend(werte);
    var ordnerFehlt = !!(ablageDaten && ablageDaten.ordnerFehlt);

    /* Kaltstart (Audit I7): fehlt der Kursordner noch, ist der ganze Block hier
       unten Attrappe — Erfassen und Sichern wuerden ohnehin an den Guards in
       app.js scheitern (Doppelschutz, die Guards bleiben). Bevor jemand Angaben
       eintippt, die nirgends hinkoennen, steht das hier zuerst und deutlich —
       ueber dem Quellen-Block UND dem Formular, die beide gleich folgen. */
    var h = ordnerFehlt
      ? '<div class="box achtung"><span class="bt">Zuerst die Ablage anlegen</span>' +
        'Ohne Kursordner kann nichts gesichert werden.</div>'
      : '';

    /* Quellen VOR den Leitplanken (Entscheid Markus 2026-07-30): erst sammeln,
       was hereinkommt, dann daraus die Leitplanken formulieren — scope_quelle
       kann anschliessend auf die hier erfassten Q-IDs verweisen. */
    h += quellenBlock(inh, ablageDaten);

    h += '<h2 class="tun">Die Leitplanken' +
            '<span class="tun-sub">was der Kurs voraussetzt und was er abdeckt &mdash; ' +
            'einmal ausgef&uuml;llt, danach fragt der Chat nicht mehr danach</span></h2>';

    h += '<div class="box formular" id="briefing-felder">';

    var d = ablageDaten.dossier;
    var st = root.dossier ? root.dossier.statusVon(d, 'briefing') : 'entwurf';
    h += '<p class="hinweis-leise">Briefing: ' + esc(st) +
         (root.dossier && root.dossier.banner(st) ? ' &middot; ' + esc(root.dossier.banner(st)) : '') + '</p>';

    /* Z7: das geltende Briefing kann eine neu erfasste Quelle noch nicht
       spiegeln — genau der VL-002-Fall entstand hier, in Schritt 1 selbst,
       als nach einer neuen Quelle niemand das Briefing nachzog. */
    h += quellenSpiegelBox(ablageDaten);

    if (gelesen === false) {
      h += '<div class="hinweis-leise">Noch nicht nachgesehen &mdash; die Felder werden ' +
           'geladen, sobald der Ordner erreichbar ist.</div>';
    }

    I2.BRIEFING_FELDER.forEach(function (f) {
      var wert = String(werte[f.id] || '');
      /* Ein Haekchen kennt kein "leer" (Etappe 1e, Task 6, wie briefingFehlend
         in inhalt.js) — nicht angehakt ist eine vollstaendige Antwort, keine
         fehlende, deshalb hier von der offen-Markierung ausgenommen. Ein
         form:'abgeleitet'-Feld (Z4, scope_quelle) ebenso: es hat kein Eingabe-
         Feld mehr, das leer sein koennte. */
      var leer = f.form !== 'haken' && f.form !== 'abgeleitet' && !wert.trim();
      h += '<div class="feld' + (f.pflicht && leer ? ' offen' : '') + '">';
      h += '<label for="bf-' + f.id + '"><b>' + esc(f.label) + '</b>' +
           (f.einheit ? ' <span class="einheit">(' + esc(f.einheit) + ')</span>' : '') +
           (f.pflicht || f.form === 'abgeleitet' ? '' : ' <span class="einheit">optional</span>') + '</label>';
      h += '<div class="hilfe">' + esc(f.hilfe) + '</div>';
      if (f.fest) {
        h += '<div class="fest">Gilt fest: ' + esc(f.fest) + '</div>';
      }
      if (f.form === 'zahl') {
        h += '<input type="number" step="' + f.schritt + '" min="0" id="bf-' + f.id +
             '" data-feld="' + f.id + '" value="' + esc(wert) + '" placeholder="' +
             esc(f.beispiel) + '">';
      } else if (f.form === 'haken') {
        h += '<label><input type="checkbox" id="bf-' + f.id + '" data-feld="' + f.id + '"' +
             (wert === 'true' ? ' checked' : '') + '> Ja</label>';
      } else if (f.form === 'abgeleitet') {
        /* Kein Eingabefeld (Z4, Entscheid Markus 2026-07-30): der Wert kommt
           IMMER live aus dem geladenen Dossier (d), nie aus werte — werte kennt
           dieses Feld gar nicht mehr, ein veralteter Formular- oder
           Dossier-Stand wuerde sonst genau den VL-002-Fehler wiederholen. Ohne
           Dossier (d undefined, z. B. waehrend es noch laedt) liefert
           abgeleitet(undefined) sicher den Leer-Fall. */
        h += '<div class="fest">' + esc(f.abgeleitet ? f.abgeleitet(d) : '') + '</div>';
      } else {
        h += '<textarea id="bf-' + f.id + '" data-feld="' + f.id + '" rows="' + (f.zeilen || 3) +
             '" placeholder="' + esc(f.beispiel) + '">' + esc(wert) + '</textarea>';
      }
      h += '</div>';
    });

    h += '<div class="formular-fuss">';
    h += '<button class="knopf" data-action="briefing-felder-speichern"' +
         (ordnerFehlt ? ' disabled' : '') + '>Angaben sichern</button>';
    h += fehlend.length
      ? '<span class="offen-zahl">' + fehlend.length + ' offen: ' + esc(fehlend.join(', ')) + '</span>'
      : '<span class="offen-zahl gut">&#10003; vollst&auml;ndig &mdash; der Chat muss nichts mehr abfragen</span>';
    h += '<span class="hinweis-leise" id="briefing-felder-melde" hidden></span>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  /* ---------- Das Quellenverzeichnis ----------
     Eine Quelle pro Begriff: dieser Builder rendert die Tabelle, egal ob er aus
     dem Erfassungs-Formular (Schritt 1), der Kursansicht oder Schritt 3 kommt —
     erfasst wird nur in Schritt 1, sichtbar ist es an allen drei Stellen
     (Entscheid Markus, 2026-07-30). Bei einer Datei steht der reine Dateiname
     (der SharePoint-Ordnerlink existiert nur in der Schrittansicht); bei einem
     Link ein <a>, esc() auch im href-Attribut — der Wert kommt vom Menschen.
     Rueckfallebene (Fix-Runde 1): esc() filtert kein Schema, nur Zeichen — ein
     dossier.json mit url "javascript:…" muesste dossier.pruefe() eigentlich
     schon abweisen, aber sollte trotzdem je ein anderer Leseweg ein solches
     Dossier durchlassen, wird hier zusaetzlich nur bei http(s) ein <a> gebaut,
     sonst bleibt die URL reiner esc()-Text — nie ein klickbares href.
     mitEntfernen (Etappe 1c, Entscheid Markus 2026-07-30): nur Schritt 1 ruft
     mit true und bekommt je Zeile den Entfernen-Knopf; Kursansicht und Schritt 3
     bleiben ohne Parameter, also lesend — rueckwaertskompatibel, weil undefined
     falsy ist. */
  function quellenVerzeichnis(d, mitEntfernen, entfernenGesperrt) {
    var ql = (d && d.quellen) || [];
    if (!ql.length) return '<p class="hinweis-leise">Noch keine Quellen erfasst.</p>';
    var h = '<div class="tblwrap"><table class="tbl"><tr><th>ID</th><th>Titel</th><th>Stand</th><th>Quelle</th>' +
            (mitEntfernen ? '<th></th>' : '') + '</tr>';
    ql.forEach(function (q) {
      var quelle = (q.url && /^https?:\/\//i.test(String(q.url).trim()))
        ? '<a href="' + esc(q.url) + '" target="_blank" rel="noopener">' + esc(q.url) + '</a>'
        : esc(q.url || q.datei);
      h += '<tr><td>' + esc(q.id) + '</td><td>' + esc(q.titel) +
           (q.herausgeber ? ' (' + esc(q.herausgeber) + ')' : '') + '</td><td>' +
           esc(q.stand) + '</td><td>' + quelle + '</td>' +
           (mitEntfernen ? '<td><button class="knopf still" data-action="quelle-entfernen" ' +
             'data-quelle="' + esc(q.id) + '"' + (entfernenGesperrt ? ' disabled' : '') +
             '>Entfernen</button></td>' : '') +
           '</tr>';
    });
    h += '</table></div>';
    return h;
  }

  /* Der Block fuer die lesenden Stellen (Kursansicht, Schritt 3) — mit eigener
     Ueberschrift, sonst gleicher Inhalt wie im Schritt-1-Formular. */
  function quellenVerzeichnisBlock(d) {
    return '<div class="box" id="quellenverzeichnis"><h3>Quellenverzeichnis</h3>' +
           quellenVerzeichnis(d) + '</div>';
  }

  /* ---------- Der Quellen-Block (Schritt 1) ----------
     Ablegen und Dossier-Eintrag sind EIN Vorgang (Spec §5.6) — hier steht nur die
     Erfassung dafuer, die Aktion selbst macht controller.quelleErfassen in app.js. */
  function quellenBlock(inh, ablageDaten) {
    var d = ablageDaten && ablageDaten.dossier;
    var ordnerFehlt = !!(ablageDaten && ablageDaten.ordnerFehlt);
    /* Der Ordnerpfad kommt von inhalt.quellenOrdner() — EINE Stelle statt einem
       hier fest getippten Namen (Audit I3). Aendert sich der Schritt-3-Ordner im
       Ablage-Kontrakt, geht dieser Hinweistext automatisch mit. */
    var quellenOrdner = I().quellenOrdner(inh);
    var h = '<div class="box formular" id="quellen">';
    h += '<h3>Fachquellen</h3>';
    h += '<p class="hinweis-leise">Massgebende Quellen &mdash; sie werden nach ' +
         esc(quellenOrdner) + '/ gelegt und im Dossier eingetragen, in einem Zug. ' +
         'Altmaterial geh&ouml;rt nach 00_input, nicht hierher.</p>';
    h += '<ul class="hinweis-leise">' +
         '<li><b>Kursausschreibung</b> &mdash; das Leistungsversprechen, meist als Link</li>' +
         '<li><b>Massgebende Systematik oder Standard</b> mit Jahrgang (z.&nbsp;B. eine Branchen-Map) &mdash; als Datei</li>' +
         '<li><b>Gesetze, Verordnungen, Aufsichts- und Verbandspublikationen</b>, auf die sich der ' +
           'Scope st&uuml;tzt &mdash; als Datei (PDF), Stand zwingend</li>' +
         '<li><b>Fachliteratur</b>, soweit massgebend</li>' +
         '<li><b>Nicht hierher:</b> Altmaterial (bisherige Kursunterlagen) &mdash; das geh&ouml;rt nach 00_input</li>' +
         '<li><b>Gibt es keine validen Quellen:</b> Modus &laquo;quellenfrei&raquo; setzen, nicht raten</li>' +
         '</ul>';
    h += quellenVerzeichnis(d, true, ordnerFehlt);
    h += '<label>Titel <input id="quelle-titel" type="text"></label>';
    h += '<label>Herausgeber <input id="quelle-herausgeber" type="text"></label>';
    h += '<label>Stand <input id="quelle-stand" type="text" placeholder="z. B. 2025 oder 2026-01-01"></label>';
    h += '<label>Datei <input id="quelle-datei" type="file"></label>';
    h += '<label>Link (URL) <input id="quelle-url" type="text"></label>';
    h += '<p class="hinweis-leise">Datei ODER Link — massgebende Rechtstexte als Datei (PDF), ' +
         'Links für Ausschreibungen und Referenzseiten.</p>';
    h += '<button class="knopf" data-action="quelle-erfassen"' + (ordnerFehlt ? ' disabled' : '') +
         '>Quelle erfassen</button>';
    h += '<span class="hinweis-leise" id="quelle-melde" hidden></span>';
    var modus = (d && d.content_modus) || 'quellengestuetzt';
    h += '<p><label><input type="radio" name="content-modus" value="quellengestuetzt" data-action="content-modus"' +
         (modus === 'quellengestuetzt' ? ' checked' : '') + (ordnerFehlt ? ' disabled' : '') +
         '> quellengest&uuml;tzt</label> ' +
         '<label><input type="radio" name="content-modus" value="quellenfrei" data-action="content-modus"' +
         (modus === 'quellenfrei' ? ' checked' : '') + (ordnerFehlt ? ' disabled' : '') +
         '> quellenfrei (reiner KI-Entwurf)</label></p>';
    h += '</div>';
    return h;
  }

  /* ---------- Der Quellen-Spiegel-Waechter (Z7, Schritt 1 und 2) ----------
     Live-Befund VL-002 (2026-07-31, zweimal): das Dossier bekam eine neue
     Quelle, aber das geltende Briefing (der Frontmatter-Spiegel) trug still
     die alten — niemand sah es, bis die KI-Ausgabe Widersprueche zeigte.
     EIN Helfer statt zweier Kopien (Konvention 9): Schritt 1 UND Schritt 2
     laden das geltende Briefing bereits (s. app.js briefingNachladen), beide
     rufen denselben Baustein. Kein Kasten, solange das Briefing noch laedt
     oder nicht gefunden wurde (briefing null/leer — dafuer gibt es die
     bestehenden Anzeigen) oder solange nichts fehlt. Der Contract-Steckbrief
     (xlsx) wird hier bewusst NICHT geprueft — er ist im Browser nicht lesbar,
     dafuer ist contract-pruefen/T11 zustaendig (s. CLAUDE.md). */
  function quellenSpiegelBox(ablageDaten) {
    var briefing = ablageDaten && ablageDaten.briefing;
    var d = ablageDaten && ablageDaten.dossier;
    if (briefing == null || briefing === '' || !d || typeof d !== 'object') return '';
    var spiegel = I().quellenSpiegel(briefing, d);
    if (!spiegel || !spiegel.fehlend.length) return '';
    var n = spiegel.gesamt, f = spiegel.fehlend.length;
    return '<div class="box achtung"><span class="bt">&#9888; Quellen-Spiegel unvollst&auml;ndig</span>' +
      'Das geltende Briefing spiegelt ' + esc(String(n - f)) + ' von ' + esc(String(n)) +
      ' Quellen &mdash; ' + esc(spiegel.fehlend.join(', ')) + ' fehlen. Briefing-Prompt neu ' +
      'kopieren, Briefing neu erzeugen und ablegen.</div>';
  }

  /* ---------- Die Review-Ansicht (V5, Etappe 4, Schritt 4 — Sign-off) ----------
     Rein lesend — die App verwaltet nichts (Leitsatz aus der Meta-Architektur):
     geaendert wird im Dokument, neu hochgeladen, die Ansicht rendert frisch. Baut
     aus der validierten Blockdatei (04_validierung), beiden Schritt-3-Varianten
     (03_content, s. app.js controller.reviewNachladen) und dem Dossier eine
     Uebersicht: Herkunfts-Zaehlung, Quellen-Deckung, offene Punkte vorn, je
     Kapitel eine aufklappbare Zeile mit Herkunft-Badge/Beleg/Divergenz und dem
     Varianten-Nebeneinander. Alle Zaehl-/Gruppierhelfer sind bewusst privat
     (nicht in inhalt.js — der Task-Brief nennt inhalt.js nicht als zu
     aendernde Datei) und nur von reviewBlock aus erreichbar. */

  var REVIEW_HERKUNFT_KLASSEN = ['bestaetigt', 'korrigiert', 'ergaenzt', 'offen'];

  /* Kopf-Zaehlung: JE Kapitel genau ein Zaehler, aus ###VALIDIERUNG/herkunft —
     nie daneben gefuehrt (Brief). Ein Kapitel ohne (oder mit unbekanntem)
     herkunft-Wert zaehlt bei KEINEM der vier Zaehler, traegt aber zu gesamt bei. */
  function reviewZaehlung(validiert) {
    var kapitel = (validiert && Array.isArray(validiert.kapitel)) ? validiert.kapitel : [];
    var z = { bestaetigt: 0, korrigiert: 0, ergaenzt: 0, offen: 0, gesamt: kapitel.length };
    kapitel.forEach(function (k) {
      var h = k.validierung && k.validierung.herkunft;
      if (z[h] !== undefined) z[h] += 1;
    });
    return z;
  }

  /* Q-ID-Extraktion NUR fuer die Anzeige — dieselbe Wortgrenzen-Regel wie
     inhalt.quellenSpiegel (Z7)/inhalt.blocksPruefe (\bQ-\d{3}\b), hier keine
     zweite Pruefungsquelle: das Gate selbst bleibt inhalt.validierungPruefe
     (V2, Regel 2). Eine eigene, kleine Kopie statt eines Imports aus
     inhalt.js, weil der Task-Brief inhalt.js nicht als zu aendernde Datei
     fuehrt (Files-Liste) — ansichten.js bleibt dadurch die eine Stelle fuer
     diese rein darstellende Frage. */
  function reviewQIds(zeilen) {
    var re = /\bQ-\d{3}\b/g;
    var gefunden = {};
    (zeilen || []).forEach(function (z) {
      var s = String(z == null ? '' : z);
      var m;
      while ((m = re.exec(s))) gefunden[m[0]] = true;
    });
    return gefunden;
  }

  /* Beide Richtungen (Brief): Dossier-Q-IDs, die in der Leseliste FEHLEN, UND
     Q-IDs in der Leseliste, die im Dossier UNBEKANNT sind. */
  function reviewQuellenDeckung(validiert, d) {
    var gelesenListe = (validiert.quellen && validiert.quellen.gelesen) || [];
    var gefunden = reviewQIds(gelesenListe);
    var dossierIds = (d.quellen || []).map(function (q) { return q && q.id; }).filter(Boolean);
    var dossierSet = {};
    dossierIds.forEach(function (id) { dossierSet[id] = true; });
    var fehlend = dossierIds.filter(function (id) { return !gefunden[id]; });
    var unbekannt = Object.keys(gefunden).filter(function (id) { return !dossierSet[id]; });
    return { gesamt: dossierIds.length, gedeckt: dossierIds.length - fehlend.length,
             fehlend: fehlend, unbekannt: unbekannt };
  }

  /* Alle Bausteintexte eines Kapitels, zusammengefuegt (Brief: "teile-Werte
     join"). */
  function reviewKapitelText(k) {
    var teile = (k && k.teile) || {};
    return Object.keys(teile).map(function (n) { return teile[n]; }).join('\n');
  }

  function reviewNeuZahl(k) {
    var m = reviewKapitelText(k).match(/\[NEU/g);
    return m ? m.length : 0;
  }

  function reviewNeuGesamt(validiert) {
    return (validiert.kapitel || []).reduce(function (n, k) { return n + reviewNeuZahl(k); }, 0);
  }

  /* Offene Punkte VORN (Brief): ###OFFEN der validierten Fassung UND beider
     Varianten (Herkunft je Punkt ausgewiesen), plus jedes Kapitel mit
     divergenz:offen als eigener Punkt. */
  function reviewOffenePunkte(review) {
    var punkte = [];
    var validiert = (review && review.validiert) || {};
    (validiert.offen || []).forEach(function (z) { punkte.push({ herkunft: 'validiert', text: z }); });
    ['claude', 'chatgpt'].forEach(function (name) {
      var g = review && review[name];
      ((g && g.offen) || []).forEach(function (z) { punkte.push({ herkunft: name, text: z }); });
    });
    (validiert.kapitel || []).forEach(function (k) {
      if (k.validierung && k.validierung.divergenz === 'offen') {
        punkte.push({ herkunft: 'validiert', text: 'Divergenz offen: ' + (k.ek || '?') + ' · ' + (k.titel || '') });
      }
    });
    return punkte;
  }

  /* Das Kapitel EINER Variante zur selben EK-ID — Muster kapitelZuEk in
     inhalt.js (dort privat fuer validierungPruefe), hier eine eigene, kleine
     Kopie: eine triviale Suche verdient keinen Export nur fuer eine zweite
     Aufrufstelle. */
  function reviewKapitelVon(gelesenVariante, ek) {
    var liste = (gelesenVariante && Array.isArray(gelesenVariante.kapitel)) ? gelesenVariante.kapitel : [];
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].ek === ek) return liste[i];
    }
    return null;
  }

  /* Bausteintexte EINES Kapitels untereinander (Brief), jeder Wert durch
     esc() — die Variantentexte stammen aus einer hochgeladenen Blockdatei,
     also ein Fremdwert wie jeder andere (Konvention 4). */
  function reviewBausteinHtml(k) {
    if (!k) return '<p class="hinweis-leise">Kein Kapitel in dieser Variante.</p>';
    var teile = k.teile || {};
    var namen = Object.keys(teile);
    if (!namen.length) return '<p class="hinweis-leise">Keine Bausteine.</p>';
    return namen.map(function (name) {
      return '<p><b>' + esc(name) + ':</b> ' + esc(teile[name]) + '</p>';
    }).join('');
  }

  /* Je Kapitel eine aufklappbare Zeile: EK, Titel, Herkunft-Badge, Beleg,
     Divergenz, [NEU]-Zaehler — aufgeklappt beide Varianten nebeneinander
     (Muster .dd/.ddc, dieselbe zweispaltige Grid-Klasse wie die Leitplanken
     Do/Dont oben — Konvention 5: bestehende Klasse statt einer neuen) plus
     die Begruendung des Entscheids. */
  function reviewKapitelZeile(k, review) {
    var v = k.validierung || {};
    var herkunft = REVIEW_HERKUNFT_KLASSEN.indexOf(v.herkunft) >= 0 ? v.herkunft : 'offen';
    var neu = reviewNeuZahl(k);
    var kA = reviewKapitelVon(review && review.claude, k.ek);
    var kB = reviewKapitelVon(review && review.chatgpt, k.ek);
    var h = '<details class="review-kapitelzeile">';
    h += '<summary><span class="badge badge-' + esc(herkunft) + '">' + esc(v.herkunft || 'fehlt') +
         '</span> <b>' + esc(k.ek || '') + '</b> ' + esc(k.titel || '') +
         (v.beleg ? ' <span class="dim">Beleg: ' + esc(v.beleg) + '</span>' : '') +
         (v.divergenz ? ' <span class="dim">Divergenz: ' + esc(v.divergenz) + '</span>' : '') +
         ' <span class="dim">' + neu + ' [NEU]</span></summary>';
    h += '<div class="dd">' +
      '<div class="ddc"><h5>Variante claude</h5>' + reviewBausteinHtml(kA) + '</div>' +
      '<div class="ddc"><h5>Variante chatgpt</h5>' + reviewBausteinHtml(kB) + '</div>' +
      '</div>';
    if (v.begruendung) h += '<p class="dim">Begr&uuml;ndung: ' + esc(v.begruendung) + '</p>';
    return h + '</details>';
  }

  /* Der Aufrufer (einSchritt) entscheidet ueber die bereits fuer den
     AKTUELLEN Schritt aufgeloeste ablage.pruefung === 'validierung', ob
     dieser Block ueberhaupt gerufen wird — kontrakt-getrieben, nie die
     Schrittnummer hartkodiert (Global Constraint Etappe 4), und ohne eine
     zweite ablageVon()-Aufloesung hier drin (die kaeme sonst immer fuer
     Schritt 4 zurueck, unabhaengig vom tatsaechlich gerenderten Schritt).
     Innerhalb: ohne Dossier ODER ohne geladene validierte Fassung nur der
     Kurzhinweis (Brief) — die Gate-Box (gateBlock, unten in einSchritt)
     bleibt davon unberuehrt. */
  function reviewBlock(inh, kurs, ablageDaten) {
    ablageDaten = ablageDaten || {};
    if (!kurs) return '';

    var h = '<div class="box review-block" id="review-block"><h3>Review</h3>';

    var d = ablageDaten.dossier;
    var review = ablageDaten.review;
    var validiert = review && review.validiert;
    if (!d || typeof d !== 'object' || !validiert) {
      return h + '<p class="hinweis-leise">Review erscheint nach der ersten abgelegten ' +
             'validierten Fassung.</p></div>';
    }

    var z = reviewZaehlung(validiert);
    h += '<p>' + z.bestaetigt + ' best&auml;tigt &middot; ' + z.korrigiert + ' korrigiert &middot; ' +
         z.ergaenzt + ' erg&auml;nzt &middot; ' + z.offen + ' offen von ' + z.gesamt +
         ' Eingangskompetenzen</p>';

    var deckung = reviewQuellenDeckung(validiert, d);
    h += '<p>Quellen-Deckung: ' + deckung.gedeckt + ' von ' + deckung.gesamt +
         ' Dossier-Quellen in der Leseliste' +
         (deckung.fehlend.length ? ' &mdash; fehlend: ' + esc(deckung.fehlend.join(', ')) : '') +
         (deckung.unbekannt.length ? ' &mdash; unbekannt im Text: ' + esc(deckung.unbekannt.join(', ')) : '') +
         '</p>';

    var neuGesamt = reviewNeuGesamt(validiert);
    h += '<p>' + neuGesamt + ' [NEU]-Marke' + (neuGesamt === 1 ? '' : 'n') + ' im Text</p>';

    var offenePunkte = reviewOffenePunkte(review);
    h += '<h4>Offene Punkte</h4>';
    h += offenePunkte.length
      ? '<ul>' + offenePunkte.map(function (p) {
          return '<li><span class="dim">[' + esc(p.herkunft) + ']</span> ' + esc(p.text) + '</li>';
        }).join('') + '</ul>'
      : '<p class="hinweis-leise">Keine offenen Punkte.</p>';

    h += '<h4>Kapitel</h4>';
    h += (validiert.kapitel || []).map(function (k) { return reviewKapitelZeile(k, review); }).join('');

    return h + '</div>';
  }

  /* ---------- Die Contracts-Ansicht (D6, Etappe 5, Schritt 5) ----------
     Funktional schlicht (Entscheid Markus: Polish kommt spaeter als eigene
     Runde) — Muster reviewBlock, aber ohne Varianten-Nebeneinander (Schritt
     5 fuehrt keine, anders als Schritt 3): Kopfzeile ("{n}
     Interaktions-Contracts · Basis: {basiert_auf}"), je Contract eine
     aufklappbare Zeile (typ-Badge, kernaussage im Summary, uebrige Felder
     als Liste darunter), darunter der Punkte-Stand aus dem Dossier
     (offen[] gefiltert fuer==='schritt-5'). Rein lesend — die App verwaltet
     nichts (Leitsatz): geaendert wird in der Blockdatei, neu hochgeladen,
     die Ansicht rendert frisch. Der Aufrufer (einSchritt) entscheidet ueber
     die bereits fuer den AKTUELLEN Schritt aufgeloeste
     ablage.pruefung === 'interaktion', ob dieser Block ueberhaupt gerufen
     wird — kontrakt-getrieben, nie die Schrittnummer hartkodiert (V5-Lehre:
     eine zweite ablageVon()-Aufloesung hier drin kaeme immer fuer Schritt 5
     zurueck, unabhaengig vom tatsaechlich gerenderten Schritt). */

  /* Alle Felder AUSSER kernaussage (die steht im Summary) — Reihenfolge wie
     im Schema (didaktik-schema.js PFLICHT ohne kernaussage, dann
     PFLICHT_MODELL, zuletzt begruendung fuer fliesstext). Nur gesetzte
     Felder werden gelistet — ein Contract fuehrt entweder die Modell-
     Felder ODER begruendung, nie beide (D1). */
  var DIDAKTIK_LISTEN_FELDER = ['zielhandlung', 'denkfehler', 'stuetztext',
    'steuert', 'beobachtet', 'aha', 'vorhersage', 'konsequenz', 'begruendung'];

  function didaktikFelderListe(c) {
    var f = (c && c.felder) || {};
    var zeilen = DIDAKTIK_LISTEN_FELDER.filter(function (n) { return f[n]; })
      .map(function (n) { return '<li><b>' + esc(n) + ':</b> ' + esc(f[n]) + '</li>'; });
    return zeilen.length ? '<ul>' + zeilen.join('') + '</ul>' : '';
  }

  /* fliesstext hat kein interaktives Modell (s. didaktik-schema.js) —
     begruendungspflichtige Ausnahme, deshalb die rote badge-offen-Klasse;
     jeder andere Typ traegt die gruene badge-bestaetigt-Klasse. Kein
     eigenes REVIEW_HERKUNFT_KLASSEN-Pendant noetig: die Palette selbst
     (neun Typen) ist hier nicht relevant, nur die Zweiteilung
     fliesstext/nicht-fliesstext. */
  function didaktikContractZeile(c) {
    var badgeKlasse = c.typ === 'fliesstext' ? 'badge-offen' : 'badge-bestaetigt';
    var f = (c && c.felder) || {};
    var h = '<details class="didaktik-contract">';
    h += '<summary><span class="badge ' + esc(badgeKlasse) + '">' + esc(c.typ || '?') +
         '</span> <b>' + esc(c.ek || '') + '</b> ' + esc(f.kernaussage || '') + '</summary>';
    h += didaktikFelderListe(c);
    h += '</details>';
    return h;
  }

  function didaktikBlock(inh, kurs, ablageDaten) {
    ablageDaten = ablageDaten || {};
    if (!kurs) return '';

    var h = '<div class="box didaktik-block" id="didaktik-block"><h3>Interaktions-Contracts</h3>';

    var gelesen = ablageDaten.didaktik;
    if (!gelesen) {
      return h + '<p class="hinweis-leise">Interaktions-Contracts erscheinen nach der ersten ' +
             'abgelegten Fassung.</p></div>';
    }

    var contracts = Array.isArray(gelesen.contracts) ? gelesen.contracts : [];
    h += '<p>' + contracts.length + ' Interaktions-Contracts &middot; Basis: ' +
         esc((gelesen.kopf && gelesen.kopf.basiertAuf) || '') + '</p>';

    h += contracts.map(didaktikContractZeile).join('');

    /* Fixwave nach dem Etappe-5-Review (Auflage 3): dossier === null/undefined
       heisst "laedt noch" bzw. "Ladefehler nachgesehen" (Muster gateBlock) —
       ohne diesen Guard zeigte ein noch nicht geladenes Dossier faelschlich
       "alle Punkte behandelt", obwohl schlicht nichts geprueft werden konnte. */
    var d = ablageDaten.dossier;
    if (!d || typeof d !== 'object') {
      h += '<p class="hinweis-leise">Punkte-Stand erscheint, sobald das Dossier geladen ' +
           'ist.</p>';
      return h + '</div>';
    }

    var offen = Array.isArray(d.offen)
      ? d.offen.filter(function (e) { return e && e.fuer === 'schritt-5'; })
      : [];
    h += offen.length
      ? '<p>' + offen.length + ' Punkte offen an schritt-5</p>'
      : '<p>alle Punkte behandelt</p>';

    return h + '</div>';
  }

  /* ---------- Die Gate-Box (Schritt 2, 4, 7) ----------
     Z9 (Entscheid Markus, 2026-07-30, nach dem Live-Einsatz: "Ich erwarte:
     Drehbuch v(n) auswaehlen und als final bestaetigen, evtl. Freigabe erteilt
     durch Name. Alles andere ist nicht nachvollziehbar." — "das schaut kein
     Schwein an"): die vormalige Pruefliste/Erfassung offener Punkte (Task 5/6)
     ist HIER VOLLSTAENDIG entfernt, auch nicht eingeklappt, auch nicht bedingt.
     Die Box zeigt nur noch, was am Gate wirklich passiert — s. gateFreigabe.
     offen[]/entschieden[] bleiben als Datentraeger im Dossier bestehen
     (dossier.offenNeu/offenFuer/offenEntscheiden/offenVerschieben UND die
     controller-Handler dazu sind unveraendert, s. app.js) — Etappe 4 baut
     darauf eine eigene Review-Ansicht; die S2-Sperre in controller.gateKlick
     bleibt deshalb als reiner DATEN-Waechter bestehen, meldet aber neu, WO zu
     behandeln ist, statt eine Liste zu zeigen, die es in dieser Box nicht mehr
     gibt (s. dort). Sichtbar nur an einem Gate-Schritt (ablage.gate gesetzt)
     mit Kurs; ohne geladenes Dossier oder ohne Kursordner steht nur der kurze
     Hinweis — der Knopf waere ohnehin am Guard in controller.gateKlick
     gescheitert (Doppelschutz wie beim Briefing-Kaltstart, s. briefingFormular
     oben). */
  function gateBlock(inh, kurs, schrittId, ablageDaten) {
    ablageDaten = ablageDaten || {};
    if (!kurs) return '';
    var ablage = I().ablageVon(inh, schrittId, kurs.kursId);
    if (!ablage || !ablage.gate) return '';

    var h = '<div class="box gate-block" id="gate-block"><h3>&#9873; ' + esc(ablage.gate) + '</h3>';

    var d = ablageDaten.dossier;
    if (ablageDaten.ordnerFehlt || !d || typeof d !== 'object') {
      h += '<p class="hinweis-leise">Gate braucht das Dossier &mdash; Schritt 1 zuerst.</p></div>';
      return h;
    }

    h += gateFreigabe(inh, kurs, schrittId, ablage, ablageDaten, d);

    return h + '</div>';
  }

  /* ---------- Der Freigabe-Teil der Gate-Box (Etappe 2, Task 6 -> Z9) ----------
     Der HAUPTFLUSS, immer sichtbar: (a) Radio-Liste der vorhandenen v-Fassungen
     (inhalt.versionenVon, hoechste vorausgewaehlt), (b) EIN Pflichtfeld
     "Freigabe erteilt durch" (die interne Feld-Id gate-zweitpruefung bleibt —
     sie IST die 4-Augen-Zweitpruefung, nur der sichtbare Name ist einfacher
     geworden), (c) EIN Knopf "Als final bestaetigen". Waehlt jemand nicht die
     hoechste Fassung: die Maschinenregel "final ist final" gilt trotzdem
     unveraendert (CLAUDE.md) — jede Nicht-hoechste-Option traegt deshalb einen
     statischen Hinweis "es existiert bereits {hoechste}", direkt an der Stelle,
     wo die Wahl getroffen wird (kein JS noetig, rein aus den vorhandenen
     Fassungen abgeleitet).

     Sperrt den Knopf weiterhin fuer die Faelle, die controller.gateKlick sonst
     erst nach einem Netzzugriff ablehnen wuerde: (a) die Freigabe ist bereits
     VOLLSTAENDIG abgeschlossen, (b) es gibt noch keine versionierte Datei
     ueberhaupt, (c) ein Lauf ist gerade aktiv (Lauf-Merker). Offene Punkte (S2)
     sperren den Knopf in DIESER Ansicht bewusst NICHT mehr (Z9-Entscheid) — die
     Pruefung bleibt im Controller, ein Klick trotz offener Punkte landet am
     bestehenden #gate-melde/state.fehlerHinweis-Pfad.

     F1 (Fix-Runde 1, Task 6, unveraendert gueltig): "bereits freigegeben"
     sperrt erst, wenn `_final` UND das Protokoll UND
     `dossier.statusVon(d, lief) === 'final'` alle drei stimmen — sonst waere
     ein Wiedereinstieg nach einem Teilfehler ueber die UI unerreichbar. Fehlt
     eines davon, bleibt der Knopf offen, aber mit der Beschriftung "Freigabe
     abschliessen" statt "Als final bestaetigen", weil keine neue Datei mehr
     entsteht, nur der Rest wird nachgezogen. */
  function gateFreigabe(inh, kurs, schrittId, ablage, ablageDaten, d) {
    var dateien = Array.isArray(ablageDaten.dateien) ? ablageDaten.dateien : null;
    var lief = I().lieferobjektVon(inh, schrittId, ablageDaten.variante);
    var endung = I().erwarteteEndung(inh, schrittId);
    /* V6 Fix-Runde 1 (CRITICAL-Fix): versionenVon() bekommt die erwartete
       Kontrakt-Endung mit — sonst zeigt Schritt 4 (docx+blocks im selben
       _vN-Stamm, B5/V4) jede Version ZWEIMAL, einmal je Endung, und welche
       davon auf Platz 0 (vorausgewaehlt) landet, haengt von der Graph-
       Reihenfolge ab. Die Radio-Liste stellt seither ausschliesslich die
       Hauptendung des Kontrakts zur Auswahl — die .blocks-Schwester wird nie
       als eigene, waehlbare Fassung angezeigt. */
    var versionen = (dateien && lief) ? I().versionenVon(dateien, kurs.kursId, lief, endung) : [];
    var final = (dateien && lief) ? I().finalVorhanden(dateien, kurs.kursId, lief) : null;
    var nach = (lief && endung) ? I().finalName(kurs.kursId, lief, endung) : null;
    var gateDateiName = I().gateDatei(inh);
    var protokollDa = !!(dateien && dateien.some(function (x) { return x.name === gateDateiName; }));
    var statusFinal = !!(lief && root.dossier.statusVon(d, lief) === 'final');
    var vollstaendig = !!(dateien && final && protokollDa && statusFinal);
    var nochOffenTrotzFinal = !!(dateien && final && !vollstaendig);

    /* F3 (Fix-Runde 1, Task 6, unveraendert): der Lauf-Merker (state.gateLaeuft,
       gesetzt/geloescht von controller.gateKlick) sperrt hier zusaetzlich zum
       knopf.disabled im DOM — ein Render mitten im Lauf (z. B. ein auslaufendes
       ordnerNachladen) baut die Box sonst mit einem wieder aktivierten Knopf
       neu auf. */
    var grund = null;
    if (ablageDaten.gateLaeuft) {
      grund = 'Gate läuft …';
    } else if (vollstaendig) {
      grund = 'bereits freigegeben: ' + final;
    } else if (dateien && !versionen.length && !final) {
      grund = 'keine versionierte Datei vorhanden';
    }

    var beschriftung = nochOffenTrotzFinal ? 'Freigabe abschliessen' : 'Als final best&auml;tigen';

    var h = '<div class="gate-freigabe">';
    if (dateien && versionen.length && !nochOffenTrotzFinal) {
      h += '<div class="gate-versionen">' + versionen.map(function (v, i) {
        var hoehereHinweis = i > 0
          ? ' <span class="dim">(nicht die h&ouml;chste &mdash; es existiert bereits ' +
            esc(versionen[0].name) + ')</span>'
          : '';
        return '<label class="arow"><input type="radio" name="gate-version" value="' + esc(v.name) +
          '" id="gate-version-' + i + '"' + (i === 0 ? ' checked' : '') + '> <code>' + esc(v.name) +
          '</code>' + hoehereHinweis + '</label>';
      }).join('') + '</div>';
      if (nach) h += '<p class="dim">Wird zu: <code>' + esc(nach) + '</code></p>';
    } else if (nochOffenTrotzFinal) {
      h += '<p class="dim"><code>' + esc(final) + '</code> liegt bereits, die Freigabe ist aber ' +
           'noch nicht vollst&auml;ndig (Protokoll oder Status fehlen) &mdash; ein weiterer Klick ' +
           'zieht das nach, ohne etwas erneut umzubenennen.</p>';
    } else if (!dateien) {
      h += '<p class="dim">Ordner wird gelesen &hellip;</p>';
    }
    h += '<label>Freigabe erteilt durch (Pflicht) ' +
         '<input type="text" id="gate-zweitpruefung" data-gate-feld></label>';
    h += '<button class="knopf" data-action="gate-klick" data-schritt="' + esc(schrittId) + '"' +
         (grund ? ' disabled' : '') + '>' + beschriftung + '</button>';
    if (grund) h += '<p class="dim">' + esc(grund) + '</p>';
    h += '<span class="hinweis-leise" id="gate-melde" hidden></span>';
    return h + '</div>';
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
    /* Fuehrt der Schritt Varianten (Schritt 3: claude / chatgpt), haengt jeder
       Dateiname an der gewaehlten. Einmal bestimmt, ueberall benutzt. */
    var varianten = I().varianten(inh, schrittId);
    var variante = I().gewaehlteVariante(inh, schrittId, ablageDaten.variante);
    var ablage = I().ablageVon(inh, schrittId, kurs ? kurs.kursId : '<Kurs>', variante);
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
    h += '<header class="sk"><span class="stelle">Station ' + esc(s.id) + ' von 8</span>' +
         '<h1>' + esc(s.nm) + '</h1>' +
         '<div class="marken">' +
           (am ? '<span class="marke ' + esc(s.auto) + '">' + esc(am.label) + '</span>' : '') +
           (s.tool ? '<span class="marke tool">' + esc(s.tool) + '</span>' : '') +
           (s.gate ? '<span class="marke pruefstelle">&#9873; ' + esc(s.gate) + '</span>' : '') +
         '</div></header>';

    h += '<p class="zweck">' + s.zweck + '</p>';

    /* Die Anleitung haengt am Weg. Chat und Claude-Code sind verschiedene
       Handgriffe — ein gemischter Text ist fuer beide falsch. */
    var wege = anleitung && anleitung.stepsProWeg ? I().arbeitswege(inh, schrittId) : [];
    var wegAktiv = wege.length
      ? (wege.indexOf(ablageDaten.weg) >= 0 ? ablageDaten.weg : wege[0])
      : null;
    var wegLabel = (inh['ablage-kontrakt'] || {}).wege_bedeutung || {};
    var wegName = { chat: 'Im Chat', 'claude-code': 'Mit Claude Code', hand: 'Von Hand' };

    var schritte = anleitung
      ? I().anleitungSchritte(inh, schrittId, wegAktiv)
      : (s.taet || []);

    h += '<h2 class="tun">So gehst du vor' +
         (wege.length > 1 ? '<span class="tun-sub">zwei Wege &mdash; w&auml;hle deinen</span>' : '') +
         '</h2>';

    if (wege.length > 1) {
      h += '<div class="ptabs">' + wege.map(function (x) {
        return '<button class="ptab' + (x === wegAktiv ? ' on' : '') + '" ' +
               'data-action="weg" data-weg="' + esc(x) + '" ' +
               'title="' + esc(wegLabel[x] || '') + '">' +
               esc(wegName[x] || x) + '</button>';
      }).join('') + '</div>';
    }

    h += '<ol class="rezept">' + schritte.map(function (x) {
      return '<li><span>' + x + '</span></li>';
    }).join('') + '</ol>';

    /* Die acht generischen Briefing-Angaben werden hier gefragt, nicht im Chat.
       Sie brauchen kein Urteil, nur Wissen — ein Prompt, der sie erfragt, erzeugt
       Rueckfragen ohne Erkenntnis. Was ausgefuellt ist, geht mit dem Masterprompt
       mit; was leer bleibt, landet dort als offener Entscheid. */
    if (String(schrittId) === '1') h += briefingFormular(inh, kurs, ablageDaten);

    /* Erfasst wird nur in Schritt 1 — sichtbar auch in Schritt 3, damit hier
       geprueft werden kann, was die Positivliste des Auftrags enthaelt. */
    if (String(schrittId) === '3' && ablageDaten.dossier) {
      h += quellenVerzeichnisBlock(ablageDaten.dossier);
    }

    /* Schritt 2 startet erst NACH einem freigegebenen Briefing (Etappe 2, Task
       3, Halluzinations-Bremse): ohne das kann weder der Chat noch Claude Code
       wissen, was der Kurs voraussetzt. Kein Disable der Knoepfe (Altkurse und
       laufende Migrationen muessen weiterarbeiten koennen) — nur der deutliche
       Kasten, dieselbe Optik wie der Kaltstart-Hinweis in Schritt 1
       (briefingFormular oben, "Zuerst die Ablage anlegen"). */
    if (String(schrittId) === '2' && ablageDaten.dossier &&
        root.dossier.statusVon(ablageDaten.dossier, 'briefing') !== 'final') {
      h += '<div class="box achtung"><span class="bt">Kein freigegebenes Briefing</span>' +
           'Schritt 2 startet erst, wenn das Briefing in Schritt 1 abgelegt ist ' +
           '(Halluzinations-Bremse). Ohne Dossier zuerst Schritt 1 durchlaufen.</div>';
    }

    /* Z7: auch mit freigegebenem Briefing kann der Spiegel veraltet sein — eine
       nach dem letzten Briefing-Entwurf erfasste Quelle taucht darin nicht auf.
       Unabhaengig vom Kasten oben (der prueft nur status.briefing, nicht den
       Inhalt). */
    if (String(schrittId) === '2') h += quellenSpiegelBox(ablageDaten);

    /* A3, Etappe 3: Schritt 3 startet erst NACH dem freigegebenen Contract aus
       Schritt 2 (Gate 1) — ohne die _final-Fassung kennen weder Chat noch
       Claude Code die Lernziele, an denen sich das Skript ausrichtet. Gleiche
       Kaltstart-Optik wie der Schritt-2-Kasten oben, KEIN Disable der Knoepfe
       (Muster: Altkurse/laufende Migrationen muessen weiterarbeiten koennen).
       Das Lieferobjekt von Schritt 2 kommt aus ablageVon('2', ...) — NIE
       'lernziele-drehbuch' hartkodiert, sonst veraltet der Kasten, sobald der
       Kontrakt das Lieferobjekt umbenennt. */
    if (String(schrittId) === '3' && ablageDaten.dossier) {
      var ablageSchritt2 = I().ablageVon(inh, '2', kurs ? kurs.kursId : '<Kurs>');
      var lieferobjektSchritt2 = ablageSchritt2 ? ablageSchritt2.lieferobjekt : null;
      if (lieferobjektSchritt2 &&
          root.dossier.statusVon(ablageDaten.dossier, lieferobjektSchritt2) !== 'final') {
        h += '<div class="box achtung"><span class="bt">Kein freigegebener Contract</span>' +
             'Schritt 3 braucht die <code>_final</code>-Fassung aus Gate 1.</div>';
      }
    }

    /* V3, Etappe 4: Schritt 4 (Validierung) startet erst NACH beiden
       Schritt-3-Varianten UND dem freigegebenen Contract aus Schritt 2 — ohne
       beide .blocks-Fassungen gibt es nichts zu validieren (Regressionsbremse,
       s. inhalt.validierungPruefe), ohne den Contract fehlt der Massstab fuer
       die Lernziele. Gleiche Kaltstart-Optik wie die Kaesten in Schritt 2/3,
       KEIN Disable der Knoepfe (Muster A3: Altkurse/laufende Migrationen
       muessen weiterarbeiten koennen).
       Bewusst NICHT ueber den Dossier-Status geprueft, anders als die
       Schritt-2/3-Kaesten oben: Schritt 3 hat kein Gate, dossier.statusVon
       wird fuer skript-claude/skript-chatgpt nie automatisch auf 'final'
       gesetzt — ein Kurs kann Schritt 3 laengst abgeschlossen haben, ohne
       dass das im Dossier steht. Stattdessen die tatsaechliche Dateiliste:
       je Variante muss die geltende .docx UND ihre .blocks-Schwester
       (gleicher Stamm, B5-Invariante) im 03_content-Cache liegen; der
       Contract gilt, wenn seine _final-Fassung im 02_lernziele-Cache liegt
       (finalVorhanden, nicht nur die hoechste Version). Lieferobjekt-
       Kennungen kommen aus lieferobjektVon/ablageVon — nie hartkodiert. */
    if (String(schrittId) === '4') {
      var kursId4 = kurs ? kurs.kursId : '<Kurs>';
      var variantenSchritt3 = I().varianten(inh, '3') || [];
      var dateien03Kasten = Array.isArray(ablageDaten.dateien03) ? ablageDaten.dateien03 : null;
      var fehlendeVariantenSchritt3 = variantenSchritt3.filter(function (v) {
        if (!dateien03Kasten) return true;
        var lief3v = I().lieferobjektVon(inh, '3', v);
        var docx3v = lief3v ? I().geltendeDatei(dateien03Kasten, kursId4, lief3v) : null;
        if (!docx3v) return true;
        var blocks3v = docx3v.replace(/\.[a-z0-9]+$/i, '.blocks');
        return !dateien03Kasten.some(function (x) { return x.name === blocks3v; });
      });
      var ablage2Fuer4 = I().ablageVon(inh, '2', kursId4);
      var lieferobjekt2Fuer4 = ablage2Fuer4 ? ablage2Fuer4.lieferobjekt : null;
      var dateien02Kasten = Array.isArray(ablageDaten.dateien02) ? ablageDaten.dateien02 : null;
      var contractFinal4 = !!(lieferobjekt2Fuer4 && dateien02Kasten &&
        I().finalVorhanden(dateien02Kasten, kursId4, lieferobjekt2Fuer4));
      if (fehlendeVariantenSchritt3.length || !contractFinal4) {
        h += '<div class="box achtung"><span class="bt">Grundlage unvollst&auml;ndig</span>' +
             'Schritt 4 braucht beide Skript-Varianten aus Schritt 3 und den freigegebenen ' +
             'Contract.</div>';
      }
    }

    /* D4, Etappe 5: Schritt 5 (Didaktik/Interaktions-Contracts) startet erst
       NACH dem Sign-off aus Schritt 4 — ohne die _final-Fassung des Contents
       gibt es nichts zu uebersetzen. Datei-basiert wie der V3-Contract-Kasten
       oben (finalVorhanden auf dem 04_validierung-Cache), NICHT ueber den
       Dossier-Status (derselbe Grund wie bei Schritt 4: Schritt 4 hat zwar
       ein Gate, aber die Kasten-Logik der Etappe bleibt einheitlich
       datei-basiert). KEIN Disable der Knoepfe (Muster A3/V3: Altkurse/
       laufende Migrationen muessen weiterarbeiten koennen). Lieferobjekt
       kommt aus ablageVon('4', ...) — nie 'content' hartkodiert, sonst
       veraltet der Kasten, sobald der Kontrakt das Lieferobjekt umbenennt. */
    if (String(schrittId) === '5') {
      var kursId5 = kurs ? kurs.kursId : '<Kurs>';
      var ablage4Fuer5 = I().ablageVon(inh, '4', kursId5);
      var lieferobjekt4Fuer5 = ablage4Fuer5 ? ablage4Fuer5.lieferobjekt : null;
      var dateien04Kasten = Array.isArray(ablageDaten.dateien04) ? ablageDaten.dateien04 : null;
      var contentFinal5 = !!(lieferobjekt4Fuer5 && dateien04Kasten &&
        I().finalVorhanden(dateien04Kasten, kursId5, lieferobjekt4Fuer5));
      if (!contentFinal5) {
        h += '<div class="box achtung"><span class="bt">Kein freigegebener Content</span>' +
             'Schritt 5 braucht die <code>_final</code>-Fassung aus dem Sign-off (Schritt 4).</div>';
      }
    }

    /* Das Werkzeug steht direkt nach der Anleitung, die es erwaehnt —
       nicht hinter den Leitplanken. Der Masterprompt zuerst. */
    if (hilfsmittel.length) {
      var prompts = hilfsmittel.filter(function (w) { return w.type === 'prompt'; });
      var zubehoer = hilfsmittel.filter(function (w) { return w.type !== 'prompt'; });

      /* Ein Masterprompt zum Kopieren gehoert zum Weg Chat. Wer mit Claude Code
         arbeitet, gibt einen Auftrag und kopiert nichts — dort waere er
         irrefuehrend. */
      if (wegAktiv === 'claude-code' && prompts.length) {
        var auftrag = I().bauauftrag(inh, schrittId);
        h += '<h2 class="tun">Dein Auftrag' +
             '<span class="tun-sub">Claude Code holt sich den Rest selbst</span></h2>';
        h += '<div class="box bruecke"><span class="bt">Bau-Auftrag</span>' +
             'Kein Prompt zum Kopieren &mdash; Claude Code bekommt einen Auftrag.' +
             (auftrag
               ? ' In Claude Code ausf&uuml;hren lassen: <code>' + esc(auftrag.pfad) + '</code><br>' +
                 'Der Masterprompt f&uuml;r den Weg Chat ist derselbe Inhalt in anderer Form &mdash; ' +
                 'beide werden aus <code>' + esc(auftrag.inhaltskontrakt) + '</code> erzeugt.'
               : '') +
             '</div>';
        prompts = [];
      }

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

    /* --- Die Variantenwahl: einmal, vor beiden Wegen ---
           Sie gehoert zum Schritt, nicht zu einem Weg. Stuende sie im
           Hochlade-Block, waehlte man sie erst, nachdem man das Ergebnis
           bereits eingefuegt hat — und im Weg Chat gar nicht. */
    if (kurs && varianten) {
      h += '<h2 class="tun">Variante' +
           '<span class="tun-sub">je Werkzeug ein Entwurf, nebeneinander</span></h2>';
      h += '<div class="ptabs">' + varianten.map(function (v) {
        return '<button class="ptab' + (v === variante ? ' on' : '') + '" ' +
               'data-action="variante" data-variante="' + esc(v) + '" ' +
               'data-schritt="' + esc(schrittId) + '">' + esc(v) + '</button>';
      }).join('') + '</div>' +
      '<p class="dim">Dieser Schritt f&uuml;hrt mehrere Entw&uuml;rfe ' +
      'nebeneinander &mdash; je Werkzeug einen. Sie sind keine Versionen voneinander; ' +
      'jede Variante z&auml;hlt eigene Nummern.</p>';
    }

    /* --- Ergebnis ablegen: der Weg Chat --- */
    if (kurs && I().darfAblegen(inh, schrittId)) {
      /* Den Zielnamen erst nennen, wenn der Ordner wirklich gelesen ist —
         sonst verspricht die Ansicht _v1, obwohl dort schon _v3 liegt. */
      var ziel = Array.isArray(ablageDaten.dateien)
        ? I().naechsteDatei(inh, schrittId, kurs.kursId, ablageDaten.dateien, variante)
        : null;
      var zuChat = Array.isArray(ablageDaten.dateien)
        ? I().abgeschlossen(inh, schrittId, kurs.kursId, ablageDaten.dateien, variante)
        : null;

      if (zuChat) {
        h += '<h2 class="tun">Abgeschlossen</h2>';
        h += '<div class="box achtung"><span class="bt">Final ist final</span>' +
          'In <code>' + esc(ablage.ordner) + '/</code> liegt <code>' + esc(zuChat) + '</code>. ' +
          'Dieses Lieferobjekt ist freigegeben; die Kurswerkstatt legt nichts mehr daneben. ' +
          'Zum Nachbessern die Freigabe zuerst <b>von Hand</b> zur&uuml;cksetzen.</div>';
      } else {
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
        (ziel && ziel.zurueckstufen
          ? '<p class="dim">Dieser Schritt hat kein Gate: die neue Fassung gilt und heisst ' +
            '<code>_final</code>. Die bisherige <code>' + esc(ziel.zurueckstufen.von) +
            '</code> wird dabei zu <code>' + esc(ziel.zurueckstufen.nach) + '</code> &mdash; ' +
            'sie bleibt erhalten, gilt aber nicht mehr.</p>'
          : '') +
        '<p class="dim">Die Kurswerkstatt vergibt Ordner und Dateinamen nach dem ' +
        'Ablage-Kontrakt. Du tippst keinen Pfad.</p>' +
      '</div>';
      }
    }

    /* --- Der Weg Hochladen: fuer Lieferobjekte, die nicht als Text entstehen ---
           Excel (Schritt 2) und der Moodle-Export (Schritt 6). Der Name wird
           angezeigt, nicht getippt — abgetippte Namen waren die Fehlerquelle.
           Schritt 3 (B5, Etappe 3b): seit der E5-Revision liefert der Chat
           die BLOCKDATEI statt der .docx — der Input braucht dafuer
           `multiple` (Blockdatei PLUS beliebig viele Illustrations-PNGs in
           EINER Auswahl). V4 Fix-Nachtrag: Schritt 4 baut ebenso auf einer
           Blockdatei auf (pruefung:'validierung') — istBlockstreckenPruefung()
           entscheidet ueber BEIDE Werte (eine Stelle, Konvention 9), statt
           pruefung nur gegen 'skript' zu vergleichen. Schritt 2/6 (kein
           pruefung-Feld) bleiben unberuehrt, weiterhin Einzeldatei.
           D5 (Etappe 5): Schritt 5 (pruefung:'interaktion') baut ANDERS als
           Schritt 3/4 — die Blockdatei mit den Interaktions-Contracts wird
           selbst abgelegt, kein Word gebaut, keine Illustrationen dazu. Kein
           `multiple`, kein .zip — genau EINE Datei (.blocks/.txt), deshalb
           NICHT ueber istBlockstreckenPruefung() (die entscheidet nur ueber
           'skript'/'validierung'), sondern ein eigener Vergleich. */
    if (kurs && I().darfHochladen(inh, schrittId) && !ablageDaten.ordnerFehlt) {
      /* Die Variante steht oben schon fest — hier wird sie nur noch benutzt. */
      var hziel = Array.isArray(ablageDaten.dateien)
        ? I().hochladeZiel(inh, schrittId, kurs.kursId, ablageDaten.dateien, variante)
        : null;
      var endung = I().erwarteteEndung(inh, schrittId);
      var istBlockUpload = !!(ablage && I().istBlockstreckenPruefung(ablage.pruefung));
      var istDidaktikUpload = !!(ablage && ablage.pruefung === 'interaktion');

      h += '<h2 class="tun">Datei hochladen' +
           '<span class="tun-sub">die Kurswerkstatt vergibt Ordner und Namen</span></h2>';
      h += '<div class="ablegen">';

      var zu = Array.isArray(ablageDaten.dateien)
        ? I().abgeschlossen(inh, schrittId, kurs.kursId, ablageDaten.dateien, variante)
        : null;

      if (zu) {
        h += '<div class="box achtung"><span class="bt">Abgeschlossen &mdash; final ist final</span>' +
          'In <code>' + esc(ablage.ordner) + '/</code> liegt <code>' + esc(zu) + '</code>. ' +
          'Damit ist dieses Lieferobjekt freigegeben und wird nicht mehr &uuml;berschrieben.' +
          '<p style="margin-top:8px">Musst du wirklich nachbessern, setze die Freigabe zuerst ' +
          '<b>von Hand</b> zur&uuml;ck &mdash; benenne <code>_final</code> in SharePoint auf die ' +
          'zugeh&ouml;rige <code>_v{N}</code> zur&uuml;ck. Das ist ein bewusster Eingriff und soll ' +
          'einer bleiben: eine neue Ablage daneben bek&auml;me wieder <code>_v1</code> und w&auml;re ' +
          'durch die <code>_final</code> verdeckt &mdash; du arbeitetest an einer Datei, die niemand liest.</p>' +
        '</div></div>';
      } else {

      h += '<input type="file" id="datei"' +
          (istBlockUpload ? ' multiple accept=".blocks,.txt,.png,.zip"'
                          : istDidaktikUpload ? ' accept=".blocks,.txt"'
                          : (endung ? ' accept=".' + esc(endung) + '"' : '')) + ' />';

      /* B9-F1: die zuletzt gewaehlten Dateien stehen im State (dateiGewaehlt),
         nicht mehr im — bei jedem Render neuen, leeren — Input selbst. Ohne
         diese Zeile saehe die Person nach einem Zwischen-Render nicht mehr,
         was sie schon ausgewaehlt hat. Nichts gewaehlt: die Zeile fehlt. */
      if (Array.isArray(ablageDaten.dateiAuswahl) && ablageDaten.dateiAuswahl.length) {
        var dateiAuswahlNamen = ablageDaten.dateiAuswahl.map(function (d) {
          return esc(d.name || '(ohne Namen)');
        });
        var dateiAuswahlAnzahl = ablageDaten.dateiAuswahl.length;
        h += '<p class="dim">Gew&auml;hlt: ' + dateiAuswahlNamen.join(' &middot; ') + ' (' +
          dateiAuswahlAnzahl + (dateiAuswahlAnzahl === 1 ? ' Datei)' : ' Dateien)') + '</p>';
      }

      h +=
        '<div class="arow">' +
          '<button class="knopf gross" data-action="hochladen" data-schritt="' +
            esc(schrittId) + '">Hochladen</button>' +
          (hziel ? '<span class="zielname">wird zu <code>' + esc(hziel.ordner) + '/' +
                   esc(hziel.datei) + '</code></span>'
                 : '<span class="dim">Ordner wird gelesen &hellip;</span>') +
        '</div>';

      /* B9-F3: die letzte Upload-Antwort (Erfolg wie Abweisung) PERSISTENT direkt
         beim Knopf — nicht nur oben im Meldungsblock, der weit weg vom Ort des
         Geschehens steht und den die Person beim Hochladen-Block unten nicht vor
         Augen hat. Bestehende .hinweis-/.klemmt-Klassen fuer die Optik
         wiederverwendet, bewusst OHNE das Haekchen (<b>&#10003;</b>) des oberen
         Blocks — das waere hier eine Doppelung derselben Aussage. */
      if (ablageDaten.uploadMeldung && ablageDaten.uploadMeldung.text) {
        var uploadMeldungKlasse = ablageDaten.uploadMeldung.typ === 'ok' ? 'hinweis' : 'klemmt';
        h += '<p class="' + uploadMeldungKlasse + '">' + esc(ablageDaten.uploadMeldung.text);
        /* K3: "Im Word oeffnen" hinter dem Meldungstext, NUR bei einer echten
           https-URL (Guard gegen ein manipuliertes/fremdes Feld) — Fehler-
           meldungen tragen nie eine url (app.js setzt sie ausschliesslich im
           Erfolgspfad). Bestehende .oeffnen-Klasse wiederverwendet
           (Konvention 5, s. Kette/Kursansicht), href durch esc() (Konvention
           4: jeder Fremdwert). */
        if (typeof ablageDaten.uploadMeldung.url === 'string' &&
            /^https:\/\//.test(ablageDaten.uploadMeldung.url)) {
          h += ' <a class="oeffnen" href="' + esc(ablageDaten.uploadMeldung.url) +
            '" target="_blank" rel="noopener">Im Word &ouml;ffnen &#8599;</a>';
        }
        h += '</p>';
      }

      h +=
        '<p class="klemmt" id="hochladefehler" hidden></p>' +
        (istBlockUpload
          ? '<p class="dim">W&auml;hle die Blockdatei (<code>.blocks</code> oder <code>.txt</code>) ' +
            'und alle referenzierten Illustrationen (<code>.png</code>) zusammen aus &mdash; mehrere ' +
            'Dateien per Strg/Cmd-Klick &mdash; oder liefere alles geb&uuml;ndelt in EINEM ' +
            '<code>.zip</code>-Paket (Unterordner darin sind erlaubt, nur der Dateiname z&auml;hlt). ' +
            'Die Kurswerkstatt baut daraus das Word, pr&uuml;ft es und ' +
            'legt Word, Blockdatei (als <code>.blocks</code> daneben) und Bilder ' +
            '(<code>abbildungen/</code>) in einem Vorgang ab. Wie die Dateien auf deinem Rechner ' +
            'heissen, spielt keine Rolle. ' +
            (hziel && hziel.version ? 'Das wird Version ' + hziel.version + '. ' : '') +
            'Du tippst keinen Pfad und keinen Dateinamen.</p>'
          : istDidaktikUpload
          ? '<p class="dim">Die Blockdatei mit den Interaktions-Contracts &mdash; eine Datei, ' +
            'keine Bilder. Wie sie auf deinem Rechner heisst, spielt keine Rolle. ' +
            (hziel && hziel.version ? 'Das wird Version ' + hziel.version + '. ' : '') +
            'Du tippst keinen Pfad und keinen Dateinamen. Die Werkstatt setzt daraus ' +
            'zus&auml;tzlich das Interaktions-Drehbuch (Word) f&uuml;r die fachliche ' +
            'Durchsicht.</p>'
          : '<p class="dim">Wie die Datei auf deinem Rechner heisst, spielt keine Rolle &mdash; ' +
            'abgelegt wird sie unter dem Namen aus dem Ablage-Kontrakt. ' +
            (hziel && hziel.version ? 'Das wird Version ' + hziel.version + '. ' : '') +
            'Du tippst keinen Pfad und keinen Dateinamen.</p>') +
      '</div>';
      }
    }

    /* --- Schritt 1 setzt neben dem Kursbriefing auch die beiden KI-Projekte auf.
           Erst wenn der Ordner steht — vorher gehoert die Flaeche dem Anlegen. --- */
    if (kurs && +schrittId === 1 && !ablageDaten.ordnerFehlt) {
      h += instruktionenBlock(inh, kurs, ablageDaten.briefing, ablageDaten.ordnerName, ablageDaten.dossier);
    }

    /* V5: die Review-Ansicht steht VOR der Gate-Box (Brief) — sichtbar nur an
       dem Schritt, den der Kontrakt als Blockstrecken-Validierung fuehrt
       (ablage.pruefung === 'validierung', dieselbe schon oben aufgeloeste
       ablage-Variable — kontrakt-getrieben, nie die Schrittnummer
       hartkodiert). */
    if (ablage && ablage.pruefung === 'validierung') {
      h += reviewBlock(inh, kurs, ablageDaten);
    }

    /* D6: die Contracts-Ansicht steht ebenso VOR der Gate-Box, dieselbe
       Begruendung wie beim Review-Block direkt darueber — Schritt 5 fuehrt
       ohnehin kein Gate (s. fixture: gate: null), gateBlock ist hier also
       ein No-op, aber die Reihenfolge bleibt konsistent mit dem V5-Muster. */
    if (ablage && ablage.pruefung === 'interaktion') {
      h += didaktikBlock(inh, kurs, ablageDaten);
    }

    h += gateBlock(inh, kurs, schrittId, ablageDaten);

    if (anleitung && anleitung.dod) {
      h += '<div class="dod"><span class="h">Fertig, wenn</span>' + esc(anleitung.dod) + '</div>';
    }

    h += '<div class="fuss">' +
      (kurs ? '<button class="haken' + (fertig ? ' an' : '') + '" data-action="erledigt" ' +
              'data-schritt="' + esc(s.id) + '"><span class="box">&#10003;</span>' +
              (fertig ? 'Schritt erledigt' : 'Als erledigt markieren') + '</button>' : '') +
      (+s.id < 8 ? '<button class="weiter" data-action="schritt" data-schritt="' + (+s.id + 1) + '"' +
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

    /* Die Wege kommen aus dem Ablage-Kontrakt, nicht aus schritte.json — dort
       stehen sie ebenfalls und koennen abweichen. In Ablage-Fragen gilt der
       Kontrakt. Unbekannte Wege werden roh angezeigt statt verschwiegen. */
    var wege = (ablage && ablage.wege && ablage.wege.length) ? ablage.wege : (s.wege || []);
    if (wege.length) {
      h += '<div class="kblock"><h3>Weg</h3><div class="wege">' + wege.map(function (w) {
        var t = { chat: 'Im Chat', 'claude-code': 'Mit Claude Code', hand: 'Von Hand',
                  kurswerkstatt: 'Macht die Kurswerkstatt',
                  hochladen: 'Datei hochladen' }[w] || w;
        return '<span class="weg ' + esc(w) + '">' + esc(t) + '</span>';
      }).join('') + '</div></div>';
    }

    h += '<div class="kblock"><h3>Was entsteht</h3><p>' + s.lief + '</p></div>';

    if (ablage) {
      /* Sobald der Ordner gelesen ist, den AUFGELOESTEN Namen zeigen — nicht _v{N}.
         Der Platzhalter zwang zum Abtippen, und beim Abtippen entstand aus
         lernziele-drehbuch ein lernziele_drehbuch. */
      var zielD = (Array.isArray(ablageDaten.dateien)
        ? (I().hochladeZiel(inh, schrittId, kurs ? kurs.kursId : '',
                            ablageDaten.dateien, variante) || {}).datei
        : null) || ablage.datei;

      h += '<div class="kblock"><h3>Wohin es kommt</h3>' +
        (zielUrl
          ? '<a class="pfad" href="' + esc(zielUrl) + '" target="_blank" rel="noopener">' +
            esc(ablage.ordner) + '/<b>' + esc(zielD) + '</b> &#8599;</a>'
          : '<span class="pfad">' + esc(ablage.ordner) + '/<b>' + esc(zielD) + '</b></span>') +
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
  function instruktionenBlock(inh, kurs, briefing, ordnerName, d) {
    /* Zwei Fassungen aus derselben Quelle — dieselben Umschalter wie beim Masterprompt,
       damit sie sich gleich bedienen und die Ereignisbehandlung wiederverwendet wird. */
    var fass = [
      { k: 'claude',  t: 'Claude'  },
      { k: 'chatgpt', t: 'ChatGPT' }
    ].map(function (f) {
      f.txt = I().projektInstruktionen(inh, kurs, briefing, f.k, ordnerName, d);
      return f;
    });
    /* briefing == null deckt sowohl undefined (noch nicht angefragt) als auch
       null (Anfrage laeuft gerade, verhindert Doppelabruf) ab — vorher zeigte
       nur undefined "wird gelesen"; waehrend der laufenden Anfrage (null) stand
       hier faelschlich "Kein freigegebenes Briefing", noch bevor ueberhaupt
       nachgesehen wurde (I4, Etappe 1e Task 4, "[FEHLT]-Fenster"). Ein echtes
       "nichts gefunden" liefert app.js seit demselben Fix als leerer String, nicht
       mehr als null — der faellt in den else-Zweig unten. */
    var quelle = briefing == null
      ? '<span class="dim">Briefing wird gelesen &hellip;</span>'
      : (briefing
          ? '<span class="zielname">Briefing aus <code>01_briefing/</code> eingelesen &mdash; ' +
            briefing.length + ' Zeichen</span>'
          : '<span class="klemmt-inline">Kein freigegebenes Briefing in <code>01_briefing/</code> ' +
            '&mdash; die Instruktionen tragen an dieser Stelle einen Platzhalter.</span>');

    /* K1 (Etappe 4), Fix-Runde 1: die ChatGPT-Kompaktfassung (fass[1]) bleibt trotz der
       Verweis-Kuerzung fuer den Rest des Dossiers/Kontrakts weiterhin
       laengenoffen (z. B. eine sehr lange Quellenliste) — die Zeichenzahl
       bleibt deshalb sichtbar, mit einer Warnung ab der 8000-Zeichen-Grenze
       des ChatGPT-Instruktionsfelds. Der Download-Knopf baut die Langfassung
       (mit Briefing-Volltext) erst im Klick-Handler (app.js) — hier steht nur
       der Name der Datei, den der Verweis-Satz oben bereits nennt.
       Der ganze Meta-Block traegt data-box="chatgpt" — denselben Umschalt-
       Mechanismus wie die .prompt-Boxen selbst (data-action="fassung" in
       app.js toggelt jedes Element mit passendem data-box). Ohne diese
       Kopplung war der Block IMMER sichtbar, auch wenn der Claude-Tab aktiv
       war (Fix-Runde 1, Review-Finding). Keine "on"-Klasse hier: die
       ChatGPT-Fassung ist nicht der Default-Tab (fass[0] = Claude ist es),
       der Block startet also verdeckt wie die ChatGPT-.prompt-Box selbst. */
    var chatgptTxt = fass.filter(function (f) { return f.k === 'chatgpt'; })[0].txt;
    var chatgptLaenge = chatgptTxt.length;
    var wissenName = I().projektWissenDateiname(kurs);
    var chatgptMeta = '<div class="fassbox" data-box="chatgpt">' +
      '<div class="arow"><span class="dim">ChatGPT-Kompaktfassung: ' +
        chatgptLaenge + ' Zeichen</span>' +
        '<button class="knopf" data-action="instruktionen-herunterladen">' +
        'Projekt-Wissen-Datei herunterladen</button></div>' +
      (chatgptLaenge >= 8000
        ? '<div class="box achtung"><span class="bt">Zu lang für ChatGPT</span>' +
          'Die Kompaktfassung ist ' + chatgptLaenge + ' Zeichen lang — zu lang für das ' +
          'ChatGPT-Feld (Grenze 8000 Zeichen). Das vollständige Kursbriefing liegt in der ' +
          'Projekt-Wissen-Datei <code>' + esc(wissenName) + '</code> — herunterladen und dort ' +
          'als Projekt-Wissen hochladen.</div>'
        : '') +
      '</div>';

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
          chatgptMeta +
        '</div>' +
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
