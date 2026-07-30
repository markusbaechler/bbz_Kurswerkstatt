const test = require('node:test');
const assert = require('node:assert');

const { controller } = require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { dossier } = require('../dossier.js');
const { INHALT, KURSE } = require('./fixture.js');

const DBS = KURSE[0];

const VOLL = {
  zielgruppe: 'Kunden- und Anlageberatende',
  vorkenntnisse: 'Risikoprofilierung, Anlageklassen',
  kurszweck: 'Derivate kundengerecht erlaeutern',
  praesenz: '1',
  selbstlern: '2',
  scope: 'SSPA Swiss Derivative Map 2025',
  reg_zusatz: 'Rezertifizierung IK, Affluent',
  rechtsstand: '1.1.2026',
  saq_rezert: 'true',
  ausschluesse: 'Keine Optionsbewertung',
  scope_quelle: 'Kursausschreibung, Stand 2026-06'
};

/* ---------- Felddefinition ---------- */

test('die Felder sind die acht generischen plus Scope-Quelle, Rechtsstand und SAQ-Haekchen', () => {
  const ids = inhalt.BRIEFING_FELDER.map(f => f.id);
  assert.deepStrictEqual(ids, ['zielgruppe', 'vorkenntnisse', 'kurszweck', 'praesenz',
    'selbstlern', 'scope', 'reg_zusatz', 'rechtsstand', 'saq_rezert', 'ausschluesse', 'scope_quelle']);
});

/* ---------- Etappe 1e, Task 6: regulatorik statt scope ---------- */

test('reg_zusatz, Rechtsstand und SAQ-Haekchen gehen an regulatorik, nicht an scope', () => {
  ['reg_zusatz', 'rechtsstand', 'saq_rezert'].forEach(id => {
    assert.strictEqual(inhalt.briefingFeld(id).ziel, 'regulatorik', id + ' hat kein ziel:regulatorik');
  });
});

test('Rechtsstand ist Pflicht, SAQ-Rezertifizierung ist ein Haekchen und optional', () => {
  const stand = inhalt.briefingFeld('rechtsstand');
  assert.strictEqual(stand.pflicht, true);
  assert.strictEqual(stand.form, 'text');
  const saq = inhalt.briefingFeld('saq_rezert');
  assert.strictEqual(saq.pflicht, false, 'governance-minimal: genau EIN neues Pflichtfeld, das Haekchen ist es nicht');
  assert.strictEqual(saq.form, 'haken');
});

test('Praesenz zaehlt in Tagen, Selbstlern in Stunden', () => {
  assert.strictEqual(inhalt.briefingFeld('praesenz').einheit, 'Tage');
  assert.strictEqual(inhalt.briefingFeld('selbstlern').einheit, 'Stunden');
});

test('die Hilfe zur Scope-Quelle verweist auf die erfassten Fachquellen (Etappe 1d)', () => {
  const f = inhalt.briefingFeld('scope_quelle');
  assert.match(f.hilfe, /Q-001/, 'kein Verweis auf die Q-IDs der Fachquellen');
});

test('der Rechtsrahmen steht fest und wird nicht erfragt', () => {
  const f = inhalt.briefingFeld('reg_zusatz');
  assert.ok(f.fest, 'kein fester Rahmen hinterlegt');
  assert.match(f.fest, /FIDLEG/);
  assert.strictEqual(f.pflicht, false, 'Zusaetze duerfen leer bleiben');
});

/* ---------- Datei ---------- */

test('Schreiben und Lesen ergibt dieselben Werte', () => {
  const zurueck = inhalt.briefingFelderLesen(inhalt.briefingFelderText('DBS-001', VOLL));
  inhalt.BRIEFING_FELDER.forEach(f => {
    assert.strictEqual(zurueck[f.id], VOLL[f.id], 'Feld ' + f.id);
  });
});

