/** @module benchmarks/constants/collection-queries Public query workloads and their fixed operation budget. */
'use strict';
const COLLECTION_QUERY_ITERATIONS = 100;
const MANY_CLASS_QUERY_TOKEN_COUNT = 16;
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const COLLECTION_NAMESPACE = 'urn:collection';
const COLLECTION_QUERY_WORKLOADS = ['collection-class-live', 'collection-tag-live',
  'collection-namespace-live', 'collection-class-create', 'collection-class-cached', 'collection-class-many-live'];
module.exports = { COLLECTION_QUERY_ITERATIONS, MANY_CLASS_QUERY_TOKEN_COUNT, COLLECTION_QUERY_WORKLOADS, HTML_NAMESPACE, COLLECTION_NAMESPACE };
