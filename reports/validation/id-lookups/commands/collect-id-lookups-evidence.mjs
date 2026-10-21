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
const source = JSON.parse(await readFile(join(repositoryRoot, '.cache/id-lookups-current-source.json')));
assert.equal(require(join(runtimeRoot, 'benchmarks/sources.cjs')).captureSourceIdentity(runtimeRoot).sourceHash, source.sourceHash);
const outputRoot = 'reports/validation/id-lookups';
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
await preserve(join(repositoryRoot, '.cache/id-lookups-current-source.json'), join(outputRoot, 'source.json'), 'final-source');
await preserve(join(runtimeRoot, 'dist/native-build.json'), join(outputRoot, 'native-build.json'), 'final-addon');
await preserve(join(runtimeRoot, 'baseline-engine/dist/native-build.json'), join(outputRoot, 'baseline-native-build.json'), 'checkpoint-063-baseline');
await preserve(join(runtimeRoot, 'artifacts/latest.json'), join(outputRoot, 'artifact.json'), 'installed-package');
for (const name of ['pr75-merge-proof.json', 'pr75-merged.json']) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'foundation', name), 'integrated-foundation');
}
for (const [name, destination] of [['id-lookups-start-proof.json', 'foundation/start-proof.json'],
  ['id-lookups-review-snapshot.json', 'review-snapshot.json']]) {
  await preserve(join(taskRoot, '.cache', name), join(outputRoot, destination), 'source-provenance');
}
for (const name of [
  'setup-id-lookups-runtime.sh', 'prepare-id-lookups-archive.cjs', 'resume-id-lookups-baseline.sh',
  'implement-id-lookups.cjs', 'validate-id-lookups-focal.sh', 'append-id-lookups-regressions.cjs',
  'validate-id-lookups-enhanced.sh', 'probe-id-alias-ownership.cjs', 'validate-id-lookups-gc.sh',
  'add-id-lookups-gc-test.cjs', 'native-id-lifecycle.cjs', 'fix-id-lookups-observable-hooks.cjs',
  'validate-id-lookups-observable-hooks.sh', 'update-id-lookups-evidence-for-hooks.cjs', 'prepare-id-lookups-final-after-hooks.sh', 'finalize-id-lookups-evidence-generator.cjs', 'copy-id-lookups-sources.cjs',
  'start-id-lookups-branch.cjs', 'validate-id-lookups-contracts.sh', 'validate-id-lookups-final.sh', 'capture-id-lookups-toolchains.sh',
  'benchmark-id-lookups.sh', 'compare-id-lookups-native-memory.cjs',
  'create-id-lookups-evidence-collector.cjs', 'collect-id-lookups-evidence.mjs',
  'verify-id-lookups-evidence.mjs', 'render-id-lookups-docs.mjs', 'update-id-lookups-progress.cjs',
]) await preserve(join(taskRoot, '.cache', name), join(outputRoot, 'commands', name), 'execution-commands');
await preserveDirectory(join(runtimeRoot, 'reports/compatibility'), join(outputRoot, 'compatibility-history'), 'compatibility-history', afterStart);
await preserveDirectory(join(runtimeRoot, 'reports/memory'), 'reports/memory/id-lookups/history', 'memory-history', afterStart);
const candidateBuild = JSON.parse(await readFile(join(runtimeRoot, 'dist/native-build.json')));
const baselineBuild = JSON.parse(await readFile(join(runtimeRoot, 'baseline-engine/dist/native-build.json')));
assert.equal(baselineBuild.binarySha256, '69577fc60935fd561f37cfb0b2bfbbd7cf970434448ffb7e795877f17706d23e');
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
  const destination = `reports/benchmarks/id-lookups/${reportPath.split('/').at(-1)}`;
  const path = await preserve(join(runtimeRoot, reportPath), destination, `${stage}-benchmark`);
  await preserve(join(runtimeRoot, reportPath.replace(/\.json$/, '.md')), destination.replace(/\.json$/, '.md'), `${stage}-benchmark`);
  benchmarkReports.push({ stage, report, path });
}
await preserveDirectory(join(runtimeRoot, 'reports/benchmarks'), join(outputRoot, 'benchmark-harness-history'), 'benchmark-harness-history',
  async (path, name) => await afterStart(path)
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
  baselineCommit: '859c11159ad00ab39a37acb46428164f8a386f77', baselineMainCommit: '60f7cb6e925310fce3e16676ebae93debd2faca7', baselineSourceHash: '73f242643bfee440594c36b15635917118a01221cabea18bd7b85bd58553ef73',
  baselineBinarySha256: baselineBuild.binarySha256, candidateBinarySha256: candidateBuild.binarySha256,
  methodology: "Rust 1.99.1 release before/after. Seven public Document/SVG workloads at 100/1000 mixed-namespace Elements: indexed read/miss, attachment of one prepared subtree with distinct IDs, one hundred alternating ID setters, SVG self/last/explicit-empty queries. Document-name miss and fragment-ID last are unchanged controls. Each sample consumes 100 public queries/setters, except document-id-register which times one public append registering all 100/1000 descendants. Eight reports and 32 isolated workers; 36 raw samples per engine/stage/runtime/row, three warmups and nine measured samples per process. Stages and engine orders alternate. Check native activity before auxiliary reads, then every identity/attribute and full scope XML serialization hash plus the document. inputBytes is the actual 21-byte bootstrap; size counts prepared child Elements, excluding its section/svg root. Setup, validation, cleanup and GC excluded. Shared WSL2 CPU; post-GC memory is not peak. Earlier CLI correctness smokes are excluded from these final comparisons.",
  rawReports: benchmarkReports.map(({ stage, report, path }) => ({ stage, node: report.node, path })), comparisons };
