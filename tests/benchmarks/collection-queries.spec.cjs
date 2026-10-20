/** @file Validates benchmark collections and teardown using the real public DOM engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectionQueryFixture } = require('../../benchmarks/collection-queries.cjs');
const { COLLECTION_QUERY_WORKLOADS } = require('../../benchmarks/constants/collection-queries.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

for (const [engine, runtime] of Object.entries(engines)) {
  for (const name of COLLECTION_QUERY_WORKLOADS) {
    test(`should validate refreshed/cached collection identities and release ${engine} ${name}`, () => {
      const { window } = new runtime.JSDOM('<p id="original">preserved</p>');
      const original = window.document.body.innerHTML;
      try {
        for (const size of [100, 1000]) {
          const fixture = collectionQueryFixture(runtime, window, size, name);
          try { fixture.validate(fixture.run()); }
          finally { fixture.dispose(); }
          assert.equal(window.document.body.innerHTML, original);
        }
      } finally { window.close(); }
    });
  }
}
