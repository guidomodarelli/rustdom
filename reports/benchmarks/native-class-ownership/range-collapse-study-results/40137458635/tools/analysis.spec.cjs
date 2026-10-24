/** @file Tests raw exports against the genuine rejected reference; never promotes its data into the new study. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAnalyzer } = require('./analyze.cjs');
const { spanRows, createAggregate, addWorker, finishAggregate } = require('./worker-exports.cjs');
const { comparisonRows, classifyFailures } = require('./comparison-exports.cjs');
const { authenticateSources, policy } = require('./analysis-source.cjs');
const expectedReference = require('./constants/reference-analysis.json');
const repository = fs.realpathSync(process.env.RANGE_ANALYSIS_SOURCE);
const capture = fs.realpathSync(process.env.RANGE_ANALYSIS_REFERENCE);
const reference = fs.realpathSync(process.env.RANGE_ANALYSIS_REFERENCE_EXPORT);
const client = fs.realpathSync(process.env.RANGE_ANALYSIS_CLIENT);
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const reader = createAnalyzer(repository);
const index = read(path.join(capture, 'index.json'));
assert.notEqual(index.sourceCommit, policy.sourceCommit);
assert.equal(index.sourceCommit, expectedReference.sourceCommit);
assert.equal(index.hostedRunId, String(expectedReference.runId));
const original = read(path.join(reference, 'analysis.json'));

/** @param {number} ordinal - Original archived process position. @returns {object} Genuine report without identity changes. */
function worker(ordinal) {
  const count = index.processes.length / reader.settings.nodeVersions.length;
  return read(path.join(capture, policy.workerDirectories[Math.floor(ordinal / count)],
    String(ordinal % count).padStart(policy.workerOrdinalDigits, '0'), 'report.json'));
}
const first = worker(0);
const native = worker(index.processes.findIndex((entry) => entry.input.engine === 'rustdom'));

/** @param {(directory: string) => void} action - Isolated filesystem case. @returns {void} Never deletes an unverified path. */
function withOwnedDirectory(action) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'range-analysis-owned-'));
  try { action(directory); }
  finally {
    assert.equal(fs.realpathSync(directory), directory); assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith('range-analysis-owned-'));
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
  }
}

test('all reference spans match the independently saved CSV and retain finite resource totals', () => {
  const lines = fs.readFileSync(path.join(reference, 'spans.csv'), 'utf8').trimEnd().split('\n');
  assert.equal(reader.csvLine(reader.format.spanColumns).trimEnd(), lines[0]);
  const aggregate = createAggregate(); let position = 1;
  for (let ordinal = 0; ordinal < index.processes.length; ordinal++) {
    const report = worker(ordinal);
    addWorker(aggregate, report, reader.summarizeWorker(report));
    for (const row of spanRows(report)) {
      assert.equal(reader.csvLine(reader.format.spanColumns.map((name) => row[name])).trimEnd(), lines[position++]);
    }
  }
  assert.equal(position, lines.length);
  const result = finishAggregate(aggregate);
  assert.deepEqual(result.totals, read(path.join(reference, 'memory.json')).totals);
  assert.equal(Object.keys(result.groups).length, expectedReference.resourceGroups);
  for (const phase of reader.settings.phases) {
    assert.equal(Object.values(result.groups).filter((group) => group.phase === phase).reduce((total, group) => total + group.processes, 0), expectedReference.processesPerPhase);
  }
  for (const node of reader.settings.nodeVersions) {
    for (const physical of expectedReference.controlPackages) {
      const group = Object.values(result.groups).find((entry) => entry.node === node && entry.phase === expectedReference.experimentPhase && entry.engine === expectedReference.nativeEngine && entry.physical === physical);
      assert.equal(group.processes, expectedReference.processesPerAlternatingControl);
    }
    const candidate = Object.values(result.groups).find((entry) => entry.node === node && entry.phase === expectedReference.experimentPhase && entry.engine === expectedReference.nativeEngine && entry.physical === expectedReference.candidatePackage);
    assert.equal(candidate.processes, expectedReference.processesPerLogicalCell);
  }
});

