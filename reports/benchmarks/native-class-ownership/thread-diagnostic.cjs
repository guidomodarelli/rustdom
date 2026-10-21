/** @file Compares CPU brackets and affinity configurations on unchanged A packages; no candidate acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { prepare, fingerprint } = require('./paired-experiment.cjs');
const settings = require('./constants/paired.cjs');
const originalProtocol = require('./constants/hosted.cjs');
const method = require('./constants/thread.cjs');
const historicalMethod = require('./constants/thread-history.json');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Keep every observation; CPU belongs to the enclosing bracket, not an exact subdivision of the public timer. */
function summarize(entries, configuration = method) {
  const rows = [];
  for (const engine of ['rustdom', 'jsdom']) for (const size of settings.sizes) for (const mode of configuration.modesSupported) {
    const observations = entries.filter((entry) => entry.engine === engine && entry.mode === mode)
      .flatMap((entry) => entry.samples.filter((sample) => !sample.warmup && sample.size === size));
    assert.equal(observations.length, settings.measuredRounds * 2);
    rows.push({ engine, size, mode, samples: observations.length,
      medianPublicWallMs: median(observations.map((sample) => sample.elapsedMs)),
      medianThreadCpuBracketMs: median(observations.map((sample) => sample.timing.threadCpuEndMs - sample.timing.threadCpuStartMs)),
      medianOuterWallMs: median(observations.map((sample) => sample.timing.outerWallEndMs - sample.timing.outerWallStartMs)),
      medianBracketOverheadMs: median(observations.map((sample) => sample.timing.outerWallEndMs - sample.timing.outerWallStartMs - sample.elapsedMs)),
      medianNonMainCpuPercent: median(observations.map((sample) => {
        const wall = sample.timing.outerWallEndMs - sample.timing.outerWallStartMs;
        const cpu = sample.timing.threadCpuEndMs - sample.timing.threadCpuStartMs;
        return (wall - cpu) / wall * 100;
      })),
    });
  }
  return rows;
}

/** Recalculate output, order, masks, all scalar timestamps, release endpoints and method identity. */
function verify(directory) {
  const index = readJson(path.join(directory, 'index.json'));
  assert.equal(index.complete, true); assert.equal(index.failure, undefined);
  assert.equal(index.node, settings.nodeVersion); assert.equal(index.accepted, false);
  const configuration = index.method.revision === historicalMethod.revision ? historicalMethod : method;
  assert.deepEqual(index.method, configuration);
  for (const label of ['A', 'B']) assert.equal(index.packages.sources[label].sourceHash, originalProtocol.sourceHashes[label]);
  const expectedRuns = configuration.modes.flatMap((mode, block) => (block % 2 ? ['rustdom', 'jsdom'] : ['jsdom', 'rustdom'])
    .map((engine) => ({ block, mode, engine })));
  assert.deepEqual(index.runs.map(({ block, mode, engine }) => ({ block, mode, engine })), expectedRuns);
  for (const [filename, digest] of Object.entries(index.files)) assert.equal(hash(path.join(directory, filename)), digest, `Thread diagnostic changed: ${filename}`);
  const original = readJson(path.join(__dirname, 'hosted/39643090437/AA-01-A.json'));
  let measuredDurations = 0; let copiesIncludingWarmup = 0;
  const entries = index.runs.map((run) => {
    assert.equal(run.exitCode, 0);
    const report = readJson(path.join(directory, run.report));
    assert.equal(report.complete, true); assert.equal(report.failure, undefined);
    for (const field of ['engine', 'mode', 'block', 'pid']) assert.equal(report[field], run[field]);
    assert.equal(report.root, index.packages.copies[run.engine === 'rustdom' ? 'A0' : 'J0']);
    assert.equal(report.node, index.node); assert.deepEqual(report.execArgv, ['--expose-gc']);
    assert.equal(report.nodeOptionsPresent, false); assert.deepEqual(report.settings, settings); assert.deepEqual(report.method, configuration);
    for (const snapshot of [report.affinity.configured, report.affinity.final]) {
      assert.equal(snapshot.find((entry) => entry.tid === report.pid).mask, String(configuration.cpu));
      if (run.mode === 'process') assert.ok(snapshot.every((entry) => entry.disappeared || entry.mask === String(configuration.cpu)));
      else assert.ok(snapshot.some((entry) => !entry.disappeared && entry.mask !== String(configuration.cpu)));
    }
    const expected = [];
    for (const size of run.block % 2 ? [...settings.sizes].reverse() : settings.sizes) {
      for (const [warmup, count] of [[true, settings.warmupRounds], [false, settings.measuredRounds]]) {
        for (let round = 0; round < count; round++) expected.push({ size, warmup, round });
      }
    }
    assert.deepEqual(report.samples.map(({ size, warmup, round }) => ({ size, warmup, round })), expected);
    for (const sample of report.samples) {
      assert.equal(sample.complete, true); assert.equal(sample.result, settings.operations / 2);
      assert.equal(sample.outputHash, original.runs[0].workloads.find((row) => row.rows === sample.size).outputHash);
      assert.ok(Object.values(sample.timing).every((value) => Number.isFinite(value) && value >= 0));
      assert.ok(sample.timing.outerWallStartMs <= sample.timing.startMs);
      assert.ok(sample.timing.startMs < sample.timing.endMs && sample.timing.endMs <= sample.timing.outerWallEndMs);
      assert.ok(sample.timing.threadCpuStartMs <= sample.timing.threadCpuEndMs);
      assert.equal(sample.elapsedMs, sample.timing.endMs - sample.timing.startMs);
      assert.equal(sample.cleanupTrace.length, settings.cleanupRounds);
      for (const endpoint of sample.cleanupTrace.slice(-2)) {
        assert.deepEqual(endpoint.survivors, { window: false, document: false });
        if (run.engine === 'rustdom') assert.equal(endpoint.released.live, 0);
      }
      if (run.engine === 'rustdom') assert.equal(sample.after.created - sample.before.created, settings.operations);
      if (!sample.warmup) measuredDurations++;
      copiesIncludingWarmup += settings.operations;
    }
    return report;
  });
  const summaries = summarize(entries, configuration); assert.deepEqual(index.summaries, summaries);
  return { verified: true, processes: entries.length, measuredDurations, copiesIncludingWarmup, accepted: false, summaries };
}

