/** @module combined-worker-qualification Exercises every public row of the new namespace as explicitly functional evidence, never as a performance study. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execute } = require('../jsdom-telemetry/run.cjs');
const { runtimeIdentities } = require('../shared-fixture-study/study.cjs');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const preparation = require('./preparation.cjs');
const source = require('./source.cjs');
const model = require('./model.cjs');
const results = require('./results.cjs');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/** @param {object} entry - Recorded real process. @param {object} runtime - Authenticated SDK. @param {object} input - Fixed tuple. @param {string} derived - Verified derivation directory. @param {string} root - Evidence directory. @returns {void} Require the exact executable, worker, flags and output paths. */
function validateInvocation(entry, runtime, input, derived, root) {
  const sampler = createSinglePackageWorker(model.settings);
  assert.deepEqual(entry.argv, [runtime.executable, ...sampler.workerArguments(input.position),
    path.join(derived, 'worker.cjs'), policy.operations.functional, path.join(root, 'manifest.json'),
    input.phase, input.engine, String(input.position), input.label, path.join(entry.directory, 'report.json'), String(input.rowIndex)]);
}

/** @returns {object[]} Fixed AB/position0 coverage of every row, both real engines and both physical labels. */
function plan() {
  const selected = model.plan().filter((input) => input.phase === policy.functionalQualification.phase && input.position === policy.functionalQualification.position);
  assert.equal(selected.length * policy.nodes.length, policy.functionalQualification.processes);
  return selected;
}

/** @returns {object} Current control-source digests; none are read from the evidence directory. */
function sourceFiles() {
  const files = {};
  /** @param {string} directory - Current method source directory. @returns {void} Record physical current files, excluding the CI-only self-referential catalog. */
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '__pycache__' || entry.name.endsWith('.pyc') || entry.name === 'ci-files.json') continue;
      const filename = path.join(directory, entry.name); assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) visit(filename);
      else { assert.ok(entry.isFile()); files[path.relative(repository, filename).split(path.sep).join('/')] = hash(filename); }
    }
  }
  visit(__dirname);
  return files;
}

/** @param {string} directory - Functional evidence data, never executable code. @returns {object} Complete functional/resource proof only. */
function verify(directory) {
  const root = fs.realpathSync.native(directory); const index = read(path.join(root, 'index.json'));
  assert.equal(index.complete, true); assert.equal(index.failure, undefined);
  assert.equal(index.revision, policy.revision); assert.equal(index.purpose, policy.functionalQualification.purpose);
  assert.equal(index.functionalOnly, true); assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  if (!require('node:util').isDeepStrictEqual(index.sourceFiles, sourceFiles())) {
    // Independently pinned producer bytes let current readers replay the existing
    // functional qualification after a reader-only repair, without editing raw data.
    const qualified = require('./constants/functional-qualification.json');
    assert.equal(qualified.purpose, policy.functionalQualification.purpose);
    assert.equal(qualified.performanceAccepted, null); assert.equal(qualified.gateReevaluated, false);
    assert.equal(index.sourceCommit, qualified.sourceCommit); assert.deepEqual(index.sourceFiles, qualified.files);
    assert.equal(hash(path.join(root, 'index.json')), qualified.indexSha256);
    assert.equal(index.harness.sha256, qualified.harnessSha256); assert.equal(index.harness.files.length, qualified.harnessFiles);
    assert.equal(index.derivationSha256, qualified.derivationSha256);
  }
  const harness = source.captureHarness();
  assert.equal(index.harness.sha256, harness.sha256); assert.deepEqual(index.harness.files, harness.files);
  assert.equal(index.sourceCommit, harness.identity.sourceCommit);
  const receipt = results.verifyDerived(index.derivedDirectory, harness, index.sourceCommit);
  assert.equal(hash(path.join(index.derivedDirectory, 'preparation.json')), index.derivationSha256);
  assert.equal(receipt.complete, true);
  assert.deepEqual(index.manifest, preparation.createManifest(index.preparedDirectory));
  assert.deepEqual(read(path.join(root, 'manifest.json')), index.manifest);
  assert.equal(index.processes.length, policy.functionalQualification.processes);
  assert.deepEqual(index.runtimes.map((runtime) => runtime.node), policy.nodes);
  assert.deepEqual(runtimeIdentities(index.runtimes.map((runtime) => runtime.executable)), index.runtimes);
  assert.deepEqual(index.parentMemory.map((snapshot) => snapshot.stage), ['before-workers', ...policy.nodes.map((node) => 'after-' + node)]);
  for (const snapshot of index.parentMemory) {
    for (const field of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) assert.ok(Number.isSafeInteger(snapshot.state[field]) && snapshot.state[field] >= 0);
  }
  for (const [runtimeIndex, runtime] of index.runtimes.entries()) {
    const entries = [];
    for (const [ordinal, input] of plan().entries()) {
      const entry = index.processes[runtimeIndex * plan().length + ordinal];
      assert.deepEqual(entry.input, input); assert.equal(entry.node, runtime.node);
      assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
      const expected = path.join(root, runtimeIndex === 0 ? 'node22' : 'node24', String(ordinal).padStart(4, '0'));
      assert.equal(entry.directory, expected);
      validateInvocation(entry, runtime, input, index.derivedDirectory, root);
      assert.deepEqual(Object.keys(entry.files).sort(), ['report.json', 'report.json' + policy.sidecarSuffix, 'stdout.log', 'stderr.log'].sort());
      for (const [name, expectedHash] of Object.entries(entry.files)) assert.equal(hash(path.join(expected, name)), expectedHash);
      const report = read(path.join(expected, 'report.json'));
      results.validateReport(report, index.manifest, input, entry, read(path.join(expected, 'report.json' + policy.sidecarSuffix)), index.derivationSha256, index.sourceCommit, true);
      entries.push({ ...input, observation: results.estimatorView(report) });
    }
    model.validateSeedProbes(entries);
  }
  return { verified: true, functionalOnly: true, processes: index.processes.length,
    windows: index.processes.length * (policy.warmupSpansPerProcess + policy.measuredSpansPerProcess),
    documents: index.processes.length * (policy.warmupSpansPerProcess + policy.measuredSpansPerProcess),
    performanceAccepted: null, gateReevaluated: false };
}

