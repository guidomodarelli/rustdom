'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = process.cwd(), baseline = fs.realpathSync(process.argv[2]);
const settings = require(path.join(root, 'benchmarks/constants/xml-serializer-controller.cjs'));
const directory = path.join(root, 'reports/benchmarks/xml-serializer-controller/warmup-256', process.version);
const plan = require(path.join(root, 'benchmarks/workload-plan.cjs')).getBenchmarkPlan().filter(({ name }) =>
  ['xml-serialize', 'xml-inner-serialize', 'xml-document-serialize', 'xml-serialize-error', settings.XML_SERIALIZER_GETTER_ERROR_WORKLOAD].includes(name));
assert.equal(plan.length, 13);
fs.mkdirSync(directory, { recursive: true });
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const median = (values) => { const ordered = [...values].sort((left, right) => left - right); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; };
const report = { capturedAt: new Date().toISOString(), node: process.version, jsdom: require('jsdom/package.json').version,
  baseline, candidate: root, baselineBinary: digest(baseline + '/dist/rustdom.node'), candidateBinary: digest(root + '/dist/rustdom.node'),
  platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model, logicalCpus: os.cpus().length,
  totalMemoryBytes: os.totalmem(), rustc: spawnSync('rustc', ['-Vv'], { encoding: 'utf8' }).stdout?.trim() || null,
  candidateBuild: JSON.parse(fs.readFileSync(root + '/dist/native-build.json', 'utf8')),
  baselineBuild: JSON.parse(fs.readFileSync(baseline + '/dist/native-build.json', 'utf8')),
  dependencyLockSha256: digest(root + '/package-lock.json'),
  affinity: 2, isolation: 'One row per process; fixed sixteen-process balanced labels; 256 warmup batches for sizes 1/16',
  phaseOrder: settings.XML_SERIALIZER_WARMUP_PHASE_ORDER, settings,
  sourceIdentity: require(path.join(root, 'benchmarks/sources.cjs')).captureSourceIdentity(root),
  runs: [], calibration: null, comparisons: [], complete: false };
const save = () => fs.writeFileSync(path.join(directory, 'experiment.json'), JSON.stringify(report, null, 2) + '\n');
/** Run one actual public workload process; stdout, stderr and failures survive independently. */
function worker(stage, label, runtimeRoot, row, engine = 'rustdom') {
  const ordinal = report.runs.length;
  const startedAt = new Date().toISOString();
  const rowKey = `${row.name}/${row.size}`;
  const result = spawnSync('taskset', ['-c', '2', process.execPath, '--expose-gc', 'benchmarks/xml-controller-worker.cjs', engine, rowKey], {
    cwd: root, encoding: 'utf8', timeout: settings.XML_SERIALIZER_BENCHMARK_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, RUSTDOM_BENCHMARK_PACKAGE: runtimeRoot } });
  const prefix = `${stage}-${ordinal}-${label}`;
  fs.writeFileSync(path.join(directory, prefix + '.stdout.json'), result.stdout || '');
  fs.writeFileSync(path.join(directory, prefix + '.stderr.log'), result.stderr || '');
  const record = { stage, label, rowKey, engine, runtimeRoot, startedAt, finishedAt: new Date().toISOString(), exitCode: result.status,
    signal: result.signal, error: result.error?.message ?? null, stdoutFile: prefix + '.stdout.json', stderrFile: prefix + '.stderr.log' };
  report.runs.push(record); save();
  assert.equal(result.status, 0, `${prefix}: ${result.error?.message ?? result.stderr}`);
  const observations = JSON.parse(result.stdout);
  assert.equal(observations.results.length, 1);
  assert.equal(`${observations.results[0].name}/${observations.results[0].size}`, rowKey);
  record.observations = observations; save();
  process.stderr.write(`${process.version} ${prefix}: ${rowKey} completed\n`);
}
/** Preserve every observation; summarize normalized batch durations by the declared labels. */
function compare(stage) {
  return plan.map((row) => {
    const runs = report.runs.filter((run) => run.stage === stage && run.rowKey === `${row.name}/${row.size}`);
    const samples = { A: [], B: [] }, phases = [];
    for (const run of runs) {
      const observed = run.observations.results[0];
      assert.equal(`${observed.name}/${observed.size}`, `${row.name}/${row.size}`);
      assert.equal(observed.outputHash, runs[0].observations.results[0].outputHash, 'Independent engines/stages must produce identical complete outputs');
      const normalized = observed.measuredBatchMs.map((value) => value / observed.batchSize);
      samples[run.label].push(...normalized);
      phases.push({ label: run.label, medianMs: median(normalized), firstHalfMs: median(normalized.slice(0, 16)), lastHalfMs: median(normalized.slice(16)) });
    }
    const baselineMs = median(samples.A), candidateMs = median(samples.B);
    return { name: row.name, size: row.size, baselineMs, candidateMs, changePercent: (candidateMs / baselineMs - 1) * 100,
      samplesPerLabel: { A: samples.A.length, B: samples.B.length }, outputHash: runs[0].observations.results[0].outputHash, phases };
  });
}
try {
  save();
  for (const row of plan) for (const label of settings.XML_SERIALIZER_WARMUP_PHASE_ORDER) worker('AA', label, baseline, row);
  const calibration = compare('AA');
  report.calibration = { rows: calibration, budgetPercent: settings.XML_SERIALIZER_CALIBRATION_BUDGET_PERCENT,
    pass: calibration.every((row) => Math.abs(row.changePercent) <= settings.XML_SERIALIZER_CALIBRATION_BUDGET_PERCENT) };
  save();
  if (report.calibration.pass) {
    for (const row of plan) for (const label of settings.XML_SERIALIZER_WARMUP_PHASE_ORDER) worker('AB', label, label === 'A' ? baseline : root, row);
    report.comparisons = compare('AB');
    report.regressionBudgetPercent = settings.XML_SERIALIZER_REGRESSION_BUDGET_PERCENT;
    report.accepted = report.comparisons.every((row) => row.changePercent <= settings.XML_SERIALIZER_REGRESSION_BUDGET_PERCENT);
    save();
  } else report.accepted = null;
  if (report.calibration.pass) {
    for (const row of plan) for (const label of ['A', 'B', 'B', 'A']) worker('reference', label, root, row, label === 'A' ? 'jsdom' : 'rustdom');
    report.referenceComparison = compare('reference');
  }
  report.complete = true; save();
  process.stdout.write(JSON.stringify({ node: report.node, calibrated: report.calibration.pass, accepted: report.accepted, directory }) + '\n');
  if (!report.calibration.pass) process.exitCode = 2;
} catch (error) { report.failure = { name: error.name, message: error.message }; save(); throw error; }
