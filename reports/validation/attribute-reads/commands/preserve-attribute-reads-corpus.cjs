'use strict';
const fs = require('node:fs');
const runtime = '/home/guido/rustdom-attribute-reads-CBBsRf';
const bytes = fs.readFileSync(runtime + '/reports/validation/html5lib.json');
const report = JSON.parse(bytes);
if (report.node === 'v24.14.1') {
  fs.writeFileSync(runtime + '/reports/validation/attribute-reads/html5lib-node24.json', bytes);
  console.log(JSON.stringify({ node: report.node, passed: report.passed, mismatches: report.mismatches.length }));
} else console.log(JSON.stringify({ node: report.node, copied: false, reason: 'The per-runtime corpus logs remain authoritative.' }));
