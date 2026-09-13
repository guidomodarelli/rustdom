/** @file Exercises native assignment snapshots, atomic writes and public notification timing. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { NativeTree } = require('../dist/native.cjs');
/** Independent engines exercise the same public mutation sequence. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @returns {object} Creates a real native shadow tree with one assigned Text. */
function nativeFixture() {
  const tree = new NativeTree();
  const host = tree.allocate(); tree.setHtmlElement(host, 'div', []);
  const root = tree.allocate(); tree.setData(root, '{"kind":11}'); tree.setRootHost(root, host, true);
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []); tree.append(root, slot);
  const child = tree.allocate(); tree.setCharacterData(child, 3, 'assigned'); tree.append(host, child);
  return { tree, host, root, slot, child };
}

test('should separate capturing from committing when assignment changes before the signal finishes', () => {
  const { tree, host, root, slot, child } = nativeFixture();
  const baseline = tree.slotAssignmentStatistics();
  const plan = tree.slotAssignmentPlan(slot);
  assert.deepEqual(plan, { changed: true, nodes: [child] });
  assert.deepEqual(tree.slotAssignmentStatistics(), baseline);
  assert.deepEqual(tree.cachedSlotables(slot), []); assert.equal(tree.assignedNodeCount(slot), 0);
  tree.setSlotableName(child, 'changed-after-capture');
  tree.setSlotAssignment(slot, plan.nodes);
  plan.nodes.length = 0;
  const snapshot = tree.cachedSlotables(slot); snapshot.push(host);
  assert.deepEqual(tree.cachedSlotables(slot), [child]); assert.equal(tree.assignedNodeCount(slot), 1);
  assert.deepEqual(tree.slotAssignmentPlan(slot), { changed: true, nodes: [] });
  tree.setSlotableName(child, '');
  assert.deepEqual(tree.slotAssignmentPlan(slot), { changed: false, nodes: [child] });
  tree.setSlotAssignment(slot, []);
  assert.deepEqual(tree.slotAssignmentStatistics(), baseline);
  for (const node of [child, slot, root, host]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should reject invalid cache writes atomically and clean shared membership in either release order', () => {
  const { tree, host, root, slot, child } = nativeFixture();
  const second = tree.allocate(); tree.setHtmlElement(second, 'slot', []);
  const comment = tree.allocate(); tree.setData(comment, '{"kind":8}');
  const foreignSlot = tree.allocate(); tree.setData(foreignSlot, '{"kind":1,"name":"slot","namespace":"urn:foreign"}');
  const reserved = tree.reserveHandles();
  tree.setSlotAssignment(slot, [child, child]); tree.setSlotAssignment(second, [child]);
  const before = tree.statistics(); const cached = tree.slotAssignmentStatistics();
  for (const invalid of [-1, 0, 0.5, NaN, Infinity, reserved, comment]) {
    assert.throws(() => tree.setSlotAssignment(slot, [child, invalid]), { code: 'InvalidArg' });
    assert.throws(() => tree.slotAssignmentPlan(invalid), { code: 'InvalidArg' });
  }
  for (const invalidSlot of [host, foreignSlot, child]) {
    assert.throws(() => tree.setSlotAssignment(invalidSlot, [child]), { code: 'InvalidArg' });
    assert.throws(() => tree.cachedSlotables(invalidSlot), { code: 'InvalidArg' });
    assert.throws(() => tree.assignedNodeCount(invalidSlot), { code: 'InvalidArg' });
  }
  assert.throws(() => tree.setHtmlElement(slot, 'div', []), { code: 'InvalidArg' });
  assert.throws(() => tree.setData(child, '{"kind":8}'), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before); assert.deepEqual(tree.slotAssignmentStatistics(), cached);
  tree.release(second); assert.equal(tree.slotAssignmentStatistics().entries, 2);
  tree.release(child); assert.deepEqual(tree.cachedSlotables(slot), []);
  assert.deepEqual(tree.slotAssignmentStatistics(), {
    slots: 0, entries: 0, members: 0, slotCapacity: 0, memberCapacity: 0, vectorCapacity: 0,
  });
  for (const node of [slot, root, host, comment, foreignSlot, reserved]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0);
});

/** @param {object} runtime - Real DOM engine. @returns {Promise<object[]>} Captures callback order and cache visibility. */
async function notificationTrace(runtime) {
  const dom = new runtime.JSDOM('<main></main>');
  try {
    const document = dom.window.document; const host = document.querySelector('main');
    const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<slot></slot><slot name="other"></slot>';
    const [first, second] = root.children; const child = document.createElement('b'); child.id = 'child';
    const trace = []; let reassignInListener = true;
    /** @returns {string[][]} Captures both public caches with no retained node references. */
    function assignments() { return [first, second].map((slot) => slot.assignedNodes().map((node) => node.id ?? node.nodeName)); }
    for (const [index, slot] of [first, second].entries()) slot.addEventListener('slotchange', () => {
      trace.push({ event: index, assignments: assignments() });
      if (index === 0 && reassignInListener) { reassignInListener = false; child.slot = 'other'; }
    });
    host.append(child); const oldSnapshot = first.assignedNodes();
    assert.deepEqual(oldSnapshot, [child]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(first.assignedNodes(), []); assert.deepEqual(second.assignedNodes(), [child]);
    assert.deepEqual(oldSnapshot, [child]); oldSnapshot.length = 0;
    assert.deepEqual(second.assignedNodes(), [child]);
    child.slot = ''; child.slot = 'other';
    trace.push({ immediate: assignments() });
    await new Promise((resolve) => setImmediate(resolve));
    host.removeChild(child);
    first.append('fallback'); first.firstChild.data = 'updated fallback';
    trace.push({ detached: assignments(), fallback: first.assignedNodes({ flatten: true }).map((node) => node.data) });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(second.assignedNodes(), []);
    return trace;
  } finally { dom.window.close(); }
}

test('should expose committed caches during coalesced and reentrant slotchange listeners', async () => {
  const reference = await notificationTrace(runtimes.jsdom);
  assert.ok(reference.some((entry) => entry.event === 0)); assert.ok(reference.some((entry) => entry.event === 1));
  assert.deepEqual(await notificationTrace(runtimes.rustdom), reference);
});

test('should collect cached assignment owners after consumers release their public snapshots', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/slot-assignment-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
