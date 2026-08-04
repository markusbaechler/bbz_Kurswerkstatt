const test = require('node:test');
const assert = require('node:assert');

/* skript-schema.js vorab requiren, damit root.skriptSchema steht, BEVOR
   inhalt.js blocksPruefe() ruft — die Script-Tag-Reihenfolge in index.html
   (inhalt.js VOR skript-schema.js) spielt dank Lazy-Accessor (S() in
   inhalt.js) keine Rolle, s. dort. Node-`require` ist ebenfalls lazy
   innerhalb von S(), aber wir requiren hier trotzdem vorab, damit
   `root.skriptSchema` explizit steht wie im echten Browser-Lauf. */
require('../skript-schema.js');
const { inhalt } = require('../inhalt.js');
const { skriptLesen } = require('../skript-lesen.js');

/* ---------- inhalt.blocksPruefe (B5, Etappe 3b) ----------
   Ersetzt inhalt.skriptPruefe (A2): das Drift-Netz fuer den Chat-Weg von
   Schritt 3, jetzt gegen die BLOCKDATEI statt gegen die .docx (E5-Revision,
   Entscheid Markus 2026-08-03). skriptLesen.lies() prueft die
   Pflichtbausteine je Kapitel schon selbst (pruefeKapitel) — blocksPruefe
   uebernimmt nur, was danach noch fehlt: Q-ID-Abgleich, Marker-Verbot,
   Wortbudget. Reine Funktion hier, kein DOM, kein Netz. */

const D = () => ({ regulatorik: { stand: '1.1.2026' }, content_modus: 'quellengestuetzt',
  quellen: [{ id: 'Q-001' }, { id: 'Q-002' }] });

/* Ein Kapitel mit genug Woertern, um das Wortbudget (hartMin 500) sicher zu
   reissen — je nach Bedarf pro Test angepasst. Nutzt die echte
   skriptLesen-Kette (keine Handstruktur), damit blocksPruefe() gegen ein
   realistisches gelesen-Objekt getestet wird. */
function worte(n, praefix) {
  var w = [];
  for (var i = 0; i < n; i++) w.push((praefix || 'wort') + i);
  return w.join(' ');
}

function block(opts) {
  opts = opts || {};
  var gelesenZeile = opts.gelesen || 'BSV Mitteilungen Nr. 168, 01.01.2026 Q-001';
  var textmenge = opts.woerterJeTeil || 90; // 6 Textteile * 90 = 540 > 500
  return [
    '###SKRIPT kurs=VL-002 | variante=claude | titel=Vorsorge | rechtsstand=01.01.2026',
    '###QUELLEN',
    (opts.ohneGelesen ? '' : 'gelesen: ' + gelesenZeile),
    '###KAPITEL nr=1 | ek=VL-002-EK-001 | titel=Kapitel eins | bloom=2 | richtzeit=25',
    /* V2 (Etappe 4): ###VALIDIERUNG in Schritt 3 fuer den Schritt-3-Verbot-Test
       — der Parser laesst den Block syntaktisch zu (er ist schrittneutral),
       nur blocksPruefe() weist ihn zurueck. */
    (opts.mitValidierung ? '###VALIDIERUNG\nherkunft: bestaetigt' : ''),
    /* V2-Review-Minor: ein ILLUSTRATION-Steuertext, der bei einem Bug
       faelschlich ins Wortbudget einflösse — s. Wortbudget-Exclusion-Test. */
    (opts.illustrationExtra ? '###ILLUSTRATION\ndatei: bild.png\n' + opts.illustrationExtra : ''),
    '###HERO', worte(textmenge, 'hero'),
    '###STORY', worte(textmenge, 'story'),
    '###DEFINITION', worte(textmenge, 'def'),
    '###ERKLAERUNG', worte(textmenge, 'erkl'),
    '###FEHLVORSTELLUNG', worte(textmenge, 'fehl'),
    '###BEISPIEL', worte(textmenge, 'bsp'),
    '###ABBILDUNG typ=kompositions-leiste | titel=Verteilung',
    'werte: Teil eins 1 | Teil zwei 2',
    '###INTERAKTION', worte(30, 'inter'),
    '###MERKSATZ', worte(30, 'merk'),
    '###DEEPDIVE', worte(30, 'deep'),
    '###WISSENSCHECK', 'frage: Was trifft zu?', 'a) nichts', 'b) alles',
    'loesung: b', 'begruendung: weil es so ist',
    '###ABSCHLUSS', worte(30, 'schluss'),
    '###ENDE-KAPITEL',
    (opts.marker ? '###OFFEN\n' + opts.marker : '')
  ].join('\n');
}

