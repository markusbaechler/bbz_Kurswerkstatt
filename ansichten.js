/* Ansichten. Reine String-Builder — kein DOM, deshalb in Node testbar.
   Interaktion ausschliesslich ueber data-action, Delegation liegt in app.js. */
(function (root) {
  'use strict';

  var esc = function (s) { return root.helpers.escapeHtml(s); };
  var G = function () { return root.graph; };
  var I = function () { return root.inhalt; };

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

    return '<div class="kopf"><span class="eyebrow">Arbeiten</span>' +
        '<h2>' + kurse.length + ' Kurse &middot; ' + fertig + ' fertig</h2>' +
        '<p class="lead">Klick auf eine Zeile zeigt, wo dieser Kurs steht.</p></div>' +
      '<div class="card" style="padding:14px 16px"><div class="tblwrap"><table class="tbl">' +
        '<thead><tr><th>Kurs</th><th>Titel</th><th>Kompetenzfeld</th>' +
        '<th>Schritt 1&thinsp;&ndash;&thinsp;9</th><th>Stand</th></tr></thead>' +
        '<tbody>' + zeilen + '</tbody></table></div></div>';
  }

  /* ---------- Ansicht: ein Kurs ---------- */
  function einKurs(inh, kurs) {
    if (!kurs) return karte('Kurs', 'Nicht gefunden', 'Dieser Kurs steht nicht in KWKurse.');
    var naechster = I().schritt(inh, kurs.schritt);
    return '<div class="laufkarte">' + schriftfeld(inh, kurs, null) +
        kette(inh, kurs, null) + legende() + '</div>' +
      (naechster ? '<div class="card naechst">' +
        '<span class="eyebrow">Als N&auml;chstes dran</span>' +
        '<h3>Schritt ' + esc(naechster.id) + ' &middot; ' + esc(naechster.nm) + '</h3>' +
        '<p class="lead">' + naechster.zweck + '</p>' +
        '<div style="margin-top:14px"><button class="knopf" data-action="schritt" ' +
        'data-schritt="' + esc(naechster.id) + '">Hier weiterarbeiten &rarr;</button></div>' +
        '</div>' : '');
  }

  function legende() {
    return '<div class="kettenote">' +
      '<span><i class="kdot fertig"></i>erledigt</span>' +
      '<span><i class="kdot inArbeit"></i>in Arbeit</span>' +
      '<span><i class="kdot"></i>offen</span>' +
      '<span><i class="kdot gate"></i>&#9873; Gate &mdash; hier entscheidet ein Mensch</span></div>';
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
        '<p class="dim">Die Kurswerkstatt vergibt Ordner und Dateinamen nach dem ' +
        'Ablage-Kontrakt. Du tippst keinen Pfad.</p>' +
      '</div>';
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
        '<em>Legt die Kurswerkstatt an &mdash; du tippst keinen Pfad.</em></div>';
      h += dateiliste(ablageDaten.dateien, zielUrl, ablage.ordner);
    }

    h += '</aside></div>';
    return h;
  }

  /* ---------- Ansicht: Nachschlagen ---------- */
  function nachschlagen(inh, werkId) {
    var r = inh.referenz || {};
    var werke = ['didaktik', 'promptcraft', 'governance'].filter(function (k) { return r[k]; });
    if (!werke.length) return karte('Nachschlagen', 'Keine Inhalte', 'referenz.json fehlt.');
    var aktiv = werke.indexOf(werkId) >= 0 ? werkId : werke[0];
    var w = r[aktiv];

    var h = '<div class="kopf"><span class="eyebrow">Nachschlagen</span>' +
      '<h2>' + esc(w.titel) + '</h2></div>';
    h += '<div class="reiter">' + werke.map(function (k) {
      return '<button class="' + (k === aktiv ? 'on' : '') + '" data-action="werk" ' +
             'data-werk="' + k + '">' + esc(r[k].titel) + '</button>';
    }).join('') + '</div>';
    h += w.abschnitte.map(function (a) {
      return '<div class="card kapitel"><h3>' + a.h + '</h3><div class="inhalt">' + a.html + '</div></div>';
    }).join('');
    return h;
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
    alleKurse: alleKurse, einKurs: einKurs, einSchritt: einSchritt, nachschlagen: nachschlagen
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { ansichten: root.ansichten };
})(typeof globalThis !== 'undefined' ? globalThis : this);
