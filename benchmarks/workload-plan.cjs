/** @file Canonical benchmark workload plan shared by execution and partition coverage checks. */
'use strict';
const { COLLECTION_QUERY_WORKLOADS } = require('./constants/collection-queries.cjs');
const { COLLECTION_MEMBER_WORKLOADS } = require('./constants/collection-members.cjs');
const { ELEMENT_RELATIVE_WORKLOADS } = require('./constants/element-relatives.cjs');
const { NAME_QUERY_WORKLOADS } = require('./constants/name-queries.cjs');
const { FRAGMENT_ID_WORKLOADS } = require('./constants/fragment-id.cjs');
const { ID_LOOKUP_WORKLOADS } = require('./constants/id-lookups.cjs');
const { ATTRIBUTE_READ_WORKLOADS } = require('./constants/attribute-reads.cjs');
const { XML_SERIALIZER_GETTER_ERROR_WORKLOAD, XML_SERIALIZER_SMALL_SIZES,
  XML_SERIALIZER_ERROR_SIZES } = require('./constants/xml-serializer-controller.cjs');
/** Explicit repeated-reference workloads remain opt-in. */
const RANGE_STRINGIFICATION_READS = { 'range-stringify-1': 1, 'range-stringify-10': 10 };
/** Public Range content operations and their fixture keys. */
const RANGE_CONTENT_OPERATIONS = { 'range-delete-contents': 'deleteContents',
  'range-clone-contents': 'cloneContents', 'range-extract-contents': 'extractContents' };
/** Public document-creation operations and their fixture modes. */
const DOCUMENT_CREATION_OPERATIONS = { 'document-create-html': 'html', 'document-create-xml': 'xml',
  'document-create-doctype': 'doctype', 'document-reject-qname': 'invalid-qname' };