test('der feste Rahmen steht in der Datei, kommt aber nicht als Wert zurueck', () => {
  const t = inhalt.briefingFelderText('DBS-001', VOLL);
  assert.ok(t.indexOf('FIDLEG') >= 0, 'fester Rahmen fehlt in der Datei');
  const z = inhalt.briefingFelderLesen(t);
  assert.strictEqual(z.reg_zusatz, 'Rezertifizierung IK, Affluent',
    'der feste Rahmen ist faelschlich in den Zusatz gewandert');
});

test('leere Felder werden als [OFFEN] geschrieben und als leer gelesen', () => {
  const t = inhalt.briefingFelderText('DBS-001', { zielgruppe: 'nur dieses' });
  assert.ok(t.indexOf('[OFFEN]') >= 0);
  assert.strictEqual(inhalt.briefingFelderLesen(t).kurszweck, '');
});

test('eine fremde Datei wirft nicht, sie ergibt nur keine Werte', () => {
  assert.deepStrictEqual(inhalt.briefingFelderLesen('irgendein Text ohne Abschnitte'), {});
  assert.deepStrictEqual(inhalt.briefingFelderLesen(null), {});
});

/* ---------- Vollstaendigkeit ---------- */

test('fehlende Pflichtfelder werden beim Namen genannt', () => {
  const f = inhalt.briefingFehlend({ zielgruppe: 'da' });
  assert.ok(f.length > 0);
  assert.ok(!f.includes('Zielgruppe'), 'gefuelltes Feld wird als fehlend gemeldet');
  assert.ok(!f.some(x => /Zusaetze/.test(x)), 'optionales Feld wird als fehlend gemeldet');
});

test('vollstaendig ausgefuellt meldet nichts mehr', () => {
  assert.deepStrictEqual(inhalt.briefingFehlend(VOLL), []);
});

/* ---------- Einspeisung in den Prompt ----------
   Der eigentliche Zweck: was hier mitgeht, fragt der Chat nicht mehr. */

test('der Promptkopf traegt jeden ausgefuellten Wert', () => {
  const k = inhalt.briefingPromptKopf(DBS, VOLL);
  Object.keys(VOLL).forEach(id => {
    assert.ok(k.indexOf(VOLL[id]) >= 0, 'Wert fehlt im Promptkopf: ' + id);
  });
  assert.ok(k.indexOf('FIDLEG') >= 0, 'der feste Rahmen geht nicht mit');
});

test('der Promptkopf verbietet das erneute Abfragen', () => {
  const k = inhalt.briefingPromptKopf(DBS, VOLL);
  assert.match(k, /NICHT erneut ab/);
});

test('leere Felder werden benannt und der Auftrag bleibt: fragen, dann schreiben', () => {
  const k = inhalt.briefingPromptKopf(DBS, { zielgruppe: 'da' });
  assert.match(k, /NICHT ANGEGEBEN/);
  assert.ok(k.indexOf('Kurszweck') >= 0, 'offenes Feld nicht benannt');
  assert.match(k, /höchstens drei Zeilen/, 'keine Obergrenze fuer die Rueckfragen');
  assert.match(k, /auf die Antwort das Briefing/, 'kein Auftrag zu schreiben');
});

/* Der Kern der zweiten Fassung (29.07.): sind die Felder voll, wird geschrieben —
   nicht gefragt. Die erste Fassung erzeugte hier fuenf Fragerunden. */
test('bei vollstaendigen Angaben lautet der Auftrag: schreiben, nicht fragen', () => {
  const k = inhalt.briefingPromptKopf(DBS, VOLL);
  assert.ok(k.indexOf('NICHT ANGEGEBEN') < 0, 'meldet offene Felder, obwohl keine offen sind');
  assert.match(k, /Schreibe jetzt das Briefing/);
  assert.match(k, /Keine Rückfrage/);
  assert.ok(k.indexOf('Entscheidliste') < 0, 'laedt weiterhin zum Fragensammeln ein');
});

