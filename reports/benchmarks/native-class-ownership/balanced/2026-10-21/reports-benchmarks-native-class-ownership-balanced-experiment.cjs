/** @file Runs a bounded A/A diagnostic; calibration never constitutes acceptance of candidate performance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { prepare, fingerprint, summarize } = require('./paired-experiment.cjs');
const { schedule } = require('./balanced-worker.cjs');
const settings = require('./constants/paired.cjs');
const method = require('./constants/balanced.cjs');
const originalProtocol = require('./constants/hosted.cjs');
const readJson = (file) => JSON.parse(fs.readFileSync(file));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Reserve the final output directory atomically so concurrent invocations cannot overwrite evidence. */
function reserveOutputDirectory(directory) {
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  fs.mkdirSync(directory);
}

/** Verify every observation and factor assignment, retaining all warmups, samples and cleanup traces. */
function verify(directory) {
  const index = readJson(path.join(directory, 'index.json'));
  assert.equal(index.complete, true); assert.equal(index.failure, undefined); assert.deepEqual(index.method, method);
  assert.equal(index.node, settings.nodeVersion);
  for (const label of ['A', 'B']) assert.equal(index.packages.sources[label].sourceHash, originalProtocol.sourceHashes[label]);
  const expectedRuns = Array.from({ length: settings.workerCount }, (_, position) =>
    (position % 2 ? ['rustdom', 'jsdom'] : ['jsdom', 'rustdom']).map((engine) => ({ engine, position }))).flat();
  assert.deepEqual(index.runs.map(({ engine, position }) => ({ engine, position })), expectedRuns);
  const original = readJson(path.join(__dirname, 'hosted/39643090437/AA-01-A.json'));
  for (const [file, digest] of Object.entries(index.files)) assert.equal(sha256(path.join(directory, file)), digest, `Balanced evidence changed: ${file}`);
  let measuredDurations = 0; let copiesIncludingWarmup = 0;
  const entries = index.runs.map((run) => {
    assert.equal(run.exitCode, 0);
    const report = readJson(path.join(directory, run.report));
    const plan = schedule(index.packages, run.engine, run.position);
    assert.equal(report.complete, true); assert.equal(report.engine, run.engine); assert.equal(report.position, run.position);
    assert.equal(report.node, index.node); assert.deepEqual(report.settings, settings); assert.deepEqual(report.method, method);
    assert.deepEqual(report.schedule, plan); assert.deepEqual(report.execArgv, ['--expose-gc']); assert.equal(report.nodeOptionsPresent, false);
    assert.deepEqual(report.isolation, plan.loadOrder.map((label) => ({ label, text: 'isolation',
      ownCreated: run.engine === 'rustdom' ? 1 : null, otherCreated: run.engine === 'rustdom' ? 0 : null })));
    assert.deepEqual(report.samples.map(({ size, warmup, round, label }) => ({ size, warmup, round, label })), plan.observations);
    for (const observation of report.samples) {
      assert.equal(observation.complete, true); assert.equal(observation.result, settings.operations / 2);
      assert.equal(observation.outputHash, original.runs[0].workloads.find((row) => row.rows === observation.size).outputHash);
      assert.ok(Number.isFinite(observation.elapsedMs) && observation.elapsedMs > 0);
      assert.equal(observation.cleanupTrace.length, settings.cleanupRounds);
      assert.deepEqual(observation.survivors, observation.cleanupTrace.at(-1).survivors);
      assert.deepEqual(observation.released, observation.cleanupTrace.at(-1).released);
      for (const endpoint of observation.cleanupTrace.slice(-2)) {
        assert.deepEqual(endpoint.survivors, { window: false, document: false });
        if (run.engine === 'rustdom') assert.equal(endpoint.released.live, 0);
      }
      if (run.engine === 'rustdom') assert.equal(observation.after.created - observation.before.created, settings.operations);
      if (!observation.warmup) measuredDurations++;
      copiesIncludingWarmup += settings.operations;
    }
    return report;
  });
  const summaries = summarize(entries, 'AA');
  assert.deepEqual(index.summaries, summaries);
  const calibrated = summaries.every((row) => row.calibrated);
  assert.equal(index.calibrated, calibrated); assert.equal(index.accepted, false);
  assert.equal(index.packages.distributions.A0.sha256, index.packages.distributions.A1.sha256);
  assert.equal(index.packages.distributions.J0.sha256, index.packages.distributions.J1.sha256);
  return { verified: true, processes: entries.length, measuredDurations, copiesIncludingWarmup, calibrated, accepted: false, summaries };
}

