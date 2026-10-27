/** @module range-study-settings Rebinds only revision and exact package fingerprints, preserving all experimental factors. */
'use strict';
const policy = require('./constants/protocol.json');
/** @param {object} original - Unchanged scheduler/sampler settings. @param {object} identity - Independent prepared package identity. @returns {object} New immutable declaration. */
function bindSettings(original, identity) {
  return { ...original, revision: policy.samplerRevision, distributionHashes: { ...identity.distributions } };
}
module.exports = { bindSettings };
