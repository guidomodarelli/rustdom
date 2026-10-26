/** @file Exercises independent scheduling, actual package workloads, legacy replay and evidence rejection. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const study = require('./independent-order-experiment.cjs');
const worker = require('./independent-order-worker.cjs');
const legacy = require('./single-package-experiment.cjs');
const preparation = require('./hosted-main-experiment.cjs');
const settings = require('./constants/independent-order.cjs');
const method = require('./constants/independent-order-study.cjs');
const original = require('./constants/single-package.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
const prior = process.env.RUSTDOM_PRIOR_SINGLE_PACKAGE_ARCHIVE;
const output = process.env.RUSTDOM_INDEPENDENT_ORDER_TEST_OUTPUT;
assert.ok(archive && prior && output, 'Set the real preparation, prior study and preserved test output paths');
const manifest = preparation.createManifest(archive);

/** Own only this test's fresh negative fixture; raw worker evidence stays outside it. */
function temporaryDirectory(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-independent-order-check-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rustdom-independent-order-check-'));
    fs.rmSync(root, { recursive: true });
  });
  return root;
}

test('all sixteen combinations balance engine lead independently from pair, physical and row order', () => {
  const sequence = study.processSchedule();
  assert.equal(sequence.length, 128);
  assert.equal(sequence.length * settings.rows.length * settings.measuredSamples * settings.nodeVersions.length, 18432);
  assert.deepEqual(settings.rows, original.rows);
  assert.deepEqual(settings.distributionHashes, original.distributionHashes);
  for (const key of ['warmupSamples', 'measuredSamples', 'cleanupRounds', 'requiredClearRounds', 'controlBudgetPercent', 'rustBudgetPercent']) {
    assert.equal(settings[key], original[key]);
  }
  for (const phase of settings.phases) for (const engine of settings.engines) {
    const vectors = [];
    const combinations = new Map();
    for (let position = 0; position < settings.workerCount; position++) {
      const entries = sequence.filter((entry) => entry.phase === phase && entry.position === position);
      const engines = [...new Set(entries.map((entry) => entry.engine))];
      const pair = entries.filter((entry) => entry.engine === engine);
      assert.equal(pair.length, 2);
      assert.deepEqual(pair.map((entry) => entry.label).toSorted(), settings.labels);
      const plan = worker.schedule(manifest, phase, engine, position, 'A');
      const engineFirst = engines[0] === engine;
      const combination = JSON.stringify([engineFirst, pair[0].label]);
      combinations.set(combination, (combinations.get(combination) ?? 0) + 1);
      vectors.push(JSON.stringify([engineFirst, plan.factors.reversePair,
        plan.factors.reverseAssignment, plan.factors.reverseRows]));
      assert.deepEqual(new Set(plan.rows.map((row) => `${row.name}/${row.size}`)), new Set(settings.rows));
      if (phase === 'AB' && engine === 'rustdom') assert.equal(worker.schedule(manifest, phase, engine, position, 'B').physical, 'B');
    }
    assert.equal(new Set(vectors).size, 16);
    assert.equal(combinations.size, 4);
    assert.ok([...combinations.values()].every((count) => count === 4));
  }
});

test('legacy defaults preserve the actual prior schedule and its complete original rejection', () => {
  const directories = ['node-22', 'node-24'].map((node) => path.join(prior, node));
  const index = JSON.parse(fs.readFileSync(path.join(directories[0], 'index.json')));
  assert.deepEqual(legacy.processSchedule(), index.runs.map(({ phase, engine, position, label }) => ({ phase, engine, position, label })));
  const result = legacy.verifySet(directories);
  assert.equal(result.verified, true); assert.equal(result.accepted, false);
  assert.ok(result.results.every((node) => node.processes === 64 && node.measuredDurations === 4608));
});

