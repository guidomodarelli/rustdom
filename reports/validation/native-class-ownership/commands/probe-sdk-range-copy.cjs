/** Observe actual integrated NativeRange copies during real worker termination. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const nativeModule = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
assert.ok(!fs.existsSync(output), 'Keep previous diagnostics intact');
const native = require(nativeModule);
const baseline = native.NativeRange.statistics();
const report = { capturedAt: new Date().toISOString(), node: process.version, nativeModule,
  binarySha256: createHash('sha256').update(fs.readFileSync(path.join(path.dirname(nativeModule), 'rustdom.node'))).digest('hex'),
  methodology: 'Eight real worker interruptions during repeated integrated NativeRange.copy calls; process-wide native liveness after worker exit.',
  limitation: 'Scheduling is observed rather than forced; finite probes do not prove absence of leaks.', baseline, cycles: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
async function main() {
  save();
  for (let cycle = 0; cycle < 8; cycle++) {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const native = require(workerData.nativeModule);
      const source = new native.NativeRange();
      parentPort.once('message', () => {
        parentPort.postMessage('enter');
        for (let iteration = 0; iteration < 1000000; iteration++) globalThis.lastCopy = source.copy();
        parentPort.close();
      });
      parentPort.postMessage('ready');
    `, { eval: true, execArgv: [], workerData: { nativeModule } });
    const exited = once(worker, 'exit');
    try {
      assert.deepEqual(await once(worker, 'message'), ['ready']);
      const entered = once(worker, 'message'); worker.postMessage('copy');
      assert.deepEqual(await entered, ['enter']);
      await worker.terminate();
      const [exitCode] = await exited;
      assert.ok(exitCode === 0 || exitCode === 1);
      report.cycles.push({ cycle, exitCode, statistics: native.NativeRange.statistics() }); save();
    } finally { await worker.terminate(); await exited; }
  }
  report.final = native.NativeRange.statistics();
  report.complete = true;
  report.balanced = report.final.live === baseline.live && report.final.created - baseline.created === report.final.released - baseline.released;
  report.allocations = report.final.created - baseline.created;
  save();
  console.log(JSON.stringify({ node: report.node, complete: report.complete, balanced: report.balanced, allocations: report.allocations, retained: report.final.live - baseline.live, output }));
}
main().catch((error) => { report.failure = { name: error.name, message: error.message }; save(); throw error; });
