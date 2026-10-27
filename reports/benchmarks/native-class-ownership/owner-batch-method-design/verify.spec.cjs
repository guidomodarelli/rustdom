/** @file Checks the real archived-data verifier against complete and deliberately corrupted diagnostic data. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { verify } = require('./verify.cjs');
const policy = require('./constants/diagnostic.json');
const repository = path.resolve(__dirname, '../../../..');
const fixture = path.join(repository, policy.diagnosticFixture.path);
const raw = fs.readFileSync(fixture);
assert.equal(createHash('sha256').update(raw).digest('hex'), policy.diagnosticFixture.sha256);
const original = JSON.parse(raw);

test('complete archived data verifies every measured span, warmup, process and group without acceptance', () => {
  const result = verify(repository, fixture);
  assert.equal(result.processes, policy.processes);
  assert.equal(result.groups, policy.groups);
  assert.equal(result.historicalMeansMatched, policy.processes);
  assert.equal(result.measuredSpans, policy.measuredSpans);
  assert.equal(result.warmupSpans, policy.warmupSpans);
  assert.equal(result.performanceAccepted, null);
  assert.equal(result.gateReevaluated, false);
});

const mutations = [
  { name: 'a changed original span', change: (report) => { report.processes[0].samplesMs[0] += 1; } },
  { name: 'a changed calculated process mean', change: (report) => { report.processes[0].meanMs += 1; } },
  { name: 'a missing process', change: (report) => { report.processes.pop(); } },
  { name: 'a duplicated process with unchanged total count', change: (report) => {
    report.processes[report.processes.length - 1] = structuredClone(report.processes[0]);
  } },
  { name: 'a missing warmup', change: (report) => { report.processes[0].warmupMs.pop(); } },
  { name: 'a clamped negative signed contrast', change: (report) => {
    const negative = report.groups.find((group) => group.signedMomentContrastMsSquared < 0);
    assert.ok(negative); negative.signedMomentContrastMsSquared = 0;
  } },
  { name: 'a fabricated acceptance decision', change: (report) => { report.performanceAccepted = true; } },
  { name: 'a substituted input identity', change: (report) => { report.inputs.spans.sha256 = '0'.repeat(64); } },
];
for (const mutation of mutations) test('rejects ' + mutation.name, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-owner-batch-diagnostic-'));
  try {
    const report = structuredClone(original); mutation.change(report);
    const filename = path.join(directory, 'corrupted.json');
    fs.writeFileSync(filename, JSON.stringify(report), { flag: 'wx' });
    assert.throws(() => verify(repository, filename));
  } finally {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('rustdom-owner-batch-diagnostic-'));
    fs.rmSync(directory, { recursive: true });
  }
});
