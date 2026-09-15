/** @file Reproduces dependent-signal retention with one live source and finite GC rounds. */
'use strict';
const { writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState } = require('../../scripts/memory-endpoint.cjs');

/** @param {Window} window - Fixture realm. @param {AbortSignal} source - Retained source. @returns {WeakRef[]} Discarded public signal observations. */
function discardedSignals(window, source) {
  return Array.from({ length: 1000 }, () => new WeakRef(window.AbortSignal.any([source])));
}

/** @returns {Promise<void>} Saves every cycle without interpreting collector timing as a standards certification. */
async function main() {
  const dom = new runtime.JSDOM('<body></body>');
  const controller = new dom.window.AbortController();
  await collectGarbage();
  const report = { node: process.version, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), baseline: captureMemoryState({}, runtime), cycles: [] };
  for (let cycle = 0; cycle < 3; cycle++) {
    const signals = discardedSignals(dom.window, controller.signal);
    for (let round = 0; round < 4; round++) await collectGarbage();
    report.cycles.push(captureMemoryState({ signals }, runtime));
  }
  controller.abort('finished');
  report.afterAbort = captureMemoryState({}, runtime);
  dom.window.close();
  writeFileSync('reports/memory/pr54-abort-retention-baseline.json', JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report.cycles.map((cycle) => ({ survivors: cycle.survivors, abort: cycle.nativeTree.abortStates }))) + '\n');
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
