const test = require('node:test');
const assert = require('node:assert');

require('../app.js');
const { inhalt } = require('../inhalt.js');
const { ansichten } = require('../ansichten.js');
const { INHALT, KURSE } = require('./fixture.js');

const AFL = KURSE[1];
const BRIEFING = '# Kursbriefing AFL-001\n\nZielgruppe: Kundenberater\nScope: [OFFEN] Derivate';

/* K1 (Etappe 4): die Claude-Fassung fuer INHALT/AFL/BRIEFING/'AFL-001_x' (ohne
   Dossier), byte-genau erfasst VOR dem K1-Umbau — der Pin, der belegt, dass der
   Claude-Zweig durch die ChatGPT-Kompaktfassung nicht angefasst wurde. */
const CLAUDE_FIXTURE = "# Projekt-Instruktionen — Kurs AFL-001 — Anlagefondslizenz\nKompetenzfeld: Vermögen & Vorsorge\n\n<rolle>\n<!-- Rolle & Kontext -->\nDu bist didaktischer Co-Autor im bbz-Produktionsprozess „Lerninhalte umgiessen\" für diesen Weiterbildungskurs (Kompetenzfeld: Vermögen & Vorsorge), gebaut nach dem W-U-G-Modell. Öffentliche Weiterbildung, kein bankinternes oder kundenspezifisches Material. Du lieferst Entwürfe; final wird nur, was ein Mensch freigibt.\n</rolle>\n\n<schritte>\n<!-- Die acht Produktionsschritte -->\n- Schritt 1 — Kursbriefing  (chat, claude-code)\n- Schritt 2 — Lernziele  [Gate 1 · 4-Augen]  (chat, claude-code, hand)\n- Schritt 3 — Content  (chat, claude-code)\n- Schritt 4 — Validierung  [Sign-off]  (chat, claude-code)\n- Schritt 5 — Didaktik  (chat, claude-code)\n- Schritt 6 — Moodle-Bau  (claude-code)\n- Schritt 7 — Fach-Review  [Gate 2 · Schluss]  (kurswerkstatt)\n- Schritt 8 — Kuratierung  (chat, claude-code)\nWohin genau (Ordner, Dateiname) ein Ergebnis kommt, sagt der Masterprompt des jeweiligen Schritts — das allgemeine Muster dazu steht unter „Ablage\".\n</schritte>\n\n<ablage>\n<!-- Ablage — verbindlich -->\nBibliothek Kursproduktion (SharePoint), Kursordner AFL-001_x/.\nUnterordner: 00_input · 01_briefing · 02_lernziele · 03_content · 04_validierung · 05_didaktik · 06_moodle · 07_abnahme · 08_backbone. Diese Struktur kommt aus dem Ablage-Kontrakt — nicht selbst erfinden oder ergänzen.\nDateiname: {K}_{lieferobjekt}_v{N}.{ext}, freigegeben: {K}_{lieferobjekt}_final.{ext}. Gibt es eine _final, gilt sie (entsteht durch Umbenennen, nie durch Kopieren); sonst die höchste Versionsnummer. Verboten darin: .\nGate-Protokolle liegen als _gate.md neben der Datei. Der Stand steht in KWKurse (Schritt, Status), nie im Ordner; Referenzen zeigen auf die Kurs-ID, nie auf einen Pfad.\n</ablage>\n\n<regeln>\n<!-- Feste Regeln -->\n- Belegregel: Fachliche Aussagen, Zahlen, Fristen und Definitionen nur aus einer freigegebenen Projektquelle. Fehlt der Beleg: [ZU PRÜFEN: <was> — Quelle fehlt], nie raten. Kennzeichnungen wörtlich: [ENTWURF — unvalidiert] · [NEU — Sign-off nötig] · [FREIGEGEBEN DURCH: … / DATUM: …].\n- Sprache: Deutsch (Schweiz) — „ss\" statt „ß\", echte Umlaute im Fliesstext.\n- IDs bleiben bei Textänderung bestehen und werden nie wiederverwendet: Lernziel AFL-001-LZ-###, Eingangskompetenz AFL-001-EK-###.\n- Nur ein Mensch gibt frei; die KI vergibt nie „fertig\". Fehlt eine Projektdatei, benenne die Lücke — nicht rekonstruieren.\n</regeln>\n\n<kursbriefing>\n<!-- Das freigegebene Kursbriefing -->\nAus AFL-001_briefing (Schritt 1). Es ist die Leitplanke für alles Weitere — bei Widerspruch zu einer Annahme gilt das Briefing.\n\n# Kursbriefing AFL-001\n\nZielgruppe: Kundenberater\nScope: [OFFEN] Derivate\n</kursbriefing>\n\n<arbeitsweise>\nHalte dich in jedem Chat an den jeweiligen Masterprompt UND an diese Instruktionen. Bei Widerspruch gelten diese Instruktionen; benenne den Konflikt, statt ihn still aufzulösen. Bearbeite nur den angeforderten Schritt, nicht vorauseilend den nächsten.\n</arbeitsweise>";

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

