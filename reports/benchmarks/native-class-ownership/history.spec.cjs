/** @file Exercises evidence selection against real candidate/reference trees and the failed hosted experiment. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { canReuse } = require('./history.cjs');
const baseline = path.resolve(process.env.RUSTDOM_OWNERSHIP_BASELINE ?? '.baseline');
const archive = path.join(__dirname, 'hosted/39643090437');
const candidate = path.resolve(__dirname, '../../..');

test('selects identical real sources even when the verified experiment did not accept its budget', () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(archive, 'index.json'))).accepted, false);
  assert.equal(canReuse(baseline, archive, candidate), true);
});

test('rejects evidence for another real candidate implementation', () => {
  assert.equal(canReuse(baseline, archive, baseline), false);
});

test('reports absent evidence without creating an experiment or touching its directory', () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-history-empty-'));
  try {
    assert.equal(canReuse(baseline, directory, candidate), false);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally { fs.rmdirSync(directory); }
});
