/** @file Checks the real GC endpoint after repeated failures of every implicit attribute transition. */
'use strict';
const assert = require('node:assert/strict');
const { fixture, operations, snapshots } = require('./implicit-attribute-fixture.cjs');
const { captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** Weak observations cover each snapshot format; one deliberate root validates the negative control. */
const groups = { trees: [] };
let retained = null;

/** @returns {void} Exercises real instances without letting fixture locals escape as strong roots. */
function exercise() {
  for (const writer of Object.keys(snapshots)) {
    for (let cycle = 0; cycle < 8; cycle += 1) {
      const state = fixture(writer);
      const before = state.tree.statistics();
      for (let attempt = 0; attempt < 16; attempt += 1) {
        for (const operation of Object.values(operations)) {
          assert.throws(() => operation(state), { code: 'InvalidArg', message: /snapshot attributes/ });
        }
      }
      assert.deepEqual(state.tree.statistics(), before);
      groups.trees.push(new WeakRef(state.tree));
      if (retained === null) retained = state;
    }
  }
}

/** @returns {Promise<void>} Verifies bounded rejection of a retained root, then complete wrapper collection. */
async function main() {
  exercise();
  const sample = () => captureMemoryState(groups, null);
  const held = await waitForMemoryQuiescence({ label: 'held-implicit-tree', sample, maxRounds: 2 });
  assert.equal(held.reached, false);
  assert.equal(retained.tree.statistics().attributeCollections, 0);
  retained = null;
  const released = await waitForMemoryQuiescence({ label: 'released-implicit-trees', sample });
  assert.equal(released.reached, true);
  assert.equal(released.state.survivors.trees, 0);
  process.stdout.write(JSON.stringify({ pass: true, node: process.version, observedImplicitTrees: groups.trees.length, held, released }));
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
