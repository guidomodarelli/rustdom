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
const source = JSON.parse(await readFile(join(repositoryRoot, '.cache/name-queries-current-source.json')));
assert.equal(require(join(runtimeRoot, 'benchmarks/sources.cjs')).captureSourceIdentity(runtimeRoot).sourceHash, source.sourceHash);
const outputRoot = 'reports/validation/name-queries';
const logsRoot = join(runtimeRoot, outputRoot);
const start = Date.parse(JSON.parse(await readFile(join(logsRoot, 'baseline.json'))).capturedAt);
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
await preserve(join(repositoryRoot, '.cache/name-queries-current-source.json'), join(outputRoot, 'source.json'), 'final-source');
await preserve(join(runtimeRoot, 'dist/native-build.json'), join(outputRoot, 'native-build.json'), 'final-addon');
await preserve(join(runtimeRoot, 'baseline-engine/dist/native-build.json'), join(outputRoot, 'baseline-native-build.json'), 'checkpoint-061-baseline');
await preserve(join(runtimeRoot, 'artifacts/latest.json'), join(outputRoot, 'artifact.json'), 'installed-package');
for (const name of ['pr73-merge-proof.json', 'pr73-merged.json']) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'foundation', name), 'integrated-foundation');
}
await preserve(join(taskRoot, '.cache/name-queries-main61-rebase.json'), join(outputRoot, 'foundation/main61-rebase.json'), 'equivalent-parent-trees');
await preserve(join(repositoryRoot, '.cache/name-queries-before-main61-source.json'), join(outputRoot, 'foundation/source-before-rebase.json'), 'equivalent-parent-trees');
for (const name of ['setup-name-queries-runtime.sh', 'capture-name-query-baseline.cjs',
  'validate-name-queries-focal.sh', 'validate-name-queries-gc.sh', 'validate-name-query-runner-output.sh',
  'validate-name-queries-final.sh', 'validate-name-queries-bench-contracts.sh', 'validate-name-queries-worker.sh',
  'resume-name-queries-worker.sh', 'rebase-name-queries-main61.cjs', 'benchmark-name-queries.sh',
  'fetch-name-query-wpt.cjs', 'register-name-query-wpt.cjs', 'validate-name-query-wpt.sh',
  'compare-name-queries-native-memory.cjs', 'collect-name-queries-evidence.mjs', 'verify-name-queries-evidence.mjs',
  'render-name-queries-readme.mjs', 'render-name-queries-validation.mjs', 'update-name-queries-progress.cjs']) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'commands', name), 'execution-commands');
}
await preserve(join(taskRoot, '.cache/name-query-wpt-source.json'), join(outputRoot, 'wpt-upstream-source.json'), 'upstream-fixture-provenance');
await preserveDirectory(join(runtimeRoot, 'reports/compatibility'), join(outputRoot, 'compatibility-history'), 'compatibility-history', afterStart);
await preserveDirectory(join(runtimeRoot, 'reports/memory'), 'reports/memory/name-queries/history', 'memory-history', afterStart);
const candidateBuild = JSON.parse(await readFile(join(runtimeRoot, 'dist/native-build.json')));
const baselineBuild = JSON.parse(await readFile(join(runtimeRoot, 'baseline-engine/dist/native-build.json')));
assert.equal(baselineBuild.binarySha256, 'f5ae22cf5fe22d95e3a51b23693738de8c9040bc1332640d9b3ecb136899fa77');
const benchmarkLog = await readFile(join(logsRoot, 'benchmarks.log'), 'utf8');
const benchmarkPaths = [...benchmarkLog.matchAll(/Guardado: (reports\/benchmarks\/[^\r\n]+\.json)/g)].map((match) => match[1]);
assert.equal(benchmarkPaths.length, 8);
const benchmarkReports = [];
for (const reportPath of benchmarkPaths) {
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.complete, true); assert.equal(report.runs.length, 4); assert.equal(report.comparisons.length, 14);
  assert.equal(report.sourceHash, source.sourceHash);
  const stage = report.runtimeSource.kind === 'package-override' ? 'baseline' : 'candidate';
  assert.equal(report.nativeBinarySha256, stage === 'baseline' ? baselineBuild.binarySha256 : candidateBuild.binarySha256);
  for (const result of report.comparisons) { assert.equal(result.rustdom.samples, 18); assert.equal(result.jsdom.samples, 18); }
  const destination = `reports/benchmarks/name-queries/${reportPath.split('/').at(-1)}`;
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
  baselineCommit: '0921ab08459a22b237faf1c2ba19a250720f1dd9', baselineSourceHash: '857dbc564eb2c810ad7d87e494e0b3497c98ea4fc46c3b467dbec5d1aed618c7',
  baselineBinarySha256: baselineBuild.binarySha256, candidateBinarySha256: candidateBuild.binarySha256,
  methodology: 'Rust 1.99.1 release before/after. Four Document.getElementsByName workloads at 100/1000 mixed-namespace Elements: fresh, attribute-invalidated live, stable cached, and missing. Three controls exercise shared code: class live, class cached, and children refresh. Eight reports and 32 isolated workers; 36 raw samples per engine/stage/runtime/row, three warmups and nine measured samples per process. Stages and engine orders alternate. Every sample consumes 100 public operations. Native activity is checked before auxiliary reads; all identities/attributes/results and hashes must agree. Name inputBytes identifies the actual 21-byte bootstrap HTML, with Element count reported separately. Setup, validation, cleanup and GC excluded. Shared WSL2 CPU; post-GC memory is not peak. Earlier worker smoke runs are correctness-only and excluded from these measurements.',
  rawReports: benchmarkReports.map(({ stage, report, path }) => ({ stage, node: report.node, path })), comparisons };
