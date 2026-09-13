/** @file Verifies slot selection through real public APIs, mutations and slotchange delivery. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/**
 * Observe slot identities without retaining runtime objects after closing a window.
 * @param {object} runtime - Independent DOM implementation.
 * @param {'open' | 'closed'} mode - Shadow-root visibility.
 * @returns {Promise<object[]>} Assignment and notification snapshots.
 */
async function inspectAssignments(runtime, mode) {
  const dom = new runtime.JSDOM('<main><b slot="named">element</b>text<!--ignored--><i slot="missing"></i></main>');
  try {
    const document = dom.window.document;
    const host = document.querySelector('main');
    const root = host.attachShadow({ mode });
    root.innerHTML = '<template><slot name="named"></slot></template><section><slot name="named">fallback</slot></section>' +
      '<slot name="named">duplicate</slot><slot><em>default fallback</em></slot>';
    const [first, duplicate, defaultSlot] = root.querySelectorAll('slot');
    const [element, text, comment, unmatched] = host.childNodes;
    const nodes = [first, duplicate, defaultSlot, element, text, comment, unmatched,
      first.firstChild, duplicate.firstChild, defaultSlot.firstChild];
    const index = (node) => node === null ? null : nodes.indexOf(node);
    const notifications = [];
    const observations = [];
    for (const slot of [first, duplicate, defaultSlot]) {
      slot.addEventListener('slotchange', () => notifications.push(index(slot)));
    }
    /** @returns {Promise<void>} Captures observable assignments after queued notifications. */
    async function capture() {
      await new Promise((resolve) => setImmediate(resolve));
      observations.push({ assigned: [element, text, unmatched].map((node) => index(node.assignedSlot)),
        slots: [first, duplicate, defaultSlot].map((slot) => ({
          nodes: slot.assignedNodes().map(index), flat: slot.assignedNodes({ flatten: true }).map(index),
          elements: slot.assignedElements().map(index) })), notifications: notifications.splice(0) });
    }
    assert.deepEqual(first.assignedNodes(), [element]);
    assert.deepEqual(duplicate.assignedNodes(), []);
    assert.deepEqual(defaultSlot.assignedNodes(), [text]);
    assert.equal(element.assignedSlot, mode === 'open' ? first : null);
    await capture();
    root.prepend(duplicate); await capture();
    duplicate.name = 'different'; await capture();
    element.slot = ''; await capture();
    element.setAttributeNS('urn:slot-name', 'slot', 'named'); await capture();
    element.removeAttributeNS('urn:slot-name', 'slot'); await capture();
    first.remove(); await capture();
    root.append(first); host.remove(); await capture();
    return observations;
  } finally { dom.window.close(); }
}

for (const mode of ['open', 'closed']) {
  test(`should preserve first-slot selection and notifications in a ${mode} root`, async () => {
    assert.deepEqual(await inspectAssignments(runtimes.rustdom, mode), await inspectAssignments(runtimes.jsdom, mode));
  });
}

test('should preserve exact UTF-16 slot names, namespaces and case after mutations', () => {
  for (const runtime of Object.values(runtimes)) {
    const dom = new runtime.JSDOM('<main></main>');
    try {
      const document = dom.window.document; const host = document.querySelector('main');
      const root = host.attachShadow({ mode: 'open' }); const element = document.createElement('b');
      const wrongNamespace = document.createElementNS('http://www.w3.org/2000/svg', 'slot');
      const wrongCase = document.createElementNS('http://www.w3.org/1999/xhtml', 'SLOT');
      const slot = document.createElement('slot'); root.append(wrongNamespace, wrongCase, slot); host.append(element);
      for (const name of ['named', 'NAMED', '\ud800', '\udc00', 'a\0b', '😀', '']) {
        wrongNamespace.setAttribute('name', name); wrongCase.setAttribute('name', name);
        slot.name = name; element.slot = name;
        assert.equal(element.assignedSlot, slot);
        assert.deepEqual(slot.assignedNodes(), [element]);
        slot.name = `${name}!`; assert.equal(element.assignedSlot, null);
        slot.setAttributeNS('urn:ignored', 'other:name', name); assert.equal(element.assignedSlot, null);
        slot.name = name; assert.equal(element.assignedSlot, slot);
      }
    } finally { dom.window.close(); }
  }
});

test('should select only the immediate host shadow root and update after adoption', () => {
  for (const runtime of Object.values(runtimes)) {
    const dom = new runtime.JSDOM('<main><section><b>nested light</b></section></main>');
    const foreign = new runtime.JSDOM('<body></body>');
    try {
      const document = dom.window.document; const host = document.querySelector('main');
      const nestedHost = host.firstChild; const leaf = nestedHost.firstChild;
      const outerRoot = host.attachShadow({ mode: 'open' }); const outerSlot = document.createElement('slot'); outerRoot.append(outerSlot);
      assert.equal(nestedHost.assignedSlot, outerSlot); assert.equal(leaf.assignedSlot, null);
      const innerRoot = nestedHost.attachShadow({ mode: 'open' }); const innerSlot = document.createElement('slot'); innerRoot.append(innerSlot);
      assert.equal(leaf.assignedSlot, innerSlot);
      foreign.window.document.body.append(host);
      assert.equal(leaf.assignedSlot, innerSlot); assert.equal(nestedHost.assignedSlot, outerSlot);
      nestedHost.append(document.createTextNode('extra')); assert.equal(innerSlot.assignedNodes().length, 2);
      leaf.remove(); assert.equal(leaf.assignedSlot, null); assert.equal(innerSlot.assignedNodes().length, 1);
    } finally { dom.window.close(); foreign.window.close(); }
  }
});

test('should search through the native API without retaining nodes or changing resources', () => {
  const { NativeTree } = require('../dist/native.cjs'); const tree = new NativeTree();
  const root = tree.allocate(); tree.setData(root, '{"kind":11}');
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []); tree.append(root, slot);
  const reserved = tree.reserveHandles(); const before = tree.statistics();
  assert.equal(tree.findSlot(root, ''), slot); assert.equal(tree.findSlot(root, '\ud800'), 0);
  for (const invalid of [-1, 0, NaN, Infinity, 0.5, reserved, slot]) {
    assert.throws(() => tree.findSlot(invalid, ''), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), before);
  tree.initializeAttributeCollection(slot);
  const attribute = tree.allocate(); tree.initializePlainAttribute(attribute, 'name', 'first'); tree.appendAttribute(slot, attribute);
  assert.equal(tree.findSlot(root, 'first'), slot);
  tree.setAttributeValue(attribute, '\ud800\0\udc00');
  assert.equal(tree.findSlot(root, 'first'), 0); assert.equal(tree.findSlot(root, '\ud800\0\udc00'), slot);
  tree.release(attribute); assert.equal(tree.findSlot(root, ''), slot);
  const result = tree.findSlot(root, ''); tree.release(slot); tree.release(root); tree.release(reserved);
  assert.equal(result, slot); assert.equal(tree.statistics().liveNodes, 0);
});
