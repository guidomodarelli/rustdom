/** @file Verifies ID benchmark queries, full serialized scopes and original document preservation on actual engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fragmentIdFixture } = require('../../benchmarks/fragment-id.cjs');
const { FRAGMENT_ID_WORKLOADS } = require('../../benchmarks/constants/fragment-id.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
for (const [engine, runtime] of Object.entries(engines)) for (const name of FRAGMENT_ID_WORKLOADS) {
  test(`should preserve ID results all serialized descendants and cleanup for ${engine} ${name}`, () => {
    const { window } = new runtime.JSDOM('<p id="original">preserved</p>');
    const original = window.document.body.firstChild;
    const markup = window.document.body.innerHTML;
    try {
      for (const size of [100, 1000]) {
        const fixture = fragmentIdFixture(runtime, window, size, name);
        try {
          fixture.validate(fixture.run());
          assert.match(fixture.serialize(), new RegExp(`data-fragment-entry="${size - 1}"`));
        } finally { fixture.dispose(); }
        assert.equal(window.document.body.innerHTML, markup);
        assert.equal(window.document.body.firstChild, original);
      }
    } finally { window.close(); }
  });
}
