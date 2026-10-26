/** @file Exercises workflow consumption and the real source graph without collecting timing observations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const study = require('./current-ownership-experiment.cjs');
const contracts = require('./constants/current-build-contracts.cjs');
const repository = path.resolve(__dirname, '../../..');

/** Own physical workflow input and source fixtures, preserving every existing tree. */
function temporary(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), contracts.preparationDirectoryPrefix));
  context.after(() => {
    const real = fs.realpathSync(root);
    assert.equal(path.dirname(real), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(real).startsWith(contracts.preparationDirectoryPrefix));
    fs.rmSync(real, { recursive: true });
  });
  return root;
}

test('the real workflow consumption CLI permits exactly one run and rejects relabels, duplicates and incomplete history', (context) => {
  const root = temporary(context);
  for (const [name, content, expected] of [
    ['first', '39907233079\n', 0], ['relabel', '39907233079\n39896591561\n', 2],
    ['duplicate', '39907233079\n39907233079\n', 2], ['missing-current', '39896591561\n', 2], ['empty', '', 2],
  ]) {
    const filename = path.join(root, name);
    fs.writeFileSync(filename, content);
    const child = spawnSync(process.execPath, [path.join(__dirname, 'current-ownership-consumption.cjs'), filename, '39907233079'],
      { encoding: 'utf8' });
    assert.ifError(child.error); assert.equal(child.status, expected, child.stderr); assert.equal(child.stdout, '');
    if (expected) assert.match(child.stderr, /candidate already consumed or run history incomplete/);
  }
});

test('actual current-preparation verifier changes invalidate the reviewed harness while implementation stays the same', (context) => {
  const root = temporary(context);
  const original = study.captureHarness();
  for (const entry of original.files) {
    const output = path.join(root, entry.path);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(repository, entry.path), output);
  }
  assert.equal(study.captureHarness(root).sha256, original.sha256);
  for (const name of ['prepare-current-hosted-build.cjs', 'current-build-inputs.cjs', 'constants/current-hosted-build.cjs',
    'current-ownership-consumption.cjs']) {
    const filename = path.join(root, 'reports/benchmarks/native-class-ownership', name);
    const raw = fs.readFileSync(filename);
    fs.appendFileSync(filename, '\n');
    const changed = study.captureHarness(root);
    assert.equal(changed.identity.sourceHash, original.identity.sourceHash);
    assert.notEqual(changed.sha256, original.sha256, name);
    fs.writeFileSync(filename, raw);
  }
});
