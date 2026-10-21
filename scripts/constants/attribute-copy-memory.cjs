/** @module scripts/constants/attribute-copy-memory Repeated ownership checks for immutable native snapshots. */
'use strict';
module.exports = {
  ATTRIBUTE_COPY_NAMESPACE: 'urn:attribute-copy-memory',
  ATTRIBUTE_COPY_VALUE: 'copied\0\ud800\udfff🦀',
  ATTRIBUTE_COPY_STANDALONE_VALUE: 'standalone\0\udfff',
  ATTRIBUTE_COPY_LARGE_VALUE_UNITS: 64 * 1024,
  ATTRIBUTE_COPY_WORKER_SNAPSHOTS: 8,
  ATTRIBUTE_COPY_INTERRUPTED_VALUE_UNITS: 4 * 1024 * 1024,
  ATTRIBUTE_COPY_INTERRUPTED_WORKER_CYCLES: 8,
};
