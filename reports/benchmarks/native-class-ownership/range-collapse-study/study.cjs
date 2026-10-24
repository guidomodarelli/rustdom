/** @module range-study Archives one complete prospective sequence and replays it with current reviewed code. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const original = require('../current-ownership-experiment.cjs');
const historical = require('../shared-fixture-study/study.cjs');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const { execute } = require('../jsdom-telemetry/run.cjs');
const preparation = require('./preparation.cjs');
const model = require('./model.cjs');
const results = require('./results.cjs');
const policy = require('./constants/protocol.json');
const baseStudy = require('../cold-cleanup-study/study.cjs');
const identity = require('./constants/identity.json');
const packageRecipe = require('../range-collapse-packages/constants/packages.json');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Pins every frozen source plus all current report-side and transport dependencies.
 * @returns {object} Repository-relative digests, independent of any evidence directory.
 * @throws {Error} When a historical pin or the canonical harness has changed.
 */
function sourceFiles() {
  const names = new Set(Object.keys(baseStudy.sourceFiles()));
  for (const name of policy.methodFiles) names.add(path.relative(repository, path.join(__dirname, name)).split(path.sep).join('/'));
  for (const name of policy.packageFiles) names.add(`${policy.packageDirectory}/${name}`);
  for (const name of [policy.workflow, policy.contractsWorkflow, policy.archive.path, policy.extractor.path,
    packageRecipe.artifact.zipPath, packageRecipe.artifact.metadataPath, packageRecipe.qualificationSourcePolicy]) names.add(name);
  for (const [name, expected] of Object.entries(policy.packageEvidencePins)) {
    const filename = `${policy.packageEvidenceDirectory}/${name}`;
    assert.equal(hash(path.join(repository, filename)), expected); names.add(filename);
  }
  for (const entry of Object.values(packageRecipe.qualification)) {
    assert.equal(hash(path.join(repository, entry.path)), entry.sha256); names.add(entry.path);
  }
  const reviewedReaders = read(path.join(repository, packageRecipe.qualification['review.json'].path));
  const readerRoot = path.dirname(packageRecipe.qualification['review.json'].path);
  for (const [name, expected] of Object.entries(reviewedReaders.tools)) {
    const filename = `${readerRoot}/tools/${name}`; assert.equal(hash(path.join(repository, filename)), expected); names.add(filename);
  }
  const candidate = read(path.join(repository, packageRecipe.qualificationSourcePolicy));
  const candidateRoot = path.dirname(path.dirname(packageRecipe.qualificationSourcePolicy));
  names.add(`${candidateRoot}/range-collapse.patch`);
  for (const name of Object.keys(candidate.functional)) names.add(`${candidateRoot}/${name}`);
  return Object.fromEntries([...names].sort().map((name) => [name, hash(path.join(repository, name))]));
}

/**
 * Authenticates inputs without deriving, loading a DOM or collecting samples.
 * @param {string} directory - Exact extracted hosted preparation.
 * @returns {object} Complete immutable declaration and actual package manifest.
 */
function preflight(directory) {
  preparation.assertRuntimeContext();
  assert.equal(policy.workerTimeoutMs, require('../jsdom-telemetry/constants/protocol.json').workerTimeoutMs);
  const files = sourceFiles(); const harness = original.captureHarness();
  assert.deepEqual(harness.identity.sourceChanges, []); assert.deepEqual(harness.identity.sourceGitErrors, []);
  assert.equal(model.plan().length, policy.workersPerNode);
  return { revision: policy.revision, samplerInvoked: false, performanceAccepted: null, historicalGateReevaluated: false,
    scheduleLayout: policy.scheduleLayout, settings: model.settings, files, harness, manifest: preparation.createManifest(directory) };
}

/** @returns {object} Locally reviewed publication whose exact files are also checked by CI. */
function publication() {
  const receipt = read(path.join(repository, policy.publicationReceipt));
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.actionableFindings, 0);
  assert.deepEqual(receipt.files, sourceFiles(), 'Range study: current method differs from the reviewed publication');
  return receipt;
}

/**
 * Recomputes a complete archive without importing any code from it.
 * @param {string} directory - Authenticated capture root, including raw reports and source snapshots.
 * @returns {object} Independent decision for the full new study only.
 * @throws {Error} When any report, source, code, package or resource contract differs.
 */