/* ---------- Etappe 2, Task Z6/Z8: Projekt-Wissen-Regeln (VL-002-Fund 2026-07-30) ----------
   Zusatzauftrag Punkt 8 + Live-Einsatz an VL-002 (zweimal gescheitert): ein Claude-/
   ChatGPT-Projekt kann eine Datei-Quelle nur lesen, wenn sie als Projekt-Wissen hochgeladen
   ist — das stand nirgends im Text. (b) Eine im Projektordner liegende, nicht gelistete
   Datei (Erbrecht-PDF) hatte der Chat nur zufaellig richtig gemeldet — die Regel soll
   feststehen, nicht dem Zufall ueberlassen bleiben. (c) Der eingefrorene Projekt-Stand
   veraltet still, wenn sich die Quellenliste im Dossier aendert — die Nachziehpflicht
   gehoert in denselben Text. */

const QUELLE_D = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
                    quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: 'SSPA',
                                stand: '2025', datei: 'sspa-map-2025.pdf' }],
                    status: {}, offen: [], entschieden: [] };

test('die Datei-Quellen-als-Projekt-Wissen-Regel steht in beiden Fassungen (Punkt 8a)', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f, 'AFL-001_x', QUELLE_D)
                    .replace(/\s+/g, ' ');
    assert.ok(t.indexOf('Die Datei-Quellen liegen als Projekt-Wissen in diesem Projekt') >= 0,
      f + ': Projekt-Wissen-Satz fehlt');
    assert.ok(t.indexOf('lies nie eine andere an ihrer Stelle') >= 0, f + ': Fehlt-Regel fehlt');
  });
});

test('eine nicht gelistete Datei im Projekt-Wissen wird gemeldet, nicht genutzt (Punkt 8b)', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f, 'AFL-001_x', QUELLE_D)
                    .replace(/\s+/g, ' ');
    assert.ok(t.indexOf('NICHT in dieser Quellenliste steht') >= 0, f + ': Melde-Regel fehlt');
    assert.ok(t.indexOf('gehört zuerst in der Kurswerkstatt erfasst') >= 0,
      f + ': Erfassungs-Hinweis fehlt');
  });
});

test('Instruktionen und Projekt-Wissen sind als Dossier-Abzug gekennzeichnet — Nachziehpflicht (Punkt 8c)', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f, 'AFL-001_x', QUELLE_D)
                    .replace(/\s+/g, ' ');
    assert.ok(t.indexOf('sind ein Abzug des Kursdossiers') >= 0, f + ': Abzug-Satz fehlt');
    assert.ok(t.indexOf('nach jeder Quellen-Änderung werden Instruktionen und Projekt-Wissen ' +
                         'neu übernommen') >= 0, f + ': Nachziehpflicht fehlt');
  });
});

test('ohne Dossier fehlen auch die drei Projekt-Wissen-Regeln', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x');
  assert.doesNotMatch(t, /Projekt-Wissen/);
});

