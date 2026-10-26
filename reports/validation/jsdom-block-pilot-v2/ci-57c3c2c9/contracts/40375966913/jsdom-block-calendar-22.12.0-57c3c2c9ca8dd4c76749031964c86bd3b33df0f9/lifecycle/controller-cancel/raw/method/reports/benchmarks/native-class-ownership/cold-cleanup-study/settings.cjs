/** @module cold-study-settings Rebinds only declared identity and package fingerprints. */
'use strict';
const policy = require('./constants/protocol.json');

/**
 * Keeps every historical experimental factor unchanged.
 * @param {object} original - Published sampler settings.
 * @param {object} identity - Independently authenticated cold preparation identity.
 * @returns {object} New declaration without mutating either input.
 */
function bindSettings(original, identity) {
  return { ...original, revision: policy.samplerRevision, distributionHashes: { ...identity.distributions } };
}
module.exports = { bindSettings };
