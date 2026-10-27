/** @module benchmarks/constants/attribute-reads Public read workloads and reproducible fixture inputs. */
'use strict';
module.exports = {
  ATTRIBUTE_READ_WORKLOADS: ['attribute-get', 'attribute-get-miss', 'attribute-get-ns', 'attribute-get-ns-miss',
    'attribute-has', 'attribute-has-miss', 'attribute-has-ns', 'attribute-has-ns-miss', 'attribute-get-long',
    'attribute-get-utf16', 'attribute-reflection'],
  ATTRIBUTE_READ_DOCUMENT_HTML: '<!doctype html><body>',
  ATTRIBUTE_READ_ITERATIONS: 100,
  ATTRIBUTE_READ_NAMESPACE: 'urn:attribute-read',
  ATTRIBUTE_READ_NAME_PREFIX: 'entry-',
  ATTRIBUTE_READ_VALUE_PREFIX: 'value-',
  ATTRIBUTE_READ_MISSING_NAME: 'missing',
  ATTRIBUTE_READ_REFLECTED_VALUE: 'reflected-value',
  ATTRIBUTE_READ_LONG_VALUE_UNITS: 4096,
};
