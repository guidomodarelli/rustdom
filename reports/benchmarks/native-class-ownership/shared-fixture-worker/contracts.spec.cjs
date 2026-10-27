/** @file Behavioral/integrity contracts over real saved derived-worker output; no platform mocks or fresh sampling. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { validateReport } = require('./qualify.cjs');
const { verify, inside } = require('./verify.cjs');
const study = require('../current-ownership-experiment.cjs');
const directory = process.env.SHARED_WORKER_EVIDENCE;
assert.ok(directory, 'Set SHARED_WORKER_EVIDENCE to the retained real qualification directory');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const index = read(path.join(directory, 'index.json'));
const entry = index.processes[0];
const primary = read(path.join(directory, 'node22/000/report.json'));
const sidecar = read(path.join(directory, 'node22/000/report.json.integration.json'));
function changed(mutator) {
  const report = structuredClone(primary); const metadata = structuredClone(sidecar);
  mutator(report, metadata);
  assert.throws(() => validateReport(report, index.manifest, entry.input, entry, metadata, index.derivationSha256), { code: 'ERR_ASSERTION' });
}
test('all five physical packages and all eight rows preserve outputs, shared consumers and resource boundaries on both Nodes', () => {
  const result = verify(directory);
  assert.equal(result.totals.processes, 80); assert.equal(result.totals.windows, 960); assert.equal(result.totals.documents, 960);
  assert.equal(result.totals.warmupSpans, 240); assert.equal(result.totals.measuredSpans, 720);
  assert.equal(result.totals.requiredFinalClearStates, 160); assert.equal(result.performanceAccepted, null);
});
test('the historical gate rejects the new raw revision', () => {
  assert.throws(() => study.validateWorker(primary, index.manifest, { ...entry.input, pid: entry.pid, node: entry.node }), { code: 'ERR_ASSERTION' });
});
test('an unobserved PID cannot borrow a completed child report', () => changed((report, metadata) => { report.pid++; metadata.pid++; }));
test('a substituted Node version cannot borrow another profile', () => changed((report, metadata) => { report.node = 'v24.14.1'; metadata.node = report.node; }));
test('skipping the shared factory is rejected even if public output matches', () => changed((report, metadata) => { report.integration.mutationCreated = 0; metadata.adapter.mutationCreated = 0; }));
test('matching runtime reports cannot replace the independent jsdom output', () => changed((report) => { report.batches[0].outputHash = '0'.repeat(64); }));
test('measured samples cannot lose or replace their warmup and measured spans', () => changed((report) => { report.batches[0].sampleTimings.shift(); }));
test('an omitted Window survivor is rejected rather than interpreted as zero', () => changed((report) => { delete report.batches[0].cleanupTrace.at(-1).survivors.window; }));
test('claiming the sampler was not invoked is rejected', () => changed((report, metadata) => { metadata.samplerInvoked = false; }));
test('a wrapper preserves existing primary output before loading a sampler', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-worker-preservation-'));
  const output = path.join(temporary, 'report.json'); fs.writeFileSync(output, 'existing artifact');
  try {
    await assert.rejects(require('./worker.cjs').main(['unused', 'AA', 'jsdom', '0', 'A', output, '0']), { code: 'ERR_ASSERTION' });
    assert.equal(fs.readFileSync(output, 'utf8'), 'existing artifact'); assert.equal(fs.existsSync(`${output}.integration.json`), false);
  } finally { fs.unlinkSync(output); fs.rmdirSync(temporary); }
});
test('an unauthenticated source manifest is rejected before derivation creates output', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-worker-source-'));
  const manifest = read(path.join(directory, 'source-manifest.json')); manifest.files[0].sha256 = '0'.repeat(64);
  const input = path.join(temporary, 'manifest.json'); fs.writeFileSync(input, JSON.stringify(manifest));
  const output = path.join(temporary, 'derived');
  try {
    const result = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), path.resolve(__dirname, '../../../..'), input, output], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /source identity differs/); assert.equal(fs.existsSync(output), false);
  } finally { fs.unlinkSync(input); fs.rmdirSync(temporary); }
});
test('optimized Python cannot bypass derivation checks', () => {
  const result = spawnSync('python3', ['-O', '-B', path.join(__dirname, 'prepare.py'), 'unused', 'unused', 'unused'], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /requires non-optimized Python/);
});
test('archive replay cannot resolve a path outside its owned root', () => {
  assert.throws(() => inside(directory, '../outside.json'), { code: 'ERR_ASSERTION' });
});
test('coherently changing a method snapshot and its index hash cannot replace the published method', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-worker-method-'));
  const altered = structuredClone(index);
  const name = Object.keys(altered.sourceFiles)[0];
  const bytes = Buffer.from('substituted method artifact');
  altered.sourceFiles[name] = createHash('sha256').update(bytes).digest('hex');
  const snapshot = path.join(temporary, 'method', name); fs.mkdirSync(path.dirname(snapshot), { recursive: true });
  fs.writeFileSync(snapshot, bytes); fs.writeFileSync(path.join(temporary, 'index.json'), JSON.stringify(altered));
  try { assert.throws(() => verify(temporary), { code: 'ERR_ASSERTION' }); }
  finally { fs.rmSync(temporary, { recursive: true }); }
});
test('a substituted source manifest cannot borrow a complete process matrix', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-worker-manifest-'));
  fs.copyFileSync(path.join(directory, 'index.json'), path.join(temporary, 'index.json'));
  const manifest = read(path.join(directory, 'source-manifest.json')); manifest.files[0].sha256 = '0'.repeat(64);
  fs.writeFileSync(path.join(temporary, 'source-manifest.json'), JSON.stringify(manifest));
  try { assert.throws(() => verify(temporary), { code: 'ERR_ASSERTION' }); }
  finally { fs.unlinkSync(path.join(temporary, 'index.json')); fs.unlinkSync(path.join(temporary, 'source-manifest.json')); fs.rmdirSync(temporary); }
});
