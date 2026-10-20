'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = process.argv[2];
const primary = process.argv[3];
const source = require(root + '/benchmarks/sources.cjs').captureSourceIdentity(root);
assert.equal(source.sourceHash, '73f242643bfee440594c36b15635917118a01221cabea18bd7b85bd58553ef73');
const baseline = JSON.parse(fs.readFileSync(root + '/baseline-engine/dist/native-build.json'));
assert.equal(baseline.binarySha256, 'ca4c8081fe104e56131ed8e4beddc39dcbef1074e26b31ec70968f2f3aadcc30');
const validationSources = ['tests/fragment-id.spec.cjs', 'tests/helpers/fragment-id-memory.cjs',
  'tests/benchmarks/fragment-id.spec.cjs', 'types/native.d.cts', 'tests/fixtures/wpt/manifest.json'].map((path) =>
  ({ path, sha256: createHash('sha256').update(fs.readFileSync(root + '/' + path)).digest('hex') }));
for (const version of ['v24.14.1', 'v22.12.0']) {
  for (const [name, count] of [['baseline', 84], ['gc-contracts', 87], ['benchmark-contracts', 80]]) {
    assert.match(fs.readFileSync(`${root}/reports/validation/fragment-id/${name}-${version}.log`, 'utf8'), new RegExp('(?:ℹ|#) pass ' + count));
  }
  const log = fs.readFileSync(`${root}/reports/validation/fragment-id/worker-${version}.log`, 'utf8');
  const path = [...log.matchAll(/Guardado: (reports\/benchmarks\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(fs.readFileSync(root + '/' + path));
  assert.equal(report.complete, true); assert.equal(report.runs.length, 4); assert.equal(report.comparisons.length, 8);
  assert.equal(report.sourceHash, source.sourceHash);
  for (const run of report.runs) for (const workload of run.workloads) assert.equal(workload.inputBytes, 21);
}
const nativeBuild = JSON.parse(fs.readFileSync(root + '/dist/native-build.json'));
const review = { capturedAt: new Date().toISOString(), provider: 'Codex native isolated read-only reviewer', baseline: '645f2ec514986f51893d8cb7f01b50610da54eec',
  sourceHash: source.sourceHash, findings: 0,
  scope: 'Static comparison of fourteen product, binding, benchmark and test paths in the WSL runtime against the clean published baseline. No edits, independent runtime probes or other provider. Four later unmodified upstream fixtures and their manifest will receive a final follow-up review with completed evidence.' };
fs.writeFileSync(root + '/reports/validation/fragment-id/validation-sources.json', JSON.stringify({ source, validationSources, nativeBuild }, null, 2) + '\n');
fs.writeFileSync(root + '/reports/validation/fragment-id/local-review.json', JSON.stringify(review, null, 2) + '\n');
fs.writeFileSync(primary + '/.cache/fragment-id-runtime-source.json', JSON.stringify(source, null, 2) + '\n');
console.log(JSON.stringify({ sourceHash: source.sourceHash, measuredSources: source.measuredSources.length, nativeBinarySha256: nativeBuild.binarySha256,
  validationSources, cliSmokes: 'Both Node versions: four workers, eight rows, inputBytes21; diagnostic timings excluded from final performance measurements.' }));
