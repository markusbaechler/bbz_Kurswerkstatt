const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
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
