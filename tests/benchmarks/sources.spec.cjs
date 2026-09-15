/** @file Verifies benchmark source provenance through real Git repositories and durable JSON reports. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');
const { BenchmarkReport } = require('../../benchmarks/report.cjs');
const { captureSourceIdentity } = require('../../benchmarks/sources.cjs');

/** Independent fixture manifest covers source directories and individual measured dependency/validator files. */
const SOURCE_CONTENTS = {
  'src/lib.rs': 'native implementation\n',
  'scripts/build.mjs': 'build configuration\n',
  'benchmarks/compare.cjs': 'benchmark runner\n',
  'third-party/napi/src/lib.rs': 'vendored native bridge\n',
  'package-lock.json': '{"lockfileVersion":3}\n',
  'Cargo.toml': '[package]\nname = "fixture"\n',
  'Cargo.lock': 'version = 4\n',
  'tests/integration/read-dom-file.cjs': 'file byte validator\n',
};

/**
 * Execute the real Git command in an owned temporary repository.
 * @param {string} directory - Fixture working tree.
 * @param {string[]} arguments_ - Git operation and arguments.
 * @returns {string} Trimmed command output.
 */
function git(directory, arguments_) {
  return execFileSync('git', arguments_, { cwd: directory, encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1' } }).trim();
}

/**
 * Create and commit actual source files, optionally leaving one path untracked.
 * @param {import('node:test').TestContext} context - Owns fixture cleanup.
 * @param {string} [untrackedPath] - Source file excluded from the initial commit.
 * @returns {string} Temporary repository root.
 */
function fixture(context, untrackedPath) {
  const directory = mkdtempSync(join(tmpdir(), 'rustdom-benchmark-sources-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [relativePath, content] of Object.entries(SOURCE_CONTENTS)) {
    mkdirSync(dirname(join(directory, relativePath)), { recursive: true });
    writeFileSync(join(directory, relativePath), content);
  }
  git(directory, ['init', '--quiet']);
  git(directory, ['config', 'user.name', 'Benchmark provenance test']);
  git(directory, ['config', 'user.email', 'benchmark-provenance@example.invalid']);
  git(directory, ['config', 'core.autocrlf', 'false']);
  git(directory, ['add', '--', ...Object.keys(SOURCE_CONTENTS).filter((relativePath) => relativePath !== untrackedPath)]);
  git(directory, ['commit', '--quiet', '--no-gpg-sign', '-m', 'Record benchmark source fixture']);
  return directory;
}

/**
 * Persist provenance through the real report writer without treating fixture samples as performance evidence.
 * @param {string} directory - Fixture repository root and owned artifact destination.
 * @param {object} sourceIdentity - Provenance captured from actual Git and source bytes.
 * @returns {object} Report read back from its JSON artifact.
 */
function saveReport(directory, sourceIdentity) {
  const report = { ...sourceIdentity, capturedAt: new Date().toISOString(), complete: false,
    node: process.version, jsdom: '27.4.0', machine: { cpu: 'contract-fixture', release: 'contract-fixture' },
    comparisons: [], runs: ['jsdom', 'rustdom'].map((engine) => ({ engine,
      workloads: [{ name: 'provenance-contract', rows: 1, outputHash: 'equal', samplesMs: [1] }] })) };
  const writer = new BenchmarkReport(report, join(directory, 'reports/benchmarks'));
  return JSON.parse(readFileSync(writer.finish().jsonPath, 'utf8'));
}

test('should preserve the deterministic digest and report no changes when measured sources are committed', (context) => {
  // Arrange: an independent manifest fixes the existing path-NUL-bytes-NUL digest contract.
  const directory = fixture(context);
  const expectedSources = Object.keys(SOURCE_CONTENTS).sort();
  const expectedDigest = createHash('sha256');
  for (const relativePath of expectedSources) {
    expectedDigest.update(relativePath).update('\0').update(SOURCE_CONTENTS[relativePath]).update('\0');
  }
  // Act and assert: report serialization retains every public source-identity field.
  const saved = saveReport(directory, captureSourceIdentity(directory));
  assert.equal(saved.complete, true);
  assert.equal(saved.sourceCommit, git(directory, ['rev-parse', 'HEAD']));
  assert.deepEqual(saved.sourceChanges, []);
  assert.deepEqual(saved.measuredSources, expectedSources);
  assert.equal(saved.sourceHash, expectedDigest.digest('hex'));
  assert.deepEqual(captureSourceIdentity(directory), {
    sourceCommit: saved.sourceCommit, sourceChanges: [], sourceGitErrors: [], sourceHash: saved.sourceHash, measuredSources: expectedSources,
  }, 'generated benchmark reports must remain outside measured sources');
});

for (const relativePath of ['third-party/napi/src/lib.rs', 'tests/integration/read-dom-file.cjs']) {
  for (const tracked of [true, false]) {
    test(`should report ${tracked ? 'tracked' : 'untracked'} changes when ${relativePath} differs`, (context) => {
      // Arrange: both paths already participate in hashing, regardless of their Git tracking state.
      const directory = fixture(context, tracked ? undefined : relativePath);
      const before = captureSourceIdentity(directory);
      writeFileSync(join(directory, relativePath), `${SOURCE_CONTENTS[relativePath]}changed bytes\n`);
      // Act: capture Git and filesystem state, then persist the same metadata used by compare.cjs.
      const saved = saveReport(directory, captureSourceIdentity(directory));
      // Assert: never claim a clean source tree while measured implementation/validator bytes are dirty.
      assert.deepEqual(saved.sourceChanges, [`${tracked ? ' M' : '??'} ${relativePath}`]);
      assert.ok(saved.measuredSources.includes(relativePath));
      assert.notEqual(saved.sourceHash, before.sourceHash);
      assert.equal(saved.sourceCommit, before.sourceCommit);
      assert.deepEqual(saved.measuredSources, before.measuredSources);
    });
  }
}

test('should enumerate newly added source files when an untracked vendored directory appears', (context) => {
  const directory = fixture(context);
  const before = captureSourceIdentity(directory);
  const relativePath = 'third-party/napi/new-module/bridge.rs';
  mkdirSync(dirname(join(directory, relativePath)), { recursive: true });
  writeFileSync(join(directory, relativePath), 'additional native bridge\n');
  const saved = saveReport(directory, captureSourceIdentity(directory));
  assert.deepEqual(saved.sourceChanges, [`?? ${relativePath}`]);
  assert.deepEqual(saved.measuredSources, [...before.measuredSources, relativePath].sort());
  assert.notEqual(saved.sourceHash, before.sourceHash);
});

test('should report ignored source files when their bytes participate in the digest', (context) => {
  const directory = fixture(context);
  const before = captureSourceIdentity(directory);
  const relativePath = 'third-party/napi/build/generated.rs';
  mkdirSync(dirname(join(directory, relativePath)), { recursive: true });
  writeFileSync(join(directory, '.git/info/exclude'), '/third-party/napi/build/\n');
  writeFileSync(join(directory, relativePath), 'ignored but measured bridge\n');
  const saved = saveReport(directory, captureSourceIdentity(directory));
  assert.deepEqual(saved.sourceChanges, [`!! ${relativePath}`]);
  assert.deepEqual(saved.sourceGitErrors, []);
  assert.ok(saved.measuredSources.includes(relativePath));
  assert.notEqual(saved.sourceHash, before.sourceHash);
});

test('should retain the commit and mark changes unavailable when the real Git index is corrupt', (context) => {
  const directory = fixture(context);
  const before = captureSourceIdentity(directory);
  writeFileSync(join(directory, '.git/index'), Buffer.alloc(12));
  const saved = saveReport(directory, captureSourceIdentity(directory));
  assert.equal(saved.sourceCommit, before.sourceCommit);
  assert.equal(saved.sourceChanges, null);
  assert.deepEqual(saved.sourceGitErrors, [{ operation: 'status', exitCode: 128, signal: null, errorCode: null }]);
  assert.equal(saved.sourceHash, before.sourceHash);
  assert.deepEqual(saved.measuredSources, before.measuredSources);
});

test('should preserve measured source bytes and report unavailable Git when the executable is absent', (context) => {
  const directory = fixture(context);
  const before = captureSourceIdentity(directory);
  const captureProgram = 'process.stdout.write(JSON.stringify(require(process.argv[1]).captureSourceIdentity(process.argv[2])))';
  const identity = JSON.parse(execFileSync(process.execPath, ['-e', captureProgram,
    require.resolve('../../benchmarks/sources.cjs'), directory], { cwd: directory, encoding: 'utf8',
    env: { ...process.env, PATH: directory } }));
  const saved = saveReport(directory, identity);
  assert.equal(saved.sourceCommit, null);
  assert.equal(saved.sourceChanges, null);
  assert.deepEqual(saved.sourceGitErrors, ['rev-parse', 'status'].map((operation) => ({
    operation, exitCode: null, signal: null, errorCode: 'ENOENT',
  })));
  assert.equal(saved.sourceHash, before.sourceHash);
  assert.deepEqual(saved.measuredSources, before.measuredSources);
});
