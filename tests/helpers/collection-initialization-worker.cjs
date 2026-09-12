/** @file Exercises rejected native transitions and checks instance collection at the real GC endpoint. */
'use strict';
const assert = require('node:assert/strict');
const { NativeTree } = require('../../dist/native.cjs');
const { captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** Weak observations and one intentional strong control never retain the other native instances. */
const groups = { trees: [] };
let retained = null;

/** @returns {void} Creates real native owners and exercises their error path before releasing JS roots. */
function exercise() {
  for (let index = 0; index < 64; index += 1) {
    const tree = new NativeTree();
    const element = tree.allocate();
    tree.setHtmlElement(element, 'div', ['id', 'retained']);
    const before = tree.statistics();
    for (let attempt = 0; attempt < 32; attempt += 1) {
      assert.throws(() => tree.initializeAttributeCollection(element), { code: 'InvalidArg' });
    }
    assert.deepEqual(tree.statistics(), before);
    groups.trees.push(new WeakRef(tree));
    if (index === 0) retained = tree;
  }
}

/** @returns {Promise<void>} Rejects a retained control and then observes all native instance wrappers disappear. */
async function main() {
  exercise();
  const sample = () => captureMemoryState(groups, null);
  const held = await waitForMemoryQuiescence({ label: 'held-native-tree', sample, maxRounds: 2 });
  assert.equal(held.reached, false);
  assert.equal(held.state.survivors.trees, 1);
  assert.equal(retained.statistics().attributeCollections, 0);
  retained = null;
  const released = await waitForMemoryQuiescence({ label: 'released-native-trees', sample });
  assert.equal(released.reached, true);
  assert.equal(released.state.survivors.trees, 0);
  process.stdout.write(JSON.stringify({ pass: true, node: process.version, observedTrees: groups.trees.length, held, released }));
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
