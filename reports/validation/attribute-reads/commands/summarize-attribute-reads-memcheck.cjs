'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = '/home/guido/rustdom-attribute-reads-CBBsRf';
const log = fs.readFileSync(root + '/reports/validation/attribute-reads/native-memory.log', 'utf8');
const path = [...log.matchAll(/Guardado: (reports\/memory\/[^\r\n]+\.json)/g)].at(-1)[1];
const report = JSON.parse(fs.readFileSync(root + '/' + path));
assert.equal(report.pass, true); assert.equal(report.runs.reduce((sum, run) => sum + run.tests.length, 0), 305);
const batches = report.runs.map((run) => {
  const raw = fs.readFileSync(root + '/' + run.logPath, 'utf8');
  const bytes = (kind) => {
    const match = raw.match(new RegExp(kind + ':\\s+([\\d,]+) bytes'));
    if (match) return Number(match[1].replaceAll(',', ''));
    assert.match(raw, /All heap blocks were freed/); return 0;
  };
  const errors = Number(raw.match(/ERROR SUMMARY:\s+(\d+)/)[1]);
  const result = { batch: run.batchIndex, tests: run.tests.length, errors,
    definitelyLost: bytes('definitely lost'), indirectlyLost: bytes('indirectly lost'),
    possiblyLost: bytes('possibly lost'), stillReachable: bytes('still reachable'), log: run.logPath };
  assert.equal(result.errors, 0); assert.equal(result.definitelyLost, 0); assert.equal(result.indirectlyLost, 0);
  return result;
});
const summary = { capturedAt: new Date().toISOString(), report: path, tests: 305, batches,
  scope: 'Rust unit-test executable only; possible/reachable process-exit residues remain visible. The real addon and separate Document/Window lifetimes are exercised by Node contracts and GC, not this Memcheck executable.' };
fs.writeFileSync(root + '/reports/validation/attribute-reads/memcheck-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
