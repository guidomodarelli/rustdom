/** @file Exercise shared native Range state through public live/static interfaces and independent jsdom. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const source = process.env.RUSTDOM_COMBINED_SOURCE || path.resolve(__dirname, '..');
const requireSource = createRequire(path.join(source, 'package.json'));
const engines = { jsdom: requireSource('jsdom'), rustdom: requireSource('./dist/index.cjs') };

for (const [engine, runtime] of Object.entries(engines)) {
  test(`${engine}: static snapshots remain independent from native live collapse and text mutation`, () => {
    const dom = new runtime.JSDOM('<!doctype html><main>abcdef</main>');
    try {
      const { document, StaticRange } = dom.window;
      const text = document.querySelector('main').firstChild;
      const live = document.createRange();
      live.selectNodeContents(text);
      const snapshot = new StaticRange({ startContainer: text, startOffset: 2, endContainer: text, endOffset: 4 });
      const clones = [live.cloneRange(), live.cloneRange()];
      clones[0].collapse(true); clones[1].collapse(false);
      text.insertData(0, 'xy');
      assert.equal(live.startOffset, 0); assert.equal(live.endOffset, 8);
      assert.equal(clones[0].startOffset, 0); assert.equal(clones[0].endOffset, 0);
      assert.equal(clones[1].startOffset, 8); assert.equal(clones[1].endOffset, 8);
      assert.equal(snapshot.startContainer, text); assert.equal(snapshot.endContainer, text);
      assert.equal(snapshot.startOffset, 2); assert.equal(snapshot.endOffset, 4);
      assert.equal(snapshot.collapsed, false);
      assert.equal(clones[0].collapsed, true); assert.equal(clones[1].collapsed, true);
    } finally { dom.window.close(); }
  });

  test(`${engine}: rejected static construction does not corrupt live copied states or disconnected snapshots`, () => {
    const dom = new runtime.JSDOM('<!doctype html><main>abcdef</main>');
    try {
      const { document, StaticRange } = dom.window;
      const text = document.querySelector('main').firstChild;
      const detached = document.createTextNode('other');
      const snapshot = new StaticRange({ startContainer: text, startOffset: 400, endContainer: detached, endOffset: 900 });
      const live = document.createRange(); live.setStart(text, 1); live.setEnd(text, 5);
      for (const invalid of [document.doctype, document.createAttribute('name')]) {
        assert.throws(() => new StaticRange({ startContainer: invalid, startOffset: 0, endContainer: text, endOffset: 0 }), { name: 'InvalidNodeTypeError' });
        for (const toStart of [true, false]) {
          const clone = live.cloneRange(); clone.collapse(toStart);
          assert.equal(clone.startContainer, text); assert.equal(clone.endContainer, text);
          assert.equal(clone.startOffset, toStart ? 1 : 5); assert.equal(clone.endOffset, toStart ? 1 : 5);
        }
      }
      assert.equal(live.startOffset, 1); assert.equal(live.endOffset, 5);
      assert.equal(snapshot.startContainer, text); assert.equal(snapshot.endContainer, detached);
      assert.equal(snapshot.startOffset, 400); assert.equal(snapshot.endOffset, 900);
    } finally { dom.window.close(); }
  });
}
