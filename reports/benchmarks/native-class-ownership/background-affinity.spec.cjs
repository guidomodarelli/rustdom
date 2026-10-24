/** @file Qualifies disjoint auxiliary affinity using the five actual packaged DOM runtimes. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const study = require('./background-affinity-experiment.cjs');
const legacy = require('./row-isolation-experiment.cjs');
const worker = require('./background-affinity-worker.cjs');
const settings = require('./constants/background-affinity.cjs');
const method = require('./constants/background-affinity-study.cjs');
const original = require('./constants/row-isolation.cjs');
const preparation = require('./hosted-main-experiment.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
const prior = process.env.RUSTDOM_PRIOR_ROW_ARCHIVE;
const output = process.env.RUSTDOM_BACKGROUND_AFFINITY_TEST_OUTPUT;
assert.ok(archive && prior && output, 'Set official preparation, complete prior row archive and fresh test output');
const manifest = preparation.createManifest(archive);
const manifestPath = path.join(output, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
const inputs = [
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'B' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'B' },
  { phase: 'AB', engine: 'rustdom', position: 15, label: 'B' },
];
const reports = [];

/**
 * Exercise the actual published worker CLI, retaining stdout/stderr and process status.
 * @param {object} input - Declared public process identity and canonical row.
 * @param {string} prefix - Fresh receipt filename prefix.
 * @param {object} [options] - Explicit argument/output/bootstrap negative case.
 * @returns {object} Actual child result and report pathname, without interpreting timings.
 */
