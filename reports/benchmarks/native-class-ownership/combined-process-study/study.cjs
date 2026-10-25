/** @module combined-process-capture Preserves a complete prospective sequence and replays data with current code; external artifact authentication remains separate from numeric criteria. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { execute } = require('../jsdom-telemetry/run.cjs');
const { runtimeIdentities } = require('../shared-fixture-study/study.cjs');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const policy = require('./constants/protocol.json');
const capture = require('./constants/capture.json');
const archive = require('../range-combined-packages/constants/archive.json');
const source = require('./source.cjs');
const preparation = require('./preparation.cjs');
const manifests = require('./manifest.cjs');
const processes = require('./processes.cjs');
const inventory = require('./inventory.cjs');
const model = require('./model.cjs');
const results = require('./results.cjs');
const { compare } = require('./compare.cjs');
const repository = path.resolve(__dirname, '../../../..');
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
const hash = processes.hash; const read = processes.read;

/** @param {string} filename - Current official Node executable, never an archived path. @returns {string} SHA256 computed with a bounded reusable buffer, independently of JSON member limits. */
function hashExecutable(filename) {
  const descriptor = fs.openSync(filename, 'r');
  try {
    const status = fs.fstatSync(descriptor);
    assert.ok(status.isFile() && status.size <= capture.maximumExecutableBytes, 'Combined capture: executable exceeds the declared binary reader bound');
    const digest = createHash('sha256'); const buffer = Buffer.allocUnsafe(capture.hashChunkBytes);
    let length;
    while ((length = fs.readSync(descriptor, buffer, 0, buffer.length, null)) !== 0) digest.update(buffer.subarray(0, length));
    return digest.digest('hex');
  } finally { fs.closeSync(descriptor); }
}

/** @returns {object} Independently regenerated current dependency graph plus its nonrecursive catalog bytes. */
function sourceFiles() {
  const declared = read(path.join(repository, capture.catalog));
  const generated = spawnSync(process.execPath, [path.join(__dirname, 'tools/dependencies.cjs')],
    { encoding: 'utf8', timeout: policy.preparationTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes });
  assert.ifError(generated.error); assert.equal(generated.status, 0, generated.stderr);
  assert.deepEqual(JSON.parse(generated.stdout), declared, 'Combined capture: regenerate and review the complete dependency catalog');
  const receipt = path.join(repository, capture.historicalReceipt);
  assert.equal(hash(receipt), capture.historicalReceiptSha256);
  const pins = read(receipt).files; assert.equal(Object.keys(pins).length, capture.historicalPins);
  for (const [name, expected] of Object.entries(pins)) assert.equal(declared.files[name], expected);
  return { ...declared.files, [capture.catalog]: hash(path.join(repository, capture.catalog)) };
}

/** @returns {object} Exact reviewed method declaration; no receipt is taken from the capture being verified. */
function publication() {
  const receipt = read(path.join(repository, capture.publicationReceipt));
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.actionableFindings, 0);
  assert.deepEqual(receipt.files, sourceFiles(), 'Combined capture: method differs from the independent reviewed publication');
  return receipt;
}

/** @param {string} directory - Real independently authenticated package. @returns {object} Actual source/package provenance without DOM or measurement. */
function preflight(directory) {
  assert.equal(process.platform, 'linux');
  assert.ok(policy.nodes.includes(process.version));
  assert.equal(hashExecutable(process.execPath), require('../constants/current-ownership.json').runtimeExecutableHashes[process.version]);
  assert.equal(policy.workerTimeoutMs, require('../jsdom-telemetry/constants/protocol.json').workerTimeoutMs);
  assert.equal(policy.jobTimeoutMinutes, capture.setupBudgetMinutes + policy.captureTimeoutMinutes +
    capture.archiveTimeoutMinutes + capture.uploadTimeoutMinutes + capture.jobOverheadMarginMinutes);
  const harness = source.captureHarness(); const files = sourceFiles();
  const root = fs.realpathSync.native(directory); const manifest = preparation.createManifest(root);
  manifests.verify(manifest, root); assert.equal(model.plan().length, policy.processesPerNode);
  const git = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repository, encoding: 'utf8' });
  assert.ifError(git.error); assert.equal(git.status, 0, git.stderr);
  return { revision: policy.revision, files, harness, manifest, preparedDirectory: root,
    sourceCommit: harness.identity.sourceCommit, sourceChangesRaw: git.stdout,
    samplerInvoked: false, performanceAccepted: null, gateReevaluated: false };
}