function gelesen(opts) { return skriptLesen.lies(block(opts)); }

test('sauberes Teil-Skript: keine Fehler, fehlende Q-IDs nur als Hinweis', () => {
  const g = gelesen();
  assert.deepStrictEqual(g.fehler, []);
  const r = inhalt.blocksPruefe(g, D());
  assert.deepStrictEqual(r.fehler, []);
  assert.ok(r.hinweise.some((h) => /Q-002/.test(h)));
});

test('unbekannte Q-ID in der Leseliste ist ein Fehler', () => {
  const g = gelesen({ gelesen: 'BSV Mitteilungen Q-001 Q-009' });
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /Q-009/.test(f) && /Unbekannte/.test(f)));
});

test('Marker "[ZU PRÜFEN" in einem Baustein ist ein Fehler', () => {
  const g = gelesen();
  g.kapitel[0].teile.MERKSATZ += ' [ZU PRÜFEN: Betrag pruefen]';
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /ZU PR/i.test(f) && /MERKSATZ/.test(f)));
});

test('Wortbudget unter 500: eigener Fehler je Kapitel', () => {
  const g = gelesen({ woerterJeTeil: 5 }); // 6*5=30 Woerter, weit unter hartMin
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /Wortbudget/.test(f) && /VL-002-EK-001/.test(f)));
});

test('Wortbudget erreicht (>= 500): kein Budget-Fehler', () => {
  const g = gelesen({ woerterJeTeil: 90 });
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(!r.fehler.some((f) => /Wortbudget/.test(f)));
});

test('quellenfrei: leere Leseliste ohne Q-Verweis ist sauber', () => {
  const d = D(); d.content_modus = 'quellenfrei'; d.quellen = [];
  const g = gelesen({ ohneGelesen: true });
  const r = inhalt.blocksPruefe(g, d);
  assert.deepStrictEqual(r.fehler.filter((f) => /quellenfrei/.test(f)), []);
});

test('quellenfrei, aber eine Leseliste mit Q-ID ist gesetzt: Fehler', () => {
  const d = D(); d.content_modus = 'quellenfrei'; d.quellen = [];
  const g = gelesen({ gelesen: 'Q-001 irgendwas' });
  const r = inhalt.blocksPruefe(g, d);
  assert.ok(r.fehler.some((f) => /quellenfrei/.test(f)));
});

test('ohne Dossier keine Aussage: null, nie ein leeres gruenes Ergebnis', () => {
  const g = gelesen();
  assert.strictEqual(inhalt.blocksPruefe(g, null), null);
});

test('Q-0158 ist nicht Q-015 — Wortgrenze wie quellenSpiegel', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [{ id: 'Q-015' }] };
  const g = gelesen({ gelesen: 'Q-0158 und Q-015' });
  const r = inhalt.blocksPruefe(g, d);
  assert.ok(!r.fehler.some((f) => /Q-0158/.test(f)));
  assert.ok(!r.fehler.some((f) => /Unbekannte.*Q-015\b/.test(f)));
});

test('leeres gelesen-Objekt (kein Kapitel) fuehrt nicht zum Crash', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [] };
  const r = inhalt.blocksPruefe({}, d);
  assert.deepStrictEqual(r.fehler, []);
  assert.deepStrictEqual(r.hinweise, []);
});

/* ---------- inhalt.illustrationenFehlend (B5, B6-Vorgriff) ----------
   ###ILLUSTRATION ist heute (vor B6) kein bekannter Baustein — echter Text
   damit wuerde skriptLesen.lies() schon als "Unbekannter Block" abweisen,
   bevor dieser Check ueberhaupt laeuft (s. Kommentarkopf in inhalt.js).
   Die Funktion ist trotzdem einzeln testbar: gelesen.kapitel[].teile.
   ILLUSTRATION wird direkt gesetzt, wie es der docxBauen-Test fuer denselben
   Vorgriff schon tut (test/docxbauen.test.js). */

