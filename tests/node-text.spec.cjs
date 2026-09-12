/** @file Exercises native Node value and descendant-text reads against an independent DOM. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {Node[]} nodes - Public nodes. @returns {object[]} Value and aggregate reads. */
function observe(nodes) {
  return nodes.map((node) => ({ kind: node.nodeType, value: node.nodeValue, text: node.textContent }));
}

/** @param {object} engine - Actual DOM implementation. @returns {object[][]} State after real mutations. */
function inspect(engine) {
  const dom = new engine.JSDOM('<!doctype html><main>a<span>b</span><!--ignored--><template>template</template></main><aside>outside</aside>');
  try {
    const document = dom.window.document;
    const root = document.querySelector('main');
    const span = root.querySelector('span');
    const template = root.querySelector('template');
    const attribute = document.createAttribute('value');
    attribute.value = 'attribute\0\ud800';
    root.setAttributeNode(attribute);
    const shadow = root.attachShadow({ mode: 'open' });
    shadow.append(document.createTextNode('shadow'));
    const nodes = [document, document.doctype, root, span, span.firstChild, root.childNodes[2],
      attribute, template, template.content, shadow, document.querySelector('aside')];
    const states = [observe(nodes)];
    const previous = root.textContent;
    span.firstChild.data = '\ud800\0🦀';
    assert.equal(previous, 'ab');
    states.push(observe(nodes));
    root.prepend(span); states.push(observe(nodes));
    attribute.nodeValue = 'new attribute'; states.push(observe(nodes));
    span.firstChild.nodeValue = null; states.push(observe(nodes));
    span.textContent = 'replacement'; states.push(observe(nodes));
    const range = document.createRange();
    range.selectNodeContents(span);
    range.deleteContents(); states.push(observe(nodes));
    return states;
  } finally { dom.window.close(); }
}

test('should read live text and values without crossing template, shadow or sibling boundaries', () => {
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should aggregate XML CDATA and Text while preserving direct Comment and PI values', () => {
  const inspectXml = (engine) => {
    const dom = new engine.JSDOM('<root>A<![CDATA[B]]><!--comment--><?target instruction?><child>C</child></root>', { contentType: 'application/xml' });
    try {
      const root = dom.window.document.documentElement;
      const nodes = [root, ...root.childNodes];
      const initial = observe(nodes);
      assert.equal(root.textContent, 'ABC');
      root.childNodes[1].data = '\ud800\0';
      const updated = observe(nodes);
      const stored = root.textContent;
      root.textContent = '';
      assert.equal(stored, 'A\ud800\0C');
      return { initial, updated, cleared: observe(nodes) };
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspectXml(engines.rustdom), inspectXml(engines.jsdom));
});

test('should copy native text results before subsequent mutation and release', () => {
  const { NativeTree } = require('../dist/native.cjs');
  const tree = new NativeTree();
  const root = tree.allocate();
  const text = tree.allocate();
  tree.setHtmlElement(root, 'main', []);
  tree.setCharacterData(text, 3, 'initial\ud800');
  tree.append(root, text);
  const value = tree.nodeValue(text);
  const aggregate = tree.textContent(root);
  tree.setCharacterData(text, 3, 'updated');
  assert.equal(tree.nodeValue(root), null);
  assert.equal(tree.textContent(root), 'updated');
  tree.release(text);
  tree.release(root);
  assert.equal(value, 'initial\ud800');
  assert.equal(aggregate, 'initial\ud800');
  assert.equal(tree.statistics().liveNodes, 0);
});
