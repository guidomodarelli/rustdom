/** @file Isolates host collection mutation and exercises actual FormData public contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const mode of ['default', 'vm']) {
  for (const collection of ['Map', 'WeakMap', 'Set']) {
    for (const mutation of ['null', 'replacement', 'getter']) {
      test(`should preserve FormData operations when host ${collection} is ${mutation} in ${mode}`, () => {
        const child = spawnSync(process.execPath, [path.join(__dirname, 'helpers/form-data-collections.cjs'), mode, collection, mutation], {
          encoding: 'utf8', timeout: 120_000,
        });
        assert.equal(child.error, undefined);
        assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
        const observed = JSON.parse(child.stdout);
        assert.deepEqual(observed.rustdom, observed.jsdom);
        assert.equal(observed.jsdom.globalReads, 0);
        assert.deepEqual(observed.jsdom.emptyInitially, []);
        assert.deepEqual(observed.jsdom.all, ['one', 'two']);
        assert.equal(observed.jsdom.fileIdentity, true);
        assert.equal(observed.jsdom.formFileIdentity, true);
        assert.deepEqual(observed.jsdom.mutated, [['text', 'replacement']]);
        assert.deepEqual(observed.jsdom.constructed, [
          ['text', 'first'], ['text', 'second'],
          ['upload', { name: 'input.txt', size: 7, type: 'text/plain' }],
        ]);
        assert.deepEqual(observed.jsdom.cached, [
          ['duplicate', 'replacement'], ['kept', { name: 'input.txt', size: 7, type: 'text/plain' }],
        ]);
      });
    }
  }
}