/** @param {object} checked - Actual current preflight result. @param {string} directory - Fresh owned capture or preparation directory. @returns {object} Verified derivation without invoking a worker or changing original source identity. */
function snapshotInputs(checked, directory) {
  const destination = fs.realpathSync.native(directory);
  for (const protectedPath of [checked.preparedDirectory, repository]) assert.ok(destination !== protectedPath &&
    !destination.startsWith(protectedPath + path.sep) && !protectedPath.startsWith(destination + path.sep));
  assert.ok(fs.readdirSync(destination).every((name) => name === capture.files.index), 'Combined snapshot: preserve existing evidence');
  for (const [name, expected] of Object.entries(checked.files)) {
    assert.equal(path.posix.normalize(name), name); assert.ok(!name.startsWith('../') && !path.posix.isAbsolute(name));
    const output = path.join(destination, capture.files.method, name); fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(repository, name), output, fs.constants.COPYFILE_EXCL); assert.equal(hash(output), expected);
  }
  const packageFile = path.join(destination, capture.files.package); fs.mkdirSync(path.dirname(packageFile), { recursive: true });
  fs.copyFileSync(path.join(repository, archive.archive.path), packageFile, fs.constants.COPYFILE_EXCL);
  assert.equal(hash(packageFile), policy.packageArchiveSha256);
  for (const [name, value] of [[capture.files.manifest, checked.manifest],
    [capture.files.sourceManifest, { commit: checked.sourceCommit, harnessSha256: checked.harness.sha256, files: checked.harness.files }]]) {
    fs.writeFileSync(path.join(destination, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  }
  const derived = path.join(destination, capture.files.derived);
  const derivation = spawnSync('python3', ['-B', path.join(__dirname, 'derive.py'), repository,
    path.join(destination, capture.files.sourceManifest), derived],
  { encoding: 'utf8', timeout: policy.preparationTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes });
  fs.writeFileSync(path.join(destination, 'derivation.stdout.log'), derivation.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(destination, 'derivation.stderr.log'), derivation.stderr ?? '', { flag: 'wx' });
  assert.ifError(derivation.error); assert.equal(derivation.status, 0, derivation.stderr);
  const receipt = results.verifyDerived(derived, checked.harness, checked.sourceCommit);
  assert.equal(receipt.sourceChangesRaw, checked.sourceChangesRaw);
  return { derived, derivationSha256: hash(path.join(derived, 'preparation.json')), samplerInvoked: false,
    performanceAccepted: null, gateReevaluated: false };
}

/** @param {object[]} snapshots - Raw parent snapshots. @returns {void} Validate stages and finite counts without inferring peak memory. */
function verifyParent(snapshots) {
  assert.deepEqual(snapshots.map((entry) => entry.stage), ['before-workers', ...policy.nodes.map((node) => 'after-' + node)]);
  for (const entry of snapshots) for (const name of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) {
    assert.ok(Number.isSafeInteger(entry.state[name]) && entry.state[name] >= 0);
  }
}

/** @param {string} directory - Current extraction path; original absolute paths remain unchanged in the archived data. @returns {object} Complete payload verification and numerical criteria, with acceptance null until independent transport authentication. */
function verify(directory) {
  const root = fs.realpathSync.native(directory); const index = read(path.join(root, capture.files.index));
  assert.equal(index.revision, policy.revision); assert.equal(index.purpose, policy.purpose);
  assert.equal(index.complete, true); assert.equal(index.failure, undefined); assert.equal(index.inventoryFailure, undefined);
  assert.equal(index.functionalOnly, false); assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  assert.match(index.sourceCommit, /^[a-f0-9]{40}$/); assert.equal(index.sourceChangesRaw, '');
  assert.equal(index.hosted.repository, policy.apiRepository); assert.equal(index.hosted.workflow, policy.workflowName);
  assert.equal(index.hosted.jobKey, capture.jobKey);
  assert.match(index.hosted.runId, /^[1-9][0-9]*$/); assert.equal(index.hosted.attempt, 1);
  assert.ok(path.posix.isAbsolute(index.captureDirectory)); assert.equal(path.posix.normalize(index.captureDirectory), index.captureDirectory);
  const reviewed = publication(); assert.deepEqual(index.sourceFiles, reviewed.files);
  const publicationFile = path.join(root, capture.files.publication);
  assert.equal(hash(publicationFile), hash(path.join(repository, capture.publicationReceipt)));
  assert.equal(hash(publicationFile), index.publicationSha256); assert.deepEqual(read(publicationFile), reviewed);
  for (const [name, expected] of Object.entries(reviewed.files)) assert.equal(hash(path.join(root, capture.files.method, name)), expected);
  const packageFile = path.join(root, capture.files.package);
  assert.equal(hash(packageFile), policy.packageArchiveSha256); assert.equal(fs.statSync(packageFile).size, archive.archive.bytes);
  const manifest = read(path.join(root, capture.files.manifest)); assert.deepEqual(manifest, index.manifest);
  manifests.verify(manifest, index.preparedDirectory);
  const harness = source.captureHarness();
  assert.equal(index.harness.sha256, harness.sha256); assert.deepEqual(index.harness.files, harness.files);
  assert.equal(index.harness.identity.sourceCommit, index.sourceCommit);
  assert.equal(index.harness.identity.sourceHash, harness.identity.sourceHash);
  assert.deepEqual(index.harness.identity.measuredSources, harness.identity.measuredSources);
  assert.deepEqual(index.harness.identity.sourceChanges, []); assert.deepEqual(index.harness.identity.sourceGitErrors, []);
  const expectedSource = { commit: index.sourceCommit, harnessSha256: harness.sha256, files: harness.files };
  assert.deepEqual(read(path.join(root, capture.files.sourceManifest)), expectedSource);
  const derived = path.join(root, capture.files.derived);
  assert.equal(hash(path.join(derived, 'preparation.json')), index.derivationSha256);
  assert.equal(hash(path.join(root, capture.files.sourceManifest)), hash(path.join(derived, 'source-manifest.json')));
  const receipt = results.verifyDerived(derived, harness, index.sourceCommit);
  assert.equal(receipt.sourceChangesRaw, index.sourceChangesRaw);
  const observed = processes.scan(root, index, manifest, { inputs: model.plan(), originalRoot: index.captureDirectory,
    originalDerived: path.posix.join(index.captureDirectory, capture.files.derived), functionalOnly: false });
  assert.equal(observed.measuredDurations, policy.measuredSpans); assert.equal(observed.warmupDurations, policy.warmupSpans);
  assert.equal(observed.windows, policy.observedWindows); assert.equal(observed.documents, policy.observedDocuments);
  const comparison = compare(observed.entriesByNode); assert.deepEqual(index.comparison, comparison);
  verifyParent(index.parentMemory);
  assert.equal(hash(path.join(root, capture.files.inventory)), index.inventorySha256);
  assert.deepEqual(read(path.join(root, capture.files.inventory)), inventory.snapshot(root));
  return { verified: true, payloadComplete: true, captureAuthenticated: false, revision: policy.revision,
    sourceCommit: index.sourceCommit, readerSourceCommit: harness.identity.sourceCommit,
    hosted: index.hosted, processes: index.processes.length, measuredDurations: observed.measuredDurations,
    warmupDurations: observed.warmupDurations, windows: observed.windows, documents: observed.documents,
    comparison, performanceAccepted: null, gateReevaluated: false };
}

/** @param {string} directory - Authenticated package. @param {string} destination - Fresh disjoint data root. @param {string} sourceCommit - Actual activation SHA. @param {string[]} nodes - Official Node22 then24. @returns {object} Verified complete raw criteria, never external artifact acceptance. */
function run(directory, destination, sourceCommit, nodes) {
  assert.equal(policy.executionReady, true, 'Combined capture: complete method publication is not enabled');
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.apiRepository); assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName);
  assert.equal(process.env.GITHUB_JOB, capture.jobKey);
  assert.match(process.env.GITHUB_RUN_ID ?? '', /^[1-9][0-9]*$/);
  const reviewed = publication(); const checked = preflight(directory); const runtimes = runtimeIdentities(nodes);
  assert.equal(checked.sourceCommit, sourceCommit); assert.equal(checked.sourceChangesRaw, '', 'Combined capture: a clean actual producer checkout is required');
  destination = path.join(fs.realpathSync.native(path.dirname(path.resolve(destination))), path.basename(destination));
  for (const protectedPath of [checked.preparedDirectory, repository]) assert.ok(destination !== protectedPath &&
    !destination.startsWith(protectedPath + path.sep) && !protectedPath.startsWith(destination + path.sep));
  fs.mkdirSync(destination);
  const index = { revision: policy.revision, purpose: policy.purpose, complete: false, functionalOnly: false,
    performanceAccepted: null, gateReevaluated: false, sourceCommit, sourceChangesRaw: checked.sourceChangesRaw,
    sourceFiles: reviewed.files, harness: checked.harness, manifest: checked.manifest, preparedDirectory: checked.preparedDirectory,
    captureDirectory: destination, runtimes, startedAt: new Date().toISOString(), processes: [],
    hosted: { repository: process.env.GITHUB_REPOSITORY, workflow: process.env.GITHUB_WORKFLOW, runId: process.env.GITHUB_RUN_ID,
      attempt: Number(process.env.GITHUB_RUN_ATTEMPT), jobKey: process.env.GITHUB_JOB },
    machine: { cpus: os.cpus(), platform: os.platform(), release: os.release(), totalMemory: os.totalmem() },
    parentMemory: [] };
  const save = () => write(path.join(destination, capture.files.index), index);
  const saveInventory = () => { write(path.join(destination, capture.files.inventory), inventory.snapshot(destination));
    index.inventorySha256 = hash(path.join(destination, capture.files.inventory)); };
  save();
  try {
    const prepared = snapshotInputs(checked, destination); const derived = prepared.derived;
    index.derivationSha256 = prepared.derivationSha256; save();
    const publicationFile = path.join(destination, capture.files.publication);
    fs.copyFileSync(path.join(repository, capture.publicationReceipt), publicationFile); index.publicationSha256 = hash(publicationFile);
    const unchanged = () => {
      assert.deepEqual(publication(), reviewed); assert.deepEqual(source.captureHarness(), checked.harness);
      assert.deepEqual(preparation.createManifest(checked.preparedDirectory), checked.manifest);
      assert.deepEqual(runtimeIdentities(nodes), runtimes); results.verifyDerived(derived, checked.harness, sourceCommit);
      assert.equal(hash(path.join(derived, 'preparation.json')), index.derivationSha256);
    };
    unchanged(); index.parentMemory.push({ stage: 'before-workers', state: process.memoryUsage() }); save();
    const sampler = createSinglePackageWorker(model.settings);
    for (const [runtimeIndex, runtime] of runtimes.entries()) {
      const root = path.join(destination, runtimeIndex === 0 ? 'node22' : 'node24'); fs.mkdirSync(root);
      const commands = model.plan().map((input, ordinal) => {
        const output = path.join(root, String(ordinal).padStart(4, '0'));
        return { input, node: runtime.node, directory: output, argv: [runtime.executable, ...sampler.workerArguments(input.position),
          path.join(derived, 'worker.cjs'), path.join(destination, capture.files.manifest), input.phase, input.engine,
          String(input.position), input.label, path.join(output, 'report.json'), String(input.rowIndex)] };
      });
      execute(commands, index, destination, (entry) => results.validateReport(read(path.join(entry.directory, 'report.json')),
        checked.manifest, entry.input, entry, read(path.join(entry.directory, 'report.json' + policy.sidecarSuffix)), index.derivationSha256, sourceCommit, false));
      unchanged(); index.parentMemory.push({ stage: 'after-' + runtime.node, state: process.memoryUsage() }); save();
    }
    const observed = processes.scan(destination, index, checked.manifest, { inputs: model.plan(), originalRoot: destination,
      originalDerived: derived, functionalOnly: false });
    index.comparison = compare(observed.entriesByNode); index.complete = true; saveInventory(); save();
    return verify(destination);
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally {
    index.finishedAt = new Date().toISOString();
    if (!index.complete) {
      try { saveInventory(); }
      catch (error) { index.inventoryFailure = { message: error.message, stack: error.stack }; process.stderr.write('Combined capture: partial inventory failed: ' + error.message + '\n'); }
    }
    save();
  }
}
if (require.main === module) {
  try {
    const [operation, ...args] = process.argv.slice(2);
    let result;
    if (operation === capture.operations.plan) { assert.equal(args.length, 0); result = { settings: model.settings, processes: model.plan() }; }
    else if (operation === capture.operations.preflight) { assert.equal(args.length, 1); result = preflight(args[0]); }
    else if (operation === capture.operations.verify) { assert.equal(args.length, 1); result = verify(args[0]); }
    else { assert.equal(operation, capture.operations.capture); assert.equal(args.length, 5); result = run(args[0], args[1], args[2], args.slice(3)); }
    console.log(JSON.stringify(result));
    if (result.payloadComplete && !result.comparison.allBudgetsMet) process.exitCode = 1;
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { hashExecutable, sourceFiles, publication, preflight, snapshotInputs, verifyParent, verify, run };
