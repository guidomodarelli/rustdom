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
const source = JSON.parse(await readFile(join(repositoryRoot, '.cache/fragment-id-current-source.json')));
assert.equal(require(join(runtimeRoot, 'benchmarks/sources.cjs')).captureSourceIdentity(runtimeRoot).sourceHash, source.sourceHash);
const outputRoot = 'reports/validation/fragment-id';
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
await preserve(join(repositoryRoot, '.cache/fragment-id-current-source.json'), join(outputRoot, 'source.json'), 'final-source');
await preserve(join(runtimeRoot, 'dist/native-build.json'), join(outputRoot, 'native-build.json'), 'final-addon');
await preserve(join(runtimeRoot, 'baseline-engine/dist/native-build.json'), join(outputRoot, 'baseline-native-build.json'), 'checkpoint-062-baseline');
await preserve(join(runtimeRoot, 'artifacts/latest.json'), join(outputRoot, 'artifact.json'), 'installed-package');
for (const name of ['pr74-merge-proof.json', 'pr74-merged.json']) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'foundation', name), 'integrated-foundation');
}
await preserve(join(taskRoot, '.cache/fragment-id-start-proof.json'), join(outputRoot, 'foundation/start-proof.json'), 'equivalent-parent-trees');
await preserve(join(taskRoot, '.cache/pr74-git-evidence-check.json'), join(outputRoot, 'foundation/pr74-git-evidence-check.json'), 'canonical-published-bytes');
await preserve(join(taskRoot, '.cache/next-id-baseline-observation.json'), join(outputRoot, 'pending-id-contracts.json'), 'next-migration-baseline');
await preserve(join(taskRoot, '.cache/observe-next-id-baseline.cjs'), join(outputRoot, 'commands/observe-next-id-baseline.cjs'), 'next-migration-baseline');
for (const name of [
  "setup-fragment-id-runtime.sh",
  "prepare-fragment-id-archive.cjs",
  "implement-fragment-id.cjs",
  "validate-fragment-id-focal.sh",
  "validate-fragment-id-gc.sh",
  "add-fragment-id-gc-test.cjs",
  "prepare-fragment-id-benchmarks.cjs",
  "resume-fragment-id-benchmarks.cjs",
  "validate-fragment-id-contracts.sh",
  "fetch-fragment-id-wpt.cjs",
  "register-fragment-id-wpt.cjs",
  "validate-fragment-id-wpt.sh",
  "capture-fragment-id-validation-sources.cjs",
  "validate-fragment-id-final.sh",
  "copy-fragment-id-sources.cjs",
  "start-fragment-id-branch.cjs",
  "benchmark-fragment-id.sh",
  "compare-fragment-id-native-memory.cjs",
  "collect-fragment-id-evidence.mjs",
  "verify-fragment-id-evidence.mjs",
  "render-fragment-id-readme.mjs",
  "render-fragment-id-validation.mjs",
  "update-fragment-id-progress.cjs"
]) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'commands', name), 'execution-commands');
}
await preserve(join(taskRoot, '.cache/fragment-id-wpt-source.json'), join(outputRoot, 'wpt-upstream-source.json'), 'upstream-fixture-provenance');
await preserveDirectory(join(runtimeRoot, 'reports/compatibility'), join(outputRoot, 'compatibility-history'), 'compatibility-history', afterStart);
await preserveDirectory(join(runtimeRoot, 'reports/memory'), 'reports/memory/fragment-id/history', 'memory-history', afterStart);
const candidateBuild = JSON.parse(await readFile(join(runtimeRoot, 'dist/native-build.json')));
const baselineBuild = JSON.parse(await readFile(join(runtimeRoot, 'baseline-engine/dist/native-build.json')));
assert.equal(baselineBuild.binarySha256, 'ca4c8081fe104e56131ed8e4beddc39dcbef1074e26b31ec70968f2f3aadcc30');
const benchmarkLog = await readFile(join(logsRoot, 'benchmarks.log'), 'utf8');
const benchmarkPaths = [...benchmarkLog.matchAll(/Guardado: (reports\/benchmarks\/[^\r\n]+\.json)/g)].map((match) => match[1]);
assert.equal(benchmarkPaths.length, 8);
const benchmarkReports = [];
for (const reportPath of benchmarkPaths) {
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.complete, true); assert.equal(report.runs.length, 4); assert.equal(report.comparisons.length, 10);
  assert.equal(report.sourceHash, source.sourceHash);
  const stage = report.runtimeSource.kind === 'package-override' ? 'baseline' : 'candidate';
  assert.equal(report.nativeBinarySha256, stage === 'baseline' ? baselineBuild.binarySha256 : candidateBuild.binarySha256);
  for (const result of report.comparisons) { assert.equal(result.rustdom.samples, 18); assert.equal(result.jsdom.samples, 18); }
  const destination = `reports/benchmarks/fragment-id/${reportPath.split('/').at(-1)}`;
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
  baselineCommit: '645f2ec514986f51893d8cb7f01b50610da54eec', baselineSourceHash: 'bacff4caae10b43c593997c4f12b48ab3c9a292707d174f8680b25b44ba63998',
  baselineBinarySha256: baselineBuild.binarySha256, candidateBinarySha256: candidateBuild.binarySha256,
  methodology: 'Rust 1.99.1 release before/after. Four ID workloads at 100/1000 mixed-namespace Elements: first, last and missing in a detached DocumentFragment, plus last in ShadowRoot. Document-name miss is an unchanged control. Eight reports and 32 isolated workers; 36 raw samples per engine/stage/runtime/row, three warmups and nine measured samples per process. Stages and engine orders alternate. Every sample consumes 100 public operations. Check native activity before auxiliary reads, then every identity/attribute and full fragment/shadow XML serialization hash. inputBytes is the actual 21-byte bootstrap; row size counts prepared Elements. Setup, validation, cleanup and GC excluded. Shared WSL2 CPU; post-GC memory is not peak. Earlier CLI smokes are correctness-only and excluded from these measurements.',
  rawReports: benchmarkReports.map(({ stage, report, path }) => ({ stage, node: report.node, path })), comparisons };
