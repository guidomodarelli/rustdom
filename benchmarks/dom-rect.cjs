/** @file Complete public rectangle operations, including native crossings, with validation outside timing. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Real engine. @param {Window} window - Actual realm. @param {number} size - Rectangle count. @param {string} name - Workload. @returns {object} Timed operation and independent correctness checks. */
function rectFixture(runtime, window, size, name) {
  const before = runtime.getNativeTreeStatistics?.().rectangles;
  let rectangles = name === 'rect-create' ? [] : Array.from({ length: size }, (_, index) => new window.DOMRect(index, 2, -3, 4));
  let snapshots;
  return {
    /** @returns {number} Consume actual edge values or snapshot fields. */
    run() {
      if (name === 'rect-create') { for (let index = 0; index < size; index++) rectangles.push(new window.DOMRect(index, 2, -3, 4)); return rectangles.length; }
      let total = 0;
      if (name === 'rect-json') { snapshots = rectangles.map((rect) => rect.toJSON()); for (const snapshot of snapshots) total += snapshot.left; return total; }
      for (const rect of rectangles) {
        if (name === 'rect-update') { rect.x += 1; rect.width = 5; }
        total += rect.left + rect.top + rect.right + rect.bottom;
      }
      return total;
    },
    /** @param {number} result - Timed checksum. @returns {void} Check every rectangle and every serialized field outside timing. */
    validate(result) {
      let expected = 0;
      for (let index = 0; index < size; index++) {
        const updated = name === 'rect-update'; const x = index + Number(updated); const width = updated ? 5 : -3;
        const values = { x, y: 2, width, height: 4, top: 2, right: Math.max(x, x + width), bottom: 6, left: Math.min(x, x + width) };
        for (const [key, value] of Object.entries(values)) assert.equal(rectangles[index][key], value);
        if (snapshots) { assert.deepEqual(snapshots[index], values); assert.deepEqual(Object.keys(snapshots[index]), Object.keys(values)); }
        expected += name === 'rect-create' ? 1 : name === 'rect-json' ? values.left : values.left + values.top + values.right + values.bottom;
      }
      assert.equal(result, expected);
      if (before) assert.equal(runtime.getNativeTreeStatistics().rectangles.created - before.created, size);
    },
  };
}
module.exports = { rectFixture };
