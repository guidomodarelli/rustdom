/** @file Compares assignment queries over dense hosts, duplicate slots and ordinary/shadow boundaries. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/**
 * Capture fresh and cached assignment through actual mutation/flattening APIs.
 * @param {object} runtime - Independent DOM engine.
 * @param {'open' | 'closed'} mode - Root visibility.
 * @returns {Promise<object[]>} Primitive identity and notification snapshots.
 */
async function inspectQueries(runtime, mode) {
  const dom = new runtime.JSDOM('<main></main>');
  const xml = new runtime.JSDOM('<root/>', { contentType: 'application/xml' });
  try {
    const document = dom.window.document; const host = document.querySelector('main');
    const root = host.attachShadow({ mode });
    root.innerHTML = '<section><slot name="first"></slot></section><slot name="second"></slot><slot name="first"></slot><slot></slot>' +
      '<template><slot name="missing"></slot></template>';
    const slots = [...root.querySelectorAll('slot')];
    const identities = new Map(); const children = [];
    for (let index = 0; index < 80; index++) {
      const child = document.createElement(index === 0 ? 'section' : 'b'); child.slot = index % 2 ? 'second' : 'first';
      child.textContent = `nested-${index}`; identities.set(child, `element-${index}`); children.push(child); host.append(child);
    }
    const text = host.appendChild(document.createTextNode('default')); identities.set(text, 'text');
    const comment = host.appendChild(document.createComment('ignored')); identities.set(comment, 'comment');
    const cdata = xml.window.document.createCDATASection('cdata'); host.append(cdata); identities.set(cdata, 'cdata');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); svg.setAttribute('slot', 'first'); host.append(svg); identities.set(svg, 'svg');
    const nestedHost = children[0]; const nestedRoot = nestedHost.attachShadow({ mode: 'open' }); nestedRoot.innerHTML = '<slot></slot>';
    identities.set(nestedHost.firstChild, 'nested-text');
    const snapshots = []; const notifications = [];
    for (const [index, slot] of slots.entries()) slot.addEventListener('slotchange', () => notifications.push(index));
    /** @param {Node} node - Returned node. @returns {string} Stable fixture label. */
    function label(node) { assert.ok(identities.has(node), `Unexpected assignment: ${node.nodeName}`); return identities.get(node); }
    /** @returns {Promise<void>} Captures after notifications settle without retaining DOM nodes. */
    async function capture() {
      await new Promise((resolve) => setImmediate(resolve));
      snapshots.push({ slots: slots.map((slot) => ({ current: slot.assignedNodes().map(label),
        flat: slot.assignedNodes({ flatten: true }).map(label), elements: slot.assignedElements({ flatten: true }).map(label) })),
      inner: nestedRoot.firstChild.assignedNodes({ flatten: true }).map(label), notifications: notifications.splice(0) });
    }
    assert.equal(slots[0].assignedNodes({ flatten: true }).length, 41);
    assert.deepEqual(slots[2].assignedNodes({ flatten: true }), []);
    assert.deepEqual(slots[3].assignedNodes({ flatten: true }), [text, cdata]);
    await capture(); root.prepend(slots[2]); await capture();
    children[0].slot = 'missing'; children[1].remove(); await capture();
    slots[2].name = '\ud800'; children[2].slot = '\ud800'; await capture();
    document.body.append(slots[2]); await capture();
    root.append(slots[2]); host.remove(); await capture();
    return snapshots;
  } finally { dom.window.close(); xml.window.close(); }
}

for (const mode of ['open', 'closed']) {
  test(`should preserve dense slot assignments and notifications in ${mode} roots`, async () => {
    assert.deepEqual(await inspectQueries(runtimes.rustdom, mode), await inspectQueries(runtimes.jsdom, mode));
  });
}

test('should return independent native assignment snapshots without changing resources', () => {
  const { NativeTree } = require('../dist/native.cjs'); const tree = new NativeTree();
  const host = tree.allocate(); tree.setHtmlElement(host, 'div', []);
  const root = tree.allocate(); tree.setData(root, '{"kind":11}'); tree.setRootHost(root, host, true);
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []); tree.append(root, slot);
  const duplicate = tree.allocate(); tree.setHtmlElement(duplicate, 'slot', []); tree.append(root, duplicate);
  const child = tree.allocate(); tree.setHtmlElement(child, 'b', []); tree.append(host, child);
  const cdata = tree.allocate(); tree.setData(cdata, '{"kind":4,"value":"cdata"}'); tree.append(host, cdata);
  const comment = tree.allocate(); tree.setData(comment, '{"kind":8,"value":"ignored"}'); tree.append(host, comment);
  const reserved = tree.reserveHandles(); const before = tree.statistics(); const namesBefore = tree.slotableNameStatistics();
  const result = tree.findSlotables(slot); assert.deepEqual(result, [child, cdata]);
  assert.deepEqual(tree.findSlotables(duplicate), []); assert.deepEqual(tree.findSlotables(host), []);
  for (const invalid of [-1, 0, 0.5, NaN, Infinity, reserved]) assert.throws(() => tree.findSlotables(invalid), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before); assert.deepEqual(tree.slotableNameStatistics(), namesBefore);
  tree.setSlotableName(child, 'different'); assert.deepEqual(tree.findSlotables(slot), [cdata]);
  assert.deepEqual(result, [child, cdata]);
  for (const node of [child, cdata, comment, slot, duplicate, host, root, reserved]) tree.release(node);
  assert.deepEqual(result, [child, cdata]); assert.equal(tree.statistics().liveNodes, 0);
  assert.deepEqual(tree.slotableNameStatistics(), { namedNodes: 0, capacity: 0 });
});
