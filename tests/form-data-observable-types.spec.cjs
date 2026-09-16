/** @file Characterizes sequential checkbox/radio checks against the independent pinned implementation. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { observe } = require('./helpers/form-data-observable-types.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const native = require('../dist/native.cjs');
const capturedAt = new Date().toISOString();
const observations = [];
for (const mode of ['default', 'vm']) for (const type of ['checkbox', 'radio', 'text']) for (const checked of [true, false]) {
  for (const effect of ['none', 'rename-second', 'rename-third', 'throw-second', 'throw-third', 'checked-throw', 'switch-checkbox-to-radio']) {
    test(`should preserve ${type} reads when checked=${checked} with ${effect} in ${mode}`, () => {
      const options = { mode, type, checked, effect };
      const expected = observe(engines.jsdom, options);
      const before = native.formDataConstructionStatistics().builds;
      const actual = observe(engines.rustdom, options);
      observations.push({ ...options, expected, actual });
      assert.deepEqual(actual, expected);
      assert.ok(native.formDataConstructionStatistics().builds > before);
      assert.equal(native.formDataConstructionStatistics().active, 0);
      if (type === 'checkbox' && checked && effect === 'rename-third') {
        assert.deepEqual(expected.entries, [['renamed', 'value']]);
        assert.ok(expected.trace.indexOf('type:3') < expected.trace.indexOf('attribute:name'));
      }
      if (type === 'checkbox' && checked && effect === 'switch-checkbox-to-radio') {
        assert.deepEqual(expected.entries, []);
        assert.ok(expected.trace.includes('checked:true')); assert.ok(expected.trace.includes('checked:false'));
      }
    });
  }
}
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${capturedAt.replaceAll(':', '-')}-formdata-observable-types.json`, `${JSON.stringify({
    capturedAt, node: process.version, jsdom: require('jsdom/package.json').version, cases: observations,
  }, null, 2)}\n`);
});