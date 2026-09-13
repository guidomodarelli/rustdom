/** @file Verifies recursive slot flattening through public snapshots, fallback and nested roots. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/**
 * Create a real relay of light slots assigned into successively nested shadow roots.
 * @param {Document} document - Live document.
 * @param {number} depth - Number of relay slots.
 * @returns {object} Outermost host, relay slots and terminal slot.
 */
function slotChain(document, depth) {
  const outerHost = document.body.appendChild(document.createElement('section'));
  let root = outerHost.attachShadow({ mode: 'open' }); const relays = [];
  for (let index = 0; index < depth; index++) {
    const host = root.appendChild(document.createElement('section'));
    const relay = host.appendChild(document.createElement('slot')); relays.push(relay);
    root = host.attachShadow({ mode: index % 2 ? 'closed' : 'open' });
  }
  const terminal = root.appendChild(document.createElement('slot'));
  return { outerHost, relays, terminal };
}

for (const depth of [8, 60]) {
  test(`should preserve ${depth} nested slot levels, fallback, CDATA and independent snapshots`, () => {
    for (const runtime of Object.values(runtimes)) {
      const dom = new runtime.JSDOM('<body></body>'); const xml = new runtime.JSDOM('<root/>', { contentType: 'application/xml' });
      const foreign = new runtime.JSDOM('<body></body>');
      try {
        const document = dom.window.document; const { outerHost, relays, terminal } = slotChain(document, depth);
        const element = document.createElement('b'); const text = document.createTextNode('text');
        const cdata = xml.window.document.createCDATASection('assigned cdata'); outerHost.append(element, text, cdata);
        assert.deepEqual(terminal.assignedNodes(), [relays.at(-1)]);
        assert.deepEqual(terminal.assignedNodes({ flatten: true }), [element, text, cdata]);
        assert.deepEqual(terminal.assignedElements({ flatten: true }), [element]);
        element.remove(); text.remove(); cdata.remove();
        const fallbackElement = document.createElement('i'); const fallbackText = document.createTextNode('fallback');
        const fallbackCdata = xml.window.document.createCDATASection('excluded fallback');
        const nestedFallback = document.createElement('slot'); nestedFallback.name = 'missing';
        const nestedText = nestedFallback.appendChild(document.createTextNode('nested fallback'));
        relays[0].append(fallbackElement, fallbackText, fallbackCdata, nestedFallback);
        const snapshot = terminal.assignedNodes({ flatten: true });
        assert.deepEqual(snapshot, [fallbackElement, fallbackText, nestedText]);
        outerHost.append(element); assert.deepEqual(terminal.assignedNodes({ flatten: true }), [element]);
        assert.deepEqual(snapshot, [fallbackElement, fallbackText, nestedText]);
        foreign.window.document.body.append(outerHost);
        assert.deepEqual(terminal.assignedNodes({ flatten: true }), [element]);
      } finally { dom.window.close(); xml.window.close(); foreign.window.close(); }
    }
  });
}

test('should ignore light-DOM and template fallback while preserving slots as ordinary assigned elements', () => {
  for (const runtime of Object.values(runtimes)) {
    const dom = new runtime.JSDOM('<slot>light fallback</slot><template><slot>inert fallback</slot></template><main></main>');
    try {
      const document = dom.window.document;
      assert.deepEqual(document.querySelector('slot').assignedNodes({ flatten: true }), []);
      assert.deepEqual(document.querySelector('template').content.firstChild.assignedNodes({ flatten: true }), []);
      const host = document.querySelector('main'); const root = host.attachShadow({ mode: 'closed' });
      const target = root.appendChild(document.createElement('slot'));
      const lightSlot = host.appendChild(document.createElement('slot')); lightSlot.append('own fallback');
      // A light slot outside a shadow tree is emitted as-is, rather than recursively expanded.
      assert.deepEqual(target.assignedNodes({ flatten: true }), [lightSlot]);
    } finally { dom.window.close(); }
  }
});

test('should expose native flattened snapshots and reject cyclic raw assignments without mutation', () => {
  const { NativeTree } = require('../dist/native.cjs'); const tree = new NativeTree();
  const host = tree.allocate(); tree.setHtmlElement(host, 'div', []);
  const root = tree.allocate(); tree.setData(root, '{"kind":11}'); tree.setRootHost(root, host, true);
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []); tree.append(root, slot);
  const leaf = tree.allocate(); tree.setData(leaf, '{"kind":3,"value":"leaf"}'); tree.append(host, leaf);
  const snapshot = tree.findFlattenedSlotables(slot); assert.deepEqual(snapshot, [leaf]);
  const reserved = tree.reserveHandles(); const before = tree.statistics();
  for (const invalid of [-1, 0, 0.5, NaN, Infinity, reserved]) assert.throws(() => tree.findFlattenedSlotables(invalid), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before);
  tree.remove(leaf); tree.remove(slot); tree.append(host, slot); tree.append(root, host);
  const cyclic = tree.statistics();
  assert.throws(() => tree.findFlattenedSlotables(slot), { code: 'InvalidArg', message: /cycle involving node/ });
  assert.deepEqual(tree.statistics(), cyclic);
  tree.remove(host); assert.deepEqual(tree.findFlattenedSlotables(slot), []);
  for (const node of [leaf, slot, root, host, reserved]) tree.release(node);
  assert.deepEqual(snapshot, [leaf]); assert.equal(tree.statistics().liveNodes, 0);
});

test('should release flattened result owners and collect empty-result trees after the current job', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/slot-flatten-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