/* ---------- Erb-Quelle Dossier im Promptkopf (Etappe 1e, Task 5, Audit A/F1/M4) ----------
   Die Quellenliste ist nie formular-editierbar — sie kommt ausschliesslich aus dem
   Dossier, nie aus werte. Der Rechtsstand bleibt ein Formularfeld (werte.rechtsstand);
   hier kommt nur die zusaetzliche Bauanweisung fuers YAML-Feld dazu. */

test('mit Dateiquelle steht die Q-Liste im Kopf, mit dem GENAU-Satz', () => {
  const d = { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
              regulatorik: { stand: '1.1.2026' },
              quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025',
                          datei: 'sspa-map-2025.pdf' }],
              status: {}, offen: [], entschieden: [] };
  const k = inhalt.briefingPromptKopf(DBS, VOLL, d);
  assert.match(k, /FACHQUELLEN \(verbindlich — das YAML-Feld 'quellen' des Briefings ist GENAU diese Liste, nichts anderes\):/);
  assert.match(k, /- Q-001 · SSPA Map \(SSPA\) · Stand: 2025 · Datei: sspa-map-2025\.pdf/);
});

test('mit Link-Quelle stehen Link und Abrufdatum in der Q-Liste, keine Datei-Zeile', () => {
  const d = { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
              regulatorik: {},
              quellen: [{ id: 'Q-001', titel: 'Ausschreibung', herausgeber: 'SSPA', stand: '2026',
                          url: 'https://sspa.ch/ausschreibung', abgerufen: '2026-07-30' }],
              status: {}, offen: [], entschieden: [] };
  const k = inhalt.briefingPromptKopf(DBS, VOLL, d);
  assert.match(k, /- Q-001 · Ausschreibung \(SSPA\) · Stand: 2026 · Link: https:\/\/sspa\.ch\/ausschreibung \(abgerufen 2026-07-30\)/);
  assert.doesNotMatch(k, /Q-001[^\n]*Datei:/);
});

test('ohne erfasste Quellen im Modus quellengestuetzt: der Leer-Satz, kein Erfinden', () => {
  const d = { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
              regulatorik: {}, quellen: [], status: {}, offen: [], entschieden: [] };
  const k = inhalt.briefingPromptKopf(DBS, VOLL, d);
  assert.match(k, /FACHQUELLEN: noch keine erfasst — das YAML-Feld 'quellen' bleibt leer; erfinde keine\./);
});

test('im Modus quellenfrei steht der Quellenfrei-Satz, auch wenn Quellen vorhanden waeren', () => {
  const d = { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellenfrei',
              regulatorik: {},
              quellen: [{ id: 'Q-001', titel: 'Irrelevant', stand: '2025', datei: 'x.pdf' }],
              status: {}, offen: [], entschieden: [] };
  const k = inhalt.briefingPromptKopf(DBS, VOLL, d);
  assert.match(k, /MODUS QUELLENFREI: reiner KI-Entwurf ohne Fachquellen — das YAML-Feld 'quellen' bleibt leer; erfinde keine\./);
  assert.ok(k.indexOf('Q-001') < 0, 'quellenfrei traegt trotzdem eine Quelle mit');
});

test('die Rechtsstand-Bauanweisung fuers YAML-Feld steht, sobald ein Dossier mitgeht', () => {
  const d = { dossier: 1, kurs: 'DBS-001', scope: {}, content_modus: 'quellengestuetzt',
              regulatorik: { stand: '1.1.2026' }, quellen: [], status: {}, offen: [], entschieden: [] };
  const k = inhalt.briefingPromptKopf(DBS, VOLL, d);
  assert.match(k, /Das YAML-Feld 'rechtsstand' ist GENAU aus der Angabe/);
});

test('ohne drittes Argument bleibt der Promptkopf exakt wie bisher — kein Quellen-Teil', () => {
  const k = inhalt.briefingPromptKopf(DBS, VOLL);
  assert.doesNotMatch(k, /FACHQUELLEN/);
  assert.doesNotMatch(k, /YAML-Feld/);
});