/* ---------- Fix-Runde 1 (Review): Satz 1 ist eine Ist-Behauptung ("Die Datei-Quellen liegen
   als Projekt-Wissen in diesem Projekt.") — unconditional kollidierte er im Modus quellenfrei
   mit "es liegen keine validen Fachquellen vor" und behauptete bei leerer/reiner Link-Liste
   einen Bestand, den es nicht gibt. Fix: Satz 1 nur, wenn mindestens eine Datei-Quelle im
   Dossier steht (dieselbe Datei-Filterung wie bei der PROJEKT-WISSEN-Zeile in
   lernzielePromptKopf/T13 — inhalt.js baut sie bewusst selbst, statt dossier.js zu importieren).
   Regel 2 (nicht gelistete Datei im Projekt-Wissen melden) und Regel 3 (Dossier ist massgebend,
   Nachziehpflicht) bleiben unconditional — sie sind reine Verhaltensregeln, keine
   Ist-Behauptungen, und gelten unabhaengig davon, ob gerade eine Datei-Quelle vorliegt. */

test('ohne Datei-Quellen (Modus quellenfrei) fehlt die Ist-Behauptung — Regel 2/3 bleiben (Fix-Runde 1)', () => {
  const dQuellenfrei = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellenfrei',
                          quellen: [], status: {}, offen: [], entschieden: [] };
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f, 'AFL-001_x', dQuellenfrei)
                    .replace(/\s+/g, ' ');
    assert.ok(t.indexOf('Die Datei-Quellen liegen als Projekt-Wissen in diesem Projekt') < 0,
      f + ': Ist-Behauptung steht trotz fehlender Datei-Quellen (kollidiert mit quellenfrei)');
    assert.ok(t.indexOf('NICHT in dieser Quellenliste steht') >= 0, f + ': Regel 2 fehlt');
    assert.ok(t.indexOf('sind ein Abzug des Kursdossiers') >= 0, f + ': Regel 3 fehlt');
  });
});

test('ohne Datei-Quellen (leere Liste, quellengestuetzt) fehlt die Ist-Behauptung ebenso (Fix-Runde 1)', () => {
  const dLeer = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
                  quellen: [], status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', dLeer)
                  .replace(/\s+/g, ' ');
  assert.ok(t.indexOf('Die Datei-Quellen liegen als Projekt-Wissen in diesem Projekt') < 0,
    'Ist-Behauptung steht trotz leerer Quellenliste');
});

test('eine reine Link-Quelle (keine Datei) loest ebenfalls keine Ist-Behauptung aus (Fix-Runde 1)', () => {
  const dLinkOnly = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
                       quellen: [{ id: 'Q-001', titel: 'Ausschreibung', herausgeber: 'SSPA',
                                   stand: '2026', url: 'https://sspa.ch/ausschreibung',
                                   abgerufen: '2026-07-30' }],
                       status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', dLinkOnly)
                  .replace(/\s+/g, ' ');
  assert.ok(t.indexOf('Die Datei-Quellen liegen als Projekt-Wissen in diesem Projekt') < 0,
    'Ist-Behauptung steht trotz reiner Link-Quelle');
});

test('mit mindestens einer Datei-Quelle steht die Ist-Behauptung wie zuvor (Gegenprobe, Fix-Runde 1)', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x', QUELLE_D)
                  .replace(/\s+/g, ' ');
  assert.ok(t.indexOf('Die Datei-Quellen liegen als Projekt-Wissen in diesem Projekt') >= 0,
    'Ist-Behauptung fehlt trotz vorhandener Datei-Quelle');
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
   ChatGPT nach verschiedenen Regeln, ohne dass es jemand merkt.
   K1 (Etappe 4): die EINE geplante Ausnahme ist der kursbriefing-Teil — die
   ChatGPT-Kompaktfassung ersetzt ihn durch einen Verweis auf die Projekt-
   Wissen-Datei (s. u.), jeder andere Teil bleibt wortgleich in beiden. */
test('beide Fassungen tragen denselben Inhalt — ausser dem kursbriefing-Teil, den die ChatGPT-Kompaktfassung seit K1 nur noch verweist', () => {
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
    if (t.tag === 'kursbriefing') return;
    assert.ok(flach(g).indexOf(inhaltsblock) >= 0, 'ChatGPT fehlt: ' + t.tag);
  });
});

