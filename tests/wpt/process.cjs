/** @file Runs one real WPT fixture in a fresh process and waits for process termination before returning. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/execution.cjs');

/**
 * Keep runtime heaps, module caches and native registries out of subsequent fixtures.
 * @param {'jsdom'|'rustdom'} engine - Actual package selected inside the child.
 * @param {string} file - Pinned upstream fixture, optionally including its URL query.
 * @param {object} [options] - Process failsafe, independent of the shared upstream runner multiplier.
 * @returns {object} Unmodified results and scalar process/cleanup evidence.
 */
function executeFixture(engine, file, { timeoutMs = settings.PROCESS_TIMEOUT_MS } = {}) {
  assert.ok(['jsdom', 'rustdom'].includes(engine), 'WPT fixture process: unknown engine');
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, 'WPT fixture process: positive finite process deadline required');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-wpt-fixture-'));
  try {
    const output = path.join(directory, 'result.json');
    const child = spawnSync(process.execPath, [...settings.WORKER_EXEC_ARGV, path.join(__dirname, 'fixture.cjs'), engine, file, output], {
      encoding: 'utf8', timeout: timeoutMs, maxBuffer: settings.MAX_PROCESS_OUTPUT_BYTES,
    });
    if (child.error || child.status !== 0 || child.signal) {
      const diagnostic = (child.stderr || '').slice(0, settings.MAX_ERROR_DIAGNOSTIC_UNITS);
      const error = new Error(`WPT fixture process ${engine}/${file} failed: exit=${child.status} signal=${child.signal} pid=${child.pid}; ${diagnostic}`,
        { cause: child.error });
      error.pid = child.pid;
      error.execution = { engine, file, pid: child.pid, exitCode: child.status, signal: child.signal, processTimeoutMs: timeoutMs,
        stdout: child.stdout, stderr: child.stderr, errorCode: child.error?.code ?? null };
      throw error;
    }
    const { result, ...execution } = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(execution.pid, child.pid); assert.equal(execution.engine, engine); assert.equal(execution.file, file);
    return { result, execution: { ...execution, exitCode: child.status, signal: child.signal, processTimeoutMs: timeoutMs,
      stdout: child.stdout, stderr: child.stderr } };
  } finally {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rustdom-wpt-fixture-'));
    fs.rmSync(resolved, { recursive: true });
  }
}

module.exports = { executeFixture };