test('ein getippter Rechtsstand im Formular gewinnt gegen die Dossier-Basis (Merge-Vorrang)', () => {
  const d = dossier.ausWerten('DBS-001', { rechtsstand: '1.1.2025' }, null, null, inhalt.BRIEFING_FELDER);
  const basis = inhalt.briefingWerteAusDossier(d);
  const werte = controller._formularWerteMergen(basis, { rechtsstand: '1.6.2026' });
  assert.strictEqual(werte.rechtsstand, '1.6.2026', 'der getippte Wert haette gewinnen muessen');
  const k = inhalt.briefingPromptKopf(DBS, werte, d);
  assert.match(k, /Rechtsstand: 1\.6\.2026/);
  assert.ok(k.indexOf('1.1.2025') < 0, 'die alte Dossier-Basis steht faelschlich noch im Kopf');
});

/* Mutationsprobe fuer den GENAU-Satz: 'GENAU diese Liste' aus dem Quellen-Block entfernt
   (durchgefuehrt) — der erste Test dieses Abschnitts wurde rot, weil der Regex dann nicht
   mehr traf. Danach wiederhergestellt. Haelt fest, dass der Test wirklich den Wortlaut
   prueft, nicht nur "irgendein FACHQUELLEN". */

/* ---------- Ansicht ---------- */

test('Schritt 1 zeigt das Formular, andere Schritte nicht', () => {
  const eins = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.ok(/id="briefing-felder"/.test(eins), 'kein Formular in Schritt 1');
  inhalt.BRIEFING_FELDER.forEach(f => {
    assert.ok(eins.indexOf('data-feld="' + f.id + '"') >= 0, 'Feld fehlt: ' + f.id);
  });
  const drei = ansichten.einSchritt(INHALT, DBS, 3, null, {});
  assert.ok(!/id="briefing-felder"/.test(drei), 'Formular auch in Schritt 3');
});

test('gesicherte Werte stehen wieder in den Feldern', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: VOLL });
  assert.ok(h.indexOf('SSPA Swiss Derivative Map 2025') >= 0, 'Wert nicht wieder eingesetzt');
});

test('Praesenz und Selbstlern sind Zahlenfelder mit ihrer Einheit', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.match(h, /type="number"[^>]*data-feld="praesenz"/);
  assert.ok(h.indexOf('(Tage)') >= 0 && h.indexOf('(Stunden)') >= 0, 'Einheit fehlt');
});

test('das Formular meldet, wie viel noch offen ist', () => {
  const leer = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.match(leer, /9 offen/, 'neun Pflichtfelder seit Rechtsstand (Etappe 1e Task 6)');
  const voll = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: VOLL });
  assert.ok(voll.indexOf('vollst&auml;ndig') >= 0, 'kein Vollstaendig-Vermerk');
});

/* ---------- Das SAQ-Haekchen (Etappe 1e, Task 6) ---------- */

test('das SAQ-Haekchen rendert als Checkbox, nicht als Textfeld', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.match(h, /type="checkbox"[^>]*data-feld="saq_rezert"/);
});

test('ein leeres Formular haengt kein "offen" ans SAQ-Haekchen, obwohl es optional ist', () => {
  /* Kein Widerspruch pruefbar, wenn saq_rezert eh nie Pflicht ist — die
     eigentliche Absicherung ist der Test "Rechtsstand ist Pflicht ..." oben:
     das Haekchen bleibt pflicht:false. Hier nur die Gegenprobe am Rendering:
     kein Pflicht-Stern/-Klasse am Haekchen-Feld. */
  const h = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  const stelle = h.slice(h.indexOf('data-feld="saq_rezert"') - 400, h.indexOf('data-feld="saq_rezert"'));
  assert.ok(!/class="feld offen"/.test(stelle), 'SAQ-Haekchen faelschlich als offen markiert');
});

test('ein gesetztes SAQ-Haekchen kommt als checked zurueck', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null,
    { briefingFelder: Object.assign({}, VOLL, { saq_rezert: 'true' }) });
  assert.match(h, /data-feld="saq_rezert"\s+checked/);
});

