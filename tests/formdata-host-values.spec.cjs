/** @file Compares host-value identity, strict name equality and indexed projection against actual jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { NativeFormDataEntries } = require('../dist/native.cjs');

for (const mode of ['default', 'vm']) {
  test(`should preserve arbitrary FormData host values and projection hooks in ${mode}`, () => {
    const results = [];
    for (const engine of ['jsdom', 'rustdom']) {
      const child = spawnSync(process.execPath, ['tests/helpers/formdata-host-values.cjs', engine, mode], { encoding: 'utf8', timeout: 120_000 });
      assert.equal(child.error, undefined); assert.equal(child.status, 0, child.stderr);
      const data = JSON.parse(child.stdout); assert.equal(data.length, 84); results.push(data);
    }
    assert.deepEqual(results[1], results[0]);
    assert.ok(results[0].every((row) => !row.error));
    const both = (label) => results[1].find((row) => row.label === label && row.globals === 'both');
    assert.equal(both('nan').has, false);
    assert.equal(both('nan').alternateHas, false);
    assert.equal(both('zero').alternateHas, true);
    assert.equal(both('negative-zero').alternateHas, true);
    assert.equal(both('object').alternateHas, false);
    assert.equal(both('function').alternateHas, false);
    assert.equal(results[1].find((row) => row.label === 'typed-iterator').reads, 0);
    assert.equal(results[1].find((row) => row.label === 'array-index-setter').calls, 0);
    assert.equal(results[1].find((row) => row.label === 'typed-length-getter').calls, 0);
  });
}

test('should reject unknown or retired native host names without colliding with later identities', () => {
  const list = new NativeFormDataEntries();
  assert.throws(() => list.appendHost(42, 'invalid'), { code: 'InvalidArg' });
  assert.throws(() => list.setHost(42, 'invalid'), { code: 'InvalidArg' });
  assert.equal(list.length, 0);
  const first = list.appendHost(null, 'first');
  const duplicate = list.appendHost(first, null);
  const text = list.append(String(first), 'literal');
  assert.deepEqual(Array.from(list.hostIds(first)), [first, duplicate]);
  assert.equal(list.firstId(String(first)), text);
  const replacement = list.setHost(first, 'new');
  assert.equal(replacement.id, first); assert.deepEqual(replacement.removed, [duplicate]);
  assert.deepEqual(list.deleteHost(first), [first]);
  assert.throws(() => list.appendHost(first, 'stale'), { code: 'InvalidArg' });
  assert.throws(() => list.setHost(first, 'stale'), { code: 'InvalidArg' });
  for (let index = 0; index < 50; index++) list.appendHost(null, 'new identity');
  assert.equal(list.hasHost(first), false);
  assert.equal(list.hostIds(42).length, 1);
  assert.equal(list.get(String(first)), 'literal');
  for (const id of [0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => list.appendHost(id, null), { code: 'InvalidArg' });
});
