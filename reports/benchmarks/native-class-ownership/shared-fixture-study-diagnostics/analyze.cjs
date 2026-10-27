/** @file Reuses the registered descriptive statistics on all existing shared-fixture trajectories. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const policy = require('./constants/diagnostics.json');

/** Keep all cells, the original pooled medians and the complete rejection unchanged. */
function analyze(repository, input) {
  assert.equal(input.receipt.runId, policy.runId);
  const binaries = require(path.join(repository, 'reports/benchmarks/native-class-ownership/constants/current-ownership.json'));
  assert.equal(createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'), binaries.runtimeExecutableHashes[process.version]);
  const { analyzeSamples } = require(path.join(repository, 'reports/benchmarks/native-class-ownership/current-ownership-diagnostics.cjs'));
  const result = analyzeSamples(input.samples, input.summary, input.receipt);
  return { ...result, revision: policy.revision, sourceSha256: input.sourceSha256,
    warmupDurationsPreserved: input.warmupDurations, limits: policy.limits };
}
if (require.main === module) {
  assert.equal(process.argv.length, 5, 'Provide repository, compact authenticated input and fresh output JSON');
  const [repository, input, output] = process.argv.slice(2);
  const result = analyze(path.resolve(repository), JSON.parse(fs.readFileSync(input, 'utf8')));
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ processes: result.processes, measuredDurations: result.measuredDurations,
    warmupDurations: result.warmupDurationsPreserved, treatmentCells: result.treatmentCells,
    gateReevaluated: result.gateReevaluated, measurementsCollected: result.measurementsCollected }));
}
module.exports = { analyze };
