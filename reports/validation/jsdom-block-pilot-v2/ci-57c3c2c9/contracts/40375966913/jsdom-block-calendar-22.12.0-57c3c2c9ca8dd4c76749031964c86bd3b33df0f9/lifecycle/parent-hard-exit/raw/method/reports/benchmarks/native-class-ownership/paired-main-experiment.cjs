/** @file Runs one declared paired sequence and verifies archived workloads, resources, packages and source bytes offline. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const { isReleased } = require('../../../scripts/memory-endpoint.cjs');
const { fingerprint } = require('./paired-experiment.cjs');
const { median } = require('./main-affinity-experiment.cjs');
const { schedule, inspectDistributions } = require('./paired-main-worker.cjs');
const defaultSettings = require('./constants/paired-main.cjs');
const defaultMethod = require('./constants/paired-main-study.cjs');
const original = require('./constants/hosted.cjs');
const harnessRoot = path.resolve(__dirname, '../../..');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Bind immutable study identities while retaining the historical default verifier and CLI. */
function createPairedStudy({ settings = defaultSettings, method = defaultMethod,
  sourceHashes = original.sourceHashes, workerFilename = 'paired-main-worker.cjs' } = {}) {
  /** Declare all positions before observing either engine. Both engines lead four times in each phase. */
  function processSchedule() {
    return settings.phases.flatMap((phase) => Array.from({ length: settings.workerCount }, (_, position) =>
      (position % 2 ? [...settings.engines].reverse() : settings.engines).map((engine) => ({ phase, position, engine })))).flat();
  }

  /** Capture the full canonical harness scope and all report-side transitive code actually loaded. */
  function captureHarness(root = harnessRoot) {
    const identity = captureSourceIdentity(root);
    const names = [...new Set([...identity.measuredSources, ...method.methodFiles])].sort();
    const files = names.map((name) => {
      const bytes = fs.readFileSync(path.join(root, name));
      return { path: name, bytes: bytes.length, sha256: hash(bytes) };
    });
    return { identity, files, sha256: hash(JSON.stringify(files)) };
  }

  /** Recompute manifests independently of any claimed digest in the archive. */
  function validateDistribution(distribution, expected) {
    assert.equal(hash(JSON.stringify(distribution.files)), distribution.sha256, 'Paired study: inconsistent package manifest');
    assert.equal(distribution.sha256, expected, 'Paired study: unpinned package distribution');
  }

  /** Reject incomplete work, affinity changes, mismatched treatment and any falsely clear cleanup endpoint. */
  function validateWorker(report, manifest, expected) {
    assert.equal(report.complete, true); assert.equal(report.gateReevaluated, false);
    assert.equal(report.revision, settings.revision); assert.deepEqual(report.settings, settings);
    assert.equal(report.node, expected.node); assert.ok(settings.nodeVersions.includes(report.node));
    for (const key of ['phase', 'engine', 'position']) assert.equal(report[key], expected[key]);
    assert.deepEqual(report.execArgv, ['--expose-gc']);
    const plan = schedule(manifest, expected.phase, expected.engine, expected.position, settings);
    assert.deepEqual(report.schedule, plan);
    for (const stage of ['initial', 'configured', 'final']) {
      const threads = stage === 'final' ? report.affinitiesAfter : report.affinity[stage];
      const main = threads.find((entry) => entry.tid === expected.pid && !entry.disappeared);
      assert.ok(main, `Paired study: missing main thread at ${stage}`);
      if (stage === 'initial') assert.notEqual(main.mask, String(settings.cpu));
      else assert.equal(main.mask, String(settings.cpu));
      assert.ok(threads.some((entry) => entry.tid !== expected.pid && !entry.disappeared && entry.mask !== String(settings.cpu)));
    }
    for (const initial of report.affinity.initial.filter((entry) => entry.tid !== expected.pid && !entry.disappeared)) {
      const configured = report.affinity.configured.find((entry) => entry.tid === initial.tid && !entry.disappeared);
      if (configured) assert.equal(configured.mask, initial.mask, 'Paired study: background affinity changed');
    }
    assert.deepEqual(report.distributionsBefore, report.distributionsAfter);
    assert.deepEqual(report.isolation.map((entry) => entry.label), plan.loadOrder);
    for (const entry of report.isolation) {
      assert.equal(entry.text, 'isolation');
      assert.equal(entry.ownCreated, expected.engine === 'rustdom' ? 1 : null);
      assert.equal(entry.otherCreated, expected.engine === 'rustdom' ? 0 : null);
    }
    for (const label of ['A', 'B']) {
      const physical = plan.physical[label];
      validateDistribution(report.distributionsBefore[label], settings.distributionHashes[physical]);
      assert.deepEqual(report.distributionsBefore[label], manifest.distributions[physical]);
      if (expected.engine === 'rustdom') assert.ok(report.nativeBaselines[label]);
      else assert.equal(report.nativeBaselines[label], undefined);
    }
    assert.equal(report.batches.length, plan.batches.length);
    for (const [index, batch] of report.batches.entries()) {
      const input = plan.batches[index];
      for (const key of ['label', 'name', 'size']) assert.equal(batch[key], input[key]);
      assert.equal(batch.rows, input.size); assert.equal(batch.complete, true);
      assert.equal(batch.samplesMs.length, settings.measuredSamples); median(batch.samplesMs);
      assert.match(batch.outputHash, /^[0-9a-f]{64}$/);
      assert.equal(batch.memoryAfterCleanup.length, settings.measuredSamples);
      assert.equal(batch.cleanupTrace.length, settings.cleanupRounds);
      for (const [round, endpoint] of batch.cleanupTrace.entries()) for (const label of ['A', 'B']) {
        const actual = isReleased(endpoint[label], report.nativeBaselines[label]);
        assert.equal(endpoint[label].clear, actual, 'Paired study: falsely declared resource endpoint');
        if (round >= settings.cleanupRounds - settings.requiredClearRounds) assert.equal(actual, true);
      }
    }
    for (const key of settings.rows) {
      const pair = report.batches.filter((batch) => `${batch.name}/${batch.rows}` === key);
      assert.equal(pair.length, 2); assert.equal(pair[0].outputHash, pair[1].outputHash);
    }
  }

  /** Retain every measured duration, with processes counted separately from within-batch samples. */
  function summarize(entries, phase) {
    assert.ok(settings.phases.includes(phase));
    assert.deepEqual(entries.map(({ phase: entryPhase, position, engine }) => ({ phase: entryPhase, position, engine })),
      processSchedule().filter((entry) => entry.phase === phase));
    return settings.rows.map((key) => {
      const row = { key }; const hashes = new Set();
      for (const label of ['A', 'B']) {
        row[label] = {};
        for (const engine of settings.engines) {
          const batches = entries.filter((entry) => entry.engine === engine).map((entry) =>
            entry.observation.batches.find((batch) => batch.label === label && `${batch.name}/${batch.rows}` === key));
          assert.equal(batches.length, settings.workerCount);
          const samples = batches.flatMap((batch) => { hashes.add(batch.outputHash); return batch.samplesMs; });
          assert.equal(samples.length, settings.workerCount * settings.measuredSamples);
          row[label][engine] = { processCount: batches.length, count: samples.length, medianMs: median(samples),
            processMediansMs: batches.map((batch) => median(batch.samplesMs)) };
        }
      }
      assert.equal(hashes.size, 1, `Paired study: public output mismatch at ${key}`);
      row.outputHash = [...hashes][0];
      row.rustdomChangePercent = (row.B.rustdom.medianMs / row.A.rustdom.medianMs - 1) * 100;
      row.jsdomControlChangePercent = (row.B.jsdom.medianMs / row.A.jsdom.medianMs - 1) * 100;
      row.calibrated = Math.abs(row.jsdomControlChangePercent) <= settings.controlBudgetPercent &&
        (phase === 'AB' || Math.abs(row.rustdomChangePercent) <= settings.rustBudgetPercent);
      row.withinBudget = row.calibrated && row.rustdomChangePercent <= settings.rustBudgetPercent;
      return row;
    });
  }

  /** Restrict archive reads to files below the selected evidence directory. */
  function archivePath(root, relative) {
    const resolved = path.resolve(root, relative);
    assert.ok(resolved.startsWith(`${path.resolve(root)}${path.sep}`), 'Paired study: archive path escapes its directory');
    return resolved;
  }

  /** Verify source snapshots, not just a recorded sourceHash or the current checkout. */
  function verifyHarness(root, harness) {
    assert.equal(hash(JSON.stringify(harness.files)), harness.sha256);
    const canonical = createHash('sha256');
    for (const entry of harness.files) {
      const bytes = fs.readFileSync(archivePath(root, `harness/${entry.path}`));
      assert.equal(bytes.length, entry.bytes); assert.equal(hash(bytes), entry.sha256);
    }
    for (const name of harness.identity.measuredSources) {
      canonical.update(name).update('\0').update(fs.readFileSync(archivePath(root, `harness/${name}`))).update('\0');
    }
    assert.equal(canonical.digest('hex'), harness.identity.sourceHash);
    assert.deepEqual(harness.files.map((entry) => entry.path),
      [...new Set([...harness.identity.measuredSources, ...method.methodFiles])].sort());
  }

  /** Recalculate one full Node archive without loading either runtime or launching any workload. */
  function verify(outputArgument) {
    const root = path.resolve(outputArgument); const index = readJson(path.join(root, 'index.json'));
    assert.equal(index.complete, true); assert.deepEqual(index.settings, settings); assert.deepEqual(index.method, method);
    assert.ok(settings.nodeVersions.includes(index.node));
    assert.deepEqual(index.harness, index.harnessAfter); verifyHarness(root, index.harness);
    assert.equal(index.provenance.harnessSha256, index.harness.sha256);
    assert.match(index.provenance.reviewedCommit, /^[0-9a-f]{40}$/);
    assert.equal(index.provenance.receiptUrl.startsWith('https://github.com/guidomodarelli/rustdom/'), true);
    for (const label of ['A', 'B']) {
      assert.equal(index.sources[label].sourceHash, sourceHashes[label]);
      assert.equal(index.sourcesAfter[label].sourceHash, index.sources[label].sourceHash);
    }
    for (const [physical, distribution] of Object.entries(index.manifest.distributions)) {
      validateDistribution(distribution, settings.distributionHashes[physical]);
    }
    assert.deepEqual(index.runs.map(({ phase, position, engine }) => ({ phase, position, engine })), processSchedule());
    assert.equal(new Set(index.runs.map((entry) => entry.pid)).size, index.runs.length);
    const expectedFiles = [...index.harness.files.map((entry) => `harness/${entry.path}`),
      ...index.runs.flatMap((entry) => [entry.report, entry.stdout, entry.stderr])].sort();
    assert.deepEqual(Object.keys(index.files).sort(), expectedFiles);
    for (const [name, digest] of Object.entries(index.files)) assert.equal(hash(fs.readFileSync(archivePath(root, name))), digest);
    const summaries = {};
    for (const phase of settings.phases) {
      const entries = index.runs.filter((entry) => entry.phase === phase).map((entry) => {
        assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
        const observation = readJson(archivePath(root, entry.report));
        validateWorker(observation, index.manifest, { ...entry, node: index.node });
        return { ...entry, observation };
      });
      summaries[phase] = summarize(entries, phase);
    }
    assert.deepEqual(summaries.AA.map((row) => row.outputHash), summaries.AB.map((row) => row.outputHash));
    assert.deepEqual(index.summaries, summaries);
    const accepted = summaries.AA.every((row) => row.calibrated) && summaries.AB.every((row) => row.withinBudget);
    assert.equal(index.accepted, accepted);
    return { verified: true, node: index.node, processes: index.runs.length,
      measuredDurations: index.runs.length * settings.rows.length * 2 * settings.measuredSamples, accepted, summaries };
  }

  /** Reserve a fresh archive, fail preflight before starting workers, and preserve every completed observation. */
  function run(manifestArgument, outputArgument, provenanceArgument) {
    assert.equal(process.platform, 'linux'); assert.ok(settings.nodeVersions.includes(process.version));
    assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
    const output = path.resolve(outputArgument);
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.mkdirSync(output);
    const manifest = readJson(manifestArgument); const provenance = readJson(provenanceArgument);
    const harness = captureHarness();
    const index = { complete: false, startedAt: new Date().toISOString(), settings, method, manifest, provenance, harness,
      node: process.version, v8: process.versions.v8, executable: process.execPath,
      machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model,
        logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() }, files: {}, runs: [], summaries: {} };
    const save = () => fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
    save();
    try {
      assert.equal(provenance.harnessSha256, harness.sha256, 'Paired study: harness differs from reviewed sources');
      assert.match(provenance.reviewedCommit, /^[0-9a-f]{40}$/);
      assert.ok(provenance.receiptUrl.startsWith('https://github.com/guidomodarelli/rustdom/'));
      index.sources = Object.fromEntries(['A', 'B'].map((label) => [label, captureSourceIdentity(manifest.roots[label])]));
      for (const label of ['A', 'B']) assert.equal(index.sources[label].sourceHash, sourceHashes[label]);
      assert.equal(manifest.referenceVersion, '27.4.0');
      for (const engine of settings.engines) for (const phase of settings.phases) for (const position of [0, 2]) {
        inspectDistributions(manifest, schedule(manifest, phase, engine, position, settings), engine, settings);
      }
      for (const entry of harness.files) {
        const target = archivePath(output, `harness/${entry.path}`);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(harnessRoot, entry.path), target);
        index.files[`harness/${entry.path}`] = hash(fs.readFileSync(target));
      }
      verifyHarness(output, harness); save();
      for (const input of processSchedule()) {
        const prefix = `${input.phase}-${input.position}-${input.engine}`;
        const entry = { ...input, report: `${prefix}.json`, stdout: `${prefix}.stdout.log`, stderr: `${prefix}.stderr.log` };
        index.runs.push(entry); save();
        process.stdout.write(`Paired main ${process.version} ${prefix}\n`);
        const stdout = fs.openSync(path.join(output, entry.stdout), 'wx');
        let stderr;
        let result;
        try {
          stderr = fs.openSync(path.join(output, entry.stderr), 'wx');
          result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, workerFilename),
            path.resolve(manifestArgument), input.phase, input.engine, String(input.position), path.join(output, entry.report)],
          { stdio: ['ignore', stdout, stderr], timeout: method.workerTimeoutMs });
        } finally { fs.closeSync(stdout); if (stderr !== undefined) fs.closeSync(stderr); }
        Object.assign(entry, { pid: result.pid, exitCode: result.status, signal: result.signal, error: result.error?.message ?? null });
        for (const name of [entry.report, entry.stdout, entry.stderr]) if (fs.existsSync(path.join(output, name))) {
          index.files[name] = hash(fs.readFileSync(path.join(output, name)));
        }
        save(); assert.equal(result.status, 0, `Paired study: inspect failed worker ${entry.stderr}`);
        validateWorker(readJson(path.join(output, entry.report)), manifest, { ...entry, node: process.version });
      }
      for (const phase of settings.phases) index.summaries[phase] = summarize(index.runs.filter((entry) => entry.phase === phase)
        .map((entry) => ({ ...entry, observation: readJson(path.join(output, entry.report)) })), phase);
      index.sourcesAfter = Object.fromEntries(['A', 'B'].map((label) => [label, captureSourceIdentity(manifest.roots[label])]));
      for (const label of ['A', 'B']) assert.equal(index.sourcesAfter[label].sourceHash, index.sources[label].sourceHash);
      for (const engine of settings.engines) for (const phase of settings.phases) for (const position of [0, 2]) {
        inspectDistributions(manifest, schedule(manifest, phase, engine, position, settings), engine, settings);
      }
      index.harnessAfter = captureHarness(); assert.deepEqual(index.harnessAfter, harness);
      index.accepted = index.summaries.AA.every((row) => row.calibrated) && index.summaries.AB.every((row) => row.withinBudget);
      index.complete = true; index.finishedAt = new Date().toISOString(); save();
      const verified = verify(output); process.stdout.write(`${JSON.stringify(verified, null, 2)}\n`);
      return verified;
    } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
  }

  /** Require both Node archives and identical source/runtime identities before reporting global acceptance. */
  function verifySet(directories) {
    assert.equal(directories.length, settings.nodeVersions.length);
    const results = directories.map(verify);
    assert.deepEqual(results.map((result) => result.node), settings.nodeVersions);
    const indices = directories.map((directory) => readJson(path.join(directory, 'index.json')));
    for (const index of indices.slice(1)) {
      assert.equal(index.harness.sha256, indices[0].harness.sha256);
      assert.deepEqual(index.manifest, indices[0].manifest); assert.deepEqual(index.provenance, indices[0].provenance);
    }
    return { verified: true, accepted: results.every((result) => result.accepted), results };
  }
  return { processSchedule, captureHarness, validateDistribution, validateWorker, summarize, verifyHarness, verify, verifySet, run };
}

const defaultStudy = createPairedStudy();

/** Preserve the real CLI's integrity and budget exit codes for each explicitly bound study. */
function runStudyCli(study, arguments_ = process.argv.slice(2)) {
  try {
    if (arguments_[0] === '--verify') process.stdout.write(`${JSON.stringify(study.verify(arguments_[1]), null, 2)}\n`);
    else if (arguments_[0] === '--verify-set') process.stdout.write(`${JSON.stringify(study.verifySet(arguments_.slice(1)), null, 2)}\n`);
    else { const result = study.run(...arguments_); if (!result.accepted) process.exitCode = 1; }
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
if (require.main === module) runStudyCli(defaultStudy);
module.exports = { ...defaultStudy, createPairedStudy, runStudyCli };
