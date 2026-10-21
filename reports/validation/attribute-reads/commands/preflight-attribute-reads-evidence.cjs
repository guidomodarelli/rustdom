'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = '/home/guido/rustdom-attribute-reads-CBBsRf';
const read = (name) => fs.readFileSync(root + '/reports/validation/attribute-reads/' + name, 'utf8');
for (const name of ['javascript-tests.log', 'full-node22.log']) {
  const log = read(name).replace(/\x1b\[[0-9;]*m/g, '');
  assert.match(log, /(?:ℹ|#) pass 3638/); assert.match(log, /Tests:\s+21 passed, 21 total/);
  assert.equal([...log.matchAll(/Tests\s+32 passed/g)].length, 2);
}
const wpt = [];
for (const name of ['wpt-contracts.log', 'wpt-node22.log']) {
  const path = [...read(name).matchAll(/Guardado: (reports\/compatibility\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(fs.readFileSync(root + '/' + path));
  assert.equal(report.pass, true); assert.equal(report.complete, false); assert.equal(report.results.length, 240);
  wpt.push({ node: report.node, fixtures: report.results.length,
    assertions: report.results.reduce((sum, result) => sum + result.actual.tests.length, 0),
    sharedFailures: report.results.reduce((sum, result) => sum + result.actual.tests.filter((test) => test.status !== 0).length, 0) });
}
const memory = [];
for (const version of ['v22.12.0', 'v24.14.1']) {
  const path = [...read('gc-' + version + '.log').matchAll(/Guardado: (reports\/memory\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(fs.readFileSync(root + '/' + path));
  assert.equal(report.pass, true); assert.equal(report.cases.length, 32);
  const endpoints = report.cases.filter((sample) => sample.endpoint);
  for (const sample of endpoints) { assert.equal(sample.endpoint.reached, true); assert.ok(Object.values(sample.endpoint.state.survivors).every((count) => count === 0)); }
  memory.push({ node: report.node, scenarios: report.cases.length, clearEndpoints: endpoints.length });
}
console.log(JSON.stringify({ fullNodeTests: 3638, jest: 21, vitest: 32, vm: 32, wpt, memory }));
