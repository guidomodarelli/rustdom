/** @file Archives separate-process comparisons and recalculates the unchanged budget decision offline. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { isReleased } = require('../../../scripts/memory-endpoint.cjs');
const { createPairedStudy, runStudyCli } = require('./paired-main-experiment.cjs');
const { schedule: pairedSchedule } = require('./paired-main-worker.cjs');
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const preparation = require('./hosted-main-experiment.cjs');
const defaultSettings = require('./constants/single-package.cjs');
const defaultMethod = require('./constants/single-package-study.cjs');
const harnessRoot = path.resolve(__dirname, '../../..');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Bind independent scheduling to the same sampler, source checks and pooled-median estimator.
 * @param {object} options - Immutable settings and explicit method provenance.
 * @returns {object} Archive producer and offline verifier.
 */
function createSinglePackageStudy({ settings = defaultSettings, method = defaultMethod } = {}) {
  const shared = createPairedStudy({ settings, method, sourceHashes: method.sourceHashes });
  const { schedule, workerArguments } = createSinglePackageWorker(settings);
  /** Expand every declared pair into two adjacent, independently identified OS processes. */
  function processSchedule() {
    const sequence = [];
    for (const phase of settings.phases) for (let position = 0; position < settings.workerCount; position++) {
      const engines = position & (settings.engineLeadMask ?? 1) ? [...settings.engines].reverse() : settings.engines;
      for (const engine of engines) {
        const pair = pairedSchedule({ copies: {} }, phase, engine, position, settings);
        for (const label of pair.loadOrder) sequence.push({ phase, position, engine, label });
      }
    }
    return sequence;
  }

  /** Resolve evidence files strictly below the archive directory. */
  function archivePath(root, name) {
    const resolved = path.resolve(root, name);
    assert.ok(resolved.startsWith(`${path.resolve(root)}${path.sep}`), 'Single package: archive path escapes its directory');
    return resolved;
  }

  /** Require one complete real worker, unchanged treatment and actual release observations. */
  function validateWorker(report, manifest, expected) {
    assert.equal(report.complete, true); assert.equal(report.gateReevaluated, false);
    assert.equal(report.revision, settings.revision); assert.deepEqual(report.settings, settings);
    for (const key of ['node', 'phase', 'engine', 'position', 'label', 'pid']) assert.equal(report[key], expected[key]);
    assert.ok(settings.nodeVersions.includes(report.node));
    assert.deepEqual(report.execArgv, workerArguments(expected.position));
    if (settings.v8Seeds !== undefined) {
      assert.equal(report.v8Seed, settings.v8Seeds[expected.position]);
      assert.equal(report.randomProbe.length, settings.v8SeedProbeSamples);
      assert.ok(report.randomProbe.every((probeValue) => Number.isFinite(probeValue) && probeValue >= 0 && probeValue < 1));
    }
    const plan = schedule(manifest, expected.phase, expected.engine, expected.position, expected.label);
    assert.deepEqual(report.schedule, plan);
    for (const stage of ['initial', 'configured', 'final']) {
      const threads = stage === 'final' ? report.affinitiesAfter : report.affinity[stage];
      const main = threads.find((entry) => entry.tid === expected.pid && !entry.disappeared);
      assert.ok(main, `Single package: missing main thread at ${stage}`);
      if (stage === 'initial') assert.notEqual(main.mask, String(settings.cpu));
      else assert.equal(main.mask, String(settings.cpu));
      assert.ok(threads.some((entry) => entry.tid !== expected.pid && !entry.disappeared && entry.mask !== String(settings.cpu)));
    }
    for (const initial of report.affinity.initial.filter((entry) => entry.tid !== expected.pid && !entry.disappeared)) {
      const configured = report.affinity.configured.find((entry) => entry.tid === initial.tid && !entry.disappeared);
      if (configured) assert.equal(configured.mask, initial.mask, 'Single package: background affinity changed');
    }
    assert.deepEqual(report.distributionsBefore, report.distributionsAfter);
    const pair = pairedSchedule(manifest, expected.phase, expected.engine, expected.position, settings);
    for (const label of settings.labels) {
      shared.validateDistribution(report.distributionsBefore[label], settings.distributionHashes[pair.physical[label]]);
      assert.deepEqual(report.distributionsBefore[label], manifest.distributions[pair.physical[label]]);
    }
    for (const packages of [report.loadedBefore, report.loadedAfter]) {
      assert.deepEqual(Object.keys(packages).sort(), Object.keys(manifest.copies).sort());
      for (const [physical, filenames] of Object.entries(packages)) {
        assert.ok(Array.isArray(filenames));
        assert.equal(filenames.length > 0, physical === plan.physical, 'Single package: incorrect loaded runtime count');
        for (const filename of filenames) assert.ok(filename.startsWith(`${manifest.copies[physical]}${path.sep}`));
      }
    }
    if (expected.engine === 'rustdom') assert.ok(report.nativeBaseline);
    else assert.equal(report.nativeBaseline, undefined);
    assert.equal(report.batches.length, settings.rows.length);
    for (const [index, batch] of report.batches.entries()) {
      const input = plan.rows[index];
      assert.equal(batch.label, expected.label);
      for (const key of ['name', 'size']) assert.equal(batch[key], input[key]);
      assert.equal(batch.rows, input.size); assert.equal(batch.complete, true);
      assert.equal(batch.samplesMs.length, settings.measuredSamples);
      if (settings.warmupCurrentRealm) assert.equal(batch.withinRealmWarmupRounds, settings.withinRealmWarmupRounds);
      else assert.equal(Object.hasOwn(batch, 'withinRealmWarmupRounds'), false);
      if (settings.warmupGcOrder !== undefined) assert.equal(batch.withinRealmWarmupGcOrder, settings.warmupGcOrder);
      else assert.equal(Object.hasOwn(batch, 'withinRealmWarmupGcOrder'), false);
      assert.ok(batch.samplesMs.every((sample) => Number.isFinite(sample) && sample > 0));
      assert.match(batch.outputHash, /^[0-9a-f]{64}$/);
      assert.equal(batch.memoryAfterCleanup.length, settings.measuredSamples);
      const owners = (index + 1) * (settings.warmupSamples + settings.measuredSamples);
      assert.deepEqual(batch.trackedOwners, { window: owners, document: owners });
      assert.equal(batch.cleanupTrace.length, settings.cleanupRounds);
      for (const [round, endpoint] of batch.cleanupTrace.entries()) {
        const actual = isReleased(endpoint, report.nativeBaseline);
        assert.equal(endpoint.clear, actual, 'Single package: falsely declared resource endpoint');
        if (round >= settings.cleanupRounds - settings.requiredClearRounds) assert.equal(actual, true);
      }
    }
  }

  /**
   * Match the actual startup RNG prefix across both engines and labels at each fixed position.
   * @param {object[]} entries - Complete paired process observations, already validated individually.
   * @returns {void} Throws if a declared pair is incomplete or its observed RNG prefixes differ.
   * @throws {Error} When the phase/position group is incomplete or its matched processes have unequal RNG prefixes.
   */
  function validateSeedProbes(entries) {
    if (settings.v8Seeds === undefined) return;
    const groups = new Map();
    for (const entry of entries) {
      const key = `${entry.phase}/${entry.position}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    for (const [positionKey, group] of groups) {
      assert.equal(group.length, settings.engines.length * settings.labels.length,
        `Single package: incomplete seeded process group=${positionKey}`);
      assert.deepEqual(new Set(group.map((entry) => `${entry.engine}/${entry.label}`)),
        new Set(settings.engines.flatMap((engine) => settings.labels.map((label) => `${engine}/${label}`))));
      for (const entry of group) assert.deepEqual(entry.observation.randomProbe, group[0].observation.randomProbe,
        `Single package: startup RNG differs at phase=${entry.phase} position=${entry.position} engine=${entry.engine} label=${entry.label}`);
    }
  }

  /** Reuse the original pooled-median estimator, retaining each real child report separately. */
  function summarize(entries, phase) {
    const pairs = shared.processSchedule().filter((input) => input.phase === phase).map((input) => {
      const reports = entries.filter((entry) => entry.phase === input.phase && entry.engine === input.engine && entry.position === input.position);
      assert.equal(reports.length, settings.labels.length);
      assert.deepEqual(reports.map((entry) => entry.label).sort(), settings.labels);
      return { ...input, observation: { batches: reports.flatMap((entry) => entry.observation.batches) } };
    });
    return shared.summarize(pairs, phase);
  }

  /** Authenticate a full Node archive without loading DOM code or collecting any samples. */
  function verify(directory) {
    const root = path.resolve(directory); const index = readJson(path.join(root, 'index.json'));
    assert.equal(index.complete, true); assert.deepEqual(index.settings, settings); assert.deepEqual(index.method, method);
    assert.ok(settings.nodeVersions.includes(index.node));
    assert.deepEqual(index.preparationAfter, method.preparation.identity);
    assert.deepEqual(index.manifest.preparationBefore, method.preparation.identity);
    assert.deepEqual(index.manifest.preparation, method.preparation);
    assert.deepEqual(index.harnessAfter, index.harness); shared.verifyHarness(root, index.harness);
    assert.equal(index.provenance.harnessSha256, index.harness.sha256);
    assert.match(index.provenance.reviewedCommit, /^[0-9a-f]{40}$/);
    assert.ok(index.provenance.receiptUrl.startsWith('https://github.com/guidomodarelli/rustdom/'));
    assert.deepEqual(index.runs.map(({ phase, engine, position, label }) => ({ phase, engine, position, label })), processSchedule());
    const expectedFiles = [...index.harness.files.map((entry) => `harness/${entry.path}`), 'manifest.json',
      ...index.runs.flatMap((entry) => [entry.report, entry.stdout, entry.stderr])].sort();
    assert.deepEqual(Object.keys(index.files).sort(), expectedFiles);
    for (const [name, digest] of Object.entries(index.files)) assert.equal(hash(fs.readFileSync(archivePath(root, name))), digest);
    assert.deepEqual(readJson(path.join(root, 'manifest.json')), index.manifest);
    const entries = index.runs.map((entry) => {
      assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
      const observation = readJson(archivePath(root, entry.report));
      validateWorker(observation, index.manifest, { ...entry, node: index.node });
      return { ...entry, observation };
    });
    validateSeedProbes(entries);
    const summaries = Object.fromEntries(settings.phases.map((phase) => [phase, summarize(entries.filter((entry) => entry.phase === phase), phase)]));
    assert.deepEqual(summaries.AA.map((row) => row.outputHash), summaries.AB.map((row) => row.outputHash));
    assert.deepEqual(index.summaries, summaries);
    const accepted = summaries.AA.every((row) => row.calibrated) && summaries.AB.every((row) => row.withinBudget);
    assert.equal(index.accepted, accepted);
    return { verified: true, node: index.node, accepted, processes: entries.length,
      measuredDurations: entries.length * settings.rows.length * settings.measuredSamples, summaries };
  }

  /** Preserve a single complete sequence; errors stop it without retry or reconstruction. */
  function run(directory, outputArgument, provenanceArgument) {
    assert.equal(process.platform, 'linux'); assert.ok(settings.nodeVersions.includes(process.version));
    assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
    const requested = path.resolve(outputArgument);
    const output = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested));
    const preparedRoot = fs.realpathSync(directory);
    assert.ok(output !== preparedRoot && !output.startsWith(`${preparedRoot}${path.sep}`),
      'Single package: evidence must not modify the official preparation');
    assert.equal(fs.existsSync(output), false, 'Single package: preserve existing evidence');
    const manifest = preparation.createManifest(preparedRoot);
    const provenance = readJson(provenanceArgument); const harness = shared.captureHarness();
    fs.mkdirSync(output);
    const index = { complete: false, startedAt: new Date().toISOString(), settings, method, manifest, provenance, harness,
      node: process.version, v8: process.versions.v8, executable: process.execPath,
      machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model,
        logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() }, files: {}, runs: [], summaries: {} };
    const save = () => fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
    save();
    try {
      assert.equal(provenance.harnessSha256, harness.sha256, 'Single package: harness differs from reviewed sources');
      assert.match(provenance.reviewedCommit, /^[0-9a-f]{40}$/);
      assert.ok(provenance.receiptUrl.startsWith('https://github.com/guidomodarelli/rustdom/'));
      const manifestPath = path.join(output, 'manifest.json');
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
      index.files['manifest.json'] = hash(fs.readFileSync(manifestPath));
      for (const entry of harness.files) {
        const target = archivePath(output, `harness/${entry.path}`);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(harnessRoot, entry.path), target);
        index.files[`harness/${entry.path}`] = hash(fs.readFileSync(target));
      }
      shared.verifyHarness(output, harness); save();
      for (const input of processSchedule()) {
        const prefix = `${input.phase}-${input.position}-${input.engine}-${input.label}`;
        const entry = { ...input, report: `${prefix}.json`, stdout: `${prefix}.stdout.log`, stderr: `${prefix}.stderr.log` };
        index.runs.push(entry); save();
        process.stdout.write(`Single package ${process.version} ${prefix}\n`);
        const stdout = fs.openSync(path.join(output, entry.stdout), 'wx');
        let stderr; let result;
        try {
          stderr = fs.openSync(path.join(output, entry.stderr), 'wx');
          result = spawnSync(process.execPath, [...workerArguments(input.position), path.join(__dirname, method.workerFilename), manifestPath,
            input.phase, input.engine, String(input.position), input.label, path.join(output, entry.report)],
          { stdio: ['ignore', stdout, stderr], timeout: method.workerTimeoutMs });
        } finally { fs.closeSync(stdout); if (stderr !== undefined) fs.closeSync(stderr); }
        Object.assign(entry, { pid: result.pid, exitCode: result.status, signal: result.signal, error: result.error?.message ?? null });
        for (const name of [entry.report, entry.stdout, entry.stderr]) if (fs.existsSync(path.join(output, name))) {
          index.files[name] = hash(fs.readFileSync(path.join(output, name)));
        }
        save(); assert.equal(result.status, 0, `Single package: inspect failed worker ${entry.stderr}`);
        validateWorker(readJson(path.join(output, entry.report)), manifest, { ...entry, node: process.version });
      }
      const entries = index.runs.map((entry) => ({ ...entry, observation: readJson(path.join(output, entry.report)) }));
      validateSeedProbes(entries);
      index.summaries = Object.fromEntries(settings.phases.map((phase) => [phase, summarize(entries.filter((entry) => entry.phase === phase), phase)]));
      index.preparationAfter = preparation.inspectPreparation(preparedRoot);
      index.harnessAfter = shared.captureHarness(); assert.deepEqual(index.harnessAfter, harness);
      index.accepted = index.summaries.AA.every((row) => row.calibrated) && index.summaries.AB.every((row) => row.withinBudget);
      index.complete = true; index.finishedAt = new Date().toISOString(); save();
      const result = verify(output); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); return result;
    } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
  }

  /** Require both Nodes and the exact same preparation, harness and review identity. */
  function verifySet(directories) {
    assert.equal(directories.length, settings.nodeVersions.length);
    const results = directories.map(verify);
    assert.deepEqual(results.map((result) => result.node), settings.nodeVersions);
    const indices = directories.map((directory) => readJson(path.join(directory, 'index.json')));
    for (const index of indices.slice(1)) {
      assert.deepEqual(index.manifest, indices[0].manifest); assert.deepEqual(index.provenance, indices[0].provenance);
      assert.deepEqual(index.harness, indices[0].harness);
    }
    return { verified: true, accepted: results.every((result) => result.accepted), results };
  }
  return { captureHarness: shared.captureHarness, inspectPreparation: preparation.inspectPreparation,
    processSchedule, validateWorker, validateSeedProbes, summarize, run, verify, verifySet };
}

const study = createSinglePackageStudy();
if (require.main === module) runStudyCli(study);
module.exports = { ...study, createSinglePackageStudy };
