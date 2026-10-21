/** @file Exercises the early CI gate against actual immutable sources and real changed source bytes. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { historicalSources } = require('./fixtures/history-sources/materialize.cjs');
const { inspectSources } = require('./source-preflight.cjs');

test('accepts the two actual source trees declared by the hosted method without building packages', (context) => {
  const roots = historicalSources(context);
  const result = inspectSources(roots.baseline, roots.candidate);
  assert.equal(result.declared, true); assert.deepEqual(result.actual, result.expected);
  assert.equal(fs.existsSync(path.join(roots.candidate, 'dist')), false);
});

test('detects a real harness change before compiled artifacts are available', (context) => {
  const roots = historicalSources(context);
  fs.appendFileSync(path.join(roots.candidate, 'benchmarks/worker.cjs'), '\n');
  const result = inspectSources(roots.baseline, roots.candidate);
  assert.equal(result.declared, false); assert.notEqual(result.actual.B, result.expected.B);
  assert.equal(fs.existsSync(path.join(roots.candidate, 'dist')), false);
});

test('also rejects a real change in the declared reference', (context) => {
  const roots = historicalSources(context);
  fs.appendFileSync(path.join(roots.baseline, 'src/dom/tree.rs'), '\n');
  const result = inspectSources(roots.baseline, roots.candidate);
  assert.equal(result.declared, false); assert.notEqual(result.actual.A, result.expected.A);
});

test('the real preflight CLI rejects changed sources and preserves existing evidence without starting workers', (context) => {
  const roots = historicalSources(context);
  fs.appendFileSync(path.join(roots.candidate, 'benchmarks/worker.cjs'), '\n');
  const sentinel = path.join(roots.candidate, 'preserved-evidence.json');
  fs.writeFileSync(sentinel, 'existing evidence\n');
  const before = fs.readdirSync(roots.candidate).sort();
  const child = spawnSync(process.execPath, [path.join(__dirname, 'source-preflight.cjs'), roots.baseline, roots.candidate], { encoding: 'utf8' });
  assert.ifError(child.error); assert.equal(child.status, 1);
  assert.equal(JSON.parse(child.stdout).declared, false);
  assert.match(child.stderr, /before building or measuring/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'existing evidence\n');
  assert.deepEqual(fs.readdirSync(roots.candidate).sort(), before);
});