test('Rechtsstand rendert als Pflichtfeld mit Beispiel', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null, { briefingFelder: {} });
  assert.ok(h.indexOf('data-feld="rechtsstand"') >= 0, 'Rechtsstand-Feld fehlt');
  assert.ok(h.indexOf('1.1.2026') >= 0, 'Beispiel fehlt');
});

/* ---------- inhalt.briefingWerteAusDossier() — die Ruecklesung zu dossier.ausWerten() ----------
   EINE Zuordnung (ziel/speicherName), in beide Richtungen benutzt: dossier.ausWerten()
   schreibt danach, briefingWerteAusDossier() liest danach. Ein Schreib-Lese-Kreis
   ueber echte dossier.js-Funktionen ist der ehrlichste Beweis, dass beide Seiten
   noch zusammenpassen. */
test('briefingWerteAusDossier() liest scope UND regulatorik wieder in ein flaches Formular-Objekt', () => {
  const d = dossier.ausWerten('DBS-001', {
    zielgruppe: 'Berater', reg_zusatz: 'Rezert IK', rechtsstand: '1.1.2026', saq_rezert: true
  }, null, null, inhalt.BRIEFING_FELDER);

  const werte = inhalt.briefingWerteAusDossier(d);

  assert.strictEqual(werte.zielgruppe, 'Berater', 'scope-Feld nicht zurueckgelesen');
  assert.strictEqual(werte.reg_zusatz, 'Rezert IK', 'regulatorik.zusatz nicht ueber speicherName zurueckgelesen');
  assert.strictEqual(werte.rechtsstand, '1.1.2026', 'regulatorik.stand nicht ueber speicherName zurueckgelesen');
  assert.strictEqual(werte.saq_rezert, 'true', 'Haken-Feld kommt nicht als String true/false zurueck');
});

test('briefingWerteAusDossier() ohne Dossier ergibt ein leeres Formular, kein Crash', () => {
  const werte = inhalt.briefingWerteAusDossier(null);
  assert.strictEqual(werte.zielgruppe, undefined);
  assert.strictEqual(werte.saq_rezert, 'false', 'ein fehlendes Haken-Feld muss dennoch false sein, nie undefined');
});

/* ---------- Fix-Runde 1, C-1: controller._formularWerteMergen() ----------
   Vorher inline im "kopieren"-Click-Handler: `if (String(form[k] || '').trim())`
   verwarf ein explizites false schon am `|| ''` (false ist falsy, wird durch ''
   ersetzt, bleibt '' nach trim()) — ein sichtbar abgehaktes, aber auf false
   gesetztes SAQ-Haekchen liess den alten, aus der Basis kopierten Wert (z. B.
   true) unangetastet, der Prompt behauptete dann das Gegenteil von dem, was im
   Formular stand. Ausgelagert in eine eigene, DOM-freie Funktion, damit genau
   das direkt testbar ist. */

test('C-1: _formularWerteMergen uebernimmt ein explizites false aus dem Formular, nicht den alten Basis-Wert', () => {
  const werte = controller._formularWerteMergen(
    { saq_rezert: 'true', zielgruppe: 'Alte Zielgruppe' },
    { saq_rezert: false, zielgruppe: '' }
  );
  assert.strictEqual(werte.saq_rezert, false, 'ein explizites false wurde verworfen — Basis (true) gewann faelschlich');
  assert.strictEqual(werte.zielgruppe, 'Alte Zielgruppe', 'ein leeres Textfeld hat faelschlich die Basis ueberschrieben');
});

test('C-1 Gegenprobe: ein explizites true aus dem Formular gewinnt ebenso gegen eine Basis von false', () => {
  const werte = controller._formularWerteMergen({ saq_rezert: 'false' }, { saq_rezert: true });
  assert.strictEqual(werte.saq_rezert, true);
});

