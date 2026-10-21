/** @file Microbenchmarks must copy every field through real native APIs and release their outputs. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareFixture, runTrial } = require('../../benchmarks/attribute-copy.cjs');
const { ATTRIBUTE_COPY_FIXTURES } = require('../../benchmarks/constants/attribute-copy.cjs');
for (const fixture of ATTRIBUTE_COPY_FIXTURES) {
  test(`should validate equivalent real canonical copies and distinct native activity for ${fixture.name}`, () => {
    const source = prepareFixture(fixture);
    try {
      const bridge = runTrial('bridge', source, 3), copied = runTrial('native', source, 3);
      assert.equal(bridge.outputHash, copied.outputHash);
      assert.equal(copied.createdCopies, 3); assert.equal(bridge.createdCopies, 0);
      assert.equal(bridge.releasedNodes, 3); assert.equal(copied.releasedNodes, 3);
      assert.equal(bridge.liveNodes, 0); assert.equal(copied.liveNodes, 0);
    } finally { source.tree.release(source.id); }
  });
}
