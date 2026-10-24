/** @file Real Git/filesystem integration for report artifact selection; no platform mocks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { collect } = require('./collect-report-artifacts.cjs');
const settings = require('./constants/report-artifacts.json');

/** @returns {object} Actual isolated Git checkout and its cleanup callback. */
function fixture() {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'rustdom-reports-'));
  const repository = path.join(directory, 'repo'); fs.mkdirSync(repository);
  const git = (args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8' });
  git(['init', '-q']); git(['config', 'core.autocrlf', 'false']); fs.mkdirSync(path.join(repository, 'reports'));
  fs.writeFileSync(path.join(repository, 'reports/history.bin'), Buffer.alloc(1024 * 1024, 7));
  fs.writeFileSync(path.join(repository, '.gitignore'), '*.ignored\n*.node\n');
  git(['add', '--', 'reports/history.bin', '.gitignore']);
  git(['-c', 'user.name=Artifact integration tests', '-c', 'user.email=artifacts@example.invalid', 'commit', '-qm', 'Fixture']);
  return { directory, repository, git,
    cleanup() { assert.equal(path.dirname(directory), parent); assert.equal(fs.realpathSync(directory), directory);
      assert.ok(path.basename(directory).startsWith('rustdom-reports-')); fs.rmSync(directory, { recursive: true }); } };
}

test('unchanged historical bytes are excluded while new and changed reports are retained', async () => {
  const current = fixture();
  try {
    const original = fs.readFileSync(path.join(current.repository, 'reports/history.bin'));
    fs.writeFileSync(path.join(current.repository, 'reports/new report á.json'), '{"value":42}\n');
    const output = path.join(current.directory, 'artifacts');
    const result = await collect(current.repository, output);
    assert.equal(result.complete, true); assert.equal(result.trackedHistoricalReportFiles, 1);
    assert.equal(result.filesCopied, 1); assert.equal(result.bytesCopied, Buffer.byteLength('{"value":42}\n'));
    assert.equal(result.sourceCommit, current.git(['rev-parse', 'HEAD']).trim());
    assert.equal(fs.existsSync(path.join(output, 'history.bin')), false);
    assert.deepEqual(fs.readFileSync(path.join(current.repository, 'reports/history.bin')), original);
    const uploaded = fs.readFileSync(path.join(output, 'new report á.json'));
    assert.equal(result.entries[0].sha256, createHash('sha256').update(uploaded).digest('hex'));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, settings.manifestFile))), result);
  } finally { current.cleanup(); }
});

test('modified tracked files and deletions retain an explicit provenance record', async () => {
  const current = fixture();
  try {
    fs.writeFileSync(path.join(current.repository, 'reports/history.bin'), 'changed\n');
    const changed = await collect(current.repository, path.join(current.directory, 'changed'));
    assert.equal(changed.filesCopied, 1);
    assert.equal(fs.readFileSync(path.join(current.directory, 'changed/history.bin'), 'utf8'), 'changed\n');
    fs.unlinkSync(path.join(current.repository, 'reports/history.bin'));
    const deleted = await collect(current.repository, path.join(current.directory, 'deleted'));
    assert.deepEqual(deleted.entries, [{ path: 'reports/history.bin', kind: 'deleted' }]);
    assert.equal(deleted.filesCopied, 0);
  } finally { current.cleanup(); }
});

test('existing outputs are refused without changing either tree', async () => {
  const current = fixture();
  try {
    const output = path.join(current.directory, 'existing'); fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, 'preserve.txt'), 'user-owned');
    await assert.rejects(collect(current.repository, output), { code: 'ERR_ASSERTION' });
    assert.equal(fs.readFileSync(path.join(output, 'preserve.txt'), 'utf8'), 'user-owned');
  } finally { current.cleanup(); }
});

