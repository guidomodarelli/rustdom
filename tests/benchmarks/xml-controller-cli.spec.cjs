/** @file Exercises the real experiment CLI's protection of historical results and invalid affinity input. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, unlinkSync, rmdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { XML_SERIALIZER_CLI_CONTRACT_TIMEOUT_MS } = require('../../benchmarks/constants/xml-serializer-controller.cjs');

test('should preserve an existing experiment directory before loading or running any engine', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rustdom-xml-history-')), marker = join(directory, 'sentinel.json');
  const historical = { preserved: true, measurements: [3, 2, 1] };
  writeFileSync(marker, JSON.stringify(historical));
  try {
    const result = spawnSync(process.execPath, ['benchmarks/xml-controller-experiment.cjs', '--baseline', resolve('.'), '--output', directory, '--cpu', '0'], { encoding: 'utf8', timeout: XML_SERIALIZER_CLI_CONTRACT_TIMEOUT_MS });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /output directory already exists/);
    assert.deepEqual(readdirSync(directory), ['sentinel.json']);
    assert.deepEqual(JSON.parse(readFileSync(marker)), historical);
  } finally { unlinkSync(marker); rmdirSync(directory); }
});

test('should reject negative CPU affinity without creating an experiment or touching history', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rustdom-xml-affinity-')), output = join(directory, 'new-experiment');
  try {
    const result = spawnSync(process.execPath, ['benchmarks/xml-controller-experiment.cjs', '--baseline', resolve('.'), '--output', output, '--cpu=-1'], { encoding: 'utf8', timeout: XML_SERIALIZER_CLI_CONTRACT_TIMEOUT_MS });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /cpu must be a nonnegative integer/);
    assert.equal(existsSync(output), false); assert.deepEqual(readdirSync(directory), []);
  } finally { rmdirSync(directory); }
});
