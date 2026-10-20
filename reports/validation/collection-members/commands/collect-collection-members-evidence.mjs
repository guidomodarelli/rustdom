import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { createRequire } from 'node:module';
const [runtimeRoot, repositoryRoot, taskRoot] = process.argv.slice(2);
const require = createRequire(join(runtimeRoot, 'package.json'));
const source = JSON.parse(await readFile(join(repositoryRoot, '.cache/collection-members-current-source.json')));
assert.equal(require(join(runtimeRoot, 'benchmarks/sources.cjs')).captureSourceIdentity(runtimeRoot).sourceHash, source.sourceHash);
const outputRoot = 'reports/validation/collection-members';
const logsRoot = join(runtimeRoot, outputRoot);
const start = Date.parse(JSON.parse(await readFile(join(logsRoot, 'baseline-metrics.json'))).capturedAt);
const gates = JSON.parse(await readFile(join(logsRoot, 'release-gates-node24.json')));
assert.equal(gates.pass, true); assert.equal(gates.gates.length, 7);
const files = [];
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function preserve(sourcePath, destinationPath, phase) {
  const original = await stat(sourcePath);
  const compressed = original.size > 64 * 1024;
  const path = destinationPath.replaceAll('\\', '/') + (compressed ? '.gz' : '');
  assert.ok(!files.some((file) => file.path === path), `Duplicate evidence destination: ${path}`);
  const target = join(repositoryRoot, path);
  await mkdir(dirname(target), { recursive: true });
  if (compressed) await pipeline(createReadStream(sourcePath), createGzip({ level: 9 }), createWriteStream(target));
  else await copyFile(sourcePath, target);
  files.push({ path, phase, originalBytes: original.size, bytes: (await stat(target)).size, sha256: await digest(target),
    ...(compressed ? { compression: 'gzip', originalSha256: await digest(sourcePath) } : {}) });
  return path;
}
async function preserveDirectory(sourceDirectory, destinationDirectory, phase, filter = () => true) {
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = join(sourceDirectory, entry.name), destinationPath = join(destinationDirectory, entry.name);
    if (entry.isDirectory()) await preserveDirectory(sourcePath, destinationPath, phase, filter);
    else if (entry.isFile() && await filter(sourcePath, entry.name)) await preserve(sourcePath, destinationPath, phase);
  }
}
const afterStart = async (path) => (await stat(path)).mtimeMs >= start;
await preserveDirectory(logsRoot, outputRoot, 'validation-history');
await preserve(join(repositoryRoot, '.cache/collection-members-current-source.json'), join(outputRoot, 'source.json'), 'final-source');
await preserve(join(runtimeRoot, 'dist/native-build.json'), join(outputRoot, 'native-build.json'), 'final-addon');
await preserve(join(runtimeRoot, 'baseline-engine/dist/native-build.json'), join(outputRoot, 'baseline-native-build.json'), 'checkpoint-059-baseline');
await preserve(join(runtimeRoot, 'artifacts/latest.json'), join(outputRoot, 'artifact.json'), 'installed-package');
for (const name of ['pr71-merge-proof.json', 'pr71-merged.json']) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'foundation', name), 'integrated-foundation');
}
for (const name of ['setup-collection-members-runtime.sh', 'baseline-collection-members.sh', 'validate-collection-members-focal.sh',
  'validate-collection-members-gc.sh', 'validate-collection-members-final.sh', 'prepare-collection-members-bench.sh', 'benchmark-collection-members.sh', 'profile-collection-members.cjs', 'capture-collection-members-metrics.mjs',
  'collect-collection-members-evidence.mjs', 'verify-collection-members-evidence.mjs', 'render-collection-members-readme.mjs']) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'commands', name), 'execution-commands');
}
await preserveDirectory(join(runtimeRoot, 'reports/compatibility'), join(outputRoot, 'compatibility-history'), 'compatibility-history', afterStart);
await preserveDirectory(join(runtimeRoot, 'reports/memory'), 'reports/memory/collection-members/history', 'memory-history', afterStart);
await preserveDirectory(join(runtimeRoot, 'reports/benchmarks/collection-members'), 'reports/benchmarks/collection-members', 'cpu-profiles');
const candidateBuild = JSON.parse(await readFile(join(runtimeRoot, 'dist/native-build.json')));
const baselineBuild = JSON.parse(await readFile(join(runtimeRoot, 'baseline-engine/dist/native-build.json')));
assert.equal(baselineBuild.binarySha256, '21e3385f1b8d37770965858340f7310f7bcdcf45bed81d3816bb572e51aac4fb');
const benchmarkLog = await readFile(join(logsRoot, 'benchmarks.log'), 'utf8');
const benchmarkPaths = [...benchmarkLog.matchAll(/Guardado: (reports\/benchmarks\/[^\r\n]+\.json)/g)].map((match) => match[1]);
assert.equal(benchmarkPaths.length, 8);
const benchmarkReports = [];
for (const reportPath of benchmarkPaths) {
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.complete, true); assert.equal(report.runs.length, 4); assert.equal(report.comparisons.length, 18);
  assert.equal(report.sourceHash, source.sourceHash);
  const stage = report.runtimeSource.kind === 'package-override' ? 'baseline' : 'candidate';
  assert.equal(report.nativeBinarySha256, stage === 'baseline' ? baselineBuild.binarySha256 : candidateBuild.binarySha256);
  for (const result of report.comparisons) { assert.equal(result.rustdom.samples, 18); assert.equal(result.jsdom.samples, 18); }
  const destination = `reports/benchmarks/collection-members/${reportPath.split('/').at(-1)}`;
  const path = await preserve(join(runtimeRoot, reportPath), destination, `${stage}-benchmark`);
  await preserve(join(runtimeRoot, reportPath.replace(/\.json$/, '.md')), destination.replace(/\.json$/, '.md'), `${stage}-benchmark`);
  benchmarkReports.push({ stage, report, path });
}
await preserveDirectory(join(runtimeRoot, 'reports/benchmarks'), join(outputRoot, 'benchmark-harness-history'), 'benchmark-harness-history',
  async (path, name) => name.startsWith('2026-10-20') && await afterStart(path)
    && !benchmarkPaths.includes(relative(runtimeRoot, path).replaceAll('\\', '/'))
    && !benchmarkPaths.includes(relative(runtimeRoot, path).replaceAll('\\', '/').replace(/\.md$/, '.json')));
