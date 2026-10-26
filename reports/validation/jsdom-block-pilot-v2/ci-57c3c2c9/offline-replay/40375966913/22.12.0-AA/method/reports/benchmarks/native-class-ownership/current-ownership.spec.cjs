/** @file Qualifies the current compiled packages through real public workloads and resource teardown. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const study = require('./current-ownership-experiment.cjs');
const legacy = require('./row-isolation-experiment.cjs');
const worker = require('./current-ownership-worker.cjs');
const settings = require('./constants/current-ownership.cjs');
const original = require('./constants/row-isolation.cjs');
const method = require('./constants/current-ownership-study.cjs');
const contracts = require('./constants/current-build-contracts.cjs');
const archive = process.env.RUSTDOM_CURRENT_OWNERSHIP_PREPARATION;
const output = process.env.RUSTDOM_CURRENT_OWNERSHIP_QUALIFICATION;
assert.ok(archive && output, 'Provide the actual current preparation and a fresh qualification output directory');
const manifest = study.createManifest(archive);
const manifestPath = path.join(output, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

/** Own one real preparation copy with its original functional reports. */
function preparationCopy(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), contracts.preparationDirectoryPrefix));
  context.after(() => {
    const real = fs.realpathSync(root);
    assert.equal(path.dirname(real), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(real).startsWith(contracts.preparationDirectoryPrefix));
    fs.rmSync(real, { recursive: true });
  });
  const destination = path.join(root, 'ownership-build');
  fs.cpSync(archive, destination, { recursive: true, verbatimSymlinks: true });
  for (const name of ['ownership-node22.json', 'ownership-node24.json']) {
    fs.copyFileSync(path.join(path.dirname(archive), name), path.join(root, name));
  }
  return destination;
}

test('the current binding preserves every original row, factor, sample and budget', () => {
  const { revision: unusedRevision, distributionHashes: unusedDistributions, ...actual } = settings;
  const { revision: unusedOldRevision, distributionHashes: unusedOldDistributions, ...expected } = original;
  assert.deepEqual(actual, expected);
  assert.deepEqual(study.processSchedule(), legacy.processSchedule());
  assert.equal(study.processSchedule().length, 1024);
  assert.equal(manifest.preparationBefore.measurementExecuted, false);
  assert.equal(manifest.preparationBefore.performanceAccepted, null);
  assert.deepEqual(manifest.preparationBefore.inputs.sources, method.sourceHashes);
});

for (const [name, filename] of [
  ['JavaScript distribution', 'packages/B/dist/index.cjs'],
  ['Rust source', 'sources/src/dom/xml_serializer_controller.rs'],
  ['root build input', 'sources/build.rs'],
]) {
  test(`changed ${name} is rejected before any worker starts`, (context) => {
    const candidate = preparationCopy(context);
    fs.appendFileSync(path.join(candidate, filename), '\n');
    assert.throws(() => study.createManifest(candidate));
  });
}

test('an altered public release probe cannot stand in for the original functional evidence', (context) => {
  const candidate = preparationCopy(context);
  const filename = path.join(path.dirname(candidate), 'ownership-node22.json');
  const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
  report.observedWindows = 0;
  fs.writeFileSync(filename, JSON.stringify(report));
  assert.throws(() => study.createManifest(candidate), /original public probe changed/);
});

test('the real metadata CLI rejects unrecorded runtime configuration without loading DOM', () => {
  for (const [name, value] of [['NODE_OPTIONS', '--no-warnings'], ['NODE_PATH', output], ['CARGO_PROFILE_RELEASE_OPT_LEVEL', '1']]) {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'current-ownership-experiment.cjs'), '--inspect', archive],
      { encoding: 'utf8', env: { ...process.env, [name]: value } });
    assert.equal(result.status, 2); assert.equal(result.stdout, '');
    assert.match(result.stderr, new RegExp(`undeclared ${name}`));
  }
});

const inputs = [
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'B' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'B' },
  { phase: 'AB', engine: 'rustdom', position: 15, label: 'B' },
];
const reports = [];
for (const input of inputs) {
  test(`actual ${input.phase}/${input.engine}/${input.label} exercises all eight public rows and releases its realms`, () => {
    for (let rowIndex = 0; rowIndex < settings.rows.length; rowIndex++) {
      const filename = path.join(output, `${input.phase}-${input.engine}-${input.label}-${rowIndex}.json`);
      const argumentsList = [...worker.workerArguments(input.position), path.join(__dirname, method.workerFilename), manifestPath,
        input.phase, input.engine, String(input.position), input.label, filename, String(rowIndex)];
      const child = spawnSync(process.execPath, argumentsList, { encoding: 'utf8', timeout: method.workerTimeoutMs });
      fs.writeFileSync(`${filename}.stdout.log`, child.stdout ?? '', { flag: 'wx' });
      fs.writeFileSync(`${filename}.stderr.log`, child.stderr ?? '', { flag: 'wx' });
      fs.writeFileSync(`${filename}.process.json`, JSON.stringify({ command: [process.execPath, ...argumentsList],
        pid: child.pid, exitCode: child.status, signal: child.signal, error: child.error?.message ?? null }) + '\n', { flag: 'wx' });
      assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
      const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
      study.validateWorker(report, manifest, { ...input, rowIndex, node: process.version, pid: child.pid });
      reports.push({ input: { ...input, rowIndex }, report });
    }
  });
}

test('qualification covered the five actual physical packages and cannot accept altered cleanup or output', () => {
  assert.equal(reports.length, 40);
  assert.deepEqual(new Set(reports.map(({ report }) => report.schedule.physical)), new Set(Object.keys(manifest.copies)));
  const { input, report } = reports[0];
  for (const kind of ['missing-row', 'wrong-row', 'cleanup', 'wrong-output']) {
    const changed = structuredClone(report);
    if (kind === 'missing-row') changed.batches = [];
    else if (kind === 'wrong-row') changed.rowIndex = (changed.rowIndex + 1) % settings.rows.length;
    else if (kind === 'cleanup') changed.batches[0].cleanupTrace.at(-1).clear = false;
    else changed.batches[0].outputHash = 'altered';
    assert.throws(() => study.validateWorker(changed, manifest, { ...input, node: process.version, pid: report.pid }));
  }
});
