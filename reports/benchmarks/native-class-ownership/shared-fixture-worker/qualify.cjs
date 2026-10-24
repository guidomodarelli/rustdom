/** @file Qualifies the derived sampler's real behavior; never calculates performance acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const policy = require('./constants/protocol.json');
const study = require('../current-ownership-experiment.cjs');
const worker = require('../current-ownership-worker.cjs');
const settings = require('../constants/current-ownership.cjs');
const { execute } = require('../jsdom-telemetry/run.cjs');
const repository = path.resolve(__dirname, '../../../..');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');

/** Pin new method files and reused non-frozen dependencies before executing any DOM. */
function sourceFiles() {
  const names = policy.methodFiles.map((name) => path.relative(repository, path.join(__dirname, name)).split(path.sep).join('/'));
  return Object.fromEntries([...names, ...policy.sharedFiles, policy.referenceFile].map((name) => [name, hash(path.join(repository, name))]));
}

/** Select one complete eight-row qualification per physical package, retaining original relative order. */
function plan() {
  const entries = study.processSchedule().filter((entry) => entry.position === policy.qualificationPosition
    && (entry.phase === 'AA' || (entry.phase === 'AB' && entry.engine === 'rustdom' && entry.label === 'B')));
  assert.equal(entries.length, policy.workersPerNode);
  const matrix = new Set(entries.map((entry) => `${worker.schedule({ copies: {} }, entry.phase, entry.engine,
    entry.position, entry.label, entry.rowIndex).physical}/${entry.rowIndex}`));
  for (const physical of Object.keys(settings.distributionHashes)) for (const rowIndex of settings.rows.keys()) {
    assert.ok(matrix.has(`${physical}/${rowIndex}`), 'Shared fixture qualification: missing physical package/row');
  }
  assert.equal(matrix.size, policy.workersPerNode);
  return entries;
}

/** Validate provenance first, then reuse the original behavior/resource checks without rewriting the raw report. */
function validateReport(report, manifest, input, expected, metadata, derivationSha256) {
  assert.equal(report.revision, policy.revision);
  assert.equal(report.sourceSamplerRevision, settings.revision);
  assert.equal(report.functionalOnly, true); assert.equal(report.performanceAccepted, null);
  assert.equal(metadata.revision, policy.revision); assert.equal(metadata.functionalOnly, true);
  assert.equal(metadata.performanceAccepted, null); assert.equal(metadata.gateReevaluated, false);
  assert.equal(metadata.samplerInvoked, true); assert.equal(metadata.complete, true);
  assert.equal(metadata.pid, expected.pid); assert.equal(metadata.node, expected.node);
  assert.equal(metadata.derivationSha256, derivationSha256); assert.equal(metadata.failure, undefined);
  study.validateWorker({ ...report, revision: report.sourceSamplerRevision }, manifest, { ...input, pid: expected.pid, node: expected.node });
  const batch = report.batches[0];
  const reference = read(path.join(repository, policy.referenceFile)).results.find((entry) => entry.node === report.node);
  const key = `${batch.name}/${batch.size}`;
  assert.equal(batch.outputHash, reference.summaries.AA.find((entry) => entry.key === key).outputHash,
    'Shared fixture qualification: output differs from the independent original jsdom control');
  const count = settings.warmupSamples + settings.measuredSamples;
  assert.equal(batch.sampleTimings.length, count);
  for (const [index, span] of batch.sampleTimings.entries()) {
    assert.equal(span.index, index); assert.equal(span.stage, index < settings.warmupSamples ? 'warmup' : 'measured');
    assert.ok(Number.isFinite(span.startMs) && span.startMs > 0);
    assert.ok(Number.isFinite(span.durationMs) && span.durationMs > 0);
  }
  assert.deepEqual(batch.samplesMs, batch.sampleTimings.slice(settings.warmupSamples).map((span) => span.durationMs));
  const fixtures = count * (1 + settings.withinRealmWarmupRounds);
  const mutationCount = batch.name === policy.mutationWorkload ? fixtures : 0;
  const deliveryCount = batch.name === policy.deliveryWorkload ? fixtures : 0;
  assert.deepEqual(report.integration, { mutationCreated: mutationCount, mutationSharedMethods: mutationCount,
    deliveryCreated: deliveryCount, deliverySharedMethods: deliveryCount });
  assert.deepEqual(metadata.adapter, report.integration);
  for (const endpoint of batch.cleanupTrace) {
    assert.deepEqual(Object.keys(endpoint.survivors).sort(), ['document', 'window']);
    for (const value of Object.values(endpoint.survivors)) assert.ok(Number.isSafeInteger(value) && value >= 0);
  }
  return report;
}

