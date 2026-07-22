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
  assert.ok(teile.length >= 7, 'zu wenige Abschnitte: ' + teile.length);
  teile.forEach(function (t) {
    const inhaltsblock = t.zeilen.join('\n');
    assert.ok(c.indexOf(inhaltsblock) >= 0, 'Claude fehlt: ' + t.tag);
    assert.ok(g.indexOf(inhaltsblock) >= 0, 'ChatGPT fehlt: ' + t.tag);
  });
});

test('beide Fassungen tragen die Vorrangregel gegenueber den Masterprompts', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f);
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
  assert.ok(t.indexOf('04_greenfield') < 0, 'traegt den alten Ordner weiter');
});

test('alle neun Schritte stehen mit ihrem Namen drin', () => {
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
  assert.ok(t.indexOf('nicht mit Schritt 3 beginnen') >= 0);
});

test('die abgeleiteten Lernziel-IDs tragen die Kurs-ID', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING);
  assert.ok(t.indexOf('AFL-001-LZ-###') >= 0);
  assert.ok(t.indexOf('AFL-001-EK-###') >= 0);
});

/* ---------- Der Block in Schritt 2 ---------- */

test('Schritt 2 zeigt die Instruktionen mit Kopierknopf', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null,
    { ordnerFehlt: false, briefing: BRIEFING });
  assert.ok(/data-action="kopieren-instruktionen"/.test(h), 'kein Kopierknopf');
  assert.ok(h.indexOf('eingelesen') >= 0, 'sagt nicht, woher das Briefing kommt');
});

test('Schritt 2 bietet beide Fassungen zum Umschalten an', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null,
    { ordnerFehlt: false, briefing: BRIEFING });
  assert.ok(/data-fassung="claude"/.test(h), 'keine Claude-Fassung');
  assert.ok(/data-fassung="chatgpt"/.test(h), 'keine ChatGPT-Fassung');
  assert.ok(/data-box="claude"/.test(h) && /data-box="chatgpt"/.test(h), 'kein Textblock je Fassung');
  assert.strictEqual((h.match(/class="prompt on"/g) || []).length, 1,
                     'es darf genau eine Fassung sichtbar sein');
});

test('solange das Briefing nicht gelesen ist, wird nichts behauptet', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null, { ordnerFehlt: false });
  assert.ok(h.indexOf('wird gelesen') >= 0);
  assert.ok(h.indexOf('Kein freigegebenes Briefing') < 0, 'behauptet zu frueh, es fehle');
});

test('fehlt das Briefing, sagt der Block es offen', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null,
    { ordnerFehlt: false, briefing: null });
  assert.ok(h.indexOf('Kein freigegebenes Briefing') >= 0);
});

test('der Text im Block ist escaped — er kommt aus SharePoint', () => {
  const h = ansichten.einSchritt(INHALT, AFL, 2, null,
    { ordnerFehlt: false, briefing: '<script>alert(1)</script>' });
  assert.ok(h.indexOf('<script>') < 0, 'Fremdtext ungeschuetzt im HTML');
  assert.ok(h.indexOf('&lt;script&gt;') >= 0);
});
