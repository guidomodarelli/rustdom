/** @file Exercises real package authentication, derivation, saved observations and execution refusals without sampling. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const original = require('../current-ownership-experiment.cjs');
const originalSettings = require('../constants/current-ownership.cjs');
const { bindSettings } = require('./settings.cjs');
const model = require('./model.cjs');
const preparation = require('./preparation.cjs');
const results = require('./results.cjs');
const study = require('./study.cjs');
const policy = require('./constants/protocol.json');
const transport = require('../cold-cleanup-transport/constants/transport.json');
const repository = path.resolve(__dirname, '../../../..');
const preparedRoot = process.env[policy.environment.preparedRoot];
const history = process.env[policy.environment.historicalEvidence];
assert.ok(preparedRoot && history, 'Cold method contracts: provide both authenticated real evidence directories');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const harness = original.captureHarness();
let root; let derived; let manifestFile;

/** @param {string[]} args - Python arguments. @param {object} [options] - Actual subprocess options. @returns {object} Real process result. */
function python(args, options = {}) {
  return spawnSync('python3', ['-B', ...args], { encoding: 'utf8', ...options });
}
before(() => {
  root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rustdom-cold-method-'));
  derived = path.join(root, 'derived'); manifestFile = path.join(root, 'source-manifest.json');
  assert.equal(harness.identity.sourceGitErrors.length, 0, 'Cold method contracts: use a real Linux Git checkout');
  assert.match(harness.identity.sourceCommit, /^[a-f0-9]{40}$/);
  fs.writeFileSync(manifestFile, JSON.stringify({ commit: harness.identity.sourceCommit, harnessSha256: harness.sha256, files: harness.files }, null, 2) + '\n');
  const result = python([path.join(__dirname, 'derive.py'), repository, manifestFile, derived]);
  assert.equal(result.status, 0, result.stderr);
});
after(() => {
  if (root) {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rustdom-cold-method-'));
    fs.rmSync(root, { recursive: true });
  }
});

test('only the sampler identity and prepared package fingerprints change', () => {
  const originalBefore = structuredClone(originalSettings); const identityBefore = structuredClone(transport.preparationIdentity);
  const selected = bindSettings(originalSettings, transport.preparationIdentity);
  assert.deepEqual({ ...selected, revision: originalSettings.revision, distributionHashes: originalSettings.distributionHashes }, originalSettings);
  assert.notEqual(selected.distributionHashes.B, originalSettings.distributionHashes.B);
  assert.deepEqual(originalSettings, originalBefore); assert.deepEqual(transport.preparationIdentity, identityBefore);
  assert.deepEqual(model.plan(), original.processSchedule());
  assert.equal(model.plan().length, policy.workersPerNode);
  assert.equal(new Set(model.plan().map((entry) => JSON.stringify(entry))).size, policy.workersPerNode);
});

test('the actual qualified hosted packages authenticate without a DOM or a new observation', () => {
  preparation.assertRuntimeContext();
  const manifest = preparation.createManifest(preparedRoot);
  assert.deepEqual(manifest.preparationBefore, transport.preparationIdentity);
  assert.equal(manifest.preparation.runId, transport.runId); assert.equal(manifest.preparation.artifactId, transport.artifactId);
  assert.deepEqual(Object.keys(manifest.copies).sort(), Object.keys(model.settings.distributionHashes).sort());
  for (const [label, distribution] of Object.entries(manifest.distributions)) assert.equal(distribution.sha256, model.settings.distributionHashes[label]);
});

test('the real CLI exposes the complete unchanged plan and authenticates preflight without sampling', () => {
  const planned = spawnSync(process.execPath, [path.join(__dirname, 'study.cjs'), policy.operations.plan],
    { encoding: 'utf8', maxBuffer: policy.metadataOutputLimitBytes });
  assert.equal(planned.status, 0, planned.stderr); assert.deepEqual(JSON.parse(planned.stdout).processes, original.processSchedule());
  const checked = spawnSync(process.execPath, [path.join(__dirname, 'study.cjs'), policy.operations.preflight, preparedRoot],
    { encoding: 'utf8', maxBuffer: policy.metadataOutputLimitBytes });
  assert.equal(checked.status, 0, checked.stderr);
  const declaration = JSON.parse(checked.stdout);
  assert.equal(declaration.samplerInvoked, false); assert.equal(declaration.performanceAccepted, null);
  assert.equal(declaration.harness.sha256, policy.sourceHarnessSha256);
  assert.deepEqual(declaration.manifest.preparationBefore, transport.preparationIdentity);
});

test('startup environment changes are rejected before preparing or sampling', () => {
  const child = spawnSync(process.execPath, ['-e', 'require(process.argv[1]).assertRuntimeContext()', path.join(__dirname, 'preparation.cjs')],
    { env: { ...process.env, NODE_OPTIONS: '--trace-warnings' }, encoding: 'utf8' });
  assert.notEqual(child.status, 0); assert.match(child.stderr, /undeclared NODE_OPTIONS/);
});

