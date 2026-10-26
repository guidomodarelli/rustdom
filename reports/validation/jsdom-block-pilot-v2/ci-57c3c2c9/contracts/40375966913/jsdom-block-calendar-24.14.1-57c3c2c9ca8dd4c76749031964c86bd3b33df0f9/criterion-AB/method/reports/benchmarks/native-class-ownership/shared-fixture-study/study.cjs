/** @file Defines the separate prospective study; reuses the historical schedule, behavioral contract and estimator. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const original = require('../current-ownership-experiment.cjs');
const sampler = require('../current-ownership-worker.cjs');
const qualification = require('../shared-fixture-worker/qualify.cjs');
const qualificationPolicy = require('../shared-fixture-worker/constants/protocol.json');
const { execute } = require('../jsdom-telemetry/run.cjs');
const settings = require('../constants/current-ownership.cjs');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const qualificationReceiptName = 'reports/validation/native-class-ownership/shared-fixture-worker/derived/preparation.json';

/** Fix the entire new method plus its reused non-frozen transitive code. */
function sourceFiles() {
  const names = [...policy.methodFiles.map((name) => path.relative(repository, path.join(__dirname, name)).split(path.sep).join('/')),
    policy.workflow, policy.contractsWorkflow, qualificationReceiptName, 'reports/validation/native-class-ownership/shared-fixture-worker/receipt.json'];
  return { ...qualification.sourceFiles(), ...Object.fromEntries(names.map((name) => [name, hash(path.join(repository, name))])) };
}

/** The full original sequence remains authoritative; no subset or ordering option is exposed. */
function plan() {
  const entries = original.processSchedule(); assert.equal(entries.length, policy.workersPerNode);
  return entries;
}

/** Read-only preparation authentication, safe before authorization; no DOM is loaded or sampled. */
function preflight(preparation) {
  const harness = original.captureHarness(); assert.equal(harness.sha256, policy.sourceHarnessSha256);
  assert.equal(policy.workerTimeoutMs, require('../jsdom-telemetry/constants/protocol.json').workerTimeoutMs);
  const manifest = original.createManifest(preparation);
  return { revision: policy.revision, samplerInvoked: false, accepted: null, files: sourceFiles(), harness, manifest,
    processesPerNode: plan().length, nodeVersions: settings.nodeVersions };
}

/** Authenticate both executables before invoking either benchmark; a bad second runtime cannot consume half a study. */
function runtimeIdentities(nodes) {
  assert.equal(nodes.length, settings.nodeVersions.length);
  return nodes.map((filename, index) => {
    assert.ok(path.isAbsolute(filename), 'Shared fixture study: runtime path must be absolute');
    const executable = fs.realpathSync(filename); const sha256 = hash(executable);
    const node = settings.nodeVersions[index];
    assert.equal(sha256, require('../constants/current-ownership.json').runtimeExecutableHashes[node]);
    const version = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: policy.runtimeProbeTimeoutMs });
    assert.equal(version.status, 0); assert.equal(version.stdout.trim(), node);
    return { node, executable, sha256 };
  });
}

