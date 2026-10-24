/** @file Checks the complete real paired study and rejects false acceptance or hidden retained targets. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { verify, verifySet } = require('./paired-main-experiment.cjs');
const settings = require('./constants/paired-main.cjs');
const archive = path.join(__dirname, 'paired-main/2026-10-21');
const nodes = ['node-22', 'node-24'].map((label) => path.join(archive, label));

/** Mutate only a fresh private archive; never overwrite the published measurements. */
function withNodeCopy(operation) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-paired-evidence-'));
  try {
    const target = path.join(directory, 'node-24');
    fs.cpSync(nodes[1], target, { recursive: true });
    return operation(target);
  } finally {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rustdom-paired-evidence-'));
    fs.rmSync(resolved, { recursive: true });
  }
}

test('all 64 actual workers reproduce the original distributions, resources, samples and unaccepted result', () => {
  const result = verifySet(nodes);
  assert.equal(result.verified, true);
  assert.equal(result.accepted, false);
  assert.deepEqual(result.results.map((entry) => entry.node), ['v22.12.0', 'v24.14.1']);
  assert.equal(result.results.reduce((count, entry) => count + entry.processes, 0), 64);
  assert.equal(result.results.reduce((count, entry) => count + entry.measuredDurations, 0), 9216);
  for (const entry of result.results) {
    assert.equal(entry.accepted, false);
    assert.equal(entry.summaries.AA.length, 8);
    assert.equal(entry.summaries.AB.length, 8);
  }
  const regression = result.results[1].summaries.AB.find((row) => row.key === 'mutation-records-collect/100');
  assert.equal(regression.calibrated, true);
  assert.equal(regression.withinBudget, false);
  assert.ok(regression.rustdomChangePercent > settings.rustBudgetPercent);
});

test('changing only the archived acceptance cannot turn the actual failed budget into success', () => withNodeCopy((root) => {
  const filename = path.join(root, 'index.json');
  const index = JSON.parse(fs.readFileSync(filename));
  index.accepted = true;
  fs.writeFileSync(filename, JSON.stringify(index));
  assert.throws(() => verify(root));
}));

test('a retained Window is rejected even when the worker says clear and its recorded file digest is refreshed', () => withNodeCopy((root) => {
  const filename = path.join(root, 'index.json');
  const index = JSON.parse(fs.readFileSync(filename));
  const entry = index.runs.find((run) => run.engine === 'rustdom');
  const reportPath = path.join(root, entry.report);
  const report = JSON.parse(fs.readFileSync(reportPath));
  const endpoint = report.batches[0].cleanupTrace.at(-1).A;
  assert.equal(endpoint.clear, true);
  endpoint.survivors.window = 1;
  const bytes = Buffer.from(JSON.stringify(report));
  fs.writeFileSync(reportPath, bytes);
  index.files[entry.report] = createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(filename, JSON.stringify(index));
  assert.throws(() => verify(root), /falsely declared resource endpoint/);
}));