function verify(directory) {
  const root = fs.realpathSync(directory); const index = read(path.join(root, 'index.json'));
  assert.equal(index.revision, policy.revision); assert.equal(index.purpose, policy.purpose);
  assert.equal(index.scheduleLayout, policy.scheduleLayout);
  assert.equal(index.complete, true); assert.equal(index.failure, undefined);
  assert.equal(index.functionalOnly, false); assert.equal(index.historicalGateReevaluated, false);
  assert.match(index.sourceCommit, /^[a-f0-9]{40}$/);
  const reviewed = publication(); assert.deepEqual(index.sourceFiles, reviewed.files);
  assert.deepEqual(index.runtimes.map((entry) => entry.node), model.settings.nodeVersions);
  const runtimeHashes = require('../constants/current-ownership.json').runtimeExecutableHashes;
  for (const runtime of index.runtimes) { assert.ok(path.isAbsolute(runtime.executable)); assert.equal(runtime.sha256, runtimeHashes[runtime.node]); }
  const manifest = read(path.join(root, 'manifest.json')); assert.deepEqual(manifest, index.manifest);
  assert.deepEqual(manifest.preparationBefore, identity);
  assert.deepEqual(manifest.preparation, { archiveSha256: policy.archive.sha256, hostedHead: identity.hostedHead,
    artifactId: identity.artifactId, identity });
  assert.deepEqual(manifest.distributions, preparation.verifyQualification().distributions);
  const harness = original.captureHarness();
  assert.equal(index.harness.sha256, harness.sha256); assert.deepEqual(index.harness.files, harness.files);
  assert.equal(index.harness.identity.sourceCommit, index.sourceCommit);
  assert.equal(index.harness.identity.sourceHash, harness.identity.sourceHash);
  assert.deepEqual(index.harness.identity.measuredSources, harness.identity.measuredSources);
  assert.deepEqual(index.harness.identity.sourceChanges, []); assert.deepEqual(index.harness.identity.sourceGitErrors, []);
  const sourceManifest = read(path.join(root, 'source-manifest.json'));
  assert.deepEqual(sourceManifest, { commit: index.sourceCommit, harnessSha256: harness.sha256, files: harness.files });
  for (const [name, expectedHash] of Object.entries(reviewed.files)) assert.equal(hash(path.join(root, 'method', name)), expectedHash);
  const derived = path.join(root, 'derived'); const receipt = read(path.join(derived, 'preparation.json'));
  assert.equal(hash(path.join(derived, 'preparation.json')), index.derivationSha256);
  assert.equal(hash(path.join(root, 'source-manifest.json')), hash(path.join(derived, 'source-manifest.json')));
  results.verifyDerived(derived, receipt, harness, index.sourceCommit);
  const inputs = model.plan(); assert.equal(index.processes.length, inputs.length * model.settings.nodeVersions.length);
  const entriesByNode = model.settings.nodeVersions.map((node) => ({ node, entries: [] }));
  for (const [ordinal, entry] of index.processes.entries()) {
    const runtime = Math.floor(ordinal / inputs.length); const position = ordinal % inputs.length;
    assert.deepEqual(entry.input, inputs[position]); assert.equal(entry.node, model.settings.nodeVersions[runtime]);
    assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
    const childRoot = path.join(root, runtime === 0 ? 'node22' : 'node24', String(position).padStart(4, '0'));
    assert.deepEqual(Object.keys(entry.files).sort(), ['report.json', 'report.json' + policy.sidecarSuffix, 'stderr.log', 'stdout.log'].sort());
    for (const [name, expectedHash] of Object.entries(entry.files)) assert.equal(hash(path.join(childRoot, name)), expectedHash);
    const report = read(path.join(childRoot, 'report.json'));
    results.validateReport(report, manifest, entry.input, entry, read(path.join(childRoot, 'report.json' + policy.sidecarSuffix)), index.derivationSha256);
    entriesByNode[runtime].entries.push({ ...entry.input, observation: results.estimatorView(report) });
  }
  const decision = results.decide(entriesByNode); assert.deepEqual(index.decision, decision);
  assert.equal(index.performanceAccepted, decision.accepted);
  assert.equal(index.parentMemory.length, model.settings.nodeVersions.length + 1);
  assert.deepEqual(index.parentMemory.map((entry) => entry.stage), ['before-workers', ...model.settings.nodeVersions.map((node) => `after-${node}`)]);
  return { verified: true, revision: policy.revision, ...decision, processes: index.processes.length,
    measuredDurations: index.processes.length * model.settings.measuredSamples,
    warmupDurations: index.processes.length * model.settings.warmupSamples, historicalGateReevaluated: false };
}

/**
 * Executes the complete predeclared sequence only after the reviewed publication and its unique standing-authorized activation.
 * @param {string} directory - Original authenticated preparation.
 * @param {string} output - Fresh owned evidence directory disjoint from inputs.
 * @param {string} sourceCommit - Actual checked-out workflow commit.
 * @param {string[]} nodes - The two independently pinned executable paths, Node22 then Node24.
 * @returns {object} Complete decision, or preserves all partials and throws.
 */
