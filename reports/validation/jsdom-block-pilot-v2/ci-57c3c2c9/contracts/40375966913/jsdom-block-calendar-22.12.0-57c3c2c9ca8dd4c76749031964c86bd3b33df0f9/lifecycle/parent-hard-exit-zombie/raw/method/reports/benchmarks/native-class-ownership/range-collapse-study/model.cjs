/** @module range-study-model Uses the unchanged scheduler, behavior validator and pooled-median estimator. */
'use strict';
const assert = require('node:assert/strict');
const { createSinglePackageStudy } = require('../single-package-experiment.cjs');
const original = require('../constants/current-ownership.cjs');
const identity = require('./constants/identity.json');
const { bindSettings } = require('./settings.cjs');
const settings = bindSettings(original, identity);
const model = createSinglePackageStudy({ settings,
  method: { sourceHashes: identity.inputs.sources, methodFiles: [], preparation: { identity } } });

/** @param {object} input - Original factor tuple. @returns {string} Unambiguous physical row/label key. */
function key(input) { return [input.phase, input.position, input.engine, input.rowIndex, input.label].join('/'); }

/** @returns {object[]} Same factor tuples and row order, placing both original labels immediately together. */
function plan() {
  const pairs = new Map();
  for (const input of model.processSchedule()) {
    const pair = [input.phase, input.position, input.engine, input.rowIndex].join('/');
    if (!pairs.has(pair)) pairs.set(pair, []);
    pairs.get(pair).push(input);
  }
  return [...pairs.values()].flat();
}

/**
 * Present every immutable observation in the old estimator's required input order.
 * This changes neither the stored execution order nor any timing, weight or sample.
 * @param {object[]} entries - Complete original observations for one phase, in any declared execution layout.
 * @param {string} phase - Original phase.
 * @returns {object[]} Original numerical summaries, without mutating observations.
 */
function summarize(entries, phase) {
  const expected = model.processSchedule().filter((input) => input.phase === phase);
  const indexed = new Map(entries.map((entry) => [key(entry), entry]));
  assert.equal(indexed.size, entries.length); assert.equal(entries.length, expected.length);
  const canonical = expected.map((input) => {
    const entry = indexed.get(key(input)); assert.ok(entry, 'Range study: incomplete original factor tuple');
    for (const [name, value] of Object.entries(input)) assert.equal(entry[name], value);
    return entry;
  });
  return model.summarize(canonical, phase);
}
module.exports = { settings, plan, validateWorker: model.validateWorker, validateSeedProbes: model.validateSeedProbes, summarize };
