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
      sitePath: '/sites/ffentlicheAngebote'
    },

    lists: { kurse: 'KWKurse' }
  };

  /* ---------- state ---------- */
  var state = {
    auth:      { account: null },
    data:      { kurse: [] },
    position:  { bereich: 'kurse', kursId: null, schrittId: null, werkzeugId: null },
    laden:     false,
    fehler:    null
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

    anmelden: function () {
      var c = auth._client();
      return c.initialize().then(function () {
        var konten = c.getAllAccounts();
        if (konten.length > 0) {
          state.auth.account = konten[0];
          return konten[0];
        }
        return c.loginPopup({ scopes: CONFIG.graph.scopes }).then(function (r) {
          state.auth.account = r.account;
          return r.account;
        });
      });
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

    /* Was der Erledigt-Haken auf Schritt n bewirkt. */
    naechsterStand: function (kurs, n) {
      if (graph.standVon(kurs, n) === 'fertig') return { Schritt: n, Status: 'offen' };
      if (n === 9) return { Schritt: 9, Status: 'fertig' };
      return { Schritt: n + 1, Status: 'offen' };
    },

    /* --- Netz --- */

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

  /* ---------- Ansicht: alle Kurse ---------- */
  var esc = function (s) { return helpers.escapeHtml(s); };

  var ansichtKurse = {
    render: function (kurse) {
      if (!kurse.length) {
        return '<div class="card"><span class="eyebrow">Alle Kurse</span>' +
               '<h2>Noch keine Kurse</h2>' +
               '<p class="lead">In der Liste KWKurse steht noch kein Eintrag.</p></div>';
      }

      var fertig = kurse.filter(function (k) { return graph.fortschritt(k) === 9; }).length;

      var zeilen = kurse.map(function (k) {
        var punkte = '';
        for (var n = 1; n <= 9; n++) {
          var st = graph.standVon(k, n);
          punkte += '<span class="pkt ' + st + '" title="Schritt ' + n + ': ' + st + '">' +
                    (st === 'fertig' ? '&#10003;' : n) + '</span>';
        }
        return '<tr>' +
          '<td><span class="kid">' + esc(k.kursId) + '</span></td>' +
          '<td>' + esc(k.kurstitel) + '</td>' +
          '<td class="dim">' + esc(k.kompetenzfeld) + '</td>' +
          '<td><div class="pkte">' + punkte + '</div></td>' +
          '<td class="mono fort">' + graph.fortschritt(k) + '&#8202;/&#8202;9</td>' +
        '</tr>';
      }).join('');

      return '<div class="kopf">' +
          '<span class="eyebrow">Alle Kurse</span>' +
          '<h2>' + kurse.length + ' Kurse &middot; ' + fertig + ' fertig</h2>' +
          '<p class="lead">Der Stand je Schritt wird aus Schritt und Status berechnet, ' +
          'nicht gespeichert.</p>' +
        '</div>' +
        '<div class="card" style="padding:14px 16px"><div class="tblwrap"><table class="tbl">' +
          '<thead><tr><th>Kurs</th><th>Titel</th><th>Kompetenzfeld</th>' +
          '<th>Schritt 1&thinsp;&ndash;&thinsp;9</th><th>Stand</th></tr></thead>' +
          '<tbody>' + zeilen + '</tbody>' +
        '</table></div></div>';
    }
  };

  /* ---------- controller ---------- */
  var controller = {
    setz: function (html) {
      var el = (typeof document !== 'undefined') && document.getElementById('app');
      if (el) el.innerHTML = html;
    },

    render: function () {
      if (state.fehler) {
        controller.setz('<div class="card meldung"><span class="eyebrow">Fehler</span>' +
          '<h2>Das hat nicht geklappt</h2><p class="lead">' + esc(state.fehler) + '</p></div>');
        return;
      }
      if (state.laden) {
        controller.setz('<p class="lead">Wird geladen &hellip;</p>');
        return;
      }
      controller.setz(ansichtKurse.render(state.data.kurse));
    },

    start: function () {
      state.laden = true;
      controller.render();
      return auth.anmelden()
        .then(function () { return graph.kurseLaden(); })
        .then(function () { state.laden = false; controller.render(); })
        .catch(function (e) {
          state.laden = false;
          state.fehler = e && e.message ? e.message : String(e);
          controller.render();
        });
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', controller.start);
  }

  /* ---------- Export ---------- */
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
