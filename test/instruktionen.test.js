const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1];
const BRIEFING = '# Kursbriefing AFL-001\n\nZielgruppe: Kundenberater\nScope: [OFFEN] Derivate';

/* ---------- Geltende Fassung ---------- */

test('_final schlaegt jede Nummer', () => {
  const d = [{ name: 'AFL-001_briefing_v1.md' }, { name: 'AFL-001_briefing_final.md' },
             { name: 'AFL-001_briefing_v7.md' }];
  assert.strictEqual(inhalt.geltendeDatei(d, 'AFL-001', 'briefing'), 'AFL-001_briefing_final.md');
});

test('ohne _final gilt die hoechste Nummer', () => {
  const d = [{ name: 'AFL-001_briefing_v1.md' }, { name: 'AFL-001_briefing_v3.md' },
             { name: 'AFL-001_briefing_v2.md' }];
  assert.strictEqual(inhalt.geltendeDatei(d, 'AFL-001', 'briefing'), 'AFL-001_briefing_v3.md');
});

test('fremde Kurse zaehlen nicht mit', () => {
  const d = [{ name: 'DBS-001_briefing_v9.md' }, { name: 'AFL-001_briefing_v1.md' }];
  assert.strictEqual(inhalt.geltendeDatei(d, 'AFL-001', 'briefing'), 'AFL-001_briefing_v1.md');
});

test('ein leerer oder ungelesener Ordner ergibt null', () => {
  assert.strictEqual(inhalt.geltendeDatei([], 'AFL-001', 'briefing'), null);
  assert.strictEqual(inhalt.geltendeDatei(null, 'AFL-001', 'briefing'), null);
});

/* ---------- Projekt-Instruktionen ---------- */

/* ---------- Das Dossier (Positivliste) ---------- */

test('Instruktionen tragen die Fachquellen aus dem Dossier — mit ID und Stand', () => {
  const d = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
              quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025', datei: 'sspa-map-2025.pdf' }],
              status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', d);
  assert.match(t, /Q-001/);
  assert.match(t, /SSPA Map/);
  assert.match(t, /Stand:? 2025/);
  assert.match(t, /keine anderen Quellen/i);
});

test('eine Link-Quelle traegt Link und Abrufdatum, keine "Datei:"-Zeile fuer sie', () => {
  const d = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
              quellen: [{ id: 'Q-001', titel: 'Ausschreibung', herausgeber: 'SSPA', stand: '2026',
                          url: 'https://sspa.ch/ausschreibung', abgerufen: '2026-07-30' }],
              status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', d);
  assert.match(t, /Q-001/);
  assert.match(t, /Link: https:\/\/sspa\.ch\/ausschreibung/);
  assert.match(t, /abgerufen 2026-07-30/);
});

test('quellenfreier Modus steht ausdruecklich in den Instruktionen', () => {
  const d = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellenfrei',
              quellen: [], status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', d);
  assert.match(t, /quellenfrei/i);
});

test('ohne Dossier bleiben die Instruktionen wie bisher — kein Quellen-Teil', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x');
  assert.doesNotMatch(t, /Fachquellen/);
});

/* ---------- Etappe 1e, Task 6: Rechtsstand/SAQ-Rezertifizierung aus dem Dossier ---------- */

test('die Instruktionen tragen Rechtsstand und SAQ-Rezertifizierung aus regulatorik', () => {
  const d = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
              regulatorik: { stand: '1.1.2026', saq_rezert: true },
              quellen: [], status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', d);
  assert.match(t, /Rechtsstand: 1\.1\.2026/);
  assert.match(t, /SAQ-Rezertifizierung: ja/);
});

test('fehlt regulatorik.stand, steht [OFFEN] statt eines erfundenen Datums', () => {
  const d = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
              regulatorik: {}, quellen: [], status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', d);
  assert.match(t, /Rechtsstand: \[OFFEN\]/);
  assert.match(t, /SAQ-Rezertifizierung: nein/);
});

test('die Rechtsstand/SAQ-Zeile fehlt ohne Dossier, wie der ganze Fachquellen-Teil', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x');
  assert.doesNotMatch(t, /Rechtsstand:/);
});

/* ---------- Die zwei Fassungen ---------- */

test('Claude bekommt XML-Tags, ChatGPT Trenn-Ueberschriften', () => {
  const c = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude');
  const g = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'chatgpt');
  assert.ok(/<rolle>[\s\S]*<\/rolle>/.test(c), 'Claude ohne Tags');
  assert.ok(/<ablage>[\s\S]*<\/ablage>/.test(c));
  assert.ok(c.indexOf('===') < 0, 'Claude traegt ChatGPT-Delimiter');
  assert.ok(/=== \d+\. ROLLE & KONTEXT ===/.test(g), 'ChatGPT ohne Delimiter');
  assert.ok(!/<rolle>/.test(g), 'ChatGPT traegt XML-Tags');
});

