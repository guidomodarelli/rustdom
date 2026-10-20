'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
const destination = process.argv[3];
const engines = { jsdom: require(root + '/node_modules/jsdom'), rustdom: require(root + '/dist/index.cjs') };
const observations = {};
for (const [engine, runtime] of Object.entries(engines)) {
  const { window } = new runtime.JSDOM('<!doctype html><body>');
  try {
    const document = window.document;
    const first = document.createElement('div'); first.id = 'chosen'; first.setAttribute('data-key', 'first');
    const second = document.createElement('div'); second.id = 'chosen'; second.setAttribute('data-key', 'second');
    document.body.append(first, second);
    const duplicateOrder = [document.getElementById('chosen').getAttribute('data-key')];
    first.id = 'other'; first.id = 'chosen';
    duplicateOrder.push(document.getElementById('chosen').getAttribute('data-key'));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const absentEmpty = svg.getElementById('') === null;
    svg.setAttributeNS(null, 'id', 'self');
    const inclusive = svg.getElementById('self') === svg;
    svg.setAttributeNS(null, 'id', '');
    const explicitEmpty = svg.getElementById('') === svg;
    observations[engine] = { duplicateOrder, physicalOrder: Array.from(document.body.children, (node) => node.getAttribute('data-key')),
      svg: { absentEmpty, inclusive, explicitEmpty } };
  } finally { window.close(); }
}
assert.deepEqual(observations.rustdom, observations.jsdom);
const report = { capturedAt: new Date().toISOString(), node: process.version,
  baseline: 'checkpoint-062-name-queries', baselinePublishedHead: '645f2ec514986f51893d8cb7f01b50610da54eec',
  reference: require(root + '/node_modules/jsdom/package.json').version, observations };
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
