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
      /* Lokal gilt die localhost-URI, deployt die Pages-URI — beide sind in Azure
         registriert. Fest auf Pages verdrahtet war die Anmeldung lokal unmoeglich:
         das Popup kehrte nach github.io zurueck und die Antwort erreichte die App
         nie (gefunden bei der Live-Probe am 2026-07-29). In Node gibt es kein
         location — dann zaehlt der Wert nicht, MSAL wird dort nie erzeugt. */
      redirectUri: (typeof location !== 'undefined' && location.hostname === 'localhost')
        ? 'http://localhost:8080/'
        : 'https://markusbaechler.github.io/bbz_Kurswerkstatt/',
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
    /* vorlage (B5, Etappe 3b): das ArrayBuffer der docx-Vorlage
       (_zentral/vorlagen/reference.docx) — undefined = noch nie geladen,
       null = geladen, aber nicht gefunden/fehlgeschlagen, sonst das
       ArrayBuffer. Ein Abruf je Sitzung (graph.vorlageLaden), s. dort. */
    data:      { kurse: [], inhalt: null, ordner: {}, dateien: {}, briefing: {}, dossier: {}, dossierETag: {},
                 vorlage: undefined,
                 /* dateiAuswahl (B9-F1): die Auswahl am Datei-Input #datei ueberlebt
                    keinen Render (Live-Befund) — controller.render() baut die Ansicht
                    als HTML-String neu, der Input ist danach ein NEUES, leeres Element.
                    File-Objekte leben aber im JS-Heap weiter, deshalb wird die Auswahl
                    beim change-Event hierher gehoben statt im Element zu bleiben: EIN
                    Objekt { kursId, schrittId, dateien }, mit Positions-Stempel (Muster
                    _formularSnapshot) — kein Verzeichnis je Kurs, weil immer nur eine
                    Hochladen-Flaeche gleichzeitig sichtbar ist. null = nichts gewaehlt.
                    s. controller.dateiGewaehlt/hochladen, ansichten.js Hochladen-Block. */
                 dateiAuswahl: null,
                 /* uploadMeldung (B9-F3): dieselbe Klasse Live-Befund wie dateiAuswahl,
                    dritter Vorfall — jede Upload-Antwort (Erfolg wie Abweisung) landete
                    bisher nur im Meldungsblock OBEN, weil klemmtSichtbar sofort nach dem
                    Setzen von meld.textContent controller.render() ruft: der Neuaufbau
                    ersetzt den lokalen #hochladefehler-Knoten durch einen neuen, leeren,
                    bevor die Person (die beim Hochladen-Block UNTEN steht) ihn liest.
                    { typ: 'ok'|'fehler', text } lebt deshalb im State, wird IM
                    Hochladen-Block gerendert (ansichten.js) und NICHT beim Rendern
                    konsumiert — anders als state.hinweis/fehlerHinweis. Geleert bei:
                    neuem Hochladen-Klick (Start), neuer Dateiauswahl (dateiGewaehlt) und
                    Navigation weg von der Kurs/Schritt-Kombination (controller.zu(),
                    dasselbe Muster wie dateiAuswahl). null = keine Meldung. */
                 uploadMeldung: null },
    position:  { bereich: 'arbeiten', kursId: null, schrittId: null, werkzeugId: null, werk: null,
                 variante: null, weg: null },
    laden:     false,
    fehler:    null,
    hinweis:   null,
    /* Getrennt von hinweis (M3, Etappe 1e Task 4): hinweis ist eine erfolgreiche
       Aktion (gruen, Haekchen), fehlerHinweis eine fehlgeschlagene (rot, .klemmt-
       Optik) — beide werden in _renderAufbau in EINEM Block vor der Ansicht
       gerendert und dort je einzeln konsumiert (auf null gesetzt). */
    fehlerHinweis: null,
    /* Lauf-Merker fuer den Gate-Klick (Etappe 2, Task 6, Fix-Runde 1, F3) —
       Schluessel kursId+'/'+schrittId, waehrend controller.gateKlick laeuft.
       Lebt in state (nicht am DOM-Knopf), damit ein Render mitten im Lauf
       (z. B. ein auslaufendes ordnerNachladen) den Knopf nicht wieder aktiviert
       und einen zweiten, ueberlappenden Lauf zulaesst — s. ansichten.gateFreigabe. */
    gateLaeuft: {}
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
        schritt: (s >= 1 && s <= 8) ? s : 1,
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
      if (n === 8) return { Schritt: 8, Status: 'fertig' };
      return { Schritt: n + 1, Status: 'offen' };
    },

    /* Pfad relativ zum Kursordner. Leerer Ordner heisst: die Datei liegt im
       Kursordner selbst — das Dossier gehoert zu keinem Schritt. */
    pfadImKursordner: function (ordner, datei) {
      return ordner ? ordner + '/' + datei : datei;
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

    /* Eine Roh-Datei (kein JSON) aus Kursproduktion/_zentral lesen — Muster
       zentralLaden, aber fuer Binaerdateien wie die docx-Vorlage (B5,
       Etappe 3b): ArrayBuffer statt res.json(). null bei jedem Fehler (nicht
       gefunden, Netz) — kein Wurf, der Aufrufer (graph.vorlageLaden)
       entscheidet, ob das ein Abbruch ist. */
    zentralDateiRoh: function (pfad) {
      return graph.driveId().then(function (did) {
        return auth.token().then(function (t) {
          var p = CONFIG.sharePoint.zentral + '/' + pfad;
          return fetch('https://graph.microsoft.com/v1.0/drives/' + did +
                       '/root:/' + encodeURI(p) + ':/content',
                       { headers: { Authorization: 'Bearer ' + t } })
            .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
            .catch(function () { return null; });
        });
      });
    },

    /* Die docx-Vorlage fuer den Skript-Bau (B5) — ein Abruf je Sitzung.
       state.data.vorlage cacht NUR einen Erfolg (Fixwave 2026-08-04, I2):
       vorher cachte jedes Ergebnis, auch null bei Fehlschlag — ein einzelner
       Netz-Timeout blockierte damit JEDEN weiteren Schritt-3-Upload der
       ganzen Sitzung mit derselben, irrefuehrenden Meldung ("nicht
       gefunden", obwohl die Datei sehr wohl da ist). Liefert
       zentralDateiRoh null, bleibt state.data.vorlage auf undefined — der
       naechste Aufruf (naechster Upload-Versuch) probiert erneut, statt den
       einmaligen Fehlschlag fuer die Sitzung festzuschreiben. */
    vorlageLaden: function () {
      if (state.data.vorlage !== undefined) return Promise.resolve(state.data.vorlage);
      return graph.zentralDateiRoh('vorlagen/reference.docx').then(function (buf) {
        if (buf) state.data.vorlage = buf;
        return buf;
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
    /* Eine Datei im selben Ordner umbenennen. Gebraucht, um eine bisherige
       _final auf ihre Versionsnummer zurueckzustufen, bevor die neue Fassung
       _final heisst — nur so gibt es nie zwei geltende Fassungen nebeneinander.
       Auch der Gate-Klick (Etappe 2, Task 6) benennt hierueber _vN auf _final um. */
    umbenennen: function (kursId, ordner, alt, neu) {
      return Promise.all([graph.driveId(), graph.kursOrdner(kursId)]).then(function (r) {
        var did = r[0], ord = r[1];
        if (!ord) throw new Error('Kein Kursordner für ' + kursId + '.');
        return auth.token().then(function (t) {
          return fetch('https://graph.microsoft.com/v1.0/drives/' + did +
                '/items/' + ord.id + ':/' + encodeURI(graph.pfadImKursordner(ordner, alt)), {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: neu })
          });
        });
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (b) {
            throw new Error('Umbenennen von ' + alt + ' nach ' + neu + ' fehlgeschlagen (' +
                            r.status + '): ' + b.slice(0, 200));
          });
        }
        /* Cache invalidieren wie graph.ablegen/graph.dateiLoeschen (Etappe 2, Task 6,
           Fix-Runde 1, F2): eine Umbenennung aendert den Ordnerinhalt genauso wie ein
           Schreiben oder Loeschen. Vorher fehlte das hier — maskiert in jedem bisherigen
           Aufrufer (controller.ablegen-Zurueckstufen, controller.gateKlick), weil dort
           IMMER ein direkt folgendes graph.ablegen denselben Ordner ohnehin invalidierte.
           Der Gate-Wiedereinstiegsfall "_final UND Protokoll liegen schon" (b) ruft nach
           einer Umbenennung aber NIE mehr graph.ablegen fuer diesen Ordner auf (nur noch
           den Dossier-Schreiber, ein anderer Ordner) — ohne diese Zeile zeigte die Ansicht
           danach weiterhin die alte _vN-Datei. Zentral hier statt an jeder Aufrufstelle:
           eine Quelle fuer die Invalidierungsregel, konsistent mit den beiden
           Geschwisterfunktionen. */
        delete state.data.dateien[kursId + '/' + ordner];
        return neu;
      });
    },

    /* eTagWert ist optional (Etappe 1e, Task 1): ohne ihn ein einfaches PUT wie
       bisher — jeder bestehende Aufrufer bleibt gueltig. Mit ihm traegt der Request
       "If-Match", und Graph antwortet 412, wenn die Datei inzwischen von woanders
       geschrieben wurde — das serialisierte Dossier-Schreiben (controller.dossierSchreiben)
       ist der einzige Aufrufer, der ihn setzt. Der Fehler traegt .status, damit die
       Warteschlange 412 erkennt, ohne den Meldungstext zu parsen.

       nurNeu ist optional (Etappe 2, Task 7): bei true UND ohne eTagWert haengt der
       PUT '?@microsoft.graph.conflictBehavior=fail' an — Graph antwortet dann 409,
       wenn die Datei zwischen dem Pruefen "gibt es schon?" und diesem Schreiben von
       woanders ANGELEGT wurde (die Erstanlage-Luecke, die If-Match nicht abdeckt,
       weil es noch keinen eTag gibt, gegen den es pruefen koennte). Traegt eTagWert
       bereits einen Wert, hat If-Match Vorrang — nurNeu aendert dann nichts mehr am
       Query-String. Jeder bestehende Aufrufer ohne nurNeu bleibt unveraendert
       (einfaches PUT, kein conflictBehavior). */
    ablegen: function (kursId, ordner, datei, text, eTagWert, nurNeu) {
      return Promise.all([graph.driveId(), graph.kursOrdner(kursId)]).then(function (r) {
        var did = r[0], ord = r[1];
        if (!ord) {
          throw new Error('In der Bibliothek Kursproduktion gibt es keinen Ordner für ' +
            kursId + '. Leg die Ablage in Schritt 1 an — dann noch einmal ablegen. ' +
            'Dein Text bleibt im Feld stehen.');
        }
        return auth.token().then(function (t) {
          var headers = { Authorization: 'Bearer ' + t, 'Content-Type': 'text/plain; charset=utf-8' };
          if (eTagWert) headers['If-Match'] = eTagWert;
          var query = (nurNeu && !eTagWert) ? '?@microsoft.graph.conflictBehavior=fail' : '';
          return fetch('https://graph.microsoft.com/v1.0/drives/' + did +
                '/items/' + ord.id + ':/' + encodeURI(graph.pfadImKursordner(ordner, datei)) + ':/content' + query, {
            method: 'PUT',
            headers: headers,
            body: new Blob([text], { type: 'text/plain;charset=utf-8' })
          });
        });
      }).then(function (r) {
        if (!r.ok) {
          var fehler = new Error('Nicht abgelegt (Graph ' + r.status + ')');
          fehler.status = r.status;
          throw fehler;
        }
        delete state.data.dateien[kursId + '/' + ordner];   /* Ordner neu lesen */
        return r.json();
      });
    },

    /* Eine Datei in den SharePoint-Papierkorb legen — der Datei-Teil von
       controller.quelleEntfernen (Etappe 1c). 404 gilt als erledigt: die Datei
       war schon weg, das ist kein Fehlerfall. Jeder andere Status ist einer. */
    dateiLoeschen: function (kursId, ordner, datei) {
      return Promise.all([graph.driveId(), graph.kursOrdner(kursId), auth.token()]).then(function (r) {
        var did = r[0], ord = r[1], t = r[2];
        if (!ord) {
          throw new Error('In der Bibliothek Kursproduktion gibt es keinen Ordner für ' + kursId + '.');
        }
        return fetch('https://graph.microsoft.com/v1.0/drives/' + did +
              '/items/' + ord.id + ':/' + encodeURI(graph.pfadImKursordner(ordner, datei)), {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + t }
        });
      }).then(function (r) {
        if (r.status !== 204 && r.status !== 404) {
          throw new Error('Nicht gelöscht (Graph ' + r.status + ')');
        }
        delete state.data.dateien[kursId + '/' + ordner];
        return true;
      });
    },

    /* Einen Ordner anlegen. 409 heisst „gibt es schon" und gilt als Erfolg —
       nur so bleibt der Knopf beliebig oft drueckbar, ohne Schaden anzurichten. */
    ordnerAnlegen: function (did, elternPfad, name) {
      return auth.token().then(function (t) {
        var basis = 'https://graph.microsoft.com/v1.0/drives/' + did;
        var url = elternPfad
          ? basis + '/root:/' + encodeURI(elternPfad) + ':/children'
          : basis + '/root/children';
        return fetch(url, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail'
          })
        });
      }).then(function (r) {
        if (r.ok) return r.json();
        if (r.status === 409) return null;            /* war schon da */
        throw new Error('Ordner „' + name + '" nicht angelegt (Graph ' + r.status + ')');
      });
    },

    /* Schritt 1, erster Teil: der Kursordner und seine Unterordner.
       Nacheinander, nicht parallel — so sagt ein Fehler, an welchem Ordner es lag. */
    ablageAnlegen: function (kursId, name, unterordner) {
      return graph.driveId().then(function (did) {
        return graph.ordnerAnlegen(did, null, name).then(function () {
          return unterordner.reduce(function (kette, u) {
            return kette.then(function () { return graph.ordnerAnlegen(did, name, u); });
          }, Promise.resolve());
        });
      }).then(function () {
        delete state.data.ordner[kursId];             /* die Suche war negativ gecacht */
        return graph.kursOrdner(kursId);
      });
    },

    /* Eine Datei in den Kursordner legen. Graph nimmt bis 4 MB in einem Zug;
       darueber verlangt es eine Ladesitzung in Stuecken. Der Moodle-Export
       (Schritt 7) liegt regelmaessig darueber — deshalb beide Wege. */
    hochladen: function (kursId, ordner, datei, datenBlob, melde) {
      var GRENZE = 4 * 1024 * 1024;
      var STUECK = 5 * 320 * 1024;            /* Vielfaches von 320 KiB, wie Graph verlangt */

      return Promise.all([graph.driveId(), graph.kursOrdner(kursId), auth.token()])
        .then(function (r) {
          var did = r[0], ord = r[1], t = r[2];
          if (!ord) {
            throw new Error('In der Bibliothek Kursproduktion gibt es keinen Ordner für ' +
              kursId + '. Leg die Ablage in Schritt 1 an.');
          }
          var pfad = 'https://graph.microsoft.com/v1.0/drives/' + did + '/items/' + ord.id +
                     ':/' + encodeURI(ordner + '/' + datei);

          if (datenBlob.size <= GRENZE) {
            if (melde) melde(1);
            return fetch(pfad + ':/content', {
              method: 'PUT',
              headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/octet-stream' },
              body: datenBlob
            }).then(function (x) {
              if (!x.ok) throw new Error('Nicht hochgeladen (Graph ' + x.status + ')');
              return x.json();
            });
          }

          return fetch(pfad + ':/createUploadSession', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } })
          }).then(function (x) {
            if (!x.ok) throw new Error('Ladesitzung abgelehnt (Graph ' + x.status + ')');
            return x.json();
          }).then(function (sitzung) {
            var gesamt = datenBlob.size;

            /* Nacheinander, nicht parallel: Graph verlangt die Stuecke in Reihenfolge. */
            function stueck(von) {
              if (von >= gesamt) return Promise.resolve(null);
              var bis = Math.min(von + STUECK, gesamt);
              if (melde) melde(bis / gesamt);
              return fetch(sitzung.uploadUrl, {
                method: 'PUT',
                headers: {
                  'Content-Length': String(bis - von),
                  'Content-Range': 'bytes ' + von + '-' + (bis - 1) + '/' + gesamt
                },
                body: datenBlob.slice(von, bis)
              }).then(function (x) {
                if (!x.ok && x.status !== 202) {
                  throw new Error('Abgebrochen bei ' + Math.round(von / 1048576) +
                                  ' MB (Graph ' + x.status + ')');
                }
                return x.status === 202 ? stueck(bis) : x.json();
              });
            }
            return stueck(0);
          });
        })
        .then(function (erg) {
          delete state.data.dateien[kursId + '/' + ordner];
          return erg;
        });
    },

    /* Eine Textdatei aus dem Kursordner lesen — fuer das Briefing, das in die
       Projekt-Instruktionen eingeht. Nicht gefunden ist kein Fehler, sondern null. */
    dateiLesen: function (kursId, ordner, datei) {
      return Promise.all([graph.driveId(), graph.kursOrdner(kursId), auth.token()])
        .then(function (r) {
          var did = r[0], ord = r[1], t = r[2];
          if (!ord) return null;
          return fetch('https://graph.microsoft.com/v1.0/drives/' + did +
                '/items/' + ord.id + ':/' + encodeURI(graph.pfadImKursordner(ordner, datei)) + ':/content',
                { headers: { Authorization: 'Bearer ' + t } })
            .then(function (x) { return x.ok ? x.text() : null; });
        })
        .catch(function () { return null; });
    },

    /* Wie dateiLesen, aber ohne die Fehlerkonflation: dateiLesen liefert null bei
       404 UND bei jedem anderen Fehler (Token, 5xx, Netz) — fuer Aufrufer, die still
       ersetzen duerfen, wenn eine Datei fehlt (Briefing). Fuer das Dossier ist das
       falsch: ein Lesefehler darf nie als "fehlt" gelten, sonst ersetzt ein spaeterer
       Import ein Dossier, das nur gerade nicht lesbar war. Drei Faelle:
       {ok:true, text, eTag} · {ok:false, fehlt:true} (404 oder kein Kursordner) ·
       {ok:false, fehlt:false} (jeder andere Fehler).
       eTag (Etappe 1e, Task 1): Graph liefert ihn im GET-Response-Header nicht
       zuverlaessig bei :/content — deshalb vor dem Inhalt einmal die Metadaten holen
       ($select=eTag). Ein zusaetzlicher Roundtrip, aber die einzige Quelle, die auch
       beim allerersten Laden funktioniert, ohne dass vorher in dieser Sitzung je
       geschrieben wurde (die Alternative "eTag aus der letzten PUT-Antwort merken"
       haette dort noch nichts zu merken). controller.dossierSchreiben braucht den
       eTag fuer If-Match; jeder andere Aufrufer ignoriert ihn einfach. */
    dateiLesenGenau: function (kursId, ordner, datei) {
      return Promise.all([graph.driveId(), graph.kursOrdner(kursId), auth.token()])
        .then(function (r) {
          var did = r[0], ord = r[1], t = r[2];
          if (!ord) return { ok: false, fehlt: true };
          var basis = 'https://graph.microsoft.com/v1.0/drives/' + did +
                      '/items/' + ord.id + ':/' + encodeURI(graph.pfadImKursordner(ordner, datei));
          return fetch(basis + '?$select=eTag', { headers: { Authorization: 'Bearer ' + t } })
            .then(function (m) {
              if (m.status === 404) return { ok: false, fehlt: true };
              if (!m.ok) return { ok: false, fehlt: false };
              return m.json().then(function (meta) {
                return fetch(basis + ':/content', { headers: { Authorization: 'Bearer ' + t } })
                  .then(function (x) {
                    if (x.status === 404) return { ok: false, fehlt: true };
                    if (!x.ok) return { ok: false, fehlt: false };
                    return x.text().then(function (text) {
                      return { ok: true, text: text, eTag: meta.eTag };
                    });
                  });
              });
            });
        })
        .catch(function () { return { ok: false, fehlt: false }; });
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

  /* Wohin Fachquellen-Dateien kommen (Spec §5.6) — abgeleitet, nicht als Konstante
     getippt (Audit I3): quelleErfassen legt hierhin ab, quelleEntfernen loescht von
     hier, und inhalt.quellenOrdner() ist die EINE Stelle, die dafuer den
     Schritt-3-Ordner aus dem Ablage-Kontrakt liest — aendert er sich dort, geht
     dieser Pfad mit, statt an drei Stellen (hier, ansichten.js, inhalt.js) von
     Hand nachgezogen werden zu muessen. */
  function quellenOrdner() { return root.inhalt.quellenOrdner(state.data.inhalt); }

  /* Die drei Quellen-Eingaben, die render() vor jedem Neuaufbau sichert (Audit C2,
     Etappe 1e Task 2) — Ergaenzung zu den Briefing-Feldern, die schon per data-feld
     auffindbar sind. quelle-datei (Datei-Input) fehlt bewusst: ein Datei-Input laesst
     sich aus Sicherheitsgruenden nicht programmatisch wiederbefuellen. */
  var QUELLEN_FORMULAR_IDS = ['quelle-titel', 'quelle-herausgeber', 'quelle-stand', 'quelle-url'];

  /* ---------- controller ---------- */
  var controller = {
    setz: function (html) {
      var el = (typeof document !== 'undefined') && document.getElementById('app');
      if (el) el.innerHTML = html;
      var kopf = (typeof document !== 'undefined') && document.getElementById('nav');
      if (kopf) kopf.innerHTML = (state.auth.account && state.data.inhalt) ? nav.kopf() : '';
    },

    /* Sichert, was gerade in den Formularfeldern steht, BEVOR render() die Ansicht
       neu aufbaut (Audit C2, Etappe 1e Task 2). Der Mechanismus sitzt zentral in
       render() und deckt damit JEDEN Render-Aufruf ab, nicht nur eine feste Liste
       von Ausloesern — Beispiele fuer Aufrufe, die mitten im Tippen neu rendern:
       briefingNachladen, dossierNachladen, quelleErfassen (Erfolg), contentModus
       (Fehler), aber ebenso dossierSpeichern-Erfolg und quelleEntfernen.
       Reine Bestandsaufnahme, kein Fokus-Wechsel.

       Stempelt zusaetzlich kursId/schrittId aus state.position (Fix-Runde 1,
       Review-Finding 1): der Fremd-Kurs-Schutz war zuvor nur ein Nebeneffekt der
       Navigation (ein Kurswechsel setzt zufaellig schrittId auf null, wodurch ein
       Zwischen-Render ohne Formular laeuft) — jetzt verankert im Mechanismus
       selbst. _formularWiederherstellen setzt nur ein, wenn beide beim
       Wiederherstellen noch mit state.position uebereinstimmen.

       Checkboxen (form:'haken', Etappe 1e Task 6 Fix-Runde 1, C-2) sichern
       .checked statt .value als eigener Werttyp (bool) — ein natives
       Checkbox-Element liefert ueber .value ohnehin immer denselben String,
       unabhaengig vom Ankreuzzustand; s. _formularWiederherstellen fuer die
       Restaurierungsregel und ihre Begruendung. */
    _formularSnapshot: function () {
      if (typeof document === 'undefined') return null;
      var werte = {};
      Array.prototype.forEach.call(document.querySelectorAll('#briefing-felder [data-feld]'), function (el) {
        werte['feld:' + el.dataset.feld] = (el.type === 'checkbox')
          ? !!el.checked
          : String(el.value == null ? '' : el.value);
      });
      QUELLEN_FORMULAR_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) werte['id:' + id] = String(el.value == null ? '' : el.value);
      });
      /* Die content-modus-Radios (M-2, Fix-Runde Final) tragen weder data-feld
         noch eine eigene id, nur ein gemeinsames name — Schluessel ist deshalb
         der Wert (value) des jeweiligen Radios. checked UND disabled werden
         gesichert: checked wie bei einer Checkbox (Konvention T6 — beide
         Zustaende sind immer eine bewusste, beobachtbare Antwort, keine
         Zweideutigkeit wie bei leerem Text); disabled zusaetzlich, weil
         contentModus() waehrend des Schreibens alle Radios sperrt — ein
         Zwischen-Render mitten in dieser Sperre wuerde sie sonst beim
         Neuaufbau wieder aufheben (die Ansicht kennt den laufenden
         Schreibvorgang nicht, nur ordnerFehlt), und ein zweiter Klick koennte
         die Warteschlange waehrend des ersten Schreibens ein zweites Mal
         anstossen. */
      Array.prototype.forEach.call(document.querySelectorAll('[name="content-modus"]'), function (r) {
        werte['radio:content-modus:' + r.value] = { checked: !!r.checked, disabled: !!r.disabled };
      });
      /* Gate-Box-Felder (Fix-Runde 1, Task 6; Z9 verkleinert den Bestand auf
         #gate-zweitpruefung — die Punkte-Erfassung/-Verwaltung ist mit Z9 ganz aus
         der Box entfernt, s. ansichten.js gateBlock). EIN gemeinsamer Selektor
         (data-gate-feld) statt einer eigenen ID-Liste je Feld wie
         QUELLEN_FORMULAR_IDS bleibt bewusst bestehen — er deckt automatisch auch
         kuenftige Gate-Felder ab, ohne dass dieser Code eine feste Liste kennen
         muesste. Geschluesselt nach el.id. data-was bleibt Teil des generischen
         Mechanismus (kein Gate-Feld traegt es aktuell, s. Fix-Runde 2, Task 6, fuer
         die urspruengliche Begruendung, falls ein indiziertes Feld zurueckkehrt). */
      Array.prototype.forEach.call(document.querySelectorAll('[data-gate-feld]'), function (el) {
        if (!el.id) return;
        werte['gate:' + el.id] = String(el.value == null ? '' : el.value);
        if (el.dataset && el.dataset.was !== undefined) werte['gate-was:' + el.id] = el.dataset.was;
      });
      /* gate-version-Radios (Z9): dieselbe Beide-Richtungen-Regel wie content-modus
         oben — checked ist immer eine bewusste, beobachtbare Antwort, keine
         Zweideutigkeit wie bei leerem Text. Ohne diesen Erhalt wuerde ein
         Zwischen-Render (z. B. ein auslaufendes ordnerNachladen) waehrend eines
         laufenden Gates die manuell gewaehlte (nicht-hoechste) Fassung wieder auf
         die hoechste zuruecksetzen. */
      Array.prototype.forEach.call(document.querySelectorAll('[name="gate-version"]'), function (r) {
        werte['radio:gate-version:' + r.value] = { checked: !!r.checked };
      });
      var aktiv = document.activeElement;
      return {
        werte: werte,
        fokusId: (aktiv && aktiv.id) ? aktiv.id : null,
        kursId: state.position.kursId || null,
        schrittId: state.position.schrittId != null ? String(state.position.schrittId) : null
      };
    },

    /* Setzt nach dem Neuaufbau zurueck, was vorher gesichert wurde — aber nur, wo
       der gesicherte Wert vom frisch gerenderten abweicht UND nicht leer ist
       (einfachste tragfaehige Variante, Brief Task 2). Bewusst so: ein geleertes
       Feld gilt erst als geleert, wenn gesichert wurde — sonst wuerde ein Neuaufbau,
       der zufaellig waehrend eines Loeschvorgangs laeuft, das Leeren verewigen,
       bevor die Person es bestaetigt hat; der Dossier-Stand gewinnt dann bewusst.
       Kein Datei-Input: der laesst sich nicht programmatisch wiederbefuellen — eine
       akzeptierte Luecke, siehe Task-2-Report.

       Checkboxen (form:'haken', Etappe 1e Task 6 Fix-Runde 1, C-2) folgen einer
       ANDEREN Regel als Text: hier gewinnt der Snapshot-Zustand, sobald er vom
       frisch gerenderten abweicht — in BEIDE Richtungen, also auch von
       angehakt zurueck auf nicht angehakt. Das ist bewusst kein Widerspruch zur
       Text-Regel, sondern dieselbe Absicht (der zuletzt sichtbare Nutzer-Zustand
       gewinnt gegen einen Zwischen-Render, solange nicht gesichert wurde): bei
       Text ist eine leere Zeichenkette ZWEIDEUTIG — sie kann "noch nichts
       getippt" bedeuten oder "bewusst geloescht, aber noch nicht bestaetigt";
       genau diese Zweideutigkeit ist der Grund, weshalb Leere dort NICHT
       automatisch gewinnt. Eine Checkbox kennt diese Zweideutigkeit nicht: sie
       hat exakt zwei Zustaende, und jeder von beiden ist immer eine bewusste,
       beobachtbare Antwort — "nicht angehakt" ist so wenig ein "noch nichts
       eingegeben" wie "angehakt" eines waere. Deshalb darf hier jede Abweichung
       gewinnen, ohne dass ein Neuaufbau mitten in einem Klick etwas verewigt,
       das die Person nicht so wollte.

       Fremd-Kurs-Schutz (Fix-Runde 1, Review-Finding 1): stimmen kursId/schrittId
       des Snapshots nicht mehr mit state.position ueberein, wird NICHTS
       eingesetzt — der Snapshot stammt von einer anderen Ansicht (z. B. Kurs A),
       die Formularfelder gehoeren aber schon zu einer anderen (Kurs B). Sonst
       wuerde ein spaet eintreffendes Nachladen aus Kurs A seine alten Werte in
       das Formular von Kurs B schreiben. */
    _formularWiederherstellen: function (snap) {
      if (!snap || typeof document === 'undefined') return;
      var pKursId = state.position.kursId || null;
      var pSchrittId = state.position.schrittId != null ? String(state.position.schrittId) : null;
      if (snap.kursId !== pKursId || snap.schrittId !== pSchrittId) return;
      var feldGeaendert = false;
      Array.prototype.forEach.call(document.querySelectorAll('#briefing-felder [data-feld]'), function (el) {
        var alt = snap.werte['feld:' + el.dataset.feld];
        if (el.type === 'checkbox') {
          var neuC = !!el.checked;
          if (typeof alt === 'boolean' && alt !== neuC) { el.checked = alt; feldGeaendert = true; }
          return;
        }
        var neu = String(el.value == null ? '' : el.value);
        if (alt && alt !== neu) { el.value = alt; feldGeaendert = true; }
      });
      QUELLEN_FORMULAR_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var alt = snap.werte['id:' + id];
        var neu = String(el.value == null ? '' : el.value);
        if (alt && alt !== neu) el.value = alt;
      });
      /* content-modus-Radios (M-2, Fix-Runde Final): checked folgt derselben
         Beide-Richtungen-Regel wie eine Checkbox (s. _formularSnapshot); disabled
         ebenso, sonst hoebe ein Zwischen-Render die Schreibsperre waehrend eines
         laufenden contentModus()-Schreibvorgangs wieder auf. Absichtlich NICHT
         auf feldGeaendert/briefingFelderZaehlen gemappt — das zaehlt Briefing-
         Pflichtfelder, mit denen ein Radio nichts zu tun hat. */
      Array.prototype.forEach.call(document.querySelectorAll('[name="content-modus"]'), function (r) {
        var alt = snap.werte['radio:content-modus:' + r.value];
        if (!alt) return;
        if (alt.checked !== !!r.checked) r.checked = alt.checked;
        if (alt.disabled !== !!r.disabled) r.disabled = alt.disabled;
      });
      /* Gate-Box-Felder (Fix-Runde 1): dieselbe Regel wie bei Text
         ("abweichend UND nicht leer gewinnt") — bewusst auch fuer die zwei
         Selects der Box (offen-fuer, offen-ziel-N). Ein Select wird hier NICHT
         gesondert behandelt (anders als Checkbox/Radio mit ihrer
         Beide-Richtungen-Regel): er hat schlicht nie den leeren Zustand, weil
         er immer eine echte Option aus dossier.ZIELE traegt — die
         "nicht leer"-Bedingung ist fuer ihn also nie der einschraenkende Teil,
         nur die Abweichung selbst zaehlt praktisch. Dieselbe Code-Zeile deckt
         damit Text- und Select-Felder gleich ab, ohne eine Typ-Fallunterscheidung
         einzufuehren, die es fuer Selects gar nicht braucht.

         data-was-Wächter (Fix-Runde 2, Review-Finding "Restore verfaelscht Daten
         nach Listenverschiebung"): Positions-ids (offen-wer-N usw.) sind NACH
         splice() auf offen[] nicht stabil — entscheidet/verschiebt man einen
         nicht-letzten Eintrag, ruecken alle folgenden Eintraege eine Position
         nach und tragen danach dieselbe id wie zuvor ein ANDERER Eintrag. Ohne
         diesen Waechter wuerde ein hier gesicherter Wert (z. B. das getippte
         "wer" fuer Punkt A) dem an derselben id frisch gerenderten, aber
         INHALTLICH ANDEREN Punkt B untergeschoben — Datenverfaelschung im
         Audit-Trail, kein blosser Datenverlust. Deshalb: ist das Feld an einen
         Eintrag gebunden (gate-was-Schluessel vorhanden, s. _formularSnapshot),
         wird nur restauriert, wenn das JETZT an dieser id gerenderte Feld noch
         dasselbe data-was traegt wie beim Snapshot — weicht es ab, gilt der
         Eintrag als verschoben/ersetzt, und der gesicherte Wert wird verworfen
         (derselbe sichere Fehlschlag wie vor Fix-Runde 1, nur gezielt auf den
         betroffenen Eintrag begrenzt). Die Erfassungsfelder (offen-was/-wo/-fuer)
         kennen keinen gate-was-Schluessel und sind von dieser Pruefung unberuehrt. */
      Array.prototype.forEach.call(document.querySelectorAll('[data-gate-feld]'), function (el) {
        if (!el.id) return;
        var altWas = snap.werte['gate-was:' + el.id];
        if (altWas !== undefined) {
          var neuWas = (el.dataset && el.dataset.was !== undefined) ? el.dataset.was : undefined;
          if (altWas !== neuWas) return;
        }
        var alt = snap.werte['gate:' + el.id];
        var neu = String(el.value == null ? '' : el.value);
        if (alt && alt !== neu) el.value = alt;
      });
      /* gate-version-Radios (Z9): dieselbe Beide-Richtungen-Regel wie content-modus
         (s. _formularSnapshot) — eine manuell gewaehlte, nicht-hoechste Fassung
         darf ein Zwischen-Render nicht stillschweigend auf die hoechste zuruecksetzen. */
      Array.prototype.forEach.call(document.querySelectorAll('[name="gate-version"]'), function (r) {
        var alt = snap.werte['radio:gate-version:' + r.value];
        if (!alt) return;
        if (alt.checked !== !!r.checked) r.checked = alt.checked;
      });
      /* Ohne das steht nach der Wiederherstellung weiter "8 offen" fuer ein
         Feld, das gerade wieder befuellt wurde (wie beim Tippen, s. briefingFelderZaehlen). */
      if (feldGeaendert) controller.briefingFelderZaehlen();
      if (snap.fokusId) {
        var f = document.getElementById(snap.fokusId);
        if (f && typeof f.focus === 'function') {
          f.focus();
          if (typeof f.setSelectionRange === 'function') {
            var len = String(f.value == null ? '' : f.value).length;
            /* type="number" (Praesenz/Selbstlern) unterstuetzt keine Selektion —
               der Browser wirft dort eine InvalidStateError, kein Bedienfehler. */
            try { f.setSelectionRange(len, len); } catch (e) { /* keine Selektion moeglich */ }
          }
        }
      }
    },

    render: function () {
      var snap = controller._formularSnapshot();
      controller._renderAufbau();
      controller._formularWiederherstellen(snap);
    },

    /* Der eigentliche Aufbau — ausgelagert, damit render() aussenherum sichern und
       wiederherstellen kann (Audit C2, Etappe 1e Task 2), ohne dass sich an den
       Bedingungen hier unten etwas aendert. */
    _renderAufbau: function () {
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
      if (!inh) { controller.setz('<p class="lead">Inhalte werden geladen &hellip;</p>'); return; }

      if (p.bereich === 'nachschlagen') {
        /* meldung wird NICHT hier oben berechnet (Fix-Runde 1, Review-Finding 1):
           vorher wurden state.hinweis/state.fehlerHinweis VOR dieser Weiche
           konsumiert (auf null gesetzt), auch wenn die Ansicht "nachschlagen"
           sie gar nicht rendert — die Meldung war dann endgueltig verschluckt,
           statt wenigstens beim naechsten Wechsel zurueck in eine Arbeiten-
           Ansicht zu erscheinen. Jetzt bleibt sie in Nachschlagen unangetastet
           im State stehen, bis eine Ansicht sie tatsaechlich zeigt. */
        controller.setz(root.ansichten.nachschlagen(inh, p.werk));
        return;
      }

      /* EINE Stelle fuer beide Meldungsarten, erst NACH der Nachschlagen-Weiche
         berechnet und in ALLEN Arbeiten-Ansichten vorangestellt (Kursliste,
         Kursansicht, Schritt) — zuvor stand der Block nur im Schritt-Zweig, ein
         Hinweis aus der Kursliste oder Kursansicht heraus (z. B. dossierNachladen
         von dort) verschwand stumm (I2, Etappe 1e Task 4). Nachschlagen bleibt
         bewusst ohne, dort gibt es keine schreibenden Aktionen, die eine Meldung
         ausloesen koennten — s. Kommentar oben, warum die Berechnung dafuer
         extra hinter diese Weiche gezogen wurde.
         Zwei getrennte Felder statt einem (M3): state.hinweis ist Erfolg (gruen,
         Haekchen), state.fehlerHinweis eine fehlgeschlagene Aktion (rot, bestehende
         .klemmt-Optik wie beim Ablage-Fehler) — vorher trugen auch Fehlermeldungen
         (z. B. "Dossier konnte nicht gelesen werden") das gruene Haekchen von
         state.hinweis, als waeren sie ein Erfolg. */
      var meldung = '';
      if (state.hinweis) {
        meldung += '<div class="hinweis"><b>&#10003;</b>' + esc(state.hinweis) + '</div>';
        state.hinweis = null;
      }
      if (state.fehlerHinweis) {
        meldung += '<div class="klemmt">' + esc(state.fehlerHinweis) + '</div>';
        state.fehlerHinweis = null;
      }

      if (p.schrittId) {
        var k = nav.kurs();
        var ab = root.inhalt.ablageVon(inh, p.schrittId, k ? k.kursId : '');
        var ordn = k ? state.data.ordner[k.kursId] : null;
        var schl = k && ab ? k.kursId + '/' + ab.ordner : null;
        controller.setz(meldung + root.ansichten.einSchritt(inh, k, p.schrittId, p.werkzeugId, {
          basisUrl: ordn ? ordn.webUrl : null,
          dateien: schl ? state.data.dateien[schl] : null,
          /* undefined = noch nicht nachgesehen, null = nachgesehen und nicht da */
          ordnerFehlt: k ? state.data.ordner[k.kursId] === null : false,
          briefing: k ? state.data.briefing[k.kursId] : undefined,
          /* Scope UND regulatorik zusammengefuehrt (Etappe 1e, Task 6) — eine
             Stelle, dieselbe, die dossier.ausWerten beim Schreiben nutzt. */
          briefingFelder: k ? root.inhalt.briefingWerteAusDossier(state.data.dossier[k.kursId]) : {},
          briefingFelderGelesen: k ? (state.data.dossier[k.kursId] != null) : false,
          dossier: k ? (state.data.dossier[k.kursId] || null) : null,
          /* Der echte Ordnername, sobald nachgesehen wurde — er geht in die
             Projekt-Instruktionen ein und darf dort kein Platzhalter sein. */
          ordnerName: (k && state.data.ordner[k.kursId]) ? state.data.ordner[k.kursId].name : null,
          variante: p.variante,
          weg: p.weg,
          /* F3, Fix-Runde 1: der Lauf-Merker fuer GENAU diesen Kurs+Schritt —
             s. state.gateLaeuft oben. */
          gateLaeuft: k ? !!state.gateLaeuft[k.kursId + '/' + p.schrittId] : false,
          /* B9-F1: nur durchreichen, wenn der Positions-Stempel noch zu Kurs UND
             Schritt passt (Fremd-Kurs-Schutz, Muster _formularSnapshot) — sonst
             stammt die Auswahl von einer anderen Ansicht und gehoert hier nicht hin. */
          dateiAuswahl: (k && state.data.dateiAuswahl &&
            state.data.dateiAuswahl.kursId === k.kursId &&
            state.data.dateiAuswahl.schrittId === String(p.schrittId))
            ? state.data.dateiAuswahl.dateien
            : null,
          /* B9-F3: kein eigener Stempel noetig — state.data.uploadMeldung wird
             bereits bei jedem Kurs-/Schrittwechsel in controller.zu() geloescht
             (dasselbe kursVorher/schrittVorher-Muster wie dateiAuswahl). */
          uploadMeldung: state.data.uploadMeldung || null
        }));
        if (k && ab) controller.ordnerNachladen(k.kursId, ab.ordner);
        /* A3, Etappe 3: Schritt 3 erbt den GESETZTEN Contract-Stand (Version,
           basiert_auf) aus Schritt 2 — dafuer muss der Schritt-2-Ordner-Cache
           ebenfalls geladen sein, nicht nur der eigene (03_content). Ordner
           kommt aus ablageVon('2', ...), nichts hartkodiert (dasselbe Muster
           wie der Kaltstart-Kasten in ansichten.js). */
        if (k && String(p.schrittId) === '3') {
          var ab2Nachladen = root.inhalt.ablageVon(inh, '2', k.kursId);
          if (ab2Nachladen) controller.ordnerNachladen(k.kursId, ab2Nachladen.ordner);
        }
        /* Auf Schritt 1 stehen die Projekt-Instruktionen, und die tragen das
           Briefing. Es wurde aber nur auf Schritt 2 geladen — deshalb stand dort
           IMMER "[FEHLT]", auch wenn 01_briefing/ eine freigegebene Fassung hielt.
           Genau das hat am 2026-07-29 bei VL-001 Schritt 2 blockiert: die
           Instruktionen wurden mit der Fehlt-Marke ins KI-Projekt kopiert. */
        if (k && (String(p.schrittId) === '1' || String(p.schrittId) === '2') &&
            state.data.ordner[k.kursId]) {
          controller.briefingNachladen(k.kursId);
        }
        /* Schritt 1 erfasst die Quellen, Schritt 3 zeigt das Quellenverzeichnis
           nur lesend — wer nur Schritt 3 ansieht, ohne vorher auf Schritt 1
           gewesen zu sein, muesste sonst auf ein leeres state.data.dossier
           starren (dieselbe Lehre wie beim Briefing-Nachladen oben: wenn eine
           Ansicht Daten zeigt, muss der Ladevorgang an derselben Ansicht haengen).
           Schritt 2 (Etappe 2, Task 3) braucht das Dossier ebenso: der
           Kein-freigegebenes-Briefing-Kasten prueft status.briefing, und der
           kopieren-Handler stellt lernzielePromptKopf voran — beides ohne
           geladenes Dossier unmoeglich. */
        if (k && (String(p.schrittId) === '1' || String(p.schrittId) === '2' || String(p.schrittId) === '3') &&
            state.data.ordner[k.kursId]) {
          controller.dossierNachladen(k.kursId);
        }
      } else if (p.kursId) {
        var kk = nav.kurs();
        controller.setz(meldung + root.ansichten.einKurs(inh, kk, {
          ordnerFehlt: kk ? state.data.ordner[kk.kursId] === null : false,
          dossier: kk ? (state.data.dossier[kk.kursId] || null) : null
        }));
        if (kk) controller.ordnerPruefen(kk.kursId);
        /* Auch die Kursansicht zeigt jetzt das Quellenverzeichnis (Etappe 1b) —
           ohne eigenes Nachladen bliebe es dort dauerhaft leer, selbst wenn
           Schritt 1 laengst ein Dossier abgelegt hat. */
        if (kk && state.data.ordner[kk.kursId]) controller.dossierNachladen(kk.kursId);
      } else {
        controller.setz(meldung + root.ansichten.alleKurse(state.data.kurse));
      }
    },

    /* Nur nachsehen, ob der Kursordner ueberhaupt existiert — fuer die Kursansicht,
       die keinen Ordnerinhalt braucht. Ergebnis landet in state.data.ordner. */
    ordnerPruefen: function (kursId) {
      if (state.data.ordner[kursId] !== undefined) return;
      graph.kursOrdner(kursId)
        .then(function () {
          if (state.position.kursId === kursId && !state.position.schrittId) controller.render();
        })
        .catch(function () {});
    },

    /* Das freigegebene Briefing aus Schritt 1 lesen — es geht in die
       Projekt-Instruktionen von Schritt 2 ein. undefined = noch nicht nachgesehen,
       null = wird gerade nachgesehen (verhindert Doppelabruf, waehrend der Aufruf
       laeuft) — leerer String = nachgesehen und nichts gefunden (I4, Etappe 1e
       Task 4: null und '' duerfen die Instruktionsflaeche nicht gleich anzeigen,
       sonst zeigt sie nach einem echten "nichts gefunden" fuer immer "wird
       gelesen" statt des Hinweises auf das fehlende Briefing). */
    briefingNachladen: function (kursId) {
      if (state.data.briefing[kursId] !== undefined) return;
      var e = ((state.data.inhalt['ablage-kontrakt'] || {}).schritte || {})['1'] || {};
      var ordner = e.ordner || '01_briefing';
      state.data.briefing[kursId] = null;              /* verhindert Doppelabruf */
      graph.ordnerInhalt(kursId, ordner)
        .then(function (dateien) {
          var name = root.inhalt.geltendeDatei(dateien, kursId, e.lieferobjekt || 'briefing');
          if (!name) return '';
          return graph.dateiLesen(kursId, ordner, name);
        })
        .then(function (text) {
          /* graph.dateiLesen liefert null sowohl bei 404 als auch bei jedem
             stillen Lesefehler (bewusst laxer als dateiLesenGenau, s. dessen
             Kommentar) — das kann hier nur eintreten, wenn geltendeDatei bereits
             einen Namen gefunden hatte (sonst waere text oben schon '' gewesen).
             Also KEIN "nichts gefunden", sondern ein echter Fehler: dieselbe
             Behandlung wie im aeusseren .catch (Fix-Runde 1, Review-Finding 3) —
             sichtbare Fehlermeldung, danach (nach dem Rendern) Reset auf
             undefined, damit kein sticky null/[FEHLT] entsteht und der naechste
             Ansichtswechsel es erneut versucht. graph.dateiLesen selbst bleibt
             unangetastet — andere Aufrufer verlassen sich auf sein Verhalten. */
          if (text === null) {
            state.fehlerHinweis = 'Briefing konnte nicht gelesen werden — Seite neu laden.';
            var pFehler = String(state.position.schrittId);
            if (state.position.kursId === kursId && (pFehler === '1' || pFehler === '2')) {
              controller.render();
            }
            state.data.briefing[kursId] = undefined;
            return;
          }
          state.data.briefing[kursId] = text;
          var p = String(state.position.schrittId);
          if (state.position.kursId === kursId && (p === '1' || p === '2')) {
            controller.render();
          }
        })
        .catch(function () {
          /* Sticky null waere hier derselbe Fehler wie beim Dossier (I1/I4): ohne
             Reset zeigt die Instruktionsflaeche dauerhaft "wird gelesen", und ein
             erneuter Versuch (naechster Ansichtswechsel) waere unmoeglich. Bisher
             stand hier gar nichts — ein Netzfehler blieb komplett unsichtbar.
             Reset ERST nach dem Rendern (wie bei dossierNachladen): waehrend
             controller.render() laeuft, blockiert der noch stehende null-Wert
             einen sofortigen Selbst-Retry aus demselben Render-Aufruf. */
          state.fehlerHinweis = 'Briefing konnte nicht gelesen werden — Seite neu laden.';
          var p = String(state.position.schrittId);
          if (state.position.kursId === kursId && (p === '1' || p === '2')) {
            controller.render();
          }
          state.data.briefing[kursId] = undefined;
        });
    },

    /* Das Dossier aus dem Kursordner. Drei Faelle, ueber dateiLesenGenau
       unterschieden (I-1, Final-Review):
       - fehlt (404 oder kein Kursordner): EINMAL aus der Altdatei
         {K}_briefing-felder.md importieren — geschrieben wird der Import erst
         beim naechsten Sichern, nicht still beim Lesen.
       - jeder andere Lesefehler: waehrend des Aufrufs bleibt state kurz null (der
         Doppelabruf-Schutz), sichtbare Fehlermeldung; NACH dem Rendern wird auf
         undefined zurueckgesetzt (I1, Etappe 1e Task 4) — sonst bliebe der Fehler
         sticky und kein spaeterer Ansichtswechsel wuerde je wieder nachladen. Ein
         Import-Fallback hier wuerde ein echtes Dossier unbemerkt ersetzen, sobald
         spaeter gesichert wird — der Guard in dossierSpeichern greift nur, solange
         state.data.dossier[kursId] undefined oder null ist.
       - Datei da, aber unlesbar (dossier.lesen() liefert null): ebenso KEIN Ersatz —
         dossier.js schliesst ein stilles Reparieren ausdruecklich aus. Auch hier
         wird nach dem Rendern auf undefined zurueckgesetzt. */
    dossierNachladen: function (kursId) {
      if (state.data.dossier[kursId] !== undefined) return;
      state.data.dossier[kursId] = null;
      return graph.dateiLesenGenau(kursId, '', root.dossier.DATEI(kursId))
        .then(function (r) {
          if (r.ok) {
            var d = root.dossier.lesen(r.text);
            if (d) {
              state.data.dossier[kursId] = d;
              state.data.dossierETag[kursId] = r.eTag;
              controller.render();
              return;
            }
            state.fehlerHinweis = 'Dossier unlesbar — wird nicht überschrieben.';
            controller.render();
            /* Erst NACH dem Rendern zuruecksetzen (I1): waehrend controller.render()
               laeuft, blockiert der noch stehende null-Wert einen sofortigen
               Selbst-Retry aus demselben Render-Aufruf (z. B. wenn diese Ansicht
               dossierNachladen erneut anstoesst) — erst der naechste, unabhaengige
               Ansichtswechsel soll es erneut versuchen. */
            state.data.dossier[kursId] = undefined;
            return;
          }
          if (!r.fehlt) {
            state.fehlerHinweis = 'Dossier konnte nicht gelesen werden — Seite neu laden.';
            controller.render();
            state.data.dossier[kursId] = undefined;
            return;
          }
          var e = ((state.data.inhalt['ablage-kontrakt'] || {}).schritte || {})['1'] || {};
          var ordner = e.ordner || '01_briefing';
          return graph.dateiLesen(kursId, ordner, kursId + '_briefing-felder.md')
            .then(function (alt) {
              var werte = alt ? root.inhalt.briefingFelderLesen(alt) : {};
              state.data.dossier[kursId] = root.dossier.ausWerten(kursId, werte, null, null, root.inhalt.BRIEFING_FELDER);
              controller.render();
            });
        })
        .catch(function () {
          state.fehlerHinweis = 'Dossier konnte nicht gelesen werden — Seite neu laden.';
          controller.render();
          state.data.dossier[kursId] = undefined;
        });
    },

    /* Was gerade in den Feldern steht — aus dem Formular, nicht aus dem Zustand.
       Der Zustand hinkt dem Tippen hinterher; beim Kopieren und beim Sichern zaehlt,
       was die Person sieht. */
    briefingFelderAusFormular: function () {
      var werte = {};
      if (typeof document === 'undefined') return werte;
      Array.prototype.forEach.call(document.querySelectorAll('[data-feld]'), function (el) {
        /* Ein Haekchen (form:'haken', Etappe 1e Task 6) traegt seine Antwort in
           .checked, nicht in .value — ein natives Checkbox-Element liefert dort
           unabhaengig vom Anhaken immer denselben Wert ("on" o. ae.). */
        werte[el.dataset.feld] = (el.type === 'checkbox') ? !!el.checked : String(el.value || '').trim();
      });
      return werte;
    },

    /* Merge fuer den "kopieren"-Handler (Prompt-Kopf-Basis, Schritt 1): basis ist
       der gesicherte Dossier-Stand (scope+regulatorik, ueber briefingWerteAusDossier),
       form die aktuell sichtbaren, evtl. ungesicherten Formularwerte — form gewinnt.
       Ausgelagert (Fix-Runde 1, C-1), damit die Merge-Regel ohne DOM/click-Mock
       direkt testbar ist, wie briefingFelderAusFormular/_formularSnapshot auch.

       Typbewusst: ein Bool (das SAQ-Haekchen) uebernimmt IMMER den Formularwert,
       auch false — false ist eine vollstaendige Antwort, kein Fehlen, anders als
       ein leerer String. Vorher liess `String(form[k] || '')` ein explizites
       false schon am `|| ''` scheitern (false ist falsy, wird durch '' ersetzt,
       bleibt '' nach trim()) — der Prompt behauptete dann weiter den alten, aus
       der Basis kopierten Wert (z. B. true), obwohl das Formular sichtbar
       abgehakt war. */
    _formularWerteMergen: function (basis, form) {
      var werte = {};
      Object.keys(basis || {}).forEach(function (k) { werte[k] = basis[k]; });
      Object.keys(form || {}).forEach(function (k) {
        var v = form[k];
        if (typeof v === 'boolean' || String(v || '').trim()) werte[k] = v;
      });
      return werte;
    },

    /* Die Zaehlung mitlaufen lassen, waehrend getippt wird. Ohne das steht nach dem
       Ausfuellen weiter "8 offen", bis gesichert wurde — und das Formular wirkt
       falsch, obwohl es stimmt. Kein Neuaufbau der Ansicht: der wuerde den Fokus
       aus dem Feld nehmen, in dem gerade geschrieben wird. */
    briefingFelderZaehlen: function () {
      if (typeof document === 'undefined') return;
      var ziel = document.querySelector('#briefing-felder .offen-zahl');
      if (!ziel) return;
      var werte = controller.briefingFelderAusFormular();
      var fehlend = root.inhalt.briefingFehlend(werte);
      ziel.textContent = fehlend.length
        ? fehlend.length + ' offen: ' + fehlend.join(', ')
        : '✓ vollständig — der Chat muss nichts mehr abfragen';
      ziel.classList.toggle('gut', fehlend.length === 0);
      Array.prototype.forEach.call(document.querySelectorAll('#briefing-felder [data-feld]'), function (el) {
        var f = root.inhalt.briefingFeld(el.dataset.feld);
        /* Dieselbe Frage wie in inhalt.briefingFehlend() und ansichten.js
           (Etappe 1e Task 6, Fix-Runde 1 M-1, Konvention 9): ein Haekchen kennt
           kein "leer" — nicht angehakt ist eine vollstaendige Antwort, keine
           fehlende. Drei Stellen pruefen dieselbe Tatsache, weil sie an drei
           verschiedenen Werten haengen (Formularwerte-Objekt, gerendertes HTML,
           lebendiges DOM-Element) — keine davon kann die anderen ersetzen; die
           Antwort selbst (form:'haken' zaehlt nie als offen) ist ueberall gleich. */
        var leer = f && f.form !== 'haken' && !String(el.value || '').trim();
        if (el.parentNode) el.parentNode.classList.toggle('offen', !!(f && f.pflicht && leer));
      });
    },

    /* Warteschlange je Kurs — eine Promise-Kette pro kursId (Etappe 1e, Task 1,
       Audit C1/I5/I8). Vier Schreibstellen (dossierSpeichern, quelleErfassen,
       quelleEntfernen, contentModus) plus der Schritt-1-Zweig von ablegen riefen
       bisher alle unkoordiniert graph.ablegen — zwei ueberlappende Sicherungen
       konnten sich gegenseitig ueberschreiben (Lost Update). Nicht Teil des
       exportierten Zustands: die Warteschlange ist Ablaufsteuerung, kein Datum. */
    _dossierQueue: {},

    /* Liest das Dossier nach einem 412 frisch von Graph und merkt Stand und eTag —
       kein Import-Fallback hier: ein 412 beweist, dass die Datei existiert, ein
       Import waere hier immer falsch. Ist die frische Datei nicht lesbar, bricht
       der Aufrufer ab statt ein kaputtes Dossier stillschweigend zu uebernehmen. */
    _dossierNeuLesen: function (kursId) {
      return graph.dateiLesenGenau(kursId, '', root.dossier.DATEI(kursId)).then(function (r) {
        if (!r.ok) throw new Error('Dossier nach Konflikt nicht lesbar — Seite neu laden.');
        var d = root.dossier.lesen(r.text);
        if (!d) throw new Error('Dossier nach Konflikt unlesbar — Seite neu laden.');
        state.data.dossier[kursId] = d;
        state.data.dossierETag[kursId] = r.eTag;
        return d;
      });
    },

    /* Ein einzelner Schreibversuch: frische Kopie des JETZIGEN State-Dossiers (nicht
       die vom Klickzeitpunkt!), Mutator anwenden, mit If-Match schreiben. null vom
       Mutator heisst Abbruch — kein PUT, State unveraendert. 412 heisst: jemand
       anderes hat inzwischen geschrieben — einmal frisch lesen und den Mutator ein
       zweites Mal anwenden (nicht endlos, sonst koennte ein staendig schreibender
       Zweitnutzer diesen Aufruf nie durchlassen).

       Erstanlage-Schutz (Etappe 2, Task 7): fehlt ein eTag (Datei nie geladen oder
       noch gar nicht angelegt), gibt es nichts, wogegen If-Match pruefen koennte —
       ohne Gegenmassnahme koennten zwei Sitzungen gleichzeitig zum ERSTEN Mal ein
       Dossier fuer denselben Kurs anlegen und sich gegenseitig ueberschreiben
       (CLAUDE.md „Offen": die Restluecke ausserhalb des behobenen Lost-Update).
       eTagAlt fehlt genau dann, wenn nurNeu true sein muss — graph.ablegen haengt
       dann conflictBehavior=fail an, Graph antwortet mit 409, wenn die Datei
       zwischen Pruefen und Schreiben von woanders angelegt wurde. Die Wiederholung
       laeuft ueber denselben Mechanismus wie 412: einmal frisch lesen (holt den
       eTag der fremden Erstanlage), Mutator einmal erneut anwenden. */
    _dossierVersuch: function (kursId, mutator, melde, nochmalErlaubt) {
      var kopie = JSON.parse(JSON.stringify(state.data.dossier[kursId] || root.dossier.neu(kursId)));
      var neu;
      try { neu = mutator(kopie); } catch (e) { return Promise.reject(e); }
      if (neu === null || neu === undefined) return Promise.resolve(null);

      /* identitaet zentral stempeln (Etappe 2, Task 3): Titel/Kompetenzfeld
         kommen aus KWKurse, nie aus einem Formularfeld — jede Schreibstelle
         soll das nicht selbst wissen muessen, deshalb hier an der einzigen
         Stelle, durch die JEDES Dossier-Schreiben laeuft. */
      var kursObj = (state.data.kurse || []).filter(function (x) { return x.kursId === kursId; })[0];
      root.dossier.identitaetSetzen(neu, kursObj);

      /* scope_quelle zentral stempeln (Z4, Zusatzauftrag 2026-07-30 Punkt 6,
         Entscheid Markus: "Jede hinterlegte Quelle ist Scope."). Dasselbe
         Muster wie identitaetSetzen direkt darueber: EINE Stelle, durch die
         JEDES Dossier-Schreiben laeuft, statt eine Ableitung an jeder
         Schreibstelle (dossierSpeichern, quelleErfassen, quelleEntfernen,
         contentModus, gateKlick, Schritt-1-Zweig von ablegen) selbst zu
         wissen. Ruft dieselbe abgeleitet()-Funktion auf, die ansichten.js fuer
         die Anzeige nutzt (inhalt.briefingFeld('scope_quelle').abgeleitet) —
         Konvention 9, eine Quelle pro Begriff — und ueberschreibt dabei einen
         etwaigen Handwert aus einem Alt-Dossier (VL-001) oder dem
         Einmal-Import (dossierNachladen): Live-Beweis der Fehlerklasse an
         VL-002, wo ein getippter Bereich ("Q-001 bis Q-014") still veraltete,
         als Q-015 dazukam. */
      var scopeQuelleFeld = root.inhalt.briefingFeld('scope_quelle');
      if (scopeQuelleFeld && scopeQuelleFeld.abgeleitet) {
        neu.scope = neu.scope || {};
        neu.scope.scope_quelle = scopeQuelleFeld.abgeleitet(neu);
      }

      var eTagAlt = state.data.dossierETag[kursId];
      return graph.ablegen(kursId, '', root.dossier.DATEI(kursId), root.dossier.text(neu), eTagAlt, !eTagAlt)
        .then(function (antwort) {
          state.data.dossier[kursId] = neu;
          state.data.dossierETag[kursId] = antwort && antwort.eTag;
          return neu;
        })
        .catch(function (e) {
          if (e && (e.status === 412 || e.status === 409) && nochmalErlaubt) {
            if (melde) melde('Zwischenzeitlich geändert — wird neu gelesen …');
            return controller._dossierNeuLesen(kursId).then(function () {
              return controller._dossierVersuch(kursId, mutator, melde, false);
            });
          }
          if (melde) melde(String((e && e.message) || e));
          throw e;
        });
    },

    /* controller.dossierSchreiben(kursId, mutator, melde?) — die einzige Stelle, die
       das Dossier schreiben darf. Aufrufe je Kurs laufen strikt nacheinander: ein
       neuer Aufruf haengt sich an die laufende Kette, egal ob deren Vorgaenger
       gescheitert ist (sonst wuerde ein Fehler die Warteschlange fuer immer
       blockieren). Guards (Dossier nicht geladen, Kursordner fehlt, Bestaetigung)
       gehoeren VOR diesen Aufruf, beim jeweiligen Aufrufer — eine abgebrochene
       Aktion darf die Warteschlange nie belegen. */
    dossierSchreiben: function (kursId, mutator, melde) {
      var vorher = (controller._dossierQueue[kursId] || Promise.resolve()).then(function () {}, function () {});
      var eigenes = vorher.then(function () {
        return controller._dossierVersuch(kursId, mutator, melde, true);
      });
      controller._dossierQueue[kursId] = eigenes;
      return eigenes;
    },

    dossierSpeichern: function (knopf) {
      var kursId = state.position.kursId;
      if (!kursId) return;
      var melde = typeof document !== 'undefined' && document.getElementById('briefing-felder-melde');
      /* Fehlt der Kursordner, laeuft dossierNachladen nie an (siehe render()) — ohne
         diese Unterscheidung meldete der Guard unten dauerhaft "wird noch geladen",
         obwohl gar nichts laedt (M-3, Final-Review). */
      if (state.data.ordner[kursId] === null) {
        if (melde) { melde.hidden = false; melde.textContent = 'Kein Kursordner — zuerst in Schritt 1 die Ablage anlegen.'; }
        return;
      }
      /* Ohne geladenes Dossier faellt ausWerten auf dossier.neu() zurueck — ein
         bereits abgelegtes Dossier wuerde seine quellen/status/offen/entschieden
         verlieren. undefined = noch nicht angefordert, null = laedt noch. */
      if (state.data.dossier[kursId] === undefined || state.data.dossier[kursId] === null) {
        if (melde) { melde.hidden = false; melde.textContent = 'Dossier wird noch geladen — gleich nochmals versuchen.'; }
        return;
      }
      var werte = controller.briefingFelderAusFormular();
      var stand = new Date().toISOString();
      if (knopf) knopf.disabled = true;
      if (melde) { melde.hidden = false; melde.textContent = 'Wird gesichert …'; }

      /* Der Mutator bekommt die Kopie zum AUSFUEHRUNGSZEITPUNKT der Warteschlange,
         nicht die von hier (Etappe 1e, Task 1) — sonst kaeme das Lost-Update-Risiko
         durch die Hintertuer zurueck. */
      return controller.dossierSchreiben(kursId, function (kopie) {
        return root.dossier.ausWerten(kursId, werte, kopie, stand, root.inhalt.BRIEFING_FELDER);
      }, function (t) { if (melde) melde.textContent = t; })
        .then(function () {
          state.hinweis = 'Dossier gesichert: ' + root.dossier.DATEI(kursId);
          controller.render();
        })
        .catch(function (e) {
          var text = String(e.message || e);
          if (melde) melde.textContent = text;
          /* state.fehlerHinweis zusaetzlich zu melde.textContent (I-NEU-1,
             Fix-Runde Final, Muster quelleErfassen-I10-Fix): melde haengt am
             beim Klick eingefangenen #briefing-felder-melde-Knoten — haengt ein
             Zwischen-Render ihn aus, bevor das Schreiben scheitert, erreicht die
             Fehlermeldung niemanden mehr. state.fehlerHinweis lebt im State,
             nicht im DOM-Knoten, und wird von controller.render() ueber den
             globalen Meldungsblock gezeigt (I2/M3). */
          state.fehlerHinweis = text;
          controller.render();
          if (knopf) knopf.disabled = false;
        });
    },

    /* Datei ablegen und Dossier-Eintrag sind EIN Vorgang (Spec §5.6) — beides
       nacheinander, damit nie eine Datei ohne Dossier-Eintrag herumliegt oder
       umgekehrt. Guard wie dossierSpeichern: undefined/null heisst nicht bereit.
       Eine Quelle ist Datei ODER Link (Entscheid Markus, 2026-07-30): bei einem
       Link gibt es kein Hochladen, nur die Dossier-Ablage; new Date() steht nur
       hier — dossier.js bleibt ohne Date, das Abrufdatum kommt fertig herein. */
    quelleErfassen: function (knopf) {
      var kursId = state.position.kursId;
      var d0 = state.data.dossier[kursId];
      var melde = typeof document !== 'undefined' && document.getElementById('quelle-melde');
      function sag(t) { if (melde) { melde.hidden = false; melde.textContent = t; } }
      /* Fehlt der Kursordner, laeuft dossierNachladen nie an — "noch nicht geladen"
         waere dauerhaft falsch (M-3, wie bei dossierSpeichern). */
      if (state.data.ordner[kursId] === null) { sag('Kein Kursordner — zuerst in Schritt 1 die Ablage anlegen.'); return; }
      if (!d0) { sag('Dossier noch nicht geladen — kurz warten.'); return; }
      var eingabe = document.getElementById('quelle-datei');
      var datei = eingabe && eingabe.files && eingabe.files[0];
      var urlFeld = document.getElementById('quelle-url');
      var url = urlFeld ? String(urlFeld.value || '').trim() : '';
      if (!datei && !url) { sag('Datei wählen oder Link angeben.'); return; }

      var name = datei ? root.dossier.quellenDateiname(datei.name) : null;
      var werte = {
        titel: (document.getElementById('quelle-titel') || {}).value,
        herausgeber: (document.getElementById('quelle-herausgeber') || {}).value,
        stand: (document.getElementById('quelle-stand') || {}).value
      };
      if (datei) werte.datei = name;
      if (url) { werte.url = url; werte.abgerufen = new Date().toISOString().slice(0, 10); }

      /* Fruehe Probe gegen den zuletzt bekannten Stand — nur fuer eine sofortige
         Fehlermeldung, bevor ueberhaupt hochgeladen wird (eine unvollstaendige
         Quelle darf keinen Upload ausloesen). Die WIRKLICHE Quelle entsteht erst
         im Mutator unten, gegen den Stand ZUR AUSFUEHRUNGSZEIT der Warteschlange —
         sonst kaeme das Lost-Update-Risiko (zwei gleichzeitige quelleErfassen
         vergeben dieselbe Q-Nummer oder verwerfen sich gegenseitig) durch die
         Hintertuer zurueck. */
      try {
        root.dossier.quelleNeu(JSON.parse(JSON.stringify(d0)), werte);
      } catch (e) { sag(String(e.message || e)); return; }

      if (knopf) knopf.disabled = true;
      var nurDatei = datei && !url;
      sag(nurDatei ? 'Wird hochgeladen …' : 'Wird gesichert …');

      var q = null;
      function mutator(kopie) {
        q = root.dossier.quelleNeu(kopie, werte);
        return kopie;
      }

      /* Merkt, ob der Upload schon durch ist, BEVOR der Dossier-Schreibvorgang
         beginnt (I10, Etappe 1e Task 4) — scheitert danach nur noch der
         Dossier-Eintrag, liegt die Datei bereits im Quellen-Ordner, ohne dass
         das Dossier von ihr weiss ("Waise"). Ohne diese Unterscheidung nennt die
         Fehlermeldung nur den Graph-Fehler, nicht die Datei — wer dann blind
         nochmals klickt, weiss nicht, ob ein zweiter Upload gefahrlos ist. Der
         erneute Versuch IST gefahrlos: graph.hochladen legt unter demselben,
         deterministisch bereinigten Namen ab (Ueberschreiben, kein Konflikt). */
      var hochgeladen = false;
      var vorgang = nurDatei
        ? graph.hochladen(kursId, quellenOrdner(), name, datei)
            .then(function () {
              hochgeladen = true;
              return controller.dossierSchreiben(kursId, mutator, sag);
            })
        : controller.dossierSchreiben(kursId, mutator, sag);

      return vorgang
        .then(function () {
          state.hinweis = q.id + ' erfasst: ' + (nurDatei ? name : url);
          controller.render();
        })
        .catch(function (e) {
          if (hochgeladen) {
            /* state.fehlerHinweis statt/zusaetzlich zu sag() (Fix-Runde 1, Review-
               Finding 2): sag() schreibt in den beim Klick eingefangenen
               #quelle-melde-Knoten — haengt ein Zwischen-Render diesen aus (z. B.
               ein spaeter eintreffendes briefingNachladen/dossierNachladen aus
               derselben Ansicht), erreicht die Waisen-Datei-Meldung niemanden
               mehr. state.fehlerHinweis lebt im State, nicht im DOM-Knoten, und
               wird von controller.render() ueber den globalen Meldungsblock
               gezeigt (I2/M3) — deshalb hier explizit rendern, nicht nur sag(). */
            var text = name + ' wurde hochgeladen, aber nicht im Dossier erfasst: ' + (e.message || e) +
              ' — erneutes „Quelle erfassen“ mit derselben Datei ist sicher.';
            sag(text);
            state.fehlerHinweis = text;
            controller.render();
          } else {
            sag(String(e.message || e));
          }
          if (knopf) knopf.disabled = false;
        });
    },

    /* Ersetzbare Indirektion fuer confirm() — der Handler bleibt so in Node
       testbar, ohne dass jeder Aufrufer window.confirm kennen muss. */
    _bestaetige: function (frage) { return confirm(frage); },

    /* Dossier-Eintrag zuerst raus, danach — nur bei einer Datei-Quelle — die
       Datei in den SharePoint-Papierkorb (Entscheid Markus, 2026-07-30).
       Reihenfolge ist bindend: scheitert das Datei-Loeschen NACH erfolgreichem
       Dossier-Schreiben, gilt die Dossier-Entfernung trotzdem — eine verwaiste
       Datei ist harmlos, ein Dossier-Eintrag zu einer geloeschten Datei waere
       es nicht. Guards wie quelleErfassen: Dossier geladen, Kursordner da. */
    quelleEntfernen: function (knopf) {
      var kursId = state.position.kursId;
      var d0 = state.data.dossier[kursId];
      var melde = typeof document !== 'undefined' && document.getElementById('quelle-melde');
      function sag(t) { if (melde) { melde.hidden = false; melde.textContent = t; } }
      if (state.data.ordner[kursId] === null) { sag('Kein Kursordner — zuerst in Schritt 1 die Ablage anlegen.'); return; }
      if (!d0) { sag('Dossier noch nicht geladen — kurz warten.'); return; }

      var id = knopf && knopf.dataset && knopf.dataset.quelle;
      if (!controller._bestaetige('Quelle ' + id + ' wirklich entfernen?')) return;

      /* Fruehe Probe gegen den zuletzt bekannten Stand — nur fuer die sofortige
         "nicht gefunden"-Meldung. Die wirkliche Entfernung passiert im Mutator,
         gegen den Stand ZUR AUSFUEHRUNGSZEIT der Warteschlange (kein Lost Update). */
      if (!(d0.quellen || []).some(function (q) { return q.id === id; })) {
        sag('Quelle nicht gefunden.'); return;
      }

      if (knopf) knopf.disabled = true;
      sag('Wird entfernt …');

      var eintrag = null;
      function mutator(kopie) {
        eintrag = root.dossier.quelleEntfernen(kopie, id);
        if (!eintrag) throw new Error('Quelle nicht gefunden.');
        return kopie;
      }

      return controller.dossierSchreiben(kursId, mutator, sag)
        .then(function () {
          if (!eintrag.datei) {
            state.hinweis = id + ' entfernt.';
            controller.render();
            return;
          }
          var ordner = quellenOrdner();
          return graph.dateiLoeschen(kursId, ordner, eintrag.datei)
            .then(function () {
              state.hinweis = id + ' entfernt.';
              controller.render();
            })
            .catch(function () {
              sag('Eintrag entfernt; Datei liegt noch in ' + ordner + '/ — von Hand löschen.');
              controller.render();
            });
        })
        .catch(function (e) {
          var text = String(e.message || e);
          sag(text);
          /* state.fehlerHinweis zusaetzlich zu sag() (I-NEU-1, Fix-Runde Final,
             Muster quelleErfassen-I10-Fix): sag() schreibt in den beim Klick
             eingefangenen #quelle-melde-Knoten — haengt ein Zwischen-Render ihn
             aus, bevor das Schreiben (dossierSchreiben) scheitert, erreicht die
             Fehlermeldung niemanden mehr. */
          state.fehlerHinweis = text;
          controller.render();
          if (knopf) knopf.disabled = false;
        });
    },

    /* ---------- Gate-Box (Etappe 2, Task 5): offen[] erfassen und behandeln ----------
       offen[]/entschieden[] sitzen im Dossier (Meta-Spec §3.2, Entscheid Markus
       2026-07-30): S1 (offenErfassen) haengt einen Punkt an ein Gate oder einen
       Schritt, S2 setzt ihn um — entscheiden (offenEntscheiden) oder begruendet
       verschieben (offenVerschieben). Guard und Muster wie quelleErfassen/
       dossierSpeichern: Dossier noch nicht geladen (undefined/null) heisst nicht
       bereit, sonst wuerde dossier.ausWerten... — hier root.dossier.offenNeu —
       gegen ein leeres dossier.neu() statt gegen den echten Stand laufen. */
    offenErfassen: function (t) {
      var k = nav.kurs(); if (!k) return;
      var kursId = k.kursId;
      var melde = typeof document !== 'undefined' && document.getElementById('offen-melde');
      function sag(txt) { if (melde) { melde.hidden = false; melde.textContent = txt; } }
      if (state.data.dossier[kursId] === undefined || state.data.dossier[kursId] === null) {
        sag('Dossier noch nicht geladen — kurz warten.');
        return;
      }
      var was = (document.getElementById('offen-was') || {}).value;
      var wo = (document.getElementById('offen-wo') || {}).value;
      var fuer = (document.getElementById('offen-fuer') || {}).value;
      return controller.dossierSchreiben(kursId, function (kopie) {
        root.dossier.offenNeu(kopie, { was: was, wo: wo, fuer: fuer });
        return kopie;
      }, sag)
        .then(function () {
          state.hinweis = 'Offener Punkt erfasst.';
          controller.render();
        })
        .catch(function (e) {
          var text = 'Nicht erfasst: ' + (e.message || e);
          sag(text);
          state.fehlerHinweis = text;
          controller.render();
        });
    },

    /* Identitaets-Guard (Brief, Pflicht): der Index kann sich zwischen Render und
       Ausfuehrung der Warteschlange verschoben haben (ein anderer Klick, ein
       412-Retry). Der Knopf traegt das `was` des Eintrags zur Render-Zeit als
       data-was; stimmt es beim Ausfuehren nicht mehr mit d.offen[index].was
       ueberein, bricht der Mutator mit null ab (kein Schreiben) statt am
       falschen Eintrag zu aendern — die Meldung sagt ausdruecklich, dass die
       Liste sich geaendert hat, statt einen falschen Erfolg zu behaupten. */
    offenEntscheiden: function (t) {
      var k = nav.kurs(); if (!k) return;
      var kursId = k.kursId;
      var melde = typeof document !== 'undefined' && document.getElementById('offen-melde');
      function sag(txt) { if (melde) { melde.hidden = false; melde.textContent = txt; } }
      if (state.data.dossier[kursId] === undefined || state.data.dossier[kursId] === null) {
        sag('Dossier noch nicht geladen — kurz warten.');
        return;
      }
      var index = parseInt(t.dataset.index, 10);
      var wasErwartet = t.dataset.was;
      var wer = (document.getElementById('offen-wer-' + index) || {}).value;
      var wann = (document.getElementById('offen-wann-' + index) || {}).value;
      return controller.dossierSchreiben(kursId, function (kopie) {
        var eintrag = kopie.offen[index];
        if (!eintrag || eintrag.was !== wasErwartet) return null;
        if (!root.dossier.offenEntscheiden(kopie, index, { wer: wer, wann: wann })) return null;
        return kopie;
      }, sag)
        .then(function (ergebnis) {
          if (ergebnis === null) {
            var text = 'Liste hat sich geändert — bitte neu laden.';
            sag(text);
            state.fehlerHinweis = text;
          } else {
            state.hinweis = 'Entschieden.';
          }
          controller.render();
        })
        .catch(function (e) {
          var text = 'Nicht entschieden: ' + (e.message || e);
          sag(text);
          state.fehlerHinweis = text;
          controller.render();
        });
    },

    /* Derselbe Identitaets-Guard wie offenEntscheiden — s. dort. */
    offenVerschieben: function (t) {
      var k = nav.kurs(); if (!k) return;
      var kursId = k.kursId;
      var melde = typeof document !== 'undefined' && document.getElementById('offen-melde');
      function sag(txt) { if (melde) { melde.hidden = false; melde.textContent = txt; } }
      if (state.data.dossier[kursId] === undefined || state.data.dossier[kursId] === null) {
        sag('Dossier noch nicht geladen — kurz warten.');
        return;
      }
      var index = parseInt(t.dataset.index, 10);
      var wasErwartet = t.dataset.was;
      var neuesZiel = (document.getElementById('offen-ziel-' + index) || {}).value;
      var begruendung = (document.getElementById('offen-begruendung-' + index) || {}).value;
      return controller.dossierSchreiben(kursId, function (kopie) {
        var eintrag = kopie.offen[index];
        if (!eintrag || eintrag.was !== wasErwartet) return null;
        if (!root.dossier.offenVerschieben(kopie, index, neuesZiel, begruendung)) return null;
        return kopie;
      }, sag)
        .then(function (ergebnis) {
          if (ergebnis === null) {
            var text = 'Liste hat sich geändert — bitte neu laden.';
            sag(text);
            state.fehlerHinweis = text;
          } else {
            state.hinweis = 'Verschoben.';
          }
          controller.render();
        })
        .catch(function (e) {
          var text = 'Nicht verschoben: ' + (e.message || e);
          sag(text);
          state.fehlerHinweis = text;
          controller.render();
        });
    },

    /* ---------- Gate-KLICK (Etappe 2, Task 6, Fix-Runde 1 -> Z9 radikal vereinfacht) ----------
       Z9 (Entscheid Markus, 2026-07-30, Live-Einsatz): die Gate-Box zeigt seither nur noch
       Versionsliste, Feld "Freigabe erteilt durch" und den Knopf — der Ablauf selbst bleibt
       unveraendert: Lauf-Merker-Sperre (F3, s. u.) · S2-Sperre (offene Punkte an GENAU dieses
       Gate, aus dem bereits geladenen Dossier — kein Netzzugriff dafuer noetig; die Ansicht
       zeigt dafuer bewusst KEINEN eigenen Hinweis mehr, s. ansichten.gateFreigabe — die
       Meldung hier nennt deshalb neu, WO zu behandeln ist) · Freigabe-erteilt-durch
       (Pflicht — die interne Feld-Id gate-zweitpruefung bleibt, sie IST die
       4-Augen-Zweitpruefung, ebenfalls vor jedem Netzzugriff geprueft) · Ordner frisch lesen ·
       Protokoll schreiben (Kontraktfeld gate_datei, Default _gate.md, gelesen ueber
       inhalt.gateDatei) · umbenennen (GEWAEHLTE Version -> _final, s. u.) · Dossier-Status des
       Lieferobjekts auf final — der FUENFTE Schreiber durch controller.dossierSchreiben, kein
       eigener graph.ablegen-Pfad. KWKurse (Schritt/Status) fasst dieser Klick NICHT an: das
       bleibt beim Erledigt-Haken (Abgrenzung KWKurse=Programmstand, Dossier=Lieferobjektstatus,
       Meta-Spec §3).

       Versions-Auswahl (Z9): frueher entschied inhalt.geltendeDatei() (hoechste Nummer)
       automatisch, welche Fassung final wird. Jetzt waehlt der Mensch explizit ueber die
       Radio-Liste (name="gate-version", ansichten.gateFreigabe) — der Controller liest den
       gerade angehakten Wert im vollen Durchlauf (Fall c unten) und benennt GENAU DIESE Datei
       um, nicht mehr automatisch die hoechste. Waehlt jemand eine nicht-hoechste Fassung, greift
       danach unveraendert die Maschinenregel "final ist final" (CLAUDE.md) — die Ansicht traegt
       dafuer einen statischen Hinweis direkt an der Wahl (kein zweiter Mechanismus hier noetig).

       Reihenfolge Protokoll-VOR-Umbenennen (Fix-Runde 1, Review-Empfehlung — vorher war es
       umgekehrt): der Protokoll-Inhalt (gate, von, nach, Zweitpruefung, Geprueft, offen) ist
       zum Zeitpunkt des Lesens bereits vollstaendig bekannt, eine Umbenennung liefert nichts
       Neues dafuer. Mit dieser Reihenfolge ist "von" in JEDEM Wiedereinstiegsfall VOR dem
       Umbenennen bekannt — der fruehere Platzhalter 'unbekannt (Wiedereinstieg)' war noetig,
       weil die alte Reihenfolge (umbenennen -> Protokoll) den von-Namen nach einem
       Teilfehler vor dem Protokoll-Schreiben bereits vernichtet hatte. Er bleibt nur noch als
       Randfall-Fallback stehen (s. Fall (a) unten), wenn eine _final ganz ohne Protokoll
       vorgefunden wird (z. B. von Hand geloescht, oder ein Dossier von vor dieser Task).

       Idempotenz ist Pflicht (Wiedereinstieg nach einem Teilfehler darf nichts verdoppeln).
       Sobald der Ordner gelesen ist, unterscheidet gateKlick:
       (a) _final liegt schon, das Protokoll fehlt (Randfall)  -> Umbenennung entfaellt (schon
           geschehen), das "von" ist nicht mehr rekonstruierbar — Platzhalter
           'unbekannt (Wiedereinstieg)', dann Status.
       (b) _final UND Protokoll liegen schon        -> nur noch der Dossier-Status.
       (c) _final fehlt noch (voller Durchlauf ODER Wiedereinstieg NACH einem Teilfehler VOR
           dem Umbenennen) -> das Protokoll wird IMMER frisch geschrieben, NIE uebersprungen
           (F2, Fix-Runde 1 — R7-Schutz): eine bereits vorhandene _gate.md koennte von einem
           frueheren, per Hand zurueckgestuften Zyklus stammen (CLAUDE.md, "Wer nach der
           Freigabe weiterarbeiten muss, setzt _final von Hand zurueck") und die FALSCHE,
           veraltete Version nennen — ihre blosse Anwesenheit darf ein neues Protokoll
           deshalb nie unterdruecken. graph.ablegen ueberschreibt deterministisch (kein
           Duplikat), also ist ein wiederholtes Schreiben harmlos. Danach umbenennen, danach
           Status. */
    gateKlick: function (n, knopf) {
      var k = nav.kurs(); if (!k) return;
      var kursId = k.kursId;
      var laufSchluessel = kursId + '/' + n;
      var inh = state.data.inhalt;
      var melde = typeof document !== 'undefined' && document.getElementById('gate-melde');
      function sag(txt) { if (melde) { melde.hidden = false; melde.textContent = txt; } }
      /* Fuer die Erfolgsmeldung (Z9, Ledger-Minor "Erfolgsmeldung ohne Dateiname") —
         in jedem Zweig (a/b/c) auf den tatsaechlichen _final-Namen gesetzt, bevor die
         Promise-Kette aufloest. */
      var nachName = null;

      /* F3 (Fix-Runde 1): der Lauf-Merker ist die ERSTE Pruefung, noch vor dem
         Dossier-Guard — ein zweiter, ueberlappender Klick darf unter keinen Umstaenden
         einen zweiten Graph-Aufruf ausloesen, egal was sonst im State steht. Ein Render
         mitten im Lauf (z. B. ein auslaufendes ordnerNachladen) baut die Gate-Box neu auf:
         der frisch gezeichnete Knopf zeigt wieder enabled (der Dateien-Cache traegt ja noch
         die alte Version), und der Formular-Erhalt stellt #gate-zweitpruefung wieder her —
         ohne diesen State-Merker koennte ein zweiter Klick einen zweiten Lauf ausloesen, der
         das korrekte Ergebnis des ersten ueberschreibt. */
      if (state.gateLaeuft[laufSchluessel]) {
        sag('Gate läuft bereits — bitte warten.');
        return;
      }

      var d = state.data.dossier[kursId];
      if (!d || typeof d !== 'object') {
        var keinDossier = 'Dossier nicht geladen — Gate nicht durchlaufen.';
        sag(keinDossier);
        state.fehlerHinweis = keinDossier;
        controller.render();
        return;
      }

      var adressat = root.inhalt.gateAdressat(n);
      if (root.dossier.offenFuer(d, adressat).length) {
        /* Z9: keine Punkte-UI mehr in der Gate-Box — die Meldung sagt deshalb, WO zu
           behandeln ist, statt eine Liste zu zeigen, die es hier nicht mehr gibt. */
        var textS2 = 'Offene Punkte im Dossier an dieses Gate adressiert — Behandlung ' +
          'folgt mit der Review-Ansicht; bis dahin via Dossier.';
        sag(textS2);
        state.fehlerHinweis = textS2;
        controller.render();
        return;
      }

      var ablage = root.inhalt.ablageVon(inh, n, kursId);
      var schl = kursId + '/' + ablage.ordner;
      var freigabeDurch = String((document.getElementById('gate-zweitpruefung') || {}).value || '').trim();
      if (!freigabeDurch) { sag('Freigabe erteilt durch fehlt.'); return; }
      /* Z9: kein Geprueft-Textfeld mehr in der Box — das Protokoll fuehrt dafuer
         unveraendert den Strich-Fall ("- —") wie bisher bei leerer Liste. */
      var geprueft = [];

      /* Sentinel statt eines fruehen return in der Promise-Kette (Abbruch nach dem
         Bestaetigungs-Dialog): ein blosses return aus dem inneren .then wuerde die
         AEUSSERE Erfolgsmeldung trotzdem auslösen. */
      var ABGEBROCHEN = {};

      delete state.data.dateien[schl];
      state.gateLaeuft[laufSchluessel] = true;
      if (knopf) knopf.disabled = true;
      sag('Wird durchgeführt …');

      function laufBeenden() { delete state.gateLaeuft[laufSchluessel]; }

      return graph.ordnerInhalt(kursId, ablage.ordner).then(function (dateien) {
        var lief = root.inhalt.lieferobjektVon(inh, n, ablage.variante);
        var endung = root.inhalt.erwarteteEndung(inh, n);
        var final = root.inhalt.finalVorhanden(dateien, kursId, lief);
        var gateDateiName = root.inhalt.gateDatei(inh);
        var protokollDa = (dateien || []).some(function (x) { return x.name === gateDateiName; });

        function statusSchreiben() {
          return controller.dossierSchreiben(kursId, function (kopie) {
            root.dossier.statusSetzen(kopie, lief, 'final');
            return kopie;
          });
        }

        if (final) {
          /* (b): Protokoll liegt bereits (der Normalfall unter dieser Reihenfolge, da es
             VOR dem Umbenennen entstand) -> nur noch der Status.
             (a, Randfall): Protokoll fehlt trotzdem — 'von' ist nicht mehr rekonstruierbar,
             geltendeDatei() liefert ab hier nur noch final selbst zurueck. */
          nachName = final;
          if (protokollDa) return statusSchreiben();
          var mdRandfall = root.inhalt.gateProtokoll({
            gate: ablage.gate, kursId: kursId, von: 'unbekannt (Wiedereinstieg)', nach: final,
            datum: new Date().toISOString().slice(0, 10),
            person: (state.auth.account && state.auth.account.name) || '',
            zweitpruefung: freigabeDurch, geprueft: geprueft, offen: (d.offen || [])
          });
          return graph.ablegen(kursId, ablage.ordner, gateDateiName, mdRandfall).then(statusSchreiben);
        }

        /* Z9: die GEWAEHLTE Version (Radio name="gate-version", ansichten.gateFreigabe),
           nicht mehr automatisch die hoechste (inhalt.geltendeDatei). Ohne DOM (Node-Test
           ohne Mock) oder ohne angehaktes Radio bleibt gewaehlt null — derselbe Fehlerfall
           wie zuvor "keine versionierte Datei". */
        var radios = typeof document !== 'undefined' ? document.querySelectorAll('[name="gate-version"]') : [];
        var gewaehlt = null;
        Array.prototype.forEach.call(radios, function (r) { if (r.checked) gewaehlt = r.value; });
        if (!gewaehlt) throw new Error('keine Fassung ausgewählt in ' + ablage.ordner);
        /* Fix-Runde Z9 (Review-Finding): gewaehlt kommt aus dem DOM, also aus dem Stand
           zur RENDER-Zeit — nicht aus derselben dateien-Liste, die hier gerade frisch
           gelesen wurde. Zwischen Render und Klick kann die Datei verschwunden sein
           (Race: eine zweite Person hat sie umbenannt/geloescht, oder ein eigener
           frueherer Teil-Durchlauf hat sie bereits verschoben). Ohne diese Pruefung
           haette das Protokoll unten "Freigegeben: {gewaehlt}" fuer eine Datei
           geschrieben, die es nicht mehr gibt — graph.umbenennen waere danach mit 404
           gescheitert, das falsche Protokoll waere aber schon liegen geblieben. Deshalb
           VOR jedem Schreiben abbrechen, sobald die aktuelle Ordnerliste die gewaehlte
           Datei nicht mehr fuehrt — kein Protokoll, keine Umbenennung. */
        if (!dateien.some(function (x) { return x.name === gewaehlt; })) {
          throw new Error('gewählte Fassung ' + gewaehlt + ' liegt nicht mehr im Ordner — ' +
            'Ansicht wurde neu geladen, bitte Auswahl prüfen');
        }
        var nach = root.inhalt.finalName(kursId, lief, endung);
        nachName = nach;
        if (!controller._bestaetige('Als final bestätigen?\n' + gewaehlt + ' → ' + nach)) {
          return ABGEBROCHEN;
        }

        /* (c): das Protokoll wird IMMER frisch geschrieben (F2) — von ist bekannt, solange
           final noch fehlt, egal ob voller Durchlauf oder Wiedereinstieg. */
        var md = root.inhalt.gateProtokoll({
          gate: ablage.gate, kursId: kursId, von: gewaehlt, nach: nach,
          datum: new Date().toISOString().slice(0, 10),
          person: (state.auth.account && state.auth.account.name) || '',
          zweitpruefung: freigabeDurch, geprueft: geprueft, offen: (d.offen || [])
        });
        return graph.ablegen(kursId, ablage.ordner, gateDateiName, md).then(function () {
          return graph.umbenennen(kursId, ablage.ordner, gewaehlt, nach);
        }).then(statusSchreiben);
      }).then(function (ergebnis) {
        laufBeenden();
        if (ergebnis === ABGEBROCHEN) {
          if (knopf) knopf.disabled = false;
          sag('');
          return;
        }
        state.hinweis = 'Als final bestätigt: ' + nachName + '.';
        controller.render();
      }).catch(function (e) {
        laufBeenden();
        if (knopf) knopf.disabled = false;
        var text = 'Gate nicht (vollständig) durchlaufen: ' + (e.message || e) +
          ' — erneuter Klick setzt fort, was fehlt.';
        sag(text);
        state.fehlerHinweis = text;
        controller.render();
      });
    },

    /* Die Wahl steht fuer sich, ohne Formular und ohne Knopf — sie wird direkt
       beim Umschalten des Radios abgelegt. */
    contentModus: function (el) {
      var kursId = state.position.kursId;
      var d0 = state.data.dossier[kursId];
      var melde = typeof document !== 'undefined' && document.getElementById('quelle-melde');
      /* Fehlt der Kursordner, laeuft dossierNachladen nie an (siehe render()) — ohne
         diese Unterscheidung meldete der Guard unten dauerhaft "noch nicht geladen",
         obwohl gar nichts laedt (M-1, Fix-Runde Final, Muster dossierSpeichern/
         quelleErfassen — Guard-Reihenfolge konsistent: ordner vor d0). */
      if (state.data.ordner[kursId] === null) {
        if (melde) { melde.hidden = false; melde.textContent = 'Kein Kursordner — zuerst in Schritt 1 die Ablage anlegen.'; }
        return;
      }
      /* Meldung statt stillem Rueckkehren (Etappe 1e, Task 1) — sonst zeigt das
         Radio den neuen Wert, ohne dass je etwas gesichert wurde. */
      if (!d0) {
        if (melde) { melde.hidden = false; melde.textContent = 'Dossier noch nicht geladen — kurz warten.'; }
        return;
      }
      /* Radios waehrend des Schreibens sperren — sonst kann ein zweiter Klick
         waehrend der laufenden Sicherung eine zweite Warteschlangen-Runde ausloesen,
         bevor die erste sichtbar zurueckgemeldet hat. */
      var radios = typeof document !== 'undefined' ? document.querySelectorAll('[name="content-modus"]') : [];
      Array.prototype.forEach.call(radios, function (r) { r.disabled = true; });
      var modus = el.value === 'quellenfrei' ? 'quellenfrei' : 'quellengestuetzt';

      return controller.dossierSchreiben(kursId, function (kopie) {
        kopie.content_modus = modus;
        return kopie;
      }, function (t) { if (melde) { melde.hidden = false; melde.textContent = t; } })
        .then(function () {
          Array.prototype.forEach.call(radios, function (r) { r.disabled = false; });
        })
        .catch(function (e) {
          /* PUT fehlgeschlagen: State/SharePoint tragen weiter den alten Modus, das
             Radio zeigt aber schon den neuen — controller.render() zeichnet aus dem
             echten State neu, damit es wieder zurueckspringt. */
          Array.prototype.forEach.call(radios, function (r) { r.disabled = false; });
          if (melde) { melde.hidden = false; melde.textContent = 'Nicht gesichert: ' + (e.message || e); }
          controller.render();
        });
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
      /* B9-F1 Fix-Runde 1 (Review-Finding): dateiAuswahl ist render-fest (s. o.),
         aber navigations-fluechtig — sie darf einen Kurs-/Schrittwechsel nicht
         ueberleben. Ohne diesen Reset zeigte eine SPAETERE Rueckkehr zur selben
         Kurs/Schritt-Kombination "Gewaehlt: {alte Datei}" erneut an (der
         Positions-Stempel passt ja wieder), und ein Klick haette eine laengst
         vergessene Datei hochgeladen — ein Footgun im versionsstrengen
         Ablage-System. Verglichen wird VOR der Mutation gegen die aktuelle
         Position, in demselben Format wie der Stempel selbst (state.position.
         kursId || null bzw. String(schrittId)) — nur kursId/schrittId zaehlen:
         ein reiner Varianten-/Weg-Wechsel (zu({variante:..})/zu({weg:..})) und
         ein erneuter Aufruf mit unveraenderter Position loeschen nichts. */
      var kursVorher = state.position.kursId || null;
      var schrittVorher = state.position.schrittId != null ? String(state.position.schrittId) : null;
      Object.keys(aenderung).forEach(function (k) { state.position[k] = aenderung[k]; });
      var kursNachher = state.position.kursId || null;
      var schrittNachher = state.position.schrittId != null ? String(state.position.schrittId) : null;
      /* B9-F3: uploadMeldung ist ein/derselbe Fall — sie darf ebenfalls keinen
         Kurs-/Schrittwechsel ueberleben (dasselbe kursVorher/schrittVorher-
         Muster, kein zweiter Vergleich noetig). */
      if (kursVorher !== kursNachher || schrittVorher !== schrittNachher) {
        state.data.dateiAuswahl = null;
        state.data.uploadMeldung = null;
      }
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

      /* Dieselbe Variante, die die Ansicht anzeigt — sonst legt der Knopf unter
         einem anderen Namen ab als versprochen, oder gar nicht. */
      var gewaehlt = root.inhalt.gewaehlteVariante(inh, n, state.position.variante);
      var ab = root.inhalt.ablageVon(inh, n, k.kursId, gewaehlt);
      var schl = k.kursId + '/' + ab.ordner;
      knopf.disabled = true; knopf.textContent = 'wird abgelegt …';

      /* Den Ordner frisch lesen — die Nummer darf nicht aus einem alten Stand kommen. */
      delete state.data.dateien[schl];
      graph.ordnerInhalt(k.kursId, ab.ordner)
        .then(function (dateien) {
          var zu = root.inhalt.abgeschlossen(inh, n, k.kursId, dateien, gewaehlt);
          if (zu) {
            throw new Error('Abgeschlossen: ' + zu + ' ist freigegeben. Setze die ' +
              'Freigabe von Hand zurück, wenn du wirklich nachbessern musst. Dein Text ' +
              'bleibt im Feld stehen.');
          }
          var ziel = root.inhalt.naechsteDatei(inh, n, k.kursId, dateien, gewaehlt);
          if (!ziel) throw new Error('Für diesen Schritt ist kein versioniertes Ablegen vorgesehen.');
          /* Erst zurueckstufen, dann schreiben. In dieser Reihenfolge gibt es nie
             zwei _final; in der umgekehrten waere die neue Fassung fuer einen
             Moment von der alten verdeckt. */
          var vorher = ziel.zurueckstufen
            ? graph.umbenennen(k.kursId, ziel.ordner, ziel.zurueckstufen.von, ziel.zurueckstufen.nach)
            : Promise.resolve(null);
          return vorher
            .then(function () { return graph.ablegen(k.kursId, ziel.ordner, ziel.datei, text); })
            .then(function () { return ziel; });
        })
        .then(function (ziel) {
          var neu = graph.standNachAblage(k, +n);
          var weiter = neu ? graph.standSetzenRoh(k, neu) : Promise.resolve();
          return weiter.then(function () { return ziel; });
        })
        .then(function (ziel) {
          return graph.ordnerInhalt(k.kursId, ab.ordner).then(function () {
            state.hinweis = 'Abgelegt als ' + ziel.datei +
              (ziel.zurueckstufen ? ' · bisherige Fassung ist jetzt ' + ziel.zurueckstufen.nach : '');
            /* Das Briefing steckt in den Projekt-Instruktionen — nach einer neuen
               Fassung muss es dort erneut hinein. */
            var status = Promise.resolve();
            if (String(n) === '1') {
              state.data.briefing[k.kursId] = undefined;
              if (state.data.dossier[k.kursId]) {
                /* Ueber die Warteschlange (Etappe 1e, Task 1), nicht mehr fire-and-forget
                   direkt an graph.ablegen — der Fehler wird jetzt gemeldet statt
                   verschluckt. Die Ablage selbst ist bereits erfolgreich; scheitert nur
                   der Status, bleibt das sichtbar statt sich als "unverschluckt" zu tarnen. */
                status = controller.dossierSchreiben(k.kursId, function (kopie) {
                  root.dossier.statusSetzen(kopie, 'briefing', 'final');
                  return kopie;
                }).catch(function (e) {
                  /* state.fehlerHinweis statt state.hinweis (M3, Etappe 1e Task 4):
                     das ist ein Fehler, kein Erfolg — er darf nicht das gruene
                     Haekchen von state.hinweis tragen. "Abgelegt als ..." steht
                     bereits im (erfolgreichen) state.hinweis oben, deshalb hier
                     nicht wiederholt. */
                  state.fehlerHinweis = 'Status nicht aktualisiert: ' + (e.message || e);
                });
              }
            }
            return status.then(function () { controller.render(); });
          });
        })
        .catch(function (e) {
          knopf.disabled = false; knopf.textContent = 'Ablegen';
          /* Kein alert: die Meldung ist mehrsaetzig und der eingegebene Text soll
             daneben sichtbar bleiben, statt hinter einem Modal zu verschwinden. */
          var m = document.getElementById('ablegefehler');
          if (m) { m.textContent = 'Nicht abgelegt. ' + (e.message || e); m.hidden = false; }
          else { alert('Nicht abgelegt: ' + (e.message || e)); }
        });
    },

    /* Schritt 1, erster Teil: die Ablage anlegen. Setzt den Stand bewusst nicht —
       Schritt 1 ist fertig, wenn das Briefing liegt, nicht wenn der Ordner steht. */
    ablageAnlegen: function (knopf) {
      var k = nav.kurs(), inh = state.data.inhalt;
      var feld = document.getElementById('ordnername');
      if (!k || !feld) return;
      var name = feld.value.trim();
      var meld = document.getElementById('ordnerfehler');

      function klemmt(text) {
        knopf.disabled = false; knopf.textContent = 'Ablage anlegen';
        if (meld) { meld.textContent = text; meld.hidden = false; }
        else { alert(text); }
      }

      var wund = root.inhalt.kursordnerPruefe(inh, k.kursId, name);
      if (wund) { klemmt(wund); feld.focus(); return; }

      if (meld) meld.hidden = true;
      knopf.disabled = true; knopf.textContent = 'wird angelegt …';

      graph.ablageAnlegen(k.kursId, name, root.inhalt.ordnerliste(inh))
        .then(function (ord) {
          if (!ord) throw new Error('Angelegt, aber nicht wiedergefunden. Bitte neu laden.');
          state.hinweis = 'Ablage ' + name + ' angelegt.';
          controller.render();
        })
        .catch(function (e) { klemmt('Nicht angelegt. ' + (e.message || e)); });
    },

    /* Hebt die Datei-Auswahl aus dem Input in den State (B9-F1) — aufgerufen
       aus der change-Delegation weiter unten, sobald am Feld #datei etwas
       gewaehlt wird. Gestempelt mit der aktuellen Position (Muster
       _formularSnapshot): controller.hochladen und ansichten.js verwenden die
       Auswahl nur, wenn Kurs UND Schritt noch passen — ein Kurs-/Schrittwechsel
       macht sie stillschweigend unbrauchbar, ohne dass hier aufgeraeumt werden
       muesste. render() DANACH ist gefahrlos: der Input stirbt beim Neuaufbau,
       die File-Objekte leben im State weiter. */
    dateiGewaehlt: function (el) {
      state.data.dateiAuswahl = {
        kursId: state.position.kursId || null,
        schrittId: state.position.schrittId != null ? String(state.position.schrittId) : null,
        dateien: el.files ? Array.prototype.slice.call(el.files) : []
      };
      /* B9-F3: eine neue Auswahl macht eine stehende Upload-Antwort (Erfolg oder
         Abweisung der vorigen Datei) obsolet — sonst zeigt der Block nach dem
         Wechsel weiterhin die Meldung zur ALTEN Datei. */
      state.data.uploadMeldung = null;
      controller.render();
    },

    /* Der Weg Hochladen — fuer Lieferobjekte, die nicht als Text entstehen.
       Ordner und Name kommen aus dem Kontrakt, nie aus dem Dateidialog: eine
       falsch benannte Datei faellt sonst aus Versionszaehlung und Gate-Aufloesung. */
    hochladen: function (n, knopf) {
      var k = nav.kurs(), inh = state.data.inhalt;
      var feld = document.getElementById('datei');
      if (!k || !feld) return;
      /* Mehrfach-Auswahl (B5, Etappe 3b): der Blockdatei-Gate von Schritt 3
         braucht genau eine Blockdatei PLUS beliebig viele Illustrations-PNGs
         in EINER Auswahl — der Input traegt seither `multiple` (ansichten.js,
         nur wo der Kontrakt pruefung:'skript' fuehrt). Jeder andere Weg
         (T11/xlsx, Schritt 6/mbz) liest weiterhin nur die erste Datei —
         unveraendert, weil dort nie mehr als eine gewaehlt wird.

         B9-F1 (Live-Befund): das Feld selbst kann zum Klickzeitpunkt schon
         ein NEUES, leeres Element sein — ein Zwischen-Render (Schritt 3 loest
         nach dem Oeffnen mehrere aus: dossierNachladen, briefingNachladen,
         zwei ordnerNachladen) baut die Ansicht neu, bevor die Person klickt.
         Die State-Auswahl (dateiGewaehlt) hat Vorrang, wenn ihr Stempel noch
         zu Kurs UND Schritt passt; feld.files bleibt der Ruckfall fuer den
         Fall "gewaehlt und sofort geklickt, kein Render dazwischen" sowie
         jeden bestehenden Testpfad, der files direkt setzt. */
      var auswahl = state.data.dateiAuswahl;
      var auswahlPasst = !!(auswahl && auswahl.kursId === k.kursId &&
        auswahl.schrittId === String(n) && auswahl.dateien && auswahl.dateien.length);
      var dateiListe = auswahlPasst ? auswahl.dateien
        : (feld.files ? Array.prototype.slice.call(feld.files) : []);
      var datei = dateiListe[0] || null;
      var meld = document.getElementById('hochladefehler');

      function klemmt(text) {
        knopf.disabled = false; knopf.textContent = 'Hochladen';
        if (meld) { meld.textContent = text; meld.hidden = false; }
        else { alert(text); }
      }
      /* Zusaetzlich im State (T11, Muster quelleErfassen-I10): ein
         Zwischen-Render kann #hochladefehler aushaengen, bevor die Person
         die Meldung liest — state.fehlerHinweis lebt im State und uebersteht
         das. B9-F3: state.data.uploadMeldung ebenso, zusaetzlich gerendert IM
         Hochladen-Block selbst (ansichten.js) — der obere Meldungsblock
         (fehlerHinweis) ist weit weg vom Ort des Geschehens, an dem die
         Person gerade steht. EIN Punkt hier deckt ALLE Aufrufer von
         klemmtSichtbar ab (Konvention 9), keine einzelne Aufrufstelle muss
         angefasst werden. */
      function klemmtSichtbar(text) {
        state.fehlerHinweis = text;
        state.data.uploadMeldung = { typ: 'fehler', text: text };
        klemmt(text);
        controller.render();
      }
      if (!dateiListe.length) { feld.click(); return; }
      /* B9-F3: ein neuer Hochladen-Klick startet immer mit einer leeren Tafel —
         eine stehende Meldung zur VORIGEN Datei/zum VORIGEN Versuch soll nicht
         mitten im neuen Versuch (waehrend "wird geprueft/hochgeladen …") noch
         herumstehen. Synchron, VOR jedem Netzzugriff. */
      state.data.uploadMeldung = null;

      var ab = root.inhalt.ablageVon(inh, n, k.kursId);
      var schl = k.kursId + '/' + ab.ordner;
      var vari = root.inhalt.varianten(inh, n);
      var gewaehlt = root.inhalt.gewaehlteVariante(inh, n, state.position.variante);

      /* Upload-Strukturpruefung (T11) — das Drift-Netz fuer chat-generierte
         Contract-Excels (AFL-001-Lehre: eine erfundene Spalte ging unbemerkt
         durch Gate 1). Das Gate haengt bewusst an ZWEI Bedingungen (Fix-Runde
         1, Finding F5) — struktur-Feld UND der Kontrakt selbst erwartet fuer
         diesen Schritt 'xlsx' —, nicht am lokalen Dateinamen allein: eine
         .xls/.xlsm/endungslose Datei umging die Pruefung sonst und landete
         ungeprueft unter dem .xlsx-Zielnamen. Ist das Gate scharf, MUSS die
         gewaehlte Datei als .xlsx erkennbar sein — sonst wird laut
         abgewiesen statt still durchgelassen. Laeuft VOR jedem Netzzugriff:
         ein struktureller Befund (oder eine falsche Endung) soll den Ordner
         nicht erst frisch lesen. */
      var struktur = root.inhalt.strukturVon(inh, n);
      var geprueftPflicht = !!(struktur && root.inhalt.erwarteteEndung(inh, n) === 'xlsx');
      var istXlsx = /\.xlsx$/i.test((datei.name || ''));

      function weiterMitUpload(hinweise) {
        if (meld) meld.hidden = true;
        knopf.disabled = true; knopf.textContent = 'wird hochgeladen …';

        /* Den Ordner frisch lesen — die Versionsnummer darf nicht aus einem alten Stand kommen. */
        delete state.data.dateien[schl];
        graph.ordnerInhalt(k.kursId, ab.ordner)
          .then(function (dateien) {
            /* Final ist final — auch wenn jemand den Knopf trotzdem erreicht. */
            var zu = root.inhalt.abgeschlossen(inh, n, k.kursId, dateien, gewaehlt);
            if (zu) {
              throw new Error('Abgeschlossen: ' + zu + ' ist freigegeben. Setze die ' +
                'Freigabe von Hand zurück, wenn du wirklich nachbessern musst.');
            }
            var ziel = root.inhalt.hochladeZiel(inh, n, k.kursId, dateien, gewaehlt);
            if (!ziel) {
              throw new Error(vari
                ? 'Wähle zuerst die Variante — der Dateiname hängt davon ab.'
                : 'Für diesen Schritt ist kein Hochladen vorgesehen.');
            }
            /* Erst zurueckstufen, dann hochladen — sonst gaebe es kurz zwei _final. */
            var vorher = ziel.zurueckstufen
              ? graph.umbenennen(k.kursId, ziel.ordner, ziel.zurueckstufen.von, ziel.zurueckstufen.nach)
              : Promise.resolve(null);
            return vorher.then(function () {
              return graph.hochladen(k.kursId, ziel.ordner, ziel.datei, datei, function (anteil) {
                knopf.textContent = anteil >= 1 ? 'wird abgeschlossen …'
                                                : 'lädt … ' + Math.round(anteil * 100) + '%';
              });
            }).then(function () { return ziel; });
          })
          .then(function (ziel) {
            var neu = graph.standNachAblage(k, +n);
            var weiter = neu ? graph.standSetzenRoh(k, neu) : Promise.resolve();
            return weiter.then(function () { return ziel; });
          })
          .then(function (ziel) {
            return graph.ordnerInhalt(k.kursId, ab.ordner).then(function () {
              /* B9-F1: nach erfolgreicher Ablage die State-Auswahl leeren — sonst
                 zeigt die Ansicht Geister-Namen und ein zweiter Klick laedt
                 Veraltetes neu hoch. */
              state.data.dateiAuswahl = null;
              var erfolgstext = 'Hochgeladen als ' + ziel.datei +
                (hinweise && hinweise.length ? ' — Hinweis: ' + hinweise.join(' · ') : '');
              /* B9-F3: dieselbe persistente Meldung wie bei einer Abweisung
                 (klemmtSichtbar), nur mit typ 'ok' — derselbe Text wie
                 state.hinweis, damit oben und im Block dasselbe steht. */
              state.data.uploadMeldung = { typ: 'ok', text: erfolgstext };
              state.hinweis = erfolgstext;
              controller.render();
            });
          })
          .catch(function (e) {
            /* klemmtSichtbar, nicht nur klemmt (B9-F3-Nachzug, Review-Fund):
               dieser Zweig deckt den einfachen xlsx-/mbz-Upload ab (Schritt 2
               und 6) — ein Netz-/Business-Fehler hier (z. B. graph.hochladen
               schlaegt fehl) landete bisher nur lokal am #hochladefehler-
               Knoten, ohne state.fehlerHinweis/state.data.uploadMeldung zu
               setzen; ein Zwischen-Render konnte den Knoten aushaengen, bevor
               die Person ihn las (Muster quelleErfassen-I10, wie im
               skriptbau-Pfad direkt darunter). */
            klemmtSichtbar('Nicht hochgeladen. ' + (e.message || e));
          });
      }

      /* Der Blockdatei-Bau (B5, Etappe 3b) — "Bau + Ablage in EINEM Vorgang"
         (Muster "Quellen-Erfassung = ein Vorgang", Etappe 1): erst wird
         GANZ gebaut (Diagramme rendern, Vorlage laden, docxBauen.baue), ALLES
         im Speicher — dann erst beginnt irgendein Netzzugriff zur Ablage.
         Ein Baufehler (Diagramm wirft, Vorlage fehlt, docxBauen.baue lehnt
         ab) erreicht den Ablage-Teil dadurch strukturell nie: es gibt keinen
         Teil-Upload bei einem Baufehler (Mutationsprobe im Task-Report).
         Reihenfolge der Ablage: docx zuerst (das Hauptlieferobjekt, zaehlt
         die Version), dann die Blockdatei UNTER DEMSELBEN Versionsnamen
         daneben (die Quelle wandert mit — Schritt 4 und jeder Neubau
         brauchen sie), dann jedes Bild nach `abbildungen/` im Schrittordner.
         `geschafft` sammelt, was bereits abgelegt wurde — schlaegt ein
         SPAETERER Schritt der Ablage fehl, nennt die Meldung, was schon
         liegt. Anders als bei den Bildern (feste Namen in abbildungen/, ein
         erneuter Versuch ueberschreibt sie deterministisch, Muster
         quelleErfassen-I10) sind docx UND blocks VERSIONIERT
         (inhalt.hochladeZiel/naechsteVersion, s. dort) — ein erneuter
         Versuch legt die NAECHSTE, vollstaendige Version daneben, er
         ueberschreibt die unvollstaendige NICHT (Fixwave 2026-08-04, I3: die
         alte Meldung behauptete hier faelschlich ein sicheres Ueberschreiben
         fuer alle drei Ablage-Schritte; die unvollstaendige Fassung bleibt
         liegen und gehoert von Hand in den SharePoint-Papierkorb, s. der
         Meldetext unten). */
      function weiterMitSkriptBau(gelesen, hinweise, blockText, pngKandidaten) {
        if (meld) meld.hidden = true;
        knopf.disabled = true; knopf.textContent = 'wird gebaut …';

        var variante = (gelesen.skript && gelesen.skript.variante) || gewaehlt;
        var kursSkript = (gelesen.skript && gelesen.skript.kurs) || k.kursId;
        var bilder = {};
        var geschafft = [];
        /* I3: fuer die Teilfehler-Meldung im abschliessenden .catch braucht es
           die Versionsnummer des Ziels — die lebt nur innerhalb des naechsten
           .then(dateien)-Closures (ziel), deshalb hier gemerkt, sobald bekannt. */
        var zielInfo = null;

        /* Diagramme rendern (B3), je ABBILDUNG ausser vergleichstabelle —
           dieselbe Reihenfolge (Kapitel, dann Abbildung je Kapitel), in der
           docxBauen.baue() die Bild-Dateinamen selbst vergibt (kapitelAbsaetze
           in docx-bauen.js), sonst passt kein Name zusammen. Die logischen
           Masse kommen aus dem SVG-String selbst (width=/height= am
           <svg>-Wurzelelement) — dieselbe Massquelle wie skript-bauen.cjs,
           s. Task-Brief. */
        var renderJobs = [];
        var bildNr = 0;
        (gelesen.kapitel || []).forEach(function (kap) {
          (kap.abbildungen || []).forEach(function (a) {
            var typInfo = root.skriptSchema.diagrammTyp(a.typ);
            if (typInfo && typInfo.alsTabelle) return; /* Word-Tabelle, kein Bild */
            bildNr += 1;
            renderJobs.push({ a: a, dateiname: root.docxBauen.bildDateiname(kursSkript, variante, bildNr) });
          });
        });

        var bauKette = renderJobs.reduce(function (kette, job) {
          return kette.then(function () {
            /* mitTitel:false (Review-Finding 1): docxBauen.abbildungAbsatz()
               setzt den Abbildungstitel bereits als Bildunterschrift
               (pStyle="Quelle") — ohne diese Option truege das Diagramm
               selbst den Titel zusaetzlich ein zweites Mal (Referenz
               skript-bauen.cjs Zeile ~164 unterdrueckt ihn im Bild aus
               demselben Grund). rahmen() (diagramm-zeichnen.js) schneidet
               dabei den oberen Streifen weg und schrumpft height im
               SVG-String selbst um KOPF (55px) — die Massextraktion unten
               liest genau diesen String, bleibt also automatisch
               konsistent, ohne KOPF hier kennen zu muessen. */
            var svgText = root.diagrammZeichnen.svg(job.a, { mitTitel: false });
            var w = /width="([\d.]+)"/.exec(svgText);
            var h = /height="([\d.]+)"/.exec(svgText);
            var breite = w ? parseFloat(w[1]) : 900;
            var hoehe = h ? parseFloat(h[1]) : 300;
            return root.diagrammZeichnen.png(svgText, breite, hoehe).then(function (bytes) {
              bilder[job.dateiname] = { bytes: bytes, breite: breite, hoehe: hoehe };
            });
          });
        }, Promise.resolve());

        bauKette
          .then(function () {
            /* Hochgeladene Illustrations-PNGs kommen mit ihrem eigenen
               Dateinamen in denselben bilder-Kontrakt — ohne logische Masse
               (docxBauen faellt dafuer auf das PNG-IHDR zurueck, s. dort). */
            return Promise.all(pngKandidaten.map(function (p) {
              return p.arrayBuffer().then(function (buf) {
                bilder[p.name] = { bytes: new Uint8Array(buf) };
              });
            }));
          })
          .then(function () { return graph.vorlageLaden(); })
          .then(function (vorlage) {
            if (!vorlage) {
              /* I2 (Fixwave 2026-08-04): der alte Wortlaut ("… nicht
                 gefunden") klang endgueltig, obwohl ein Netz-Timeout dieselbe
                 Meldung ausloest wie eine fehlende Datei — beides fuehrt hier
                 zu vorlage === null. graph.vorlageLaden() cacht seit I2 nur
                 noch einen Erfolg, ein erneuter Versuch laedt also wirklich
                 neu. */
              throw new Error('Vorlage konnte nicht geladen werden — erneut versuchen.');
            }
            return root.docxBauen.baue(vorlage, gelesen, bilder);
          })
          .then(function (docxBytes) {
            /* Ab hier ist gebaut — jetzt erst Netzzugriffe zum Ablegen. */
            knopf.textContent = 'wird hochgeladen …';
            delete state.data.dateien[schl];
            return graph.ordnerInhalt(k.kursId, ab.ordner).then(function (dateien) {
              var zu = root.inhalt.abgeschlossen(inh, n, k.kursId, dateien, gewaehlt);
              if (zu) {
                throw new Error('Abgeschlossen: ' + zu + ' ist freigegeben. Setze die Freigabe ' +
                  'von Hand zurück, wenn du wirklich nachbessern musst.');
              }
              var ziel = root.inhalt.hochladeZiel(inh, n, k.kursId, dateien, gewaehlt);
              if (!ziel) {
                throw new Error(vari
                  ? 'Wähle zuerst die Variante — der Dateiname hängt davon ab.'
                  : 'Für diesen Schritt ist kein Hochladen vorgesehen.');
              }
              zielInfo = ziel;
              var blocksName = ziel.datei.replace(/\.[a-z0-9]+$/i, '.blocks');
              var bildNamen = Object.keys(bilder);

              /* Erst zurueckstufen, dann hochladen — sonst gaebe es kurz zwei _final. */
              var vorher = ziel.zurueckstufen
                ? graph.umbenennen(k.kursId, ziel.ordner, ziel.zurueckstufen.von, ziel.zurueckstufen.nach)
                : Promise.resolve(null);

              return vorher
                .then(function () {
                  return graph.hochladen(k.kursId, ziel.ordner, ziel.datei, new Blob([docxBytes]));
                })
                .then(function () { geschafft.push(ziel.ordner + '/' + ziel.datei); })
                .then(function () {
                  /* Fix-Runde 1: echtes Blob statt des rohen (evtl. Pseudo-)
                     Datei-Objekts — s. Kommentar an der Aufrufstelle oben. */
                  return graph.hochladen(k.kursId, ziel.ordner, blocksName,
                    new Blob([blockText], { type: 'text/plain;charset=utf-8' }));
                })
                .then(function () { geschafft.push(ziel.ordner + '/' + blocksName); })
                .then(function () {
                  return bildNamen.reduce(function (kette, name) {
                    return kette
                      .then(function () {
                        return graph.hochladen(k.kursId, ab.ordner + '/abbildungen', name,
                          new Blob([bilder[name].bytes]));
                      })
                      .then(function () { geschafft.push(ab.ordner + '/abbildungen/' + name); });
                  }, Promise.resolve());
                })
                .then(function () { return { ziel: ziel, blocksName: blocksName, bildzahl: bildNamen.length }; });
            });
          })
          .then(function (ergebnis) {
            var neu = graph.standNachAblage(k, +n);
            var weiter = neu ? graph.standSetzenRoh(k, neu) : Promise.resolve();
            return weiter.then(function () { return ergebnis; });
          })
          .then(function (ergebnis) {
            return graph.ordnerInhalt(k.kursId, ab.ordner).then(function () {
              var bz = ergebnis.bildzahl;
              /* B9-F1: dieselbe Leerung wie im xlsx-/mbz-Pfad oben. */
              state.data.dateiAuswahl = null;
              var erfolgstext = 'Hochgeladen als ' + ergebnis.ziel.datei + ' (+ ' + ergebnis.blocksName +
                ', ' + bz + ' Bild' + (bz === 1 ? '' : 'er') + ')' +
                (hinweise && hinweise.length ? ' — Hinweis: ' + hinweise.join(' · ') : '');
              /* B9-F3: dieselbe persistente Meldung wie im xlsx-/mbz-Pfad oben. */
              state.data.uploadMeldung = { typ: 'ok', text: erfolgstext };
              state.hinweis = erfolgstext;
              controller.render();
            });
          })
          .catch(function (e) {
            var text = 'Nicht hochgeladen. ' + (e.message || e);
            if (geschafft.length) {
              /* I3 (Fixwave 2026-08-04): docx/blocks sind VERSIONIERT
                 (inhalt.hochladeZiel/naechsteVersion) — ein erneuter Versuch
                 legt die naechste Version daneben, er ueberschreibt die
                 unvollstaendige NICHT. Die alte Meldung ("erneutes Hochladen
                 ist sicher, Graph überschreibt deterministisch") galt so nur
                 fuer die Bilder mit ihren festen Dateinamen — fuer docx/
                 blocks war sie falsch und liess eine unvollstaendige
                 Zwischenversion unbemerkt in SharePoint liegen. */
              var unvollstaendig = zielInfo && typeof zielInfo.version === 'number'
                ? ' Die unvollständige v' + zielInfo.version + ' in SharePoint von Hand löschen (Papierkorb).'
                : ' Die unvollständige Fassung in SharePoint von Hand löschen (Papierkorb).';
              text += ' Bereits abgelegt: ' + geschafft.join(', ') + ' — ein erneuter Versuch legt ' +
                'die nächste, vollständige Version daneben, er überschreibt die unvollständige ' +
                'nicht.' + unvollstaendig;
            }
            /* klemmtSichtbar, nicht nur klemmt (Review-Finding 2): Bau-
               fehler, fehlende Vorlage und Upload-Teilfehler landen sonst
               nur im lokalen #hochladefehler-Knoten — ein Zwischen-Render
               kann den aushaengen, bevor die Person ihn liest (Muster
               quelleErfassen-I10, wie bei jedem anderen Abbruch in diesem
               Ablauf). */
            klemmtSichtbar(text);
          });
      }

      if (geprueftPflicht) {
        if (!istXlsx) {
          klemmtSichtbar('Nicht hochgeladen: für diesen Schritt wird eine .xlsx-Datei mit ' +
            'geprüfter Struktur erwartet, gewählt wurde "' + (datei.name || '(ohne Namen)') + '".');
          return;
        }
        if (meld) meld.hidden = true;
        knopf.disabled = true; knopf.textContent = 'wird geprüft …';
        var lesen = (datei.arrayBuffer && typeof datei.arrayBuffer === 'function')
          ? datei.arrayBuffer()
          : Promise.reject(new Error('Diese Datei kann nicht gelesen werden.'));
        lesen
          .then(function (buf) { return root.xlsxLesen.blaetterUndKoepfe(buf); })
          .then(function (blaetter) {
            var befund = root.inhalt.strukturPruefe(blaetter, struktur);
            if (befund && befund.length) {
              klemmtSichtbar('Struktur weicht vom Contract ab — nicht hochgeladen: ' +
                befund.join(' · '));
              return;
            }
            weiterMitUpload();
          })
          .catch(function (e) {
            klemmtSichtbar('Datei nicht lesbar — nicht hochgeladen: ' + (e.message || e));
          });
        return;
      }

      /* Blockdatei-Gate (B5, Etappe 3b) — ersetzt das A2-docx-Gate: seit der
         E5-Revision (Entscheid Markus 2026-08-03) liefert der Chat fuer
         Schritt 3 die BLOCKDATEI (.blocks/.txt) statt der .docx — die App
         baut das Word selbst (weiterMitSkriptBau, s. o.) und legt Word,
         Blockdatei und Abbildungen in einem Vorgang ab. Haengt wie A2 an
         ZWEI Bedingungen (F5-Muster) — Kontrakt-Feld ablage.pruefung ===
         'skript' PLUS der Kontrakt-Endung 'docx' (das GEBAUTE Zielformat
         bleibt docx, nur die UPLOAD-Eingabe hat sich geaendert) —, nicht am
         lokalen Dateinamen allein. Laeuft NACH dem xlsx-Gate, weil beide
         Gates unabhaengig sind (ein Schritt fuehrt in der Praxis nie beide
         Felder zugleich). */
      var geprueftPflichtSkript = !!(ab && ab.pruefung === 'skript') &&
        root.inhalt.erwarteteEndung(inh, n) === 'docx';

      if (geprueftPflichtSkript) {
        /* K2 (Etappe 4): EIN ZIP-Paket statt der fummeligen Mehrfachauswahl —
           additiv, keine zweite Pruefstrecke. Ist die Auswahl genau EINE
           .zip-Datei, wird sie browserseitig entpackt (zipLesen.oeffne); die
           entpackten Eintraege werden zu denselben Pseudo-Datei-Objekten
           { name, text(), arrayBuffer() }, die die BESTEHENDE Klassifikation
           unten ohnehin schon konsumiert — sie laeuft danach unveraendert.
           ZIP + weitere Dateien in derselben Auswahl brechen ab (entweder
           das Paket ODER Einzeldateien, nicht gemischt — sonst waere
           unklar, was zusaetzlich zum Paket noch gelten soll). Die
           Mehrfachauswahl (B5) bleibt als zweiter, gleichwertiger Weg
           bestehen. */
        var zipVorhanden = dateiListe.some(function (d) { return /\.zip$/i.test(d.name || ''); });
        if (zipVorhanden && dateiListe.length > 1) {
          klemmtSichtbar('Nicht hochgeladen: entweder das ZIP-Paket (eine Datei) oder ' +
            'einzelne Dateien — nicht beides in derselben Auswahl.');
          return;
        }
        var istZipPaket = zipVorhanden; /* wegen der Pruefung oben hier immer genau 1 Datei */

        /* Entpackt ein ZIP-Paket zu einer flachen Liste von Pseudo-Dateien.
           Ordnerpfade werden auf den Basisnamen reduziert (split('/').pop())
           — der Chat/ein Zip-Werkzeug darf Unterordner anlegen, die App
           kennt nur flache Dateinamen; kollidieren zwei Pfade auf denselben
           Basisnamen, ist das nicht auflösbar und bricht ab. Andere
           Endungen als .blocks/.txt/.png im Paket brechen ebenfalls ab —
           dieselbe Abweisungsregel wie bei der Mehrfachauswahl, nur schon
           VOR der eigentlichen Klassifikation angewandt. Ein Lesefehler
           (kein Zip-Archiv) traegt das bestehende Wortlaut-Muster "Datei
           nicht lesbar — nicht hochgeladen: …". */
        var zipEntpacken = function (zipDatei) {
          var lesenZip = (zipDatei.arrayBuffer && typeof zipDatei.arrayBuffer === 'function')
            ? zipDatei.arrayBuffer()
            : Promise.reject(new Error('Diese Datei kann nicht gelesen werden.'));
          return lesenZip
            .then(function (buf) { return root.zipLesen.oeffne(buf); })
            .catch(function (e) {
              throw new Error('Datei nicht lesbar — nicht hochgeladen: ' + (e.message || e));
            })
            .then(function (zip) {
              var pfade = Object.keys(zip.eintraege).filter(function (name) { return !/\/$/.test(name); });
              var basisZuPfad = {};
              var doppelt = null;
              pfade.forEach(function (pfad) {
                var basis = pfad.split('/').pop();
                if (!basis) return;
                if (Object.prototype.hasOwnProperty.call(basisZuPfad, basis)) {
                  if (!doppelt) doppelt = [basisZuPfad[basis], pfad];
                } else {
                  basisZuPfad[basis] = pfad;
                }
              });
              if (doppelt) {
                throw new Error('Nicht hochgeladen: ZIP enthält doppelte Dateinamen (nach ' +
                  'Ordner-Reduktion auf den Basisnamen) — "' + doppelt[0] + '" und "' +
                  doppelt[1] + '".');
              }
              var basisNamen = Object.keys(basisZuPfad);
              var unerlaubt = basisNamen.filter(function (b) { return !/\.(blocks|txt|png)$/i.test(b); });
              if (unerlaubt.length) {
                throw new Error('Nicht hochgeladen: ZIP enthält unerwartete Dateiendung(en) — ' +
                  'erlaubt sind nur .blocks/.txt/.png: ' + unerlaubt.join(', ') + '.');
              }
              return basisNamen.map(function (b) {
                var pfad = basisZuPfad[b];
                return {
                  name: b,
                  text: function () { return zip.lies(pfad); },
                  arrayBuffer: function () {
                    return zip.liesBytes(pfad).then(function (bytes) { return bytes.buffer; });
                  }
                };
              });
            });
        };

        var dateienQuelle = istZipPaket ? zipEntpacken(dateiListe[0]) : Promise.resolve(dateiListe);

        dateienQuelle
          .then(function (dateienEffektiv) { pruefeUndBaueBlock(dateienEffektiv); })
          .catch(function (e) {
            klemmtSichtbar(e.message || String(e));
          });
        return;
      }

      /* Erwartete Upload-Dateien im Blockdatei-Gate: genau EINE Blockdatei
         (.blocks/.txt) plus beliebig viele Illustrationen (.png) — nichts
         anderes. Jede unpassende Datei bricht laut ab, kein stiller Bypass
         (F5-Muster: das Gate weist ab statt still durchzulassen).
         dateienEffektiv ist entweder die urspruengliche Mehrfachauswahl
         (B5) oder — seit K2 — die aus einem ZIP-Paket entpackte, flache
         Dateiliste; die Pruefkette selbst kennt den Unterschied nicht. */
      function pruefeUndBaueBlock(dateienEffektiv) {
        var blockKandidaten = dateienEffektiv.filter(function (d) { return /\.(blocks|txt)$/i.test(d.name || ''); });
        var pngKandidaten = dateienEffektiv.filter(function (d) { return /\.png$/i.test(d.name || ''); });
        var unbekannteDateien = dateienEffektiv.filter(function (d) {
          return blockKandidaten.indexOf(d) < 0 && pngKandidaten.indexOf(d) < 0;
        });
        if (unbekannteDateien.length) {
          klemmtSichtbar('Nicht hochgeladen: unbekannte Dateiendung(en) — erwartet werden genau ' +
            'eine Blockdatei (.blocks oder .txt) und beliebig viele Illustrationen (.png): ' +
            unbekannteDateien.map(function (d) { return d.name || '(ohne Namen)'; }).join(', ') + '.');
          return;
        }
        if (blockKandidaten.length !== 1) {
          klemmtSichtbar('Nicht hochgeladen: es wird genau EINE Blockdatei (.blocks oder .txt) ' +
            'erwartet, gewählt wurden ' + blockKandidaten.length + '.');
          return;
        }
        var blockDatei = blockKandidaten[0];

        /* Ohne geladenes Dossier kein Urteil moeglich (blocksPruefe liefert
           dann null) — Abbruch VOR jedem Netzzugriff, kein Datei-Lesen, kein
           graph.ordnerInhalt. state.data.dossier[k.kursId] ist entweder
           undefined (nie angefordert) oder null (laedt gerade) oder ein
           Objekt (geladen) — nur Letzteres reicht. */
        var dSkript = state.data.dossier[k.kursId];
        if (!dSkript || typeof dSkript !== 'object') {
          klemmtSichtbar('Nicht hochgeladen: Prüfung braucht das Dossier — zuerst Schritt 1 ' +
            'abschliessen (Briefing), dann erneut versuchen.');
          return;
        }

        if (meld) meld.hidden = true;
        knopf.disabled = true; knopf.textContent = 'wird geprüft …';

        var lesenBlock = (blockDatei.text && typeof blockDatei.text === 'function')
          ? blockDatei.text()
          : Promise.reject(new Error('Diese Datei kann nicht gelesen werden.'));

        /* Fix-Runde 1 (Review-Finding, Critical): der Blocktext wird hier
           gemerkt und NICHT das rohe blockDatei-Objekt weitergereicht —
           beim ZIP-Weg (K2) ist das nur ein Pseudo-Objekt {name, text(),
           arrayBuffer()} ohne .size/.slice, kein echtes Blob. graph.hochladen
           braucht aber ein Blob (datenBlob.size fuer PUT-vs-Chunk,
           datenBlob.slice() je Chunk) — ein rohes Pseudo-Objekt crasht dort
           NACH einem bereits gelungenen docx-Upload (TypeError im
           Chunk-Pfad), die unvollstaendige _vN bleibt liegen. Der bereits
           gelesene Text wird deshalb unten (weiterMitSkriptBau) zu
           `new Blob([blockText], {...})` — Muster `new Blob([docxBytes])`
           direkt daneben, fuer BEIDE Wege (Einzelauswahl UND ZIP)
           gleichermassen korrekt, weil beide ohnehin schon hier den Text
           lesen, nie das Original-Objekt selbst hochladen. */
        var blockText;

        lesenBlock
          .then(function (text) { blockText = text; return root.skriptLesen.lies(text); })
          .then(function (gelesen) {
            /* Pruefkette (Task-Brief): skriptLesen.lies() wirft bei
               ###SKRIPT fehlt — s. .catch unten. fehler[] nicht leer bricht
               HIER ab, MIT der Liste — blocksPruefe() wird gar nicht erst
               gerufen (Pflichtbausteine je Kapitel sind darin schon
               enthalten, s. inhalt.blocksPruefe-Kommentarkopf). */
            if (gelesen.fehler && gelesen.fehler.length) {
              klemmtSichtbar('Blockdatei weicht vom Schema ab — nicht hochgeladen: ' +
                gelesen.fehler.join(' · '));
              return;
            }
            /* Kurs-ID-Sicherheitsnetz (Review-Finding 3) — dasselbe Muster
               wie der Varianten-Guard direkt darunter: kein stilles
               Bevorzugen. Ohne diesen Vergleich wuerde die Blockdatei eines
               FREMDEN Kurses klaglos in diesen Kurs gebaut und abgelegt —
               mit falschem Bildnamens-Praefix (docxBauen.bildDateiname nimmt
               gelesen.skript.kurs, nicht k.kursId) und am falschen Ort in
               SharePoint. Laeuft VOR jedem Bau/Netzzugriff. */
            var blockKurs = gelesen.skript && gelesen.skript.kurs;
            if (blockKurs && blockKurs !== k.kursId) {
              klemmtSichtbar('Nicht hochgeladen: die Blockdatei gehört zu Kurs "' + blockKurs +
                '", diese Seite zu "' + k.kursId + '" — falscher Kurs, nicht angleichbar.');
              return;
            }
            /* Widerspruch UI-Variantenwahl vs. Blockdatei-Variante — kein
               stilles Bevorzugen (Muster "Varianten", CLAUDE.md). */
            var blockVariante = gelesen.skript && gelesen.skript.variante;
            if (gewaehlt && blockVariante && blockVariante !== gewaehlt) {
              klemmtSichtbar('Nicht hochgeladen: die Blockdatei nennt Variante "' + blockVariante +
                '", ausgewählt ist "' + gewaehlt + '" — Variante zuerst angleichen.');
              return;
            }
            var befund = root.inhalt.blocksPruefe(gelesen, dSkript);
            if (!befund) {
              klemmtSichtbar('Nicht hochgeladen: Prüfung braucht das Dossier.');
              return;
            }
            if (befund.fehler.length) {
              klemmtSichtbar('Blockdatei weicht vom Kontrakt ab — nicht hochgeladen: ' +
                befund.fehler.join(' · '));
              return;
            }
            /* Referenzierte Illustrationen muessen im selben Upload liegen
               (B6, tolerant gegenueber einer ILLUSTRATION ohne datei:-Feld
               — s. inhalt.illustrationenFehlend). */
            var pngNamen = pngKandidaten.map(function (p) { return p.name; });
            var fehlendeIllustrationen = root.inhalt.illustrationenFehlend(gelesen, pngNamen);
            if (fehlendeIllustrationen.length) {
              klemmtSichtbar('Nicht hochgeladen: referenzierte Illustration(en) fehlen im Upload ' +
                '— ' + fehlendeIllustrationen.join(', ') + '.');
              return;
            }

            weiterMitSkriptBau(gelesen, befund.hinweise, blockText, pngKandidaten);
          })
          .catch(function (e) {
            klemmtSichtbar('Blockdatei nicht lesbar — nicht hochgeladen: ' + (e.message || e));
          });
      }

      weiterMitUpload();
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

  /* K1 (Etappe 4): der Download der Projekt-Wissen-Datei ist ein reiner
     Client-Vorgang — kein Graph-Schreiben, die Datei landet nicht in
     SharePoint. Muster: Blob → Objekt-URL → unsichtbarer <a download> →
     Klick → Aufraeumen (revokeObjectURL). Fehlt document/URL/Blob (Node,
     Tests ohne DOM), tut die Funktion nichts — derselbe Rueckfall wie
     diagrammZeichnen.png() fuer Nicht-Browser-Umgebungen. */
  function herunterladenDatei(name, text) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' ||
        !URL.createObjectURL || typeof Blob === 'undefined') return;
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('input', function (e) {
      if (e.target && e.target.dataset && e.target.dataset.feld) controller.briefingFelderZaehlen();
      if (e.target && e.target.name === 'content-modus') controller.contentModus(e.target);
    });

    /* B9-F1: change statt input — ein Datei-Input feuert kein input, nur change. */
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'datei') controller.dateiGewaehlt(e.target);
    });

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
      if (a === 'hochladen') { controller.hochladen(t.dataset.schritt, t); return; }
      if (a === 'variante')  { controller.zu({ variante: t.dataset.variante }); return; }
      if (a === 'weg')       { controller.zu({ weg: t.dataset.weg }); return; }
      if (a === 'ablage-anlegen')     { controller.ablageAnlegen(t); return; }
      if (a === 'briefing-felder-speichern') { controller.dossierSpeichern(t); return; }
      if (a === 'quelle-erfassen') { controller.quelleErfassen(t); return; }
      if (a === 'quelle-entfernen') { controller.quelleEntfernen(t); return; }
      if (a === 'offen-erfassen') { controller.offenErfassen(t); return; }
      if (a === 'offen-entscheiden') { controller.offenEntscheiden(t); return; }
      if (a === 'offen-verschieben') { controller.offenVerschieben(t); return; }
      if (a === 'gate-klick') { controller.gateKlick(t.dataset.schritt, t); return; }

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
        var text2 = aktiv ? aktiv.textContent : (w.claude || w.chatgpt || '');
        /* In Schritt 1 gehen die ausgefuellten Leitplanken mit. Genau dafuer ist das
           Formular da: was hier mitkommt, muss der Chat nicht mehr erfragen. Gelesen
           wird aus dem Formular, nicht aus dem Zustand — sonst fehlt, was gerade
           getippt und noch nicht gesichert wurde. */
        if (String(state.position.schrittId) === '1' && w.type === 'prompt') {
          var kurs2 = nav.kurs();
          /* Basis ist der Dossier-Scope/regulatorik (gesichert); Formularwerte
             ueberschreiben ihn — wer tippt und sofort kopiert, bekommt, was er sieht.
             kurs2 kann null sein (Kurs nicht mehr in KWKurse) — briefingPromptKopf
             toleriert das mit '?', der Zugriff aufs Dossier davor nicht (M-1).
             Die Merge-Regel selbst steht in controller._formularWerteMergen().
             d2 geht zusaetzlich unveraendert an briefingPromptKopf mit (Etappe 1e,
             Task 5): die Quellenliste im Prompt-Kopf ist Erb-Quelle Dossier, nie
             formular-editierbar — sie kommt aus d2.quellen, nicht aus werte. */
          var d2 = kurs2 ? (state.data.dossier[kurs2.kursId] || null) : null;
          var basis = kurs2 ? root.inhalt.briefingWerteAusDossier(d2) : {};
          var form = controller.briefingFelderAusFormular();
          var werte = controller._formularWerteMergen(basis, form);
          text2 = root.inhalt.briefingPromptKopf(kurs2, werte, d2) + text2;
        }
        /* Schritt 2 (Etappe 2, Task 3): Titel/Kompetenzfeld/Rechtsstand/Quellen
           kommen ausschliesslich aus dem geladenen Dossier — anders als in
           Schritt 1 gibt es hier keine eigenen Formularfelder, die den Kopf
           speisen koennten. Kein Dossier (noch nicht geladen oder Kurs ohne
           Kursordner) heisst: kein Kopf, lernzielePromptKopf liefert dann ''. */
        if (String(state.position.schrittId) === '2' && w.type === 'prompt') {
          var kurs3 = nav.kurs();
          var d3 = kurs3 ? state.data.dossier[kurs3.kursId] : null;
          if (d3 && typeof d3 === 'object') {
            /* T13 (VL-002-Fund, 2026-07-30): der Chat fragte im Live-Einsatz nach
               dem Briefing-Dateinamen und setzte version=1, obwohl v1-v5 im
               Ordner lagen — beides weiss die App bereits aus den beiden
               dateien-Caches, die die Schritt-2-Ansicht ohnehin laedt
               (ordnerNachladen fuer den Schritt-2-Ordner, briefingNachladen fuer
               01_briefing/, s. controller.render()). Beide Werte werden hier aus
               dem Cache berechnet, ueber dieselben Funktionen wie ueberall sonst
               (inhalt.naechsteVersion/geltendeDatei) — kein zweiter Rechenweg.
               Fehlt ein Cache (kein Array — noch nicht geladen oder Ordner nicht
               gefunden), bleibt das jeweilige Feld in extras3 weg: der Kopf
               bleibt gueltig, rät aber nichts (inhalt.lernzielePromptKopf laesst
               ein fehlendes Feld dann ebenfalls weg). */
            var inh3 = state.data.inhalt;
            var extras3 = {};
            var ab2 = root.inhalt.ablageVon(inh3, '2', kurs3.kursId);
            var lief2 = ab2 ? root.inhalt.lieferobjektVon(inh3, '2') : null;
            var dateien2 = ab2 ? state.data.dateien[kurs3.kursId + '/' + ab2.ordner] : undefined;
            if (lief2 && Array.isArray(dateien2)) {
              extras3.version = root.inhalt.naechsteVersion(dateien2, kurs3.kursId, lief2);
            }
            var e1 = ((inh3['ablage-kontrakt'] || {}).schritte || {})['1'] || {};
            var ordner1 = e1.ordner || '01_briefing';
            var lief1 = e1.lieferobjekt || 'briefing';
            var dateien1 = state.data.dateien[kurs3.kursId + '/' + ordner1];
            if (Array.isArray(dateien1)) {
              var basiertAuf3 = root.inhalt.geltendeDatei(dateien1, kurs3.kursId, lief1);
              if (basiertAuf3) extras3.basiertAuf = basiertAuf3;
            }
            text2 = root.inhalt.lernzielePromptKopf(kurs3, d3, extras3) + text2;
          }
        }
        /* Schritt 3 (A3, Etappe 3): Titel/Kompetenzfeld/Rechtsstand/Quellen aus
           dem Dossier wie Schritt 2 — zusaetzlich Variante, Version,
           basiert_auf (der GESETZTE Contract-Stand aus Schritt 2) und der
           Zielname der .docx, damit der Chat sie direkt liefert (E5), statt
           nachzufragen. T13-Muster: jedes Extra kommt aus einem bereits
           geladenen Cache (ordnerNachladen fuer 03_content UND — seit diesem
           Task — fuer den Schritt-2-Ordner, s. controller.render()), nichts
           wird geraten. basiertAuf nur, wenn der Contract wirklich final ist
           (finalVorhanden) — sonst bleibt das Feld weg, der Kaltstart-Kasten
           in der Ansicht warnt ohnehin schon. */
        if (String(state.position.schrittId) === '3' && w.type === 'prompt') {
          var kurs4 = nav.kurs();
          var d4 = kurs4 ? state.data.dossier[kurs4.kursId] : null;
          if (d4 && typeof d4 === 'object') {
            var inh4 = state.data.inhalt;
            var extras4 = {};
            var variante4 = root.inhalt.gewaehlteVariante(inh4, '3', state.position.variante);
            if (variante4) extras4.variante = variante4;
            /* Der Zielname haengt an der gewaehlten Variante — ablageVon UND
               hochladeZiel bekommen sie deshalb explizit mit. */
            var ab3 = root.inhalt.ablageVon(inh4, '3', kurs4.kursId, variante4);
            if (ab3 && ab3.lieferobjekt) {
              var dateien3 = state.data.dateien[kurs4.kursId + '/' + ab3.ordner];
              if (Array.isArray(dateien3)) {
                extras4.version = root.inhalt.naechsteVersion(dateien3, kurs4.kursId, ab3.lieferobjekt);
                /* B6/E5-Revision: der Chat liefert seit Etappe 3b keine .docx
                   mehr, sondern die BLOCKDATEI — die App baut das Word selbst
                   (docxBauen). hochladeZiel() liefert weiterhin den
                   GEBAUTEN docx-Namen (das bleibt das Ziel-Ablageformat,
                   s. inhalt.erwarteteEndung); der im Prompt-Kopf genannte
                   Zielname ist derselbe Stamm mit .blocks-Endung — kein
                   zweiter Rechenweg, nur die Endung getauscht. */
                var ziel4 = root.inhalt.hochladeZiel(inh4, '3', kurs4.kursId, dateien3, variante4);
                if (ziel4) extras4.zielname = ziel4.datei.replace(/\.[a-z0-9]+$/i, '.blocks');
              }
            }
            var ab2Fuer3 = root.inhalt.ablageVon(inh4, '2', kurs4.kursId);
            if (ab2Fuer3 && ab2Fuer3.lieferobjekt) {
              var dateien2Fuer3 = state.data.dateien[kurs4.kursId + '/' + ab2Fuer3.ordner];
              if (Array.isArray(dateien2Fuer3) &&
                  root.inhalt.finalVorhanden(dateien2Fuer3, kurs4.kursId, ab2Fuer3.lieferobjekt)) {
                extras4.basiertAuf = root.inhalt.geltendeDatei(dateien2Fuer3, kurs4.kursId, ab2Fuer3.lieferobjekt);
              }
            }
            text2 = root.inhalt.skriptPromptKopf(kurs4, d4, extras4) + text2;
          }
        }
        kopieren(text2, t);
        return;
      }
      if (a === 'kopieren-instruktionen') {
        /* Die sichtbare Fassung kopieren, nicht immer die erste. */
        var karte3 = t.closest('.wtool');
        var sicht = karte3 && karte3.querySelector('.prompt.on');
        if (sicht) kopieren(sicht.textContent, t);
        return;
      }
      if (a === 'instruktionen-herunterladen') {
        /* K1: dieselben Werte, aus denen ansichten.instruktionenBlock die
           Ansicht baut (s. controller.render(), Schritt-1-Zweig) — kein
           zweiter Rechenweg fuer Briefing/Dossier/Ordnername. Kein
           Graph-Zugriff, reiner Client-Download. */
        var kursDL = nav.kurs();
        if (!kursDL) return;
        var inhDL = state.data.inhalt;
        var briefingDL = state.data.briefing[kursDL.kursId];
        var dossierDL = state.data.dossier[kursDL.kursId];
        var ordnDL = state.data.ordner[kursDL.kursId];
        var langtext = root.inhalt.projektInstruktionenLang(inhDL, kursDL, briefingDL,
          ordnDL ? ordnDL.name : null,
          (dossierDL && typeof dossierDL === 'object') ? dossierDL : null);
        herunterladenDatei(root.inhalt.projektWissenDateiname(kursDL), langtext);
        return;
      }
      if (a === 'fassung') {
        var box = t.closest('.wtool');
        Array.prototype.forEach.call(box.querySelectorAll('.ptab'), function (x) {
          x.classList.toggle('on', x === t);
        });
        /* .prompt (der Text selbst) UND .fassbox (K1-Meta-Block: Zeichenzahl,
           Achtung-Kasten, Download-Knopf) haengen am selben data-box-Attribut
           und werden vom selben Umschalter mitgeschaltet — Fix-Runde 1,
           Review-Finding: der Meta-Block war vorher immer sichtbar. */
        Array.prototype.forEach.call(box.querySelectorAll('.prompt, .fassbox'), function (x) {
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