test('beide Fassungen tragen die Vorrangregel gegenueber den Masterprompts', () => {
  ['claude', 'chatgpt'].forEach(function (f) {
    const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, f).replace(/\s+/g, ' ');
    assert.ok(t.indexOf('Bei Widerspruch gelten diese Instruktionen') >= 0, f);
  });
});

test('die Claude-Fassung traegt das Briefing woertlich, die ChatGPT-Kompaktfassung verweist nur noch darauf (K1)', () => {
  const c = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude');
  assert.ok(c.indexOf(BRIEFING) >= 0, 'Claude: Briefing fehlt');
  const g = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'chatgpt');
  assert.ok(g.indexOf(BRIEFING) < 0, 'ChatGPT-Kompaktfassung traegt den Briefing-Volltext trotzdem');
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

/* Der Waechter-Test fuer I3: der Fachquellen-Pfad ('Dateien in .../quellen/')
   stand bis jetzt woertlich als '03_content/quellen' im Quelltext von
   inhalt.js — genau die Art Staleness-Falle wie bei den alten Ordnern oben,
   nur unentdeckt, weil kein Test je einen abweichenden Schritt-3-Ordner
   probierte. inhalt.quellenOrdner() liest ihn jetzt aus dem Kontrakt; dieser
   Test aendert Schritt 3 und verlangt, dass '03_content' NIRGENDS mehr im
   erzeugten Text steht — nicht nur, dass der neue Ordner zusaetzlich auftaucht. */
test('aendert sich der Schritt-3-Ordner, folgt der Fachquellen-Pfad mit — 03_content taucht nirgends mehr auf (Audit I3)', () => {
  const anders = JSON.parse(JSON.stringify(INHALT));
  anders['ablage-kontrakt'].schritte['3'].ordner = '99_anders';
  const d = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
              quellen: [{ id: 'Q-001', titel: 'SSPA Map', herausgeber: 'SSPA', stand: '2025',
                          datei: 'sspa-map.pdf' }],
              status: {}, offen: [], entschieden: [] };
  const t = inhalt.projektInstruktionen(anders, AFL, BRIEFING, 'claude', 'AFL-001_x', d);
  assert.ok(t.indexOf('99_anders/quellen') >= 0, 'folgt dem geaenderten Schritt-3-Ordner nicht');
  assert.ok(t.indexOf('03_content') < 0, 'traegt den alten Ordner trotzdem noch — die v0.2-Falle');
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
  assert.ok(/\(chat, claude-code, hand\)/.test(z2), 'Wege bei Schritt 2 fehlen: ' + z2);
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

/* ---------- Etappe 4, Task K1: ChatGPT-Kompaktfassung + Projekt-Wissen-Langfassung ----------
   Live-Befund: die generierten ChatGPT-Projekt-Instruktionen ueberschreiten mit dem
   eingebetteten Briefing-Volltext locker die 8000-Zeichen-Grenze des ChatGPT-
   Instruktionsfelds — >15'000 Zeichen waren gemessen. Die Kompaktfassung
   (projektInstruktionen(..., 'chatgpt', ...)) ersetzt darum NUR den
   kursbriefing-Teil durch einen Verweis auf die Projekt-Wissen-Datei;
   projektInstruktionenLang() liefert die bisherige Vollfassung fuer genau diese
   herunterladbare Datei. Der Claude-Zweig bleibt unveraendert — er geht nicht
   ueber ein laengenbeschraenktes Formularfeld. */

test('K1 (a): die Kompaktfassung traegt das Briefing NICHT, wohl aber den Verweis mit dem Dateinamen', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'chatgpt', 'AFL-001_x');
  assert.ok(t.indexOf(BRIEFING) < 0, 'Briefing-Volltext steht trotzdem in der Kompaktfassung');
  assert.strictEqual(inhalt.projektWissenDateiname(AFL), 'AFL-001_projekt-instruktionen.md');
  assert.ok(t.indexOf(inhalt.projektWissenDateiname(AFL)) >= 0,
    'Verweis auf die Projekt-Wissen-Datei (GENAU der Dateiname) fehlt');
});

