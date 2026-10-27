/** @file Exercises public constructors, receiver validation and detach against both real DOM engines. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const runtime = require(process.env.RUSTDOM_RANGE_INVENTORY_RUNTIME);
const reference = require(process.env.RUSTDOM_RANGE_INVENTORY_REFERENCE);

/** @param {object} engine - Actual independent DOM package. @returns {object} Public observations. */
function observe(engine) {
  const dom = new engine.JSDOM('<main>abcdef</main>', { runScripts: 'outside-only' });
  try {
    const { window } = dom;
    const text = window.document.querySelector('main').firstChild;
    assert.throws(() => new window.AbstractRange(), window.TypeError);
    assert.throws(() => window.Range.prototype.detach.call({}), window.TypeError);
    const live = new window.Range();
    live.setStart(text, 1); live.setEnd(text, 4);
    assert.equal(live.detach(), undefined);
    assert.equal(live.toString(), 'bcd');
    text.insertData(0, '!');
    assert.equal(live.startOffset, 2); assert.equal(live.endOffset, 5);
    assert.equal(live.startContainer, text); assert.equal(live.endContainer, text);
    const frozen = new window.StaticRange({ startContainer: text, startOffset: 2,
      endContainer: text, endOffset: 5 });
    text.insertData(0, '?');
    assert.equal(frozen.startContainer, text); assert.equal(frozen.endContainer, text);
    assert.equal(frozen.startOffset, 2); assert.equal(live.startOffset, 3);
    const attribute = window.document.createAttribute('example');
    assert.throws(() => new window.StaticRange({ startContainer: attribute, startOffset: 0,
      endContainer: text, endOffset: 0 }), (error) =>
      error instanceof window.DOMException && error.name === 'InvalidNodeTypeError');
    const offsetGetter = Object.getOwnPropertyDescriptor(window.AbstractRange.prototype, 'startOffset').get;
    assert.throws(() => offsetGetter.call({}), window.TypeError);
    return { liveText: live.toString(), liveOffsets: [live.startOffset, live.endOffset],
      staticOffsets: [frozen.startOffset, frozen.endOffset], collapsed: frozen.collapsed,
      inherited: frozen instanceof window.AbstractRange && live instanceof window.AbstractRange };
  } finally { dom.window.close(); }
}

test('should preserve constructor errors, identity, inherited getters and live behavior after detach', () => {
  assert.deepEqual(observe(runtime), observe(reference));
});
