/** @file Exercises native name state through its public API and real DOM parsing/mutation hooks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree } = require('../dist/native.cjs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should use canonical native names for lookup and reclaim state after clearing or releasing nodes', () => {
  const tree = new NativeTree(); const root = tree.allocate(); tree.setData(root, '{"kind":11}');
  const slot = tree.allocate();
  tree.setData(slot, JSON.stringify({ kind: 1, name: 'slot', namespace: 'http://www.w3.org/1999/xhtml',
    attributes: [{ name: 'name', namespace: null, prefix: null, value: [0xd800, 0, 0xdc00] }] }));
  tree.append(root, slot);
  const target = tree.allocate(); tree.setHtmlElement(target, 'b', []);
  const text = tree.allocate(); tree.setData(text, '{"kind":3,"value":"text"}');
  assert.equal(tree.getSlotableName(target), ''); assert.deepEqual(tree.slotableNameStatistics(), { namedNodes: 0, capacity: 0 });
  assert.equal(tree.findSlotFor(root, target), 0);
  tree.setSlotableName(target, '\ud800\0\udc00'); assert.equal(tree.getSlotableName(target), '\ud800\0\udc00');
  assert.equal(tree.findSlotFor(root, target), slot);
  tree.setSlotableName(text, '\ud800\0\udc00'); assert.equal(tree.findSlotFor(root, text), slot);
  assert.equal(tree.slotableNameStatistics().namedNodes, 2);
  const before = tree.statistics(); const namesBefore = tree.slotableNameStatistics();
  for (const invalid of [-1, 0, 0.5, NaN, Infinity, root]) {
    assert.throws(() => tree.setSlotableName(invalid, 'changed'), { code: 'InvalidArg' });
    assert.throws(() => tree.getSlotableName(invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.findSlotFor(root, invalid), { code: 'InvalidArg' });
  }
  assert.throws(() => tree.setData(target, '{"kind":8}'), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before); assert.deepEqual(tree.slotableNameStatistics(), namesBefore);
  tree.setSlotableName(target, ''); assert.equal(tree.slotableNameStatistics().namedNodes, 1);
  tree.release(text); assert.deepEqual(tree.slotableNameStatistics(), { namedNodes: 0, capacity: 0 });
  for (const node of [target, slot, root]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0);
});

/**
 * Compare reflected attributes with slotable state maintained by mutation hooks.
 * @param {object} runtime - Real DOM runtime.
 * @param {object} options - Actual parser mode.
 * @returns {object[]} Primitive observations across namespace updates and cloning.
 */
function inspectNames(runtime, options) {
  const dom = new runtime.JSDOM('<main><b slot="first">named</b>text</main>', options);
  const foreign = new runtime.JSDOM('<body></body>');
  try {
    const document = dom.window.document; const host = document.querySelector('main');
    const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<slot name="first"></slot><slot name="second"></slot><slot></slot>';
    const [first, second, fallback] = root.childNodes; const element = host.firstChild; const text = element.nextSibling;
    const snapshots = [];
    /** @returns {void} Captures only public attribute and assignment results. */
    function capture() {
      snapshots.push({ reflected: element.slot, namespaced: element.getAttributeNS('urn:slot', 'slot'),
        assigned: [first, second, fallback].indexOf(element.assignedSlot),
        text: text.assignedSlot === fallback,
        counts: [first, second, fallback].map((slot) => slot.assignedNodes().length) });
    }
    assert.equal(element.assignedSlot, first); capture();
    element.setAttributeNS('urn:slot', 'slot', 'second'); capture();
    element.removeAttributeNS('urn:slot', 'slot'); capture();
    element.setAttribute('slot', 'second'); capture();
    const clone = element.cloneNode(true); host.append(clone);
    assert.equal(clone.assignedSlot, second); clone.slot = 'first'; assert.equal(element.assignedSlot, second); capture();
    text.slot = 'first'; assert.equal(text.assignedSlot, fallback);
    const split = text.splitText(2); assert.equal(split.assignedSlot, fallback); capture();
    foreign.window.document.body.append(host); capture();
    element.slot = ''; capture();
    return snapshots;
  } finally { dom.window.close(); foreign.window.close(); }
}

for (const [mode, options] of [['native', {}], ['locations', { includeNodeLocations: true }], ['scripts', { runScripts: 'dangerously' }]]) {
  test(`should preserve slotable name state through ${mode} parsing, namespace hooks, cloning and adoption`, () => {
    assert.deepEqual(inspectNames(runtimes.rustdom, options), inspectNames(runtimes.jsdom, options));
  });
}

test('should preserve inherited Text slot lookup for CDATA adopted from XML into an HTML host', () => {
  for (const runtime of Object.values(runtimes)) {
    const dom = new runtime.JSDOM('<main></main>'); const xml = new runtime.JSDOM('<root/>', { contentType: 'application/xml' });
    try {
      const host = dom.window.document.querySelector('main'); const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = '<slot></slot>'; const slot = root.firstChild;
      const cdata = xml.window.document.createCDATASection('value'); host.appendChild(cdata);
      assert.equal(cdata.assignedSlot, slot);
      assert.deepEqual(slot.assignedNodes(), []);
      assert.deepEqual(slot.assignedNodes({ flatten: true }), [cdata]);
      slot.name = 'named'; assert.equal(cdata.assignedSlot, null);
      slot.name = ''; assert.equal(cdata.assignedSlot, slot);
      assert.deepEqual(slot.assignedNodes(), [cdata]);
      cdata.remove(); assert.equal(cdata.assignedSlot, null);
    } finally { dom.window.close(); xml.window.close(); }
  }
});