test('C-1: ein getipptes, nicht-leeres Textfeld ueberschreibt die Basis weiterhin (unveraendertes Verhalten)', () => {
  const werte = controller._formularWerteMergen({ zielgruppe: 'Alt' }, { zielgruppe: 'Neu' });
  assert.strictEqual(werte.zielgruppe, 'Neu');
});

test('C-1: ohne form-Wert (leer) bleibt die Basis stehen', () => {
  const werte = controller._formularWerteMergen({ zielgruppe: 'Alt' }, { zielgruppe: '' });
  assert.strictEqual(werte.zielgruppe, 'Alt');
});

/* Mutationsprobe (durchgefuehrt, Fix-Runde 1): den Bool-Zweig in _formularWerteMergen
   entfernt (`if (typeof v === 'boolean' || String(v || '').trim())` zurueck auf
   `if (String(v || '').trim())`) — `node --test` wurde rot an genau dem ersten Test
   dieses Abschnitts (explizites false wird verworfen); die Gegenprobe mit true blieb
   gruen, weil true ohnehin ueber `String(true)` = 'true' (nicht-leer) durchkam — das
   war ja schon vorher der asymmetrische Fehler: true ueberlebte, false nicht. Danach
   wiederhergestellt, wieder 437/437 gruen. */

/* ---------- Fix-Runde 1, M-1: briefingFelderZaehlen behandelt ein Haekchen nie als offen ----------
   Dieselbe Frage wie in inhalt.briefingFehlend() (Task 6) und der ansichten.js-Renderer —
   hier an einer dritten Stelle beantwortet, weil sie am lebendigen DOM-Element haengt statt
   am Formularwerte-Objekt oder am gerenderten HTML (Konvention 9: dieselbe ANTWORT ueberall,
   nicht dieselbe FUNKTION — die drei Stellen lesen unvermeidbar unterschiedliche Werte).
   saq_rezert ist heute pflicht:false, wuerde also auch ohne die Ausnahme nie als offen
   markiert — dieser Test haengt das Feld testweise auf pflicht:true um, um die Ausnahme
   selbst zu pruefen, nicht nur ihre zufaellige Folgenlosigkeit. */

test('M-1: ein (testweise) pflichtiges Haekchen wird von briefingFelderZaehlen nie als offen markiert', () => {
  const original = inhalt.briefingFeld;
  inhalt.briefingFeld = function (id) {
    return (id === 'saq_rezert') ? { id: 'saq_rezert', form: 'haken', pflicht: true } : original(id);
  };
  const anzeige = { textContent: '', classList: { toggle: function () {} } };
  const feld = { dataset: { feld: 'saq_rezert' }, value: '', type: 'checkbox', checked: false };
  let offenGesetzt = null;
  feld.parentNode = { classList: { toggle: function (cls, an) { if (cls === 'offen') offenGesetzt = an; } } };
  global.document = {
    querySelector: function (s) { return s.indexOf('offen-zahl') >= 0 ? anzeige : null; },
    querySelectorAll: function (sel) { return sel === '#briefing-felder [data-feld]' ? [feld] : []; }
  };

  controller.briefingFelderZaehlen();

  assert.strictEqual(offenGesetzt, false, 'ein Pflicht-Haekchen wurde trotzdem als offen markiert');
  delete global.document;
  inhalt.briefingFeld = original;
});

/* Mutationsprobe (durchgefuehrt, Fix-Runde 1): `f.form !== 'haken' &&` aus der
   leer-Berechnung in briefingFelderZaehlen entfernt — `node --test` wurde rot an
   genau diesem einen Test. Danach wiederhergestellt, wieder 437/437 gruen. */

test('Fremdtext in den Werten wird maskiert', () => {
  const h = ansichten.einSchritt(INHALT, DBS, 1, null,
    { briefingFelder: { zielgruppe: '<script>x</script>' } });
  assert.ok(h.indexOf('<script>x</script>') < 0, 'ungefiltertes HTML in der Ansicht');
});

/* ---------- Die Zaehlung laeuft beim Tippen mit ----------
   Ohne das steht nach dem Ausfuellen weiter "8 offen", bis gesichert wurde. */