function run(directory, output, sourceCommit, nodes) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Range study: capture requires the declared hosted runner');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Range study: no retries');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.apiRepository, 'Range study: repository differs');
  assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName, 'Range study: workflow differs');
  assert.equal(nodes.length, model.settings.nodeVersions.length); assert.match(sourceCommit, /^[a-f0-9]{40}$/);
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' });
  assert.equal(git.status, 0); assert.equal(git.stdout.trim(), sourceCommit);
  publication(); const checked = preflight(directory); const runtimes = historical.runtimeIdentities(nodes);
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  for (const input of [directory, repository]) {
    const current = fs.realpathSync(input);
    assert.ok(output !== current && !output.startsWith(`${current}${path.sep}`) && !current.startsWith(`${output}${path.sep}`),
      'Range study: evidence and verified inputs must be disjoint');
  }
  fs.mkdirSync(output);
  const index = { revision: policy.revision, purpose: policy.purpose, functionalOnly: false, historicalGateReevaluated: false,
    performanceAccepted: null, complete: false, sourceCommit, scheduleLayout: policy.scheduleLayout, sourceFiles: checked.files, manifest: checked.manifest,
    harness: checked.harness, runtimes, hostedRunId: process.env.GITHUB_RUN_ID, startedAt: new Date().toISOString(), processes: [],
    machine: { cpus: os.cpus(), platform: os.platform(), release: os.release(), totalMemory: os.totalmem() } };
  const save = () => write(path.join(output, 'index.json'), index); save();
  try {
    for (const [name, expectedHash] of Object.entries(checked.files)) {
      const filename = path.join(output, 'method', name); fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.copyFileSync(path.join(repository, name), filename); assert.equal(hash(filename), expectedHash);
    }
    const manifestPath = path.join(output, 'manifest.json'); write(manifestPath, checked.manifest);
    const sourceManifestPath = path.join(output, 'source-manifest.json');
    write(sourceManifestPath, { commit: sourceCommit, harnessSha256: checked.harness.sha256, files: checked.harness.files });
    const derived = path.join(output, 'derived');
    const derivation = spawnSync('python3', ['-B', path.join(__dirname, 'derive.py'), repository, sourceManifestPath, derived],
      { encoding: 'utf8', maxBuffer: policy.metadataOutputLimitBytes });
    fs.writeFileSync(path.join(output, 'derivation.stdout.log'), derivation.stdout ?? '');
    fs.writeFileSync(path.join(output, 'derivation.stderr.log'), derivation.stderr ?? '');
    assert.equal(derivation.status, 0, derivation.stderr);
    index.derivationSha256 = hash(path.join(derived, 'preparation.json')); save();
    const receipt = read(path.join(derived, 'preparation.json'));
    const unchanged = () => {
      publication(); assert.deepEqual(sourceFiles(), checked.files); assert.deepEqual(original.captureHarness(), checked.harness);
      assert.deepEqual(preparation.createManifest(directory), checked.manifest);
      for (const runtime of runtimes) assert.equal(hash(runtime.executable), runtime.sha256);
      assert.equal(hash(path.join(derived, 'preparation.json')), index.derivationSha256);
      results.verifyDerived(derived, receipt, checked.harness, sourceCommit);
    };
    unchanged(); const sampler = createSinglePackageWorker(model.settings);
    const entriesByNode = []; index.parentMemory = [{ stage: 'before-workers', state: process.memoryUsage() }]; save();
    for (const [runtime, { node, executable }] of runtimes.entries()) {
      const destination = path.join(output, runtime === 0 ? 'node22' : 'node24'); fs.mkdirSync(destination);
      const entries = []; entriesByNode.push({ node, entries });
      const commands = model.plan().map((input, position) => {
        const target = path.join(destination, String(position).padStart(4, '0'));
        return { input, node, directory: target, argv: [executable, ...sampler.workerArguments(input.position), path.join(derived, 'worker.cjs'),
          manifestPath, input.phase, input.engine, String(input.position), input.label, path.join(target, 'report.json'), String(input.rowIndex)] };
      });
      execute(commands, index, output, (entry) => {
        const report = read(path.join(entry.directory, 'report.json'));
        results.validateReport(report, checked.manifest, entry.input, entry, read(path.join(entry.directory, 'report.json' + policy.sidecarSuffix)), index.derivationSha256);
        entries.push({ ...entry.input, observation: results.estimatorView(report) });
      });
      unchanged(); index.parentMemory.push({ stage: `after-${node}`, state: process.memoryUsage() }); save();
    }
    index.decision = results.decide(entriesByNode); index.performanceAccepted = index.decision.accepted; index.complete = true; save();
    return verify(output);
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { index.finishedAt = new Date().toISOString(); save(); }
}
if (require.main === module) {
  try {
    const [operation, ...args] = process.argv.slice(2);
    if (operation === policy.operations.plan) { assert.equal(args.length, 0); console.log(JSON.stringify({ revision: policy.revision, scheduleLayout: policy.scheduleLayout, settings: model.settings, processes: model.plan() })); }
    else if (operation === policy.operations.preflight) { assert.equal(args.length, 1); console.log(JSON.stringify(preflight(args[0]))); }
    else if (operation === policy.operations.verify) { assert.equal(args.length, 1); console.log(JSON.stringify(verify(args[0]))); }
    else {
      assert.equal(operation, policy.operations.capture); assert.equal(args.length, 5);
      const decision = run(args[0], args[1], args[2], args.slice(3)); console.log(JSON.stringify(decision));
      if (!decision.accepted) process.exitCode = 1;
    }
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = policy.failureExitCode; }
}
module.exports = { sourceFiles, preflight, publication, verify, run, plan: model.plan };
