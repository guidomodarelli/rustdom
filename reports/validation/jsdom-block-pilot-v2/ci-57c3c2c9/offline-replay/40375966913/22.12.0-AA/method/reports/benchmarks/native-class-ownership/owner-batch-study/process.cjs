/** @module owner-batch-process Owns exactly one fresh Linux process group and preserves raw logs, bounded timeout and cancellation diagnostics. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { failureView } = require('./batches.cjs');
const policy = require('./constants/process.json');

/** @param {number} group - Group created exclusively by this invocation. @returns {object[]} Actual surviving group members, including terminal zombies. */
function groupMembers(group) {
  const members = [];
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    let raw;
    try { raw = fs.readFileSync('/proc/' + name + '/stat', 'utf8'); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ESRCH') continue; throw error; }
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    if (Number(fields[2]) === group) members.push({ pid: Number(name), state: fields[0] });
  }
  return members;
}

/** SIGKILL delivery is asynchronous: observe every owned member reaching a terminal state before returning. */
async function awaitGroupTermination(record) {
  const deadline = performance.now() + policy.cleanupTimeoutMs;
  while (true) {
    const members = groupMembers(record.pid);
    record.observedProcessGroupMembers = members;
    if (members.every((member) => ['Z', 'X'].includes(member.state))) {
      record.processGroupTerminationObserved = true;
      return;
    }
    assert.ok(performance.now() < deadline, 'Owner batch process: owned group remained active after SIGKILL: ' + JSON.stringify(members));
    await new Promise((resolve) => setTimeout(resolve, policy.cleanupPollIntervalMs));
  }
}

/**
 * Execute one declared process without retries. Its whole new process group is terminated on deadline or caller cancellation.
 * @param {string[]} argv - Actual executable and fixed arguments, never a shell command string.
 * @param {string} directory - Fresh process evidence directory with an existing parent.
 * @param {{timeoutMs:number,signal?:AbortSignal,cwd?:string,environment?:object}} options - Explicit bounded lifecycle.
 * @returns {Promise<object>} Actual PID, exit, signal, elapsed time and original diagnostic; no performance decision.
 */
async function execute(argv, directory, { timeoutMs, signal, cwd = process.cwd(), environment = process.env }) {
  assert.equal(process.platform, 'linux', 'Owner batch process: Linux process-group ownership required');
  assert.ok(Array.isArray(argv) && argv.length > 0 && argv.every((entry) => typeof entry === 'string'));
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0);
  assert.equal(fs.existsSync(directory), false, 'Owner batch process: preserve existing logs');
  if (signal?.aborted) throw new Error('Owner batch process: cancellation preceded launch', { cause: signal.reason });
  fs.mkdirSync(directory);
  const record = { argv: [...argv], cwd, pid: null, complete: false, exitCode: null, signal: null,
    timedOut: false, cancelled: false, processGroupTerminationAttempted: false, startedAt: new Date().toISOString() };
  const save = () => fs.writeFileSync(path.join(directory, policy.commandFile), JSON.stringify(record, null, 2) + '\n');
  save();
  const start = performance.now(); let stdout; let stderr; let timer; let child; let completion;
  let failed = false; let originalFailure;
  const terminate = (reason) => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    if (reason === 'timeout') record.timedOut = true;
    else record.cancelled = true;
    record.processGroupTerminationAttempted = true;
    try { process.kill(-child.pid, policy.killSignal); record.processGroupTerminationSucceeded = true; }
    catch (error) {
      if (error.code === 'ESRCH') record.processAlreadyExitedAtCleanup = true;
      else { record.processGroupTerminationFailure = failureView(error); child.kill(policy.killSignal); }
    }
  };
  const abort = () => terminate('cancelled');
  try {
    stdout = fs.openSync(path.join(directory, policy.stdoutFile), 'wx');
    stderr = fs.openSync(path.join(directory, policy.stderrFile), 'wx');
    child = spawn(argv[0], argv.slice(1), { cwd, env: environment, detached: true,
      stdio: ['ignore', stdout, stderr] });
    completion = new Promise((resolve) => {
      child.once('error', (error) => { record.failure = failureView(error); });
      child.once('close', (code, childSignal) => { record.exitCode = code; record.signal = childSignal; resolve(); });
    });
    record.pid = child.pid ?? null; save();
    timer = setTimeout(() => terminate('timeout'), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    await completion;
    if (record.pid !== null && !record.processGroupTerminationAttempted) {
      try {
        process.kill(-record.pid, 0);
        record.leftoverProcessGroupDetected = true;
        record.processGroupTerminationAttempted = true;
        process.kill(-record.pid, policy.killSignal);
        record.processGroupTerminationSucceeded = true;
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    if (record.pid !== null && record.processGroupTerminationAttempted) await awaitGroupTermination(record);
    record.complete = true;
  } catch (error) {
    failed = true; originalFailure = error; record.failure = failureView(error);
    terminate('cancelled');
    if (completion) await completion;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    for (const descriptor of [stdout, stderr]) if (descriptor !== undefined) fs.closeSync(descriptor);
    record.elapsedMs = performance.now() - start; record.finishedAt = new Date().toISOString();
    try { save(); }
    catch (error) {
      if (!failed) { failed = true; originalFailure = error; }
      else process.stderr.write(JSON.stringify({ operation: 'Owner batch process: persist command receipt failed',
        directory, failure: failureView(error) }) + '\n');
    }
  }
  if (failed) throw originalFailure;
  return record;
}
module.exports = { execute };
