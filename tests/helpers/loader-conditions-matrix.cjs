/** @file Captures cold/warm load conditions for both public package APIs and the private binary. */
'use strict';
const { Worker } = require('node:worker_threads');
const { resolve } = require('node:path');
const { mkdirSync, writeFileSync } = require('node:fs');
/** @param {object} workerData - Real engine/loading mode. @returns {Promise<object>} Outcome after Worker teardown. */
function run(workerData) { return new Promise((resolveResult, reject) => {
  const worker = new Worker(require.resolve('./loader-conditions.cjs'), { workerData }); let output;
  worker.once('message', (message) => { output = message; }); worker.once('error', reject);
  worker.once('exit', (code) => code === 0 ? resolveResult(output) : reject(new Error(`Load-condition Worker exited ${code}`)));
}); }
/** @returns {Promise<void>} Save outcomes without equating preloaded and cold APIs. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, runtimeDirectory: resolve(process.argv[2] ?? 'dist'), cases: [] };
  for (const target of ['serializer', 'jsdom', 'native', 'addon', 'rustdom']) for (const mode of ['cold', 'warm']) {
    report.cases.push(await run({ target, mode, runtimeDirectory: report.runtimeDirectory }));
  }
  mkdirSync('reports/compatibility', { recursive: true });
  const path = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-loader-conditions.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ path, cases: report.cases })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });