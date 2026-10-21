/** @module benchmarks/input-html Shared unchanged table input for public benchmark controls. */
'use strict';
/** @param {number} size - Number of data rows. @returns {string} Canonical historical input. */
function tableHtml(size) {
  return '<!doctype html><html><head><title>Benchmark</title></head><body><table>' +
    Array.from({ length: size }, (_, index) =>
      `<tr class="row" data-index="${index}"><td><a href="/row/${index}">Row ${index} &amp; value</a></td><td>${index}</td></tr>`).join('') +
    '</table></body></html>';
}
module.exports = { tableHtml };
