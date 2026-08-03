const test = require('node:test');
const assert = require('node:assert');

const { inhalt } = require('../inhalt.js');

/* ---------- inhalt.skriptPruefe (A2, Etappe 3) ----------
   Das Drift-Netz fuer den Chat-Weg von Schritt 3: der Chat liefert die .docx
   direkt (E5) — die App prueft sie beim Hochladen (s. test/hochladen.test.js
   fuer die Gate-Integration). Reine Funktion hier, kein DOM, kein Netz.
   Parity zu quellenSpiegel (Z7): dieselbe Q-ID-Wortgrenze \bQ-\d{3}\b. */

const abs = (t) => t.map((x) => ({ stil: null, text: x }));
const D = () => ({ regulatorik: { stand: '1.1.2026' }, content_modus: 'quellengestuetzt',
  quellen: [{ id: 'Q-001' }, { id: 'Q-002' }] });

test('sauberes Teil-Skript: keine Fehler, fehlende Q-IDs nur als Hinweis', () => {
  const r = inhalt.skriptPruefe(abs(['VL-002 Skript, Rechtsstand 1.1.2026',
    'Text mit Beleg Q-001.', 'Ergänzungen', '- keine']), D(), 'VL-002');
  assert.deepStrictEqual(r.fehler, []);
  assert.ok(r.hinweise.some((h) => /Q-002/.test(h)));
});

test('unbekannte Q-ID, Marker und fehlende Ergaenzungen sind Fehler', () => {
  const r = inhalt.skriptPruefe(abs(['VL-002 1.1.2026 Q-001 Q-009 [ZU PRÜFEN: x]']), D(), 'VL-002');
  assert.ok(r.fehler.some((f) => /Q-009/.test(f)));
  assert.ok(r.fehler.some((f) => /ZU PR/i.test(f)));
  assert.ok(r.fehler.some((f) => /Erg(ä|ae)nzungen/.test(f)));
});

test('quellenfrei: Ausweis Pflicht, Q-IDs verboten', () => {
  const d = D(); d.content_modus = 'quellenfrei'; d.quellen = [];
  assert.ok(inhalt.skriptPruefe(abs(['VL-002 1.1.2026', 'Ergänzungen']), d, 'VL-002')
    .fehler.some((f) => /quellenfrei/.test(f)));
  assert.ok(inhalt.skriptPruefe(abs(['VL-002 1.1.2026 quellenfrei Q-001', 'Ergänzungen']), d, 'VL-002')
    .fehler.some((f) => /Q-001/.test(f)));
});

test('ohne Dossier keine Aussage: null, nie ein leeres gruenes Ergebnis', () => {
  assert.strictEqual(inhalt.skriptPruefe(abs(['x']), null, 'VL-002'), null);
});

test('Q-0158 ist nicht Q-015 — Wortgrenze wie quellenSpiegel', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [{ id: 'Q-015' }] };
  const r = inhalt.skriptPruefe(abs(['VL-002', 'Q-0158 und Q-015', 'Ergänzungen']), d, 'VL-002');
  assert.ok(!r.fehler.some((f) => /Q-0158/.test(f)) || r.fehler.length === 0 ||
    r.fehler.every((f) => !/unbekannt.*Q-015\b/.test(f)));
});

/* ---------- Ergaenzende Faelle (ueber den Brief hinaus) ---------- */

test('Kurs-ID fehlt im Text — eigener Fehler', () => {
  const r = inhalt.skriptPruefe(abs(['Kein Kurscode hier.', 'Q-001', 'Ergänzungen']),
    D(), 'VL-002');
  assert.ok(r.fehler.some((f) => /Kurs-ID/.test(f) && /VL-002/.test(f)));
});

test('Rechtsstand-Angabe fehlt im Text, obwohl gesetzt — eigener Fehler', () => {
  const r = inhalt.skriptPruefe(abs(['VL-002', 'Q-001', 'Ergänzungen']), D(), 'VL-002');
  assert.ok(r.fehler.some((f) => /Rechtsstand/.test(f) && /1\.1\.2026/.test(f)));
});

test('ohne regulatorik.stand wird nichts erfunden — kein Rechtsstand-Fehler', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [{ id: 'Q-001' }] };
  const r = inhalt.skriptPruefe(abs(['VL-002', 'Q-001', 'Ergänzungen']), d, 'VL-002');
  assert.ok(!r.fehler.some((f) => /Rechtsstand/.test(f)));
});

test('quellengestuetzt ohne jede Q-ID: Leseliste fehlt', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [{ id: 'Q-001' }] };
  const r = inhalt.skriptPruefe(abs(['VL-002', 'Nur Fliesstext ohne Beleg.', 'Ergänzungen']), d, 'VL-002');
  assert.ok(r.fehler.some((f) => /Leseliste fehlt/.test(f)));
});

test('Ergaenzungen-Erkennung: auch die reine ASCII-Schreibweise "Ergaenzungen" zaehlt', () => {
  const r = inhalt.skriptPruefe(abs(['VL-002', 'Q-001', 'Ergaenzungen', '- keine']), D(), 'VL-002');
  assert.ok(!r.fehler.some((f) => /Ergaenzungen|Ergänzungen/.test(f)));
});

test('leere Absaetze-Liste und leeres Dossier-quellen fuehren nicht zum Crash', () => {
  const d = { regulatorik: {}, content_modus: 'quellengestuetzt', quellen: [] };
  const r = inhalt.skriptPruefe([], d, 'VL-002');
  assert.ok(Array.isArray(r.fehler) && r.fehler.length > 0, 'ein leerer Text darf nicht sauber durchgehen');
  assert.deepStrictEqual(r.hinweise, []);
});
