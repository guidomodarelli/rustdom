/** @module benchmarks/constants/name-queries Exact document-name queries and their fixed public-read budget. */
'use strict';
const NAME_QUERY_CREATE = 'document-name-create';
const NAME_QUERY_LIVE = 'document-name-live';
const NAME_QUERY_CACHED = 'document-name-cached';
const NAME_QUERY_MISS = 'document-name-miss';
const NAME_QUERY_WORKLOADS = [NAME_QUERY_CREATE, NAME_QUERY_LIVE, NAME_QUERY_CACHED, NAME_QUERY_MISS];
const NAME_QUERY_ITERATIONS = 100;
const NAME_QUERY_DOCUMENT_HTML = '<!doctype html><body>';
const NAME_QUERY_SELECTED_VALUE = 'selected';
const NAME_QUERY_OTHER_VALUE = 'other';
const NAME_QUERY_MISSING_VALUE = 'missing-name';
const NAME_QUERY_ENTRY_ATTRIBUTE = 'data-name-entry';
const NAME_QUERY_VERSION_ATTRIBUTE = 'data-name-query-version';
module.exports = { NAME_QUERY_CREATE, NAME_QUERY_LIVE, NAME_QUERY_CACHED, NAME_QUERY_MISS, NAME_QUERY_WORKLOADS,
  NAME_QUERY_ITERATIONS, NAME_QUERY_DOCUMENT_HTML, NAME_QUERY_SELECTED_VALUE, NAME_QUERY_OTHER_VALUE, NAME_QUERY_MISSING_VALUE,
  NAME_QUERY_ENTRY_ATTRIBUTE, NAME_QUERY_VERSION_ATTRIBUTE };
