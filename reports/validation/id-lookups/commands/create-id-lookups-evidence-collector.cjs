'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const parent = fs.readFileSync('.cache/collect-fragment-id-evidence.mjs', 'utf8');
let prefix = parent.slice(0, parent.indexOf('await preserveDirectory(logsRoot'));
prefix = prefix.replaceAll('fragment-id-current-source', 'id-lookups-current-source').replace("const outputRoot = 'reports/validation/fragment-id';", "const outputRoot = 'reports/validation/id-lookups';");
let benchmarks = parent.slice(parent.indexOf('const benchmarkLog ='), parent.indexOf('const packageReports ='));
benchmarks = benchmarks.replaceAll('reports/benchmarks/fragment-id/', 'reports/benchmarks/id-lookups/');
benchmarks = benchmarks.replace('report.comparisons.length, 10', 'report.comparisons.length, 18');
benchmarks = benchmarks.replace("name.startsWith('2026-10-20') && await afterStart(path)", 'await afterStart(path)');
benchmarks = benchmarks.replace("baselineCommit: '645f2ec514986f51893d8cb7f01b50610da54eec', baselineSourceHash: 'bacff4caae10b43c593997c4f12b48ab3c9a292707d174f8680b25b44ba63998'", "baselineCommit: '859c11159ad00ab39a37acb46428164f8a386f77', baselineMainCommit: '60f7cb6e925310fce3e16676ebae93debd2faca7', baselineSourceHash: '73f242643bfee440594c36b15635917118a01221cabea18bd7b85bd58553ef73'");
const methodology = 'Rust 1.99.1 release before/after. Seven public Document/SVG workloads at 100/1000 mixed-namespace Elements: indexed read/miss, attachment of one prepared subtree with distinct IDs, one hundred alternating ID setters, SVG self/last/explicit-empty queries. Document-name miss and fragment-ID last are unchanged controls. Each sample consumes 100 public queries/setters, except document-id-register which times one public append registering all 100/1000 descendants. Eight reports and 32 isolated workers; 36 raw samples per engine/stage/runtime/row, three warmups and nine measured samples per process. Stages and engine orders alternate. Check native activity before auxiliary reads, then every identity/attribute and full scope XML serialization hash plus the document. inputBytes is the actual 21-byte bootstrap; size counts prepared child Elements, excluding its section/svg root. Setup, validation, cleanup and GC excluded. Shared WSL2 CPU; post-GC memory is not peak. Earlier CLI correctness smokes are excluded from these final comparisons.';
benchmarks = benchmarks.replace(/methodology: 'Rust 1\.99\.1 release before\/after\.[^\n]+',/, 'methodology: ' + JSON.stringify(methodology) + ',');
const packageBlock = parent.slice(parent.indexOf('const packageReports ='), parent.indexOf('const nativePath ='));
const body = `
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
`;
const tail = `
const nativePath = [...(await readFile(join(logsRoot, 'native-memory.log'), 'utf8')).matchAll(/Guardado: (reports\\/memory\\/[^\\r\\n]+\\.json)/g)].at(-1)[1];
const native = JSON.parse(await readFile(join(runtimeRoot, nativePath)));
assert.equal(native.pass, true); assert.equal(native.runs.reduce((sum, run) => sum + run.tests.length, 0), 299);
for (const name of ['rust-tests.log', 'rust-tests-198.log']) assert.match(await readFile(join(logsRoot, name), 'utf8'), /test result: ok\\. 299 passed; 0 failed/);
for (const name of ['javascript-tests.log', 'full-node22.log']) {
  const log = await readFile(join(logsRoot, name), 'utf8');
  assert.match(log, /(?:ℹ|#) pass 3615/);
  assert.match(log, /Tests:\\s+21 passed, 21 total/);
}
let integratedCount;
for (const node of ['v24.14.1', 'v22.12.0']) {
  assert.match(await readFile(join(logsRoot, 'benchmark-contracts-' + node + '.log'), 'utf8'), /(?:ℹ|#) pass 94/);
  const log = await readFile(join(logsRoot, 'observable-hooks-' + node + '.log'), 'utf8');
  const count = Number(log.match(/(?:ℹ|#) pass (\\d+)/)?.[1]);
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
  const reportPath = [...(await readFile(join(logsRoot, name), 'utf8')).matchAll(/Guardado: (reports\\/compatibility\\/[^\\r\\n]+\\.json)/g)].at(-1)[1];
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
await writeFile(join(repositoryRoot, outputRoot, 'evidence.json'), JSON.stringify(manifest, null, 2) + '\\n');
console.log(JSON.stringify({ files: files.length, sourceHash: source.sourceHash, nativeBinarySha256: candidateBuild.binarySha256,
  packageReports, comparisonRows: comparisons.length, deltaRange: [Math.min(...comparisons.map((entry) => entry.deltaPercent)), Math.max(...comparisons.map((entry) => entry.deltaPercent))] }, null, 2));
`;
assert.ok(prefix.includes("const outputRoot = 'reports/validation/id-lookups'"));
assert.ok(benchmarks.includes('report.comparisons.length, 18'));
fs.writeFileSync('.cache/collect-id-lookups-evidence.mjs', prefix + body + benchmarks + packageBlock + tail);
console.log('Prepared Document/SVG ID evidence collector');