function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right), middle = Math.floor(sorted.length / 2);
  return { samples: sorted.length, medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], minMs: sorted[0], maxMs: sorted.at(-1) };
}
const comparisons = [];
for (const node of [...new Set(benchmarkReports.map((entry) => entry.report.node))]) {
  const baseline = benchmarkReports.filter((entry) => entry.stage === 'baseline' && entry.report.node === node);
  const candidate = benchmarkReports.filter((entry) => entry.stage === 'candidate' && entry.report.node === node);
  assert.equal(baseline.length, 2); assert.equal(candidate.length, 2);
  for (const workload of baseline[0].report.comparisons) {
    const matches = (entry) => entry.name === workload.workload && entry.rows === workload.rows;
    const samples = (reports, engine) => reports.flatMap(({ report }) => report.runs.filter((run) => run.engine === engine)
      .flatMap((run) => run.workloads.find(matches).samplesMs));
    const before = summarize(samples(baseline, 'rustdom')), after = summarize(samples(candidate, 'rustdom'));
    const jsdomBefore = summarize(samples(baseline, 'jsdom')), jsdomAfter = summarize(samples(candidate, 'jsdom'));
    assert.equal(before.samples, 36); assert.equal(after.samples, 36);
    assert.equal(new Set([...baseline, ...candidate].flatMap(({ report }) => report.runs.map((run) => run.workloads.find(matches).outputHash))).size, 1);
    comparisons.push({ node, workload: workload.workload, size: workload.rows, baseline: before, candidate: after, jsdomBefore, jsdomAfter,
      deltaPercent: (after.medianMs / before.medianMs - 1) * 100, candidateSpeedup: jsdomAfter.medianMs / after.medianMs,
      jsdomControlDeltaPercent: (jsdomAfter.medianMs / jsdomBefore.medianMs - 1) * 100,
      repetitions: baseline.map((entry, index) => {
        const find = (report) => report.comparisons.find((result) => result.workload === workload.workload && result.rows === workload.rows).rustdom.medianMs;
        const baselineMedianMs = find(entry.report), candidateMedianMs = find(candidate[index].report);
        return { order: index === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'], baselineMedianMs, candidateMedianMs,
          deltaPercent: (candidateMedianMs / baselineMedianMs - 1) * 100 };
      }) });
  }
}
const comparison = { capturedAt: new Date().toISOString(), sourceHash: source.sourceHash,
  baselineCommit: 'a155685e30510cf626b03f83a6b7fc79c845baf2', baselineSourceHash: '8cf504cebae2dd8c46486c87e0083f39804efb368941b8f12f1b7f06a8ca28e1',
  baselineBinarySha256: baselineBuild.binarySha256, candidateBinarySha256: candidateBuild.binarySha256,
  methodology: 'Rust 1.99.1 release before/after. Nine public workloads at 100/1000 members. Eight reports, 32 isolated workers; 36 raw samples per engine/stage/runtime/row, three warmups and nine measured samples per process. Stages alternate baseline/candidate and candidate/baseline; engine order reverses inside each report. Query and namedItem modes perform 100 public operations; own-name enumeration performs ten. Setup, independent validation, cleanup and GC excluded. Every result hash must agree. Shared WSL2 CPU; post-GC memory is not peak. CPU profiles are separate diagnostics and excluded from benchmark timings.',
  rawReports: benchmarkReports.map(({ stage, report, path }) => ({ stage, node: report.node, path })), comparisons };
