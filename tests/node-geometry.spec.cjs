/** @file Exercises generic node geometry through actual DOM nodes, helper callers and native topology. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const adapters = {
  jsdom: { runtime: require('jsdom'), helpers: require('jsdom/lib/jsdom/living/helpers/node'),
    implementation: require('jsdom/lib/jsdom/living/generated/utils').implForWrapper },
  rustdom: { runtime: require('../dist/index.cjs'), helpers: require('../dist/vendor-jsdom/lib/jsdom/living/helpers/node'),
    implementation: require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils').implForWrapper },
};

/** @param {object} adapter - Real runtime and its actual helper module. @returns {object[]} Geometry before and after moves/adoption. */
function inspectGeometry(adapter) {
  const dom = new adapter.runtime.JSDOM('<!doctype html><main><section id="target"><p>text</p><b>end</b></section><aside></aside><template><span>template</span></template></main>');
  try {
    const document = dom.window.document; const section = document.querySelector('section');
    const fragment = document.createDocumentFragment(); fragment.append(document.createElement('fragment-child'));
    const shadow = document.querySelector('aside').attachShadow({ mode: 'open' }); shadow.innerHTML = '<i>shadow</i>';
    const template = document.querySelector('template');
    const foreign = document.implementation.createDocument('urn:foreign', 'root');
    const detached = document.createElement('detached'); detached.append('detached');
    const nodes = [document, document.doctype, document.documentElement, document.body, document.querySelector('main'),
      section, section.firstChild, section.firstChild.firstChild, section.lastChild, section.getAttributeNode('id'),
      document.querySelector('aside'), shadow, shadow.firstChild, shadow.firstChild.firstChild,
      fragment, fragment.firstChild, template, template.content, template.content.firstChild,
      detached, detached.firstChild, foreign, foreign.documentElement];
    const implementations = nodes.map(adapter.implementation);
    const snapshots = [];
    /** @returns {void} Records behavior only, including every ordered pair of real node identities. */
    function capture() {
      snapshots.push({ roots: implementations.map((node) => implementations.indexOf(adapter.helpers.nodeRoot(node))),
        lengths: implementations.map((node) => adapter.helpers.nodeLength(node)),
        ancestry: implementations.flatMap((ancestor) => implementations.map((node) => adapter.helpers.isInclusiveAncestor(ancestor, node))),
        following: implementations.flatMap((node) => implementations.map((reference) => adapter.helpers.isFollowing(node, reference))) });
    }
    assert.throws(() => adapter.helpers.nodeRoot(null), TypeError);
    assert.throws(() => adapter.helpers.nodeRoot(undefined), TypeError);
    assert.equal(adapter.helpers.isInclusiveAncestor(null, implementations[0]), false);
    assert.equal(adapter.helpers.isInclusiveAncestor(implementations[0], null), false);
    assert.equal(adapter.helpers.isFollowing(null, implementations[0]), false);
    assert.equal(adapter.helpers.isFollowing(implementations[0], null), false);
    capture(); fragment.append(section); capture(); foreign.documentElement.append(foreign.adoptNode(section)); capture();
    return snapshots;
  } finally { dom.window.close(); }
}

test('should preserve roots, lengths, ancestry and preorder across all node pairs and live adoption', () => {
  assert.deepEqual(inspectGeometry(adapters.rustdom), inspectGeometry(adapters.jsdom));
});

test('should preserve public roots across shadow boundaries, detached hosts and template contents', () => {
  for (const adapter of Object.values(adapters)) {
    const dom = new adapter.runtime.JSDOM('<main></main><template><p>inert</p></template>');
    try {
      const document = dom.window.document; const host = document.querySelector('main');
      const shadow = host.attachShadow({ mode: 'closed' }); const child = shadow.appendChild(document.createElement('b'));
      assert.equal(child.getRootNode(), shadow); assert.equal(child.getRootNode({ composed: true }), document);
      host.remove(); assert.equal(child.getRootNode(), shadow); assert.equal(child.getRootNode({ composed: true }), host);
      const fragment = document.createDocumentFragment(); fragment.append(host);
      assert.equal(child.getRootNode({ composed: true }), fragment);
      const template = document.querySelector('template'); assert.equal(template.content.firstChild.getRootNode(), template.content);
      const attribute = document.createAttribute('name'); host.setAttributeNode(attribute);
      assert.equal(attribute.getRootNode(), attribute); assert.equal(host.contains(attribute), false);
      document.body.append(fragment); assert.equal(child.getRootNode({ composed: true }), document);
    } finally { dom.window.close(); }
  }
});

test('should preserve helper UTF16 and pinned CDATA length semantics in XML', () => {
  for (const adapter of Object.values(adapters)) {
    const dom = new adapter.runtime.JSDOM('<root><![CDATA[data]]><!--note--><?target value?>text</root>', { contentType: 'application/xml' });
    try {
      const document = dom.window.document; const root = document.documentElement;
      const nodes = [...root.childNodes]; nodes[3].data = 'A🦀\ud800';
      assert.deepEqual(nodes.map((node) => adapter.helpers.nodeLength(adapter.implementation(node))), [0, 4, 5, 4]);
      assert.equal(adapter.helpers.nodeLength(adapter.implementation(root)), 4);
      nodes[0].remove(); assert.equal(adapter.helpers.nodeLength(adapter.implementation(root)), 3);
      assert.equal(nodes[0].getRootNode(), nodes[0]);
    } finally { dom.window.close(); }
  }
});

test('should query topology-only roots and order without accepting unallocated handles', () => {
  const { NativeTree } = require('../dist/native.cjs'); const tree = new NativeTree();
  const root = tree.allocate(); const first = tree.allocate(); const last = tree.allocate();
  tree.append(root, first); tree.append(root, last);
  assert.equal(tree.nodeRoot(last), root); assert.equal(tree.isFollowing(last, first), true);
  assert.equal(tree.isFollowing(first, last), false); assert.equal(tree.isFollowing(root, root), false);
  const reserved = tree.reserveHandles(); const before = tree.statistics();
  for (const invalid of [0, -1, 0.5, NaN, reserved]) {
    assert.throws(() => tree.nodeRoot(invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.nodeLength(invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.isFollowing(invalid, root), { code: 'InvalidArg' });
    assert.throws(() => tree.isFollowing(root, invalid), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), before);
  for (const node of [first, last, root]) tree.release(node); assert.equal(tree.statistics().liveNodes, 0);
});
