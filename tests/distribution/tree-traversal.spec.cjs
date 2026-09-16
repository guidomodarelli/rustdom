/** @file Exercises filtered traversal through the installed package and its real native addon. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('@rustdom/rustdom');

for (const kind of ['TreeWalker', 'NodeIterator']) {
  for (const filterKind of ['function', 'object']) {
    test(`should preserve ${kind} filtering and conversions when installed with a ${filterKind} filter`, () => {
      // Arrange: rejection prunes TreeWalker descendants but only skips NodeIterator candidates.
      const { window } = new JSDOM('<main id="root"><p id="first"></p><section id="skip"><b id="nested"></b></section><aside id="reject"><i id="hidden"></i></aside><p id="last"></p></main>');
      const { document, NodeFilter } = window;
      const root = document.getElementById('root');
      const filtered = [];
      const converted = [];
      /** @param {Node} node - Public candidate. @returns {object} Observable WebIDL numeric conversion. */
      const acceptNode = (node) => {
        filtered.push(node.id);
        const decision = node.id === 'root' || node.id === 'skip' ? NodeFilter.FILTER_SKIP
          : node.id === 'reject' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        return { valueOf() { converted.push(node.id); return 65536 + decision; } };
      };
      const filter = filterKind === 'function' ? acceptNode : {
        acceptNode(node) { assert.equal(this, filter); return acceptNode(node); },
      };
      try {
        // Act: every visited candidate reaches numeric conversion before native traversal resumes.
        const cursor = document[`create${kind}`](root, NodeFilter.SHOW_ELEMENT, filter);
        const visited = [];
        let node;
        while ((node = cursor.nextNode()) !== null) visited.push(node.id);

        // Assert both accepted topology and conversion side effects through the public API.
        assert.deepEqual(visited, kind === 'TreeWalker' ? ['first', 'nested', 'last'] : ['first', 'nested', 'hidden', 'last']);
        assert.deepEqual(converted, filtered);
        assert.deepEqual(filtered, kind === 'TreeWalker'
          ? ['first', 'skip', 'nested', 'reject', 'last']
          : ['root', 'first', 'skip', 'nested', 'reject', 'hidden', 'last']);
        assert.equal(cursor.filter, filter);
        assert.equal(cursor.root, root);
      } finally { window.close(); }
    });
  }

  test(`should recover ${kind} traversal when a filter result cannot convert to unsigned short`, () => {
    // Arrange: Symbol is invalid, followed by an overflowing value that wraps to FILTER_ACCEPT.
    const { window } = new JSDOM('<main id="root"><p id="first"></p><p id="last"></p></main>');
    const root = window.document.getElementById('root');
    let failConversion = true;
    const cursor = window.document[`create${kind}`](root, window.NodeFilter.SHOW_ELEMENT, () => {
      if (failConversion) { failConversion = false; return Symbol('invalid filter result'); }
      return 65537;
    });
    try {
      // Act and assert: conversion failure preserves the position and leaves the cursor usable.
      assert.throws(() => cursor.nextNode(), { name: 'TypeError' });
      assert.equal(kind === 'TreeWalker' ? cursor.currentNode : cursor.referenceNode, root);
      assert.equal(cursor.nextNode().id, kind === 'TreeWalker' ? 'first' : 'root');
      assert.equal(cursor.nextNode().id, kind === 'TreeWalker' ? 'last' : 'first');
    } finally { window.close(); }
  });
}
