/** @file Compares retarget guards, cross-root identities and actual relatedTarget event behavior. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const adapters = {
  jsdom: { runtime: require('jsdom'), helpers: require('jsdom/lib/jsdom/living/helpers/shadow-dom'), implementation: require('jsdom/lib/jsdom/living/generated/utils').implForWrapper },
  rustdom: { runtime: require('../dist/index.cjs'), helpers: require('../dist/vendor-jsdom/lib/jsdom/living/helpers/shadow-dom'), implementation: require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils').implForWrapper },
};

/** @param {Document} document - Live document. @param {number} depth - Nested root count. @returns {object} Actual hosts, roots and leaf. */
function chain(document, depth) {
  const hosts = []; const roots = []; let parent = document.body;
  for (let index = 0; index < depth; index++) {
    const host = parent.appendChild(document.createElement('section'));
    const root = host.attachShadow({ mode: index % 2 ? 'closed' : 'open' });
    hosts.push(host); roots.push(root); parent = root;
  }
  const leaf = parent.appendChild(document.createElement('button')); return { hosts, roots, leaf };
}

test('should preserve input guards before inspecting a reference that is not a node', () => {
  for (const adapter of Object.values(adapters)) {
    const dom = new adapter.runtime.JSDOM('<main></main>');
    try {
      const host = dom.window.document.querySelector('main'); const root = host.attachShadow({ mode: 'closed' });
      const target = root.appendChild(dom.window.document.createElement('b'));
      const hostImpl = adapter.implementation(host); const targetImpl = adapter.implementation(target);
      for (const value of [null, undefined, false, 0, '', {}, dom.window]) assert.equal(adapter.helpers.retarget(value, 'bad reference'), value);
      assert.equal(adapter.helpers.retarget(hostImpl, 'bad reference'), hostImpl);
      assert.throws(() => adapter.helpers.retarget(targetImpl, 'bad reference'), TypeError);
      assert.throws(() => adapter.helpers.retarget('bad target', null), TypeError);
      assert.equal(adapter.helpers.retarget(targetImpl, dom.window), hostImpl);
      assert.equal(adapter.helpers.retarget(targetImpl, null), hostImpl);
    } finally { dom.window.close(); }
  }
});

test('should preserve retargeted identities across deep, disjoint and adopted shadow trees', () => {
  const inspect = (adapter) => {
    const dom = new adapter.runtime.JSDOM('<body></body>'); const foreign = new adapter.runtime.JSDOM('<body></body>');
    try {
      const first = chain(dom.window.document, 24); const second = chain(dom.window.document, 12);
      const nodes = [dom.window.document, dom.window.document.body, ...first.hosts, ...first.roots, first.leaf,
        ...second.hosts, ...second.roots, second.leaf, foreign.window.document, foreign.window.document.body];
      const implementations = nodes.map(adapter.implementation);
      const capture = () => implementations.flatMap((target) => implementations.map((reference) =>
        implementations.indexOf(adapter.helpers.retarget(target, reference))));
      const before = capture(); first.hosts[0].remove(); const detached = capture();
      foreign.window.document.body.append(first.hosts[0]); const adopted = capture();
      return { before, detached, adopted };
    } finally { dom.window.close(); foreign.window.close(); }
  };
  assert.deepEqual(inspect(adapters.rustdom), inspect(adapters.jsdom));
});

test('should preserve target, relatedTarget and event paths between separate shadow branches', () => {
  const inspect = (adapter) => {
    const dom = new adapter.runtime.JSDOM('<body></body>');
    try {
      const document = dom.window.document; const first = chain(document, 8); const second = chain(document, 6);
      const nodes = [first.leaf, second.leaf, ...first.hosts, ...first.roots, ...second.hosts, ...second.roots,
        document.body, document.documentElement, document, dom.window];
      const observations = [];
      for (const node of [first.leaf, first.roots.at(-1), first.roots[0], first.hosts[0], document.body]) {
        node.addEventListener('mouseover', (event) => observations.push({ at: nodes.indexOf(node),
          target: nodes.indexOf(event.target), related: nodes.indexOf(event.relatedTarget), phase: event.eventPhase,
          path: event.composedPath().map((entry) => nodes.indexOf(entry)) }));
      }
      first.leaf.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true, composed: true, relatedTarget: second.leaf }));
      first.leaf.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true, composed: true, relatedTarget: first.leaf }));
      return observations;
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspect(adapters.rustdom), inspect(adapters.jsdom));
});

test('should return numeric native results without changing resources or accepting invalid references', () => {
  const { NativeTree } = require('../dist/native.cjs'); const tree = new NativeTree();
  const document = tree.allocate(); tree.setData(document, '{"kind":9}');
  const host = tree.allocate(); tree.setHtmlElement(host, 'div', []); tree.append(document, host);
  const root = tree.allocate(); tree.setData(root, '{"kind":11}'); tree.setRootHost(root, host, true);
  const leaf = tree.allocate(); tree.setHtmlElement(leaf, 'b', []); tree.append(root, leaf);
  const before = tree.statistics(); const hostsBefore = tree.rootHostStatistics();
  assert.equal(tree.retarget(leaf, leaf), leaf); assert.equal(tree.retarget(leaf, root), leaf);
  const result = tree.retarget(leaf, document); assert.equal(result, host); assert.equal(tree.retarget(leaf, 0), host);
  assert.deepEqual(tree.statistics(), before); assert.deepEqual(tree.rootHostStatistics(), hostsBefore);
  const reserved = tree.reserveHandles(); const allocated = tree.statistics();
  for (const invalid of [-1, NaN, Infinity, 0.5, reserved]) {
    assert.throws(() => tree.retarget(invalid, document), { code: 'InvalidArg' });
    assert.throws(() => tree.retarget(leaf, invalid), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), allocated);
  for (const node of [leaf, root, host, document]) tree.release(node);
  assert.equal(result, host); assert.equal(tree.statistics().liveNodes, 0); assert.equal(tree.rootHostStatistics().hostedRoots, 0);
});