/** Authenticate executable derived bytes against reviewed originals and the already-qualified sampler. */
function verifyDerived(root, receipt, harness) {
  const qualified = read(path.join(repository, qualificationReceiptName));
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.purpose, policy.purpose);
  assert.equal(receipt.functionalOnly, false); assert.equal(receipt.performanceAccepted, null);
  assert.equal(receipt.sourceHarnessSha256, harness.sha256); assert.equal(receipt.verifiedSourceFiles, harness.files.length);
  assert.equal(receipt.samplerBeforeSha256, harness.files.find((entry) => entry.path === 'benchmarks/worker.cjs').sha256);
  assert.equal(receipt.samplerAfterSha256, qualified.samplerAfterSha256);
  const expected = new Map(harness.files.map((entry) => [`harness/${entry.path}`, entry.sha256]));
  expected.set('harness/benchmarks/worker.cjs', qualified.samplerAfterSha256);
  for (const [destination, source] of [
    ['harness/benchmarks/shared-ownership-fixtures/adapter.cjs', 'reports/benchmarks/native-class-ownership/shared-fixture-worker/adapter.cjs'],
    ['harness/benchmarks/shared-ownership-fixtures/fixtures.cjs', 'reports/benchmarks/native-class-ownership/shared-fixture-candidate/fixtures.cjs'],
    ['harness/benchmarks/shared-ownership-fixtures/constants/fixtures.json', 'reports/benchmarks/native-class-ownership/shared-fixture-candidate/constants/fixtures.json'],
    ['worker.cjs', path.relative(repository, path.join(__dirname, 'worker.cjs'))],
    ['qualification-worker.cjs', 'reports/benchmarks/native-class-ownership/shared-fixture-worker/worker.cjs']]) expected.set(destination, hash(path.join(repository, source)));
  const metadataFiles = ['source-manifest.json', 'sampler.patch', 'shared-fixtures.patch', 'base-preparation.json', 'qualification-preparation.json'];
  assert.deepEqual(Object.keys(receipt.derivedFiles).sort(), [...expected.keys(), ...metadataFiles].sort());
  for (const [name, expectedHash] of expected) assert.equal(receipt.derivedFiles[name], expectedHash);
  for (const [name, expectedHash] of Object.entries(receipt.derivedFiles)) assert.equal(hash(path.join(root, name)), expectedHash);
}

/** Metadata normalization is confined to the reused behavior validator; raw files keep their new study identity. */
function validateReport(report, manifest, input, observed, metadata, derivationSha256) {
  for (const value of [report, metadata]) {
    assert.equal(value.revision, policy.revision); assert.equal(value.purpose, policy.purpose);
    assert.equal(value.functionalOnly, false); assert.equal(value.performanceAccepted, null);
    assert.equal(value.sourceSamplerRevision, settings.revision);
  }
  qualification.validateReport({ ...report, revision: qualificationPolicy.revision, functionalOnly: true }, manifest, input, observed,
    { ...metadata, revision: qualificationPolicy.revision, functionalOnly: true }, derivationSha256);
}

/** Keep only copied scalar estimator inputs between children; complete module lists and resource traces remain on disk. */
function estimatorView(report) {
  assert.equal(report.complete, true);
  return { revision: report.revision, purpose: report.purpose, functionalOnly: report.functionalOnly, node: report.node,
    randomProbe: [...report.randomProbe], batches: report.batches.map((batch) => ({ label: batch.label, name: batch.name,
      rows: batch.rows, samplesMs: [...batch.samplesMs], outputHash: batch.outputHash })) };
}

/** Reuse the unchanged estimator only on a complete sequence from both declared Node versions. */
function decide(entriesByNode) {
  assert.deepEqual(entriesByNode.map((entry) => entry.node), settings.nodeVersions);
  const results = entriesByNode.map(({ node, entries }) => {
    assert.deepEqual(entries.map(({ observation, ...input }) => input), plan());
    for (const entry of entries) {
      assert.equal(entry.observation.revision, policy.revision); assert.equal(entry.observation.purpose, policy.purpose);
      assert.equal(entry.observation.functionalOnly, false); assert.equal(entry.observation.node, node);
    }
    original.validateSeedProbes(entries);
    const summaries = Object.fromEntries(settings.phases.map((phase) => [phase,
      original.summarize(entries.filter((entry) => entry.phase === phase), phase)]));
    assert.deepEqual(summaries.AA.map((row) => row.outputHash), summaries.AB.map((row) => row.outputHash));
    return { node, accepted: summaries.AA.every((row) => row.calibrated) && summaries.AB.every((row) => row.withinBudget), summaries };
  });
  return { accepted: results.every((entry) => entry.accepted), results };
}

/** Authenticate the reviewed checkout's method; unreviewed code cannot start or approve a study. */
function publication() {
  const receipt = read(path.join(repository, policy.publicationReceipt));
  assert.equal(receipt.actionableFindings, 0); assert.deepEqual(receipt.files, sourceFiles());
  assert.equal(receipt.revision, policy.revision); return receipt;
}