test('die Zaehlung folgt dem, was in den Feldern steht', () => {
  const { controller } = require('../app.js');
  const felder = inhalt.BRIEFING_FELDER.map(f => ({
    dataset: { feld: f.id }, value: '', parentNode: { classList: { toggle: function () {} } }
  }));
  const anzeige = { textContent: '', classList: { toggle: function () {} } };
  global.document = {
    querySelector: function (s) { return s.indexOf('offen-zahl') >= 0 ? anzeige : null; },
    querySelectorAll: function () { return felder; }
  };

  controller.briefingFelderZaehlen();
  assert.match(anzeige.textContent, /^9 offen/, 'leeres Formular zaehlt falsch: ' + anzeige.textContent);

  felder.forEach(f => { f.value = VOLL[f.dataset.feld] || ''; });
  controller.briefingFelderZaehlen();
  assert.ok(anzeige.textContent.indexOf('vollständig') >= 0,
    'volles Formular meldet weiterhin offene Felder: ' + anzeige.textContent);

  delete global.document;
});

/* ---------- Umlaute im sichtbaren Text ----------
   Der Fehler ist in diesem Projekt fuenfmal aufgetreten, zuletzt am 2026-07-29
   in genau diesen Feldbeschriftungen ("Praesenzdauer", "Bewusste Ausschluesse").
   Geprueft wird der Text, den die Person liest — nicht die Quelle drumherum.

   Keine Buchstabenregel: "Quelle" und "Dauer" enthalten ue bzw. aue voellig zu
   Recht. Gesucht werden die Ersatzschreibungen, die hier wirklich vorkommen. */

const ERSATZ = [
  'Praesenz', 'Ausschluess', 'Zusaetz', 'moeglich', 'Moeglich', 'fuer', 'ueber', 'Ueber',
  'waehl', 'naechst', 'staerker', 'gaengig', 'erlaeuter', 'befaehig', 'Saetze', 'zurueck',
  'muess', 'koenn', 'Loesung', 'groess', 'Pruefung', 'pruef', 'geoeffnet', 'Uebersicht',
  'aendert', 'aendern', 'haeng', 'traeg', 'laeuft', 'faell', 'Erklaerung',
  'Vollstaendig', 'vollstaendig', 'urspruenglich', 'zusaetzlich', 'ausdruecklich'
];

function ersatzschreibungen(text) {
  return ERSATZ.filter(function (w) { return String(text).indexOf(w) >= 0; });
}

test('Beschriftungen und Hilfen tragen echte Umlaute', () => {
  const schlecht = [];
  inhalt.BRIEFING_FELDER.forEach(f => {
    const sicht = [f.label, f.hilfe, f.beispiel, f.fest, f.einheit].filter(Boolean).join(' ');
    ersatzschreibungen(sicht).forEach(w => schlecht.push(f.id + ': "' + w + '"'));
  });
  assert.deepStrictEqual(schlecht, [],
    'Ersatzschreibung statt Umlaut im sichtbaren Text: ' + schlecht.join(', '));
});

test('die Pruefung schlaegt bei einer Ersatzschreibung wirklich an', () => {
  /* Ohne diesen Nachweis waere der Test oben nur Dekoration. */
  assert.deepStrictEqual(ersatzschreibungen('Praesenzdauer'), ['Praesenz']);
  assert.deepStrictEqual(ersatzschreibungen('Bewusste Ausschluesse'), ['Ausschluess']);
  /* Und er darf nicht bei jedem ue anschlagen: */
  assert.deepStrictEqual(ersatzschreibungen('Quelle des Scopes, Präsenzdauer, Affluent'), []);
});

test('die Felder bieten genug Platz zum Lesen', () => {
  inhalt.BRIEFING_FELDER.filter(f => f.form === 'text').forEach(f => {
    assert.ok(f.zeilen >= 4,
      f.id + ' hat nur ' + f.zeilen + ' Zeilen — der Text verschwindet hinter dem Rollbalken');
  });
});
