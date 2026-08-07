const test = require('node:test');
const assert = require('node:assert');

/* Ladereihenfolge wie index.html (F3, Etappe 5): zip-lesen vor zip-schreiben
   vor skript-schema vor skript-lesen vor didaktik-schema vor didaktik-lesen
   vor didaktik-drehbuch — Muster test/docxbauen.test.js. */
require('../zip-lesen.js');
require('../zip-schreiben.js');
require('../skript-schema.js');
require('../skript-lesen.js');
require('../didaktik-schema.js');
require('../didaktik-lesen.js');
const { zipLesen } = require('../zip-lesen.js');
const { zipSchreiben } = require('../zip-schreiben.js');
const { skriptLesen } = require('../skript-lesen.js');
const { didaktikLesen } = require('../didaktik-lesen.js');
const { didaktikDrehbuch } = require('../didaktik-drehbuch.js');

/* ---------- Mini-Vorlage (Muster test/docxbauen.test.js vorlageBauen(),
   hier ohne rels/Content-Types — didaktik-drehbuch.js bettet keine Bilder
   ein, es gibt nichts anzupassen). ---------- */

const STYLES_XML = '<w:styles>' +
  '<w:style w:styleId="Titel"><w:name w:val="Title"/></w:style>' +
  '<w:style w:styleId="berschrift1"><w:name w:val="heading 1"/></w:style>' +
  '<w:style w:styleId="Merksatz"><w:name w:val="Merksatz"/></w:style>' +
  '<w:style w:styleId="Fehlvorstellung"><w:name w:val="Fehlvorstellung"/></w:style>' +
  '<w:style w:styleId="Quelle"><w:name w:val="Quelle"/></w:style>' +
  '</w:styles>';

function vorlageBauen(opts) {
  opts = opts || {};
  const sectPr = opts.ohneSectPr ? '' :
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr>';
  const docXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>Alter Inhalt, wird ersetzt</w:t></w:r></w:p>' +
    sectPr +
    '</w:body></w:document>';
  const eintraege = [
    { name: 'word/document.xml', daten: docXml },
    { name: 'word/styles.xml', daten: STYLES_XML }
  ];
  const buf = zipSchreiben.baue(eintraege);
  return buf.buffer;
}

/* Eigene Kopie der Escaping-Regel (Task-Brief: Module teilen keinen Code
   ueber Globals hinaus) — fuer den Bau ERWARTETER Substrings in den Tests,
   nicht fuer die Produktion selbst. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- Fixtures ueber die ECHTEN Parser (kein Handbau der
   gelesen-Objekte, Muster jeder Etappe-4/5-Testdatei). ---------- */

function contentText(opts) {
  opts = opts || {};
  const kurs = opts.kurs || 'AFL-001';
  return [
    '###SKRIPT kurs=' + kurs + ' | variante=claude | titel=Testtitel | rechtsstand=1.1.2026',
    '###KAPITEL nr=1 | ek=AFL-001-EK-001 | titel=Erstes Kapitel | bloom=2 | richtzeit=20',
    '###ENDE-KAPITEL'
  ].join('\n');
}

function contractText(opts) {
  opts = opts || {};
  const ek = opts.ek || 'AFL-001-EK-001';
  const nr = opts.nr || 1;
  const typ = opts.typ || 'regler';
  if (typ === 'fliesstext') {
    return [
      '###CONTRACT ek=' + ek + ' | nr=' + nr + ' | typ=fliesstext',
      'kernaussage: ' + (opts.kernaussage || 'Kernaussage.'),
      'zielhandlung: Zielhandlung-Text.',
      'denkfehler: ' + (opts.denkfehler || 'Denkfehler-Text.'),
      'stuetztext: Stütztext-Inhalt.',
      'begruendung: ' + (opts.begruendung || 'Bewusst kein Modell.'),
      '###ENDE-CONTRACT'
    ].join('\n');
  }
  return [
    '###CONTRACT ek=' + ek + ' | nr=' + nr + ' | typ=' + typ,
    'kernaussage: ' + (opts.kernaussage || 'Kernaussage-Text.'),
    'zielhandlung: Regler bewegen und den Effekt beobachten.',
    'denkfehler: ' + (opts.denkfehler || 'Ein verbreiteter Irrtum.'),
    'stuetztext: Stütztext-Inhalt.',
    'steuert: den Selbstbehalt in Franken',
    'beobachtet: die monatliche Prämie',
    'aha: bei kleinen Selbstbehalten ändert sich wenig',
    'vorhersage: Wie stark sinkt die Prämie?',
    'konsequenz: Ein zu hoher Selbstbehalt kann das Budget sprengen.',
    '###ENDE-CONTRACT'
  ].join('\n');
}

