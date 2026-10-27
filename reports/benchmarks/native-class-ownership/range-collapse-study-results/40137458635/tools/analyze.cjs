/** @module range-analysis Exports a complete authenticated run with the unchanged decision, every span and finite resources. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSources, policy } = require('./analysis-source.cjs');
const { spanRows, createAggregate, addWorker, finishAggregate } = require('./worker-exports.cjs');
const { comparisonRows, classifyFailures } = require('./comparison-exports.cjs');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/**
 * Bind export to the fixed current verifier and the unchanged resource predicate.
 * @param {string} repository - Actual clean Linux checkout of source02291d6b.
 * @returns {object} Full-run analyzer plus scalar helpers for independently identified reference data.
 */
function createAnalyzer(repository) {
  repository = fs.realpathSync(repository);
  const { study, settings, format, summarizeWorker, csvLine } = loadSources(repository);

  /**
   * Preserve all data without executing DOM, and export only after the entire new study verifies.
   * @param {string} capture - Authenticated capture root, never a source of executable modules.
   * @param {string} output - Fresh export directory disjoint from both input and source checkout.
   * @returns {object} Original full-run decision, counts and all favorable/unfavorable comparisons.
   */
  function analyze(capture, output) {
    capture = fs.realpathSync(capture);
    output = path.join(fs.realpathSync(path.dirname(path.resolve(output))), path.basename(output));
    for (const input of [capture, repository]) {
      assert.ok(output !== input && !output.startsWith(input + path.sep) && !input.startsWith(output + path.sep),
        'Range analysis: preserve the original capture and read-only source checkout');
    }
    const index = read(path.join(capture, 'index.json'));
    assert.equal(index.sourceCommit, policy.sourceCommit);
    assert.equal(index.hostedRunId, String(policy.runId));
    assert.equal(index.revision, policy.revision); assert.equal(index.complete, true);
    const verification = study.verify(capture);
    fs.mkdirSync(output);
    const descriptors = [];
    const aggregate = createAggregate();
    try {
      const spans = fs.openSync(path.join(output, format.files.spans), 'wx'); descriptors.push(spans);
      const comparisonsFile = fs.openSync(path.join(output, format.files.comparisons), 'wx'); descriptors.push(comparisonsFile);
      fs.writeSync(spans, csvLine(format.spanColumns)); fs.writeSync(comparisonsFile, csvLine(format.comparisonColumns));
      const workersPerNode = study.plan().length;
      for (const [ordinal] of index.processes.entries()) {
        const runtime = Math.floor(ordinal / workersPerNode);
        const directory = path.join(capture, policy.workerDirectories[runtime], String(ordinal % workersPerNode).padStart(policy.workerOrdinalDigits, '0'));
        const report = read(path.join(directory, 'report.json'));
        addWorker(aggregate, report, summarizeWorker(report));
        for (const row of spanRows(report)) fs.writeSync(spans, csvLine(format.spanColumns.map((name) => row[name])));
      }
      const comparisons = comparisonRows(verification, settings);
      for (const row of comparisons) fs.writeSync(comparisonsFile, csvLine(format.comparisonColumns.map((name) => row[name])));
      const failures = classifyFailures(comparisons, settings);
      const { totals, groups } = finishAggregate(aggregate);
      assert.equal(totals.processes, verification.processes);
      assert.equal(totals.measuredSpans, verification.measuredDurations); assert.equal(totals.warmupSpans, verification.warmupDurations);
      assert.equal(totals.windows, totals.processes * (settings.warmupSamples + settings.measuredSamples));
      assert.equal(totals.documents, totals.windows); assert.equal(totals.requiredFinalClearStates, totals.processes * settings.requiredClearRounds);
      assert.deepEqual(index.parentMemory.map((entry) => entry.stage), ['before-workers', ...settings.nodeVersions.map((node) => `after-${node}`)]);
      for (const snapshot of index.parentMemory) for (const name of format.memoryFields) assert.ok(Number.isFinite(snapshot.state[name]) && snapshot.state[name] >= 0);
      const limits = [...format.limits, ...policy.additionalLimits];
      const memory = { runId: policy.runId, sourceCommit: policy.sourceCommit, totals, groups,
        parentSnapshots: index.parentMemory, machine: index.machine, runtimes: index.runtimes, limits };
      const result = { runId: policy.runId, sourceCommit: policy.sourceCommit, executionComplete: true,
        verified: verification.verified, performanceAccepted: verification.accepted, historicalGateReevaluated: false,
        analyzerExecutedDOM: false, totals, comparisons, failures, machine: index.machine, runtimes: index.runtimes, limits };
      for (const [name, value] of [[format.files.summary, result], [format.files.memory, memory]]) {
        fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
      }
      return result;
    } finally { for (const descriptor of descriptors) fs.closeSync(descriptor); }
  }
  return { analyze, summarizeWorker, spanRows, csvLine, settings, format };
}
if (require.main === module) {
  assert.equal(process.argv.length, 5, 'Provide fixed source checkout, authenticated capture and fresh output');
  const [repository, capture, output] = process.argv.slice(2).map((value) => path.resolve(value));
  const result = createAnalyzer(repository).analyze(capture, output);
  console.log(JSON.stringify({ verified: result.verified, performanceAccepted: result.performanceAccepted, totals: result.totals,
    jsdomControlFailures: result.failures.jsdomControls.length, rustNumericFailures: result.failures.rustNumeric.length }));
}
module.exports = { createAnalyzer };
