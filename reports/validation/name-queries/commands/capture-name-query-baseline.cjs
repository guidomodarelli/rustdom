'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = '/home/guido/rustdom-name-queries-ui9xbm';
const source = fs.readFileSync(root + '/tests/name-queries.spec.cjs');
const path = root + '/reports/validation/name-queries/baseline.json';
const report = JSON.parse(fs.readFileSync(path));
for (const node of ['v22.12.0', 'v24.14.1']) assert.match(fs.readFileSync(`${root}/reports/validation/name-queries/baseline-${node}.log`, 'utf8'), /(?:ℹ|#) pass 54/);
fs.writeFileSync(root + '/reports/validation/name-queries/baseline.spec.cjs', source);
report.fixture = { path: 'tests/name-queries.spec.cjs', snapshot: 'reports/validation/name-queries/baseline.spec.cjs',
  sha256: createHash('sha256').update(source).digest('hex'), testsPerNode: 54, nodes: ['22.12.0', '24.14.1'], capturedAt: new Date().toISOString() };
fs.writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ captured: true, fixture: report.fixture }));
