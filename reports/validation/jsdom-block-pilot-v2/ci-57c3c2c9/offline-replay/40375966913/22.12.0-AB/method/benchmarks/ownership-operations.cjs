/** @file Public Range operations shared by measured batches and same-realm warmup. */
'use strict';

/**
 * Clone, collapse and compare using the actual realm's public methods.
 * @param {Range} range - Prepared live range, unchanged by this operation.
 * @param {number} comparisonMode - Public START_TO_START constant.
 * @param {number} iterations - Number of complete operations.
 * @returns {number} Consumed comparison checksum.
 */
function control(range, comparisonMode, iterations) {
  let result = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const copy = range.cloneRange(); copy.collapse(iteration % 2 === 0);
    result += copy.compareBoundaryPoints(comparisonMode, range);
  }
  return result;
}

/**
 * Exercise complete Range/StaticRange lifetimes without mutating the input text.
 * @param {Window} window - Actual runtime window; constructor lookup stays inside each iteration.
 * @param {Document} document - Actual document owning all input nodes.
 * @param {Text[]} texts - Prepared nonempty text nodes.
 * @param {number} iterations - Number of complete operations.
 * @returns {number} Consumed boundary checksum.
 */
function lifecycle(window, document, texts, iterations) {
  let result = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const text = texts[iteration % texts.length];
    const range = document.createRange(); range.selectNodeContents(text);
    const clone = range.cloneRange();
    const frozen = new window.StaticRange({ startContainer: text, startOffset: 0,
      endContainer: text, endOffset: text.length });
    clone.setStart(text, 1);
    result += range.endOffset + clone.endOffset + frozen.endOffset +
      Number(range.startOffset === 0 && clone.startOffset === 1 && frozen.startOffset === 0);
  }
  return result;
}

module.exports = { control, lifecycle };
