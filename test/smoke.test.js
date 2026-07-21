const test = require('node:test');
const assert = require('node:assert');

require('../app.js');

test('CONFIG traegt die geprueften Verbindungswerte', () => {
  assert.strictEqual(globalThis.CONFIG.graph.clientId, 'c4143c1e-33ea-4c4d-a410-58110f966d0a');
  assert.strictEqual(globalThis.CONFIG.graph.tenantId, '3643e7ab-d166-4e27-bd5f-c5bbfcd282d7');
  assert.strictEqual(globalThis.CONFIG.graph.redirectUri, 'https://markusbaechler.github.io/bbz_Kurswerkstatt/');
  assert.deepStrictEqual(globalThis.CONFIG.graph.scopes, ['User.Read', 'Sites.ReadWrite.All']);
  assert.strictEqual(globalThis.CONFIG.sharePoint.siteHostname, 'bbzsg.sharepoint.com');
  assert.strictEqual(globalThis.CONFIG.sharePoint.sitePath, '/sites/ffentlicheAngebote');
  assert.strictEqual(globalThis.CONFIG.lists.kurse, 'KWKurse');
});

test('escapeHtml neutralisiert HTML-Sonderzeichen', () => {
  assert.strictEqual(globalThis.helpers.escapeHtml('<b>&"x"</b>'), '&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
});

test('escapeHtml macht aus null und undefined einen leeren String', () => {
  assert.strictEqual(globalThis.helpers.escapeHtml(null), '');
  assert.strictEqual(globalThis.helpers.escapeHtml(undefined), '');
});

test('escapeHtml laesst harmlosen Text unveraendert', () => {
  assert.strictEqual(globalThis.helpers.escapeHtml('Derivate & Strukturierte Produkte'),
    'Derivate &amp; Strukturierte Produkte');
});

test('state startet leer und ohne Anmeldung', () => {
  assert.strictEqual(globalThis.state.auth.account, null);
  assert.deepStrictEqual(globalThis.state.data.kurse, []);
});
