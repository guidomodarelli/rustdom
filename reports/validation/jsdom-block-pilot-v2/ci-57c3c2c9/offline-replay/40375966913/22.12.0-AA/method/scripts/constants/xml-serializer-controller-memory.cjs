/** @module scripts/constants/xml-serializer-controller-memory Defines finite owner-release scenarios for XMLSerializer control. */
'use strict';
const XML_SERIALIZER_MEMORY_SCENARIO = { success: 'success', nodeError: 'node-error', messageThrow: 'message-throw',
  messageReentrant: 'message-reentrant', dynamic: 'dynamic', heldSerializer: 'held-serializer' };
module.exports = {
  XML_SERIALIZER_MEMORY_SCENARIO,
  XML_SERIALIZER_MEMORY_SCENARIOS: Object.values(XML_SERIALIZER_MEMORY_SCENARIO),
  XML_SERIALIZER_MEMORY_REALMS: ['default', 'outside-only', 'dangerously'],
  XML_SERIALIZER_MEMORY_CYCLES: 3,
  XML_SERIALIZER_HELD_COLLECTION_ROUNDS: 4,
  XML_SERIALIZER_MEMORY_DOCUMENT: '<root/>',
  XML_SERIALIZER_WORKER_CYCLES: 8,
  XML_SERIALIZER_WORKER_TIMEOUT_MS: 30_000,
};