/** Execute each factorial cell exactly once per engine; no A/B or retry is part of this protocol. */
function run(candidateRoot, baselineRoot, outputArgument, cpuArgument) {
  assert.equal(process.version, settings.nodeVersion);
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  assert.match(cpuArgument, /^\d+$/); assert.ok(Number.isSafeInteger(Number(cpuArgument)));
  const directory = path.resolve(outputArgument);
  assert.equal(fs.existsSync(directory), false, 'Preserve existing balanced diagnostic output');
  reserveOutputDirectory(directory);
  const prepared = prepare(candidateRoot, baselineRoot);
  const index = { complete: false, startedAt: new Date().toISOString(), method, node: process.version, v8: process.versions.v8,
    cpu: Number(cpuArgument), machine: { platform: os.platform(), arch: os.arch(), release: os.release(),
      cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() },
    packages: prepared.manifest, runs: [], files: {}, summaries: [], accepted: false };
  const save = () => fs.writeFileSync(path.join(directory, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  for (const file of method.methodFiles) {
    const archiveName = file.replaceAll('/', '-');
    fs.copyFileSync(path.resolve(__dirname, '../../..', file), path.join(directory, archiveName));
    index.files[archiveName] = sha256(path.join(directory, archiveName));
  }
  save();
  try {
    for (let position = 0; position < settings.workerCount; position++) {
      for (const engine of position % 2 ? ['rustdom', 'jsdom'] : ['jsdom', 'rustdom']) {
        const prefix = `AA-${position}-${engine}`;
        const record = { engine, position, report: `${prefix}.json`, stdout: `${prefix}.stdout.log`, stderr: `${prefix}.stderr.log` };
        index.runs.push(record); save();
        process.stdout.write(`Balanced A/A ${position + 1}/${settings.workerCount} ${engine}\n`);
        const stdout = fs.openSync(path.join(directory, record.stdout), 'wx');
        const stderr = fs.openSync(path.join(directory, record.stderr), 'wx');
        let result;
        try {
          result = spawnSync('taskset', ['-c', cpuArgument, process.execPath, '--expose-gc', path.join(__dirname, 'balanced-worker.cjs'),
            prepared.filename, engine, String(position), path.join(directory, record.report)],
          { stdio: ['ignore', stdout, stderr], timeout: settings.workerTimeoutMs });
        } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
        Object.assign(record, { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null });
        for (const file of [record.report, record.stdout, record.stderr]) {
          if (fs.existsSync(path.join(directory, file))) index.files[file] = sha256(path.join(directory, file));
        }
        save(); assert.equal(result.status, 0, `Inspect balanced diagnostic ${record.stderr}`);
      }
    }
    for (const [label, root] of Object.entries(prepared.manifest.copies)) {
      assert.deepEqual(fingerprint(root, label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json']), prepared.manifest.distributions[label]);
    }
    const { captureSourceIdentity } = require(path.join(prepared.manifest.roots.B, 'benchmarks/sources.cjs'));
    for (const label of ['A', 'B']) assert.equal(captureSourceIdentity(prepared.manifest.roots[label]).sourceHash, prepared.manifest.sources[label].sourceHash);
    for (const file of method.methodFiles) assert.equal(sha256(path.resolve(__dirname, '../../..', file)), index.files[file.replaceAll('/', '-')]);
    index.summaries = summarize(index.runs.map((record) => readJson(path.join(directory, record.report))), 'AA');
    index.calibrated = index.summaries.every((row) => row.calibrated);
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    process.stdout.write(`${JSON.stringify(verify(directory), null, 2)}\n`);
    if (!index.calibrated) process.exitCode = 1;
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) {
  if (process.argv[2] === '--verify') process.stdout.write(`${JSON.stringify(verify(path.resolve(process.argv[3])), null, 2)}\n`);
  else run(...process.argv.slice(2));
}
module.exports = { verify, reserveOutputDirectory };
