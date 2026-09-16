/** @file Runs unmodified upstream crash fixtures and verifies the detached browsing-context effects. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const native = require('../dist/native.cjs');

for (const method of ['createDocument', 'createHTMLDocument']) {
  test(`should complete ${method} from the unmodified detached-context WPT fixture`, () => {
    const source = readFileSync(`tests/fixtures/wpt/dom/nodes/DOMImplementation-${method}-with-null-browsing-context-crash.html`);
    const results = [];
    const before = native.documentImplementationStatistics().calls;
    for (const runtime of Object.values(engines)) {
      const errors = [];
      const virtualConsole = new runtime.VirtualConsole();
      virtualConsole.on('jsdomError', (error) => errors.push({ message: error.message, cause: error.cause?.message }));
      const dom = new runtime.JSDOM(source, { url: 'https://fixtures.example.test/', runScripts: 'dangerously', virtualConsole });
      try {
        const saved = dom.window.doc;
        results.push({ errors, removed: dom.window.document.querySelector('iframe') === null, savedDocument: saved.nodeType === 9,
          nullView: saved.defaultView === null, feature: saved.implementation.hasFeature() });
      } finally { dom.window.close(); }
    }
    assert.deepEqual(results[1], results[0]);
    assert.deepEqual(results[0].errors, []); assert.equal(results[0].removed, true); assert.equal(results[0].savedDocument, true);
    assert.ok(native.documentImplementationStatistics().calls > before);
    assert.equal(native.documentImplementationStatistics().active, 0);
  });
}
