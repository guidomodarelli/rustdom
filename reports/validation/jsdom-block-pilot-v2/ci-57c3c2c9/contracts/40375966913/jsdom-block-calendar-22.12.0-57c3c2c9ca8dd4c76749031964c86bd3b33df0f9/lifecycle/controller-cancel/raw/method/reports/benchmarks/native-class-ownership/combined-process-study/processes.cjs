/** @module combined-capture-processes Reads portable observations while preserving original commands and package locations; never executes archived workers or accepts performance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const model = require('./model.cjs');
const results = require('./results.cjs');
const manifests = require('./manifest.cjs');
const policy = require('./constants/protocol.json');
const runtimeHashes = require('../constants/current-ownership.json').runtimeExecutableHashes;

/** @param {string} filename - Data member in the caller's evidence tree. @returns {Buffer} Bounded, independent regular file bytes, never executable content. */
function bytes(filename) {
  const status = fs.lstatSync(filename);
  assert.ok(status.isFile() && status.nlink === 1, 'Combined replay: an independent regular data file is required');
  assert.ok(status.size <= policy.metadataOutputLimitBytes, 'Combined replay: data member exceeds the declared reader bound');
  return fs.readFileSync(filename);
}
const read = (filename) => JSON.parse(bytes(filename));
const hash = (filename) => createHash('sha256').update(bytes(filename)).digest('hex');

/** @param {object[]} runtimes - Original measured SDK declarations, not paths to execute during replay. @returns {void} Require official versions and independent binary identities. */
function verifyRuntimes(runtimes) {
  assert.deepEqual(runtimes.map((runtime) => runtime.node), policy.nodes);
  for (const runtime of runtimes) {
    assert.ok(path.posix.isAbsolute(runtime.executable)); assert.equal(path.posix.normalize(runtime.executable), runtime.executable);
    assert.equal(runtime.sha256, runtimeHashes[runtime.node]);
  }
}

/** @param {object} entry - Recorded process. @param {object} runtime - Authenticated original SDK. @param {object} input - Fixed scheduled tuple. @param {string} originalRoot - Original capture root, never the current extraction path. @param {string} originalDerived - Original derived worker directory. @param {boolean} functionalOnly - Explicit functional versus prospective capture purpose. @returns {void} Verify the complete original command without changing it. */
function verifyInvocation(entry, runtime, input, originalRoot, originalDerived, functionalOnly) {
  const sampler = createSinglePackageWorker(model.settings);
  assert.deepEqual(entry.argv, [runtime.executable, ...sampler.workerArguments(input.position),
    path.posix.join(originalDerived, 'worker.cjs'), ...(functionalOnly ? [policy.operations.functional] : []),
    path.posix.join(originalRoot, 'manifest.json'), input.phase, input.engine, String(input.position), input.label,
    path.posix.join(entry.directory, 'report.json'), String(input.rowIndex)]);
}

/**
 * Read every declared row without requiring the original capture paths to exist.
 * This helper never grants capture authentication or performance acceptance;
 * its caller must additionally authenticate method, package, derivation and transport.
 * @param {string} directory - Physical current extraction directory.
 * @param {object} index - Unmodified recorded process/index fields.
 * @param {object} manifest - Full independently verified package manifest.
 * @param {object} options - Explicit plan, original roots and purpose, supplied by the current verifier.
 * @returns {object} Compact estimator observations plus exact measured/warmup/owner counts, never a decision.
 */
function scan(directory, index, manifest, options) {
  const { inputs, originalRoot, originalDerived, functionalOnly } = options;
  assert.equal(typeof functionalOnly, 'boolean');
  manifests.verify(manifest, index.preparedDirectory); assert.deepEqual(index.manifest, manifest);
  for (const name of [originalRoot, originalDerived]) { assert.ok(path.posix.isAbsolute(name)); assert.equal(path.posix.normalize(name), name); }
  verifyRuntimes(index.runtimes);
  assert.equal(index.processes.length, inputs.length * policy.nodes.length);
  const root = fs.realpathSync.native(directory); const entriesByNode = [];
  let measuredDurations = 0; let warmupDurations = 0; let windows = 0; let documents = 0;
  for (const [runtimeIndex, runtime] of index.runtimes.entries()) {
    const entries = []; entriesByNode.push({ node: runtime.node, entries });
    for (const [ordinal, input] of inputs.entries()) {
      const entry = index.processes[runtimeIndex * inputs.length + ordinal];
      assert.deepEqual(entry.input, input); assert.equal(entry.node, runtime.node);
      assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
      const relative = path.posix.join(runtimeIndex === 0 ? 'node22' : 'node24', String(ordinal).padStart(4, '0'));
      const target = path.join(root, relative);
      for (const current of [path.dirname(target), target]) assert.equal(fs.lstatSync(current).isSymbolicLink(), false);
      assert.equal(entry.directory, path.posix.join(originalRoot, relative));
      verifyInvocation(entry, runtime, input, originalRoot, originalDerived, functionalOnly);
      const names = ['report.json', 'report.json' + policy.sidecarSuffix, 'stderr.log', 'stdout.log'].sort();
      assert.deepEqual(Object.keys(entry.files).sort(), names); assert.deepEqual(fs.readdirSync(target).sort(), names);
      for (const [name, expected] of Object.entries(entry.files)) assert.equal(hash(path.join(target, name)), expected);
      const report = read(path.join(target, 'report.json'));
      results.validateReport(report, manifest, input, entry, read(path.join(target, 'report.json' + policy.sidecarSuffix)),
        index.derivationSha256, index.sourceCommit, functionalOnly);
      const batch = report.batches[0]; measuredDurations += batch.samplesMs.length;
      warmupDurations += batch.sampleTimings.filter((span) => span.stage === 'warmup').length;
      windows += batch.trackedOwners.window; documents += batch.trackedOwners.document;
      entries.push({ ...input, observation: results.estimatorView(report) });
    }
    model.validateSeedProbes(entries);
  }
  return { entriesByNode, measuredDurations, warmupDurations, windows, documents,
    captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false };
}
module.exports = { bytes, read, hash, verifyRuntimes, verifyInvocation, scan };
