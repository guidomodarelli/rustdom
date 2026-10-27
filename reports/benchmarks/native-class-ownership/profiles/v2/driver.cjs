/** @file Profiles the existing public Range workload with markers added only after each timer stops. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const [candidate, baseline, executable, outputRoot] = process.argv.slice(2).map((value) => path.resolve(value));
assert.deepEqual(fs.readdirSync(outputRoot), [], 'Use a new, empty diagnostic directory');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const original = fs.readFileSync(path.join(candidate, 'benchmarks/worker.cjs'), 'utf8');
const timerEnd = 'elapsed = performance.now() - start;';
const marker = '\n      if (name === "range-control-1000") performance.measure(`rustdom-ownership-sample:${size}:${sample}`, { start, duration: elapsed });';
const calibrationSource = `
function profileClockCalibration() {
  const beforeNs = process.hrtime.bigint().toString();
  const performanceMs = performance.now();
  const afterNs = process.hrtime.bigint().toString();
  return { beforeNs, performanceMs, afterNs };
}
const profileClockStart = Array.from({ length: 3 }, profileClockCalibration);
`;
const instrumented = original.replaceAll(timerEnd, `${timerEnd}${marker}`)
  .replace("const { performance } = require('node:perf_hooks');", `const { performance } = require('node:perf_hooks');${calibrationSource}`)
  .replace('measuredSamples: MEASURED_SAMPLES, workloads, parserStatistics, nativeTreeStatistics }));',
    `measuredSamples: MEASURED_SAMPLES, workloads, parserStatistics, nativeTreeStatistics,
    profileClockCalibrations: [...profileClockStart, ...Array.from({ length: 3 }, profileClockCalibration)],
    profileMarkers: performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith('rustdom-ownership-sample:'))
      .map((entry) => ({ name: entry.name, startTime: entry.startTime, duration: entry.duration })) }));`);
assert.notEqual(instrumented, original, 'The diagnostic must emit timing marks');
const workspace = path.join(outputRoot, 'workspace');
fs.mkdirSync(workspace);
fs.cpSync(path.join(candidate, 'benchmarks'), path.join(workspace, 'benchmarks'), { recursive: true });
for (const name of ['node_modules', 'src', 'scripts', 'tests', 'dist']) fs.symlinkSync(path.join(candidate, name), path.join(workspace, name), 'dir');
const workerPath = path.join(workspace, 'benchmarks/worker.cjs');
fs.writeFileSync(workerPath, instrumented);
fs.writeFileSync(path.join(outputRoot, 'worker-original.cjs'), original);
fs.writeFileSync(path.join(outputRoot, 'worker-instrumented.cjs'), instrumented);
const { captureSourceIdentity } = require(path.join(candidate, 'benchmarks/sources.cjs'));
const sources = { A: captureSourceIdentity(baseline), B: captureSourceIdentity(candidate) };
const binaries = { A: sha256(fs.readFileSync(path.join(baseline, 'dist/rustdom.node'))),
  B: sha256(fs.readFileSync(path.join(candidate, 'dist/rustdom.node'))) };
const index = { schemaVersion: 1, diagnosticVersion: 2, startedAt: new Date().toISOString(), complete: false,
  diagnosticOnly: true, order: ['A', 'B', 'B', 'A'], affinity: [2], executable, candidate, baseline,
  sources, binaries, driverSha256: sha256(fs.readFileSync(__filename)),
  originalWorkerSha256: sha256(Buffer.from(original)), instrumentedWorkerSha256: sha256(Buffer.from(instrumented)),
  timerMarkersInserted: original.split(timerEnd).length - 1,
  traceCategories: 'v8,v8.execute,v8.compile,disabled-by-default-v8.compile,node.perf.usertiming', runs: [] };
const save = () => fs.writeFileSync(path.join(outputRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
save();
try {
  const hashes = new Map();
  for (const [position, label] of index.order.entries()) {
    const prefix = `${position + 1}-${label}`;
    const runtimeRoot = label === 'A' ? baseline : candidate;
    const stdoutPath = path.join(outputRoot, `${prefix}.stdout.log`);
    const stderrPath = path.join(outputRoot, `${prefix}.stderr.log`);
    const profilePath = path.join(outputRoot, `${prefix}.cpuprofile`);
    const tracePath = path.join(outputRoot, `${prefix}.trace.json`);
    const command = ['-c', '2', executable, '--expose-gc', '--cpu-prof', `--cpu-prof-dir=${outputRoot}`,
      `--cpu-prof-name=${path.basename(profilePath)}`, `--trace-event-categories=${index.traceCategories}`,
      `--trace-event-file-pattern=${tracePath}`, workerPath, 'rustdom', 'range-control-1000'];
    const run = { position: position + 1, label, complete: false, runtimeRoot, binarySha256: binaries[label],
      command: ['taskset', ...command], stdout: path.basename(stdoutPath), stderr: path.basename(stderrPath),
      profile: path.basename(profilePath), trace: path.basename(tracePath), startedAt: new Date().toISOString() };
    index.runs.push(run); save(); process.stdout.write(`Range profile ${position + 1}/4 ${label}\n`);
    const stdout = fs.openSync(stdoutPath, 'wx');
    const stderr = fs.openSync(stderrPath, 'wx');
    let result;
    try {
      result = spawnSync('taskset', command, { cwd: workspace, timeout: 600_000,
        env: { ...process.env, PATH: `${path.dirname(executable)}:${process.env.PATH}`, RUSTDOM_BENCHMARK_PACKAGE: runtimeRoot },
        stdio: ['ignore', stdout, stderr] });
    } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
    Object.assign(run, { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
      finishedAt: new Date().toISOString() }); save();
    assert.equal(result.status, 0, `Profile failed; inspect ${stderrPath}`);
    const report = JSON.parse(fs.readFileSync(stdoutPath, 'utf8'));
    assert.equal(report.engine, 'rustdom'); assert.equal(report.warmupSamples, 3); assert.equal(report.measuredSamples, 9);
    assert.equal(report.profileMarkers.length, 24, 'Export every warmup and measured timing interval');
    assert.equal(report.profileClockCalibrations.length, 6, 'Calibrate the shared monotonic clock at both ends');
    assert.deepEqual(report.workloads.map((row) => row.rows).sort((left, right) => left - right), [250, 1000]);
    for (const row of report.workloads) {
      assert.equal(row.name, 'range-control-1000'); assert.equal(row.samplesMs.length, 9);
      for (let sample = 0; sample < 9; sample++) {
        const mark = report.profileMarkers.find((entry) => entry.name === `rustdom-ownership-sample:${row.rows}:${sample + 3}`);
        assert.equal(mark.duration, row.samplesMs[sample], 'The exported marker must equal the measured public operation');
      }
      if (hashes.has(row.rows)) assert.equal(row.outputHash, hashes.get(row.rows));
      else hashes.set(row.rows, row.outputHash);
    }
    assert.ok(fs.statSync(profilePath).size > 0); assert.ok(fs.statSync(tracePath).size > 0);
    run.complete = true; save();
  }
  assert.equal(captureSourceIdentity(candidate).sourceHash, sources.B.sourceHash);
  assert.equal(captureSourceIdentity(baseline).sourceHash, sources.A.sourceHash);
  assert.equal(sha256(fs.readFileSync(path.join(candidate, 'dist/rustdom.node'))), binaries.B);
  assert.equal(sha256(fs.readFileSync(path.join(baseline, 'dist/rustdom.node'))), binaries.A);
  index.complete = true; index.finishedAt = new Date().toISOString(); save();
  process.stdout.write(`Range profiles complete: ${outputRoot}\n`);
} catch (error) {
  index.failure = { message: error.message, stack: error.stack, at: new Date().toISOString() }; save(); throw error;
}
