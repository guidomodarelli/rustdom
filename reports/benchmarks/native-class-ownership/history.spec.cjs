/** @file Exercises evidence selection against immutable real sources and the failed hosted experiment. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { canReuse } = require('./history.cjs');
const manifest = require('./fixtures/history-sources/manifest.json');
const archive = path.join(__dirname, 'hosted/39643090437');

/**
 * Materialize the actual measured bytes without requiring old Git objects or the current checkout.
 * Each test owns its temporary trees; cleanup also runs when an assertion fails.
 * @param {import('node:test').TestContext} context - Test that owns these temporary trees.
 * @returns {{ baseline: string, candidate: string }} Independent historical source roots.
 */
function historicalSources(context) {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-history-sources-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const [label, source] of Object.entries(manifest.sources)) {
    const snapshot = fs.readFileSync(path.join(__dirname, 'fixtures/history-sources', source.snapshot));
    assert.equal(createHash('sha256').update(snapshot).digest('hex'), source.sha256,
      `Historical source snapshot checksum differs: ${source.snapshot}`);
    const files = JSON.parse(gunzipSync(snapshot).toString('utf8'));
    assert.equal(files.length, source.measuredSourceCount);
    for (const file of files) {
      const destination = path.join(directory, label, file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from(file.bytes, 'base64'));
    }
  }
  const candidate = path.join(directory, 'B');
  const protocolRoot = path.join(candidate, 'reports/benchmarks/native-class-ownership');
  for (const [file, archivedName] of Object.entries(manifest.protocolFiles)) {
    const destination = path.join(protocolRoot, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(archive, archivedName), destination);
  }
  return { baseline: path.join(directory, 'A'), candidate };
}

test('selects identical historical sources even when the verified experiment did not accept its budget', (context) => {
  const { baseline, candidate } = historicalSources(context);
  assert.equal(JSON.parse(fs.readFileSync(path.join(archive, 'index.json'))).accepted, false);
  assert.equal(canReuse(baseline, archive, candidate), true);
});

test('rejects evidence after real candidate implementation bytes change', (context) => {
  const { baseline, candidate } = historicalSources(context);
  fs.appendFileSync(path.join(candidate, 'third-party/napi/src/bindgen_runtime/js_values/class.rs'), '\n');
  assert.equal(canReuse(baseline, archive, candidate), false);
});

test('rejects evidence after real reference implementation bytes change', (context) => {
  const { baseline, candidate } = historicalSources(context);
  fs.appendFileSync(path.join(baseline, 'src/dom/tree.rs'), '\n');
  assert.equal(canReuse(baseline, archive, candidate), false);
});

test('rejects evidence for another real candidate implementation', (context) => {
  const { baseline } = historicalSources(context);
  assert.equal(canReuse(baseline, archive, baseline), false);
});

for (const file of Object.keys(manifest.protocolFiles)) {
  test(`rejects evidence after the historical protocol bytes change: ${file}`, (context) => {
    const { baseline, candidate } = historicalSources(context);
    fs.appendFileSync(path.join(candidate, 'reports/benchmarks/native-class-ownership', file), '\n');
    assert.equal(canReuse(baseline, archive, candidate), false);
  });
}

test('reports absent evidence without creating an experiment or touching its directory', (context) => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-history-empty-'));
  context.after(() => fs.rmdirSync(directory));
  assert.equal(canReuse('missing-baseline', directory, 'missing-candidate'), false);
  assert.deepEqual(fs.readdirSync(directory), []);
});