test('ohne Angabe gilt die Claude-Fassung', () => {
  assert.strictEqual(inhalt.projektInstruktionen(INHALT, AFL, BRIEFING),
                     inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude'));
});

/* Der Grund, warum beide aus derselben Quelle gebaut werden: sie duerfen sich in
   der Verpackung unterscheiden, im Inhalt niemals. Sonst arbeiten Claude und
   ChatGPT nach verschiedenen Regeln, ohne dass es jemand merkt. */
test('beide Fassungen tragen denselben Inhalt', () => {
  const teile = inhalt.projektInstruktionenTeile(INHALT, AFL, BRIEFING);
  const c = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude');
  const g = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'chatgpt');
  /* War >= 7: die Kuerzung (Schritt 4, sdd) hat "modell" (Methodenerklaerung,
     im Masterprompt/in der Anleitung nachlesbar) gestrichen und "freigabe" in
     "regeln" verschmolzen — beides galt fuer jeden Chat gleich, war also nur
     an zwei Stellen dieselbe Aussage. */
  assert.ok(teile.length >= 5, 'zu wenige Abschnitte: ' + teile.length);
  /* Die ChatGPT-Fassung wird auf 100 Zeichen umgebrochen. Verglichen wird
     deshalb der Text ohne seine Zeilenaufteilung — fehlender Inhalt faellt
     weiterhin auf, eine andere Umbruchstelle nicht. */
  const flach = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
  teile.forEach(function (t) {
    const inhaltsblock = flach(t.zeilen.join('\n'));
    assert.ok(flach(c).indexOf(inhaltsblock) >= 0, 'Claude fehlt: ' + t.tag);
    assert.ok(flach(g).indexOf(inhaltsblock) >= 0, 'ChatGPT fehlt: ' + t.tag);
  });
});

test('beide Fassungen tragen die Vorrangregel gegenueber den Masterprompts', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f).replace(/\s+/g, ' ');
    assert.ok(t.indexOf('Bei Widerspruch gelten diese Instruktionen') >= 0, f);
  });
});

test('beide Fassungen tragen das Briefing woertlich', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    assert.ok(inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f).indexOf(BRIEFING) >= 0, f);
  });
});

test('die alten Ordner fehlen in BEIDEN Fassungen', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f);
    ['01_altunterlagen', '03_content-arbeit', '05_moodle-export', 'Stammsatz'].forEach(function (a) {
      assert.ok(t.indexOf(a) < 0, f + ' traegt ' + a);
    });
  });
});

test('Kursdaten stehen im Kopf — nichts bleibt Platzhalter', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING);
  assert.ok(t.indexOf('AFL-001') >= 0);
  assert.ok(t.indexOf('Anlagefondslizenz') >= 0);
  assert.ok(t.indexOf('Vermögen & Vorsorge') >= 0);
});

/* Der Grund fuer den Neubau: die alte Fassung im Cockpit v0.2 trug die
   Ordnerstruktur von vor dem Ablage-Kontrakt und haette sie beiden KI-Projekten
   beigebracht. Diese Namen duerfen nie wieder auftauchen. */
test('die Ordner der Zeit vor dem Ablage-Kontrakt kommen nicht mehr vor', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING);
  ['01_altunterlagen', '02_lernziel-drehbuch', '03_content-arbeit', '04_freigaben',
   '05_moodle-export', '00_kursbriefing', 'Stammsatz'].forEach(function (alt) {
    assert.ok(t.indexOf(alt) < 0, 'veraltet, steht aber drin: ' + alt);
  });
});

/* Auftrag 3: die Acht-Schritte-Reform (2026-07-29) hat den frueheren eigenen
   Schritt 2 ("Kurs-Projekt & Manifest") in Schritt 1 aufgehen lassen und die
   Ordner 02_setup, 03_contract, 04_greenfield sowie das geteilte 05_content
   abgeloest. Keiner davon darf im erzeugten Text noch auftauchen, und die
   Rede ist nirgends mehr von neun Schritten. */
test('die neun Schritte und ihre abgeloesten Ordner kommen nicht mehr vor', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f);
    assert.ok(!/neun Produktionsschritte/i.test(t), f + ' nennt noch neun Schritte');
    ['02_setup', '03_contract', '04_greenfield'].forEach(function (alt) {
      assert.ok(t.indexOf(alt) < 0, f + ' traegt den abgeloesten Ordner ' + alt);
    });
  });
});

