/** @module combined-process-model Declares the unchanged full execution tuples with adjacent matched processes. */
'use strict';
const assert = require('node:assert/strict');
const { createSinglePackageStudy } = require('../single-package-experiment.cjs');
const { bindSettings } = require('./settings.cjs');
const identity = require('./constants/identity.json');
const policy = require('./constants/protocol.json');
const settings = bindSettings(require('../constants/current-ownership.cjs'), identity);
const original = createSinglePackageStudy({ settings,
  method: { sourceHashes: identity.sourceHashes, methodFiles: [], preparation: { identity } } });

/** @returns {object[]} Every original factor tuple, ordered as adjacent A/B pairs without selecting or adding observations. */
function plan() {
  const pairs = new Map();
  for (const input of original.processSchedule()) {
    const key = [input.phase, input.position, input.engine, input.rowIndex].join('/');
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(input);
  }
  const result = [...pairs.values()].flat();
  assert.equal(result.length, policy.processesPerNode);
  assert.equal(pairs.size, policy.processesPerNode / policy.labels.length);
  for (const pair of pairs.values()) assert.deepEqual(new Set(pair.map((input) => input.label)), new Set(policy.labels));
  return result;
}

module.exports = { settings, plan, validateWorker: original.validateWorker,
  validateSeedProbes: original.validateSeedProbes };
