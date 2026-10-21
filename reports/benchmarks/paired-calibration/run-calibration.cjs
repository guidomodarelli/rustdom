'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const task = '/mnt/c/Users/guido/ghq/projects/rustdom';
const root = fs.readFileSync(task + '/.cache/paired-calibration-root.txt', 'utf8').trim();
const reference = fs.realpathSync('/home/guido/rustdom-element-collection-ffhkkq/baseline-engine');
const directory = root + '/reports/benchmarks/paired-calibration';
const { captureSourceIdentity } = require(root + '/benchmarks/sources.cjs');
const { getBenchmarkPlan } = require(root + '/benchmarks/workload-plan.cjs');
const { NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD } = require(root + '/benchmarks/constants/node-clone.cjs');
const sampling = require(root + '/benchmarks/constants/paired-sampling.cjs');
const supported = [...NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD, ...sampling.PAIRED_CONTROL_WORKLOADS];
const rows = getBenchmarkPlan().filter((row) => supported.includes(row.name)).map(({ name, size }) => ({ name, size }));
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const save = (file, value) => fs.writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2) + '\n');
function filesIn(directory_) {
  return fs.readdirSync(directory_, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory_, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}
function identity() {
  return { harness: captureSourceIdentity(root), testSha256: digest(root + '/tests/benchmarks/paired.spec.cjs'),
    engines: [reference, root].map((engineRoot) => ({ root: engineRoot,
      distribution: filesIn(engineRoot + '/dist').sort().map((file) => ({ path: path.relative(engineRoot, file), sha256: digest(file) })) })) };
}
async function run(executable) {
  const version = spawnSync(executable, ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0);
  const outputDirectory = directory + '/' + version.stdout.trim();
  const args = ['benchmarks/paired.cjs', '--first', reference, '--second', reference, '--aa', '--output', outputDirectory];
  const log = fs.openSync(path.join(directory, version.stdout.trim() + '.log'), 'wx');
  const command = { executable, args, cwd: root, nodeVersion: version.stdout.trim(), startedAt: new Date().toISOString() };
  save(version.stdout.trim() + '-command.json', command);
  const result = await new Promise((resolve) => {
    const child = spawn(executable, args, { cwd: root, stdio: ['ignore', log, log] });
    child.once('error', (error) => resolve({ error: { code: error.code, message: error.message } }));
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  fs.closeSync(log);
  save(version.stdout.trim() + '-command.json', { ...command, ...result, finishedAt: new Date().toISOString() });
  assert.equal(result.code, 0, JSON.stringify(result));
  const reports = fs.readdirSync(outputDirectory).filter((name) => name.endsWith('.json'));
  assert.equal(reports.length, 1);
  const reportFile = path.join(outputDirectory, reports[0]);
  const report = JSON.parse(fs.readFileSync(reportFile));
  assert.equal(report.complete, true);
  assert.equal(report.aa, true);
  assert.deepEqual(report.plan.rows, rows);
  const violations = report.rows.filter((row) => Math.abs(row.differencePercent) > 2 || row.pairDifferencesPercent.some((difference) => Math.abs(difference) > 5));
  const summary = { node: version.stdout.trim(), report: path.relative(root, reportFile),
    observations: report.pairs.reduce((count, pair) => count + pair.observations.length, 0),
    expectedObservations: rows.length * sampling.PAIRED_WORKER_PAIRS * 2 * (sampling.PAIRED_WARMUP_SAMPLES + sampling.PAIRED_MEASURED_SAMPLES),
    precisionPassed: violations.length === 0, violations, rows: report.rows,
    releaseEndpointsReached: report.pairs.every((pair) => pair.observations.every((sample) => sample.release.reached && sample.release.survivors.windows === 0 && sample.release.survivors.documents === 0)),
    cleanExits: report.pairs.every((pair) => pair.exits.every((exit) => exit.code === 0 && exit.signal === null)) };
  assert.equal(summary.observations, summary.expectedObservations);
  assert.equal(summary.releaseEndpointsReached, true); assert.equal(summary.cleanExits, true);
  save(version.stdout.trim() + '-summary.json', summary);
  console.log(JSON.stringify({ node: summary.node, observations: summary.observations, precisionPassed: summary.precisionPassed, violations }));
  return summary;
}
(async () => {
  fs.mkdirSync(directory, { recursive: true });
  assert.equal(fs.existsSync(directory + '/plan.json'), false, 'Never overwrite a completed or partial calibration');
  const before = identity();
  const native = before.engines[0].distribution.find((file) => file.path === 'dist/rustdom.node');
  assert.equal(native.sha256, '10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803');
  const plan = { capturedBeforeMeasurementAt: new Date().toISOString(), purpose: 'Diagnostic repeatability, never candidate acceptance',
    hypothesis: 'Adjacent ABBA/BAAB samples in persistent independent processes, longer warmup and bounded owner release reduce stage-order noise sufficiently to resolve the existing +5% per-row budget.',
    reference: { checkpoint: 'checkpoint-065-attribute-reads', commit: '271221abbfeafebebb7dd817b98fd559592696d3', root: reference, nativeSha256: native.sha256 },
    sampling: { warmupSamples: sampling.PAIRED_WARMUP_SAMPLES, measuredSamples: sampling.PAIRED_MEASURED_SAMPLES,
      workerPairs: sampling.PAIRED_WORKER_PAIRS, orders: sampling.PAIRED_BLOCK_ORDERS, rows },
    precisionCriterion: { allPooledAbsoluteMedianDifferencesAtMostPercent: 2, allWorkerPairAbsoluteMedianDifferencesAtMostPercent: 5,
      rationale: 'Require noise below the unchanged +5% regression budget before using this protocol for candidate acceptance; this is a diagnostic gate, not a relaxed product budget.' },
    decision: 'Run Node22 first. Run Node24 only if Node22 passes precision. A failed precision check forbids candidate acceptance or A/B repetition under this protocol; inspect preserved observations for the next distinct hypothesis.',
    loadPolicy: 'No builds, suites, compression, source hashing or other heavy task during the measured child. Artifact identity is captured before and after the child exits.',
    limits: 'One virtualized WSL2 host. Finite release checks do not prove universal absence of leaks. A/A establishes no Rust candidate speedup.' };
  save('plan.json', plan); save('artifacts-before.json', before);
  fs.copyFileSync(__filename, directory + '/run-calibration.cjs');
  const outcomes = [];
  try {
    const node22 = await run(task + '/.tools/node-22/bin/node'); outcomes.push(node22);
    if (node22.precisionPassed) outcomes.push(await run(task + '/.tools/node/bin/node'));
  } finally {
    const after = identity(); save('artifacts-after.json', after);
    assert.deepEqual(after, before, 'Measured sources or engine distributions changed during calibration');
    save('outcome.json', { capturedAt: new Date().toISOString(), identitiesUnchanged: true,
      runtimeOutcomes: outcomes.map(({ node, observations, precisionPassed }) => ({ node, observations, precisionPassed })),
      eligibleForCandidateComparison: outcomes.length === 2 && outcomes.every((outcome) => outcome.precisionPassed) });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
