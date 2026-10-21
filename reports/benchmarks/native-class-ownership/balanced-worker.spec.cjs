/** @file Exercises the complete factorial assignment and fresh-realm workers on physically separate real packages. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { schedule } = require('./balanced-worker.cjs');
const { reserveOutputDirectory } = require('./balanced-experiment.cjs');
const settings = require('./constants/paired.cjs');
const manifestPath = process.env.RUSTDOM_PAIRED_MANIFEST;
assert.ok(manifestPath, 'Prepare real physical packages and set RUSTDOM_PAIRED_MANIFEST');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const original = JSON.parse(fs.readFileSync(path.join(__dirname, 'hosted/39643090437/AA-01-A.json')));

test('uses every independent load, physical-assignment and sample-order cell exactly once per engine', () => {
  const cells = [
    [false, false, false], [true, false, false], [false, true, false], [true, true, false],
    [false, false, true], [true, false, true], [false, true, true], [true, true, true],
  ];
  for (const engine of ['rustdom', 'jsdom']) {
    for (const [position, [reverseLoad, reverseAssignment, reverseSamples]] of cells.entries()) {
      const plan = schedule(manifest, engine, position);
      assert.deepEqual(plan.factors, { reverseLoad, reverseAssignment, reverseSamples });
      const physical = engine === 'rustdom' ? ['A0', 'A1'] : ['J0', 'J1'];
      assert.deepEqual(plan.roots, { A: manifest.copies[physical[reverseAssignment ? 1 : 0]], B: manifest.copies[physical[reverseAssignment ? 0 : 1]] });
      assert.deepEqual(plan.loadOrder, reverseLoad ? ['B', 'A'] : ['A', 'B']);
      assert.deepEqual(plan.sizes, reverseSamples ? [1000, 250] : [250, 1000]);
      assert.deepEqual(plan.observations.slice(0, 2).map((record) => record.label), reverseSamples ? ['B', 'A'] : ['A', 'B']);
      for (const size of settings.sizes) for (const label of ['A', 'B']) {
        const observations = plan.observations.filter((record) => record.size === size && record.label === label);
        assert.equal(observations.filter((record) => record.warmup).length, settings.warmupRounds);
        assert.equal(observations.filter((record) => !record.warmup).length, settings.measuredRounds);
      }
    }
  }
});

for (const engine of ['rustdom', 'jsdom']) for (const position of [0, 7]) {
  test(`runs actual ${engine} factorial cell ${position}, including symmetric isolation and two clear cleanup endpoints`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-balanced-contract-'));
    const output = path.join(directory, 'worker.json');
    try {
      const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'balanced-worker.cjs'), manifestPath,
        engine, String(position), output], { encoding: 'utf8', timeout: settings.workerTimeoutMs });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(fs.readFileSync(output));
      assert.equal(report.complete, true); assert.equal(report.node, process.version);
      const plan = schedule(manifest, engine, position);
      assert.deepEqual(report.schedule, plan);
      assert.deepEqual(report.isolation, plan.loadOrder.map((label) => ({ label, text: 'isolation',
        ownCreated: engine === 'rustdom' ? 1 : null, otherCreated: engine === 'rustdom' ? 0 : null })));
      assert.deepEqual(report.samples.map(({ size, warmup, round, label }) => ({ size, warmup, round, label })), plan.observations);
      for (const record of report.samples) {
        assert.equal(record.complete, true); assert.equal(record.result, 500);
        assert.equal(record.outputHash, original.runs[0].workloads.find((row) => row.rows === record.size).outputHash);
        assert.ok(Number.isFinite(record.elapsedMs) && record.elapsedMs > 0);
        assert.equal(record.cleanupTrace.length, settings.cleanupRounds);
        for (const endpoint of record.cleanupTrace.slice(-2)) {
          assert.deepEqual(endpoint.survivors, { window: false, document: false });
          if (engine === 'rustdom') assert.equal(endpoint.released.live, 0);
        }
        if (engine === 'rustdom') assert.equal(record.after.created - record.before.created, settings.operations);
      }
    } finally {
      for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
      fs.rmdirSync(directory);
    }
  });
}

test('refuses to overwrite an existing diagnostic report before loading packages', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-balanced-history-'));
  const output = path.join(directory, 'worker.json');
  const bytes = Buffer.from('{"preserved":true}\n'); fs.writeFileSync(output, bytes);
  try {
    const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'balanced-worker.cjs'), manifestPath,
      'rustdom', '0', output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Preserve existing balanced worker output/);
    assert.deepEqual(fs.readFileSync(output), bytes);
  } finally { fs.unlinkSync(output); fs.rmdirSync(directory); }
});

test('reserves the output directory exclusively and preserves files owned by another invocation', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-balanced-reservation-'));
  const target = path.join(directory, 'nested', 'results');
  const marker = path.join(target, 'index.json');
  const bytes = Buffer.from('{"ownedByAnotherInvocation":true}\n');
  try {
    reserveOutputDirectory(target);
    fs.writeFileSync(marker, bytes);
    assert.throws(() => reserveOutputDirectory(target), { code: 'EEXIST' });
    assert.deepEqual(fs.readFileSync(marker), bytes);
  } finally {
    if (fs.existsSync(marker)) fs.unlinkSync(marker);
    if (fs.existsSync(target)) fs.rmdirSync(target);
    if (fs.existsSync(path.dirname(target))) fs.rmdirSync(path.dirname(target));
    fs.rmdirSync(directory);
  }
});
