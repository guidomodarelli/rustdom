/** @module benchmarks/constants/node-clone Public clone workloads, fixture inputs and pre-optimization budgets. */
'use strict';
module.exports = {
  NODE_CLONE_WORKLOADS: ['clone-shallow-attributes', 'clone-deep-children', 'clone-deep-chain',
    'clone-template-content', 'import-deep-children', 'import-template-content', 'clone-shallow-template'],
  NESTED_TEMPLATE_CLONE_WORKLOAD: 'clone-nested-templates',
  NODE_CLONE_DOCUMENT_HTML: '<!doctype html><body>',
  NODE_CLONE_VALUE: 'value\0\ud800\udfff',
  NODE_CLONE_NAMESPACE: 'urn:clone-benchmark',
  MAX_CLONE_MEDIAN_REGRESSION_PERCENT: 5,
  MAX_CONTROL_MEDIAN_REGRESSION_PERCENT: 5,
};
