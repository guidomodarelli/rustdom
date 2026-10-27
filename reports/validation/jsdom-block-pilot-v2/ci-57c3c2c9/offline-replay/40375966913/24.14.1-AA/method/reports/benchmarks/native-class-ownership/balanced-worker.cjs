/** @file Exercises fresh realms on identical packages with all eight module-context factor combinations. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { getHeapStatistics } = require('node:v8');
const { loadRuntime, sample, cleanup } = require('./paired-worker.cjs');
const settings = require('./constants/paired.cjs');
const method = require('./constants/balanced.cjs');

/** Keep semantic labels separate from the independent load, physical-copy and sampling assignments. */
function schedule(manifest, engine, position) {
  assert.ok(['rustdom', 'jsdom'].includes(engine));
  assert.ok(Number.isSafeInteger(position) && position >= 0 && position < settings.workerCount);
  const reverseLoad = Boolean(position & 1);
  const reverseAssignment = Boolean(position & 2);
  const reverseSamples = Boolean(position & 4);
  const physical = engine === 'jsdom' ? ['J0', 'J1'] : ['A0', 'A1'];
  if (reverseAssignment) physical.reverse();
  return {
    factors: { reverseLoad, reverseAssignment, reverseSamples },
    roots: { A: manifest.copies[physical[0]], B: manifest.copies[physical[1]] },
    loadOrder: reverseLoad ? ['B', 'A'] : ['A', 'B'],
    sizes: reverseSamples ? [...settings.sizes].reverse() : settings.sizes,
    observations: (reverseSamples ? [...settings.sizes].reverse() : settings.sizes).flatMap((size) =>
      [[true, settings.warmupOrder], [false, settings.measuredOrder]].flatMap(([warmup, order]) =>
        order.flatMap((pair, round) => [...(reverseSamples ? [...pair].reverse() : pair)].map((label) =>
          ({ size, warmup, round, label }))))),
  };
}

/** Exercise exactly the same public operations on both modules and record allocation independence in both directions. */
function proveSymmetricIsolation(runtimes, order) {
  assert.notEqual(runtimes.A.api.JSDOM, runtimes.B.api.JSDOM);
  const observations = [];
  for (const label of order) {
    const other = label === 'A' ? 'B' : 'A';
    const ownBefore = runtimes[label].native?.NativeRange.statistics().created;
    const otherBefore = runtimes[other].native?.NativeRange.statistics().created;
    const dom = new runtimes[label].api.JSDOM('<p>isolation</p>');
    try {
      const range = dom.window.document.createRange();
      range.selectNodeContents(dom.window.document.body);
      assert.equal(range.toString(), 'isolation');
      const ownCreated = runtimes[label].native ? runtimes[label].native.NativeRange.statistics().created - ownBefore : null;
      const otherCreated = runtimes[other].native ? runtimes[other].native.NativeRange.statistics().created - otherBefore : null;
      if (runtimes[label].native) { assert.equal(ownCreated, 1); assert.equal(otherCreated, 0); }
      observations.push({ label, text: range.toString(), ownCreated, otherCreated });
    } finally { dom.window.close(); }
  }
  return observations;
}

/** Preserve partial observations and never overwrite an earlier diagnostic. */
async function main(manifestPath, engine, positionText, output) {
  assert.equal(typeof global.gc, 'function', 'Run the balanced worker with --expose-gc');
  assert.equal(fs.existsSync(output), false, 'Preserve existing balanced worker output');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const position = Number(positionText);
  const plan = schedule(manifest, engine, position);
  const report = { complete: false, phase: 'AA', engine, position, settings, method, schedule: plan,
    node: process.version, v8: process.versions.v8, execArgv: process.execArgv,
    nodeOptionsPresent: Object.hasOwn(process.env, 'NODE_OPTIONS'), heapLimitBytes: getHeapStatistics().heap_size_limit,
    samples: [] };
  const save = () => fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  save();
  try {
    const runtimes = {};
    for (const label of plan.loadOrder) runtimes[label] = loadRuntime(plan.roots[label], engine);
    report.isolation = proveSymmetricIsolation(runtimes, plan.loadOrder); save();
    for (const input of plan.observations) {
      const record = { ...input, complete: false };
      report.samples.push(record); save();
      const observation = await cleanup(sample(runtimes[input.label], input.size, record), runtimes[input.label]);
      Object.assign(record, observation, { complete: true }); save();
      for (const endpoint of observation.cleanupTrace.slice(-2)) {
        assert.deepEqual(endpoint.survivors, { window: false, document: false });
        if (endpoint.released) assert.equal(endpoint.released.live, 0);
      }
    }
    report.complete = true; save();
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) main(...process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
module.exports = { schedule, proveSymmetricIsolation };
