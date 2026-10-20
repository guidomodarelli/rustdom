/** @file Verifies real physical traversal benchmark results and public fixture cleanup. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { elementRelativeFixture } = require('../../benchmarks/element-relatives.cjs');
const { ELEMENT_RELATIVE_WORKLOADS } = require('../../benchmarks/constants/element-relatives.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
for (const [engine, runtime] of Object.entries(engines)) for (const name of ELEMENT_RELATIVE_WORKLOADS) {
  test(`should preserve all physical identities and teardown for ${engine} ${name}`, () => {
    const { window } = new runtime.JSDOM('<p id="original">preserved</p>');
    const original = window.document.body.innerHTML;
    try {
      for (const size of [100, 1000]) {
        const fixture = elementRelativeFixture(runtime, window, size, name);
        try { fixture.validate(fixture.run()); }
        finally { fixture.dispose(); }
        assert.equal(window.document.body.innerHTML, original);
      }
    } finally { window.close(); }
  });
}