function punkteBlock(eintraege) {
  const lines = ['###PUNKTE'];
  eintraege.forEach(function (e) {
    lines.push('punkt: ' + e.punkt);
    if (e.entscheid) lines.push('entscheid: ' + e.entscheid);
    if (e.verschieben) {
      lines.push('verschieben: ' + e.verschieben);
      lines.push('begruendung: ' + (e.begruendung || 'Begruendung.'));
    }
  });
  return lines.join('\n');
}

function didaktikText(opts) {
  opts = opts || {};
  const kurs = opts.kurs || 'AFL-001';
  const basiertAuf = opts.basiertAuf === undefined ? 'AFL-001_content_final.blocks' : opts.basiertAuf;
  const kopf = '###CONTRACTS kurs=' + kurs + (basiertAuf ? ' | basiert_auf=' + basiertAuf : '');
  const contracts = (opts.contracts || [contractText()]).join('\n');
  let text = [kopf, contracts].join('\n');
  if (opts.punkte) text += '\n' + opts.punkte;
  return text;
}

/* Sucht die XML-Zeichenkette fuer einen Absatz mit gegebenem pStyle,
   gefolgt (unmittelbar oder mit weiteren Runs dazwischen) vom erwarteten
   Text — genuegt fuer die einfachen Ein-Absatz-Faelle dieser Tests. */
function hatAbsatzMitStilUndText(xml, styleId, text) {
  const nadel = '<w:pStyle w:val="' + styleId + '"/></w:pPr><w:r><w:t xml:space="preserve">' + esc(text);
  return xml.indexOf(nadel) >= 0;
}

/* ---------- (a) voller Contract: H1, Meta-Zeile, alle sechs
   Dramaturgie-Beschriftungen, kernaussage (Merksatz), denkfehler
   (Fehlvorstellung) ---------- */
test('F3 (a): document.xml traegt je Contract H1 mit Kapitel-Titel, Meta-Zeile, alle sechs Dramaturgie-Beschriftungen, kernaussage/denkfehler im richtigen Stil', async () => {
  const vorlage = vorlageBauen();
  const gelesen = didaktikLesen.lies(didaktikText());
  assert.deepStrictEqual(gelesen.fehler, [], 'Testvoraussetzung: Fixture selbst fehlerfrei');
  const contentGelesen = skriptLesen.lies(contentText());

  const out = await didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen);
  const zip = zipLesen.oeffne(out.buffer);
  const xml = await zip.lies('word/document.xml');

  assert.ok(hatAbsatzMitStilUndText(xml, 'Titel', 'Interaktions-Drehbuch · AFL-001'), 'Titel-Absatz fehlt');
  assert.ok(xml.indexOf('Basis: AFL-001_content_final.blocks · 1 Interaktions-Contracts') >= 0, 'Basis-Zeile fehlt');
  assert.ok(hatAbsatzMitStilUndText(xml, 'berschrift1', 'Kapitel 1 · Erstes Kapitel'), 'H1 mit Kapitel-Titel fehlt');
  assert.ok(hatAbsatzMitStilUndText(xml, 'Quelle', 'AFL-001-EK-001 · Interaktionstyp: regler'), 'Meta-Zeile fehlt');

  ['Zielhandlung:', 'Einstiegsfrage:', 'Du stellst ein:', 'Du siehst:', 'Der Aha-Moment:', 'Auflösung:']
    .forEach(function (label) {
      const nadel = '<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + esc(label) + '</w:t>';
      assert.ok(xml.indexOf(nadel) >= 0, 'Dramaturgie-Beschriftung fehlt: ' + label);
    });

  assert.ok(hatAbsatzMitStilUndText(xml, 'Merksatz', 'Kernaussage-Text.'), 'kernaussage nicht im Merksatz-Stil');
  assert.ok(hatAbsatzMitStilUndText(xml, 'Fehlvorstellung', 'Typischer Denkfehler: Ein verbreiteter Irrtum.'),
    'denkfehler nicht im Fehlvorstellung-Stil');
  assert.ok(hatAbsatzMitStilUndText(xml, 'Quelle', 'Stütztext: Stütztext-Inhalt.'), 'stuetztext nicht im Quelle-Stil');
});

