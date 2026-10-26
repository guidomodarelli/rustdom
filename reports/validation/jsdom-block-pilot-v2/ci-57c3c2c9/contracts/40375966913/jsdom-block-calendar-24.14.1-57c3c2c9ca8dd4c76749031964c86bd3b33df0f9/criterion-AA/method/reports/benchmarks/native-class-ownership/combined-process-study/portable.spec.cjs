/** @module combined-portable-contracts Exercises actual saved worker data at a new location without executing archived implementations. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const test = require('node:test');
const manifests = require('./manifest.cjs');
const processes = require('./processes.cjs');
const preparation = require('./preparation.cjs');
const qualification = require('./qualify.cjs');
const fixture = require('./fixtures/functional-worker.json');
const qualified = require('./constants/functional-qualification.json');
const policy = require('./constants/protocol.json');

test('a new physical package location changes only transport paths and retains actual compiler and snapshot Git metadata', () => {
  const directory = process.env.RUSTDOM_COMBINED_PACKAGE_ROOT;
  assert.ok(directory, 'Provide the real authenticated package via RUSTDOM_COMBINED_PACKAGE_ROOT');
  const actual = preparation.createManifest(directory);
  assert.equal(manifests.verify(actual, fs.realpathSync.native(directory)), actual);
  const relocated = manifests.forLocation('/different-machine/qualified-package');
  assert.deepEqual(relocated.sources, fixture.manifest.sources);
  assert.deepEqual(relocated.compilerSources, fixture.manifest.compilerSources);
  assert.deepEqual(relocated.distributions, fixture.manifest.distributions);
  assert.notDeepEqual(relocated.copies, fixture.manifest.copies);
  const changed = structuredClone(relocated);
  changed.sources.B.sourceCommit = '0'.repeat(40); changed.sources.B.sourceGitErrors = [];
  assert.throws(() => manifests.verify(changed, '/different-machine/qualified-package'));
  assert.throws(() => manifests.forLocation('relative/package'));
  assert.throws(() => manifests.forLocation('/different-machine/../package'));
});

test('current readers verify relocated genuine observations and reject altered provenance, resources and file aliases', async (context) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-portable-'));
  const root = path.join(temporary, 'data');
  try {
    const extraction = spawnSync('python3', ['-B', path.join(__dirname, 'materialize-functional.py'), root],
      { encoding: 'utf8', timeout: policy.preparationTimeoutMs });
    assert.ifError(extraction.error); assert.equal(extraction.status, 0, extraction.stderr);
    const indexBytes = fs.readFileSync(path.join(root, 'index.json'));
    assert.equal(createHash('sha256').update(indexBytes).digest('hex'), qualified.indexSha256);
    const index = JSON.parse(indexBytes);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const options = { inputs: qualification.plan(), originalRoot: fixture.evidenceDirectory,
      originalDerived: fixture.derivedDirectory, functionalOnly: true };
    assert.notEqual(root, options.originalRoot);
    const first = path.join(root, 'node22', '0000');
    await context.test('all 64 original processes retain their commands and yields, without requiring original paths', () => {
      const scan = processes.scan(root, index, manifest, options);
      assert.equal(scan.entriesByNode.reduce((sum, group) => sum + group.entries.length, 0), 64);
      assert.equal(scan.measuredDurations, 576); assert.equal(scan.warmupDurations, 192);
      assert.equal(scan.windows, 768); assert.equal(scan.documents, 768);
      assert.equal(scan.captureAuthenticated, false); assert.equal(scan.performanceAccepted, null); assert.equal(scan.gateReevaluated, false);
    });
    await context.test('a changed original executable or worker command is rejected even when data hashes remain valid', () => {
      for (const argument of [0, 4]) {
        const changed = structuredClone(index); changed.processes[0].argv[argument] = '/different-program';
        assert.throws(() => processes.scan(root, changed, manifest, options));
      }
    });
    await context.test('resealing the sidecar cannot replace the actual producer commit', () => {
      const filename = path.join(first, 'report.json' + policy.sidecarSuffix); const original = fs.readFileSync(filename);
      try {
        const metadata = JSON.parse(original); metadata.sourceCommit = '0'.repeat(40);
        fs.writeFileSync(filename, JSON.stringify(metadata));
        const changed = structuredClone(index); changed.processes[0].files[path.basename(filename)] = processes.hash(filename);
        assert.throws(() => processes.scan(root, changed, manifest, options));
      } finally { fs.writeFileSync(filename, original); }
    });
    await context.test('resealing a final Window survivor cannot hide incomplete cleanup', () => {
      const filename = path.join(first, 'report.json'); const original = fs.readFileSync(filename);
      try {
        const report = JSON.parse(original); report.batches[0].cleanupTrace.at(-1).survivors.window = 1;
        fs.writeFileSync(filename, JSON.stringify(report));
        const changed = structuredClone(index); changed.processes[0].files['report.json'] = processes.hash(filename);
        assert.throws(() => processes.scan(root, changed, manifest, options));
      } finally { fs.writeFileSync(filename, original); }
    });
    await context.test('functional reports cannot be promoted into a scientific sequence', () => {
      assert.throws(() => processes.scan(root, index, manifest, { ...options, functionalOnly: false }));
      assert.throws(() => processes.scan(root, { ...index, processes: index.processes.slice(1) }, manifest, options));
    });
    await context.test('identical symbolic and hard-linked report aliases are rejected', () => {
      const filename = path.join(first, 'report.json'); const original = fs.readFileSync(filename);
      const backup = path.join(temporary, 'report-backup.json'); fs.writeFileSync(backup, original);
      try {
        fs.unlinkSync(filename); fs.symlinkSync(backup, filename);
        assert.throws(() => processes.scan(root, index, manifest, options));
        fs.unlinkSync(filename); fs.linkSync(backup, filename);
        assert.throws(() => processes.scan(root, index, manifest, options));
      } finally { fs.unlinkSync(filename); fs.writeFileSync(filename, original); fs.unlinkSync(backup); }
    });
    await context.test('existing evidence is preserved by the data materializer', () => {
      const second = spawnSync('python3', ['-B', path.join(__dirname, 'materialize-functional.py'), root],
        { encoding: 'utf8', timeout: policy.preparationTimeoutMs });
      assert.ifError(second.error); assert.notEqual(second.status, 0);
      assert.deepEqual(fs.readFileSync(path.join(root, 'index.json')), indexBytes);
    });
  } finally { fs.rmSync(temporary, { recursive: true }); }
});