await writeFile(join(repositoryRoot, 'reports/benchmarks/collection-members/comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
const packageReports = [];
for (const name of ['package-node24.log', 'package-node22.log']) {
  const matches = [...(await readFile(join(logsRoot, name), 'utf8')).matchAll(/Guardado: (reports\/distribution\/[^\r\n]+\.json)/g)];
  assert.equal(matches.length, 1);
  const reportPath = matches[0][1], report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.pass, true); assert.equal(report.runs.length, 20);
  assert.equal(report.artifact.native.binarySha256, candidateBuild.binarySha256);
  const path = await preserve(join(runtimeRoot, reportPath), reportPath, 'installed-package');
  const stem = reportPath.split('/').at(-1).replace(/\.json$/, '');
  for (const entry of await readdir(join(runtimeRoot, 'reports/distribution'))) {
    if (entry.startsWith(stem + '-')) await preserve(join(runtimeRoot, 'reports/distribution', entry), join('reports/distribution', entry), 'installed-package');
  }
  packageReports.push({ path, node: report.node, checks: report.runs.length, packageSha256: report.artifact.sha256 });
}
assert.equal(new Set(packageReports.map((report) => report.packageSha256)).size, 1);
const nativePath = [...(await readFile(join(logsRoot, 'native-memory.log'), 'utf8')).matchAll(/Guardado: (reports\/memory\/[^\r\n]+\.json)/g)].at(-1)[1];
const native = JSON.parse(await readFile(join(runtimeRoot, nativePath)));
assert.equal(native.pass, true); assert.equal(native.runs.reduce((sum, run) => sum + run.tests.length, 0), 275);
for (const name of ['rust-tests.log', 'rust-tests-198.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /test result: ok\. 275 passed; 0 failed/);
for (const name of ['javascript-tests.log', 'full-node22.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 3157/);
for (const name of ['benchmark-contracts-v24.14.1.log', 'benchmark-contracts-v22.12.0.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 52/);
const validationSources = [];
for (const path of ['tests/collection-members.spec.cjs', 'tests/helpers/collection-query-memory.cjs', 'tests/benchmarks/collection-members.spec.cjs', 'types/index.d.cts', 'types/native.d.cts']) {
  const sha256 = await digest(join(repositoryRoot, path)); assert.equal(await digest(join(runtimeRoot, path)), sha256, path);
  validationSources.push({ path, sha256 });
}
const wptReports = [];
for (const name of ['wpt-contracts.log', 'wpt-node22.log']) {
  const reportPath = [...(await readFile(join(logsRoot, name), 'utf8')).matchAll(/Guardado: (reports\/compatibility\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.pass, true); assert.equal(report.results.length, 221);
  wptReports.push({ node: report.node, parity: report.pass, complete: report.complete, fixtures: report.results.length,
    assertions: report.results.reduce((sum, result) => sum + result.actual.tests.length, 0),
    sharedStandardsFailures: report.results.reduce((sum, result) => sum + result.actual.tests.filter((test) => test.status !== 0).length, 0),
    exclusions: report.excludedFixtures, blockedSuites: report.blockedSuites });
}
const manifest = { capturedAt: new Date().toISOString(), baselinePublishedCommit: 'a155685e30510cf626b03f83a6b7fc79c845baf2',
  sourceAtValidation: source.sourceCommit, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256,
  validation: { rustVersions: ['1.98.1', '1.99.1'], rustTestsPerVersion: 275, nodeVersions: ['22.12.0', '24.14.1'],
    fullNodeTestsPerVersion: 3157, benchmarkContractTestsPerVersion: 52, supplementalNewBenchmarkTestsPerVersion: 6, jestTestsPerVersion: 21, vitestTestsPerVersion: 32,
    vmTestsPerVersion: 32, rustMemcheckTests: 275, rustMemcheckBatches: native.runs.length, releaseGatesPassed: gates.gates.length, wptReports },
  review: { provider: 'Codex native read-only reviewer', finalProductionFindings: 0, behaviorProbesPerNode: 44, gcProbesPerNode: 4,
    correctedBenchmarkFinding: 'Capturar y verificar actividad nativa antes de las lecturas auxiliares de validate, usando el contador propio del tramo medido.',
    harnessLimit: 'Dos intentos preliminares del probe de GC de review se invalidaron por errores del arnés; solo los probes corregidos sustentan las conclusiones.' },
  packageReports, validationSources, fileCount: files.length, originalBytes: files.reduce((sum, file) => sum + file.originalBytes, 0),
  preservedBytes: files.reduce((sum, file) => sum + file.bytes, 0), files };
await writeFile(join(repositoryRoot, outputRoot, 'evidence.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256, packageReports,
  comparisonRows: comparisons.length, deltaRange: [Math.min(...comparisons.map((entry) => entry.deltaPercent)), Math.max(...comparisons.map((entry) => entry.deltaPercent))] }, null, 2));