/** Authenticate official packages and run a fixed functional matrix once, keeping all partial files and timings. */
function run(preparation, output, sourceCommit, nodes) {
  assert.match(sourceCommit, /^[a-f0-9]{40}$/); assert.equal(nodes.length, settings.nodeVersions.length);
  assert.equal(require('../jsdom-telemetry/constants/protocol.json').workerTimeoutMs, policy.workerTimeoutMs);
  const files = sourceFiles(); const harness = study.captureHarness();
  assert.equal(harness.sha256, policy.sourceHarnessSha256);
  const manifest = study.createManifest(preparation);
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  for (const input of [preparation, repository]) {
    const root = fs.realpathSync(input);
    assert.ok(output !== root && !output.startsWith(`${root}${path.sep}`) && !root.startsWith(`${output}${path.sep}`),
      'Shared fixture qualification: output and verified inputs must be disjoint');
  }
  fs.mkdirSync(output);
  const index = { revision: policy.revision, functionalOnly: true, performanceAccepted: null, gateReevaluated: false,
    complete: false, sourceCommit, sourceFiles: files, manifest, startedAt: new Date().toISOString(),
    machine: { cpus: os.cpus(), platform: os.platform(), release: os.release(), totalMemory: os.totalmem() }, processes: [] };
  const save = () => write(path.join(output, 'index.json'), index); save();
  try {
    for (const [name, expected] of Object.entries(files)) {
      const destination = path.join(output, 'method', name); fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(repository, name), destination); assert.equal(hash(destination), expected);
    }
    write(path.join(output, 'source-manifest.json'), { commit: sourceCommit, harnessSha256: harness.sha256, files: harness.files });
    const derived = path.join(output, 'derived');
    const result = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), repository, path.join(output, 'source-manifest.json'), derived], { encoding: 'utf8' });
    fs.writeFileSync(path.join(output, 'derivation.stdout.log'), result.stdout ?? '');
    fs.writeFileSync(path.join(output, 'derivation.stderr.log'), result.stderr ?? '');
    assert.equal(result.status, 0, result.stderr);
    const receipt = read(path.join(derived, 'preparation.json'));
    const derivationSha256 = hash(path.join(derived, 'preparation.json'));
    index.derivationSha256 = derivationSha256; save();
    const verifyInputs = () => {
      assert.equal(hash(path.join(derived, 'preparation.json')), derivationSha256);
      for (const [name, expected] of Object.entries(receipt.derivedFiles)) assert.equal(hash(path.join(derived, name)), expected);
      assert.deepEqual(sourceFiles(), files); assert.deepEqual(study.captureHarness(), harness);
      assert.deepEqual(study.inspectPreparation(preparation), manifest.preparationBefore);
    };
    const manifestPath = path.join(output, 'manifest.json'); write(manifestPath, manifest);
    verifyInputs();
    for (const [nodeIndex, node] of nodes.entries()) {
      const version = spawnSync(node, ['--version'], { encoding: 'utf8' });
      assert.equal(version.status, 0); assert.equal(version.stdout.trim(), settings.nodeVersions[nodeIndex]);
      assert.equal(hash(node), require('../constants/current-ownership.json').runtimeExecutableHashes[settings.nodeVersions[nodeIndex]]);
      const directory = path.join(output, `node${nodeIndex === 0 ? 22 : 24}`); fs.mkdirSync(directory);
      const commands = plan().map((input, position) => {
        const target = path.join(directory, String(position).padStart(3, '0'));
        return { input, node: settings.nodeVersions[nodeIndex], directory: target,
          argv: [node, ...worker.workerArguments(input.position), path.join(derived, 'worker.cjs'), manifestPath,
            input.phase, input.engine, String(input.position), input.label, path.join(target, 'report.json'), String(input.rowIndex)] };
      });
      execute(commands, index, output, (entry) => {
        validateReport(read(path.join(entry.directory, 'report.json')), manifest, entry.input, entry,
          read(path.join(entry.directory, 'report.json.integration.json')), derivationSha256);
      });
      verifyInputs();
    }
    assert.equal(index.processes.length, settings.nodeVersions.length * policy.workersPerNode);
    index.complete = true;
  } catch (error) { index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { index.finishedAt = new Date().toISOString(); save(); }
}
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 7, 'Provide original preparation, fresh output, source SHA, Node22 and Node24');
    const [preparation, output, sourceCommit, ...nodes] = process.argv.slice(2);
    run(path.resolve(preparation), path.resolve(output), sourceCommit, nodes);
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { sourceFiles, plan, validateReport, run };
