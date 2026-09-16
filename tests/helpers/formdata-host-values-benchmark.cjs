/** @file Measures ordinary projections and supported host-name operations through real public FormData APIs. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { performance } = require('node:perf_hooks');
const { resolve } = require('node:path');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const os = require('node:os');
const WARMUP = 3, SAMPLES = 9, READS = 100;

/** @param {string} engine - Real engine/artifact. @param {string} directory - Dist directory. @returns {Promise<object>} Raw validated samples. */
async function measure(engine, directory) {
  const runtime = require(engine === 'jsdom' ? 'jsdom' : resolve(directory, 'index.cjs'));
  const dom = new runtime.JSDOM(); const window = dom.window;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'String');
  const raw = [];
  try {
    for (const size of [100, 1000]) for (const workload of ['getAll-text', 'getAll-host', 'host-lifecycle']) {
      if (engine === 'baseline' && workload !== 'getAll-text') continue;
      const data = new window.FormData(); const name = {}; const value = {};
      let selected = name;
      if (workload !== 'getAll-text') window.String = (input) => ({ toWellFormed: () => input === 'key' ? selected : value });
      else Object.defineProperty(window, 'String', descriptor);
      if (workload !== 'host-lifecycle') for (let index = 0; index < size; index++) data.append('key', workload === 'getAll-text' ? `value${index}` : 'value');
      const names = Array.from({ length: size }, () => ({}));
      for (let round = 0; round < WARMUP + SAMPLES; round++) {
        await nextTurn(); global.gc(); await nextTurn();
        let count = 0, last;
        const started = performance.now();
        if (workload === 'host-lifecycle') {
          for (const current of names) {
            selected = current;
            data.append('key', 'value'); data.append('key', 'value'); data.set('key', 'value');
            count += Number(data.get('key') === value); data.delete('key');
          }
        } else {
          for (let iteration = 0; iteration < READS; iteration++) { last = data.getAll('key'); count += last.length; }
        }
        const elapsedMs = performance.now() - started;
        assert.equal(count, workload === 'host-lifecycle' ? size : size * READS);
        if (workload === 'host-lifecycle') assert.deepEqual(Array.from(data), []);
        else if (workload === 'getAll-host') assert.ok(last.every((item) => item === value));
        else assert.ok(last.every((item, index) => item === `value${index}`));
        last = null;
        raw.push({ workload, size, round, warmup: round < WARMUP, elapsedMs, checksum: count });
      }
      Object.defineProperty(window, 'String', descriptor);
    }
    return { engine, node: process.version, v8: process.versions.v8, warmup: WARMUP, samples: SAMPLES, readsPerBatch: READS, raw };
  } finally { Object.defineProperty(window, 'String', descriptor); window.close(); }
}

function main() {
  const [baseline, candidate] = process.argv.slice(2).map((path) => resolve(path));
  const report = { capturedAt: new Date().toISOString(), node: process.version, cpu: os.cpus()[0].model, cpuCount: os.cpus().length, platform: process.platform, arch: process.arch, osRelease: os.release(),
    methodology: 'Six separate processes run baseline/candidate/jsdom then reverse. Three warmups and nine samples per process; 18 samples per engine/workload/size. getAll batches contain 100 reads of 100/1000 entries. Host lifecycle performs append twice, set, get/identity check and delete for 100/1000 distinct object names. Setup, output verification and GC/event-loop drainage are outside timing. Baseline host workloads are omitted because they fail the contract; no speedup is inferred from invalid outputs.',
    artifacts: {}, runs: [], summary: {} };
  for (const [name, directory] of Object.entries({ baseline, candidate })) report.artifacts[name] = { directory, native: JSON.parse(readFileSync(resolve(directory, 'native-build.json'))), binarySha256: createHash('sha256').update(readFileSync(resolve(directory, 'rustdom.node'))).digest('hex') };
  for (const name of ['baseline', 'candidate', 'jsdom', 'jsdom', 'candidate', 'baseline']) {
    const child = spawnSync(process.execPath, ['--expose-gc', __filename, '--sample', name, name === 'jsdom' ? '' : report.artifacts[name].directory], { encoding: 'utf8', timeout: 120_000 });
    assert.equal(child.error, undefined); assert.equal(child.status, 0, child.stderr); report.runs.push(JSON.parse(child.stdout));
  }
  for (const engine of ['baseline', 'candidate', 'jsdom']) {
    report.summary[engine] = [];
    for (const size of [100, 1000]) for (const workload of ['getAll-text', 'getAll-host', 'host-lifecycle']) {
      const values = report.runs.filter((run) => run.engine === engine).flatMap((run) => run.raw.filter((sample) => !sample.warmup && sample.size === size && sample.workload === workload).map((sample) => sample.elapsedMs)).sort((left, right) => left - right);
      if (values.length) report.summary[engine].push({ workload, size, samples: values.length, medianMs: (values[8] + values[9]) / 2, minMs: values[0], maxMs: values.at(-1) });
    }
  }
  mkdirSync('reports/benchmarks/formdata-host-values', { recursive: true });
  const path = `reports/benchmarks/formdata-host-values/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); process.stdout.write(JSON.stringify({ path, summary: report.summary }) + '\n');
}
if (process.argv[2] === '--sample') measure(process.argv[3], process.argv[4]).then((value) => process.stdout.write(JSON.stringify(value) + '\n')).catch((error) => { console.error(error); process.exitCode = 1; });
else main();
