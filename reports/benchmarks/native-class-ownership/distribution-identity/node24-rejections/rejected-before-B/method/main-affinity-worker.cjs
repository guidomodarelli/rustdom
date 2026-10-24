/** @file Pins only the main thread before invoking the unchanged real public benchmark worker. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { affinities, configureAffinity } = require('./thread-worker.cjs');
const settings = require('./constants/main-affinity.cjs');

/** Preserve affinity metadata separately from the original worker's unmodified stdout report. */
async function main(harnessRoot, runtimeRoot, engine, output) {
  assert.equal(process.platform, 'linux');
  assert.ok(settings.nodeVersions.includes(process.version));
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  assert.deepEqual(process.execArgv, ['--expose-gc']);
  assert.ok(settings.engines.includes(engine));
  const report = { complete: false, pid: process.pid, node: process.version, v8: process.versions.v8,
    execArgv: process.execArgv, nodeOptionsPresent: false, engine, harnessRoot: path.resolve(harnessRoot),
    runtimeRoot: path.resolve(runtimeRoot), settings };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  process.once('exit', (code) => {
    report.affinity ??= {};
    report.affinity.final = affinities();
    report.exitCode = code;
    report.complete = code === 0 && !report.failure;
    save();
  });
  try {
    report.affinity = await configureAffinity('main'); save();
    process.env.RUSTDOM_BENCHMARK_PACKAGE = report.runtimeRoot;
    process.env.RUSTDOM_BENCHMARK_SHARD_COUNT = '1';
    process.env.RUSTDOM_BENCHMARK_SHARD_INDEX = '0';
    const worker = path.join(report.harnessRoot, 'benchmarks/worker.cjs');
    process.argv = [process.execPath, worker, engine, ...settings.workloads];
    require(worker);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack }; save(); throw error;
  }
}

if (require.main === module) main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = { main };
