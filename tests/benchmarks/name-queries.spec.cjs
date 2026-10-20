/** @file Verifies full public name-query benchmark results and original DOM preservation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nameQueryFixture } = require('../../benchmarks/name-queries.cjs');
const { NAME_QUERY_WORKLOADS } = require('../../benchmarks/constants/name-queries.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
for (const [engine, runtime] of Object.entries(engines)) for (const name of NAME_QUERY_WORKLOADS) {
  test(`should preserve exact names all identities and cleanup for ${engine} ${name}`, () => {
    const { window } = new runtime.JSDOM('<p id="original">preserved</p>');
    const original = window.document.body.firstChild;
    const markup = window.document.body.innerHTML;
    try {
      for (const size of [100, 1000]) {
        const fixture = nameQueryFixture(runtime, window, size, name);
        try { fixture.validate(fixture.run()); }
        finally { fixture.dispose(); }
        assert.equal(window.document.body.innerHTML, markup);
        assert.equal(window.document.body.firstChild, original);
      }
    } finally { window.close(); }
  });
}