/** @returns {object[]} Complete workload plan; selection does not change the measurement fixtures. */
function getBenchmarkPlan() {
  return [
    ...[25, 250, 1000].flatMap((size) => ['construct-native-eligible', 'innerHTML'].map((name) => ({ name, size }))),
    ...['construct-script-compatible', 'selectors-100', 'mutations-100', 'character-data-100', 'attribute-data-100',
      'attribute-collections-100', 'node-equality-100', 'node-position-1000', 'namespace-lookup-1000'].map((name) => ({ name, size: 250 })),
    ...['environment-setup', 'environment-vm-setup'].map((name) => ({ name, size: 25 })),
    { name: 'node-position-1000', size: 1000 },
    ...[250, 1000].flatMap((size) => ['node-roots-shallow-1000', 'node-roots-deep-1000'].map((name) => ({ name, size }))),
    ...[25, 100].map((size) => ({ name: 'shadow-roots-1000', size })),
    { name: 'shadow-hosts-create-100', size: 25 },
    ...[10, 30].map((size) => ({ name: 'shadow-retarget-events-100', size })),
    ...[25, 100].flatMap((size) => ['slot-lookup-1000', 'slot-reassign-100'].map((name) => ({ name, size }))),
    ...[25, 100].flatMap((size) => ['slot-cached-100', 'slot-assigned-100', 'slot-dense-reassign-100', 'slot-events-100'].map((name) => ({ name, size }))),
    ...[10, 100].map((size) => ({ name: 'slot-flatten-chain-100', size })),
    ...[100, 1000].map((size) => ({ name: 'slot-signal-burst', size })),
    ...[100, 1000].flatMap((size) => ['mutation-records-collect', 'mutation-records-read'].map((name) => ({ name, size }))),
    ...[100, 1000].map((size) => ({ name: 'mutation-observer-ancestors', size })),
    ...[100, 1000].map((size) => ({ name: 'mutation-producer-fanout', size })),
    ...[100, 1000].flatMap((size) => ['observer-delivery-records', 'observer-delivery-empty', 'observer-delivery-slots'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['event-state-lifecycle', 'event-dispatch'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['listener-register', 'listener-remove', 'listener-dispatch'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['abort-lifecycle', 'abort-any', 'abort-propagation'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['xml-construct', 'xml-fragment', 'xml-parse-error', 'xml-doctype'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['xml-serialize', 'xml-inner-serialize', 'xml-document-serialize', 'xml-serialize-error'].map((name) => ({ name, size }))),
    ...XML_SERIALIZER_SMALL_SIZES.map((size) => ({ name: 'xml-serialize', size })),
    ...XML_SERIALIZER_ERROR_SIZES.map((size) => ({ name: XML_SERIALIZER_GETTER_ERROR_WORKLOAD, size })),
    ...[100, 1000].flatMap((size) => ['iterator-scan', 'iterator-filter', 'walker-scan', 'walker-filter'].map((name) => ({ name, size }))),
    ...[4, 1000].flatMap((size) => ['token-parse', 'token-contains', 'token-add', 'token-replace'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['rect-create', 'rect-read', 'rect-update', 'rect-json'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['blob-construct', 'blob-endings', 'blob-nested', 'blob-slice', 'file-construct'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['reader-text-utf8', 'reader-text-legacy', 'reader-binary', 'reader-data-url', 'reader-buffer', 'reader-abort'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['form-data-append', 'form-data-get', 'form-data-get-all', 'form-data-set', 'form-data-delete', 'form-data-iterate', 'form-data-files', 'form-data-construct'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => Object.keys(DOCUMENT_CREATION_OPERATIONS).map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => COLLECTION_QUERY_WORKLOADS.map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => COLLECTION_MEMBER_WORKLOADS.map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ELEMENT_RELATIVE_WORKLOADS.map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => NAME_QUERY_WORKLOADS.map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => FRAGMENT_ID_WORKLOADS.map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ID_LOOKUP_WORKLOADS.map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ATTRIBUTE_READ_WORKLOADS.map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['selection-read', 'selection-associate', 'selection-extend', 'selection-contains', 'selection-stringify'].map((name) => ({ name, size }))),
    ...[100, 1000].flatMap((size) => ['storage-insert', 'storage-write', 'storage-get', 'storage-key', 'storage-enumerate', 'storage-remove', 'storage-clear', 'storage-quota'].map((name) => ({ name, size }))),
    ...[4, 1000].flatMap((size) => ['dataset-read', 'dataset-enumerate', 'dataset-write', 'dataset-delete'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['node-value-writes-1000', 'node-text-writes-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['document-comments-insert-100', 'document-duplicate-element-100'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['document-comments-replace-100', 'document-root-replace-100'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'text-content-100', size })),
    ...[250, 1000].flatMap((size) => ['normalize-split-text', 'normalize-isolated-text'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['range-compare-1000', 'range-point-1000', 'range-text-point-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-boundaries-100', size })),
    ...[250, 1000].flatMap((size) => ['range-state-read-1000', 'range-state-lifecycle-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-control-1000', size })),
    ...[250, 1000].map((size) => ({ name: 'range-insert-node-100', size })),
    ...[250, 1000].map((size) => ({ name: 'range-context-fragment', size })),
    ...[250, 1000].flatMap((size) => ['range-character-mutations-100', 'range-tree-mutations-100'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => Object.keys(RANGE_CONTENT_OPERATIONS).map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-surround-contents', size })),
    ...[250, 1000].flatMap((size) => Object.keys(RANGE_STRINGIFICATION_READS).map((name) =>
      ({ name, size, manualOnly: RANGE_STRINGIFICATION_READS[name] > 1 }))),
    ...[250, 1000].map((size) => ({ name: 'serialize-utf8', size })),
  ];
}
module.exports = { getBenchmarkPlan, RANGE_STRINGIFICATION_READS, RANGE_CONTENT_OPERATIONS, DOCUMENT_CREATION_OPERATIONS };
