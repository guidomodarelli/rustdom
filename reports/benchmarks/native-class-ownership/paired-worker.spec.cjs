/** @file Exercises fresh public DOMs, separate real addons and the complete paired-worker lifecycle. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const { loadRuntime, sample, cleanup, proveIsolation } = require('./paired-worker.cjs');
const settings = require('./constants/paired.cjs');
const manifestPath = process.env.RUSTDOM_PAIRED_MANIFEST;
assert.ok(manifestPath, 'Prepare real packages with paired-experiment.cjs --prepare and set RUSTDOM_PAIRED_MANIFEST');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const original = JSON.parse(fs.readFileSync(path.join(__dirname, 'hosted/39643090437/AA-01-A.json')));

test('loads physically separate reference and candidate classes with independent native allocation registries', async () => {
  const baseline = loadRuntime(manifest.copies.A0, 'rustdom');
  await proveIsolation({ A: baseline, B: loadRuntime(manifest.copies.A1, 'rustdom') });
  await proveIsolation({ A: baseline, B: loadRuntime(manifest.copies.B, 'rustdom') });
  await proveIsolation({ A: loadRuntime(manifest.copies.J0, 'jsdom'), B: loadRuntime(manifest.copies.J1, 'jsdom') });
});

test('preserves the original public checksum, complete output and released owners in each real implementation', async () => {
  for (const label of ['A0', 'A1', 'B', 'J0', 'J1']) {
    const runtime = loadRuntime(manifest.copies[label], label.startsWith('J') ? 'jsdom' : 'rustdom');
    const observation = await cleanup(sample(runtime, settings.sizes[0]), runtime);
    const expected = original.runs[0].workloads.find((row) => row.rows === settings.sizes[0]);
    assert.equal(observation.outputHash, expected.outputHash);
    assert.equal(observation.result, settings.operations / 2);
    assert.deepEqual(observation.survivors, { window: false, document: false });
    assert.ok(observation.cleanupTrace.slice(-2).every((endpoint) => !endpoint.survivors.window && !endpoint.survivors.document));
    if (observation.released) assert.equal(observation.released.live, 0);
  }
});

for (const [engine, position] of [['rustdom', 0], ['jsdom', 1]]) {
  test(`executes all actual paired ${engine} observations with fresh realms and the declared reversed ordering`, () => {
    const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-paired-contract-'));
    const reportPath = path.join(directory, 'worker.json');
    try {
      const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'paired-worker.cjs'), manifestPath,
        'AB', engine, String(position), reportPath], { encoding: 'utf8', timeout: settings.workerTimeoutMs });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(fs.readFileSync(reportPath));
      assert.equal(report.complete, true); assert.equal(report.node, process.version);
      assert.equal(report.samples.length, settings.sizes.length * 2 * (settings.warmupRounds + settings.measuredRounds));
      const expectedSizes = position % 2 ? [...settings.sizes].reverse() : settings.sizes;
      assert.deepEqual([...new Set(report.samples.map((entry) => entry.size))], expectedSizes);
      const firstPair = report.samples.slice(0, 2).map((entry) => entry.label).join('');
      assert.equal(firstPair, position % 2 ? 'BA' : 'AB');
      for (const size of settings.sizes) for (const label of ['A', 'B']) {
        const selected = report.samples.filter((entry) => entry.size === size && entry.label === label);
        assert.equal(selected.filter((entry) => entry.warmup).length, settings.warmupRounds);
        assert.equal(selected.filter((entry) => !entry.warmup).length, settings.measuredRounds);
        for (const entry of selected) {
          assert.equal(entry.complete, true); assert.equal(entry.result, settings.operations / 2);
          assert.equal(entry.outputHash, original.runs[0].workloads.find((row) => row.rows === size).outputHash);
          assert.deepEqual(entry.survivors, { window: false, document: false });
          assert.equal(entry.cleanupTrace.length, settings.cleanupRounds);
          assert.ok(entry.cleanupTrace.slice(-2).every((endpoint) => !endpoint.survivors.window && !endpoint.survivors.document));
          if (engine === 'rustdom') {
            assert.equal(entry.after.created - entry.before.created, settings.operations);
            assert.equal(entry.released.live, 0);
          }
        }
      }
    } finally {
      for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
      fs.rmdirSync(directory);
    }
  });
}

test('preserves an existing worker report instead of overwriting historical observations', () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-paired-history-'));
  const output = path.join(directory, 'worker.json');
  const bytes = Buffer.from('{"historical":true}\n');
  fs.writeFileSync(output, bytes);
  try {
    const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'paired-worker.cjs'), manifestPath,
      'AB', 'rustdom', '0', output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Preserve existing paired worker output/);
    assert.deepEqual(fs.readFileSync(output), bytes);
  } finally { fs.unlinkSync(output); fs.rmdirSync(directory); }
});