test('die Ordner stammen aus dem Kontrakt, nicht aus einem Satz', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING);
  inhalt.ordnerliste(INHALT).forEach(function (o) {
    assert.ok(t.indexOf(o) >= 0, o + ' fehlt');
  });
});

test('aendert sich der Kontrakt, aendern sich die Instruktionen mit', () => {
  const anders = JSON.parse(JSON.stringify(INHALT));
  anders['ablage-kontrakt'].schritte['4'].ordner = '04_entwurf';
  const t = inhalt.projektInstruktionen(anders, AFL, BRIEFING);
  assert.ok(t.indexOf('04_entwurf') >= 0, 'folgt dem Kontrakt nicht');
  assert.ok(t.indexOf('04_validierung') < 0, 'traegt den alten Ordner weiter');
});

/* sdd Schritt 4 (Kuerzung): das genaue Ablageziel je Schritt (Ordner/Dateiname,
   inkl. Variantenzerlegung mit {variante}) und die Erklaerung der Varianten-
   Doppelung ("NEBENEINANDER") sind aus der Projekt-Instruktion herausgenommen —
   sie sind je Schritt verschieden (Leitfrage), nicht fuer jeden Chat gleich, und
   stehen jetzt im Masterprompt des jeweiligen Schritts. Die drei Tests, die genau
   das prueften ('kein Platzhalter im Dateinamen — auch nicht bei Varianten',
   'die Doppelung wird erklaert, nicht nur aufgelistet',
   'ohne Varianten bleibt die Schrittliste unveraendert'), sind deshalb entfallen;
   die zugrundeliegende Logik (inhalt.varianten, inhalt.gewaehlteVariante) bleibt
   unveraendert und ist weiterhin in varianten.test.js und ablegen.test.js
   abgedeckt. Was bleibt: die Schrittzeile selbst traegt keinen Platzhalter mehr,
   weil sie gar kein Ziel mehr nennt. */
test('die Schrittliste nennt kein Ablageziel und keinen Platzhalter mehr', () => {
  const v = JSON.parse(JSON.stringify(INHALT));
  v['ablage-kontrakt'].schritte['4'] = {
    ordner: '04_greenfield', lieferobjekt: 'greenfield-{variante}',
    varianten: ['claude', 'chatgpt'], ext: 'html', format: 'html',
    wege: ['chat', 'claude-code'], gate: null
  };
  const t = inhalt.projektInstruktionen(v, AFL, BRIEFING, 'claude');
  assert.ok(t.indexOf('{variante}') < 0, 'Platzhalter in den Instruktionen');
  assert.ok(t.indexOf('.html') < 0, 'nennt trotzdem einen Dateinamen');
});

/* Der Ordnername geht in beide KI-Projekte. Ein Platzhalter wird dort als Pfad
   gelernt und weitergereicht — derselbe Fehlertyp wie {variante}. */
test('der echte Ordnername wird genannt, sobald er bekannt ist', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude',
                                        'AFL-001_anlagefondslizenz');
  assert.ok(t.indexOf('AFL-001_anlagefondslizenz/') >= 0, 'echter Ordnername fehlt');
  assert.ok(t.indexOf('<kurzname>') < 0, 'Platzhalter trotz bekanntem Ordner');
});

test('ohne bekannten Ordner bleibt der Platzhalter — aber sichtbar markiert', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude');
  assert.ok(t.indexOf('<kurzname>') >= 0);
  assert.ok(t.indexOf('noch nicht angelegt') >= 0, 'der fehlende Ordner wird verschwiegen');
});

test('jeder Schritt nennt seine Wege — hochladen zaehlt nicht dazu', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude');
  const z2 = t.split('\n').find(x => x.indexOf('- Schritt 2') === 0);
  assert.ok(/\(claude-code, hand\)/.test(z2), 'Wege bei Schritt 2 fehlen: ' + z2);
  assert.ok(!/hochladen/.test(z2), 'Ablageweg als Arbeitsweg genannt');
});

test('alle acht Schritte stehen mit ihrem Namen drin', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING);
  INHALT.schritte.schritte.forEach(function (s) {
    assert.ok(t.indexOf('Schritt ' + s.id + ' — ' + s.nm) >= 0, 'Schritt ' + s.id + ' fehlt');
  });
});

test('das Briefing wird woertlich aufgenommen', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING);
  assert.ok(t.indexOf(BRIEFING) >= 0, 'Briefing fehlt oder wurde veraendert');
});