await writeFile(join(repositoryRoot, 'reports/benchmarks/name-queries/comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
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
assert.equal(native.pass, true); assert.equal(native.runs.reduce((sum, run) => sum + run.tests.length, 0), 285);
for (const name of ['rust-tests.log', 'rust-tests-198.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /test result: ok\. 285 passed; 0 failed/);
for (const name of ['javascript-tests.log', 'full-node22.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 3419/);
for (const name of ['benchmark-contracts-v24.14.1.log', 'benchmark-contracts-v22.12.0.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 72/);
for (const name of ['gc-v24.14.1.log', 'gc-v22.12.0.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 62/);
const memoryReports = [];
for (const name of await readdir(join(runtimeRoot, 'reports/memory/collection-queries'))) {
  if (!name.endsWith('.json')) continue;
  const report = JSON.parse(await readFile(join(runtimeRoot, 'reports/memory/collection-queries', name)));
  if (Date.parse(report.capturedAt) >= start) memoryReports.push({ name, report });
}
const collectionMemory = ['v22.12.0', 'v24.14.1'].map((node) => {
  const latest = memoryReports.filter(({ report }) => report.node === node).sort((left, right) => Date.parse(right.report.capturedAt) - Date.parse(left.report.capturedAt))[0];
  assert.ok(latest, node); assert.equal(latest.report.pass, true); assert.equal(latest.report.cases.length, 52);
  for (const sample of latest.report.cases) {
    const endpoint = sample.endpoint || sample.released;
    assert.equal(endpoint.reached, true);
    for (const count of Object.values(endpoint.state.survivors)) assert.equal(count, 0);
  }
  return { node, scenarios: latest.report.cases.length, pass: true, path: `reports/memory/name-queries/history/collection-queries/${latest.name}.gz` };
});
const validationSources = [];
for (const path of ['tests/name-queries.spec.cjs', 'tests/helpers/collection-query-memory.cjs', 'tests/helpers/abort-runner-memory.cjs', 'tests/benchmarks/name-queries.spec.cjs', 'types/native.d.cts', 'tests/fixtures/wpt/manifest.json']) {
  const sha256 = await digest(join(repositoryRoot, path)); assert.equal(await digest(join(runtimeRoot, path)), sha256, path);
  validationSources.push({ path, sha256 });
}
const baseWptReports = [];
for (const name of ['wpt-contracts.log', 'wpt-node22.log']) {
  const reportPath = [...(await readFile(join(logsRoot, name), 'utf8')).matchAll(/Guardado: (reports\/compatibility\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.pass, true); assert.equal(report.results.length, 221);
  baseWptReports.push({ node: report.node, parity: report.pass, complete: report.complete, fixtures: report.results.length,
    assertions: report.results.reduce((sum, result) => sum + result.actual.tests.length, 0),
    sharedStandardsFailures: report.results.reduce((sum, result) => sum + result.actual.tests.filter((test) => test.status !== 0).length, 0),
    exclusions: report.excludedFixtures, blockedSuites: report.blockedSuites });
}
const originalWpt = JSON.parse(await readFile(join(logsRoot, 'wpt-manifest-before-name-suite.json')));
const expandedWpt = JSON.parse(await readFile(join(logsRoot, 'wpt-manifest-with-name-suite.json')));
for (const [path, sha256] of Object.entries(originalWpt.files)) assert.equal(expandedWpt.files[path], sha256, path);
for (const [suite, paths] of Object.entries(originalWpt.suites)) assert.deepEqual(expandedWpt.suites[suite], paths, suite);
assert.deepEqual(expandedWpt.excludedFixtures, originalWpt.excludedFixtures);
assert.deepEqual(expandedWpt.blockedSuites, originalWpt.blockedSuites);
assert.equal(expandedWpt.suites['document-name-queries'].length, 15);
const supplementalWptReports = [];
for (const name of ['wpt-names-v24.14.1.log', 'wpt-names-v22.12.0.log']) {
  const reportPath = [...(await readFile(join(logsRoot, name), 'utf8')).matchAll(/Guardado: (reports\/compatibility\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.pass, true); assert.equal(report.results.length, 15);
  supplementalWptReports.push({ node: report.node, parity: true, fixtures: report.results.length,
    assertions: report.results.reduce((sum, result) => sum + result.actual.tests.length, 0),
    sharedStandardsFailures: report.results.reduce((sum, result) => sum + result.actual.tests.filter((test) => test.status !== 0).length, 0) });
}
const wptReports = baseWptReports.map((base) => {
  const supplement = supplementalWptReports.find((report) => report.node === base.node);
  assert.ok(supplement);
  return { ...base, fixtures: base.fixtures + supplement.fixtures, assertions: base.assertions + supplement.assertions,
    sharedStandardsFailures: base.sharedStandardsFailures + supplement.sharedStandardsFailures,
    executionScope: '221-fixture release suite plus a separate 15-fixture name-query suite on identical product code. Existing fixture hashes, suites and exclusions remain unchanged.',
    base, supplement };
});
const manifest = { capturedAt: new Date().toISOString(), baselinePublishedCommit: '0921ab08459a22b237faf1c2ba19a250720f1dd9',
  sourceAtValidation: source.sourceCommit, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256,
  validation: { rustVersions: ['1.98.1', '1.99.1'], rustTestsPerVersion: 285, nodeVersions: ['22.12.0', '24.14.1'],
    fullNodeTestsPerVersion: 3419, benchmarkContractTestsPerVersion: 72, newBenchmarkTestsPerVersion: 8, jestTestsPerVersion: 21, vitestTestsPerVersion: 32,
    vmTestsPerVersion: 32, focusedNodeTestsPerVersion: 61, focusedWithMemoryTestsPerVersion: 62, collectionMemory, rustMemcheckTests: 285, rustMemcheckBatches: native.runs.length, releaseGatesPassed: gates.gates.length, wptReports },
  review: { provider: 'Codex native read-only reviewer', finalProductionFindings: 0,
    scope: 'Dirty local diff over 55e2cb8; Codex static review only, no independent runtime probes or other provider. Accepted findings on GC body teardown and worker anchor/input metadata were fixed, verified with real commands and re-reviewed to zero. The clean-checkout output-directory fix also passed the real abort runner.' },
  packageReports, validationSources, fileCount: files.length, originalBytes: files.reduce((sum, file) => sum + file.originalBytes, 0),
  preservedBytes: files.reduce((sum, file) => sum + file.bytes, 0), files };
await writeFile(join(repositoryRoot, outputRoot, 'evidence.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256, packageReports,
  comparisonRows: comparisons.length, deltaRange: [Math.min(...comparisons.map((entry) => entry.deltaPercent)), Math.max(...comparisons.map((entry) => entry.deltaPercent))] }, null, 2));
