/** @file Exercises the preparation CLI with real Git checkouts and filesystem ownership boundaries. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const policy = require('./constants/candidate.json');
const repository = path.resolve(process.env[policy.testSourceEnvironment] ?? path.resolve(__dirname, '../../../..'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

test('preparation preserves rejected inputs and applies only the declared real candidate', async (context) => {
  const parent = fs.realpathSync.native(os.tmpdir());
  const temporary = fs.mkdtempSync(path.join(parent, policy.testTemporaryPrefix));
  const source = path.join(temporary, 'source');
  const git = (args, cwd = source) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const invoke = (output) => spawnSync(process.execPath, [path.join(__dirname, 'prepare.cjs'), source, output], { encoding: 'utf8' });
  try {
    git(['clone', '--shared', '--no-checkout', repository, source], temporary);
    git(['config', 'core.autocrlf', 'false']);
    git(['sparse-checkout', 'set', '--no-cone', '/*', '!/*/', '/src/', '/scripts/', '/benchmarks/', '/tests/', '/third-party/', '/types/']);
    const head = git(['rev-parse', 'HEAD'], repository).trim();
    git(['checkout', '--detach', head]);
    await context.test('existing evidence is preserved before any input mutation', () => {
      const output = path.join(temporary, 'existing'); fs.mkdirSync(output);
      const sentinel = path.join(output, 'preparation.json'); fs.writeFileSync(sentinel, 'foreign evidence');
      assert.equal(invoke(output).status, 1); assert.equal(fs.readFileSync(sentinel, 'utf8'), 'foreign evidence');
      assert.equal(git(['status', '--porcelain']).trim(), '');
    });
    await context.test('evidence inside the source is rejected before creating a directory', () => {
      const output = path.join(source, 'src/evidence');
      assert.equal(invoke(output).status, 1); assert.equal(fs.existsSync(output), false);
    });
    await context.test('a modified tracked input cannot borrow the original runtime identity', () => {
      const filename = path.join(source, 'src/dom/range_state.rs'); const original = fs.readFileSync(filename);
      const output = path.join(temporary, 'wrong-source');
      try {
        fs.appendFileSync(filename, '\n'); assert.equal(invoke(output).status, 1);
        assert.equal(fs.existsSync(output), false);
      } finally { fs.writeFileSync(filename, original); }
    });
    await context.test('existing functional fixtures are preserved without applying the patch', () => {
      const filename = path.join(source, 'tests/helpers/range-collapse-memory.cjs');
      fs.writeFileSync(filename, 'foreign fixture');
      const output = path.join(temporary, 'wrong-fixture');
      try {
        assert.equal(invoke(output).status, 1); assert.equal(fs.existsSync(output), false);
        assert.equal(fs.readFileSync(filename, 'utf8'), 'foreign fixture');
        for (const [name, expected] of Object.entries(policy.files)) assert.equal(hash(path.join(source, name)), expected.before);
      } finally { fs.unlinkSync(filename); }
    });
    await context.test('clean real sources produce complete provenance and every pinned fixture', () => {
      const output = path.join(temporary, 'prepared'); const result = invoke(output);
      assert.equal(result.status, 0, result.stderr);
      const receipt = JSON.parse(fs.readFileSync(path.join(output, 'preparation.json'), 'utf8'));
      assert.equal(receipt.complete, true); assert.equal(receipt.functionalOnly, true);
      assert.equal(receipt.performanceAccepted, null); assert.equal(receipt.benchmarkExecuted, false);
      assert.equal(receipt.before.sourceCommit, head); assert.equal(receipt.after.sourceCommit, head);
      assert.deepEqual(receipt.before.sourceChanges, []); assert.deepEqual(receipt.before.sourceGitErrors, []);
      assert.deepEqual(receipt.after.sourceGitErrors, []);
      assert.equal(receipt.before.sourceHash, policy.sourceHashBefore); assert.equal(receipt.after.sourceHash, policy.sourceHashAfter);
      for (const [name, expected] of Object.entries(policy.files)) assert.equal(hash(path.join(source, name)), expected.after);
      for (const fixture of Object.values(policy.functional)) assert.equal(hash(path.join(source, fixture.target)), fixture.sha256);
    });
    await context.test('an already applied candidate cannot be applied again or replace its evidence', () => {
      const output = path.join(temporary, 'reapply'); assert.equal(invoke(output).status, 1);
      assert.equal(fs.existsSync(output), false);
      for (const [name, expected] of Object.entries(policy.files)) assert.equal(hash(path.join(source, name)), expected.after);
    });
  } finally {
    assert.equal(path.dirname(temporary), parent); assert.equal(fs.realpathSync.native(temporary), temporary);
    assert.ok(path.basename(temporary).startsWith(policy.testTemporaryPrefix));
    fs.rmSync(temporary, { recursive: true });
  }
});
