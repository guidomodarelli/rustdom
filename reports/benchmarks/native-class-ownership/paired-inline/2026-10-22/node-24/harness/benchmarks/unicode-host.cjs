/** @file Measures cold host-table extraction and cached native profile installation in isolated processes. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync, execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { cpus, platform, arch, totalmem } = require('node:os');
const { resolve } = require('node:path');
/** Collect independent cold samples, with several warm installations per child. */
const PROCESS_SAMPLES = 5;
const WARM_SAMPLES = 10;
const WORKER_TIMEOUT_MS = 120_000;

/** @returns {object} Timing samples with checked native attribute behavior. */
function runWorker() {
  const { NativeTree } = require('../dist/native.cjs');
  const { initializeHostUnicode } = require('../dist/host-unicode.cjs');
  const tree = new NativeTree();
  const element = tree.allocate();
  tree.setHtmlElement(element, 'div', []);
  tree.initializeAttributeCollection(element);
  const names = ['a', 'A', 'ß', 'ﬀ', 'İ', '\ua7cb', '\ua7ce', '𐐀'];
  for (const name of names) {
    const attribute = tree.allocate();
    tree.initializePlainAttribute(attribute, name, 'case');
    tree.appendAttribute(element, attribute);
  }
  const expected = names.filter((name) => name.toLowerCase() === name);
  /** @param {string} version - Profile label. @returns {number} Installation time in milliseconds. */
  function measure(version) {
    const started = performance.now();
    initializeHostUnicode(tree, version);
    const elapsedMs = performance.now() - started;
    assert.deepEqual(tree.attributeNames(element, true, true), expected);
    return elapsedMs;
  }
  const bundled = [];
  for (let sample = 0; sample < WARM_SAMPLES; sample++) bundled.push(measure(process.versions.unicode));
  const coldHostMs = measure('rustdom-unbundled-benchmark');
  const cachedHost = [];
  for (let sample = 0; sample < WARM_SAMPLES; sample++) cachedHost.push(measure('rustdom-unbundled-benchmark'));
  return { bundledMs: bundled, coldHostMs, cachedHostMs: cachedHost };
}

/** @param {number[]} values - Raw timings. @returns {number} Median timing. */
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

/** @param {string} filename - Measured input. @returns {string} SHA-256 fingerprint. */
function fingerprint(filename) {
  return createHash('sha256').update(readFileSync(resolve(filename))).digest('hex');
}

/** @returns {void} Save raw process samples, environment and a concise methodology report. */
function runBenchmark() {
  const samples = [];
  for (let sample = 0; sample < PROCESS_SAMPLES; sample++) {
    const child = spawnSync(process.execPath, [__filename, '--worker'], {
      encoding: 'utf8', timeout: WORKER_TIMEOUT_MS,
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    samples.push(JSON.parse(child.stdout));
  }
  // This untimed inventory describes the copied table size, not an RSS/leak estimate.
  let changedScalars = 0;
  for (let codepoint = 0; codepoint <= 0x10ffff; codepoint++) {
    if (codepoint >= 0xd800 && codepoint <= 0xdfff) continue;
    const character = String.fromCodePoint(codepoint);
    if (character.toLowerCase() !== character) changedScalars++;
  }
  const medians = {
    bundledMs: median(samples.flatMap((sample) => sample.bundledMs)),
    coldHostMs: median(samples.map((sample) => sample.coldHostMs)),
    cachedHostMs: median(samples.flatMap((sample) => sample.cachedHostMs)),
  };
  const report = {
    recordedAt: new Date().toISOString(),
    node: process.version, unicode: process.versions.unicode, icu: process.versions.icu,
    platform: platform(), arch: arch(), cpu: cpus()[0].model, logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
    fingerprints: Object.fromEntries(['src/dom/host-unicode.cjs', 'src/dom/unicode_case.rs',
      'src/dom/attribute_operations.rs', 'src/dom/tree.rs', 'Cargo.lock', 'dist/rustdom.node',
      'benchmarks/unicode-host.cjs'].map((filename) => [filename, fingerprint(filename)])),
    processSamples: PROCESS_SAMPLES, warmSamplesPerProcess: WARM_SAMPLES, warmup: 0,
    changedScalars, scalarTableBytes: changedScalars * Uint32Array.BYTES_PER_ELEMENT,
    medians, samples,
  };
  const stem = `${report.recordedAt.replaceAll(':', '-')}-${report.platform}-${report.arch}-unicode-host`;
  mkdirSync('reports/benchmarks', { recursive: true });
  writeFileSync(`reports/benchmarks/${stem}.json`, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(`reports/benchmarks/${stem}.md`, `# Inicialización de perfiles Unicode\n\n` +
    `Node ${report.node}, Unicode ${report.unicode}, ICU ${report.icu}; ${report.cpu}.\n\n` +
    `| Operación | Mediana (ms) |\n| --- | ---: |\n` +
    `| Tabla incluida | ${medians.bundledMs.toFixed(4)} |\n` +
    `| Extracción del host e instalación inicial | ${medians.coldHostMs.toFixed(4)} |\n` +
    `| Reutilización e instalación nativa | ${medians.cachedHostMs.toFixed(4)} |\n\n` +
    `${PROCESS_SAMPLES} procesos nuevos; ${WARM_SAMPLES} instalaciones incluidas y ${WARM_SAMPLES} ` +
    `reutilizadas por proceso, sin warmup descartado. La extracción fría se mide una vez por proceso. ` +
    `Cada operación verifica después del timing el filtrado observable de atributos en Rust.\n\n` +
    `La carga del addon, la creación de nodos y el I/O quedan fuera del timing. ` +
    `La extracción fría incluye el contexto de intrínsecas, el recorrido de todos los escalares, ` +
    `la copia fuera del contexto y la transferencia a Rust. Los tiempos muy pequeños de reutilización ` +
    `están limitados por la resolución del reloj y el calentamiento del proceso.\n\n` +
    `El host produce ${changedScalars} escalares: ${report.scalarTableBytes} bytes por copia del payload. ` +
    `Esto no mide RSS ni demuestra ausencia de fugas. El identificador desconocido es artificial; ` +
    `las tablas son las reales del host y no simulan una versión Unicode futura.\n`);
  process.stdout.write(JSON.stringify({ report: `reports/benchmarks/${stem}.json`, medians, changedScalars }) + '\n');
}

if (process.argv.includes('--worker')) process.stdout.write(JSON.stringify(runWorker()) + '\n');
else runBenchmark();
