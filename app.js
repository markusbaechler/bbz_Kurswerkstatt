/* bbz Kurswerkstatt — Kern.
   CONFIG · state · helpers · controller.
   Muster: crm-spa. Kein Framework, kein Bundler, kein Paketmanager.
   Jede Datei nutzt den UMD-Wrapper und laeuft im Browser wie in Node (node --test). */
(function (root) {
  'use strict';

  /* ---------- CONFIG ---------- */
  var CONFIG = {
    appName: 'bbz Kurswerkstatt',

    graph: {
      tenantId: '3643e7ab-d166-4e27-bd5f-c5bbfcd282d7',
      clientId: 'c4143c1e-33ea-4c4d-a410-58110f966d0a',
      authority: 'https://login.microsoftonline.com/3643e7ab-d166-4e27-bd5f-c5bbfcd282d7',
      redirectUri: 'https://markusbaechler.github.io/bbz_Kurswerkstatt/',
      scopes: ['User.Read', 'Sites.ReadWrite.All']
    },

    sharePoint: {
      siteHostname: 'bbzsg.sharepoint.com',
      sitePath: '/sites/ffentlicheAngebote',
      bibliothek: 'Kursproduktion',
      zentral: '_zentral'
    },

    lists: { kurse: 'KWKurse' }
  };

  /* ---------- state ---------- */
  var state = {
    auth:      { account: null },
    data:      { kurse: [], inhalt: null, ordner: {}, dateien: {} },
    position:  { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null },
    laden:     false,
    fehler:    null,
    hinweis:   null
  };

  /* ---------- helpers ---------- */
  var helpers = {
    /* Jeder Fremdwert im HTML MUSS hier durch. */
    escapeHtml: function (s) {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    datum: function (d) {
      if (!d) return '';
      var x = new Date(d);
      if (isNaN(x.getTime())) return '';
      function z(n) { return n < 10 ? '0' + n : String(n); }
      return z(x.getDate()) + '.' + z(x.getMonth() + 1) + '.' + x.getFullYear();
    }
  };

  /* ---------- auth ----------
     MSAL wird ERST beim Aufruf erzeugt, nie beim Laden der Datei —
     sonst brechen die Node-Tests, in denen es kein msal gibt. */
  var auth = {
    _msal: null,

    _client: function () {
      if (!auth._msal) {
        auth._msal = new msal.PublicClientApplication({
          auth: {
            clientId: CONFIG.graph.clientId,
            authority: CONFIG.graph.authority,
            redirectUri: CONFIG.graph.redirectUri
          },
          cache: { cacheLocation: 'localStorage' }
        });
      }
      return auth._msal;
    },

    /* Ohne Popup: liefert das bereits angemeldete Konto oder null.
       Muss beim Start laufen — ein Popup waere hier vom Browser blockiert,
       weil keine Nutzergeste dahintersteht. */
    stilleAnmeldung: function () {
      var c = auth._client();
      return c.initialize().then(function () {
        var konten = c.getAllAccounts();
        state.auth.account = konten.length ? konten[0] : null;
        return state.auth.account;
      });
    },

    /* Mit Popup. DARF NUR aus einem Klick heraus aufgerufen werden. */
    anmelden: function () {
      var c = auth._client();
      return c.initialize()
        .then(function () { return c.loginPopup({ scopes: CONFIG.graph.scopes }); })
        .then(function (r) { state.auth.account = r.account; return r.account; });
    },

    /* Notausstieg. Ein blockiertes oder abgebrochenes Popup hinterlaesst MSAL in einem
       haengenden Zustand — danach scheitert jeder weitere Versuch mit demselben Fehler.
       Beobachtet am 2026-07-21; ohne diesen Knopf half nur das Loeschen des Browserspeichers. */
    zuruecksetzen: function () {
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf('msal') === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
        sessionStorage.clear();
      } catch (e) { /* Speicher gesperrt — dann bleibt nur das Neuladen */ }
      auth._msal = null;
      state.auth.account = null;
      location.reload();
    },

    token: function () {
      var c = auth._client();
      return c.acquireTokenSilent({
        scopes: CONFIG.graph.scopes,
        account: state.auth.account
      }).catch(function () {
        return c.acquireTokenPopup({ scopes: CONFIG.graph.scopes });
      }).then(function (r) { return r.accessToken; });
    }
  };

  /* ---------- graph ---------- */
  var STAND = ['offen', 'inArbeit', 'fertig'];

  var graph = {
    _siteId: null,
    _driveId: null,

    siteUrl: function () {
      return 'https://graph.microsoft.com/v1.0/sites/' +
             CONFIG.sharePoint.siteHostname + ':' + CONFIG.sharePoint.sitePath;
    },

    _hole: function (url) {
      return auth.token().then(function (t) {
        return fetch(url, { headers: { Authorization: 'Bearer ' + t } });
      }).then(function (r) {
        if (!r.ok) throw new Error('Graph ' + r.status + ' bei ' + url);
        return r.json();
      });
    },

    siteId: function () {
      if (graph._siteId) return Promise.resolve(graph._siteId);
      return graph._hole(graph.siteUrl()).then(function (j) {
        graph._siteId = j.id;
        return j.id;
      });
    },

    /* --- reine Funktionen, ohne Netz: hier liegt die Fachlogik --- */

    mapKurs: function (item) {
      var f = (item && item.fields) || {};
      var s = parseInt(f.Schritt, 10);
      return {
        id: item.id,
        kursId: f.Title || '',
        kurstitel: f.Kurstitel || '',
        kompetenzfeld: f.Kompetenzfeld || '',
        schritt: (s >= 1 && s <= 9) ? s : 1,
        status: STAND.indexOf(f.Status) >= 0 ? f.Status : 'offen',
        prio: (f.Prio === 0 || f.Prio) ? f.Prio : null,
        bemerkung: f.Bemerkung || ''
      };
    },

    /* Variante B: der Stand je Schritt wird berechnet, nicht gespeichert. */
    standVon: function (kurs, n) {
      if (n < kurs.schritt) return 'fertig';
      if (n > kurs.schritt) return 'offen';
      return kurs.status;
    },

    fortschritt: function (kurs) {
      return (kurs.schritt - 1) + (kurs.status === 'fertig' ? 1 : 0);
    },

    /* Was das Ablegen auf Schritt n am Stand aendert.
       null = nichts aendern. Nacharbeit an einem frueheren Schritt darf den
       Fortschritt nicht zuruecksetzen. */
    standNachAblage: function (kurs, n) {
      if (n < kurs.schritt) return null;
      return { Schritt: n, Status: 'inArbeit' };
    },

    /* Was der Erledigt-Haken auf Schritt n bewirkt. */
    naechsterStand: function (kurs, n) {
      if (graph.standVon(kurs, n) === 'fertig') return { Schritt: n, Status: 'offen' };
      if (n === 9) return { Schritt: 9, Status: 'fertig' };
      return { Schritt: n + 1, Status: 'offen' };
    },

    /* --- Netz --- */

    /* Laufwerk der Bibliothek Kursproduktion aufloesen. */
    driveId: function () {
      if (graph._driveId) return Promise.resolve(graph._driveId);
      return graph.siteId().then(function (sid) {
        return graph._hole('https://graph.microsoft.com/v1.0/sites/' + sid + '/drives?$select=id,name');
      }).then(function (j) {
        var d = (j.value || []).filter(function (x) {
          return x.name === CONFIG.sharePoint.bibliothek;
        })[0];
        if (!d) {
          throw new Error('Bibliothek "' + CONFIG.sharePoint.bibliothek +
                          '" nicht gefunden auf ' + CONFIG.sharePoint.sitePath);
        }
        graph._driveId = d.id;
        return d.id;
      });
    },

    /* Laedt die genannten JSON-Dateien aus Kursproduktion/_zentral.
       Eine fehlende Datei ist kein Abbruch — inhalt.laden entscheidet, was Pflicht ist. */
    zentralLaden: function (namen) {
      return graph.driveId().then(function (did) {
        return auth.token().then(function (t) {
          return Promise.all(namen.map(function (n) {
            var p = CONFIG.sharePoint.zentral + '/' + n + '.json';
            return fetch('https://graph.microsoft.com/v1.0/drives/' + did +
                         '/root:/' + encodeURI(p) + ':/content',
                         { headers: { Authorization: 'Bearer ' + t } })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (j) { return { name: n, daten: j }; })
              .catch(function () { return { name: n, daten: null }; });
          }));
        });
      }).then(function (teile) {
        var o = {};
        teile.forEach(function (x) { if (x.daten) o[x.name] = x.daten; });
        state.data.inhalt = o;
        return o;
      });
    },

    /* Den Kursordner in der Bibliothek finden — er heisst <KURS-ID>_<kurzname>. */
    kursOrdner: function (kursId) {
      if (state.data.ordner[kursId] !== undefined) {
        return Promise.resolve(state.data.ordner[kursId]);
      }
      return graph.driveId().then(function (did) {
        return graph._hole('https://graph.microsoft.com/v1.0/drives/' + did +
                           '/root/children?$select=id,name,webUrl,folder&$top=200');
      }).then(function (j) {
        var o = (j.value || []).filter(function (x) {
          return x.folder && x.name.indexOf(kursId + '_') === 0;
        })[0] || null;
        state.data.ordner[kursId] = o;
        return o;
      });
    },

    /* Was liegt tatsaechlich im Ordner dieses Schritts? */
    ordnerInhalt: function (kursId, unterordner) {
      var schluessel = kursId + '/' + unterordner;
      if (state.data.dateien[schluessel] !== undefined) {
        return Promise.resolve(state.data.dateien[schluessel]);
      }
      return Promise.all([graph.driveId(), graph.kursOrdner(kursId)]).then(function (r) {
        var did = r[0], ord = r[1];
        if (!ord) { state.data.dateien[schluessel] = null; return null; }
        return graph._hole('https://graph.microsoft.com/v1.0/drives/' + did +
              '/items/' + ord.id + ':/' + encodeURI(unterordner) +
              ':/children?$select=name,webUrl,size,lastModifiedDateTime,folder')
          .then(function (j) {
            var l = (j.value || []).filter(function (x) { return !x.folder; });
            state.data.dateien[schluessel] = l;
            return l;
          })
          .catch(function () { state.data.dateien[schluessel] = null; return null; });
      });
    },

    /* Ergebnis ablegen — der Weg Chat. Ordner und Name kommen aus dem
       Ablage-Kontrakt, nicht von der Person. */
    ablegen: function (kursId, ordner, datei, text) {
      return Promise.all([graph.driveId(), graph.kursOrdner(kursId)]).then(function (r) {
        var did = r[0], ord = r[1];
        if (!ord) throw new Error('Kursordner für ' + kursId + ' nicht gefunden');
        return auth.token().then(function (t) {
          return fetch('https://graph.microsoft.com/v1.0/drives/' + did +
                '/items/' + ord.id + ':/' + encodeURI(ordner + '/' + datei) + ':/content', {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'text/plain; charset=utf-8' },
            body: new Blob([text], { type: 'text/plain;charset=utf-8' })
          });
        });
      }).then(function (r) {
        if (!r.ok) throw new Error('Nicht abgelegt (Graph ' + r.status + ')');
        delete state.data.dateien[kursId + '/' + ordner];   /* Ordner neu lesen */
        return r.json();
      });
    },

    kurseLaden: function () {
      return graph.siteId().then(function (sid) {
        return graph._hole('https://graph.microsoft.com/v1.0/sites/' + sid +
                           '/lists/' + CONFIG.lists.kurse + '/items?expand=fields&$top=200');
      }).then(function (j) {
        state.data.kurse = (j.value || []).map(graph.mapKurs).sort(function (a, b) {
          return a.kursId < b.kursId ? -1 : 1;
        });
        return state.data.kurse;
      });
    },

    /* Schreibt Schritt und Status roh — der Aufrufer hat sie schon bestimmt. */
    standSetzenRoh: function (kurs, neu) {
      return graph.siteId().then(function (sid) {
        return auth.token().then(function (t) {
          return fetch('https://graph.microsoft.com/v1.0/sites/' + sid +
                       '/lists/' + CONFIG.lists.kurse + '/items/' + kurs.id + '/fields', {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
            body: JSON.stringify(neu)
          });
        });
      }).then(function (r) {
        if (!r.ok) throw new Error('Stand nicht gespeichert (Graph ' + r.status + ')');
        kurs.schritt = neu.Schritt;
        kurs.status = neu.Status;
        return kurs;
      });
    },

    standSetzen: function (kurs, n) {
      var neu = graph.naechsterStand(kurs, n);
      return graph.siteId().then(function (sid) {
        return auth.token().then(function (t) {
          return fetch('https://graph.microsoft.com/v1.0/sites/' + sid +
                       '/lists/' + CONFIG.lists.kurse + '/items/' + kurs.id + '/fields', {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
            body: JSON.stringify(neu)
          });
        });
      }).then(function (r) {
        if (!r.ok) throw new Error('Nicht gespeichert (Graph ' + r.status + ')');
        kurs.schritt = neu.Schritt;
        kurs.status = neu.Status;
        return kurs;
      });
    }
  };

  /* ---------- Navigation ----------
     Zwei Bereiche: Arbeiten (Kurse -> ein Kurs -> ein Schritt) und Nachschlagen.
     Werkzeuge klappen IM Schritt auf — kein Seitenwechsel, um einen Prompt zu kopieren. */
  var esc = function (s) { return helpers.escapeHtml(s); };

  var nav = {
    kurs: function () {
      if (!state.position.kursId) return null;
      return state.data.kurse.filter(function (k) {
        return k.kursId === state.position.kursId;
      })[0] || null;
    },

    kopf: function () {
      return root.ansichten.standort(state.data.inhalt, nav.kurs(), state.position);
    }
  };

  /* ---------- controller ---------- */
  var controller = {
    setz: function (html) {
      var el = (typeof document !== 'undefined') && document.getElementById('app');
      if (el) el.innerHTML = html;
      var kopf = (typeof document !== 'undefined') && document.getElementById('nav');
      if (kopf) kopf.innerHTML = (state.auth.account && state.data.inhalt) ? nav.kopf() : '';
    },

    render: function () {
      if (state.fehler) {
        controller.setz('<div class="card meldung"><span class="eyebrow">Fehler</span>' +
          '<h2>Das hat nicht geklappt</h2><p class="lead">' + esc(state.fehler) + '</p>' +
          '<div class="knopfreihe">' +
            '<button class="knopf" data-action="anmelden">Nochmals versuchen</button>' +
            '<button class="knopf still" data-action="zuruecksetzen">Anmeldung zur&uuml;cksetzen</button>' +
          '</div>' +
          '<p class="lead" style="margin-top:10px;font-size:13px">Hilft &bdquo;nochmals versuchen&ldquo; ' +
          'nicht, setzt der zweite Knopf die Anmeldung zur&uuml;ck. N&ouml;tig, wenn ein ' +
          'Anmeldefenster blockiert oder abgebrochen wurde.</p></div>');
        return;
      }
      if (state.laden) { controller.setz('<p class="lead">Wird geladen &hellip;</p>'); return; }

      if (!state.auth.account) {
        controller.setz('<div class="card"><span class="eyebrow">Anmeldung</span>' +
          '<h2>Kurswerkstatt</h2>' +
          '<p class="lead">Prozess, Werkzeuge und Kursdaten liegen in SharePoint. ' +
          'Melde dich mit deinem bbz-Konto an.</p>' +
          '<div class="knopfreihe"><button class="knopf" data-action="anmelden">' +
          'Mit bbz-Konto anmelden</button></div></div>');
        return;
      }

      var inh = state.data.inhalt, p = state.position;
      var meldung = '';
      if (state.hinweis) {
        meldung = '<div class="hinweis"><b>&#10003;</b>' + esc(state.hinweis) + '</div>';
        state.hinweis = null;
      }
      if (!inh) { controller.setz('<p class="lead">Inhalte werden geladen &hellip;</p>'); return; }

      if (p.bereich === 'nachschlagen') {
        controller.setz(root.ansichten.nachschlagen(inh, p.werk));
      } else if (p.schrittId) {
        var k = nav.kurs();
        var ab = root.inhalt.ablageVon(inh, p.schrittId, k ? k.kursId : '');
        var ordn = k ? state.data.ordner[k.kursId] : null;
        var schl = k && ab ? k.kursId + '/' + ab.ordner : null;
        controller.setz(meldung + root.ansichten.einSchritt(inh, k, p.schrittId, p.werkzeugId, {
          basisUrl: ordn ? ordn.webUrl : null,
          dateien: schl ? state.data.dateien[schl] : null
        }));
        if (k && ab) controller.ordnerNachladen(k.kursId, ab.ordner);
      } else if (p.kursId) {
        controller.setz(root.ansichten.einKurs(inh, nav.kurs()));
      } else {
        controller.setz(root.ansichten.alleKurse(state.data.kurse));
      }
    },

    /* Ordnerinhalt nachladen und danach neu zeichnen — der erste Aufbau wartet nicht darauf. */
    ordnerNachladen: function (kursId, ordner) {
      var schl = kursId + '/' + ordner;
      if (state.data.dateien[schl] !== undefined && state.data.ordner[kursId] !== undefined) return;
      graph.kursOrdner(kursId)
        .then(function () { return graph.ordnerInhalt(kursId, ordner); })
        .then(function () { if (state.position.schrittId) controller.render(); })
        .catch(function () {});
    },

    zu: function (aenderung) {
      Object.keys(aenderung).forEach(function (k) { state.position[k] = aenderung[k]; });
      controller.render();
      /* Hart nach oben, nicht sanft: das Dokument ist eine Zeile vorher komplett
         ausgetauscht worden, und eine laufende Animation landet dann irgendwo. */
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    },

    laden: function () {
      state.laden = true; state.fehler = null; controller.render();
      return Promise.all([graph.kurseLaden(), root.inhalt.laden(graph)])
        .then(function () { state.laden = false; controller.render(); })
        .catch(controller.scheitern);
    },

    scheitern: function (e) {
      state.laden = false;
      state.fehler = (e && e.message) ? e.message : String(e);
      controller.render();
    },

    /* Aus einem Klick heraus — nur so laesst der Browser das Popup zu. */
    anmelden: function () {
      state.laden = true; state.fehler = null; controller.render();
      return auth.anmelden().then(controller.laden).catch(controller.scheitern);
    },

    /* Weg Chat: Ergebnis entgegennehmen und nach Kontrakt ablegen. */
    ablegen: function (n, knopf) {
      var k = nav.kurs(), inh = state.data.inhalt;
      var feld = document.getElementById('ergebnis');
      if (!k || !feld) return;
      var text = feld.value.trim();
      if (!text) { feld.focus(); return; }

      var ab = root.inhalt.ablageVon(inh, n, k.kursId);
      var schl = k.kursId + '/' + ab.ordner;
      knopf.disabled = true; knopf.textContent = 'wird abgelegt …';

      /* Den Ordner frisch lesen — die Nummer darf nicht aus einem alten Stand kommen. */
      delete state.data.dateien[schl];
      graph.ordnerInhalt(k.kursId, ab.ordner)
        .then(function (dateien) {
          var ziel = root.inhalt.naechsteDatei(inh, n, k.kursId, dateien);
          if (!ziel) throw new Error('Für diesen Schritt ist kein versioniertes Ablegen vorgesehen.');
          return graph.ablegen(k.kursId, ziel.ordner, ziel.datei, text).then(function () { return ziel; });
        })
        .then(function (ziel) {
          var neu = graph.standNachAblage(k, +n);
          var weiter = neu ? graph.standSetzenRoh(k, neu) : Promise.resolve();
          return weiter.then(function () { return ziel; });
        })
        .then(function (ziel) {
          return graph.ordnerInhalt(k.kursId, ab.ordner).then(function () {
            state.hinweis = 'Abgelegt als ' + ziel.datei;
            controller.render();
          });
        })
        .catch(function (e) {
          knopf.disabled = false; knopf.textContent = 'Ablegen';
          alert('Nicht abgelegt: ' + (e.message || e));
        });
    },

    erledigt: function (n) {
      var k = nav.kurs();
      if (!k) return;
      return graph.standSetzen(k, +n)
        .then(function () { controller.render(); })
        .catch(function (e) { alert('Nicht gespeichert: ' + (e.message || e)); });
    },

    start: function () {
      state.laden = true; controller.render();
      return auth.stilleAnmeldung()
        .then(function (konto) {
          state.laden = false;
          if (!konto) { controller.render(); return; }
          return controller.laden();
        })
        .catch(controller.scheitern);
    }
  };

  /* ---------- Ereignisse ---------- */
  function kopieren(text, knopf) {
    function fertig() {
      var alt = knopf.textContent;
      knopf.textContent = 'kopiert ✓';
      setTimeout(function () { knopf.textContent = alt; }, 1500);
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(fertig, fertig);
    } else { fertig(); }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t) return;
      var a = t.dataset.action;

      if (a === 'anmelden')      { controller.anmelden(); return; }
      if (a === 'zuruecksetzen') { auth.zuruecksetzen(); return; }
      if (a === 'theme') {
        var cur = document.documentElement.getAttribute('data-theme');
        if (!cur) cur = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
        return;
      }
      if (a === 'bereich') {
        controller.zu({ bereich: t.dataset.bereich === 'nachschlagen' ? 'nachschlagen' : 'arbeiten' });
        return;
      }
      if (a === 'werk')   { controller.zu({ bereich: 'nachschlagen', werk: t.dataset.werk }); return; }
      if (a === 'kurse')  { controller.zu({ bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null }); return; }
      if (a === 'kurs')   { controller.zu({ bereich: 'arbeiten', kursId: t.dataset.kurs, schrittId: null, werkzeugId: null }); return; }
      if (a === 'schritt'){ controller.zu({ bereich: 'arbeiten', schrittId: t.dataset.schritt, werkzeugId: null }); return; }
      if (a === 'erledigt') { controller.erledigt(t.dataset.schritt); return; }
      if (a === 'ablegen')  { controller.ablegen(t.dataset.schritt, t); return; }

      /* Werkzeug auf- und zuklappen — ohne Seitenwechsel, ohne Neuaufbau. */
      if (a === 'werkzeug') {
        var id = t.dataset.werkzeug;
        state.position.werkzeugId = (state.position.werkzeugId === id) ? null : id;
        var karte = document.getElementById('wt-' + id);
        Array.prototype.forEach.call(document.querySelectorAll('.wtool'), function (x) {
          x.classList.toggle('auf', x === karte && state.position.werkzeugId === id);
        });
        return;
      }
      if (a === 'kopieren') {
        var w = root.inhalt.werkzeug(state.data.inhalt, t.dataset.werkzeug);
        if (!w) return;
        var karte2 = t.closest('.wtool');
        var aktiv = karte2 && karte2.querySelector('.prompt.on');
        kopieren(aktiv ? aktiv.textContent : (w.claude || w.chatgpt || ''), t);
        return;
      }
      if (a === 'fassung') {
        var box = t.closest('.wtool');
        Array.prototype.forEach.call(box.querySelectorAll('.ptab'), function (x) {
          x.classList.toggle('on', x === t);
        });
        Array.prototype.forEach.call(box.querySelectorAll('.prompt'), function (x) {
          x.classList.toggle('on', x.dataset.box === t.dataset.fassung);
        });
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', controller.start);
  }

  /* ---------- Export ---------- */
  root.nav = nav;
  root.CONFIG = CONFIG;
  root.auth = auth;
  root.graph = graph;
  root.state = state;
  root.helpers = helpers;
  root.controller = controller;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG: CONFIG, state: state, helpers: helpers,
                       auth: auth, graph: graph, controller: controller };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