/** Replay all raw files using current reviewed code, never code loaded from the evidence tree. */
function verify(directory) {
  const index = read(path.join(directory, 'index.json'));
  assert.equal(index.revision, policy.revision); assert.equal(index.purpose, policy.purpose);
  assert.equal(index.complete, true); assert.equal(index.failure, undefined);
  assert.equal(index.functionalOnly, false); assert.equal(index.historicalGateReevaluated, false);
  assert.deepEqual(index.runtimes.map((entry) => entry.node), settings.nodeVersions);
  for (const runtime of index.runtimes) {
    assert.ok(path.isAbsolute(runtime.executable));
    assert.equal(runtime.sha256, require('../constants/current-ownership.json').runtimeExecutableHashes[runtime.node]);
  }
  const reviewed = publication(); assert.deepEqual(index.sourceFiles, reviewed.files);
  assert.deepEqual(read(path.join(directory, 'manifest.json')), index.manifest);
  assert.deepEqual(index.manifest.preparationBefore, require('../constants/current-ownership-study.cjs').preparation.identity);
  const harness = original.captureHarness(); assert.deepEqual(index.harness, harness);
  const sourceManifest = read(path.join(directory, 'source-manifest.json'));
  assert.equal(sourceManifest.commit, index.sourceCommit); assert.equal(sourceManifest.harnessSha256, harness.sha256);
  assert.deepEqual(sourceManifest.files, harness.files);
  const derived = path.join(directory, 'derived'); const receipt = read(path.join(derived, 'preparation.json'));
  assert.equal(hash(path.join(derived, 'preparation.json')), index.derivationSha256);
  assert.equal(hash(path.join(directory, 'source-manifest.json')), receipt.sourceManifestSha256);
  assert.equal(hash(path.join(derived, 'source-manifest.json')), receipt.sourceManifestSha256);
  verifyDerived(derived, receipt, harness);
  for (const [name, expectedHash] of Object.entries(reviewed.files)) assert.equal(hash(path.join(directory, 'method', name)), expectedHash);
  assert.equal(index.processes.length, policy.workersPerNode * settings.nodeVersions.length);
  const entriesByNode = settings.nodeVersions.map((node) => ({ node, entries: [] }));
  const inputs = plan();
  for (const [ordinal, entry] of index.processes.entries()) {
    const nodeIndex = Math.floor(ordinal / inputs.length); const position = ordinal % inputs.length;
    assert.deepEqual(entry.input, inputs[position]); assert.equal(entry.node, settings.nodeVersions[nodeIndex]);
    assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
    const root = path.join(directory, nodeIndex === 0 ? 'node22' : 'node24', String(position).padStart(4, '0'));
    assert.deepEqual(Object.keys(entry.files).sort(), ['report.json', 'report.json.integration.json', 'stderr.log', 'stdout.log']);
    for (const [name, expectedHash] of Object.entries(entry.files)) assert.equal(hash(path.join(root, name)), expectedHash);
    const report = read(path.join(root, 'report.json')); const metadata = read(path.join(root, 'report.json.integration.json'));
    validateReport(report, index.manifest, entry.input, entry, metadata, index.derivationSha256);
    entriesByNode[nodeIndex].entries.push({ ...entry.input, observation: estimatorView(report) });
  }
  const decision = decide(entriesByNode); assert.deepEqual(index.decision, decision);
  return { verified: true, revision: policy.revision, ...decision, processes: index.processes.length,
    measuredDurations: index.processes.length * settings.measuredSamples,
    warmupDurations: index.processes.length * settings.warmupSamples, historicalGateReevaluated: false };
}