/* ---------- (b) fliesstext: Begruendungs-Zeile statt Dramaturgie ---------- */
test('F3 (b): typ fliesstext zeigt die Begruendungs-Zeile statt der sechs Dramaturgie-Zeilen', async () => {
  const vorlage = vorlageBauen();
  const gelesen = didaktikLesen.lies(didaktikText({
    contracts: [contractText({ ek: 'AFL-001-EK-001', nr: 1, typ: 'fliesstext', begruendung: 'Kein Modell noetig.' })]
  }));
  assert.deepStrictEqual(gelesen.fehler, [], 'Testvoraussetzung: Fixture selbst fehlerfrei');
  const contentGelesen = skriptLesen.lies(contentText());

  const out = await didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen);
  const zip = zipLesen.oeffne(out.buffer);
  const xml = await zip.lies('word/document.xml');

  assert.ok(hatAbsatzMitStilUndText(xml, 'Fehlvorstellung',
    'Bewusste Ausnahme ohne Interaktion — Begründung: Kein Modell noetig.'),
    'Begruendungs-Zeile fehlt oder falscher Stil');
  /* Keine der sechs Dramaturgie-Beschriftungen darf auftauchen — fliesstext
     hat kein Modell (kein steuert:/beobachtet:/aha:/vorhersage:/konsequenz:
     im Contract, didaktik-schema.js). */
  ['Zielhandlung:', 'Einstiegsfrage:', 'Du stellst ein:', 'Du siehst:', 'Der Aha-Moment:', 'Auflösung:']
    .forEach(function (label) {
      assert.ok(xml.indexOf(esc(label)) < 0, 'Dramaturgie-Beschriftung haette bei fliesstext fehlen muessen: ' + label);
    });
});

/* ---------- (c) XML-Fremdwert-Probe ---------- */
test('F3 (c): & < > in kernaussage stehen escaped im XML, kein rohes < oder >', async () => {
  const vorlage = vorlageBauen();
  const gelesen = didaktikLesen.lies(didaktikText({
    contracts: [contractText({ kernaussage: 'A & B < C > D' })]
  }));
  assert.deepStrictEqual(gelesen.fehler, [], 'Testvoraussetzung: Fixture selbst fehlerfrei');
  const contentGelesen = skriptLesen.lies(contentText());

  const out = await didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen);
  const zip = zipLesen.oeffne(out.buffer);
  const xml = await zip.lies('word/document.xml');

  assert.ok(xml.indexOf('A &amp; B &lt; C &gt; D') >= 0, 'escapter Wert fehlt');
  assert.ok(xml.indexOf('A & B < C > D') < 0, 'roher, nicht escapter Wert steht im XML');
});

/* ---------- (d) Punkte-Sektion mit entscheid UND verschoben ---------- */
test('F3 (d): Punkte-Sektion listet je Punkt "- {punkt}" plus Entscheid- bzw. Verschoben-Zeile', async () => {
  const vorlage = vorlageBauen();
  const gelesen = didaktikLesen.lies(didaktikText({
    punkte: punkteBlock([
      { punkt: 'Punkt A — entschieden.', entscheid: 'So beschlossen.' },
      { punkt: 'Punkt B — verschoben.', verschieben: 'schritt-6', begruendung: 'Gehoert dorthin.' }
    ])
  }));
  assert.deepStrictEqual(gelesen.fehler, [], 'Testvoraussetzung: Fixture selbst fehlerfrei');
  assert.strictEqual(gelesen.punkte.length, 2, 'Testvoraussetzung: zwei Punkte geparst');
  const contentGelesen = skriptLesen.lies(contentText());

  const out = await didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen);
  const zip = zipLesen.oeffne(out.buffer);
  const xml = await zip.lies('word/document.xml');

  assert.ok(hatAbsatzMitStilUndText(xml, 'berschrift1', 'Behandelte offene Punkte'), 'Punkte-Ueberschrift fehlt');
  assert.ok(xml.indexOf('- Punkt A — entschieden.') >= 0, 'Punkt-A-Zeile fehlt');
  assert.ok(xml.indexOf('Entscheid: So beschlossen.') >= 0, 'Entscheid-Zeile fehlt');
  assert.ok(xml.indexOf('- Punkt B — verschoben.') >= 0, 'Punkt-B-Zeile fehlt');
  assert.ok(xml.indexOf('Verschoben an schritt-6: Gehoert dorthin.') >= 0, 'Verschoben-Zeile fehlt');
});

