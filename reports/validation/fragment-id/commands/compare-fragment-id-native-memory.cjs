'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const [root, baselineRoot] = process.argv.slice(2);
function reportPath(repositoryRoot, phase) {
  const log = fs.readFileSync(path.join(repositoryRoot, 'reports/validation', phase, 'native-memory.log'), 'utf8');
  return [...log.matchAll(/Guardado: (reports\/memory\/[^\r\n]+\.json)/g)].at(-1)[1];
}
function summarize(repositoryRoot, relativePath) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
  const report = JSON.parse(bytes); assert.equal(report.pass, true);
  return { reportPath: relativePath, reportSha256: createHash('sha256').update(bytes).digest('hex'),
    tests: report.runs.reduce((total, run) => total + run.tests.length, 0),
    runs: report.runs.map((run) => {
      const log = fs.readFileSync(path.join(repositoryRoot, run.logPath), 'utf8');
      const field = (pattern) => Number(log.match(pattern)?.[1].replaceAll(',', ''));
      return { batch: run.batchIndex + 1, tests: run.tests.length, durationMs: run.durationMs,
        errors: field(/ERROR SUMMARY: ([\d,]+) errors/), definiteBytes: field(/definitely lost:\s+([\d,]+) bytes/),
        indirectBytes: field(/indirectly lost:\s+([\d,]+) bytes/), possibleBytes: field(/possibly lost:\s+([\d,]+) bytes/),
        reachableBytes: field(/still reachable:\s+([\d,]+) bytes/) };
    }) };
}
const baseline = summarize(baselineRoot, reportPath(baselineRoot, 'name-queries'));
const candidate = summarize(root, reportPath(root, 'fragment-id'));
assert.equal(baseline.tests, 285); assert.equal(candidate.tests, 291);
for (const entry of [...baseline.runs, ...candidate.runs]) {
  assert.equal(entry.errors, 0); assert.equal(entry.definiteBytes, 0); assert.equal(entry.indirectBytes, 0);
}
const comparison = { capturedAt: new Date().toISOString(), baseline, candidate,
  scope: 'Historical 285-test control and current 291-test suite, Rust1.99.1/Valgrind3.18.1. New tests shift exact-name batch membership and add a batch; durations are diagnostics, not equivalent performance samples. Full residual allocation stacks remain visible in both sets of logs.' };
fs.writeFileSync(path.join(root, 'reports/validation/fragment-id/native-memory-baseline-comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
console.log(JSON.stringify({ baselineTests: baseline.tests, baselineBatches: baseline.runs.length,
  candidateTests: candidate.tests, candidateBatches: candidate.runs.length, zeroErrorsAndDefiniteIndirectLosses: true }));
