/** @file Exercises native Range stringification through public boundaries, UTF-16 and live mutations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} engine - Real DOM implementation. @returns {object} Text observations across boundary combinations. */
function inspect(engine) {
  const dom = new engine.JSDOM('<main></main><footer>outside</footer>');
  try {
    const document = dom.window.document;
    const root = document.querySelector('main');
    const first = document.createTextNode('A\ud800🦀Z');
    const span = document.createElement('span'); span.textContent = 'B\0C';
    const comment = document.createComment('ignored');
    const instruction = document.createProcessingInstruction('target', 'ignored');
    const template = document.createElement('template'); template.innerHTML = 'template';
    const last = document.createTextNode('END');
    root.append(first, span, comment, instruction, template, last);
    const shadow = root.attachShadow({ mode: 'open' }); shadow.textContent = 'shadow';
    const points = [[root, 0], [root, 1], [root, 2], [root, 6], [first, 0], [first, 1], [first, 2],
      [first, 3], [first, 5], [span, 0], [span, 1], [span.firstChild, 0], [span.firstChild, 2],
      [span.firstChild, 3], [comment, 0], [comment, 7], [instruction, 2], [last, 0], [last, 3],
      [template.content, 0], [template.content.firstChild, 4], [shadow, 0], [shadow.firstChild, 3]];
    const range = document.createRange();
    const observations = points.map(([start, startOffset]) => points.map(([end, endOffset]) => {
      range.setStart(start, startOffset); range.setEnd(end, endOffset);
      return [range.toString(), String(range)];
    }));
    range.selectNodeContents(root);
    const retained = range.toString();
    assert.equal(retained, 'A\ud800🦀ZB\0CEND');
    first.data = 'new'; root.append(span);
    const changed = range.toString();
    assert.equal(retained, 'A\ud800🦀ZB\0CEND');
    return { observations, retained, changed };
  } finally { dom.window.close(); }
}

test('should preserve Range text across partial boundaries, templates, shadow roots and live changes', () => {
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should retain jsdom exclusion of CDATA, Comment and PI from Range text', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<root><![CDATA[ignored]]>Text<!--comment--><?target instruction?><child>More</child></root>', { contentType: 'application/xml' });
    try {
      const root = dom.window.document.documentElement;
      const range = dom.window.document.createRange(); range.selectNodeContents(root);
      assert.equal(range.toString(), 'TextMore');
      range.setStart(root.childNodes[1], 2); range.setEnd(root.lastChild.firstChild, 2);
      assert.equal(String(range), 'xtMo');
    } finally { dom.window.close(); }
  }
});

test('should copy native Range text before subsequent mutation and node release', () => {
  const { NativeTree } = require('../dist/native.cjs');
  const tree = new NativeTree();
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'A\ud800B');
  const result = tree.rangeText(text, 1, text, 2);
  tree.setCharacterData(text, 3, 'changed'); tree.release(text);
  assert.equal(result, '\ud800');
  assert.equal(tree.statistics().liveNodes, 0);
});