test('the real new CLI cannot relabel the old eight-position archive', () => {
  const filename = path.join(prior, 'node-22/index.json');
  const before = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'independent-order-experiment.cjs'),
    '--verify-set', path.join(prior, 'node-22'), path.join(prior, 'node-24')], { encoding: 'utf8', timeout: method.workerTimeoutMs });
  assert.equal(child.status, 2); assert.equal(child.stdout, ''); assert.match(child.stderr, /AssertionError/);
  assert.equal(createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), before);
});

test('invalid arguments are rejected before loading a runtime', () => {
  assert.throws(() => worker.schedule(manifest, 'AA', 'rustdom', 16, 'A'), /outside the declared schedule/);
  assert.throws(() => worker.schedule(manifest, 'AA', 'rustdom', -1, 'A'), /outside the declared schedule/);
  assert.throws(() => worker.schedule(manifest, 'AA', 'rustdom', 0, 'C'), /unknown treatment/);
  assert.ok(Object.values(worker.loadedPackages(manifest)).every((filenames) => filenames.length === 0));
});

const reports = [];
const inputs = [
  { phase: 'AA', engine: 'rustdom', position: 8, label: 'A' },
  { phase: 'AA', engine: 'rustdom', position: 10, label: 'A' },
  { phase: 'AB', engine: 'rustdom', position: 15, label: 'B' },
  { phase: 'AA', engine: 'jsdom', position: 1, label: 'A' },
];
const manifestPath = path.join(output, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
for (const input of inputs) {
  test(`real ${input.phase}/${input.engine}/${input.position}/${input.label} worker preserves all workloads and release`, () => {
    const prefix = `${input.phase}-${input.engine}-${input.position}-${input.label}`;
    const filename = path.join(output, `${prefix}.json`);
    const environment = { ...process.env }; delete environment.NODE_OPTIONS;
    const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, method.workerFilename), manifestPath,
      input.phase, input.engine, String(input.position), input.label, filename],
    { env: environment, encoding: 'utf8', timeout: method.workerTimeoutMs });
    fs.writeFileSync(path.join(output, `${prefix}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(output, `${prefix}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(output, `${prefix}.process.json`), JSON.stringify({ ...input, pid: child.pid,
      exitCode: child.status, signal: child.signal, error: child.error?.message ?? null }), { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
    study.validateWorker(report, manifest, { ...input, node: process.version, pid: child.pid });
    assert.equal(Object.values(report.loadedAfter).filter((filenames) => filenames.length).length, 1);
    reports.push(report);
  });
}

test('all four real packages preserve equivalent public outputs for every row', () => {
  assert.equal(reports.length, inputs.length);
  for (const key of settings.rows) {
    const hashes = reports.map((report) => report.batches.find((batch) => `${batch.name}/${batch.size}` === key).outputHash);
    assert.equal(new Set(hashes).size, 1, key);
  }
});

test('the real driver rejects unreviewed sources before launching any child', (context) => {
  const root = temporaryDirectory(context); const provenance = path.join(root, 'provenance.json');
  fs.writeFileSync(provenance, JSON.stringify({ harnessSha256: '0'.repeat(64),
    reviewedCommit: method.preparation.headSha, receiptUrl: 'https://github.com/guidomodarelli/rustdom/pull/80' }));
  const destination = path.join(root, 'output');
  assert.throws(() => study.run(archive, destination, provenance), /harness differs from reviewed sources/);
  const index = JSON.parse(fs.readFileSync(path.join(destination, 'index.json')));
  assert.equal(index.complete, false); assert.deepEqual(index.runs, []);
});

test('changed order metadata and falsely clear endpoints cannot pass the real verifier', () => {
  const report = reports[0]; assert.ok(report);
  const expected = { ...inputs[0], node: process.version, pid: report.pid };
  const changedOrder = structuredClone(report);
  changedOrder.schedule.factors.reverseEngines = !changedOrder.schedule.factors.reverseEngines;
  assert.throws(() => study.validateWorker(changedOrder, manifest, expected));
  const retained = structuredClone(report);
  retained.batches[0].cleanupTrace.at(-1).survivors.document = 1;
  assert.throws(() => study.validateWorker(retained, manifest, expected));
});
