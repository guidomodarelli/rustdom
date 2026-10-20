'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = '/home/guido/rustdom-element-relatives-Tl8Wt9';
const baselineRoot = '/home/guido/rustdom-collection-members-Iptvms';
const baselinePath = 'reports/memory/2026-10-20T19-17-36.835Z-valgrind.json';
const output = fs.readFileSync(path.join(root, 'reports/validation/element-relatives/native-memory.log'), 'utf8');
const candidatePath = [...output.matchAll(/Guardado: (reports\/memory\/[^\r\n]+\.json)/g)].at(-1)[1];
function summarize(repositoryRoot, reportPath) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, reportPath));
  const report = JSON.parse(bytes);
  assert.equal(report.pass, true);
  return { reportPath, reportSha256: createHash('sha256').update(bytes).digest('hex'),
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
const baseline = summarize(baselineRoot, baselinePath);
const candidate = summarize(root, candidatePath);
for (const entry of [...baseline.runs, ...candidate.runs]) {
  assert.equal(entry.errors, 0); assert.equal(entry.definiteBytes, 0); assert.equal(entry.indirectBytes, 0);
}
const comparison = { capturedAt: new Date().toISOString(), baseline, candidate,
  scope: 'Historical 275-test control and current 281-test suite, Rust1.99.1/Valgrind3.18.1. New tests shift exact-name batch membership; durations are diagnostics and must not be treated as equivalent performance samples. Full residual allocations remain visible in both logs.' };
fs.writeFileSync(path.join(root, 'reports/validation/element-relatives/native-memory-baseline-comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
console.log(JSON.stringify(comparison));