test('K1 (b): ein sehr langes Briefing aendert die Laenge der Kompaktfassung nicht', () => {
  const kurz = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'chatgpt', 'AFL-001_x');
  const langesBriefing = '# Kursbriefing\n\n' + 'x'.repeat(20000);
  const lang = inhalt.projektInstruktionen(INHALT, AFL, langesBriefing, 'chatgpt', 'AFL-001_x');
  assert.strictEqual(lang.length, kurz.length,
    'Kompaktfassung waechst mit dem Briefing — haengt noch am Volltext, statt nur zu verweisen');
});

test('K1 (c): projektInstruktionenLang traegt den Briefing-Volltext weiterhin, im ChatGPT-Schema', () => {
  const t = inhalt.projektInstruktionenLang(INHALT, AFL, BRIEFING, 'AFL-001_x');
  assert.ok(t.indexOf(BRIEFING) >= 0, 'Briefing-Volltext fehlt in der Langfassung');
  assert.ok(/=== \d+\. KURSBRIEFING ===/i.test(t) || t.indexOf('=== ') >= 0,
    'Langfassung traegt nicht das ChatGPT-Trennschema');
});

test('K1 (d): die Claude-Fassung ist byte-identisch zu vor dem Umbau (Fixture-Vergleich)', () => {
  const t = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'claude', 'AFL-001_x');
  assert.strictEqual(t, CLAUDE_FIXTURE);
});

