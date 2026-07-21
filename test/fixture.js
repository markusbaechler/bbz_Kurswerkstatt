/* Testdaten. Bildet die Struktur der echten Dateien aus Kursproduktion/_zentral ab,
   enthaelt aber KEINE echten Masterprompt-Texte — die bleiben hinter der Anmeldung. */
(function (root) {
  'use strict';

  function schritt(id, nm, extra) {
    return Object.assign({
      id: String(id), nm: nm,
      zweck: 'Zweck von Schritt ' + id + '.',
      input: 'Eingang fuer Schritt ' + id + '.',
      taet: ['Erste Taetigkeit', 'Zweite Taetigkeit'],
      lief: 'Lieferobjekt ' + id,
      abl: 'Ablage-Hinweis ' + id,
      auto: 'ki',
      her: [{ was: 'Vorgaenger-Ergebnis', von: id > 1 ? id - 1 : null }],
      hin: [{ was: 'Nachfolger-Eingang', an: id < 9 ? id + 1 : null }],
      wege: ['B', 'C']
    }, extra || {});
  }

  var INHALT = {
    'ablage-kontrakt': {
      version: 2,
      benennung: { muster: '{K}_{lieferobjekt}_v{N}.{ext}', final: '{K}_{lieferobjekt}_final.{ext}' },
      gate_datei: '_gate.md',
      schritte: {
        '1': { ordner: '01_briefing', lieferobjekt: 'briefing', ext: 'md', format: 'text', wege: ['B','C'], gate: null },
        '2': { ordner: '02_setup', datei: '{K}_manifest.json', format: 'json', wege: ['kurswerkstatt'], gate: null },
        '3': { ordner: '03_contract', lieferobjekt: 'lernziele-drehbuch', ext: 'xlsx', format: 'excel', wege: ['C','hand'], gate: 'Gate 1 · 4-Augen' },
        '4': { ordner: '04_greenfield', lieferobjekt: 'greenfield', ext: 'md', format: 'text', wege: ['B','C'], gate: null },
        '5': { ordner: '05_content', lieferobjekt: 'content', ext: 'md', format: 'text', wege: ['B','C'], gate: null },
        '6': { ordner: '05_content', lieferobjekt: 'content', ext: 'md', format: 'text', wege: ['B','C'], gate: 'Sign-off' },
        '7': { ordner: '06_moodle', datei: '{K}_export.mbz', format: 'binaer', wege: ['C'], gate: null },
        '8': { ordner: '07_abnahme', lieferobjekt: 'abnahme', ext: 'md', format: 'text', wege: ['kurswerkstatt'], gate: 'Gate 2 · Schluss' },
        '9': { ordner: '08_backbone', datei: '{K}_publiziert.md', format: 'text', wege: ['B','C'], gate: null }
      }
    },

    schritte: {
      autoMeta: {
        ki:       { label: 'KI-generiert',  who: 'Der Masterprompt erzeugt den Entwurf.' },
        kimensch: { label: 'KI + Sign-off', who: 'Die KI liefert, ein Fachexperte gibt frei.' },
        mensch:   { label: 'Fachurteil',    who: 'Bewusst menschlich, nicht delegierbar.' },
        auto:     { label: 'Automatisiert', who: 'Skript baut, Mensch prueft technisch.' }
      },
      phasen: [
        { nm: 'Vorbereiten',        ids: ['1','2'] },
        { nm: 'Festlegen',          ids: ['3'] },
        { nm: 'Inhalt entwerfen',   ids: ['4','5','6'] },
        { nm: 'Strecke bauen',      ids: ['7'] },
        { nm: 'Abnehmen & sichern', ids: ['8','9'] }
      ],
      schritte: [
        schritt(1, 'Kursbriefing', { auto: 'kimensch', tool: 'claude' }),
        schritt(2, 'Kurs-Projekt & Ablage anlegen', { auto: 'kimensch' }),
        schritt(3, 'Lernzielkatalog + Eingangskompetenzen', { auto: 'mensch', tool: 'claude', gate: 'Gate 1 · 4-Augen' }),
        schritt(4, 'Green-field W-Content', { auto: 'ki', tool: 'claude' }),
        schritt(5, 'Screening & Gap-Analyse', { auto: 'ki', tool: 'chatgpt' }),
        schritt(6, 'Verdichtung & Umsetzung', { auto: 'kimensch', tool: 'claude', gate: 'Sign-off' }),
        schritt(7, 'Moodle-Selbstlernstrecke', { auto: 'auto', wege: ['C'] }),
        schritt(8, 'Fach-Review & Freigabe', { auto: 'mensch', gate: 'Gate 2 · Schluss' }),
        schritt(9, 'Kuratierung & Backbone', { auto: 'auto' })
      ]
    },

    werkzeuge: {
      typMeta: {
        guide:    { short: 'Anleitung', label: 'Schritt-fuer-Schritt-Anleitung', pl: 'Anleitungen' },
        prompt:   { short: 'Prompt',    label: 'Masterprompt',                   pl: 'Masterprompts' },
        template: { short: 'Vorlage',   label: 'Muster-Template',                pl: 'Muster-Templates' }
      },
      schrittWerkzeuge: {
        '1': ['guide-1'], '2': ['guide-2'], '3': ['guide-3', 'tpl-contract'],
        '4': ['guide-4', 'prompt-greenfield'], '5': ['guide-5'], '6': ['guide-6'],
        '7': ['guide-7'], '8': ['guide-8'], '9': ['guide-9']
      },
      liste: [
        { id: 'guide-4', type: 'guide', stage: '4', title: 'Anleitung Schritt 4',
          sub: 'Green-field-Entwurf erstellen',
          steps: ['Prompt kopieren', 'Eingangskompetenzen einsetzen', 'An die KI senden'],
          dos: ['Bei den Lernzielen bleiben'], donts: ['Kein Altmaterial mitgeben'],
          dod: 'Je Eingangskompetenz ein Entwurf, als unvalidiert markiert.' },
        { id: 'prompt-greenfield', type: 'prompt', stage: '4', title: 'Masterprompt Green-field',
          sub: 'Idealen W-Content je EK entwerfen',
          when: '<b>Wann:</b> nach Gate 1.',
          claude: '<rolle>PLATZHALTER — der echte Prompt liegt in SharePoint</rolle>',
          chatgpt: '=== ROLLE ===\nPLATZHALTER' },
        { id: 'tpl-contract', type: 'template', stage: '3', title: 'Vorlage Lernziele & Drehbuch',
          sub: 'Drei Blaetter',
          tables: [{ cols: ['Lernziel-ID', 'Thema', 'Bloom-Stufe'] }] },
        { id: 'guide-1', type: 'guide', stage: '1', title: 'Anleitung Schritt 1', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' },
        { id: 'guide-2', type: 'guide', stage: '2', title: 'Anleitung Schritt 2', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' },
        { id: 'guide-3', type: 'guide', stage: '3', title: 'Anleitung Schritt 3', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' },
        { id: 'guide-5', type: 'guide', stage: '5', title: 'Anleitung Schritt 5', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' },
        { id: 'guide-6', type: 'guide', stage: '6', title: 'Anleitung Schritt 6', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' },
        { id: 'guide-7', type: 'guide', stage: '7', title: 'Anleitung Schritt 7', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' },
        { id: 'guide-8', type: 'guide', stage: '8', title: 'Anleitung Schritt 8', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' },
        { id: 'guide-9', type: 'guide', stage: '9', title: 'Anleitung Schritt 9', sub: '-',
          steps: ['a'], dos: ['b'], donts: ['c'], dod: 'd' }
      ]
    },

    referenz: {
      didaktik: { titel: 'Didaktisches Modell', abschnitte: [
        { h: 'Grundprinzip: Test – Learn – Test', html: '<p>Vor dem Lernen, waehrend, danach.</p>' },
        { h: 'W-U-G-Modell', html: '<p>Wissen, Urteil, Gestalten.</p>' },
        { h: 'Bloom-Kalibrierung', html: '<p>Stufe 1 bis 6. W liegt bei Bloom 1&ndash;2.</p>' },
        { h: 'Bloom-Anker (Referenz)', html: '<p>Stufe 3: Der Berater leitet ab &hellip;</p>' }
      ]},
      promptcraft: { titel: 'Prompt-Handwerk', abschnitte: [
        { h: 'Anatomie eines Masterprompts', html: '<p>Rolle, Kontext, Regeln, Output-Contract.</p>' },
        { h: 'QA-Gate', html: '<p>Kein Prompt wird Standard ohne diese drei Schritte.</p>' }
      ]},
      governance: { titel: 'Governance-Richtlinien', abschnitte: [
        { h: 'Einordnung dieses Vorhabens', html: '<p>Allgemeine Weiterbildung, oeffentlicher Content.</p>' },
        { h: 'Datenklassen & Tool-Zulassung', html: '<table><tr><td>oeffentlich</td></tr></table>' }
      ]},
      schubladeKontext: {
        '1': ['didaktik'], '3': ['didaktik'], '4': ['didaktik','promptcraft'],
        '5': ['promptcraft'], '6': ['didaktik','promptcraft'], '8': ['didaktik']
      }
    },

    hf: {
      '1': { prim: ['HF8'], ber: ['HF9'] }, '2': { prim: ['HF8'], ber: [] },
      '3': { prim: ['HF8'], ber: [] }, '4': { prim: ['HF8'], ber: [] },
      '5': { prim: ['HF8'], ber: [] }, '6': { prim: ['HF8'], ber: [] },
      '7': { prim: ['HF8'], ber: [] }, '8': { prim: ['HF8'], ber: [] },
      '9': { prim: ['HF3'], ber: ['HF8'] }, __vorlaeufig: true
    }
  };

  var KURSE = [
    { id: '1', kursId: 'DBS-001', kurstitel: 'Derivate & Strukturierte Produkte Basis',
      kompetenzfeld: 'Vermögen & Vorsorge', schritt: 4, status: 'inArbeit', prio: null, bemerkung: '' },
    { id: '2', kursId: 'AFL-001', kurstitel: 'Anlagefondslizenz',
      kompetenzfeld: 'Vermögen & Vorsorge', schritt: 1, status: 'offen', prio: null, bemerkung: '' }
  ];

  root.FIXTURE = { INHALT: INHALT, KURSE: KURSE };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { INHALT: INHALT, KURSE: KURSE };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