/** @param {string} prepared - Complete authenticated package. @param {string} derived - Fresh current-source derivation. @param {string} destination - New disjoint evidence directory. @param {string[]} nodes - Fixed official Node22/24 paths. @returns {object} Replayed complete functional proof; no performance criterion is evaluated. */
function run(prepared, derived, destination, nodes) {
  const harness = source.captureHarness();
  prepared = fs.realpathSync.native(prepared); derived = fs.realpathSync.native(derived);
  destination = path.join(fs.realpathSync.native(path.dirname(path.resolve(destination))), path.basename(destination));
  for (const protectedPath of [prepared, derived, repository]) {
    assert.ok(destination !== protectedPath && !destination.startsWith(protectedPath + path.sep) && !protectedPath.startsWith(destination + path.sep));
  }
  const manifest = preparation.createManifest(prepared); const files = sourceFiles();
  results.verifyDerived(derived, harness, harness.identity.sourceCommit);
  const runtimes = runtimeIdentities(nodes);
  const derivationSha256 = hash(path.join(derived, 'preparation.json'));
  fs.mkdirSync(destination);
  const index = { revision: policy.revision, purpose: policy.functionalQualification.purpose,
    sourceCommit: harness.identity.sourceCommit, harness, sourceFiles: files, manifest,
    preparedDirectory: prepared, derivedDirectory: derived, derivationSha256, runtimes,
    functionalOnly: true, performanceAccepted: null, gateReevaluated: false, complete: false,
    startedAt: new Date().toISOString(), processes: [], parentMemory: [{ stage: 'before-workers', state: process.memoryUsage() }] };
  const save = () => write(path.join(destination, 'index.json'), index);
  save(); write(path.join(destination, 'manifest.json'), manifest);
  try {
    const sampler = createSinglePackageWorker(model.settings);
    for (const [runtimeIndex, runtime] of runtimes.entries()) {
      const root = path.join(destination, runtimeIndex === 0 ? 'node22' : 'node24'); fs.mkdirSync(root);
      const commands = plan().map((input, ordinal) => {
        const directory = path.join(root, String(ordinal).padStart(4, '0'));
        return { input, node: runtime.node, directory, argv: [runtime.executable, ...sampler.workerArguments(input.position),
          path.join(derived, 'worker.cjs'), policy.operations.functional, path.join(destination, 'manifest.json'),
          input.phase, input.engine, String(input.position), input.label, path.join(directory, 'report.json'), String(input.rowIndex)] };
      });
      execute(commands, index, destination, (entry) => results.validateReport(read(path.join(entry.directory, 'report.json')), manifest,
        entry.input, entry, read(path.join(entry.directory, 'report.json' + policy.sidecarSuffix)), derivationSha256, index.sourceCommit, true));
      assert.deepEqual(sourceFiles(), files); assert.deepEqual(preparation.createManifest(prepared), manifest);
      assert.deepEqual(source.captureHarness(), harness); results.verifyDerived(derived, harness, index.sourceCommit);
      index.parentMemory.push({ stage: 'after-' + runtime.node, state: process.memoryUsage() }); save();
    }
    index.complete = true; save(); return verify(destination);
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { index.finishedAt = new Date().toISOString(); save(); }
}
if (require.main === module) {
  try {
    const [operation, ...args] = process.argv.slice(2);
    const result = operation === '--verify' ? (assert.equal(args.length, 1), verify(args[0])) :
      (assert.equal(operation, '--qualify'), assert.equal(args.length, 5), run(args[0], args[1], args[2], args.slice(3)));
    console.log(JSON.stringify(result));
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { plan, sourceFiles, validateInvocation, verify, run };