test('the real derivation preserves every frozen file except the already-qualified inner sampler', () => {
  const receipt = read(path.join(derived, 'preparation.json'));
  results.verifyDerived(derived, receipt, harness, harness.identity.sourceCommit);
  assert.equal(receipt.measurementExecuted, false); assert.equal(receipt.performanceAccepted, null);
  assert.equal(receipt.samplerAfterSha256, policy.derivation.samplerSha256);
  const changed = harness.files.filter((entry) => hash(path.join(derived, 'harness', entry.path)) !== entry.sha256).map((entry) => entry.path);
  assert.deepEqual(changed, ['benchmarks/worker.cjs']);
});

test('an executable cannot pass after it and its recorded digest are changed coherently', () => {
  const copied = path.join(root, 'tampered'); fs.cpSync(derived, copied, { recursive: true });
  const receipt = read(path.join(copied, 'preparation.json'));
  fs.appendFileSync(path.join(copied, 'worker.cjs'), '\n'); receipt.derivedFiles['worker.cjs'] = hash(path.join(copied, 'worker.cjs'));
  assert.throws(() => results.verifyDerived(copied, receipt, harness, harness.identity.sourceCommit), { code: 'ERR_ASSERTION' });
});

test('existing derivations cannot be overwritten', () => {
  const beforeHash = hash(path.join(derived, 'preparation.json'));
  const child = python([path.join(__dirname, 'derive.py'), repository, manifestFile, derived]);
  assert.notEqual(child.status, 0); assert.match(child.stderr, /preserve existing output/);
  assert.equal(hash(path.join(derived, 'preparation.json')), beforeHash);
});

test('a different declared canonical entry is rejected before creating output', () => {
  const manifest = read(manifestFile); manifest.files[0].sha256 = '0'.repeat(64);
  const filename = path.join(root, 'changed-manifest.json'); fs.writeFileSync(filename, JSON.stringify(manifest));
  const output = path.join(root, 'invalid-derived');
  const child = python([path.join(__dirname, 'derive.py'), repository, filename, output]);
  assert.notEqual(child.status, 0); assert.match(child.stderr, /canonical source manifest differs/);
  assert.equal(fs.existsSync(output), false);
});

test('coherently changing both canonical declarations does not preserve the independently pinned identity', () => {
  const script = [
    'import importlib.util,json,sys',
    'spec=importlib.util.spec_from_file_location("current_cold_derivation",sys.argv[1])',
    'module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)',
    'canonical=json.load(open(sys.argv[2]));canonical["files"][0]["sha256"]="0"*64',
    'module.authenticate_manifest(canonical,json.dumps(canonical,indent=2).encode())',
  ].join('\n');
  const child = python(['-c', script, path.join(__dirname, 'derive.py'), path.join(repository, policy.derivation.canonicalManifest)]);
  assert.notEqual(child.status, 0); assert.match(child.stderr, /independent canonical manifest differs/);
});

test('the current Git commit cannot be replaced with a caller declaration', () => {
  const manifest = read(manifestFile); manifest.commit = '0'.repeat(40);
  const filename = path.join(root, 'wrong-commit.json'); fs.writeFileSync(filename, JSON.stringify(manifest));
  const output = path.join(root, 'wrong-commit-derived');
  const child = python([path.join(__dirname, 'derive.py'), repository, filename, output]);
  assert.notEqual(child.status, 0); assert.match(child.stderr, /actual current Git commit/); assert.equal(fs.existsSync(output), false);
});

test('optimized Python cannot disable authentication or derivation checks', () => {
  const child = python(['-O', path.join(__dirname, 'derive.py'), 'unused', 'unused', 'unused']);
  assert.notEqual(child.status, 0); assert.match(child.stderr, /requires assertions enabled/);
});

test('a hostile caller bytecode cache cannot substitute a transitive legacy producer', () => {
  const hostile = path.join(root, 'hostile-cache');
  const target = path.join(repository, Object.keys(policy.derivation.transitiveSources)[0]);
  const fake = path.join(root, 'controlled-cache-payload.py');
  const seed = [
    'import importlib.util,os,py_compile,sys', 'from pathlib import Path',
    'sys.pycache_prefix=sys.argv[1];target=Path(sys.argv[2]);fake=Path(sys.argv[3]);stat=target.stat()',
    'payload=b"raise RuntimeError(\\\"controlled legacy bytecode cache\\\")\\n"',
    'assert len(payload)<stat.st_size',
    'fake.write_bytes(payload+b"#"+b" "*(stat.st_size-len(payload)-1));os.utime(fake,(stat.st_atime,stat.st_mtime))',
    'cache=Path(importlib.util.cache_from_source(str(target)));cache.parent.mkdir(parents=True,exist_ok=True)',
    'py_compile.compile(str(fake),cfile=str(cache),doraise=True,invalidation_mode=py_compile.PycInvalidationMode.TIMESTAMP)',
  ].join('\n');
  const seeded = python(['-c', seed, hostile, target, fake]); assert.equal(seeded.status, 0, seeded.stderr);
  const load = 'import importlib.util,sys;spec=importlib.util.spec_from_file_location("controlled_old_loader",sys.argv[1]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)';
  const control = python(['-X', `pycache_prefix=${hostile}`, '-c', load, target]);
  assert.notEqual(control.status, 0); assert.match(control.stderr, /controlled legacy bytecode cache/);
  const output = path.join(root, 'cache-resistant-derived');
  const child = python(['-X', `pycache_prefix=${hostile}`, path.join(__dirname, 'derive.py'), repository, manifestFile, output]);
  assert.equal(child.status, 0, child.stderr);
  results.verifyDerived(output, read(path.join(output, 'preparation.json')), harness, harness.identity.sourceCommit);
  assert.equal(fs.existsSync(path.join(output, policy.derivation.cacheDirectory)), false);
});

