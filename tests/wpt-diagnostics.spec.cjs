/** @file Checks preserved real historical observations, unchanged failure verdicts and filesystem error propagation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { gunzipSync } = require('node:zlib');
const { assertFixtureParity } = require('./wpt/diagnostics.cjs');
const settings = require('./wpt/constants/diagnostics.cjs');
const historical = JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,
  '../reports/validation/native-class-ownership/ci-macos-timeout/fixture.json.gz'))));

/** Own a bounded test directory while preserving the immutable historical observations. */
function temporary(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), settings.TEST_DIRECTORY_PREFIX));
  context.after(() => {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith(settings.TEST_DIRECTORY_PREFIX));
    fs.rmSync(resolved, { recursive: true });
  });
  return directory;
}

test('preserves both complete historical result sets and keeps the reference timeout a failure', (context) => {
  const directory = temporary(context);
  const reference = { result: historical.expected };
  const candidate = { result: historical.actual };
  const original = JSON.stringify({ candidate, reference });
  const outputs = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let failure;
    try { assertFixtureParity(historical.file, candidate, reference, { directory }); }
    catch (error) { failure = error; }
    assert.ok(failure instanceof assert.AssertionError);
    assert.equal(failure.actual, 2); assert.equal(failure.expected, 0);
    assert.equal(failure.code, 'ERR_ASSERTION');
    assert.equal(path.basename(failure.diagnosticsPath), settings.REPORT_FILENAME);
    const saved = JSON.parse(fs.readFileSync(failure.diagnosticsPath));
    assert.deepEqual(saved.reference, reference); assert.deepEqual(saved.candidate, candidate);
    assert.equal(saved.file, historical.file); assert.equal(saved.node, process.version);
    assert.equal(saved.reference.result.tests.length, 2808);
    assert.equal(saved.candidate.result.tests.length, 2808);
    assert.ok(saved.reference.result.tests.every((result) => result.status === 0));
    outputs.push(failure.diagnosticsPath);
  }
  assert.notEqual(outputs[0], outputs[1]);
  assert.equal(JSON.stringify({ candidate, reference }), original);
  assert.equal(fs.readdirSync(directory).length, 2);
});

test('a matching complete historical result produces no diagnostic files', (context) => {
  const directory = path.join(temporary(context), 'unused-output');
  const report = { result: historical.actual };
  assertFixtureParity(historical.file, report, report, { directory });
  assert.equal(fs.existsSync(directory), false);
});

test('retains the original parity assertion as cause when real filesystem preservation fails', (context) => {
  const directory = path.join(temporary(context), 'blocked');
  fs.writeFileSync(directory, 'occupied path\n');
  assert.throws(() => assertFixtureParity(historical.file,
    { result: historical.actual }, { result: historical.expected }, { directory }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.ok(error.cause instanceof assert.AssertionError);
    assert.equal(error.errors[0], error.cause); assert.equal(error.errors.length, 2);
    assert.equal(error.cause.actual, 2); assert.equal(error.cause.expected, 0);
    assert.ok(['EEXIST', 'ENOTDIR'].includes(error.errors[1].code));
    return true;
  });
  assert.equal(fs.readFileSync(directory, 'utf8'), 'occupied path\n');
});
