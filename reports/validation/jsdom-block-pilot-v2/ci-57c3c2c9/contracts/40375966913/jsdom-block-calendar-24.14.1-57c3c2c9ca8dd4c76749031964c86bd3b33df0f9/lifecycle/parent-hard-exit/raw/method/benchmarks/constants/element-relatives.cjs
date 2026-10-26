/** @module benchmarks/constants/element-relatives Public physical traversal workloads and their fixed read budget. */
'use strict';
const ELEMENT_RELATIVE_ITERATIONS = 100;
const ELEMENT_RELATIVE_WORKLOADS = ['element-children-refresh', 'element-children-cached',
  'element-first-child', 'element-last-child', 'element-next-sibling', 'element-previous-sibling'];
const ELEMENT_RELATIVE_PROPERTIES = {
  'element-first-child': 'firstElementChild', 'element-last-child': 'lastElementChild',
  'element-next-sibling': 'nextElementSibling', 'element-previous-sibling': 'previousElementSibling',
};
module.exports = { ELEMENT_RELATIVE_ITERATIONS, ELEMENT_RELATIVE_WORKLOADS, ELEMENT_RELATIVE_PROPERTIES };
