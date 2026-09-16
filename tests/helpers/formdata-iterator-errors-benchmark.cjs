/** @file Measures equivalent FormData failures and valid construction across real isolated artifacts. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const os = require('node:os');

/** Sampling limits are identical for every engine and are saved with the observations. */
const WARMUP = 3, SAMPLES = 9, OPERATIONS = 100;
const WORKLOADS = ['factory-result', 'next-result', 'construction'];

/** @param {object} wrapper - Actual form wrapper. @returns {object} Existing construction implementation. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }

/** @param {string} engine - jsdom or a native artifact name. @param {string} directory - Complete dist directory. @returns {Promise<object>} Samples after validation of real outputs. */
async function measure(engine, directory) {
  const runtime = require(engine === 'jsdom' ? 'jsdom' : resolve(directory, 'index.cjs'));
  const native = engine === 'jsdom' ? null : require(resolve(directory, 'native.cjs'));
  const dom = new runtime.JSDOM('<form><input name="field" value="value"></form>');
  const form = dom.window.document.querySelector('form');
  const formImpl = implementation(form); const controls = formImpl._getSubmittableElementNodes;
  const invalid = Symbol('benchmark');
  const raw = [];
  const nativeBefore = native?.formDataConstructionStatistics();
  try {
    for (let round = 0; round < WARMUP + SAMPLES; round++) {
      for (const workload of round % 2 ? [...WORKLOADS].reverse() : WORKLOADS) {
        formImpl._getSubmittableElementNodes = workload === 'construction' ? controls : () => ({ [Symbol.iterator]() {
          return workload === 'factory-result' ? invalid : { next() { return invalid; } };
        } });
        await nextTurn(); global.gc(); await nextTurn();
        let failures = 0; let lastData;
        const started = performance.now();
        for (let iteration = 0; iteration < OPERATIONS; iteration++) {
          try { lastData = new dom.window.FormData(form); }
          catch (error) {
            if (workload === 'construction') throw error;
            assert.ok(error instanceof TypeError);
            assert.equal(error.message, workload === 'factory-result' ? 'Result of the Symbol.iterator method is not an object' : 'Iterator result Symbol(benchmark) is not an object');
            failures++;
          }
        }
        const elapsedMs = performance.now() - started;
        assert.equal(failures, workload === 'construction' ? 0 : OPERATIONS);
        if (lastData) assert.deepEqual(Array.from(lastData), [['field', 'value']]);
        lastData = null;
        raw.push({ workload, round, warmup: round < WARMUP, elapsedMs, failures });
      }
    }
    const construction = native?.formDataConstructionStatistics();
    if (native) { assert.equal(construction.active, 0); assert.equal(construction.builds - nativeBefore.builds, WORKLOADS.length * (WARMUP + SAMPLES) * OPERATIONS); }
    return { engine, node: process.version, v8: process.versions.v8, warmup: WARMUP, samples: SAMPLES, operationsPerSample: OPERATIONS, raw, construction };
  } finally { formImpl._getSubmittableElementNodes = controls; dom.window.close(); }
}

/** @returns {void} Alternate engine order, preserving every sample and artifact identity. */
function main() {
  const [baseline, candidate] = process.argv.slice(2).map((path) => resolve(path));
  assert.ok(baseline && candidate);
  const report = { capturedAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
    cpu: os.cpus()[0].model, cpuCount: os.cpus().length, osRelease: os.release(), totalMemory: os.totalmem(),
    methodology: 'Six sequential processes use baseline/candidate/jsdom then reverse ordering. Each process alternates workload order, with 3 warmup and 9 measured batches of 100 public FormData constructions. Error batches include catching and verifying intrinsic type/message; valid output validation is outside timing. GC and event-loop drainage precede each sample, outside timing. No globals are mutated during timing. Both error workloads were already correct on the baseline with ordinary globals; differential tests cover newly corrected non-callable slots separately.',
    cargoLockSha256: createHash('sha256').update(readFileSync('Cargo.lock')).digest('hex'),
    packageLockSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'), artifacts: {}, runs: [], summary: {} };
  for (const [name, directory] of Object.entries({ baseline, candidate })) report.artifacts[name] = {
    directory, binarySha256: createHash('sha256').update(readFileSync(resolve(directory, 'rustdom.node'))).digest('hex'), nativeBuild: JSON.parse(readFileSync(resolve(directory, 'native-build.json'), 'utf8')),
  };
  for (const name of ['baseline', 'candidate', 'jsdom', 'jsdom', 'candidate', 'baseline']) {
    const child = spawnSync(process.execPath, ['--expose-gc', __filename, '--sample', name, name === 'jsdom' ? '' : report.artifacts[name].directory], { encoding: 'utf8', timeout: 120_000 });
    assert.equal(child.error, undefined); assert.equal(child.status, 0, `${name}: ${child.stderr}`);
    report.runs.push(JSON.parse(child.stdout));
  }
  for (const name of ['baseline', 'candidate', 'jsdom']) {
    report.summary[name] = {};
    for (const workload of WORKLOADS) {
      const values = report.runs.filter((run) => run.engine === name).flatMap((run) => run.raw.filter((sample) => !sample.warmup && sample.workload === workload).map((sample) => sample.elapsedMs)).sort((left, right) => left - right);
      report.summary[name][workload] = { medianMs: (values[8] + values[9]) / 2, minMs: values[0], maxMs: values.at(-1), samples: values.length };
    }
  }
  mkdirSync('reports/benchmarks/formdata-iterator-errors', { recursive: true });
  const path = `reports/benchmarks/formdata-iterator-errors/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ path, summary: report.summary }) + '\n');
}
if (process.argv[2] === '--sample') measure(process.argv[3], process.argv[4]).then((result) => process.stdout.write(JSON.stringify(result) + '\n')).catch((error) => { console.error(error); process.exitCode = 1; });
else main();
