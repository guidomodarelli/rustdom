/** @file Applies a bounded collection-specific observation policy without changing benchmark cleanup. */
'use strict';
const { waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const { RELEASE_MAX_ROUNDS } = require('./constants/collection-query-quiescence.cjs');

/**
 * Require complete release and two clear observations using the canonical deadline and liveness fields.
 * @param {object} options - Label, scalar sampler and optional native baseline for the real collection owner.
 * @returns {Promise<object>} Complete successful or failed trace, capped by both time and collector rounds.
 */
function waitForCollectionQuiescence(options) {
  return waitForMemoryQuiescence({ ...options, maxRounds: RELEASE_MAX_ROUNDS });
}

module.exports = { waitForCollectionQuiescence };