test('the worker refuses local execution and another attempt before loading packages or creating evidence', () => {
  const env = { ...process.env }; delete env.GITHUB_ACTIONS;
  for (const selected of [env, { ...env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '2' }]) {
    const output = path.join(root, 'not-sampled.json');
    const child = spawnSync(process.execPath, [path.join(__dirname, 'worker.cjs'), 'unused', 'AA', 'jsdom', '0', 'A', output, '0'],
      { env: selected, encoding: 'utf8' });
    assert.equal(child.status, policy.failureExitCode); assert.equal(fs.existsSync(output), false);
    assert.equal(fs.existsSync(output + policy.sidecarSuffix), false);
    assert.match(child.stderr, /requires the declared hosted runner|no retries/);
  }
});

test('the capture driver refuses off-host execution and retries before creating any output', () => {
  const env = { ...process.env }; delete env.GITHUB_ACTIONS;
  for (const selected of [env, { ...env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '2' }]) {
    const output = path.join(root, 'not-captured');
    const child = spawnSync(process.execPath, [path.join(__dirname, 'study.cjs'), policy.operations.capture,
      'unused', output, harness.identity.sourceCommit, 'unused', 'unused'], { env: selected, encoding: 'utf8' });
    assert.equal(child.status, policy.failureExitCode); assert.equal(fs.existsSync(output), false);
    assert.match(child.stderr, /requires the declared hosted runner|no retries/);
  }
});

test('an incomplete current archive cannot return an accepted decision', () => {
  const partial = path.join(root, 'partial'); fs.mkdirSync(partial);
  fs.writeFileSync(path.join(partial, 'index.json'), JSON.stringify({ revision: policy.revision, purpose: policy.purpose, complete: false }));
  assert.throws(() => study.verify(partial), { code: 'ERR_ASSERTION' });
  assert.throws(() => results.decide(model.settings.nodeVersions.map((node) => ({ node, entries: [] }))), { code: 'ERR_ASSERTION' });
});

test('saved real observations retain their samples while span, owner and counter corruptions reject', () => {
  const report = read(path.join(history, 'node22/0000/report.json'));
  const before = structuredClone(report);
  assert.equal(results.validateObservations(report), report); assert.deepEqual(report, before);
  const missingWindow = structuredClone(report); delete missingWindow.batches[0].cleanupTrace.at(-1).survivors.window;
  assert.throws(() => results.validateObservations(missingWindow), { code: 'ERR_ASSERTION' });
  const changedSpan = structuredClone(report); changedSpan.batches[0].sampleTimings.at(-1).durationMs++;
  assert.throws(() => results.validateObservations(changedSpan), { code: 'ERR_ASSERTION' });
  const changedCounter = structuredClone(report); changedCounter.integration.mutationCreated++;
  assert.throws(() => results.validateObservations(changedCounter), { code: 'ERR_ASSERTION' });
  const index = read(path.join(history, 'index.json')); const observed = index.processes[0];
  const metadata = read(path.join(history, 'node22/0000/report.json.integration.json'));
  assert.throws(() => results.validateReport(report, index.manifest, observed.input, observed, metadata, index.derivationSha256), { code: 'ERR_ASSERTION' });
});

test('the unchanged estimator reproduces the complete rejected historical study without relabeling its evidence', () => {
  const index = read(path.join(history, 'index.json'));
  assert.equal(index.complete, true); assert.equal(index.decision.accepted, false);
  const entriesByNode = model.settings.nodeVersions.map((node) => ({ node, entries: [] }));
  for (const [ordinal, entry] of index.processes.entries()) {
    const runtime = Math.floor(ordinal / policy.workersPerNode); const position = ordinal % policy.workersPerNode;
    const folder = runtime === 0 ? 'node22' : 'node24';
    const report = read(path.join(history, folder, String(position).padStart(4, '0'), 'report.json'));
    results.validateObservations(report);
    entriesByNode[runtime].entries.push({ ...entry.input, observation: results.estimatorView(report) });
  }
  assert.equal(index.processes.length, policy.workersPerNode * model.settings.nodeVersions.length);
  for (const [runtime, { entries }] of entriesByNode.entries()) {
    model.validateSeedProbes(entries);
    const summaries = Object.fromEntries(model.settings.phases.map((phase) => [phase, model.summarize(entries.filter((entry) => entry.phase === phase), phase)]));
    assert.deepEqual(summaries, index.decision.results[runtime].summaries);
  }
  assert.throws(() => results.decide(entriesByNode), { code: 'ERR_ASSERTION' });
});
