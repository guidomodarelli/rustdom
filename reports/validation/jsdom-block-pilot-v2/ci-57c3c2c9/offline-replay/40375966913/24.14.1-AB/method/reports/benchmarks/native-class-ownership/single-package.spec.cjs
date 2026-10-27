/** @file Tests actual isolated package execution, public results, release and evidence rejection. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const study = require('./single-package-experiment.cjs');
const worker = require('./single-package-worker.cjs');
const preparation = require('./hosted-main-experiment.cjs');
const settings = require('./constants/single-package.cjs');
const method = require('./constants/single-package-study.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
const output = process.env.RUSTDOM_SINGLE_PACKAGE_TEST_OUTPUT;
assert.ok(archive, 'Use the authenticated official RUSTDOM_HOSTED_BUILD_ARCHIVE');
assert.ok(output, 'Set RUSTDOM_SINGLE_PACKAGE_TEST_OUTPUT to preserve real evidence');
const manifest = preparation.createManifest(archive);

/** Own a fresh temporary negative fixture without deleting preserved worker reports. */
function temporaryDirectory(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-single-package-check-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rustdom-single-package-check-'));
    fs.rmSync(root, { recursive: true });
  });
  return root;
}

test('each Node declares 64 processes with adjacent treatments and balanced independent factors', () => {
  const sequence = study.processSchedule();
  assert.equal(sequence.length, 64);
  for (const phase of settings.phases) for (const engine of settings.engines) {
    const entries = sequence.filter((entry) => entry.phase === phase && entry.engine === engine);
    assert.equal(entries.length, settings.workerCount * settings.labels.length);
    const plans = entries.map((entry) => worker.schedule(manifest, entry.phase, entry.engine, entry.position, entry.label));
    for (const label of settings.labels) {
      const selected = plans.filter((plan) => plan.label === label);
      assert.equal(new Set(selected.map((plan) => JSON.stringify(plan.factors))).size, settings.workerCount);
      assert.equal(selected.filter((plan) => plan.factors.reverseRows).length, settings.workerCount / 2);
    }
    for (let index = 0; index < entries.length; index += settings.labels.length) {
      assert.equal(entries[index].position, entries[index + 1].position);
      assert.notEqual(entries[index].label, entries[index + 1].label);
    }
    for (const plan of plans) {
      assert.deepEqual(new Set(plan.rows.map((row) => `${row.name}/${row.size}`)), new Set(settings.rows));
      if (engine === 'rustdom' && phase === 'AB' && plan.label === 'B') assert.equal(plan.physical, 'B');
    }
  }
  assert.equal(sequence.length * settings.rows.length * settings.measuredSamples * settings.nodeVersions.length, 9216);
});

test('invalid treatment and schedule arguments cannot load a runtime', () => {
  assert.throws(() => worker.schedule(manifest, 'AA', 'rustdom', 0, 'C'), /unknown treatment/);
  assert.throws(() => worker.schedule(manifest, 'invalid', 'rustdom', 0, 'A'), /unknown phase/);
  assert.throws(() => worker.schedule(manifest, 'AA', 'invalid', 0, 'A'), /unknown engine/);
  assert.throws(() => worker.schedule(manifest, 'AA', 'rustdom', settings.workerCount, 'A'), /outside the declared schedule/);
  assert.ok(Object.values(worker.loadedPackages(manifest)).every((filenames) => filenames.length === 0));
});

