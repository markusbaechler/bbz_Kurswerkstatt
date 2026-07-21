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

  /* ---------- controller (Geruest) ---------- */
  var controller = {
    render: function () {
      var el = (typeof document !== 'undefined') && document.getElementById('app');
      if (!el) return;
      el.innerHTML =
        '<div class="card">' +
          '<span class="eyebrow">Geruest</span>' +
          '<h2>Kurswerkstatt</h2>' +
          '<p class="lead">Die Huelle steht und ist deployt. ' +
          'Datenmodule, Anmeldung und Ansichten folgen Schritt fuer Schritt.</p>' +
        '</div>';
    },

    start: function () {
      controller.render();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', controller.start);
  }

  /* ---------- Export ---------- */
  root.CONFIG = CONFIG;
  root.state = state;
  root.helpers = helpers;
  root.controller = controller;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG: CONFIG, state: state, helpers: helpers, controller: controller };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
