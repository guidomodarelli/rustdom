/** @file Complete public Selection operations including the native bridge and real Range/event effects. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Actual engine. @param {Window} window - Prepared realm. @param {number} size - Operation count. @param {string} name - Workload. @returns {object} Timed work and untimed correctness/cleanup. */
function selectionFixture(runtime, window, size, name) {
  const before = runtime.getNativeTreeStatistics?.().selectionOperations.calls;
  let paragraph = window.document.createElement('p'); paragraph.textContent = 'abcdef'; window.document.body.append(paragraph);
  let text = paragraph.firstChild; let selection = window.getSelection(); selection.setBaseAndExtent(text, 5, text, 1);
  let results = [];
  return {
    /** @returns {number} Consume every public result during timing. */
    run() {
      for (let index = 0; index < size; index++) {
        if (name === 'selection-read') results.push([selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset, selection.rangeCount, selection.type]);
        else if (name === 'selection-associate') {
          selection.setBaseAndExtent(text, 5, text, index % 2 === 0 ? 1 : 2); results.push(selection.getRangeAt(0));
        } else if (name === 'selection-extend') {
          selection.extend(text, index % 2 === 0 ? 1 : 6); results.push(selection.getRangeAt(0));
        } else if (name === 'selection-contains') results.push([selection.containsNode(text), selection.containsNode(text, true)]);
        else if (name === 'selection-stringify') results.push(String(selection));
        else throw new Error(`Unsupported Selection benchmark: ${name}`);
      }
      return results.length;
    },
    /** @param {number} count - Consumed results. @returns {void} Check all values and identities outside timing. */
    validate(count) {
      assert.equal(count, size);
      for (const [index, result] of results.entries()) {
        if (name === 'selection-read') assert.deepEqual(result, [text, 5, text, 1, 1, 'Range']);
        else if (name === 'selection-associate' || name === 'selection-extend') {
          assert.equal(result.startContainer, text); assert.equal(result.endContainer, text);
          const start = name === 'selection-associate' ? (index % 2 === 0 ? 1 : 2) : (index % 2 === 0 ? 1 : 5);
          const end = name === 'selection-associate' || index % 2 === 0 ? 5 : 6;
          assert.equal(result.startOffset, start); assert.equal(result.endOffset, end);
          if (index > 0) assert.notEqual(result, results[index - 1]);
        } else if (name === 'selection-contains') assert.deepEqual(result, [false, false]);
        else assert.equal(result, 'bcde');
      }
      if (before !== undefined) assert.ok(runtime.getNativeTreeStatistics().selectionOperations.calls > before);
    },
    /** @returns {Promise<void>} Drain real selectionchange tasks before releasing the realm. */
    async dispose() {
      selection.removeAllRanges(); results = null; selection = null; text = null; paragraph.remove(); paragraph = null;
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}
module.exports = { selectionFixture };
