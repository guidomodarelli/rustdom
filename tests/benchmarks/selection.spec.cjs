/** @file Verifies Selection benchmark workloads against real engines before timing comparisons. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectionFixture } = require('../../benchmarks/selection.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

for (const [engine, runtime] of Object.entries(engines)) {
  for (const name of ['selection-read', 'selection-associate', 'selection-extend', 'selection-contains', 'selection-stringify']) {
    test(`should validate all results and release the Selection fixture for ${engine} ${name}`, async () => {
      const { window } = new runtime.JSDOM('<p id="original">preserved</p>');
      const before = window.document.body.innerHTML;
      try {
        for (const size of [100, 1000]) {
          const fixture = selectionFixture(runtime, window, size, name);
          try { const result = fixture.run(); fixture.validate(result); assert.equal(result, size); }
          finally { await fixture.dispose(); }
          assert.equal(window.getSelection().rangeCount, 0);
          assert.equal(window.document.body.innerHTML, before);
        }
      } finally { window.close(); }
    });
  }
}
