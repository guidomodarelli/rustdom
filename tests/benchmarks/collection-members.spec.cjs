/** @file Validates observable member benchmark results and fixture teardown with both real DOM engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectionMemberFixture } = require('../../benchmarks/collection-members.cjs');
const { COLLECTION_MEMBER_WORKLOADS } = require('../../benchmarks/constants/collection-members.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

for (const [engine, runtime] of Object.entries(engines)) {
  for (const name of COLLECTION_MEMBER_WORKLOADS) {
    test(`should validate member identity, supported names and teardown for ${engine} ${name}`, () => {
      const { window } = new runtime.JSDOM('<p id="original">preserved</p>');
      const original = window.document.body.innerHTML;
      try {
        for (const size of [100, 1000]) {
          const fixture = collectionMemberFixture(runtime, window, size, name);
          try { fixture.validate(fixture.run()); }
          finally { fixture.dispose(); }
          assert.equal(window.document.body.innerHTML, original);
        }
      } finally { window.close(); }
    });
  }
}
