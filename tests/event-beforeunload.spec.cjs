/** @file Preserves the pinned BeforeUnloadEvent string setter and legacy handler cancellation behavior. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve BeforeUnloadEvent returnValue string assignments and forced handler cancellation in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>');
    try {
      const event = dom.window.document.createEvent('BeforeUnloadEvent'); event.initEvent('beforeunload', false, true);
      assert.equal(event.returnValue, true);
      event.returnValue = 'leave'; assert.equal(event.returnValue, true); assert.equal(event.defaultPrevented, false);
      event.returnValue = false; assert.equal(event.returnValue, true); assert.equal(event.defaultPrevented, false);
      event.preventDefault(); event.returnValue = ''; assert.equal(event.returnValue, false); assert.equal(event.defaultPrevented, true);
      event.initEvent('beforeunload', false, false); dom.window.onbeforeunload = () => '';
      assert.equal(dom.window.dispatchEvent(event), false); assert.equal(event.defaultPrevented, true);
    } finally { dom.window.close(); }
  });
}