await writeFile(join(repositoryRoot, 'reports/benchmarks/id-lookups/comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
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
assert.equal(native.pass, true); assert.equal(native.runs.reduce((sum, run) => sum + run.tests.length, 0), 299);
for (const name of ['rust-tests.log', 'rust-tests-198.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /test result: ok\. 299 passed; 0 failed/);
for (const name of ['javascript-tests.log', 'full-node22.log']) {
  const log = await readFile(join(logsRoot, name), 'utf8');
  assert.match(log, /(?:ℹ|#) pass 3615/);
  assert.match(log, /Tests:\s+21 passed, 21 total/);
}
let integratedCount;
for (const node of ['v24.14.1', 'v22.12.0']) {
  assert.match(await readFile(join(logsRoot, 'benchmark-contracts-' + node + '.log'), 'utf8'), /(?:ℹ|#) pass 94/);
  const log = await readFile(join(logsRoot, 'observable-hooks-' + node + '.log'), 'utf8');
  const count = Number(log.match(/(?:ℹ|#) pass (\d+)/)?.[1]);
  assert.ok(count >= 954);
  if (integratedCount !== undefined) assert.equal(count, integratedCount);
  integratedCount = count;
  assert.match(await readFile(join(logsRoot, 'baseline-observable-' + node + '.log'), 'utf8'), /(?:ℹ|#) pass 106/);
}
async function memorySummary(directory, expectedCases) {
  const reports = [];
  for (const name of await readdir(join(runtimeRoot, 'reports/memory', directory))) {
    if (!name.endsWith('.json')) continue;
    const report = JSON.parse(await readFile(join(runtimeRoot, 'reports/memory', directory, name)));
    if (Date.parse(report.capturedAt) >= start) reports.push({ name, report });
  }
  return ['v22.12.0', 'v24.14.1'].map((node) => {
    const latest = reports.filter(({ report }) => report.node === node).sort((left, right) => Date.parse(right.report.capturedAt) - Date.parse(left.report.capturedAt))[0];
    assert.ok(latest, directory + ':' + node); assert.equal(latest.report.pass, true); assert.equal(latest.report.cases.length, expectedCases);
    for (const sample of latest.report.cases) {
      const endpoint = sample.endpoint || sample.released;
      assert.equal(endpoint.reached, true);
      for (const count of Object.values(endpoint.state.survivors)) assert.equal(count, 0);
      if (sample.removed) assert.equal(sample.removed.reached, true);
    }
    const destination = 'reports/memory/id-lookups/history/' + directory + '/' + latest.name;
    const preserved = files.find((file) => file.path === destination || file.path === destination + '.gz');
    assert.ok(preserved, destination);
    return { node, scenarios: expectedCases, pass: true, path: preserved.path };
  });
}
const collectionMemory = await memorySummary('collection-queries', 52);
const fragmentMemory = await memorySummary('fragment-id', 78);
const idLookupMemory = await memorySummary('id-lookups', 62);
const validationSources = [];
for (const path of ['tests/id-lookups.spec.cjs', 'tests/helpers/id-lookups-memory.cjs', 'tests/benchmarks/id-lookups.spec.cjs',
  'types/index.d.cts', 'types/native.d.cts', 'tests/fixtures/wpt/manifest.json']) {
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
    executionScope: 'One complete local command per Node version over all 240 existing registered fixtures. The pinned manifest and upstream bytes are unchanged from checkpoint 63.' });
}
const manifest = { capturedAt: new Date().toISOString(), baselinePublishedCommit: '859c11159ad00ab39a37acb46428164f8a386f77',
  baselineMainCommit: '60f7cb6e925310fce3e16676ebae93debd2faca7',
  sourceAtValidation: source.sourceCommit, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256,
  validation: { rustVersions: ['1.98.1', '1.99.1'], rustTestsPerVersion: 299, nodeVersions: ['22.12.0', '24.14.1'],
    fullNodeTestsPerVersion: 3615, benchmarkContractTestsPerVersion: 94, newBenchmarkTestsPerVersion: 14,
    jestTestsPerVersion: 21, vitestTestsPerVersion: 32, vmTestsPerVersion: 32,
    baselineDifferentialTestsPerVersion: 106, focusedNodeTestsPerVersion: 109, focusedIntegrationTestsPerVersion: integratedCount,
    collectionMemory, fragmentMemory, idLookupMemory,
    rustMemcheckTests: 299, rustMemcheckBatches: native.runs.length, releaseGatesPassed: gates.gates.length, wptReports },
  review: JSON.parse(await readFile(join(taskRoot, '.cache/id-lookups-review-snapshot.json'))),
  packageReports, validationSources, fileCount: files.length,
  originalBytes: files.reduce((sum, file) => sum + file.originalBytes, 0), preservedBytes: files.reduce((sum, file) => sum + file.bytes, 0), files };
await writeFile(join(repositoryRoot, outputRoot, 'evidence.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256,
  packageReports, comparisonRows: comparisons.length, deltaRange: [Math.min(...comparisons.map((entry) => entry.deltaPercent)), Math.max(...comparisons.map((entry) => entry.deltaPercent))] }, null, 2));
