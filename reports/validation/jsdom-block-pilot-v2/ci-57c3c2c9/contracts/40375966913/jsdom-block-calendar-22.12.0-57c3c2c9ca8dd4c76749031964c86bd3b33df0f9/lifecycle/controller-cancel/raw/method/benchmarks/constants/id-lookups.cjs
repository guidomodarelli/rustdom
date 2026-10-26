/** @module benchmarks/constants/id-lookups Public Document/SVG ID workloads and fixed inputs. */
'use strict';
const DOCUMENT_ID_READ = 'document-id-read';
const DOCUMENT_ID_MISS = 'document-id-miss';
const DOCUMENT_ID_REGISTER = 'document-id-register';
const DOCUMENT_ID_CHANGE = 'document-id-change';
const SVG_ID_SELF = 'svg-id-self';
const SVG_ID_LAST = 'svg-id-last';
const SVG_ID_EMPTY = 'svg-id-empty';
module.exports = {
  DOCUMENT_ID_READ, DOCUMENT_ID_MISS, DOCUMENT_ID_REGISTER, DOCUMENT_ID_CHANGE,
  SVG_ID_SELF, SVG_ID_LAST, SVG_ID_EMPTY,
  ID_LOOKUP_WORKLOADS: [DOCUMENT_ID_READ, DOCUMENT_ID_MISS, DOCUMENT_ID_REGISTER,
    DOCUMENT_ID_CHANGE, SVG_ID_SELF, SVG_ID_LAST, SVG_ID_EMPTY],
  ID_LOOKUP_ITERATIONS: 100,
  ID_LOOKUP_DOCUMENT_HTML: '<!doctype html><body>',
  ID_LOOKUP_VALUE_PREFIX: 'id-entry-',
  ID_LOOKUP_CHANGED_VALUES: ['id-changed-first', 'id-changed-second'],
  ID_LOOKUP_ROOT_VALUE: 'id-root',
  ID_LOOKUP_MISSING_VALUE: 'id-missing',
  ID_LOOKUP_ENTRY_ATTRIBUTE: 'data-id-entry',
  SVG_NAMESPACE: 'http://www.w3.org/2000/svg',
};
