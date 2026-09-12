/** @file Verifies atomic transitions from snapshots to canonical native attribute collections. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { NativeTree, QueryMode } = require('../dist/native.cjs');

/** @returns {object} Shared HTML metadata for snapshot initialization. */
function metadata() { return { kind: 1, name: 'div', namespace: 'http://www.w3.org/1999/xhtml' }; }

/** Snapshot entry points preserve attributes without manufacturing canonical Attr objects. */
const snapshots = [
  ['setData', (tree, element, attributes) => tree.setData(element, JSON.stringify({ ...metadata(),
    attributes: attributes.length ? [{ name: 'id', value: 'preserved' }, { name: 'class', value: 'needle' }] : [] }))],
  ['setHtmlElement', (tree, element, attributes) => tree.setHtmlElement(element, 'div',
    attributes.length ? ['id', 'preserved', 'class', 'needle'] : [])],
  ['setElementFromAttributes', (tree, element, attributes) => tree.setElementFromAttributes(element, JSON.stringify(metadata()), attributes)],
  ['setHtmlElementFromAttributes', (tree, element, attributes) => tree.setHtmlElementFromAttributes(element, 'div', attributes)],
];

/** @param {NativeTree} tree - Real addon instance. @param {number} element - Root element. @param {number} document - Owning document. @returns {object} Observable snapshot state. */
function observe(tree, element, document) {
  return { html: tree.serializeHtml(element, true, false),
    classMatches: Array.from(tree.query('.needle', document, document, QueryMode.All, false)),
    idMatches: Array.from(tree.query('#preserved', document, document, QueryMode.All, false)),
    canonical: tree.attributeIds(element) };
}

for (const [name, write] of snapshots) {
  test(`should reject collection initialization after a nonempty ${name} snapshot without changing state`, () => {
    const tree = new NativeTree();
    const document = tree.allocate(); const element = tree.allocate();
    const id = tree.allocate(); const className = tree.allocate();
    tree.setSimpleData(document, 9, '');
    tree.initializePlainAttribute(id, 'id', 'preserved'); tree.initializePlainAttribute(className, 'class', 'needle');
    write(tree, element, [id, className]); tree.append(document, element);
    const expected = observe(tree, element, document);
    assert.deepEqual(expected, { html: '<div id="preserved" class="needle"></div>',
      classMatches: [element], idMatches: [element], canonical: [] });
    const before = tree.statistics();
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      assert.throws(() => tree.initializeAttributeCollection(element), { code: 'InvalidArg', message: /snapshot attributes/ });
    }
    assert.deepEqual(tree.statistics(), before);
    assert.deepEqual(observe(tree, element, document), expected);
    assert.deepEqual(tree.statistics(), { ...before, nativeQueries: before.nativeQueries + 2,
      selectorCacheHits: before.selectorCacheHits + 2, serializations: before.serializations + 1 });
    assert.equal(tree.attributeOwner(id), 0); assert.equal(tree.attributeOwner(className), 0);
    for (const handle of [document, element, id, className]) tree.release(handle);
    assert.equal(tree.statistics().liveNodes, 0);
    assert.equal(tree.statistics().attributeCollections, 0);
  });

  test(`should initialize a canonical collection after an empty ${name} snapshot`, () => {
    const tree = new NativeTree(); const element = tree.allocate(); const attribute = tree.allocate();
    write(tree, element, []); tree.initializeAttributeCollection(element);
    tree.initializePlainAttribute(attribute, 'id', 'added'); tree.appendAttribute(element, attribute);
    assert.deepEqual(tree.attributeIds(element), [attribute]);
    assert.equal(tree.attributeOwner(attribute), element);
    assert.equal(tree.serializeHtml(element, true, false), '<div id="added"></div>');
    tree.release(element); tree.release(attribute);
    assert.equal(tree.statistics().liveNodes, 0);
    assert.equal(tree.statistics().attributeOwners, 0);
  });
}

test('should preserve constructor ordering and idempotence of populated canonical collections', () => {
  const tree = new NativeTree();
  const element = tree.reserveHandles();
  tree.initializeAttributeCollection(element);
  assert.equal(tree.statistics().allocations, 1);
  tree.setHtmlElementMetadata(element, 'div');
  const attribute = element + 1;
  tree.initializePlainAttribute(attribute, 'id', 'retained'); tree.appendAttribute(element, attribute);
  const before = tree.statistics();
  for (let attempt = 0; attempt < 1000; attempt += 1) tree.initializeAttributeCollection(element);
  assert.deepEqual(tree.statistics(), before);
  assert.deepEqual(tree.attributeIds(element), [attribute]);
  assert.equal(tree.attributeOwner(attribute), element);
  assert.equal(tree.serializeHtml(element, true, false), '<div id="retained"></div>');
  for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(element + offset);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(tree.statistics().reservedHandles, 0);
});

test('should reject metadata of non-Elements without creating a collection', () => {
  for (const kind of [2, 3, 9, 11]) {
    const tree = new NativeTree(); const handle = tree.allocate();
    tree.setData(handle, JSON.stringify({ kind, name: kind === 2 ? 'attr' : undefined, value: 'retained' }));
    const before = tree.statistics();
    assert.throws(() => tree.initializeAttributeCollection(handle), { code: 'InvalidArg', message: /not an initialized Element/ });
    assert.deepEqual(tree.statistics(), before);
    tree.release(handle); assert.equal(tree.statistics().liveNodes, 0);
  }
});

test('should preserve reserved handles when collection initialization receives an invalid ID', () => {
  const tree = new NativeTree(); const first = tree.reserveHandles();
  const before = tree.statistics();
  for (const handle of [0, 1.5, NaN, first + tree.handleBatchSize]) {
    assert.throws(() => tree.initializeAttributeCollection(handle), { code: 'InvalidArg' });
    assert.deepEqual(tree.statistics(), before);
  }
});

test('should collect native tree instances after repeated rejected transitions', (context) => {
  const worker = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/collection-initialization-worker.cjs')], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 30_000,
  });
  if (worker.error) throw worker.error;
  assert.equal(worker.status, 0, worker.stderr || worker.stdout);
  const report = JSON.parse(worker.stdout);
  assert.equal(report.observedTrees, 64);
  assert.equal(report.held.reached, false);
  assert.equal(report.released.reached, true);
  assert.equal(report.released.state.survivors.trees, 0);
  context.diagnostic(JSON.stringify(report));
});