const reports = [];
const inputs = [
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'B' },
  { phase: 'AB', engine: 'rustdom', position: 7, label: 'B' },
  { phase: 'AA', engine: 'jsdom', position: 7, label: 'A' },
];
const manifestPath = path.join(output, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
for (const input of inputs) {
  test(`real ${input.phase}/${input.engine}/${input.label} worker loads one package, exercises all rows and releases owners`, () => {
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
    reports.push(report);
    assert.equal(Object.values(report.loadedAfter).filter((filenames) => filenames.length).length, 1);
    for (const batch of report.batches) for (const endpoint of batch.cleanupTrace.slice(-settings.requiredClearRounds)) {
      assert.deepEqual(endpoint.survivors, { window: 0, document: 0 });
    }
  });
}

test('independent real jsdom and all selected Rust packages produce identical public outputs', () => {
  assert.equal(reports.length, inputs.length);
  for (const key of settings.rows) {
    const hashes = reports.map((report) => report.batches.find((batch) => `${batch.name}/${batch.size}` === key).outputHash);
    assert.equal(new Set(hashes).size, 1, `Public result mismatch at ${key}`);
  }
});

test('the verifier rejects a second loaded copy, false cleanup and missing or invalid samples', () => {
  const report = reports[0]; assert.ok(report);
  const expected = { ...inputs[0], node: process.version, pid: report.pid };
  for (const mutate of [
    (copy) => { copy.loadedAfter.A1 = [path.join(manifest.copies.A1, 'dist/index.cjs')]; },
    (copy) => { copy.batches[0].cleanupTrace.at(-1).survivors.window = 1; },
    (copy) => { copy.batches.pop(); },
    (copy) => { copy.batches[0].samplesMs[0] = NaN; },
  ]) {
    const copy = structuredClone(report); mutate(copy);
    assert.throws(() => study.validateWorker(copy, manifest, expected));
  }
});

test('an unreviewed driver preserves an incomplete archive without launching workers', (context) => {
  const root = temporaryDirectory(context); const provenance = path.join(root, 'provenance.json');
  fs.writeFileSync(provenance, JSON.stringify({ harnessSha256: '0'.repeat(64),
    reviewedCommit: method.preparation.headSha, receiptUrl: 'https://github.com/guidomodarelli/rustdom/pull/80' }));
  const destination = path.join(root, 'output');
  assert.throws(() => study.run(archive, destination, provenance), /harness differs from reviewed sources/);
  const index = JSON.parse(fs.readFileSync(path.join(destination, 'index.json')));
  assert.equal(index.complete, false); assert.deepEqual(index.runs, []);
});

test('existing evidence and preparation aliases cannot be overwritten', (context) => {
  const root = temporaryDirectory(context); const destination = path.join(root, 'output'); fs.mkdirSync(destination);
  const sentinel = path.join(destination, 'sentinel'); fs.writeFileSync(sentinel, 'preserve');
  assert.throws(() => study.run(archive, destination, 'unused'), /preserve existing evidence/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve');
  const alias = path.join(root, 'alias'); fs.symlinkSync(archive, alias, 'dir');
  assert.throws(() => study.run(archive, path.join(alias, 'new-study'), 'unused'), /must not modify the official preparation/);
});

test('the real verifier cannot relabel the prior hosted archive as separate-process evidence', () => {
  const prior = process.env.RUSTDOM_PRIOR_HOSTED_MAIN_ARCHIVE;
  assert.ok(prior, 'Set RUSTDOM_PRIOR_HOSTED_MAIN_ARCHIVE for the actual historical rejection contract');
  const filename = path.join(prior, 'index.json');
  const before = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'single-package-experiment.cjs'), '--verify', prior],
    { encoding: 'utf8', timeout: method.workerTimeoutMs });
  assert.equal(child.status, 2); assert.equal(child.stdout, ''); assert.match(child.stderr, /AssertionError/);
  assert.equal(createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), before);
});

test('changed executable package bytes stop a real worker before loading any runtime', (context) => {
  const root = temporaryDirectory(context); const copy = path.join(root, 'C'); fs.mkdirSync(copy);
  fs.cpSync(path.join(manifest.copies.B, 'dist'), path.join(copy, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(manifest.copies.B, 'package.json'), path.join(copy, 'package.json'));
  fs.appendFileSync(path.join(copy, 'dist/index.cjs'), '\n// Deliberately changed executable package.\n');
  const modified = { ...manifest, copies: { ...manifest.copies, B: copy } };
  const filename = path.join(root, 'manifest.json'); fs.writeFileSync(filename, JSON.stringify(modified));
  const reportPath = path.join(root, 'report.json');
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, method.workerFilename),
    filename, 'AB', 'rustdom', '0', 'B', reportPath], { encoding: 'utf8', timeout: method.workerTimeoutMs });
  assert.equal(child.status, 1); assert.match(child.stderr, /changed B package/);
  const report = JSON.parse(fs.readFileSync(reportPath));
  assert.equal(report.complete, false); assert.deepEqual(report.batches, []);
  assert.equal(report.loadedBefore, undefined);
  fs.copyFileSync(reportPath, path.join(output, 'changed-package-rejection.json'));
  fs.writeFileSync(path.join(output, 'changed-package-rejection.stderr.log'), child.stderr, { flag: 'wx' });
});