test('illustrationenFehlend: referenzierte, aber nicht hochgeladene Datei fehlt', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'datei: szene.png';
  const fehlt = inhalt.illustrationenFehlend(g, ['anderes.png']);
  assert.deepStrictEqual(fehlt, ['szene.png']);
});

test('illustrationenFehlend: liegt die Datei im Upload, fehlt nichts', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'datei: szene.png';
  const fehlt = inhalt.illustrationenFehlend(g, ['szene.png']);
  assert.deepStrictEqual(fehlt, []);
});

test('illustrationenFehlend: ohne ILLUSTRATION-Teil gibt es nichts zu vermissen', () => {
  const g = gelesen();
  const fehlt = inhalt.illustrationenFehlend(g, []);
  assert.deepStrictEqual(fehlt, []);
});

test('illustrationenFehlend: ILLUSTRATION ohne "datei:"-Zeile wird toleriert (kein Fehlen)', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'keine datei-Zeile hier';
  const fehlt = inhalt.illustrationenFehlend(g, []);
  assert.deepStrictEqual(fehlt, []);
});

/* ---------- blocksPruefe: katalog-only-Hinweis (Fixwave 2026-08-04, I1) ----------
   katalog: ist heute (vor B7) eine stille Sackgasse — kein Katalog, keine App-
   Aufloesung. illustrationenFehlend() bleibt bewusst tolerant (kein Fehler), aber
   blocksPruefe() haengt seither einen HINWEIS an, damit es nie still bleibt. */

test('blocksPruefe: ###ILLUSTRATION mit katalog: ohne datei: erzeugt einen Hinweis, keinen Fehler', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'katalog: sparen-und-anlegen';
  const r = inhalt.blocksPruefe(g, D());
  assert.deepStrictEqual(r.fehler, []);
  assert.ok(r.hinweise.some((h) => /Katalog-Verweis wird in dieser Fassung noch nicht gesetzt/.test(h)),
    'der Katalog-Hinweis fehlt: ' + JSON.stringify(r.hinweise));
  assert.ok(r.hinweise.some((h) => /VL-002-EK-001/.test(h)), 'der Hinweis sollte das Kapitel nennen');
});

test('blocksPruefe: ###ILLUSTRATION mit datei: (auch zusaetzlich katalog:) loest KEINEN Katalog-Hinweis aus', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'katalog: sparen-und-anlegen\ndatei: szene.png';
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(!r.hinweise.some((h) => /Katalog-Verweis/.test(h)));
});

test('blocksPruefe: ###ILLUSTRATION mit szene: allein (kein katalog:) loest ebenfalls keinen Katalog-Hinweis aus', () => {
  const g = gelesen();
  g.kapitel[0].teile.ILLUSTRATION = 'datei: szene.png\nszene: eine Beraterin am Schreibtisch';
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(!r.hinweise.some((h) => /Katalog-Verweis/.test(h)));
});

/* ---------- blocksPruefe: Schritt-3-Verbot fuer ###VALIDIERUNG (V2, Etappe 4) ----------
   ###VALIDIERUNG (V1) gehoert erst in Schritt 4 (dort PFLICHT, s. validierungPruefe
   Regel 1 unten) — in einem Schritt-3-Entwurf ist der Block ein Fehler: die
   Validierung ist noch nicht dran. Der Parser selbst laesst den Block syntaktisch
   zu (schrittneutral), nur blocksPruefe() weist ihn zurueck. */

test('blocksPruefe: ###VALIDIERUNG in einem Schritt-3-Entwurf ist ein Fehler', () => {
  const g = gelesen({ mitValidierung: true });
  assert.deepStrictEqual(g.fehler, []); // Parser selbst laesst den Block syntaktisch zu
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /###VALIDIERUNG/.test(f) && /Schritt 4/.test(f) && /VL-002-EK-001/.test(f)));
});

