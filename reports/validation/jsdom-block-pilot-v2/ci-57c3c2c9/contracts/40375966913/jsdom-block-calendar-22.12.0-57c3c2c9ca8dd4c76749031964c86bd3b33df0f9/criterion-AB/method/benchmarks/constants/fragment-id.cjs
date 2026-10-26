/** @module fragment-id Canonical public ID-lookup benchmark workloads and inputs. */
'use strict';
const FRAGMENT_ID_FIRST = 'fragment-id-first';
const FRAGMENT_ID_LAST = 'fragment-id-last';
const FRAGMENT_ID_MISS = 'fragment-id-miss';
const SHADOW_ID_LAST = 'shadow-id-last';
module.exports = {
  FRAGMENT_ID_FIRST, FRAGMENT_ID_LAST, FRAGMENT_ID_MISS, SHADOW_ID_LAST,
  FRAGMENT_ID_WORKLOADS: [FRAGMENT_ID_FIRST, FRAGMENT_ID_LAST, FRAGMENT_ID_MISS, SHADOW_ID_LAST],
  FRAGMENT_ID_ITERATIONS: 100,
  FRAGMENT_ID_SELECTED_VALUE: 'selected',
  FRAGMENT_ID_MISSING_VALUE: 'missing',
  FRAGMENT_ID_OTHER_PREFIX: 'other-',
  FRAGMENT_ID_ENTRY_ATTRIBUTE: 'data-fragment-entry',
  FRAGMENT_ID_DOCUMENT_HTML: '<!doctype html><body>',
};