test('F3: ohne Punkte bleibt die Punkte-Sektion ganz weg', async () => {
  const vorlage = vorlageBauen();
  const gelesen = didaktikLesen.lies(didaktikText());
  const contentGelesen = skriptLesen.lies(contentText());
  const out = await didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen);
  const zip = zipLesen.oeffne(out.buffer);
  const xml = await zip.lies('word/document.xml');
  assert.ok(xml.indexOf('Behandelte offene Punkte') < 0);
});

/* ---------- (e) styles.xml byte-identisch, sectPr genau einmal ---------- */
test('F3 (e): styles.xml wird byte-identisch durchgereicht, sectPr steht genau einmal im Ergebnis', async () => {
  const vorlage = vorlageBauen();
  const gelesen = didaktikLesen.lies(didaktikText());
  const contentGelesen = skriptLesen.lies(contentText());

  const out = await didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen);
  const zip = zipLesen.oeffne(out.buffer);

  const stylesZurueck = await zip.liesBytes('word/styles.xml');
  const stylesOriginal = new TextEncoder().encode(STYLES_XML);
  assert.deepStrictEqual(stylesZurueck, stylesOriginal, 'styles.xml ist nicht byte-identisch');

  const xml = await zip.lies('word/document.xml');
  const treffer = xml.match(/<w:sectPr/g) || [];
  assert.strictEqual(treffer.length, 1, 'sectPr sollte genau einmal vorkommen');
});

/* ---------- (f) Vorlage ohne sectPr -> Abbruch ---------- */
test('F3 (f): eine Vorlage ohne <w:sectPr> wird abgelehnt', async () => {
  const vorlage = vorlageBauen({ ohneSectPr: true });
  const gelesen = didaktikLesen.lies(didaktikText());
  const contentGelesen = skriptLesen.lies(contentText());
  await assert.rejects(didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen), /sectPr/);
});

test('F3: eine Vorlage ohne word/document.xml wird abgelehnt', async () => {
  const buf = zipSchreiben.baue([{ name: 'word/styles.xml', daten: STYLES_XML }]);
  const gelesen = didaktikLesen.lies(didaktikText());
  const contentGelesen = skriptLesen.lies(contentText());
  await assert.rejects(didaktikDrehbuch.baue(buf.buffer, gelesen, contentGelesen), /document\.xml/);
});

/* ---------- (g) ohne Content-Match: H1 = ek ---------- */
test('F3 (g): findet sich im Content kein Kapitel mit derselben ek, faellt H1 auf die ek zurueck', async () => {
  const vorlage = vorlageBauen();
  const gelesen = didaktikLesen.lies(didaktikText({
    contracts: [contractText({ ek: 'AFL-001-EK-999', nr: 1 })]
  }));
  assert.deepStrictEqual(gelesen.fehler, [], 'Testvoraussetzung: Fixture selbst fehlerfrei');
  const contentGelesen = skriptLesen.lies(contentText()); // kennt nur AFL-001-EK-001

  const out = await didaktikDrehbuch.baue(vorlage, gelesen, contentGelesen);
  const zip = zipLesen.oeffne(out.buffer);
  const xml = await zip.lies('word/document.xml');

  assert.ok(hatAbsatzMitStilUndText(xml, 'berschrift1', 'AFL-001-EK-999'), 'H1 sollte auf die ek zurueckfallen');
  assert.ok(xml.indexOf('Kapitel  ·') < 0, 'kein halb ausgefuelltes "Kapitel · "-Muster erwartet');
});
