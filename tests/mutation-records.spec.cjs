/** @file Verifies complete MutationRecord snapshots, UTF-16, realms and static NodeList identity. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
/** Keep the reference engine independent of rustdom's private runtime. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve per-observer nullable UTF-16 record fields and takeRecords behavior in ${name}`, async () => {
    const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document;
    const host = document.querySelector('main'); const text = host.appendChild(document.createTextNode('old\ud800\0'));
    let callbacks = 0;
    const full = new dom.window.MutationObserver(() => { callbacks++; });
    const lean = new dom.window.MutationObserver(() => { callbacks++; });
    try {
      full.observe(host, { attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true, subtree: true });
      lean.observe(host, { attributes: true, characterData: true, subtree: true });
      const namespace = 'urn:\ud800'; const firstValue = 'first\0\ud800';
      host.setAttributeNS(namespace, 'p:flag', firstValue); host.setAttributeNS(namespace, 'q:flag', 'second\udc00');
      text.appendData('\udc00');
      const records = full.takeRecords(); const withoutOldValues = lean.takeRecords();
      assert.equal(records.length, 3); assert.equal(withoutOldValues.length, 3);
      assert.deepEqual(records.map((record) => record.type), ['attributes', 'attributes', 'characterData']);
      assert.deepEqual(records.map((record) => record.oldValue), [null, firstValue, 'old\ud800\0']);
      assert.deepEqual(withoutOldValues.map((record) => record.oldValue), [null, null, null]);
      for (const [index, record] of records.entries()) {
        assert.ok(record instanceof dom.window.MutationRecord); assert.notEqual(record, withoutOldValues[index]);
        assert.equal(record.target, index < 2 ? host : text);
        assert.equal(record.attributeName, index < 2 ? 'flag' : null);
        assert.equal(record.attributeNamespace, index < 2 ? namespace : null);
        assert.equal(record.previousSibling, null); assert.equal(record.nextSibling, null);
        assert.equal(record.addedNodes.length, 0); assert.equal(record.removedNodes.length, 0);
        assert.equal(record.addedNodes, record.addedNodes); assert.equal(record.removedNodes, record.removedNodes);
      }
      assert.deepEqual(full.takeRecords(), []); assert.deepEqual(lean.takeRecords(), []);
      await new Promise((resolve) => setImmediate(resolve)); assert.equal(callbacks, 0);
      assert.throws(() => new dom.window.MutationRecord(), { name: 'TypeError' });
    } finally { full.disconnect(); lean.disconnect(); dom.window.close(); }
  });

  test(`should preserve static added/removed lists, siblings and creation realm after adoption in ${name}`, () => {
    const dom = new runtime.JSDOM('<main><b></b><i></i></main>'); const foreign = new runtime.JSDOM('<body></body>');
    const document = dom.window.document; const host = document.querySelector('main');
    const [before, after] = host.children; const observer = new dom.window.MutationObserver(() => {});
    try {
      observer.observe(host, { childList: true });
      const fragment = document.createDocumentFragment(); const element = document.createElement('em'); const text = document.createTextNode('text');
      fragment.append(element, text); host.insertBefore(fragment, after);
      const first = observer.takeRecords()[0]; const firstAdded = first.addedNodes;
      assert.deepEqual([...firstAdded], [element, text]); assert.equal(first.addedNodes, firstAdded);
      assert.equal(firstAdded[0], element); assert.equal(firstAdded[1], text);
      assert.equal(first.previousSibling, before); assert.equal(first.nextSibling, after); assert.equal(first.target, host);
      const replacement = document.createElement('span'); host.replaceChild(replacement, element);
      const second = observer.takeRecords()[0]; const removed = second.removedNodes;
      assert.deepEqual([...second.addedNodes], [replacement]); assert.deepEqual([...removed], [element]);
      assert.equal(second.addedNodes[0], replacement); assert.equal(removed[0], element);
      assert.equal(second.previousSibling, before); assert.equal(second.nextSibling, text);
      foreign.window.document.body.append(element, host);
      assert.equal(element.ownerDocument, foreign.window.document); assert.equal(host.ownerDocument, foreign.window.document);
      assert.deepEqual([...firstAdded], [element, text]); assert.equal(removed.item(0), element); assert.equal(removed.item(1), null);
      host.textContent = ''; const third = observer.takeRecords()[0];
      assert.deepEqual([...third.removedNodes], [before, replacement, text, after]);
      for (const record of [first, second, third]) {
        assert.ok(record instanceof dom.window.MutationRecord);
        assert.equal(record instanceof foreign.window.MutationRecord, false);
        assert.ok(record.addedNodes instanceof dom.window.NodeList);
        assert.equal(record.type, 'childList'); assert.equal(record.oldValue, null);
        assert.equal(record.attributeName, null); assert.equal(record.attributeNamespace, null);
      }
      assert.equal(third.previousSibling, null); assert.equal(third.nextSibling, null);
      assert.deepEqual([...firstAdded], [element, text]); assert.deepEqual([...removed], [element]);
    } finally { observer.disconnect(); dom.window.close(); foreign.window.close(); }
  });

  test(`should deliver immutable character snapshots for Text, Comment, CDATA and ProcessingInstruction in ${name}`, async () => {
    const dom = new runtime.JSDOM('<root/>', { contentType: 'application/xml' }); const document = dom.window.document;
    const old = 'before\ud800'; const records = []; const observer = new dom.window.MutationObserver((batch) => records.push(...batch));
    const nodes = [document.createTextNode(old), document.createComment(old), document.createCDATASection(old),
      document.createProcessingInstruction('probe', old)];
    try {
      for (const node of nodes) { observer.observe(node, { characterData: true, characterDataOldValue: true }); node.appendData('\0\udc00'); }
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(records.length, nodes.length);
      for (const [index, record] of records.entries()) {
        assert.equal(record.target, nodes[index]); assert.equal(record.type, 'characterData'); assert.equal(record.oldValue, old);
        assert.equal(record.attributeName, null); assert.equal(record.attributeNamespace, null);
        assert.equal(record.previousSibling, null); assert.equal(record.nextSibling, null);
        nodes[index].data = 'later'; assert.equal(record.oldValue, old);
      }
    } finally { observer.disconnect(); dom.window.close(); }
  });
}

test('should expose immutable native snapshots and reject all invalid references before creating a record', () => {
  const { NativeTree, NativeRange, NativeMutationRecord } = require('../dist/native.cjs');
  const tree = new NativeTree(); const target = tree.allocate(); const child = tree.allocate();
  const reserved = tree.reserveHandles(); const released = tree.allocate(); tree.release(released);
  const input = { kind: 'attributes', target, previousSibling: child, nextSibling: 0,
    attributeName: 'flag\ud800', attributeNamespace: '', oldValue: '\0\udc00', addedNodes: [child, child], removedNodes: [child] };
  const record = new NativeMutationRecord(tree, input);
  assert.equal(record.kind, 'attributes'); assert.equal(record.target, target); assert.equal(record.previousSibling, child);
  assert.equal(record.nextSibling, 0); assert.equal(record.attributeName, input.attributeName);
  assert.equal(record.attributeNamespace, ''); assert.equal(record.oldValue, input.oldValue);
  input.addedNodes.length = 0; const returned = record.addedNodes; returned.pop();
  assert.deepEqual(record.addedNodes, [child, child]); assert.deepEqual(record.removedNodes, [child]);
  const empty = new NativeMutationRecord(tree, { kind: 'childList', target, previousSibling: 0, nextSibling: 0, addedNodes: [], removedNodes: [] });
  assert.equal(empty.oldValue, null); assert.equal(empty.attributeName, null); assert.equal(empty.attributeNamespace, null);
  const explicitNull = new NativeMutationRecord(tree, { ...input, attributeName: null, attributeNamespace: null, oldValue: null });
  assert.equal(explicitNull.oldValue, null); assert.equal(explicitNull.attributeName, null); assert.equal(explicitNull.attributeNamespace, null);
  const before = NativeMutationRecord.statistics(); const treeBefore = tree.statistics();
  for (const invalid of [0, -1, 0.5, NaN, Infinity, reserved, released]) {
    assert.throws(() => new NativeMutationRecord(tree, { ...input, target: invalid }), { code: 'InvalidArg' });
    assert.throws(() => new NativeMutationRecord(tree, { ...input, addedNodes: [child, invalid] }), { code: 'InvalidArg' });
    assert.throws(() => new NativeMutationRecord(tree, { ...input, removedNodes: [invalid] }), { code: 'InvalidArg' });
    if (invalid !== 0) for (const field of ['previousSibling', 'nextSibling']) {
      assert.throws(() => new NativeMutationRecord(tree, { ...input, [field]: invalid }), { code: 'InvalidArg' });
    }
  }
  assert.throws(() => new NativeMutationRecord(tree, { ...input, kind: 'unknown' }), { code: 'InvalidArg' });
  for (const foreign of [{}, new NativeRange(), record]) {
    assert.throws(() => new NativeMutationRecord(foreign, input), { code: 'InvalidArg' });
  }
  assert.deepEqual(NativeMutationRecord.statistics(), before); assert.deepEqual(tree.statistics(), treeBefore);
  for (const node of [child, target, reserved]) tree.release(node);
  assert.equal(record.target, target); assert.deepEqual(record.addedNodes, [child, child]);
  assert.equal(record.oldValue, '\0\udc00'); assert.equal(tree.statistics().liveNodes, 0);
});

test('should release records independently of retained lists and release every owner after snapshots are dropped', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/mutation-record-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