test('analysis inside the source or through an output-parent alias is rejected', async () => {
  const current = fixture();
  try {
    await assert.rejects(collect(current.repository, path.join(current.repository, 'reports/output')), { code: 'ERR_ASSERTION' });
    const alias = path.join(current.directory, 'alias'); fs.symlinkSync(current.repository, alias, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(collect(current.repository, path.join(alias, 'output')), { code: 'ERR_ASSERTION' });
    assert.equal(fs.existsSync(path.join(current.repository, 'output')), false);
  } finally { current.cleanup(); }
});

test('symlink evidence is recorded without copying an external target', async (context) => {
  const current = fixture();
  try {
    const secret = path.join(current.directory, 'private.txt'); fs.writeFileSync(secret, 'must-not-upload');
    try { fs.symlinkSync(secret, path.join(current.repository, 'reports/link.txt')); }
    catch (error) {
      if (process.platform === 'win32' && error.code === 'EPERM') { context.skip('File symlinks require a Windows privilege'); return; }
      throw error;
    }
    const output = path.join(current.directory, 'artifacts'); const result = await collect(current.repository, output);
    assert.deepEqual(result.entries, [{ path: 'reports/link.txt', kind: 'symlink', target: secret }]);
    assert.equal(fs.existsSync(path.join(output, 'link.txt')), false); assert.equal(result.bytesCopied, 0);
  } finally { current.cleanup(); }
});

test('escaping directory links never expose their external file contents', async () => {
  const current = fixture();
  try {
    const outside = path.join(current.directory, 'private'); fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'private');
    fs.symlinkSync(outside, path.join(current.repository, 'reports/escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const output = path.join(current.directory, 'artifacts');
    if (process.platform === 'win32') {
      await assert.rejects(collect(current.repository, output), { code: 'ERR_ASSERTION' });
      assert.equal(fs.existsSync(output), false);
    } else {
      const result = await collect(current.repository, output);
      assert.equal(result.filesCopied, 0); assert.equal(result.entries[0].kind, 'symlink');
    }
    assert.equal(fs.existsSync(path.join(output, 'escape/secret.txt')), false);
  } finally { current.cleanup(); }
});

test('ignored result files are retained while bytecode caches and files outside reports are excluded', async () => {
  const current = fixture();
  try {
    fs.writeFileSync(path.join(current.repository, 'reports/result.ignored'), 'result');
    fs.writeFileSync(path.join(current.repository, 'reports/native.node'), Buffer.from([1, 2, 3]));
    fs.mkdirSync(path.join(current.repository, 'reports/__pycache__'));
    fs.writeFileSync(path.join(current.repository, 'reports/__pycache__/cache.pyc'), 'cache');
    fs.writeFileSync(path.join(current.repository, 'outside.txt'), 'outside');
    const output = path.join(current.directory, 'artifacts'); const result = await collect(current.repository, output);
    assert.equal(result.filesCopied, 2); assert.equal(result.excludedCacheFiles, 1);
    assert.equal(fs.readFileSync(path.join(output, 'result.ignored'), 'utf8'), 'result');
    assert.deepEqual(fs.readFileSync(path.join(output, 'native.node')), Buffer.from([1, 2, 3]));
    assert.equal(fs.existsSync(path.join(output, '__pycache__')), false);
  } finally { current.cleanup(); }
});

test('the real CLI creates the same delta contract in an actual checkout', () => {
  const current = fixture();
  try {
    fs.writeFileSync(path.join(current.repository, 'reports/current.log'), 'real output\n');
    const output = path.join(current.directory, 'cli-output');
    const stdout = execFileSync(process.execPath, [path.join(__dirname, 'collect-report-artifacts.cjs'), output],
      { cwd: current.repository, encoding: 'utf8' });
    const result = JSON.parse(stdout); assert.equal(result.filesCopied, 1); assert.equal(result.complete, true);
    assert.equal(fs.readFileSync(path.join(output, 'current.log'), 'utf8'), 'real output\n');
  } finally { current.cleanup(); }
});

test('benchmark scope keeps the previous artifact-relative paths and excludes other report domains', async () => {
  const current = fixture();
  try {
    fs.mkdirSync(path.join(current.repository, 'reports/benchmarks'));
    fs.mkdirSync(path.join(current.repository, 'reports/memory'));
    fs.writeFileSync(path.join(current.repository, 'reports/benchmarks/new.json'), 'benchmark\n');
    fs.writeFileSync(path.join(current.repository, 'reports/memory/new.json'), 'memory\n');
    const output = path.join(current.directory, 'artifacts');
    const result = await collect(current.repository, output, 'reports/benchmarks');
    assert.equal(result.reportRoot, 'reports/benchmarks'); assert.equal(result.filesCopied, 1);
    assert.equal(result.entries[0].artifactPath, 'new.json');
    assert.equal(fs.readFileSync(path.join(output, 'new.json'), 'utf8'), 'benchmark\n');
    assert.equal(fs.existsSync(path.join(output, 'memory')), false);
  } finally { current.cleanup(); }
});

test('a caller cannot widen the report scope outside its owned subtree', async () => {
  const current = fixture();
  try {
    for (const [ordinal, scope] of ['src', '../reports', 'reports/../src', 'reports//memory'].entries()) {
      const output = path.join(current.directory, 'invalid-' + ordinal);
      await assert.rejects(collect(current.repository, output, scope), { code: 'ERR_ASSERTION' });
      assert.equal(fs.existsSync(output), false);
    }
  } finally { current.cleanup(); }
});

test('a reserved manifest name cannot overwrite a generated report', async () => {
  const current = fixture();
  try {
    const report = path.join(current.repository, 'reports', settings.manifestFile);
    fs.writeFileSync(report, 'current-report'); const output = path.join(current.directory, 'artifacts');
    await assert.rejects(collect(current.repository, output), { code: 'ERR_ASSERTION' });
    assert.equal(fs.existsSync(output), false); assert.equal(fs.readFileSync(report, 'utf8'), 'current-report');
  } finally { current.cleanup(); }
});

test('staged report changes are retained relative to the source commit without changing the index', async () => {
  const current = fixture();
  try {
    fs.writeFileSync(path.join(current.repository, 'reports/staged.json'), 'new staged result\n');
    fs.writeFileSync(path.join(current.repository, 'reports/history.bin'), 'modified and staged\n');
    current.git(['add', '--', 'reports/staged.json', 'reports/history.bin']);
    const stagedBefore = current.git(['diff', '--cached', '--name-only']);
    const output = path.join(current.directory, 'artifacts'); const result = await collect(current.repository, output);
    assert.equal(result.filesCopied, 2); assert.equal(result.trackedHistoricalReportFiles, 1);
    assert.equal(fs.readFileSync(path.join(output, 'staged.json'), 'utf8'), 'new staged result\n');
    assert.equal(fs.readFileSync(path.join(output, 'history.bin'), 'utf8'), 'modified and staged\n');
    assert.equal(current.git(['diff', '--cached', '--name-only']), stagedBefore);
  } finally { current.cleanup(); }
});
