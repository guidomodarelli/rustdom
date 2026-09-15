/** @file Isolates host Symbol mutations while comparing real FormData construction with jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const mode of ['default', 'vm']) {
  for (const mutation of ['null', 'replacement', 'getter']) {
    test(`should preserve FormData construction when host Symbol is ${mutation} in ${mode}`, () => {
      const child = spawnSync(process.execPath, [path.join(__dirname, 'helpers/form-data-intrinsics.cjs'), mode, mutation], {
        encoding: 'utf8', timeout: 120_000,
      });
      assert.equal(child.error, undefined);
      assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
      const observed = JSON.parse(child.stdout);
      assert.deepEqual(observed.rustdom, observed.jsdom);
      assert.equal(observed.jsdom.symbolReads, 0);
      assert.equal(observed.jsdom.preservedFailure, true);
      assert.equal(observed.jsdom.fileIdentity, true);
      assert.deepEqual(observed.jsdom.duplicates, ['first', 'last']);
      assert.equal(observed.jsdom.selectFailure.name, mutation === 'getter' ? 'Error' : 'TypeError');
      assert.deepEqual(observed.jsdom.values, [
        ['field', 'first'], ['field', 'last'],
        ['upload', { name: 'upload.txt', type: 'text/plain', size: 7 }],
      ]);
    });
  }
}
