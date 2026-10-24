/** @file Exercises evidence selection against immutable real sources and the failed hosted experiment. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { canReuse } = require('./history.cjs');
const { historicalSources } = require('./fixtures/history-sources/materialize.cjs');
const manifest = require('./fixtures/history-sources/manifest.json');
const archive = path.join(__dirname, 'hosted/39643090437');

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
