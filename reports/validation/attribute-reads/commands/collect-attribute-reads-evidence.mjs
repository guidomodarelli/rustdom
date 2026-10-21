import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const [runtimeRoot, repositoryRoot, taskRoot] = process.argv.slice(2);
const require = createRequire(join(runtimeRoot, 'package.json'));
const phase = 'reports/validation/attribute-reads';
const logsRoot = join(runtimeRoot, phase);
const source = JSON.parse(await readFile(join(repositoryRoot, '.cache/attribute-reads-source.json')));
assert.equal(require(join(runtimeRoot, 'benchmarks/sources.cjs')).captureSourceIdentity(runtimeRoot).sourceHash, source.sourceHash);
assert.equal(require(join(repositoryRoot, 'benchmarks/sources.cjs')).captureSourceIdentity(repositoryRoot).sourceHash, source.sourceHash);
const candidateBuild = JSON.parse(await readFile(join(runtimeRoot, 'dist/native-build.json')));
const baselineBuild = JSON.parse(await readFile(join(runtimeRoot, 'baseline-engine/dist/native-build.json')));
assert.equal(candidateBuild.binarySha256, source.nativeBinarySha256);
assert.equal(baselineBuild.binarySha256, source.baselineNativeBinarySha256);
const gates = JSON.parse(await readFile(join(logsRoot, 'release-gates-node24.json')));
assert.equal(gates.pass, true); assert.equal(gates.gates.length, 7);
const baseline = JSON.parse(await readFile(join(logsRoot, 'baseline.json')));
const started = Date.parse(baseline.capturedAt);
const files = [];
const digest = async (path) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
};
async function preserve(sourcePath, destinationPath, scope) {
  const original = await stat(sourcePath), compressed = original.size > 64 * 1024;
  const path = destinationPath.replaceAll('\\', '/') + (compressed ? '.gz' : '');
  assert.ok(!files.some((file) => file.path === path), path);
  const destination = join(repositoryRoot, path); await mkdir(dirname(destination), { recursive: true });
  if (compressed) await pipeline(createReadStream(sourcePath), createGzip(), createWriteStream(destination));
  else await copyFile(sourcePath, destination);
  files.push({ path, scope, originalBytes: original.size, bytes: (await stat(destination)).size, sha256: await digest(destination),
    ...(compressed ? { compression: 'gzip', originalSha256: await digest(sourcePath) } : {}) });
  return path;
}
async function preserveDirectory(sourceDirectory, destinationDirectory, scope, recentOnly = false) {
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const path = join(sourceDirectory, entry.name), destination = join(destinationDirectory, entry.name);
    if (entry.isDirectory()) await preserveDirectory(path, destination, scope, recentOnly);
    else if (entry.isFile() && (!recentOnly || (await stat(path)).mtimeMs >= started)) await preserve(path, destination, scope);
  }
}
const log = (name) => readFile(join(logsRoot, name), 'utf8');
function savedReports(contents, group) {
  return [...contents.matchAll(new RegExp('Guardado: (reports/' + group + '/[^\\r\\n]+\\.json)', 'g'))].map((match) => match[1]);
}
for (const name of ['rust-tests.log', 'rust-tests-198.log']) assert.match(await log(name), /test result: ok\. 305 passed; 0 failed/);
for (const name of ['javascript-tests.log', 'full-node22.log']) {
  const contents = (await log(name)).replace(/\x1b\[[0-9;]*m/g, '');
  assert.match(contents, /(?:ℹ|#) pass 3638/); assert.match(contents, /Tests:\s+21 passed, 21 total/);
  assert.equal([...contents.matchAll(/Tests\s+32 passed/g)].length, 2);
}
for (const node of ['v22.12.0', 'v24.14.1']) {
  assert.match(await log('baseline-' + node + '.log'), /(?:ℹ|#) pass 37/);
  assert.match(await log('focal-final-' + node + '.log'), /(?:ℹ|#) pass 273/);
  assert.match(await log('benchmark-contracts-' + node + '.log'), /(?:ℹ|#) pass 105/);
}
for (const name of ['html5-corpus.log', 'corpus-node22.log']) assert.match(await log(name), /1784\/1784 casos comparados compatibles/);
const wptReports = [];
for (const name of ['wpt-contracts.log', 'wpt-node22.log']) {
  const path = savedReports(await log(name), 'compatibility').at(-1);
  const report = JSON.parse(await readFile(join(runtimeRoot, path)));
  assert.equal(report.pass, true); assert.equal(report.results.length, 240); assert.equal(report.complete, false);
  wptReports.push({ node: report.node, fixtures: report.results.length, parity: report.pass, complete: report.complete,
    assertions: report.results.reduce((sum, result) => sum + result.actual.tests.length, 0),
    sharedStandardsFailures: report.results.reduce((sum, result) => sum + result.actual.tests.filter((test) => test.status !== 0).length, 0),
    exclusions: report.excludedFixtures, blockedSuites: report.blockedSuites,
    executionScope: 'One complete local WPT command per Node version; unchanged pinned manifest and upstream bytes.' });
}
const nativePath = savedReports(await log('native-memory.log'), 'memory').at(-1);
const native = JSON.parse(await readFile(join(runtimeRoot, nativePath)));
assert.equal(native.pass, true); assert.equal(native.runs.reduce((sum, run) => sum + run.tests.length, 0), 305);
assert.ok(native.runs.every((run) => run.testsCompleted && run.exitCode === 0 && !run.signal && !run.error));
const generalPath = savedReports(await log('general-memory.log'), 'memory').at(-1);
const general = JSON.parse(await readFile(join(runtimeRoot, generalPath)));
assert.equal(general.pass, true); assert.equal(general.results.length, 5);
const memoryReports = [];
for (const node of ['v22.12.0', 'v24.14.1']) {
  const path = savedReports(await log('gc-' + node + '.log'), 'memory').at(-1);
  const report = JSON.parse(await readFile(join(runtimeRoot, path)));
  assert.equal(report.pass, true); assert.equal(report.node, node); assert.equal(report.cases.length, 32);
  assert.equal(report.nativeBinarySha256, candidateBuild.binarySha256);
  for (const sample of report.cases.filter((sample) => sample.endpoint)) {
    assert.equal(sample.endpoint.reached, true);
    assert.ok(Object.values(sample.endpoint.state.survivors).every((count) => count === 0));
  }
  memoryReports.push({ node, scenarios: 32, path: 'reports/memory/attribute-reads/history/' + path.split('/').at(-1), pass: true });
}
await preserveDirectory(logsRoot, phase, 'validation-history');
await preserve(join(runtimeRoot, 'dist/native-build.json'), phase + '/native-build.json', 'final-addon');
await preserve(join(runtimeRoot, 'baseline-engine/dist/native-build.json'), phase + '/baseline-native-build.json', 'checkpoint-064-baseline');
await preserve(join(runtimeRoot, 'artifacts/latest.json'), phase + '/artifact.json', 'installed-package');
await preserve(join(runtimeRoot, 'reports/validation/html5lib.json'), phase + '/html5lib-last-node22.json', 'corpus');
await preserveDirectory(join(runtimeRoot, 'reports/compatibility'), phase + '/compatibility-history', 'compatibility-history', true);
await preserveDirectory(join(runtimeRoot, 'reports/memory'), 'reports/memory/attribute-reads/history', 'memory-history', true);
for (const report of memoryReports) {
  const preserved = files.find((file) => file.path === report.path || file.path === report.path + '.gz');
  assert.ok(preserved, report.path); report.path = preserved.path;
}
for (const name of ['pr76-merge-proof.json', 'pr76-merged.json']) await preserve(join(taskRoot, '.cache', name), phase + '/foundation/' + name, 'integrated-foundation');
for (const name of ['attribute-reads-start.json', 'attribute-reads-review.json', 'attribute-reads-local-review.json', 'attribute-reads-canonical-preflight.json']) {
  await preserve(join(repositoryRoot, '.cache', name), phase + '/foundation/' + name, 'source-and-review-provenance');
}
for (const name of ['prepare-attribute-reads.cjs', 'setup-attribute-reads.sh', 'validate-attribute-reads-baseline.sh',
  'build-attribute-reads.sh', 'sync-attribute-reads.cjs', 'snapshot-attribute-reads.cjs', 'validate-attribute-reads-focal.sh',
  'validate-attribute-reads-final.sh', 'capture-attribute-reads.cjs', 'benchmark-attribute-reads.sh',
  'archive-id-input-pilot.cjs', 'summarize-attribute-reads-memcheck.cjs', 'preflight-attribute-reads-evidence.cjs',
  'preflight-attribute-reads-canonical.cjs', 'record-attribute-reads-local-review.cjs', 'preserve-attribute-reads-corpus.cjs',
  'collect-attribute-reads-evidence.mjs']) {
  await preserve(join(taskRoot, '.cache', name), phase + '/commands/' + name, 'execution-commands');
}
const benchmarkPaths = savedReports(await log('benchmarks.log'), 'benchmarks');
assert.equal(benchmarkPaths.length, 8);
const reports = [];
for (const reportPath of benchmarkPaths) {
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.complete, true); assert.equal(report.runs.length, 4); assert.equal(report.comparisons.length, 30);
  assert.equal(report.sourceHash, source.sourceHash);
  const stage = report.runtimeSource.kind === 'package-override' ? 'baseline' : 'candidate';
  assert.equal(report.nativeBinarySha256, stage === 'baseline' ? baselineBuild.binarySha256 : candidateBuild.binarySha256);
  for (const row of report.comparisons) for (const engine of ['jsdom', 'rustdom']) assert.equal(row[engine].samples, 18);
  const path = await preserve(join(runtimeRoot, reportPath), 'reports/benchmarks/attribute-reads/' + reportPath.split('/').at(-1), stage + '-benchmark');
  reports.push({ stage, report, path });
}
function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right), middle = Math.floor(sorted.length / 2);
  return { samples: sorted.length, medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], minMs: sorted[0], maxMs: sorted.at(-1) };
}
const comparisons = [];
for (const node of ['v22.12.0', 'v24.14.1']) {
  const before = reports.filter((entry) => entry.stage === 'baseline' && entry.report.node === node);
  const after = reports.filter((entry) => entry.stage === 'candidate' && entry.report.node === node);
  assert.equal(before.length, 2); assert.equal(after.length, 2);
  for (const row of before[0].report.comparisons) {
    const matches = (entry) => entry.name === row.workload && entry.rows === row.rows;
    const samples = (entries, engine) => entries.flatMap(({ report }) => report.runs.filter((run) => run.engine === engine)
      .flatMap((run) => run.workloads.find(matches).samplesMs));
    const baseline = summarize(samples(before, 'rustdom')), candidate = summarize(samples(after, 'rustdom'));
    const jsdomBefore = summarize(samples(before, 'jsdom')), jsdomAfter = summarize(samples(after, 'jsdom'));
    for (const result of [baseline, candidate, jsdomBefore, jsdomAfter]) assert.equal(result.samples, 36);
    assert.equal(new Set([...before, ...after].flatMap(({ report }) => report.runs.map((run) => run.workloads.find(matches).outputHash))).size, 1);
    comparisons.push({ node, workload: row.workload, size: row.rows, baseline, candidate, jsdomBefore, jsdomAfter,
      deltaPercent: (candidate.medianMs / baseline.medianMs - 1) * 100,
      candidateSpeedup: jsdomAfter.medianMs / candidate.medianMs,
      jsdomControlDeltaPercent: (jsdomAfter.medianMs / jsdomBefore.medianMs - 1) * 100,
      repetitions: before.map((entry, index) => {
        const median = (report) => report.comparisons.find((result) => result.workload === row.workload && result.rows === row.rows).rustdom.medianMs;
        const baselineMedianMs = median(entry.report), candidateMedianMs = median(after[index].report);
        return { order: index === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'], baselineMedianMs,
          candidateMedianMs, deltaPercent: (candidateMedianMs / baselineMedianMs - 1) * 100 };
      }) });
  }
}
const comparison = { capturedAt: new Date().toISOString(), sourceHash: source.sourceHash,
  baselineCommit: baseline.commit, baselineCheckpoint: baseline.checkpoint,
  baselineBinarySha256: baselineBuild.binarySha256, candidateBinarySha256: candidateBuild.binarySha256,
  methodology: 'Eleven public attribute tasks plus Document ID read/register/change and document-name-miss. 100/1000 prepared Attrs for attribute tasks, plus fixed title; 100/1000 mixed-namespace Elements for ID/name tasks. Each sample consumes 100 public reads/setters, except ID-register which times one public append. Eight reports/32 workers, both stage orders and 36 samples per engine/stage/runtime/row; three warmups/nine measured samples per worker. Setup, full correctness checks, serialization hashes, cleanup and explicit GC excluded. Includes WebIDL/bridge/output conversion. Shared WSL CPU, no overlapping validation/build work during final timing; no full-suite or peak-memory speed claim. The title reflection wrapper still applies its null-to-empty fallback in the host; native empty projection is tested separately through attributeReflectionValue and used by the attribute helpers.',
  rawReports: reports.map(({ stage, report, path }) => ({ stage, node: report.node, path })), comparisons };
const comparisonPath = 'reports/benchmarks/attribute-reads/comparison.json';
await writeFile(join(repositoryRoot, comparisonPath), JSON.stringify(comparison, null, 2) + '\n');
const comparisonSize = (await stat(join(repositoryRoot, comparisonPath))).size;
files.push({ path: comparisonPath, scope: 'aggregated-balanced-benchmarks', originalBytes: comparisonSize, bytes: comparisonSize, sha256: await digest(join(repositoryRoot, comparisonPath)) });
const packageReports = [];
for (const name of ['package-node24.log', 'package-node22.log']) {
  const reportPath = savedReports(await log(name), 'distribution').at(-1);
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.pass, true); assert.equal(report.runs.length, 20); assert.equal(report.artifact.native.binarySha256, candidateBuild.binarySha256);
  const path = await preserve(join(runtimeRoot, reportPath), reportPath, 'installed-package');
  const stem = reportPath.split('/').at(-1).replace(/\.json$/, '');
  for (const entry of await readdir(join(runtimeRoot, 'reports/distribution'))) if (entry.startsWith(stem + '-')) {
    await preserve(join(runtimeRoot, 'reports/distribution', entry), 'reports/distribution/' + entry, 'installed-package');
  }
  packageReports.push({ path, node: report.node, checks: report.runs.length, packageSha256: report.artifact.sha256 });
}
assert.equal(new Set(packageReports.map((report) => report.packageSha256)).size, 1);
const validationSources = [];
for (const path of ['tests/attribute-reads.spec.cjs', 'tests/native-attribute-reads.spec.cjs', 'tests/benchmarks/attribute-reads.spec.cjs',
  'types/index.d.cts', 'types/native.d.cts', 'tests/fixtures/wpt/manifest.json']) {
  const sha256 = await digest(join(repositoryRoot, path)); assert.equal(await digest(join(runtimeRoot, path)), sha256);
  validationSources.push({ path, sha256 });
}
const evidence = { capturedAt: new Date().toISOString(), baselineCommit: baseline.commit, sourceHash: source.sourceHash,
  nativeBinarySha256: candidateBuild.binarySha256, sourceFiles: source.files, validationSources,
  validation: { rustVersions: ['1.98.1', '1.99.1'], rustTestsPerVersion: 305, nodeVersions: ['22.12.0', '24.14.1'],
    fullNodeTestsPerVersion: 3638, jestTestsPerVersion: 21, vitestTestsPerVersion: 32, vmTestsPerVersion: 32,
    baselineDifferentialTestsPerVersion: 37, focusedIntegrationTestsPerVersion: 273,
    benchmarkContractTestsPerVersion: 105, newBenchmarkTests: 11, releaseGatesPassed: 7, wptReports,
    memoryReports, generalMemory: { node: general.node, pass: true, targets: general.targets, results: general.results.map((result) => ({
      mode: result.mode, documents: [result.survivingDocuments, result.observedDocuments], windows: [result.survivingWindows, result.observedWindows], growth: result.growth })) },
    rustMemcheckTests: 305, rustMemcheckBatches: native.runs.length, memcheckScope: native.limitations },
  packageReports, review: JSON.parse(await readFile(join(repositoryRoot, '.cache/attribute-reads-local-review.json'))),
  fileCount: files.length, originalBytes: files.reduce((sum, file) => sum + file.originalBytes, 0),
  preservedBytes: files.reduce((sum, file) => sum + file.bytes, 0), files };
await writeFile(join(repositoryRoot, phase, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256,
  comparisonRows: comparisons.length, packageReports, deltaRange: [Math.min(...comparisons.map((row) => row.deltaPercent)), Math.max(...comparisons.map((row) => row.deltaPercent))] }));
