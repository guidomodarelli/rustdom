/** @module scripts/constants/native-class-memory Bounds real worker interruption checks for native class ownership. */
'use strict';
module.exports = {
  NATIVE_CLASS_INTERRUPTED_WORKER_CYCLES: 8,
  NATIVE_CLASS_WORKER_COPY_LIMIT: 1_000_000,
  NATIVE_CLASS_WORKER_TIMEOUT_MS: 30_000,
  NATIVE_CLASS_FAILED_CONSTRUCTION_ATTEMPTS: 8,
  NATIVE_CLASS_XML_PAYLOAD_UNITS: 4_096,
  NATIVE_CLASS_INITIALIZATION_ERROR_MESSAGE: 'Failed to initialize class `constructor`',
};
