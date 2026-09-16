/** @file Measures equivalent primitive iterator failures on independently loaded baseline/candidate artifacts. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const os = require('node:os');

/** @param {object} wrapper - Actual DOM wrapper. @returns {object} Underlying implementation used only to supply an observable iterator. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

/** @param {string} runtimeDirectory - Complete artifact directory. @returns {object} Raw samples and proof that both native operations ran. */
function measure(runtimeDirectory) {
  const runtime = require(resolve(runtimeDirectory, 'index.cjs'));
  const native = require(resolve(runtimeDirectory, 'native.cjs'));
  const { window } = new runtime.JSDOM('<form><input name="field" value="value"></form>');
  const form = window.document.querySelector('form');
  const invalid = Symbol('benchmark');
  const iterable = { [Symbol.iterator]() { return { next() { return invalid; } }; } };
  implementation(form)._getSubmittableElementNodes = () => iterable;
  const root = { nodeType: 11, childNodes: iterable };
  const operations = { xml: () => native.serializeXml(root, false), formData: () => new window.FormData(form) };
  const expectedMessage = 'Iterator result Symbol(benchmark) is not an object';
  /** Local sampling configuration; included in the saved report. */
  const warmup = 3, samples = 9, operationsPerSample = 100;
  const raw = [];
  try {
    for (let round = 0; round < warmup + samples; round++) {
      for (const name of round % 2 ? ['formData', 'xml'] : ['xml', 'formData']) {
        global.gc();
        const started = performance.now();
        let failures = 0;
        for (let iteration = 0; iteration < operationsPerSample; iteration++) {
          try { operations[name](); } catch (error) {
            if (!(error instanceof TypeError) || error.message !== expectedMessage) throw error;
            failures++;
          }
        }
        const elapsedMs = performance.now() - started;
        assert.equal(failures, operationsPerSample);
        raw.push({ name, round, warmup: round < warmup, elapsedMs, failures });
      }
    }
    const xml = native.xmlSerializationStatistics();
    const formData = native.formDataConstructionStatistics();
    assert.ok(xml.created >= (warmup + samples) * operationsPerSample);
    assert.ok(formData.builds >= (warmup + samples) * operationsPerSample);
    assert.equal(xml.live, 0); assert.equal(xml.references, 0); assert.equal(xml.cleanupErrors, 0); assert.equal(formData.active, 0);
    return { node: process.version, v8: process.versions.v8, warmup, samples, operationsPerSample, raw, xml, formData };
  } finally { window.close(); }
}

/** @returns {void} Run four alternating processes and save all warmup/measured observations. */
function main() {
  const [baseline, candidate] = process.argv.slice(2).map((path) => resolve(path));
  assert.ok(baseline && candidate, 'Provide baseline and candidate runtime directories');
  const report = { capturedAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
    osRelease: os.release(), cpu: os.cpus()[0].model, cpuCount: os.cpus().length, totalMemory: os.totalmem(),
    methodology: 'Four sequential processes alternate baseline/candidate. Each process alternates XML/FormData batches with three warmups and nine measured samples of 100 errors. Measures native call/public FormData constructor plus catching and checking error type/text. GC before each sample, outside timing. Excludes runtime load, DOM fixture construction and teardown. No mutated globals during timings; differential tests verify those separately.',
    command: 'node tests/helpers/iterator-diagnostics-benchmark.cjs BASELINE_DIST CANDIDATE_DIST',
    cargoLockSha256: createHash('sha256').update(readFileSync('Cargo.lock')).digest('hex'),
    packageLockSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
    artifacts: {}, runs: [],
  };
  for (const [name, directory] of Object.entries({ baseline, candidate })) {
    report.artifacts[name] = { directory, binarySha256: createHash('sha256').update(readFileSync(resolve(directory, 'rustdom.node'))).digest('hex') };
  }
  for (const name of ['baseline', 'candidate', 'baseline', 'candidate']) {
    const result = spawnSync(process.execPath, ['--expose-gc', __filename, '--sample', report.artifacts[name].directory], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    report.runs.push({ name, ...JSON.parse(result.stdout) });
  }
  report.summary = {};
  for (const name of ['baseline', 'candidate']) {
    report.summary[name] = {};
    for (const operation of ['xml', 'formData']) {
      const samples = report.runs.filter((run) => run.name === name).flatMap((run) => run.raw.filter((sample) => !sample.warmup && sample.name === operation).map((sample) => sample.elapsedMs)).sort((left, right) => left - right);
      report.summary[name][operation] = { medianMs: (samples[samples.length / 2 - 1] + samples[samples.length / 2]) / 2, minMs: samples[0], maxMs: samples.at(-1), sampleCount: samples.length };
    }
  }
  mkdirSync('reports/benchmarks', { recursive: true });
  const path = `reports/benchmarks/${report.capturedAt.replaceAll(':', '-')}-iterator-diagnostics.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ path, summary: report.summary })}\n`);
}
if (process.argv[2] === '--sample') process.stdout.write(`${JSON.stringify(measure(process.argv[3]))}\n`);
else main();