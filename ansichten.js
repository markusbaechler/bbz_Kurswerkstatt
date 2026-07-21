/* Ansichten. Reine String-Builder — kein DOM, deshalb in Node testbar.
   Interaktion ausschliesslich ueber data-action, Delegation liegt in app.js. */
(function (root) {
  'use strict';

  var esc = function (s) { return root.helpers.escapeHtml(s); };
  var G = function () { return root.graph; };
  var I = function () { return root.inhalt; };

  /* ---------- Die Kette: 9 Schritte in 5 Phasen ---------- */
  function kette(inh, kurs, aktiv) {
    var phasen = (inh.schritte && inh.schritte.phasen) || [];
    var aktivePhase = aktiv ? I().phaseVon(inh, aktiv) : null;
    var h = '';

    if (aktiv) {
      var sA = I().schritt(inh, aktiv);
      h += '<div class="standort">' +
             '<span class="marke">Du bist hier</span>' +
             '<span class="wo"><b>Schritt ' + esc(aktiv) + ' von 9</b>' +
             (aktivePhase ? ' &middot; ' + esc(aktivePhase.nm) : '') +
             (sA ? ' &middot; ' + esc(sA.nm) : '') + '</span></div>';
    }

    h += '<div class="kette' + (aktiv ? ' fokus' : '') + '">';
    phasen.forEach(function (p) {
      var phAktiv = aktivePhase && aktivePhase.nm === p.nm;
      h += '<div class="phase' + (phAktiv ? ' an' : '') + '">' +
           '<span class="phl">' + esc(p.nm) + '</span><div class="pnodes">';
      p.ids.forEach(function (id) {
        var s = I().schritt(inh, id);
        if (!s) return;
        var st = kurs ? G().standVon(kurs, +id) : 'offen';
        var cls = 'node ' + st + (String(aktiv) === String(id) ? ' hier' : '');
        h += '<button class="' + cls + '" data-action="schritt" data-schritt="' + esc(id) + '"' +
             ' title="' + esc(s.nm) + '">' +
             (s.gate ? '<span class="lock" title="' + esc(s.gate) + '">&#9873;</span>' : '') +
             '<span class="nn">' + (st === 'fertig' ? '&#10003;' : esc(id)) + '</span>' +
             '<span class="nl">' + esc(kurz(s.nm)) + '</span></button>';
      });
      h += '</div></div>';
    });
    return h + '</div>';
  }

  /* ---------- Dateien eines Schritt-Ordners ---------- */
  function dateiliste(dateien, ordnerUrl, ordner) {
    var kopf = '<div class="dateien">' +
      '<div class="dkopf"><span class="h">Was im Ordner liegt</span>' +
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

  /* ---------- Werkzeug ---------- */
  function werkzeug(w, typMeta, offen) {
    var ty = (typMeta && typMeta[w.type]) || { short: w.type };
    var koerper = '';

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

    } else if (w.type === 'prompt') {
      if (w.when) koerper += '<div class="when">' + w.when + '</div>';
      var fassungen = [];
      if (w.claude) fassungen.push({ k: 'claude', t: 'Claude', txt: w.claude });
      if (w.chatgpt) fassungen.push({ k: 'chatgpt', t: 'ChatGPT', txt: w.chatgpt });
      if (fassungen.length > 1) {
        koerper += '<div class="ptabs">' + fassungen.map(function (f, i) {
          return '<button class="ptab' + (i === 0 ? ' on' : '') + '" data-action="fassung" ' +
                 'data-fassung="' + f.k + '">' + f.t + '</button>';
        }).join('') + '</div>';
      }
      koerper += fassungen.map(function (f, i) {
        return '<pre class="prompt' + (i === 0 ? ' on' : '') + '" data-box="' + f.k + '">' +
               esc(f.txt) + '</pre>';
      }).join('');
      koerper += '<div class="prow"><button class="knopf" data-action="kopieren" ' +
                 'data-werkzeug="' + esc(w.id) + '">Prompt kopieren</button>' +
                 '<span class="dim">geht direkt in Claude oder ChatGPT</span></div>';

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
      '<div class="card">' + kette(inh, kurs, null) + legende() + '</div>' +
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

    var h = '<div class="card kettekarte">' +
      (kurs ? '<div class="eyebrow" style="margin-bottom:9px">' + esc(kurs.kursId) +
              ' &middot; ' + esc(kurs.kurstitel) + '</div>' : '') +
      kette(inh, kurs, schrittId) + '</div>';

    h += '<div class="card">';
    h += '<div class="shead"><span class="snum">SCHRITT ' + esc(s.id) + ' / 9</span>' +
         '<h2>' + esc(s.nm) + '</h2>' +
         (am ? '<span class="badge ' + esc(s.auto) + '">' + esc(am.label) + '</span>' : '') +
         (s.tool ? '<span class="badge tool">' + esc(s.tool) + '</span>' : '') +
         (s.gate ? '<span class="gatetag">&#9873; ' + esc(s.gate) + '</span>' : '') + '</div>';

    h += '<p class="lead">' + s.zweck + '</p>';

    /* Woher — Wohin. Der Vorgaenger-Ordner ist direkt in SharePoint zu oeffnen. */
    h += '<div class="chain">' +
      '<div class="ch her"><div class="chl">&#9666; Kommt herein</div><p>' +
        (s.her || []).map(function (x) {
          if (!x.von) return esc(x.was) + ' <span class="dim">(von aussen)</span>';
          var vorAb = I().ablageVon(inh, x.von, kurs ? kurs.kursId : '<Kurs>');
          var url = ablageDaten.basisUrl && vorAb
            ? ablageDaten.basisUrl + '/' + encodeURIComponent(vorAb.ordner) : null;
          return esc(x.was) +
            ' <a data-action="schritt" data-schritt="' + x.von + '">aus Schritt ' + x.von + ' &rsaquo;</a>' +
            (url ? ' <a class="oeffnen" href="' + esc(url) + '" target="_blank" rel="noopener">' +
                   esc(vorAb.ordner) + ' &#8599;</a>' : '');
        }).join('<br>') + '</p></div>' +
      '<div class="ch hin"><div class="chl">Geht weiter &#9656;</div><p>' +
        (s.hin || []).map(function (x) {
          return esc(x.was) + (x.an ? ' <a data-action="schritt" data-schritt="' + x.an +
                 '">an Schritt ' + x.an + ' &rsaquo;</a>' : '');
        }).join('<br>') + '</p></div></div>';

    /* Wege */
    if (s.wege && s.wege.length) {
      h += '<div class="wege">' + s.wege.map(function (w) {
        var t = { B: 'Im Chat', C: 'Mit Claude Code', hand: 'Von Hand',
                  kurswerkstatt: 'Macht die Kurswerkstatt' }[w] || w;
        return '<span class="weg ' + esc(w) + '">' + esc(t) + '</span>';
      }).join('') + '</div>';
    }

    /* Anleitung — immer ausgeklappt, das ist das Kochrezept */
    if (anleitung) {
      h += abschnitt('So gehst du vor');
      h += '<ol class="rezept">' + (anleitung.steps || []).map(function (x) {
        return '<li><span>' + x + '</span></li>';
      }).join('') + '</ol>';
      if ((anleitung.dos || []).length) {
        h += '<div class="dd" style="margin-top:16px">' +
          '<div class="ddc do"><h5>Do</h5><ul>' +
            anleitung.dos.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') +
          '</ul></div>' +
          '<div class="ddc dont"><h5>Don\'t</h5><ul>' +
            (anleitung.donts || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') +
          '</ul></div></div>';
      }
    } else {
      h += abschnitt('So gehst du vor');
      h += '<ol class="rezept">' + (s.taet || []).map(function (x) {
        return '<li><span>' + x + '</span></li>';
      }).join('') + '</ol>';
    }

    /* Werkzeuge — inline, kein Seitenwechsel */
    if (hilfsmittel.length) {
      h += abschnitt('Werkzeuge &mdash; hier aufklappen und arbeiten');
      h += '<div class="wtools">' + hilfsmittel.map(function (w) {
        return werkzeug(w, typMeta, offenesWerkzeug === w.id);
      }).join('') + '</div>';
    }

    /* Ergebnis und Ablage */
    h += abschnitt('Das Ergebnis');
    h += '<div class="liefer"><span class="h">Lieferobjekt</span>' + s.lief + '</div>';
    if (ablage) {
      var zielUrl = ablageDaten.basisUrl
        ? ablageDaten.basisUrl + '/' + encodeURIComponent(ablage.ordner) : null;
      h += '<div class="ablage"><span class="h">Wohin es kommt</span>' +
           (zielUrl
             ? '<a href="' + esc(zielUrl) + '" target="_blank" rel="noopener"><code>' +
               esc(ablage.ordner) + '/' + esc(ablage.datei) + '</code> &#8599;</a>'
             : '<code>' + esc(ablage.ordner) + '/' + esc(ablage.datei) + '</code>') +
           '<p class="dim">Legt die Kurswerkstatt beim Ablegen selbst an &mdash; ' +
           'du tippst keinen Pfad und keinen Dateinamen.</p></div>';
      h += dateiliste(ablageDaten.dateien, zielUrl, ablage.ordner);
    }
    if (anleitung && anleitung.dod) {
      h += '<div class="liefer dod"><span class="h">Fertig, wenn</span>' + esc(anleitung.dod) + '</div>';
    }

    /* Fuss */
    h += '<div class="fuss">' +
      (kurs ? '<button class="haken' + (fertig ? ' an' : '') + '" data-action="erledigt" ' +
              'data-schritt="' + esc(s.id) + '"><span class="box">&#10003;</span>' +
              (fertig ? 'Schritt erledigt' : 'Als erledigt markieren') + '</button>' : '') +
      (+s.id < 9 ? '<button class="weiter" data-action="schritt" data-schritt="' + (+s.id + 1) + '"' +
                   (fertig ? '' : ' disabled') + '>Weiter zu Schritt ' + (+s.id + 1) + ' &rsaquo;</button>' : '') +
      '<p class="wirkung">' + (fertig
        ? 'Der Stand steht in KWKurse &mdash; alle sehen diesen Kurs jetzt weiter vorn.'
        : '&bdquo;Weiter&ldquo; wird frei, sobald der Schritt erledigt ist. So bleibt die Reihenfolge gewahrt.') +
      '</p></div>';

    return h + '</div>';
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
