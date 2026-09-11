/** @file Compares canonical native CharacterData with jsdom through real DOM operations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const reference = require('jsdom');
const runtime = require('../dist/index.cjs');
const { NativeTree } = require('../dist/native.cjs');

/** @param {Document} document - Real document. @param {string} kind - Interface name. @param {string} value - Initial text. @returns {CharacterData} A real node. */
function createCharacter(document, kind, value) {
  if (kind === 'Text') return document.createTextNode(value);
  if (kind === 'Comment') return document.createComment(value);
  if (kind === 'CDATASection') return document.createCDATASection(value);
  return document.createProcessingInstruction('rustdom', value);
}

/** @param {Function} operation - Public DOM operation. @returns {object} Value or specified DOM exception. */
function outcome(operation) {
  try { return { value: operation() }; }
  catch (error) { return { name: error.name, code: error.code, message: error.message }; }
}

for (const kind of ['Text', 'Comment', 'CDATASection', 'ProcessingInstruction']) {
  test(`should preserve ${kind} UTF16 mutation and error contracts`, () => {
    const expected = new reference.JSDOM('<root/>', { contentType: 'application/xml' });
    const actual = new runtime.JSDOM('<root/>', { contentType: 'application/xml' });
    try {
      const nodes = [expected, actual].map((dom) => createCharacter(dom.window.document, kind, 'A🦀\0\ud800Z'));
      const mutations = [
        (node) => node.appendData('\udc00'),
        (node) => node.insertData(2, '<&'),
        (node) => node.replaceData(1, 1, 'é'),
        (node) => node.deleteData(4, 2 ** 32 - 1),
        (node) => node.insertData(node.length, 'tail'),
        (node) => node.replaceData(node.length + 1, 0, ''),
        (node) => node.substringData(-1, 0),
        (node) => node.substringData(2 ** 32, 2),
        (node) => { node.data = null; },
        (node) => { node.nodeValue = 'new\udfff'; },
        (node) => { node.textContent = '🦀'; },
      ];
      for (const mutate of mutations) {
        assert.deepEqual(outcome(() => mutate(nodes[1])), outcome(() => mutate(nodes[0])));
        assert.equal(nodes[1].data, nodes[0].data);
        assert.equal(nodes[1].nodeValue, nodes[0].nodeValue);
        assert.equal(nodes[1].textContent, nodes[0].textContent);
        assert.equal(nodes[1].length, nodes[0].length);
        for (const offset of [0, 1, nodes[0].length, nodes[0].length + 1]) {
          assert.deepEqual(outcome(() => nodes[1].substringData(offset, 2 ** 32 - 1)),
            outcome(() => nodes[0].substringData(offset, 2 ** 32 - 1)));
        }
      }
    } finally { expected.window.close(); actual.window.close(); }
  });
}

/** @param {object} engine - Real JSDOM package. @returns {object} Observable text, range and observer effects. */
function observeMutations(engine) {
  const dom = new engine.JSDOM('<!doctype html><div>0123456789</div>');
  try {
    const document = dom.window.document;
    const parent = document.querySelector('div');
    const node = parent.firstChild;
    const observer = new dom.window.MutationObserver(() => {});
    observer.observe(parent, { characterData: true, characterDataOldValue: true, childList: true, subtree: true });
    const ranges = [[1, 2], [3, 6], [6, 9]].map(([start, end]) => {
      const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end); return range;
    });
    const readRanges = () => ranges.map((range) => [range.startOffset, range.endOffset, range.toString()]);
    node.replaceData(2, 4, 'AB');
    const replaced = readRanges();
    const split = node.splitText(3);
    split.appendData('🦀');
    const splitRanges = readRanges();
    const wholeText = split.wholeText;
    parent.normalize();
    const normalized = readRanges();
    const records = observer.takeRecords().map((record) => ({ type: record.type, oldValue: record.oldValue,
      added: [...record.addedNodes].map((child) => child.data), removed: [...record.removedNodes].map((child) => child.data) }));
    const range = document.createRange();
    range.setStart(parent.firstChild, 1); range.setEnd(parent.firstChild, 4);
    const fragment = range.cloneContents();
    const holder = document.createElement('section'); holder.append(fragment);
    const cloneHTML = holder.innerHTML;
    const extracted = range.extractContents();
    const extractedText = extracted.textContent;
    observer.disconnect();
    return { replaced, splitRanges, wholeText, normalized, records, cloneHTML, extractedText, html: dom.serialize() };
  } finally { dom.window.close(); }
}

test('should preserve live ranges, observer old values, splitText, normalization and range clones', () => {
  assert.deepEqual(observeMutations(runtime), observeMutations(reference));
});

test('should query native trees containing lone-surrogate text and serialize them losslessly', () => {
  const dom = new runtime.JSDOM('<!doctype html><div></div><p></p>');
  try {
    const document = dom.window.document;
    document.querySelector('div').append(document.createTextNode('\ud800'));
    const before = runtime.getNativeTreeStatistics();
    assert.deepEqual([...document.querySelectorAll(':empty')].map((node) => node.localName), ['head', 'p']);
    assert.equal(document.querySelector('body:has(div)').localName, 'body');
    assert.ok(runtime.getNativeTreeStatistics().nativeQueries > before.nativeQueries);
    assert.ok(dom.serialize().includes('<div>\ud800</div>'));
  } finally { dom.window.close(); }
});

test('should preserve adjacent Text and CDATA wholeText boundaries', () => {
  const observe = (engine) => {
    const dom = new engine.JSDOM('<root/>', { contentType: 'application/xml' });
    try {
      const document = dom.window.document;
      const nodes = [document.createTextNode('A'), document.createTextNode('B'),
        document.createCDATASection('C'), document.createTextNode('D'), document.createComment('stop'), document.createTextNode('E')];
      document.documentElement.append(...nodes);
      return nodes.filter((node) => 'wholeText' in node).map((node) => node.wholeText);
    } finally { dom.window.close(); }
  };
  assert.deepEqual(observe(runtime), observe(reference));
});

test('should expose native string operations with atomic errors and release their storage', () => {
  const tree = new NativeTree();
  const handle = tree.allocate();
  tree.setCharacterData(handle, 3, 'A🦀\0');
  assert.equal(tree.characterLength(handle), 4);
  assert.equal(tree.substringData(handle, 1, 1), '\ud83e');
  assert.throws(() => tree.replaceCharacterData(handle, 5, 0, 'invalid'), { code: 'InvalidArg' });
  assert.equal(tree.getCharacterData(handle), 'A🦀\0');
  assert.equal(tree.replaceCharacterData(handle, 2, 1, 'X'), 'A🦀\0');
  assert.equal(tree.getCharacterData(handle), 'A\ud83eX\0');
  const sibling = tree.allocate();
  tree.insertAfter(handle, sibling);
  assert.throws(() => tree.wholeText(handle), { code: 'InvalidArg' });
  tree.release(sibling);
  tree.release(handle);
  assert.equal(tree.statistics().dataNodes, 0);
});