test('blocksPruefe Gegenprobe: ohne ###VALIDIERUNG bleibt Schritt 3 unauffaellig', () => {
  const g = gelesen();
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(!r.fehler.some((f) => /###VALIDIERUNG/.test(f)));
});

/* ---------- Wortbudget: Steuertext zaehlt nicht mit (V1-Review-Minor, hier geschlossen) ----------
   Deferred aus dem V1-Review: das Wortbudget zaehlte bisher auch den rohen
   Feldsyntax-Text von VALIDIERUNG/ILLUSTRATION mit — Steuerdaten sind kein
   Content. Geschlossen mit einer gemeinsamen Ausschlussliste (kapitelWortzahl),
   die blocksPruefe (Schritt 3) UND validierungPruefe (Schritt 4) gleichermassen
   nutzen (Konvention 9). Dieser Test belegt es fuer Schritt 3 (ILLUSTRATION);
   der Schritt-4-Beleg (VALIDIERUNG) steht im validierungPruefe-Abschnitt unten. */

test('Wortbudget (V2-Review-Minor): ILLUSTRATION-Steuertext zaehlt NICHT mit', () => {
  // block() traegt neben den 6 konfigurierbaren Textteilen (woerterJeTeil je)
  // noch feste 135 Woerter (INTERAKTION/MERKSATZ/DEEPDIVE/WISSENSCHECK/
  // ABSCHLUSS) — bei woerterJeTeil=60 macht das 6*60+135=495, knapp UNTER
  // hartMin 500. Ein Bug, der den ILLUSTRATION-Steuertext mitzaehlt, wuerde
  // mit den zusaetzlichen 10 Woertern auf 505 kommen (>= 500) und den Fehler
  // faelschlich unterdruecken.
  const g = gelesen({ woerterJeTeil: 60, illustrationExtra: worte(10, 'illu') });
  const r = inhalt.blocksPruefe(g, D());
  assert.ok(r.fehler.some((f) => /Wortbudget/.test(f)),
    'der ILLUSTRATION-Steuertext haette faelschlich mitgezaehlt und die Budget-Pruefung bestehen lassen');
});

/* ---------- inhalt.zahlenImText (V2, Regel 4b der Regressionsbremse) ----------
   Ziffern-Zahlen in einem Text zaehlen — ein Tausendertrennzeichen (Punkt ODER
   Apostroph, z. B. 34'128 oder 3.5) haelt eine Zahl zusammen, zaehlt also als
   EINE Zahl, nicht mehrere. */

test('zahlenImText: einfache Zahlen werden gezaehlt', () => {
  assert.strictEqual(inhalt.zahlenImText('Der Betrag betraegt 10 Franken, macht 25 Prozent.'), 2);
});

test('zahlenImText: Tausendertrennzeichen Punkt und Apostroph zaehlen als EINE Zahl', () => {
  assert.strictEqual(inhalt.zahlenImText("CHF 34'128 sowie 3.5 Prozent und 10"), 3);
});

test('zahlenImText: ein Satzpunkt ohne folgende Ziffer trennt Zahlen (kein Ueberlesen ins naechste)', () => {
  assert.strictEqual(inhalt.zahlenImText('Der Betrag ist 10. Weiter im Text mit 20 Franken.'), 2);
});

test('zahlenImText: Text ohne Ziffern liefert 0', () => {
  assert.strictEqual(inhalt.zahlenImText('kein Zahlwort hier'), 0);
});

test('zahlenImText: leerer/undefined/null Text liefert 0 (kein Crash)', () => {
  assert.strictEqual(inhalt.zahlenImText(''), 0);
  assert.strictEqual(inhalt.zahlenImText(undefined), 0);
  assert.strictEqual(inhalt.zahlenImText(null), 0);
});

/* ---------- inhalt.validierungPruefe (V2, Etappe 4) ----------
   Schritt 4 (Validierung) baut auf den Grundregeln von blocksPruefe auf
   (Marker-Verbot, Wortbudget — dieselben Helfer, Konvention 9) und prueft
   zusaetzlich vier V2-spezifische Regeln. gelesen ist das Ergebnis von
   skriptLesen.lies() fuer die Schritt-4-Blockdatei (den validierten,
   ueberarbeiteten Skript-Text); varianten sind die BEREITS GEPARSTEN
   Schritt-3-Rohentwuerfe beider Varianten (der Aufrufer/V4 laedt/parst sie).

   Fuer die reinen Regel-4-Marken (Bausteine/Zahlen/Abbildungen) reicht eine
   direkte Objekt-Konstruktion statt eines echten Blockdatei-Parse-Durchlaufs
   (Muster docx-bauen.js-Tests/B4: "gelesen.kapitel[].teile.ILLUSTRATION wird
   direkt gesetzt, statt geparst") — das haelt die Zahlen in jedem Test exakt
   nachvollziehbar. */

function kapitelObj(opts) {
  opts = opts || {};
  var namen = opts.bausteine || ['HERO', 'STORY', 'DEFINITION', 'ERKLAERUNG', 'FEHLVORSTELLUNG'];
  var teile = {};
  namen.forEach(function (name) { teile[name] = opts.text || worte(90, name.toLowerCase()); });
  teile.BEISPIEL = opts.beispiel !== undefined ? opts.beispiel : worte(90, 'bsp');
  return {
    ek: opts.ek || 'VL-002-EK-001',
    teile: teile,
    abbildungen: opts.abbildungen || [],
    validierung: opts.validierung === undefined
      ? { herkunft: 'bestaetigt', beleg: '', divergenz: '', begruendung: '' }
      : opts.validierung
  };
}

function gelesenObj(kapitelListe, opts) {
  opts = opts || {};
  return {
    skript: { kurs: 'VL-002', titel: 'Vorsorge', rechtsstand: '01.01.2026', variante: opts.variante || 'claude' },
    quellen: { gelesen: opts.gelesenListe === undefined ? ['Q-001', 'Q-002'] : opts.gelesenListe, nichtGeoeffnet: [] },
    kapitel: kapitelListe,
    zuordnung: [],
    offen: opts.offen || [],
    fehler: []
  };
}

test('validierungPruefe: ohne (geladenes) Dossier liefert null — ungeprueft ist nie gruen', () => {
  const g = gelesenObj([kapitelObj()]);
  assert.strictEqual(inhalt.validierungPruefe(g, null, 'VL-002', {}), null);
});

test('validierungPruefe: alle vier Regeln erfuellt -> keine Fehler', () => {
  const draft = kapitelObj();
  const g = gelesenObj([draft]);
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.deepStrictEqual(r.fehler, []);
});

/* Regel 1: ###VALIDIERUNG ist je Kapitel PFLICHT — umgekehrt zu Schritt 3. */

test('Regel 1: ###VALIDIERUNG fehlt je Kapitel ist ein Fehler', () => {
  const draft = kapitelObj({ validierung: null });
  const g = gelesenObj([draft]);
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.ok(r.fehler.some((f) => /###VALIDIERUNG fehlt/.test(f) && /VL-002-EK-001/.test(f)));
});

test('Regel 1 Gegenprobe: mit ###VALIDIERUNG kein solcher Fehler', () => {
  const draft = kapitelObj();
  const g = gelesenObj([draft]);
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.ok(!r.fehler.some((f) => /###VALIDIERUNG fehlt/.test(f)));
});

/* Regel 2: Leseliste vollstaendig — fehlende Dossier-Q-IDs sind HIER ein
   Fehler (in Schritt 3/blocksPruefe nur ein Hinweis). */

test('Regel 2: fehlende Dossier-Q-ID in der Leseliste ist ein Fehler (kein Hinweis mehr)', () => {
  const draft = kapitelObj();
  const g = gelesenObj([draft], { gelesenListe: ['Q-001'] }); // Q-002 fehlt
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.ok(r.fehler.some((f) => /unvollständig/.test(f) && /Q-002/.test(f)));
  assert.ok(!r.hinweise.some((h) => /Q-002/.test(h)), 'Q-002 duerfte hier kein Hinweis mehr sein');
});

test('Regel 2 Gegenprobe: vollstaendige Leseliste ist kein Fehler', () => {
  const draft = kapitelObj();
  const g = gelesenObj([draft], { gelesenListe: ['Q-001', 'Q-002'] });
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.ok(!r.fehler.some((f) => /unvollständig/.test(f)));
});

/* Regel 3: jede divergenz: offen braucht einen Eintrag in ###OFFEN — Abgleich
   ueber die EK-ID als Substring im Offen-Text. */

test('Regel 3: divergenz offen ohne Eintrag in ###OFFEN ist ein Fehler', () => {
  const draft = kapitelObj({ validierung: { herkunft: 'bestaetigt', divergenz: 'offen', beleg: '', begruendung: '' } });
  const g = gelesenObj([draft], { offen: [] });
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.ok(r.fehler.some((f) => f === 'offene Divergenz VL-002-EK-001 fehlt in ###OFFEN'));
});

test('Regel 3 Gegenprobe: divergenz offen MIT passendem Eintrag in ###OFFEN ist kein Fehler', () => {
  const draft = kapitelObj({ validierung: { herkunft: 'bestaetigt', divergenz: 'offen', beleg: '', begruendung: '' } });
  const g = gelesenObj([draft], { offen: ['VL-002-EK-001: Frage zur Rechtsgrundlage klaeren'] });
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.ok(!r.fehler.some((f) => /offene Divergenz/.test(f)));
});

/* Regel 4: Regressionsbremse — Untergrenze je Marke ist der HOEHERE Wert der
   beiden Schritt-3-Varianten (unabhaengig je Marke, nicht insgesamt). */

test('Regel 4: unabhaengige Maxima je Marke — A staerker in Bausteinen, B staerker in Zahlen, beide Maxima gelten', () => {
  const draft = kapitelObj({ ek: 'VL-002-EK-003', bausteine: ['HERO', 'STORY', 'DEFINITION'], beispiel: 'nur 1 Zahl hier', abbildungen: [] });
  const g = gelesenObj([draft]);
  const varA = gelesenObj([kapitelObj({
    ek: 'VL-002-EK-003', bausteine: ['HERO', 'STORY', 'DEFINITION', 'ERKLAERUNG', 'FEHLVORSTELLUNG'],
    beispiel: 'keine Zahl', abbildungen: []
  })]);
  const varB = gelesenObj([kapitelObj({ ek: 'VL-002-EK-003', bausteine: ['HERO'], beispiel: '10 20 30 Franken', abbildungen: [] })]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varA, chatgpt: varB });
  assert.ok(r.fehler.includes('Kapitel VL-002-EK-003: Bausteine 4 < 6 (Untergrenze aus Variante claude)'),
    JSON.stringify(r.fehler));
  assert.ok(r.fehler.includes('Kapitel VL-002-EK-003: Zahlen im Beispiel 1 < 3 (Untergrenze aus Variante chatgpt)'),
    JSON.stringify(r.fehler));
  assert.ok(!r.fehler.some((f) => /Abbildungen/.test(f)));
});

test('Regel 4 Gegenprobe: Ist == Soll (Untergrenze erreicht) ist kein Fehler', () => {
  const draft = kapitelObj({ bausteine: ['HERO', 'STORY'], beispiel: '5 10', abbildungen: [{ typ: 'kompositions-leiste' }] });
  const g = gelesenObj([draft]);
  const varA = gelesenObj([kapitelObj({ bausteine: ['HERO', 'STORY'], beispiel: '5', abbildungen: [] })]);
  const varB = gelesenObj([kapitelObj({ bausteine: ['HERO'], beispiel: '5 10', abbildungen: [{ typ: 'waage' }] })]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varA, chatgpt: varB });
  assert.ok(!r.fehler.some((f) => /Untergrenze/.test(f)), JSON.stringify(r.fehler));
});

test('Regel 4: fehlt eine Variante ganz, gibt es GENAU EINEN Abbruch-Fehler, keine Marken-Fehler zusaetzlich', () => {
  const draft = kapitelObj({ bausteine: ['HERO'], beispiel: 'keine Zahl' });
  const g = gelesenObj([draft]);
  const varB = gelesenObj([kapitelObj({ bausteine: ['HERO', 'STORY', 'DEFINITION'], beispiel: '1 2 3' })]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: null, chatgpt: varB });
  const treffer = r.fehler.filter((f) => /Variantenvergleich/.test(f));
  assert.strictEqual(treffer.length, 1, JSON.stringify(r.fehler));
  assert.ok(/claude fehlt in 03_content/.test(treffer[0]));
  assert.ok(!r.fehler.some((f) => /Untergrenze/.test(f)));
});

test('Regel 4: fehlen BEIDE Varianten, nennt der eine Abbruch-Fehler beide', () => {
  const draft = kapitelObj();
  const g = gelesenObj([draft]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', {});
  const treffer = r.fehler.filter((f) => /Variantenvergleich/.test(f));
  assert.strictEqual(treffer.length, 1, JSON.stringify(r.fehler));
  assert.ok(/claude/.test(treffer[0]) && /chatgpt/.test(treffer[0]));
});

/* Wortbudget-Ausschluss (V2-Review-Minor), Schritt-4-Beleg: ###VALIDIERUNG ist
   in Schritt 4 PFLICHT und liegt deshalb IMMER als Steuertext im Dokument —
   der lange beleg-Wert darf das Wortbudget trotzdem nicht kuenstlich fuellen.
   Braucht die ECHTE Blockdatei-Kette (skriptLesen.lies), weil kapitelObj()
   oben keinen Rohtext in teile.VALIDIERUNG ablegt (nur die strukturierte
   Form) — dieselbe Grenze wie beim ILLUSTRATION-Test oben. */

test('Wortbudget (Schritt 4): VALIDIERUNG-Steuertext (beleg) zaehlt NICHT mit', () => {
  // Feste Bloecke (INTERAKTION/MERKSATZ/DEEPDIVE/WISSENSCHECK/ABSCHLUSS)
  // tragen zusammen 135 Woerter — bei 60 Woertern je der 6 konfigurierbaren
  // Textteile macht das 6*60+135=495, knapp UNTER hartMin 500 (s. Rechnung
  // im blocksPruefe-Wortbudget-Test oben). Ein Bug, der den langen
  // beleg-Text mitzaehlt, wuerde mit den 60 Zusatzwoertern auf 555 kommen
  // (>= 500) und den Fehler faelschlich unterdruecken.
  const belegLang = worte(60, 'beleg');
  const text = [
    '###SKRIPT kurs=VL-002 | variante=claude | titel=Vorsorge | rechtsstand=01.01.2026',
    '###QUELLEN',
    'gelesen: Q-001 Q-002',
    '###KAPITEL nr=1 | ek=VL-002-EK-001 | titel=Kapitel eins | bloom=2 | richtzeit=25',
    '###VALIDIERUNG',
    'herkunft: korrigiert',
    'beleg: ' + belegLang,
    '###HERO', worte(60, 'hero'),
    '###STORY', worte(60, 'story'),
    '###DEFINITION', worte(60, 'def'),
    '###ERKLAERUNG', worte(60, 'erkl'),
    '###FEHLVORSTELLUNG', worte(60, 'fehl'),
    '###BEISPIEL', worte(60, 'bsp'),
    '###ABBILDUNG typ=kompositions-leiste | titel=Verteilung',
    'werte: Teil eins 1 | Teil zwei 2',
    '###INTERAKTION', worte(30, 'inter'),
    '###MERKSATZ', worte(30, 'merk'),
    '###DEEPDIVE', worte(30, 'deep'),
    '###WISSENSCHECK', 'frage: Was trifft zu?', 'a) nichts', 'b) alles', 'loesung: b', 'begruendung: weil es so ist',
    '###ABSCHLUSS', worte(30, 'schluss'),
    '###ENDE-KAPITEL'
  ].join('\n');
  const g = skriptLesen.lies(text);
  assert.deepStrictEqual(g.fehler, []); // gueltige Blockdatei — Testvoraussetzung
  const varGleich = gelesenObj([kapitelObj()]);
  const r = inhalt.validierungPruefe(g, D(), 'VL-002', { claude: varGleich, chatgpt: varGleich });
  assert.ok(r.fehler.some((f) => /Wortbudget/.test(f) && /VL-002-EK-001/.test(f)),
    'der lange beleg-Text (Steuerdaten) haette faelschlich mitgezaehlt und die Budget-Pruefung bestehen lassen: ' +
    JSON.stringify(r.fehler));
});
