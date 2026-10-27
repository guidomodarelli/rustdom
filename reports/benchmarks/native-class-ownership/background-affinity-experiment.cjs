/** @file Adds disjoint-mask verification to the unchanged complete study, estimator and resource contracts. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createSinglePackageStudy } = require('./single-package-experiment.cjs');
const { runStudyCli } = require('./paired-main-experiment.cjs');
const { validateBackgroundAffinity } = require('./background-affinity.cjs');
const settings = require('./constants/background-affinity.cjs');
const method = require('./constants/background-affinity-study.cjs');
const study = createSinglePackageStudy({ settings, method });
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/** @param {object} report - Actual worker report. @param {object} manifest - Pinned packages. @param {object} expected - Actual process identity. @returns {void} */
function validateWorker(report, manifest, expected) {
  study.validateWorker(report, manifest, expected);
  validateBackgroundAffinity(report);
}

/** @param {string} directory - Complete archive. @returns {object} Original decision after full affinity verification. */
function verify(directory) {
  const result = study.verify(directory);
  const index = readJson(path.join(directory, 'index.json'));
  for (const entry of index.runs) validateBackgroundAffinity(readJson(path.join(directory, entry.report)));
  return { ...result, backgroundAffinityVerified: true };
}

/** @param {string[]} directories - Both Node archives, in declared order. @returns {object} Unchanged combined acceptance after both affinity checks. */
function verifySet(directories) {
  const result = study.verifySet(directories);
  directories.forEach(verify);
  return { ...result, backgroundAffinityVerified: true };
}

/**
 * Run a fresh complete sequence once; invalidate its index if the additional affinity contract fails.
 * @param {string} preparation - Unmodified authenticated official preparation.
 * @param {string} directory - New output directory outside preparation.
 * @param {string} provenance - Published reviewed harness identity.
 * @returns {object} Full verified decision, without changing a rejected budget.
 */
function run(preparation, directory, provenance) {
  // The base driver may print its intermediate summary; only this return/CLI status is the final decision.
  study.run(preparation, directory, provenance);
  try { return verify(directory); } catch (error) {
    const filename = path.join(directory, 'index.json');
    const index = readJson(filename);
    index.complete = false;
    index.failure = { message: error.message, stack: error.stack };
    fs.writeFileSync(filename, `${JSON.stringify(index, null, 2)}\n`);
    throw error;
  }
}

const backgroundStudy = { ...study, validateWorker, run, verify, verifySet };
if (require.main === module) runStudyCli(backgroundStudy);
module.exports = backgroundStudy;