test('K1 (e): die Ansicht zeigt die Zeichenzahl, den Achtung-Kasten erst ab 8000 Zeichen und den Download-Knopf — alle drei nur in der ChatGPT-Fassung (Fix-Runde 1)', () => {
  const hKurz = ansichten.einSchritt(INHALT, AFL, 1, null,
    { ordnerFehlt: false, briefing: BRIEFING, ordnerName: 'AFL-001_x' });
  /* Praeziser als ein generisches /\d+ Zeichen/ — der Block zeigt auch die
     Laenge des rohen, eingelesenen Briefings ("Briefing ... N Zeichen"),
     das darf hier nicht faelschlich als Beleg fuer den NEUEN Zaehler zaehlen. */
  assert.ok(/ChatGPT-Kompaktfassung: \d+ Zeichen/.test(hKurz), 'Zeichenzahl der Kompaktfassung fehlt');
  assert.ok(hKurz.indexOf('zu lang für das ChatGPT-Feld') < 0,
    'Achtung-Kasten zeigt sich, obwohl die Kompaktfassung kurz ist');
  assert.ok(/data-action="instruktionen-herunterladen"/.test(hKurz), 'Download-Knopf fehlt');
  assert.ok(hKurz.indexOf('Projekt-Wissen-Datei herunterladen') >= 0, 'Knopfbeschriftung fehlt/weicht ab');

  /* Fix-Runde 1 (Review-Finding): Zaehler/Knopf duerfen nicht IMMER sichtbar
     sein, sondern nur, wenn die ChatGPT-Fassung aktiv ist — derselbe
     data-box="chatgpt"-Umschalter wie bei der ChatGPT-.prompt-Box selbst
     (app.js, data-action="fassung" schaltet jedes Element mit passendem
     data-box mit). Ein Container ohne "on"-Klasse beim Initial-Render (Claude
     ist Default-Tab, fass[0]) belegt, dass der Block anfangs verdeckt ist. */
  const fassboxIdx = hKurz.indexOf('<div class="fassbox" data-box="chatgpt">');
  assert.ok(fassboxIdx >= 0,
    'Meta-Block traegt keinen data-box="chatgpt"-Container ohne "on" — waere immer sichtbar, auch im Claude-Tab');
  assert.ok(hKurz.indexOf('<div class="fassbox on" data-box="chatgpt">') < 0,
    'fassbox traegt beim Initial-Render die "on"-Klasse — Claude ist der Default-Tab, der Block muesste verdeckt starten');

  const zaehlerIdx = hKurz.indexOf('ChatGPT-Kompaktfassung: ', fassboxIdx);
  const knopfIdx = hKurz.indexOf('data-action="instruktionen-herunterladen"', fassboxIdx);
  assert.ok(zaehlerIdx > fassboxIdx && zaehlerIdx - fassboxIdx < 200,
    'Zeichenzahl steht nicht (mehr) innerhalb des fassbox-Containers — der immer-sichtbare Teil traegt sie faelschlich');
  assert.ok(knopfIdx > fassboxIdx && knopfIdx - fassboxIdx < 300,
    'Download-Knopf steht nicht (mehr) innerhalb des fassbox-Containers — der immer-sichtbare Teil traegt ihn faelschlich');

  /* Derselbe data-box="chatgpt"-Wert traegt bereits die ChatGPT-.prompt-Box
     (fass.map in instruktionenBlock) — der neue Container dockt an GENAU
     diesem Attribut an (ein zweites Element mit demselben Wert), statt einen
     eigenen, zweiten Umschalt-Mechanismus zu erfinden. */
  const ersterTreffer = hKurz.indexOf('data-box="chatgpt"');
  const zweiterTreffer = hKurz.indexOf('data-box="chatgpt"', ersterTreffer + 1);
  assert.ok(ersterTreffer >= 0 && zweiterTreffer > ersterTreffer,
    'Es gibt nur EIN data-box="chatgpt"-Element — die Kopplung an die bestehende .prompt-Box fehlt');

  /* Ein Dossier mit sehr vielen Quellen blaeht die Kompaktfassung ueber 8000
     Zeichen auf, OHNE dass der Briefing-Volltext je hineinginge (b) — der
     realistische Weg, wie die Grenze in der Kompaktfassung ueberhaupt noch
     erreicht wird. */
  const vieleQuellen = [];
  for (let n = 1; n <= 150; n++) {
    vieleQuellen.push({ id: 'Q-' + String(n).padStart(3, '0'),
      titel: 'Quelle Nr. ' + n + ' mit einem langen Titel zum Aufblasen der Kompaktfassung',
      herausgeber: 'Herausgeber ' + n, stand: '2026', datei: 'quelle-' + n + '.pdf' });
  }
  const dGross = { dossier: 1, kurs: 'AFL-001', scope: {}, content_modus: 'quellengestuetzt',
    quellen: vieleQuellen, status: {}, offen: [], entschieden: [] };
  const laenge = inhalt.projektInstruktionen(INHALT, AFL, BRIEFING, 'chatgpt', 'AFL-001_x', dGross).length;
  assert.ok(laenge >= 8000, 'Testvoraussetzung: Kompaktfassung muss >= 8000 Zeichen erreichen — ist ' + laenge);
  const hLang = ansichten.einSchritt(INHALT, AFL, 1, null,
    { ordnerFehlt: false, briefing: BRIEFING, ordnerName: 'AFL-001_x', dossier: dGross });
  assert.ok(hLang.indexOf('zu lang für das ChatGPT-Feld') >= 0,
    'Achtung-Kasten fehlt trotz einer Kompaktfassung ueber 8000 Zeichen');
  /* Der Achtung-Kasten muss ebenfalls im selben, an ChatGPT gekoppelten
     Container stehen — sonst waere GENAU der Kasten, den Fix-Runde 1
     bemaengelte, wieder ausserhalb des Umschalters gelandet. */
  const fassboxIdxLang = hLang.indexOf('<div class="fassbox" data-box="chatgpt">');
  const kastenIdx = hLang.indexOf('Zu lang für ChatGPT', fassboxIdxLang);
  assert.ok(fassboxIdxLang >= 0 && kastenIdx > fassboxIdxLang,
    'Achtung-Kasten steht nicht innerhalb des fassbox-Containers');
});
