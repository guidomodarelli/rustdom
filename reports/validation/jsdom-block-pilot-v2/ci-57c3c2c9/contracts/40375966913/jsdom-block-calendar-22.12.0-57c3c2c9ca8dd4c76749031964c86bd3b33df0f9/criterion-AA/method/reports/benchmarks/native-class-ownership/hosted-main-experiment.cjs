/** @file Preserves the full study algorithm and binds its evidence to one authenticated hosted preparation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPairedStudy, runStudyCli } = require('./paired-main-experiment.cjs');
const preparation = require('./prepare-hosted-build.cjs');
const settings = require('./constants/hosted-main.cjs');
const method = require('./constants/hosted-main-study.cjs');
const study = createPairedStudy({ settings, method, sourceHashes: method.sourceHashes,
  workerFilename: method.workerFilename });
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/**
 * Authenticate every packaged source, dependency and distribution before or after timing.
 * @param {string} directory - Extracted, unmodified official preparation.
 * @returns {object} Recalculated identity matching the published receipt.
 */
function inspectPreparation(directory) {
  const identity = preparation.verify(directory);
  assert.deepEqual(identity, method.preparation.identity, 'Hosted main: preparation differs from the official pinned artifact');
  return identity;
}

/**
 * Bind separate physical packages and the complete archived sources to the existing driver.
 * @param {string} directory - Actual preparation directory.
 * @returns {object} Runtime manifest; no package is loaded and no time is measured.
 */
function createManifest(directory) {
  const root = fs.realpathSync(directory);
  const identity = inspectPreparation(root);
  const index = readJson(path.join(root, 'index.json'));
  return {
    roots: { A: path.join(root, 'baseline-sources'), B: path.join(root, 'sources') },
    copies: Object.fromEntries(Object.keys(settings.distributionHashes).map((label) => [label, path.join(root, 'packages', label)])),
    distributions: index.distributions,
    referenceVersion: '27.4.0',
    preparation: method.preparation,
    preparationBefore: identity,
  };
}

/**
 * Require the pinned preparation checks in addition to all original sampler evidence.
 * @param {string} directory - Complete archived Node study.
 * @returns {object} Original budget decision and the official preparation identity.
 */
function verify(directory) {
  const result = study.verify(directory);
  const index = readJson(path.join(directory, 'index.json'));
  assert.deepEqual(index.manifest.preparation, method.preparation);
  assert.deepEqual(index.manifest.preparationBefore, method.preparation.identity);
  assert.deepEqual(index.preparationAfter, index.manifest.preparationBefore);
  return { ...result, preparationId: index.preparationAfter.preparationId, artifactId: method.preparation.artifactId };
}

/**
 * Run once against complete prebuilt packages; preserve partial output and never rebuild or retry.
 * @param {string} directory - Extracted official preparation.
 * @param {string} outputArgument - New Node evidence directory.
 * @param {string} provenance - Published reviewed harness provenance.
 * @returns {object} Verified result; failed calibration still yields accepted=false.
 */
function run(directory, outputArgument, provenance) {
  const requestedOutput = path.resolve(outputArgument);
  const output = path.join(fs.realpathSync(path.dirname(requestedOutput)), path.basename(requestedOutput));
  const manifestPath = `${output}.manifest.json`;
  assert.equal(fs.existsSync(output), false, 'Hosted main: preserve existing study output');
  assert.equal(fs.existsSync(manifestPath), false, 'Hosted main: preserve existing runtime manifest');
  const manifest = createManifest(directory);
  const preparedRoot = fs.realpathSync(directory);
  assert.ok(!output.startsWith(`${preparedRoot}${path.sep}`) && output !== preparedRoot,
    'Hosted main: evidence must not modify the official preparation');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  const indexPath = path.join(output, 'index.json');
  try {
    study.run(manifestPath, output, provenance);
    const index = readJson(indexPath);
    index.preparationAfter = inspectPreparation(preparedRoot);
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    return verify(output);
  } catch (error) {
    if (fs.existsSync(indexPath)) {
      const index = readJson(indexPath);
      index.complete = false;
      index.failure = { message: error.message, stack: error.stack };
      fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    }
    throw error;
  }
}

/** @param {string[]} directories - Both Node archives in the declared order. @returns {object} Combined original decision. */
function verifySet(directories) {
  const result = study.verifySet(directories);
  directories.forEach(verify);
  return { ...result, preparationId: method.preparation.identity.preparationId, artifactId: method.preparation.artifactId };
}

const hostedStudy = { ...study, inspectPreparation, createManifest, run, verify, verifySet };
if (require.main === module) runStudyCli(hostedStudy);
module.exports = hostedStudy;