await writeFile(join(repositoryRoot, 'reports/benchmarks/fragment-id/comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
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
assert.equal(native.pass, true); assert.equal(native.runs.reduce((sum, run) => sum + run.tests.length, 0), 291);
for (const name of ['rust-tests.log', 'rust-tests-198.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /test result: ok\. 291 passed; 0 failed/);
for (const name of ['javascript-tests.log', 'full-node22.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 3506/);
for (const name of ['benchmark-contracts-v24.14.1.log', 'benchmark-contracts-v22.12.0.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 80/);
for (const name of ['gc-contracts-v24.14.1.log', 'gc-contracts-v22.12.0.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /(?:ℹ|#) pass 87/);
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
  return { node, scenarios: latest.report.cases.length, pass: true, path: `reports/memory/fragment-id/history/collection-queries/${latest.name}.gz` };
});
const fragmentMemoryReports = [];
for (const name of await readdir(join(runtimeRoot, 'reports/memory/fragment-id'))) {
  if (!name.endsWith('.json')) continue;
  const report = JSON.parse(await readFile(join(runtimeRoot, 'reports/memory/fragment-id', name)));
  if (Date.parse(report.capturedAt) >= start) fragmentMemoryReports.push({ name, report });
}
const fragmentMemory = ['v22.12.0', 'v24.14.1'].map((node) => {
  const latest = fragmentMemoryReports.filter(({ report }) => report.node === node).sort((left, right) => Date.parse(right.report.capturedAt) - Date.parse(left.report.capturedAt))[0];
  assert.ok(latest, node); assert.equal(latest.report.pass, true); assert.equal(latest.report.cases.length, 78);
  for (const sample of latest.report.cases) {
    const endpoint = sample.endpoint || sample.released;
    assert.equal(endpoint.reached, true);
    for (const count of Object.values(endpoint.state.survivors)) assert.equal(count, 0);
    if (sample.removed) assert.equal(sample.removed.reached, true);
  }
  return { node, scenarios: latest.report.cases.length, pass: true, path: 'reports/memory/fragment-id/history/fragment-id/' + latest.name + '.gz' };
});
const validationSources = [];
for (const path of ['tests/fragment-id.spec.cjs', 'tests/helpers/fragment-id-memory.cjs', 'tests/benchmarks/fragment-id.spec.cjs', 'types/native.d.cts', 'tests/fixtures/wpt/manifest.json']) {
  const sha256 = await digest(join(repositoryRoot, path)); assert.equal(await digest(join(runtimeRoot, path)), sha256, path);
  validationSources.push({ path, sha256 });
}
const wptReports = [];
for (const name of ['wpt-contracts.log', 'wpt-node22.log']) {
  const reportPath = [...(await readFile(join(logsRoot, name), 'utf8')).matchAll(/Guardado: (reports\/compatibility\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(await readFile(join(runtimeRoot, reportPath)));
  assert.equal(report.pass, true); assert.equal(report.results.length, 240);
  wptReports.push({ node: report.node, parity: report.pass, complete: report.complete, fixtures: report.results.length,
    assertions: report.results.reduce((sum, result) => sum + result.actual.tests.length, 0),
    sharedStandardsFailures: report.results.reduce((sum, result) => sum + result.actual.tests.filter((test) => test.status !== 0).length, 0),
    exclusions: report.excludedFixtures, blockedSuites: report.blockedSuites,
    executionScope: 'One complete local command per Node version over all 240 registered fixtures, including the prior fifteen name-query and four new ID fixtures.' });
}
const originalWpt = JSON.parse(await readFile(join(logsRoot, 'wpt-manifest-before-fragment-suite.json')));
const expandedWpt = JSON.parse(await readFile(join(logsRoot, 'wpt-manifest-with-fragment-suite.json')));
for (const [path, sha256] of Object.entries(originalWpt.files)) assert.equal(expandedWpt.files[path], sha256, path);
for (const [suite, paths] of Object.entries(originalWpt.suites)) assert.deepEqual(expandedWpt.suites[suite], paths, suite);
assert.deepEqual(expandedWpt.excludedFixtures, originalWpt.excludedFixtures);
assert.deepEqual(expandedWpt.blockedSuites, originalWpt.blockedSuites);
assert.equal(expandedWpt.suites['fragment-id-queries'].length, 4);
const manifest = { capturedAt: new Date().toISOString(), baselinePublishedCommit: '645f2ec514986f51893d8cb7f01b50610da54eec',
  sourceAtValidation: source.sourceCommit, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256,
  validation: { rustVersions: ['1.98.1', '1.99.1'], rustTestsPerVersion: 291, nodeVersions: ['22.12.0', '24.14.1'],
    fullNodeTestsPerVersion: 3506, benchmarkContractTestsPerVersion: 80, newBenchmarkTestsPerVersion: 8, jestTestsPerVersion: 21, vitestTestsPerVersion: 32,
    vmTestsPerVersion: 32, baselineDifferentialTestsPerVersion: 84, focusedNodeTestsPerVersion: 86, focusedWithMemoryTestsPerVersion: 87, focusedIntegrationTestsPerVersion: 760, collectionMemory, fragmentMemory, rustMemcheckTests: 291, rustMemcheckBatches: native.runs.length, releaseGatesPassed: gates.gates.length, wptReports },
  review: { provider: 'Codex native read-only reviewer', finalProductionFindings: 0,
    scope: 'Codex static comparison of fourteen code/binding/benchmark/test paths against published 645f2ec, whose tree equals checkpoint 62 main e5a2daa. No independent runtime probes or other provider. Four upstream fixtures, manifest and completed evidence receive a final follow-up before commit.' },
  packageReports, validationSources, fileCount: files.length, originalBytes: files.reduce((sum, file) => sum + file.originalBytes, 0),
  preservedBytes: files.reduce((sum, file) => sum + file.bytes, 0), files };
await writeFile(join(repositoryRoot, outputRoot, 'evidence.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256, packageReports,
  comparisonRows: comparisons.length, deltaRange: [Math.min(...comparisons.map((entry) => entry.deltaPercent)), Math.max(...comparisons.map((entry) => entry.deltaPercent))] }, null, 2));
