/** Real GC, OS signals and monotonic deadlines at the parent's finalization edge; no platform mocks. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');
const { collectGarbage } = require('../../../../../scripts/memory-endpoint.cjs');
const { finalizeQualification } = require('../finalize.cjs');
const [mode] = process.argv.slice(2);
const controller = new AbortController();
process.once('SIGTERM', () => controller.abort(new Error('Real qualification termination')));
const startedMonotonicMs = performance.now();
const deadlineMs = 1000;
const overrunDelayMs = 1100;
let rechecked = false;
let complete = false;

(async () => {
  try {
    await finalizeQualification({ signal: controller.signal, startedMonotonicMs,
      timeoutMs: mode.startsWith('deadline') ? deadlineMs : 5000,
      snapshot: async () => {
        if (mode === 'signal-during-gc') process.kill(process.pid, 'SIGTERM');
        if (mode === 'deadline-during-gc') await delay(overrunDelayMs);
        await collectGarbage();
      },
      recheck: async () => {
        rechecked = true;
        if (mode === 'signal-during-postflight') process.kill(process.pid, 'SIGTERM');
        if (mode === 'deadline-during-postflight') await delay(overrunDelayMs);
      } });
    complete = true;
    assert.equal(mode, 'complete');
    process.stdout.write(JSON.stringify({ complete, rechecked, cancelled: controller.signal.aborted }) + '\n');
  } catch (error) {
    if (mode === 'complete') throw error;
    assert.equal(complete, false);
    assert.match(error.message, mode.startsWith('signal') ? /cancelled qualification/ : /deadline exceeded/);
    if (mode.endsWith('gc')) assert.equal(rechecked, false);
    if (mode.endsWith('postflight')) assert.equal(rechecked, true);
    process.stdout.write(JSON.stringify({ complete, rechecked, cancelled: controller.signal.aborted, message: error.message }) + '\n');
  }
})().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
