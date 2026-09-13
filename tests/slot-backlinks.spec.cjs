/** @file Verifies recorded slot backlinks through real event paths, adoption and lifetime changes. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { NativeTree } = require('../dist/native.cjs');
/** Compare actual engines without mocking event dispatch or platform objects. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} runtime - Real engine. @param {string} mode - Initial root visibility. @param {string} kind - Assignable node kind. @returns {object[]} Primitive event and assignment observations. */
function eventTrace(runtime, mode, kind) {
  const dom = new runtime.JSDOM('<main></main>'); const foreign = new runtime.JSDOM('<main></main>');
  const xml = new runtime.JSDOM('<root/>', { contentType: 'application/xml' });
  try {
    const document = dom.window.document; const host = document.querySelector('main');
    const root = host.attachShadow({ mode }); root.innerHTML = '<slot></slot><slot name="other"></slot>';
    const [slot, otherSlot] = root.children;
    const target = kind === 'element' ? document.createElement('button') : kind === 'text'
      ? document.createTextNode('target') : xml.window.document.createCDATASection('target');
    const nextHost = foreign.window.document.querySelector('main');
    const nextRoot = nextHost.attachShadow({ mode: mode === 'open' ? 'closed' : 'open' });
    const nextSlot = nextRoot.appendChild(foreign.window.document.createElement('slot'));
    const identities = new Map([[host, 'host'], [root, 'root'], [slot, 'slot'], [otherSlot, 'other-slot'],
      [target, 'target'], [nextHost, 'next-host'], [nextRoot, 'next-root'], [nextSlot, 'next-slot']]);
    for (const [index, window] of [dom.window, foreign.window].entries()) {
      identities.set(window, `window-${index}`); identities.set(window.document, `document-${index}`);
      identities.set(window.document.documentElement, `html-${index}`); identities.set(window.document.body, `body-${index}`);
    }
    const trace = []; let stage;
    for (const receiver of [target, slot, root, host, nextSlot, nextRoot, nextHost]) {
      receiver.addEventListener('probe', (event) => trace.push({ stage, receiver: identities.get(receiver),
        target: identities.get(event.target), path: event.composedPath().map((node) => {
          assert.ok(identities.has(node), `Unmapped event path node: ${node.nodeName}`); return identities.get(node);
        }) }));
    }
    /** @param {string} name - Mutation stage. @returns {void} Dispatches in the target's current document realm. */
    function capture(name) {
      stage = name;
      target.dispatchEvent(new target.ownerDocument.defaultView.Event('probe', { bubbles: true, composed: true }));
      trace.push({ stage, publicSlot: identities.get(target.assignedSlot) ?? null,
        oldCache: slot.assignedNodes().map((node) => identities.get(node)),
        newCache: nextSlot.assignedNodes().map((node) => identities.get(node)) });
    }
    host.append(target);
    if (kind === 'cdata') {
      // CDATA inherits Text state, but insertion's slotable guard does not signal assignment.
      assert.deepEqual(slot.assignedNodes(), []); capture('initial-pending-cdata');
      slot.name = 'refresh'; slot.name = '';
    }
    assert.deepEqual(slot.assignedNodes(), [target]); capture('initial');
    target.remove(); assert.equal(target.assignedSlot, null); assert.deepEqual(slot.assignedNodes(), []); capture('removed');
    if (kind === 'element') {
      host.append(target); target.slot = 'missing'; assert.equal(target.assignedSlot, null); capture('unmatched');
      target.slot = '';
    }
    foreign.window.document.body.append(target); assert.equal(target.assignedSlot, null); capture('adopted-unassigned');
    nextHost.append(target);
    if (kind === 'cdata') {
      assert.deepEqual(nextSlot.assignedNodes(), []); capture('reassignment-pending-cdata');
      nextSlot.name = 'refresh'; nextSlot.name = '';
    }
    assert.deepEqual(nextSlot.assignedNodes(), [target]); capture('reassigned');
    target.remove(); assert.equal(target.assignedSlot, null); capture('reassigned-removed');
    return trace;
  } finally { dom.window.close(); foreign.window.close(); xml.window.close(); }
}

for (const mode of ['open', 'closed']) for (const kind of ['element', 'text', 'cdata']) {
  test(`should preserve ${kind} event backlinks after removal, renaming and adoption with a ${mode} root`, () => {
    const reference = eventTrace(runtimes.jsdom, mode, kind);
    assert.ok(reference.some((entry) => entry.stage === 'removed' && entry.receiver === 'slot'));
    assert.ok(reference.some((entry) => entry.stage === 'reassigned-removed' && entry.receiver === 'next-slot'));
    assert.deepEqual(eventTrace(runtimes.rustdom, mode, kind), reference);
  });
}

test('should expose independent raw backlinks and event parents with atomic failures and release cleanup', () => {
  const tree = new NativeTree(); const host = tree.allocate(); tree.setHtmlElement(host, 'div', []);
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []);
  const child = tree.allocate(); tree.setCharacterData(child, 3, 'child'); tree.append(host, child);
  const comment = tree.allocate(); tree.setData(comment, '{"kind":8}');
  const reserved = tree.reserveHandles();
  assert.equal(tree.slotBacklink(comment), 0); assert.equal(tree.eventParent(child), host);
  tree.setSlotBacklink(child, slot); tree.remove(child);
  assert.equal(tree.eventParent(child), slot); assert.deepEqual(tree.cachedSlotables(slot), []);
  const before = tree.statistics(); const links = tree.slotBacklinkStatistics();
  for (const invalid of [-1, 0.5, NaN, Infinity, reserved]) {
    assert.throws(() => tree.setSlotBacklink(child, invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.setSlotBacklink(invalid, slot), { code: 'InvalidArg' });
    assert.throws(() => tree.slotBacklink(invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.eventParent(invalid), { code: 'InvalidArg' });
  }
  assert.throws(() => tree.setSlotBacklink(comment, slot), { code: 'InvalidArg' });
  assert.throws(() => tree.setSlotBacklink(child, host), { code: 'InvalidArg' });
  assert.throws(() => tree.setHtmlElementMetadata(slot, 'div'), { code: 'InvalidArg' });
  assert.throws(() => tree.setData(child, '{"kind":8}'), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before); assert.deepEqual(tree.slotBacklinkStatistics(), links);
  tree.setSlotBacklink(child, 0); assert.equal(tree.eventParent(child), 0);
  tree.setSlotBacklink(child, slot); tree.release(slot);
  assert.equal(tree.slotBacklink(child), 0); assert.equal(tree.eventParent(child), 0);
  for (const node of [host, child, comment, reserved]) tree.release(node);
  assert.deepEqual(tree.slotBacklinkStatistics(), { assignedNodes: 0, slotOwners: 0,
    nodeCapacity: 0, ownerCapacity: 0, referenceCapacity: 0 });
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should release the old slot graph when a retained foreign node receives a new backlink', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/slot-backlink-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
