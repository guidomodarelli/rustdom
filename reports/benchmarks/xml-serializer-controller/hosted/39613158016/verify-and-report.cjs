/** Verify actual hosted observations independently of the experiment's acceptance flags. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(process.argv[2]);
const requestedHead = process.argv[3];
assert.match(requestedHead, /^[a-f0-9]{40}$/);
const report = JSON.parse(fs.readFileSync(path.join(directory, 'experiment.json')));
assert.equal(report.requestedHead, requestedHead);
assert.equal(report.node, 'v24.14.1');
assert.equal(report.jsdom, '27.4.0');
assert.equal(report.platform, 'linux');
assert.equal(report.complete, true);
assert.equal(report.failure, undefined);
assert.equal(report.sourceIdentity.sourceHash, '67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f');
assert.deepEqual(report.sourceIdentity.sourceChanges, []);
assert.deepEqual(report.sourceIdentity.sourceGitErrors, []);
assert.equal(report.baselineSourceIdentity.sourceCommit, '75db9bb095db8457a6ae567f219e2224a55b9f36');
assert.equal(report.baselineSourceIdentity.sourceHash, '993a1efdbd928991028f8831c62ef65fe4612b1797727afda3870c5058a87415');
assert.deepEqual(report.baselineSourceIdentity.sourceChanges, []);
assert.deepEqual(report.baselineSourceIdentity.sourceGitErrors, []);
assert.equal(report.calibration.budgetPercent, 2);
const order = ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B', 'A', 'B', 'B', 'A'];
assert.deepEqual(report.phaseOrder, order);
const median = (values) => { const ordered = [...values].sort((left, right) => left - right); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; };
const identities = new Map();
const stages = { AA: 0, AB: 0, reference: 0 };
for (const run of report.runs) {
  assert.ok(Object.hasOwn(stages, run.stage)); stages[run.stage]++;
  assert.equal(run.exitCode, 0); assert.equal(run.signal, null); assert.equal(run.error, null);
  const raw = JSON.parse(fs.readFileSync(path.join(directory, run.stdoutFile)));
  assert.deepEqual(raw, run.observations);
  assert.equal(raw.node, report.node); assert.equal(raw.engine, run.engine);
  assert.equal(raw.selectedRow, run.rowKey); assert.equal(raw.results.length, 1);
  const row = raw.results[0];
  assert.equal(`${row.name}/${row.size}`, run.rowKey);
  const warmup = row.size <= 16 ? 256 : 16;
  assert.equal(row.batchSize, ({ 1: 64, 16: 16, 100: 4, 1000: 1 })[row.size]);
  assert.equal(row.warmupBatches, warmup); assert.equal(row.warmupBatchMs.length, warmup); assert.equal(row.measuredBatchMs.length, 32);
  assert.ok([...row.warmupBatchMs, ...row.measuredBatchMs].every((value) => Number.isFinite(value) && value > 0));
  if (identities.has(run.rowKey)) assert.equal(row.outputHash, identities.get(run.rowKey));
  else identities.set(run.rowKey, row.outputHash);
  assert.equal(run.runtimeRoot, run.stage === 'AA' || (run.stage === 'AB' && run.label === 'A') ? report.baseline : report.candidate);
  assert.equal(run.engine, run.stage === 'reference' && run.label === 'A' ? 'jsdom' : 'rustdom');
  if (run.engine === 'rustdom') {
    const statistics = raw.statistics;
    assert.equal(statistics.xmlSerialization.live, 0); assert.equal(statistics.xmlSerialization.references, 0); assert.equal(statistics.xmlSerialization.cleanupErrors, 0);
    if (run.runtimeRoot === report.candidate) {
      const direct = row.name === 'xml-serialize' || row.name === report.settings.XML_SERIALIZER_GETTER_ERROR_WORKLOAD;
      assert.equal(statistics.xmlSerializerOperations.calls, direct ? (warmup + 32) * row.batchSize : 0);
      assert.equal(statistics.xmlSerializerOperations.active, 0);
    }
  }
}
assert.equal(identities.size, 13);
function verifyRows(stage, rows, phaseOrder) {
  assert.equal(rows.length, 13);
  for (const row of rows) {
    const runs = report.runs.filter((run) => run.stage === stage && run.rowKey === `${row.name}/${row.size}`);
    assert.deepEqual(runs.map((run) => run.label), phaseOrder);
    const samples = { A: [], B: [] };
    for (const run of runs) samples[run.label].push(...run.observations.results[0].measuredBatchMs.map((value) => value / run.observations.results[0].batchSize));
    assert.deepEqual(row.samplesPerLabel, { A: phaseOrder.length * 16, B: phaseOrder.length * 16 });
    assert.equal(row.baselineMs, median(samples.A)); assert.equal(row.candidateMs, median(samples.B));
    assert.equal(row.changePercent, (row.candidateMs / row.baselineMs - 1) * 100);
    assert.equal(row.outputHash, identities.get(`${row.name}/${row.size}`));
  }
}
verifyRows('AA', report.calibration.rows, order);
assert.equal(report.calibration.pass, report.calibration.rows.every((row) => Math.abs(row.changePercent) <= 2));
if (report.calibration.pass) {
  assert.deepEqual(stages, { AA: 208, AB: 208, reference: 52 });
  verifyRows('AB', report.comparisons, order);
  verifyRows('reference', report.referenceComparison, ['A', 'B', 'B', 'A']);
  assert.equal(report.regressionBudgetPercent, 5);
  assert.equal(report.accepted, report.comparisons.every((row) => row.changePercent <= 5));
} else {
  assert.deepEqual(stages, { AA: 208, AB: 0, reference: 0 });
  assert.deepEqual(report.comparisons, []); assert.equal(report.referenceComparison, undefined); assert.equal(report.accepted, null);
}
const verification = { requestedHead, candidateSourceCommit: report.sourceIdentity.sourceCommit,
  sourceHash: report.sourceIdentity.sourceHash, baselineHash: report.baselineSourceIdentity.sourceHash,
  stages, verifiedRuns: report.runs.length, verificationPass: true,
  calibrationPass: report.calibration.pass, accepted: report.accepted,
  performanceAcceptanceComplete: report.calibration.pass && report.accepted === true };
fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify(verification));
