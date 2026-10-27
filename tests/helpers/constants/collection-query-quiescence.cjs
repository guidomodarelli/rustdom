/** @file Bounds collection release observations while preserving the canonical ten-second deadline. */
'use strict';
module.exports = {
  // Collection/VM release can occur after the general endpoint's twelve rounds.
  // This remains a finite guard; the existing deadline and two clear samples still apply.
  RELEASE_MAX_ROUNDS: 64,
};
