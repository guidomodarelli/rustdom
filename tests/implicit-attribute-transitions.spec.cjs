/** @file Verifies every implicit entry into native attribute ownership and collection state. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { snapshots, operations, metadata, fixture, observe, release, NativeTree, AttributeField } = require('./helpers/implicit-attribute-fixture.cjs');

for (const writer of Object.keys(snapshots)) {
  for (const [name, operation] of Object.entries(operations)) {
    test(`should preserve the ${writer} snapshot when ${name} rejects its implicit transition`, () => {
      const state = fixture(writer);
      const expected = observe(state);
      const before = state.tree.statistics();
      for (let attempt = 0; attempt < 32; attempt += 1) {
        assert.throws(() => operation(state), { code: 'InvalidArg', message: /snapshot attributes/ });
      }
      assert.deepEqual(state.tree.statistics(), before);
      assert.deepEqual(observe(state), expected);
      assert.deepEqual(state.tree.statistics(), { ...before, nativeQueries: before.nativeQueries + 1,
        selectorCacheHits: before.selectorCacheHits + 1, serializations: before.serializations + 1 });
      // Explicit replacement remains available because the rejected operation created no index.
      snapshots[writer](state.tree, state.element, []);
      state.tree.appendAttribute(state.element, state.incoming);
      assert.equal(state.tree.serializeHtml(state.element, true, false), '<div data-new="incoming"></div>');
      release(state);
      assert.equal(state.tree.statistics().liveNodes, 0);
    });
  }

  test(`should seal constructor ownership before a later ${writer} snapshot can mix models`, () => {
    const state = fixture(writer, false);
    const { tree, element, incoming, attributes } = state;
    tree.initializeAttributeOwner(incoming, element);
    assert.equal(tree.statistics().attributeCollections, 1);
    assert.equal(tree.attributeOwner(incoming), element);
    const before = tree.statistics();
    assert.throws(() => snapshots[writer](tree, element, attributes), { code: 'InvalidArg' });
    assert.deepEqual(tree.statistics(), before);
    tree.setAttributeValue(incoming, 'changed');
    assert.equal(tree.serializeHtml(element, true, false), '<div></div>');
    tree.appendAttribute(element, incoming);
    assert.equal(tree.serializeHtml(element, true, false), '<div data-new="changed"></div>');
    tree.release(incoming);
    assert.equal(tree.serializeHtml(element, true, false), '<div></div>');
    release(state);
    assert.equal(tree.statistics().attributeOwners, 0);
    assert.equal(tree.statistics().liveNodes, 0);
  });

  test(`should preserve a ${writer} snapshot when a rejected owner is later changed and released`, () => {
    const state = fixture(writer);
    const { tree, element, incoming } = state;
    assert.throws(() => tree.initializeAttributeOwner(incoming, element), { code: 'InvalidArg' });
    tree.setAttributeValue(incoming, 'changed');
    assert.equal(tree.attributeField(incoming, AttributeField.Value), 'changed');
    assert.equal(tree.serializeHtml(element, true, false), '<div id="preserved" class="needle"></div>');
    tree.release(incoming);
    assert.equal(tree.serializeHtml(element, true, false), '<div id="preserved" class="needle"></div>');
    release(state);
  });
}

test('should preserve empty snapshots and legitimate attribute no-ops', () => {
  for (const name of ['appendAttribute', 'setAttribute', 'removeAttribute', 'replaceAttribute']) {
    const state = fixture('setData', false);
    const result = operations[name](state);
    assert.equal(result.changed, name === 'appendAttribute' || name === 'setAttribute');
    assert.equal(state.tree.statistics().attributeCollections, 1);
    if (result.changed) {
      const before = state.tree.statistics();
      assert.equal(state.tree.setAttribute(state.element, state.incoming).changed, false);
      assert.deepEqual(state.tree.statistics(), before);
      assert.throws(() => state.tree.appendAttribute(state.element, state.incoming), { code: 'InvalidArg' });
      assert.deepEqual(state.tree.statistics(), before);
    }
    release(state);
    assert.equal(state.tree.statistics().liveNodes, 0);
  }
});

test('should validate Attr and owner handles before creating an implicit index', () => {
  const state = fixture('setData', false);
  const { tree, element, incoming } = state;
  const unknown = Number.MAX_SAFE_INTEGER;
  const before = tree.statistics();
  for (const operation of [() => tree.appendAttribute(element, unknown), () => tree.setAttribute(element, unknown),
    () => tree.removeAttribute(element, unknown), () => tree.replaceAttribute(element, unknown, incoming),
    () => tree.replaceAttribute(element, incoming, unknown), () => tree.initializeAttributeOwner(unknown, element),
    () => tree.initializeAttributeOwner(incoming, unknown), () => tree.initializeAttributeOwner(incoming, NaN)]) {
    assert.throws(operation, { code: 'InvalidArg' });
    assert.deepEqual(tree.statistics(), before);
  }
  tree.initializeAttributeOwner(incoming, null);
  assert.deepEqual(tree.statistics(), before);
  tree.initializeAttributeOwner(incoming, element);
  const owned = tree.statistics();
  assert.throws(() => tree.initializeAttributeOwner(incoming, element), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), owned);
  release(state);
});

test('should reject in-use attributes without creating an index on an empty snapshot', () => {
  const state = fixture('setData', false);
  const { tree, element, incoming, attributes } = state;
  const other = tree.allocate(); tree.initializeAttributeCollection(other); tree.setHtmlElementMetadata(other, 'aside');
  tree.appendAttribute(other, incoming);
  const before = tree.statistics();
  for (const operation of [() => tree.appendAttribute(element, incoming), () => tree.setAttribute(element, incoming),
    () => tree.replaceAttribute(element, attributes[0], incoming), () => tree.initializeAttributeOwner(incoming, element)]) {
    assert.throws(operation, { code: 'InvalidArg' });
    assert.deepEqual(tree.statistics(), before);
  }
  assert.deepEqual(tree.attributeIds(other), [incoming]);
  assert.equal(tree.attributeOwner(incoming), other);
  assert.equal(tree.serializeHtml(other, true, false), '<aside data-new="incoming"></aside>');
  release(state); tree.release(other);
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should preserve canonical attributes through metadata updates and owner-only release', () => {
  const state = fixture('setData', false);
  const { tree, element, incoming } = state;
  tree.initializeAttributeOwner(incoming, element);
  tree.setElementMetadata(element, JSON.stringify(metadata('section')));
  assert.equal(tree.serializeHtml(element, true, false), '<section></section>');
  tree.release(incoming);
  assert.equal(tree.serializeHtml(element, true, false), '<section></section>');
  const attribute = tree.allocate(); tree.initializePlainAttribute(attribute, 'id', 'live'); tree.appendAttribute(element, attribute);
  tree.setHtmlElementMetadata(element, 'article');
  tree.setAttributeValue(attribute, 'updated');
  assert.equal(tree.serializeHtml(element, true, false), '<article id="updated"></article>');
  assert.deepEqual(tree.attributeIds(element), [attribute]);
  assert.equal(tree.attributeOwner(attribute), element);
  release(state); tree.release(attribute);
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should preserve metadata retyping and initial snapshots without bypassing the nonempty boundary', () => {
  const tree = new NativeTree();
  const element = tree.reserveHandles();
  tree.setSimpleData(element, 3, 'before');
  tree.setElementMetadata(element, JSON.stringify(metadata()));
  assert.equal(tree.serializeHtml(element, true, false), '<div></div>');
  tree.setHtmlElementMetadata(element, 'section');
  assert.equal(tree.serializeHtml(element, true, false), '<section></section>');
  const initial = element + 1;
  tree.setElementMetadata(initial, JSON.stringify({ ...metadata(), attributes: [{ name: 'id', value: 'initial' }] }));
  const before = tree.statistics();
  assert.throws(() => tree.setHtmlElementMetadata(initial, 'article'), { code: 'InvalidArg', message: /snapshot attributes/ });
  assert.deepEqual(tree.statistics(), before);
  assert.equal(tree.serializeHtml(initial, true, false), '<div id="initial"></div>');
  for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(element + offset);
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should collect native owners after exercising all rejected implicit transitions', (context) => {
  const worker = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/implicit-attribute-memory.cjs')], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 30_000,
  });
  if (worker.error) throw worker.error;
  assert.equal(worker.status, 0, worker.stderr || worker.stdout);
  const report = JSON.parse(worker.stdout);
  assert.equal(report.held.reached, false);
  assert.equal(report.released.reached, true);
  assert.equal(report.released.state.survivors.trees, 0);
  context.diagnostic(JSON.stringify(report));
});
