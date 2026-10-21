/** @file Exercises actual attribute benchmark fixtures and verifies equivalent output and owner restoration. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { attributeReadFixture } = require('../../benchmarks/attribute-reads.cjs');
const { ATTRIBUTE_READ_WORKLOADS } = require('../../benchmarks/constants/attribute-reads.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
for (const name of ATTRIBUTE_READ_WORKLOADS) {
  test(`should return complete equivalent attribute output and restore owners for ${name}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(engines)) {
      const { window } = new runtime.JSDOM('<p>preserved</p>');
      const original = window.document.body.firstChild; const markup = window.document.body.innerHTML;
      try {
        results[engine] = [];
        for (const size of [100, 1000]) {
          const fixture = attributeReadFixture(runtime, window, size, name);
          try { fixture.validate(fixture.run()); results[engine].push(fixture.serialize()); }
          finally { fixture.dispose(); }
          assert.equal(window.document.body.innerHTML, markup); assert.equal(window.document.body.firstChild, original);
        }
      } finally { window.close(); }
    }
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}
