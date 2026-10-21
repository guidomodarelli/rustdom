'use strict';
const fs = require('node:fs');
for (const relative of ['reports/compatibility/2026-10-21T12-18-36.151Z-linux-wpt.json', 'reports/compatibility/2026-10-21T12-11-17.133Z-linux-wpt.json', 'reports/distribution/2026-10-21T12-12-08.277Z-linux-x64.json', 'reports/distribution/2026-10-21T12-10-35.254Z-linux-x64.json']) {
  const report = JSON.parse(fs.readFileSync(relative));
  console.log(JSON.stringify({ relative, keys: Object.keys(report), node: report.node, pass: report.pass, complete: report.complete,
    fixtures: report.results?.length, tests: report.results?.reduce((total, result) => total + result.expected.tests.length, 0),
    sharedFailures: report.results?.reduce((total, result) => total + result.expected.tests.filter((test) => test.status !== 0).length, 0), runs: report.runs?.length }));
}