test('fehlt das Briefing, wird es benannt statt erfunden', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, null);
  assert.ok(/\[FEHLT/.test(t), 'kein Hinweis auf das fehlende Briefing');
  assert.ok(t.indexOf('nicht mit Schritt 2 beginnen') >= 0);
});

test('die abgeleiteten Lernziel-IDs tragen die Kurs-ID', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING);
  assert.ok(t.indexOf('AFL-001-LZ-###') >= 0);
  assert.ok(t.indexOf('AFL-001-EK-###') >= 0);
});

/* ---------- Der Block in Schritt 1 ----------
   Bis zur Reform (Auftrag 1) stand dieser Block in einem eigenen Schritt 2
   ("Kurs-Projekt & Manifest"). Der ist in Schritt 1 aufgegangen — der Block
   zeigt sich jetzt dort, sobald der Kursordner steht. */

test('Schritt 1 zeigt die Instruktionen mit Kopierknopf', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null,
    { ordnerFehlt: false, briefing: BRIEFING });
  assert.ok(/data-action="kopieren-instruktionen"/.test(h), 'kein Kopierknopf');
  assert.ok(h.indexOf('eingelesen') >= 0, 'sagt nicht, woher das Briefing kommt');
});

test('Schritt 1 bietet beide Fassungen zum Umschalten an', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null,
    { ordnerFehlt: false, briefing: BRIEFING });
  assert.ok(/data-fassung="claude"/.test(h), 'keine Claude-Fassung');
  assert.ok(/data-fassung="chatgpt"/.test(h), 'keine ChatGPT-Fassung');
  assert.ok(/data-box="claude"/.test(h) && /data-box="chatgpt"/.test(h), 'kein Textblock je Fassung');
  assert.strictEqual((h.match(/class="prompt on"/g) || []).length, 1,
                     'es darf genau eine Fassung sichtbar sein');
});

test('solange das Briefing nicht gelesen ist, wird nichts behauptet', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null, { ordnerFehlt: false });
  assert.ok(h.indexOf('wird gelesen') >= 0);
  assert.ok(h.indexOf('Kein freigegebenes Briefing') < 0, 'behauptet zu frueh, es fehle');
});

test('fehlt das Briefing (nachgesehen, nichts gefunden — leerer String), sagt der Block es offen', () => {
  /* Seit I4 (Etappe 1e Task 4) steht fuer "nachgesehen und nichts gefunden" ein
     leerer String, nicht mehr null — null ist jetzt "wird gerade nachgesehen"
     vorbehalten, s. Test unten. */
  const h = ansichten.einSchritt(INHALT, AFL, 1, null,
    { ordnerFehlt: false, briefing: '' });
  assert.ok(h.indexOf('Kein freigegebenes Briefing') >= 0);
});

test('briefing: null (Anfrage laeuft) zeigt "wird gelesen", nicht "Kein freigegebenes Briefing" (I4)', () => {
  /* Vorher zeigte nur undefined "wird gelesen" — waehrend der laufenden Anfrage
     (state.data.briefing[kursId] ist kurz null, verhindert den Doppelabruf) stand
     faelschlich schon "Kein freigegebenes Briefing", das "[FEHLT]-Fenster". */
  const h = ansichten.einSchritt(INHALT, AFL, 1, null,
    { ordnerFehlt: false, briefing: null });
  assert.ok(h.indexOf('wird gelesen') >= 0, 'zeigt nicht "wird gelesen" fuer null');
  assert.ok(h.indexOf('Kein freigegebenes Briefing') < 0, 'behauptet zu frueh, es fehle');
});

test('der Text im Block ist escaped — er kommt aus SharePoint', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 1, null,
    { ordnerFehlt: false, briefing: '<script>alert(1)</script>' });
  assert.ok(h.indexOf('<script>') < 0, 'Fremdtext ungeschuetzt im HTML');
  assert.ok(h.indexOf('&lt;script&gt;') >= 0);
});

/* ---------- Keine Umlaut-Ersatzschreibungen in der Ausgabe ----------
   Der Fehler ist im Projekt schon viermal passiert: Bezeichner im Quelltext
   sind zurecht ASCII ("fuer", "hoechste") — aber dieselbe Ersatzschreibung
   darf nie in den erzeugten Anweisungstext rutschen, den ein Mensch danach
   in ein KI-Projekt vertippt, wo die Regel "echte Umlaute im Fliesstext"
   steht. Die Pruefung liest darum NUR die Ausgabe von projektInstruktionen(),
   nie den Quelltext von inhalt.js. */

