/** @file Runs isolated benchmark processes, preserves raw samples, and writes comparable summaries. */
'use strict';
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { cpus, platform, arch, release, totalmem } = require('node:os');
const { createHash } = require('node:crypto');

/** Use fresh processes and alternate ordering to reduce shared-heap and ordering bias. */
const ORDERS = [['jsdom', 'rustdom'], ['rustdom', 'jsdom']];
/** Store reports in version control as requested; never replace results with marketing claims. */
const outputDirectory = 'reports/benchmarks';

/**
 * Summarize raw observations using median and p95, without deleting outliers.
 * @param {number[]} values - Measured durations in milliseconds.
 * @returns {object} Sample count and distribution summaries in milliseconds.
 */
function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return { samples: sorted.length, medianMs: sorted.length % 2 ? sorted[middle] :
    (sorted[middle - 1] + sorted[middle]) / 2,
  p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], minMs: sorted[0], maxMs: sorted.at(-1) };
}

/** Capture source and dependency identities alongside machine information. */
const report = {
  schemaVersion: 1, capturedAt: new Date().toISOString(),
  node: process.version, jsdom: require('jsdom/package.json').version,
  nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
  machine: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0].model,
    logicalCpus: cpus().length, totalMemoryBytes: totalmem() },
  sourceHash: createHash('sha256').update(['src/lib.rs', 'src/parser/bridge.cjs', 'src/environments/vitest.mjs',
    'src/environments/web-platform.cjs', 'src/environments/window.cjs', 'benchmarks/worker.cjs', 'package-lock.json', 'Cargo.lock']
    .map((path) => readFileSync(path)).reduce((combined, contents) => Buffer.concat([combined, contents]), Buffer.alloc(0))).digest('hex'),
  methodology: {
    build: 'cargo release, thin LTO', processOrders: ORDERS,
    timing: 'Public operation only; excludes module startup, setup, validation, window.close and explicit GC.',
    memory: 'Process memory after window.close, one event-loop turn and explicit GC; not peak memory or allocation totals.',
    compatibility: 'Assertions verify row count and decoded text outside timed regions; functional suites run separately.',
    environments: 'Environment setup includes creation of a 25-row document with outside-only scripts, excludes imports and teardown, and uses an isolated globals object for the normal setup case.',
    ratio: 'jsdom median / rustdom median; values greater than 1 favor rustdom.',
    limitations: 'Synthetic workloads on one machine. Shared JavaScript DOM and selectors remain. No claim about complete test-suite speed.',
  },
  runs: [], comparisons: [],
};

for (const order of ORDERS) {
  for (const engine of order) {
    process.stderr.write(`Benchmark ${engine}, proceso ${report.runs.length + 1}/${ORDERS.length * 2}\n`);
    const child = spawnSync(process.execPath, ['--expose-gc', 'benchmarks/worker.cjs', engine], {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300_000,
    });
    if (child.error) throw child.error;
    if (child.status !== 0) throw new Error(`benchmark ${engine} failed (${child.status}): ${child.stderr}`);
    report.runs.push(JSON.parse(child.stdout));
  }
}
for (const workload of report.runs[0].workloads) {
  const engines = {};
  for (const engine of ['jsdom', 'rustdom']) {
    const values = report.runs.filter((run) => run.engine === engine).flatMap((run) =>
      run.workloads.find((entry) => entry.name === workload.name && entry.rows === workload.rows).samplesMs);
    engines[engine] = summarize(values);
  }
  report.comparisons.push({ workload: workload.name, rows: workload.rows, ...engines,
    speedup: engines.jsdom.medianMs / engines.rustdom.medianMs });
}

mkdirSync(outputDirectory, { recursive: true });
/** Keep timestamped results so subsequent optimizations cannot overwrite the baseline. */
const basename = `${new Date().toISOString().replaceAll(':', '-')}-${platform()}-${arch()}`;
writeFileSync(`${outputDirectory}/${basename}.json`, `${JSON.stringify(report, null, 2)}\n`);
const table = ['| Operación | Filas | jsdom mediana (ms) | rustdom mediana (ms) | Ratio |',
  '|---|---:|---:|---:|---:|', ...report.comparisons.map((entry) =>
    `| ${entry.workload} | ${entry.rows} | ${entry.jsdom.medianMs.toFixed(3)} | ${entry.rustdom.medianMs.toFixed(3)} | ${entry.speedup.toFixed(2)}x |`)];
writeFileSync(`${outputDirectory}/${basename}.md`, `# Benchmark ${report.capturedAt}\n\n` +
  `Node ${report.node}; jsdom ${report.jsdom}; ${report.machine.cpu}; ${report.machine.release}.\n\n` +
  table.join('\n') + '\n\nRatio = mediana jsdom / mediana rustdom. Mayor que 1 favorece rustdom.\n' +
  '\nCada fila contiene 18 muestras en dos procesos por motor, con tres warmups por proceso.\n' +
  'Se excluyen carga de módulos, preparación, validación y limpieza. La memoria guardada en JSON es posterior a GC; no es memoria pico.\n' +
  'Los documentos con scripts usan el parser original. Selectores y mutaciones siguen en JavaScript.\n');
process.stdout.write(`${table.join('\n')}\n\nGuardado: ${outputDirectory}/${basename}.json\n`);
