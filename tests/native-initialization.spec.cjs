/** @file Verifies snapshot initialization boundaries against the real native addon. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree } = require('../dist/native.cjs');

/** @param {string} name - Element name. @returns {object} Lossless HTML metadata. */
function metadata(name) {
  return { kind: 1, name, namespace: 'http://www.w3.org/1999/xhtml' };
}

/** Snapshot APIs all replace their supplied attribute list, including an empty list. */
const initializers = [
  ['setData', (tree, element, attribute, includeAttribute, template) => tree.setData(element, JSON.stringify({
    ...metadata('article'), templateContent: template,
    attributes: includeAttribute ? [{ name: 'title', value: 'incoming' }] : [],
  }))],
  ['setHtmlElement', (tree, element, attribute, includeAttribute) =>
    tree.setHtmlElement(element, 'article', includeAttribute ? ['title', 'incoming'] : [])],
  ['setElementFromAttributes', (tree, element, attribute, includeAttribute, template) =>
    tree.setElementFromAttributes(element, JSON.stringify({ ...metadata('article'), templateContent: template }),
      includeAttribute ? [attribute] : [])],
  ['setHtmlElementFromAttributes', (tree, element, attribute, includeAttribute) =>
    tree.setHtmlElementFromAttributes(element, 'article', includeAttribute ? [attribute] : [])],
];

for (const [name, initialize] of initializers) {
  test(`should preserve ${name} snapshot attributes before a canonical collection is initialized`, () => {
    const tree = new NativeTree();
    const element = tree.allocate();
    const attribute = tree.allocate();
    tree.initializePlainAttribute(attribute, 'title', 'incoming');
    initialize(tree, element, attribute, true, 0);
    assert.equal(tree.serializeHtml(element, true, false), '<article title="incoming"></article>');
    initialize(tree, element, attribute, false, 0);
    assert.equal(tree.serializeHtml(element, true, false), '<article></article>');
    tree.release(element); tree.release(attribute);
    assert.equal(tree.statistics().liveNodes, 0);
  });

  test(`should reject ${name} atomically when a canonical attribute collection exists`, () => {
    for (const populated of [false, true]) {
      for (const includeAttribute of [false, true]) {
        const tree = new NativeTree();
        const element = tree.allocate();
        const current = tree.allocate();
        const incoming = tree.allocate();
        tree.initializeAttributeCollection(element);
        tree.setHtmlElementMetadata(element, 'section');
        tree.initializePlainAttribute(current, 'id', 'retained');
        tree.initializePlainAttribute(incoming, 'title', 'incoming');
        if (populated) tree.appendAttribute(element, current);
        // A rejected snapshot must not materialize its reserved template handle either.
        const template = tree.reserveHandles();
        const before = tree.statistics();

        assert.throws(() => initialize(tree, element, incoming, includeAttribute, template), {
          code: 'InvalidArg', message: /attribute collection.*initialized.*metadata/i,
        });
        assert.deepEqual(tree.statistics(), before);
        assert.deepEqual(tree.attributeIds(element), populated ? [current] : []);
        assert.equal(tree.attributeOwner(current), populated ? element : 0);
        assert.equal(tree.attributeOwner(incoming), 0);
        assert.equal(tree.serializeHtml(element, true, false),
          populated ? '<section id="retained"></section>' : '<section></section>');

        tree.setHtmlElementMetadata(element, 'aside');
        tree.setElementMetadata(element, JSON.stringify(metadata('nav')));
        assert.equal(tree.serializeHtml(element, true, false),
          populated ? '<nav id="retained"></nav>' : '<nav></nav>');
        tree.release(element); tree.release(current); tree.release(incoming);
        for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(template + offset);
        const after = tree.statistics();
        for (const field of ['liveNodes', 'dataNodes', 'reservedHandles', 'attributeCollections', 'attributeOwners', 'attributeHolders']) {
          assert.equal(after[field], 0, field);
        }
      }
    }
  });
}

test('should reject snapshots immediately after collection initialization without hydrating metadata', () => {
  for (const [, initialize] of initializers) {
    const tree = new NativeTree();
    const element = tree.allocate(); const attribute = tree.allocate();
    tree.initializeAttributeCollection(element);
    tree.initializePlainAttribute(attribute, 'title', 'incoming');
    const before = tree.statistics();
    assert.throws(() => initialize(tree, element, attribute, true, 0), { code: 'InvalidArg' });
    assert.deepEqual(tree.statistics(), before);
    assert.deepEqual(tree.attributeIds(element), []);
    assert.equal(tree.attributeOwner(attribute), 0);
    tree.setHtmlElementMetadata(element, 'article'); tree.appendAttribute(element, attribute);
    assert.equal(tree.serializeHtml(element, true, false), '<article title="incoming"></article>');
    tree.release(element); tree.release(attribute);
    assert.equal(tree.statistics().liveNodes, 0);
  }
});

test('should retain template contents when dedicated metadata updates preserve a collection', () => {
  const tree = new NativeTree();
  const element = tree.allocate(); const attribute = tree.allocate();
  const fragment = tree.allocate(); const text = tree.allocate();
  tree.initializeAttributeCollection(element);
  tree.setElementMetadata(element, JSON.stringify({ ...metadata('template'), templateContent: fragment }));
  tree.setSimpleData(fragment, 11, ''); tree.setSimpleData(text, 3, 'inside');
  tree.append(fragment, text);
  tree.initializePlainAttribute(attribute, 'id', 'inert'); tree.appendAttribute(element, attribute);
  tree.setElementMetadata(element, JSON.stringify({ ...metadata('template'), templateContent: fragment }));
  assert.equal(tree.serializeHtml(element, true, false), '<template id="inert">inside</template>');
  for (const handle of [element, attribute, fragment, text]) tree.release(handle);
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should keep native ownership bounded across repeated rejected snapshots', () => {
  const tree = new NativeTree();
  const element = tree.allocate(); const attribute = tree.allocate();
  tree.initializeAttributeCollection(element); tree.setHtmlElementMetadata(element, 'section');
  tree.initializePlainAttribute(attribute, 'title', 'retained'); tree.appendAttribute(element, attribute);
  const before = tree.statistics();
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    for (const [, initialize] of initializers) {
      assert.throws(() => initialize(tree, element, attribute, true, 0), { code: 'InvalidArg' });
    }
  }
  assert.deepEqual(tree.statistics(), before);
  tree.release(element); tree.release(attribute);
  const after = tree.statistics();
  for (const field of ['liveNodes', 'dataNodes', 'attributeCollections', 'attributeOwners', 'attributeHolders']) {
    assert.equal(after[field], 0, field);
  }
});
