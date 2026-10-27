/** @file Exercises process-isolated WPT with real fixtures and packages, including the macOS regression case. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { gunzipSync } = require('node:zlib');
const { executeFixture } = require('./process.cjs');
const { assertWptParity } = require('./comparison.cjs');
const { assertFixtureParity } = require('./diagnostics.cjs');
const settings = require('./constants/execution.cjs');

/** Assert observable process termination, not merely a message saying teardown ran. */
function assertExited(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
}

for (const [file, count] of [
  ['dom/nodes/DocumentFragment-getElementById.html', 5],
  ['dom/ranges/Range-mutations-dataChange.html', 2808],
]) {
  test(`isolated real engines preserve all results and terminate after ${file}`, (context) => {
    const reference = executeFixture('jsdom', file);
    const candidate = executeFixture('rustdom', file);
    context.diagnostic(JSON.stringify({ file, testCount: count, reference: reference.execution, candidate: candidate.execution }));
    assertFixtureParity(file, candidate, reference);
    assert.equal(reference.result.tests.length, count);
    assert.equal(candidate.result.tests.length, count);
    assert.notEqual(reference.execution.pid, candidate.execution.pid);
    for (const report of [reference, candidate]) {
      assert.equal(report.result.status, 0); assert.equal(report.execution.node, process.version);
      assert.deepEqual(report.execution.execArgv, settings.WORKER_EXEC_ARGV);
      assert.equal(report.execution.exitCode, 0); assert.equal(report.execution.signal, null);
      assert.equal(report.execution.processTimeoutMs, settings.PROCESS_TIMEOUT_MS);
      assert.equal(report.execution.timeoutMultiplier, settings.WPT_TIMEOUT_MULTIPLIER);
      assertExited(report.execution.pid);
    }
  });
}

for (const engineName of ['jsdom', 'rustdom']) {
  test(`the real ${engineName} WPT harness still times out with the shared runner multiplier`,
    { timeout: settings.PROCESS_TIMEOUT_MS }, async () => {
      const engine = engineName === 'jsdom' ? require('jsdom') : require('../../dist/index.cjs');
      const harness = fs.readFileSync(path.join(__dirname, '../fixtures/wpt/resources/testharness.js'), 'utf8');
      let dom;
      let timer;
      let declaredMultiplier;
      try {
        const result = await new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`WPT ${engineName}: real harness did not enforce its global deadline`)), settings.TEST_TIMEOUT_MS);
          dom = new engine.JSDOM('<!doctype html><title>Runner deadline</title>', { runScripts: 'outside-only' });
          dom.window.__wptDone = (json) => resolve(JSON.parse(json));
          dom.window.__wptStarted = (properties) => { declaredMultiplier = properties.timeout_multiplier; };
          dom.window.eval(harness);
          // Leave the file open after one passing test, exercising a real global timeout.
          dom.window.eval('setup({explicit_done:true});');
          dom.window.eval(settings.REPORTER);
          dom.window.eval('add_start_callback(__wptStarted);test(()=>assert_true(true),"passes before the harness deadline");');
        });
        assert.equal(declaredMultiplier, settings.WPT_TIMEOUT_MULTIPLIER);
        assert.equal(result.status, 2);
        assert.equal(result.tests.length, 1);
        assert.equal(result.tests[0].status, 0);
      } finally { clearTimeout(timer); dom?.window.close(); }
    });
}

test('process failures preserve diagnostics and the real worker is reaped at its parent deadline', () => {
  let failure;
  try { executeFixture('jsdom', 'dom/nodes/DocumentFragment-getElementById.html', { timeoutMs: 1 }); }
  catch (error) { failure = error; }
  assert.ok(failure); assert.equal(failure.cause.code, 'ETIMEDOUT');
  assert.equal(failure.execution.engine, 'jsdom'); assert.equal(failure.execution.errorCode, 'ETIMEDOUT');
  assert.equal(failure.execution.processTimeoutMs, 1);
  assertExited(failure.pid);
});

test('unknown engines, invalid process deadlines and missing upstream fixtures fail explicitly', () => {
  assert.throws(() => executeFixture('invalid', 'missing.html'), /unknown engine/);
  for (const timeoutMs of [0, -1, Infinity]) assert.throws(() => executeFixture('jsdom', 'missing.html', { timeoutMs }), /deadline required/);
  let failure;
  try { executeFixture('jsdom', 'missing.html'); } catch (error) { failure = error; }
  assert.ok(failure); assert.match(failure.execution.stderr, /Unknown WPT fixture/); assertExited(failure.pid);
});

test('a real fixture worker cannot overwrite an earlier result before loading the runtime', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-wpt-output-test-'));
  try {
    const output = path.join(directory, 'result.json'); fs.writeFileSync(output, 'previous evidence\n');
    const child = spawnSync(process.execPath, [...settings.WORKER_EXEC_ARGV, path.join(__dirname, 'fixture.cjs'),
      'jsdom', 'dom/nodes/DocumentFragment-getElementById.html', output], { encoding: 'utf8', timeout: settings.PROCESS_TIMEOUT_MS });
    assert.equal(child.status, 1); assert.match(child.stderr, /EEXIST/);
    assert.equal(fs.readFileSync(output, 'utf8'), 'previous evidence\n'); assertExited(child.pid);
  } finally {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rustdom-wpt-output-test-'));
    fs.rmSync(resolved, { recursive: true });
  }
});

test('the recorded macOS reference timeout remains a parity failure despite every individual test passing', () => {
  const archive = path.resolve(__dirname, '../../reports/validation/native-class-ownership/ci-macos-timeout');
  for (const relative of ['fixture.json.gz', '39686199408/fixture.json.gz']) {
    const row = JSON.parse(gunzipSync(fs.readFileSync(path.join(archive, relative))));
    assert.equal(row.expected.status, 2); assert.equal(row.actual.status, 0);
    assert.deepEqual(row.expected.tests, row.actual.tests); assert.equal(row.expected.tests.length, 2808);
    assert.throws(() => assertWptParity(row.file, row.actual, row.expected));
  }
});

test('the recorded Windows reference timeout remains a failure despite all 2808 assertions passing', () => {
  const filename = path.resolve(__dirname,
    '../../reports/validation/native-class-ownership/ci-windows-timeout/39894045206/comparison.json.gz');
  const report = JSON.parse(gunzipSync(fs.readFileSync(filename)));
  const expected = report.reference.result;
  const actual = report.candidate.result;
  assert.equal(expected.status, 2); assert.equal(actual.status, 0);
  assert.equal(expected.tests.length, 2808);
  assert.deepEqual(actual.tests, expected.tests);
  assert.ok(expected.tests.every((entry) => entry.status === 0));
  assert.throws(() => assertWptParity(report.file, actual, expected));
});
