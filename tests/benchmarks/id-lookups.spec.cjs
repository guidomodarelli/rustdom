/** @file Checks real ID benchmark results, complete serialized scopes and original owner preservation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { idLookupFixture } = require('../../benchmarks/id-lookups.cjs');
const { ID_LOOKUP_WORKLOADS } = require('../../benchmarks/constants/id-lookups.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
for (const [engine, runtime] of Object.entries(engines)) for (const name of ID_LOOKUP_WORKLOADS) {
  test(`should preserve registration and SVG results and restore the owner for ${engine} ${name}`, () => {
    const { window } = new runtime.JSDOM('<p id="original">preserved</p>');
    const original = window.document.body.firstChild;
    const markup = window.document.body.innerHTML;
    try {
      for (const size of [100, 1000]) {
        const fixture = idLookupFixture(runtime, window, size, name);
        try {
          fixture.validate(fixture.run());
          assert.match(fixture.serialize(), new RegExp(`data-id-entry="${size - 1}"`));
        } finally { fixture.dispose(); }
        assert.equal(window.document.body.innerHTML, markup);
        assert.equal(window.document.body.firstChild, original);
        assert.equal(window.document.getElementById('original'), original);
        assert.equal(window.document.getElementById(`id-entry-${size - 1}`), null);
      }
    } finally { window.close(); }
  });
}
