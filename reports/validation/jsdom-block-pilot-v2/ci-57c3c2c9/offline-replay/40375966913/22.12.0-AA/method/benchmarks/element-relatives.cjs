/** @module benchmarks/element-relatives Measures physical Element chains and public live children updates. */
'use strict';
const assert = require('node:assert/strict');
const { HTML_NAMESPACE, COLLECTION_NAMESPACE } = require('./constants/collection-queries.cjs');
const { ELEMENT_RELATIVE_ITERATIONS, ELEMENT_RELATIVE_WORKLOADS, ELEMENT_RELATIVE_PROPERTIES } = require('./constants/element-relatives.cjs');

/** @param {object} runtime - Real DOM engine. @param {Window} window - Prepared realm. @param {number} size - Total physical children. @param {string} name - Canonical workload. @returns {object} Timed public reads with untimed identity and path validation. */
function elementRelativeFixture(runtime, window, size, name) {
  assert.ok(ELEMENT_RELATIVE_WORKLOADS.includes(name), `Unsupported Element relative benchmark: ${name}`);
  let root = window.document.createElement('section');
  let nodes = [], expected = [];
  const usesCollection = name === 'element-children-refresh' || name === 'element-children-cached';
  const cached = name === 'element-children-cached';
  const siblings = name === 'element-next-sibling' || name === 'element-previous-sibling';
  for (let index = 0; index < size; index++) {
    const isElement = usesCollection ? index % 2 === 0
      : siblings ? index === 0 || index === size - 1
        : name === 'element-first-child' ? index === size - 1 : index === 0;
    let node;
    if (isElement) {
      node = window.document.createElementNS(index % 4 === 0 ? COLLECTION_NAMESPACE : HTML_NAMESPACE, 'entry');
      node.setAttribute('data-entry', String(index)); expected.push(node);
    } else {
      node = index % 2 === 0 ? window.document.createTextNode(`gap-${index}`) : window.document.createComment(`gap-${index}`);
    }
    root.append(node); nodes.push(node);
  }
  window.document.body.append(root);
  let collection = usesCollection ? root.children : null;
  let receiver = siblings ? name === 'element-next-sibling' ? expected[0] : expected.at(-1) : root;
  let target = name === 'element-next-sibling' || name === 'element-last-child' ? expected.at(-1) : expected[0];
  const property = ELEMENT_RELATIVE_PROPERTIES[name];
  const before = runtime.getNativeTreeStatistics?.().nativeElementRelationReads;
  if (runtime.getNativeTreeStatistics && !process.env.RUSTDOM_BENCHMARK_PACKAGE) {
    assert.equal(typeof before, 'number', 'Workspace Element relatives must execute the native traversal');
  }
  return {
    /** @returns {number} Consume every public getter result or refreshed collection length and final identity. */
    run() {
      let checksum = 0;
      for (let iteration = 0; iteration < ELEMENT_RELATIVE_ITERATIONS; iteration++) {
        if (usesCollection) {
          if (!cached) root.setAttribute('data-relative-version', String(iteration));
          checksum += collection.length + Number(collection.item(expected.length - 1) === expected.at(-1));
        } else { checksum += Number(receiver[property] === target); }
      }
      return checksum;
    },
    /** @param {number} checksum - Timed result. @returns {void} Check native activity before auxiliary reads, then every physical identity. */
    validate(checksum) {
      assert.equal(checksum, ELEMENT_RELATIVE_ITERATIONS * (usesCollection ? expected.length + 1 : 1));
      if (before !== undefined && !process.env.RUSTDOM_BENCHMARK_PACKAGE) {
        assert.equal(runtime.getNativeTreeStatistics().nativeElementRelationReads - before, cached ? 0 : ELEMENT_RELATIVE_ITERATIONS);
      }
      assert.equal(root.childNodes.length, size);
      for (const [index, node] of nodes.entries()) assert.equal(root.childNodes.item(index), node);
      assert.equal(root.firstElementChild, expected[0]);
      assert.equal(root.lastElementChild, expected.at(-1));
      assert.equal(root.childElementCount, expected.length);
      assert.deepEqual(Array.from(root.children), expected);
      if (siblings) {
        assert.equal(expected[0].nextElementSibling, expected.at(-1));
        assert.equal(expected.at(-1).previousElementSibling, expected[0]);
      }
    },
    /** @returns {void} Restore the body and release every extra strong node/collection reference. */
    dispose() { root.remove(); root = null; nodes = null; expected = null; collection = null; receiver = null; target = null; },
  };
}
module.exports = { elementRelativeFixture };
