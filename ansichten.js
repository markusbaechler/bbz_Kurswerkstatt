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
    var aktivePhase = aktiv ? I().phaseVon(inh, aktiv) : null;

    var h = '<div class="linie' + (aktiv ? ' fokus' : '') + '">';
    phasen.forEach(function (p, pi) {
      var phAktiv = aktivePhase && aktivePhase.nm === p.nm;
      h += '<section class="abschnitt' + (phAktiv ? ' an' : '') + '"' +
           ' style="--n:' + p.ids.length + '">' +
           '<h4 class="abname">' + esc(p.nm) + '</h4><div class="bahn">';
      p.ids.forEach(function (id, si) {
        var s = I().schritt(inh, id);
        if (!s) return;
        var st = kurs ? G().standVon(kurs, +id) : 'offen';
        var hier = String(aktiv) === String(id);
        var letzte = (pi === phasen.length - 1) && (si === p.ids.length - 1);
        h += '<button class="stn ' + st + (hier ? ' hier' : '') + (letzte ? ' ende' : '') + '"' +
             ' data-action="schritt" data-schritt="' + esc(id) + '" title="' + esc(s.nm) + '">' +
             (s.gate ? '<span class="pruef" title="' + esc(s.gate) + '">&#9873;</span>' : '') +
             '<span class="punkt">' + (st === 'fertig' ? '&#10003;' : esc(id)) + '</span>' +
             '<span class="stname">' + esc(kurz(s.nm)) + '</span>' +
             (hier ? '<span class="zeiger" aria-hidden="true"></span>' : '') +
             '</button>';
      });
      h += '</div></section>';
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
    return '<div class="kopf"><span class="eyebrow">' + esc(kurs.kursId) + '</span>' +
        '<h2>' + esc(kurs.kurstitel) + '</h2>' +
        '<p class="lead">' + esc(kurs.kompetenzfeld) + ' &middot; ' +
        '<b>' + G().fortschritt(kurs) + ' von 9 Schritten erledigt</b></p></div>' +
      '<div class="orientierung">' + kette(inh, kurs, null) + legende() + '</div>' +
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

    /* --- Orientierung: die Linie, volle Breite --- */
    var h = '<div class="orientierung">' +
      (kurs ? '<div class="werkstueck">' + esc(kurs.kursId) +
              '<span>' + esc(kurs.kurstitel) + '</span></div>' : '') +
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
    kette: kette, werkzeug: werkzeug, dateiliste: dateiliste,
    alleKurse: alleKurse, einKurs: einKurs, einSchritt: einSchritt, nachschlagen: nachschlagen
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { ansichten: root.ansichten };
})(typeof globalThis !== 'undefined' ? globalThis : this);