/** Run a single predeclared P M M P sequence, preserving every partial worker and both streams. */
function run(candidateRoot, baselineRoot, outputArgument) {
  assert.equal(process.version, settings.nodeVersion); assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  const directory = path.resolve(outputArgument);
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  fs.mkdirSync(directory);
  const prepared = prepare(candidateRoot, baselineRoot);
  const clockPath = path.resolve(__dirname, 'thread-clock-addon/thread-clock.node');
  const index = { complete: false, startedAt: new Date().toISOString(), method, node: process.version, v8: process.versions.v8,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model,
      logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() },
    clock: { bytes: fs.statSync(clockPath).size, sha256: hash(clockPath) },
    packages: prepared.manifest, files: {}, runs: [], summaries: [], accepted: false };
  const save = () => fs.writeFileSync(path.join(directory, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  for (const filename of method.methodFiles) {
    const name = filename.replaceAll('/', '-');
    fs.copyFileSync(path.resolve(__dirname, '../../..', filename), path.join(directory, name));
    index.files[name] = hash(path.join(directory, name));
  }
  save();
  try {
    for (const [block, mode] of method.modes.entries()) for (const engine of block % 2 ? ['rustdom', 'jsdom'] : ['jsdom', 'rustdom']) {
      const prefix = `${block}-${mode}-${engine}`;
      const record = { block, mode, engine, report: `${prefix}.json`, stdout: `${prefix}.stdout.log`, stderr: `${prefix}.stderr.log` };
      index.runs.push(record); save(); process.stdout.write(`Thread diagnostic ${block + 1}/${method.modes.length} ${mode} ${engine}\n`);
      const stdout = fs.openSync(path.join(directory, record.stdout), 'wx');
      const stderr = fs.openSync(path.join(directory, record.stderr), 'wx');
      const workerArguments = [process.execPath, '--expose-gc', path.join(__dirname, 'thread-worker.cjs'), prepared.filename,
        engine, mode, String(block), clockPath, path.join(directory, record.report)];
      let result;
      try {
        result = mode === 'process'
          ? spawnSync('taskset', ['-c', String(method.cpu), ...workerArguments], { stdio: ['ignore', stdout, stderr], timeout: settings.workerTimeoutMs })
          : spawnSync(workerArguments[0], workerArguments.slice(1), { stdio: ['ignore', stdout, stderr], timeout: settings.workerTimeoutMs });
      } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
      Object.assign(record, { pid: result.pid, exitCode: result.status, signal: result.signal, error: result.error?.message ?? null });
      for (const filename of [record.report, record.stdout, record.stderr]) {
        if (fs.existsSync(path.join(directory, filename))) index.files[filename] = hash(path.join(directory, filename));
      }
      save(); assert.equal(result.status, 0, `Inspect failed thread diagnostic ${record.stderr}`);
    }
    for (const [label, root] of Object.entries(prepared.manifest.copies)) {
      assert.deepEqual(fingerprint(root, label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json']), prepared.manifest.distributions[label]);
    }
    const { captureSourceIdentity } = require(path.join(prepared.manifest.roots.B, 'benchmarks/sources.cjs'));
    for (const label of ['A', 'B']) assert.equal(captureSourceIdentity(prepared.manifest.roots[label]).sourceHash, prepared.manifest.sources[label].sourceHash);
    for (const filename of method.methodFiles) assert.equal(hash(path.resolve(__dirname, '../../..', filename)), index.files[filename.replaceAll('/', '-')]);
    assert.equal(hash(clockPath), index.clock.sha256);
    index.summaries = summarize(index.runs.map((run) => readJson(path.join(directory, run.report))));
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    process.stdout.write(JSON.stringify(verify(directory), null, 2) + '\n');
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) {
  if (process.argv[2] === '--verify') process.stdout.write(JSON.stringify(verify(path.resolve(process.argv[3])), null, 2) + '\n');
  else run(...process.argv.slice(2));
}
module.exports = { verify, summarize };