test('all original comparisons, controls and numeric regressions remain visible without changing rejection', () => {
  const decision = read(path.join(reference, 'replay-node22.json'));
  assert.equal(decision.accepted, false);
  const rows = comparisonRows(decision, reader.settings);
  assert.deepEqual(rows, original.comparisons);
  assert.deepEqual(classifyFailures(rows, reader.settings), original.failures);
  assert.equal(original.failures.jsdomControls.length, expectedReference.failedJsdomControls);
  assert.equal(original.failures.rustNumeric.length, expectedReference.nativeNumericRegressions);
  assert.equal(decision.accepted, false);
});

test('a missing Window observation cannot borrow Document tracking', () => {
  const report = structuredClone(first); delete report.batches[0].trackedOwners.window;
  assert.throws(() => reader.summarizeWorker(report), { code: 'ERR_ASSERTION' });
});

test('a retained Document prevents a final release claim independently of Window', () => {
  const report = structuredClone(first); const endpoint = report.batches[0].cleanupTrace.at(-1);
  endpoint.survivors.document = 1; endpoint.clear = false;
  assert.throws(() => reader.summarizeWorker(report), { code: 'ERR_ASSERTION' });
});

test('a substituted native baseline cannot borrow a released endpoint', () => {
  const report = structuredClone(native); report.nativeBaseline.napiClasses.live++;
  assert.throws(() => reader.summarizeWorker(report), { code: 'ERR_ASSERTION' });
});

test('the original first unclear state remains in the resource observation', () => {
  assert.equal(first.batches[0].cleanupTrace[0].clear, false);
  assert.equal(reader.summarizeWorker(first).firstUnclearStates, 1);
});

test('the complete rejected reference cannot be analyzed as the new run', () => {
  withOwnedDirectory((directory) => {
    const output = path.join(directory, 'not-created');
    assert.throws(() => reader.analyze(capture, output), { code: 'ERR_ASSERTION' });
    assert.equal(fs.existsSync(output), false);
  });
});

test('an output parent alias cannot write inside the original capture', () => {
  withOwnedDirectory((directory) => {
    const alias = path.join(directory, 'alias'); fs.symlinkSync(capture, alias, 'dir');
    assert.throws(() => reader.analyze(capture, path.join(alias, 'not-created')), {
      code: 'ERR_ASSERTION', message: 'Range analysis: preserve the original capture and read-only source checkout' });
    assert.equal(fs.existsSync(path.join(capture, 'not-created')), false);
  });
});

test('the fixed source checkout cannot become an output directory', () => {
  const output = path.join(repository, 'range-analysis-not-created');
  assert.throws(() => reader.analyze(capture, output), { code: 'ERR_ASSERTION' });
  assert.equal(fs.existsSync(output), false);
});

test('the actual Windows gitfile is refused before Git is invoked in WSL', () => {
  assert.ok(fs.lstatSync(path.join(client, '.git')).isFile());
  assert.throws(() => createAnalyzer(client), {
    code: 'ERR_ASSERTION', message: 'Range analysis requires a real Git directory, not a Windows gitfile' });
});

test('a substituted publication receipt cannot redefine source pins', () => {
  withOwnedDirectory((directory) => {
    const filename = path.join(directory, policy.sourceReceipt.path); fs.mkdirSync(path.dirname(filename), { recursive: true });
    const content = Buffer.from(fs.readFileSync(path.join(repository, policy.sourceReceipt.path)));
    content[content.length - 1] ^= 1; fs.writeFileSync(filename, content);
    assert.throws(() => authenticateSources(directory), { code: 'ERR_ASSERTION' });
  });
});

test('changed source bytes cannot borrow the unchanged publication receipt', () => {
  withOwnedDirectory((directory) => {
    const receiptPath = path.join(directory, policy.sourceReceipt.path); fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.copyFileSync(path.join(repository, policy.sourceReceipt.path), receiptPath);
    const receipt = read(receiptPath); const firstSource = Object.keys(receipt.files)[0];
    const filename = path.join(directory, firstSource); fs.mkdirSync(path.dirname(filename), { recursive: true });
    const content = Buffer.from(fs.readFileSync(path.join(repository, firstSource))); content[content.length - 1] ^= 1;
    fs.writeFileSync(filename, content);
    assert.throws(() => authenticateSources(directory), { code: 'ERR_ASSERTION' });
  });
});