/** Execute the complete predeclared sequence once on the hosted runner; integrity failure preserves all partials. */
function run(preparation, output, sourceCommit, nodes) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Shared fixture study: capture requires the declared hosted runner');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Shared fixture study: no retries');
  assert.equal(nodes.length, settings.nodeVersions.length); assert.match(sourceCommit, /^[a-f0-9]{40}$/);
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' });
  assert.equal(git.status, 0); assert.equal(git.stdout.trim(), sourceCommit);
  publication(); const checked = preflight(preparation); const runtimes = runtimeIdentities(nodes);
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  for (const input of [preparation, repository]) {
    const root = fs.realpathSync(input);
    assert.ok(output !== root && !output.startsWith(`${root}${path.sep}`) && !root.startsWith(`${output}${path.sep}`),
      'Shared fixture study: evidence and verified inputs must be disjoint');
  }
  fs.mkdirSync(output);
  const index = { revision: policy.revision, purpose: policy.purpose, functionalOnly: false, historicalGateReevaluated: false,
    complete: false, sourceCommit, sourceFiles: checked.files, manifest: checked.manifest, harness: checked.harness,
    runtimes, hostedRunId: process.env.GITHUB_RUN_ID, startedAt: new Date().toISOString(), processes: [],
    machine: { cpus: os.cpus(), platform: os.platform(), release: os.release(), totalMemory: os.totalmem() } };
  const save = () => write(path.join(output, 'index.json'), index); save();
  try {
    for (const [name, expectedHash] of Object.entries(checked.files)) {
      const target = path.join(output, 'method', name); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(repository, name), target); assert.equal(hash(target), expectedHash);
    }
    const manifestPath = path.join(output, 'manifest.json'); write(manifestPath, checked.manifest);
    write(path.join(output, 'source-manifest.json'), { commit: sourceCommit, harnessSha256: checked.harness.sha256, files: checked.harness.files });
    const derived = path.join(output, 'derived');
    const result = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), repository, path.join(output, 'source-manifest.json'), derived], { encoding: 'utf8' });
    fs.writeFileSync(path.join(output, 'derivation.stdout.log'), result.stdout ?? ''); fs.writeFileSync(path.join(output, 'derivation.stderr.log'), result.stderr ?? '');
    assert.equal(result.status, 0, result.stderr);
    const receipt = read(path.join(derived, 'preparation.json'));
    index.derivationSha256 = hash(path.join(derived, 'preparation.json')); save();
    const unchanged = () => {
      publication(); assert.deepEqual(sourceFiles(), checked.files); assert.deepEqual(original.captureHarness(), checked.harness);
      assert.deepEqual(original.inspectPreparation(preparation), checked.manifest.preparationBefore);
      for (const runtime of runtimes) assert.equal(hash(runtime.executable), runtime.sha256);
      assert.equal(hash(path.join(derived, 'preparation.json')), index.derivationSha256); verifyDerived(derived, receipt, checked.harness);
    };
    unchanged();
    const entriesByNode = [];
    index.parentMemory = [{ stage: 'before-workers', state: process.memoryUsage() }]; save();
    for (const [nodeIndex, { node, executable }] of runtimes.entries()) {
      const directory = path.join(output, nodeIndex === 0 ? 'node22' : 'node24'); fs.mkdirSync(directory);
      const entries = []; entriesByNode.push({ node, entries });
      const commands = plan().map((input, position) => {
        const target = path.join(directory, String(position).padStart(4, '0'));
        return { input, node, directory: target, argv: [executable, ...sampler.workerArguments(input.position), path.join(derived, 'worker.cjs'),
          manifestPath, input.phase, input.engine, String(input.position), input.label, path.join(target, 'report.json'), String(input.rowIndex)] };
      });
      execute(commands, index, output, (entry) => {
        const report = read(path.join(entry.directory, 'report.json'));
        validateReport(report, checked.manifest, entry.input, entry, read(path.join(entry.directory, 'report.json.integration.json')), index.derivationSha256);
        entries.push({ ...entry.input, observation: estimatorView(report) });
      });
      unchanged();
      index.parentMemory.push({ stage: `after-${node}`, state: process.memoryUsage() }); save();
    }
    index.decision = decide(entriesByNode); index.complete = true; save();
    return verify(output);
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { index.finishedAt = new Date().toISOString(); save(); }
}
if (require.main === module) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    if (mode === '--preflight') { assert.equal(args.length, 1); console.log(JSON.stringify(preflight(args[0]), null, 2)); }
    else if (mode === '--verify') { assert.equal(args.length, 1); console.log(JSON.stringify(verify(args[0]), null, 2)); }
    else {
      assert.equal(mode, '--capture'); assert.equal(args.length, 5);
      const [preparation, output, sourceCommit, ...nodes] = args;
      const result = run(preparation, output, sourceCommit, nodes); console.log(JSON.stringify(result, null, 2));
      if (!result.accepted) process.exitCode = 1;
    }
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { sourceFiles, plan, preflight, runtimeIdentities, verifyDerived, validateReport, estimatorView, decide, publication, verify, run };