/* Buchstabenfolgen, in denen "ae"/"oe"/"ue" echt ist, keine Ersatzschreibung
   (Quelle: qu+elle, neue: n+eue, bauen: b+auen, ...). Als TEILWORT geprueft,
   nicht nur als ganzes Wort — "Projektquelle" ist genauso echt wie "Quelle". */
const ECHTE_FOLGE = ['quelle', 'quellen', 'neue', 'neuen', 'bauen', 'steuert',
                      'zuerst', 'genaue', 'aktuelle', 'erneut'];

/* Findet Woerter mit ae/oe/ue, die keine Ersatzschreibung fuer einen Umlaut
   sein duerfen. Pfade, Dateinamen, Ordner und Bezeichner faellt sie NICHT
   an — die tragen immer eine Ziffer, einen Unterstrich, einen Bindestrich,
   einen Punkt oder einen Schraegstrich, reiner Fliesstext nie. */
function ersatzschreibungen(text) {
  const treffer = [];
  String(text).split(/\s+/).forEach(function (roh) {
    const wort = roh.replace(/^[^A-Za-z0-9À-ÖØ-öø-ÿ]+|[^A-Za-z0-9À-ÖØ-öø-ÿ]+$/g, '');
    if (!wort) return;
    if (/[0-9_./\\-]/.test(wort)) return;
    const klein = wort.toLowerCase();
    if (ECHTE_FOLGE.some(function (echt) { return klein.indexOf(echt) >= 0; })) return;
    if (/ae|oe|ue/i.test(wort)) treffer.push(wort);
  });
  return treffer;
}

test('keine Umlaut-Ersatzschreibungen in der Ausgabe — beide Fassungen, mit und ohne Briefing', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    [BRIEFING, null].forEach(function (b) {
      const t = inhalt.projektInstruktionen(INHALT, AFL, b, f, 'AFL-001_anlagefondslizenz');
      const treffer = ersatzschreibungen(t);
      assert.deepStrictEqual(treffer, [],
        f + ' (Briefing ' + (b ? 'vorhanden' : 'fehlt') + ') traegt Ersatzschreibungen: ' +
        treffer.join(', '));
    });
  });
});

/* Diskriminierungsprobe fuer die Pruefung selbst: faengt sie eine
   Ersatzschreibung, die im echten Fliesstext steht (nicht in einem Pfad)? */
test('die Pruefung schlaegt bei einer echten Ersatzschreibung im Fliesstext an', () => {
  assert.deepStrictEqual(ersatzschreibungen('Wir liefern Entwuerfe fuer diesen Kurs.'),
    ['Entwuerfe', 'fuer']);
  /* Gegenprobe: dieselbe Buchstabenfolge in einem Pfad oder einer ID stoert nicht. */
  assert.deepStrictEqual(ersatzschreibungen('Ordner 04_greenfield/AFL-001_bauplan_v1.md'), []);
  /* Gegenprobe: die Ausnahmeliste greift bei echten Woertern. */
  assert.deepStrictEqual(ersatzschreibungen('Die Quelle ist neue Praxis, die wir zuerst bauen.'), []);
});

/* ---------- Zeilenlaenge der ChatGPT-Fassung ----------
   Markus am 2026-07-29: das Eingabefeld der ChatGPT-Projekteinstellungen
   bricht nicht um, die Fassung hatte Zeilen von ueber 300 Zeichen. */

test('die ChatGPT-Fassung haelt 100 Zeichen je Zeile ein', () => {
  const g = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'chatgpt');
  const lang = g.split('\n').filter(function (z) { return z.length > 100; });
  assert.strictEqual(lang.length, 0,
    lang.length + ' zu lange Zeilen, laengste ' +
    Math.max.apply(null, lang.map(function (z) { return z.length; })) + ' Zeichen');
});

test('umbrechen zerschneidet kein einzelnes langes Wort', () => {
  const lang = 'DBS-001_lernziele-drehbuch_v12_ein-sehr-langer-name-der-nicht-zerfallen-darf-und-noch-weiter-geht.xlsx';
  assert.ok(lang.length > 100, 'Probe zu kurz');
  assert.strictEqual(inhalt.umbrechen(lang, 100), lang);
});

test('umbrechen behaelt die Einrueckung einer Aufzaehlung', () => {
  const z = inhalt.umbrechen('- ' + new Array(30).join('wort '), 40).split('\n');
  assert.ok(z.length > 1, 'nicht umgebrochen');
  assert.ok(/^- /.test(z[0]), 'erste Zeile ohne Marke');
  z.slice(1).forEach(function (x) {
    assert.ok(/^  \S/.test(x), 'Fortsetzung ohne Einrueckung: ' + JSON.stringify(x));
  });
});
