/** @file Untimed same-window warmup, with temporary observer fixtures removed before measurement. */
'use strict';
const assert = require('node:assert/strict');
const operations = require('./ownership-operations.cjs');
const settings = require('./constants/ownership-warmup.cjs');

/**
 * Warm public operations in the current realm without replacing measured fixtures.
 * The caller owns the declared GC boundary; this function only warms and disposes fixtures.
 * @param {object} input - Current realm, Range inputs, and real observer fixture factories.
 * @returns {Promise<void>} Resolves after all temporary observers are disconnected and hosts removed.
 */
async function warmOwnership(input) {
  const { name, window, document, size, iterations, range, comparisonMode, texts,
    expectedLifecycle, createMutationFixture, createDeliveryFixture, captureRecords } = input;
  assert.ok(settings.workloads.includes(name), `OwnershipWarmup: unsupported workload ${name}`);
  for (let round = 0; round < settings.rounds; round++) {
    if (name === 'range-control-1000') {
      assert.equal(operations.control(range, comparisonMode, iterations), iterations / 2);
    } else if (name === 'range-state-lifecycle-1000') {
      assert.equal(operations.lifecycle(window, document, texts, iterations), expectedLifecycle);
    } else {
      const existing = new Set(document.body.childNodes);
      let fixture;
      try {
        if (name === 'mutation-records-collect') {
          fixture = createMutationFixture(document, size);
          fixture.validate(captureRecords(fixture.produce()));
        } else {
          fixture = createDeliveryFixture(document, size, name, []);
          fixture.prepare(); await fixture.completed; fixture.validate();
        }
      } finally {
        fixture?.dispose();
        for (const child of [...document.body.childNodes]) if (!existing.has(child)) child.remove();
      }
    }
  }
}

module.exports = { warmOwnership };