function execute(input, prefix, options = {}) {
  const filename = options.filename ?? path.join(output, `${prefix}.json`);
  const rowArguments = options.rowArguments ?? [String(input.rowIndex)];
  const argumentsList = [...worker.workerArguments(input.position), path.join(__dirname, method.workerFilename), manifestPath,
    input.phase, input.engine, String(input.position), input.label, filename, ...rowArguments];
  const command = options.bootstrapMask ? 'taskset' : process.execPath;
  const actualArguments = options.bootstrapMask ? ['--cpu-list', options.bootstrapMask, process.execPath, ...argumentsList] : argumentsList;
  const child = spawnSync(command, actualArguments, { encoding: 'utf8', timeout: method.workerTimeoutMs });
  fs.writeFileSync(path.join(output, `${prefix}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(output, `${prefix}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(output, `${prefix}.process.json`), `${JSON.stringify({
    command: [command, ...actualArguments], pid: child.pid, exitCode: child.status,
    signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.ifError(child.error);
  return { child, filename };
}

test('the declared intervention retains the full process schedule, flags and budgets', () => {
  assert.deepEqual(study.processSchedule(), legacy.processSchedule());
  assert.equal(study.processSchedule().length, 1024);
  const { revision: unusedRevision, affinityRevision: unusedAffinityRevision,
    initialCpuList: unusedInitialCpuList, backgroundCpuList: unusedBackgroundCpuList, ...unchanged } = settings;
  const { revision: unusedOriginalRevision, ...originalSettings } = original;
  assert.deepEqual(unchanged, originalSettings);
  for (let position = 0; position < settings.workerCount; position++) {
    assert.deepEqual(worker.workerArguments(position), require('./row-isolation-worker.cjs').workerArguments(position));
  }
});

test('both consumed row-isolation rejections retain their original complete summaries', () => {
  const directories = ['node-22', 'node-24'].map((label) => path.join(prior, label));
  const result = legacy.verifySet(directories);
  assert.equal(result.verified, true); assert.equal(result.accepted, false);
  assert.deepEqual(result.results.map((entry) => entry.processes), [1024, 1024]);
  assert.deepEqual(result.results.map((entry) => entry.measuredDurations), [9216, 9216]);
  const rejectedControls = result.results.flatMap((entry) => Object.values(entry.summaries).flat())
    .filter((row) => Math.abs(row.jsdomControlChangePercent) > settings.controlBudgetPercent);
  assert.equal(rejectedControls.length, 7);
  assert.throws(() => study.verifySet(directories));
});

for (const input of inputs) {
  test(`all eight public rows retain output and resources with disjoint threads for ${input.phase}/${input.engine}/${input.position}/${input.label}`, () => {
    const sequence = study.processSchedule().filter((entry) => Object.entries(input).every(([key, value]) => entry[key] === value));
    assert.equal(sequence.length, 8);
    for (const entry of sequence) {
      const prefix = `${entry.phase}-${entry.engine}-${entry.position}-${entry.label}-row-${entry.rowIndex}`;
      const { child, filename } = execute(entry, prefix);
      assert.equal(child.status, 0, child.stderr);
      const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
      study.validateWorker(report, manifest, { ...entry, node: process.version, pid: child.pid });
      reports.push(report);
    }
  });
}

test('all five actual copies preserve oracle hashes, matched entropy and separate pre-exit owners', () => {
  assert.equal(reports.length, 40);
  assert.equal(new Set(reports.map((report) => report.schedule.physical)).size, 5);
  for (const report of reports) {
    const batch = report.batches[0];
    const oracle = JSON.parse(fs.readFileSync(path.join(prior, `node-22/AA-0-jsdom-A-row-${report.rowIndex}.json`), 'utf8'));
    assert.equal(batch.outputHash, oracle.batches[0].outputHash);
    assert.deepEqual(batch.trackedOwners, { window: 12, document: 12 });
    assert.ok(batch.cleanupTrace.slice(-settings.requiredClearRounds).every((endpoint) => endpoint.clear));
  }
  study.validateSeedProbes(reports.filter((report) => report.phase === 'AA').map((report) => ({ ...report, observation: report })));
});

test('overlapping, missing, duplicate, changed and falsely clear real observations are rejected', () => {
  const report = reports[0];
  const expected = { ...inputs[0], rowIndex: report.rowIndex, pid: report.pid, node: process.version };
  for (const mutate of [
    (altered) => { delete altered.backgroundAffinity; },
    (altered) => { altered.backgroundAffinity.configured[1].mask = settings.initialCpuList; },
    (altered) => { altered.affinity.initial[1].mask = settings.initialCpuList; },
    (altered) => { altered.affinitiesAfter[1].mask = String(settings.cpu); },
    (altered) => { altered.backgroundAffinity.final[1].mask = settings.initialCpuList; },
    (altered) => { altered.backgroundAffinity.final.push({ ...altered.backgroundAffinity.final[1], tid: 999999 }); },
    (altered) => { altered.backgroundAffinity.configured.splice(0, 1); },
    (altered) => { altered.backgroundAffinity.final[1].disappeared = true; },
    (altered) => { altered.backgroundAffinity.final[1].tid = altered.backgroundAffinity.final[0].tid; },
    (altered) => { altered.batches[0].cleanupTrace.at(-1).survivors.window++; },
    (altered) => { altered.batches[0].cleanupTrace.at(-1).survivors.document++; },
  ]) {
    const altered = structuredClone(report); mutate(altered);
    assert.throws(() => study.validateWorker(altered, manifest, expected));
  }
});

test('invalid rows fail the actual worker CLI before a DOM report is created', () => {
  for (const [caseIndex, rowArguments] of [[], [''], ['-1'], ['8'], ['0.5'], ['not-a-row']].entries()) {
    const { child, filename } = execute({ ...inputs[2], rowIndex: 0 }, `invalid-row-${caseIndex}`, { rowArguments });
    assert.equal(child.status, 1); assert.match(child.stderr, /rowIndex/);
    assert.equal(fs.existsSync(filename), false);
  }
});

test('existing output survives the actual worker CLI unchanged', () => {
  const filename = path.join(output, 'owned-existing.json');
  const sentinel = Buffer.from('preserve existing worker output\n');
  fs.writeFileSync(filename, sentinel, { flag: 'wx' });
  const { child } = execute({ ...inputs[2], rowIndex: 0 }, 'existing-output', { filename });
  assert.equal(child.status, 1); assert.match(child.stderr, /preserve existing report/);
  assert.deepEqual(fs.readFileSync(filename), sentinel);
});

test('a report created during real asynchronous bootstrap survives a pre-creation sampler error', async () => {
  // A real FIFO needs Linux storage; output/logs may live on a Windows-mounted filesystem.
  const pipeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-background-affinity-pipe-'));
  const fifo = path.join(pipeDirectory, 'manifest.fifo');
  const filename = path.join(output, 'concurrent-output.json');
  const prefix = 'concurrent-output';
  const createFifo = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
  assert.ifError(createFifo.error); assert.equal(createFifo.status, 0, createFifo.stderr);
  const argumentsList = [...worker.workerArguments(0), path.join(__dirname, method.workerFilename), fifo,
    'AA', 'jsdom', '0', 'A', filename, '0'];
  const stdout = fs.openSync(path.join(output, `${prefix}.stdout.log`), 'wx');
  const stderr = fs.openSync(path.join(output, `${prefix}.stderr.log`), 'wx');
  const child = spawn(process.execPath, argumentsList,
    { stdio: ['ignore', stdout, stderr], timeout: method.workerTimeoutMs });
  fs.closeSync(stdout); fs.closeSync(stderr);
  const terminal = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  // Nonblocking open synchronizes with the real manifest reader without hanging if the child fails first.
  const deadline = Date.now() + method.qualificationSynchronizationTimeoutMs;
  let writer;
  while (writer === undefined && child.exitCode === null && Date.now() < deadline) {
    try { writer = fs.openSync(fifo, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK); } catch (error) {
      if (error.code !== 'ENXIO') throw error;
      await delay(method.qualificationPollIntervalMs);
    }
  }
  if (writer === undefined) {
    child.kill(); await terminal;
    fs.unlinkSync(fifo); fs.rmdirSync(pipeDirectory);
    assert.fail('Background affinity qualification: child did not reach the real manifest reader');
  }
  const sentinel = Buffer.from(`${JSON.stringify({ owner: 'concurrent writer', complete: true })}\n`);
  try {
    fs.writeFileSync(filename, sentinel, { flag: 'wx' });
    fs.writeSync(writer, '{invalid manifest');
  } finally { fs.closeSync(writer); }
  const status = await terminal;
  fs.unlinkSync(fifo); fs.rmdirSync(pipeDirectory);
  fs.writeFileSync(path.join(output, `${prefix}.process.json`), `${JSON.stringify({
    command: [process.execPath, ...argumentsList], pid: child.pid, ...status })}\n`, { flag: 'wx' });
  assert.equal(status.exitCode, 1); assert.equal(status.signal, null);
  assert.match(fs.readFileSync(path.join(output, `${prefix}.stderr.log`), 'utf8'), /SyntaxError/);
  assert.deepEqual(fs.readFileSync(filename), sentinel);
});

test('an undeclared initial CPU mask fails before package loading or measurement', () => {
  const { child, filename } = execute({ ...inputs[2], rowIndex: 0 }, 'wrong-bootstrap-mask', { bootstrapMask: '0-1' });
  assert.equal(child.status, 1); assert.match(child.stderr, /unexpected mask/);
  assert.equal(fs.existsSync(filename), false);
});
