/** @module range-collapse-preparation Applies only the declared candidate in a fresh functional CI checkout. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { captureSourceIdentity } = require('../../../../benchmarks/sources.cjs');
const policy = require('./constants/candidate.json');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Apply the four pinned changes and copy real regressions, preserving the actual Git identity.
 * @param {string} repository - Fresh real checkout with the declared original runtime inputs.
 * @param {string} output - Fresh evidence directory outside that checkout, with an existing parent.
 * @returns {object} Before/after provenance; never a timing or compatibility acceptance decision.
 * @throws {Error} When source bytes, existing output, fixture paths or patch application differ.
 */
function prepare(repository, output) {
  repository = fs.realpathSync.native(repository);
  const git = (argv) => execFileSync('git', ['-C', repository, ...argv], { encoding: 'utf8' });
  assert.equal(fs.realpathSync.native(git(['rev-parse', '--show-toplevel']).trim()), repository);
  output = path.resolve(output);
  output = path.join(fs.realpathSync.native(path.dirname(output)), path.basename(output));
  const relative = path.relative(repository, output);
  assert.ok(relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative),
    'Range collapse preparation: evidence must stay outside the source checkout');
  assert.ok(!fs.existsSync(output), 'Range collapse preparation: preserve existing evidence');
  const before = captureSourceIdentity(repository);
  assert.deepEqual(before.sourceGitErrors, []); assert.deepEqual(before.sourceChanges, []);
  assert.equal(before.sourceHash, policy.sourceHashBefore, 'Range collapse preparation: original runtime inputs differ');
  for (const [name, expected] of Object.entries(policy.files)) assert.equal(hash(path.join(repository, name)), expected.before, name);
  const patch = path.join(__dirname, 'range-collapse.patch'); assert.equal(hash(patch), policy.patchSha256);
  for (const [name, fixture] of Object.entries(policy.functional)) {
    assert.equal(hash(path.join(__dirname, name)), fixture.sha256, name);
    assert.ok(!fs.existsSync(path.join(repository, fixture.target)), 'Range collapse preparation: preserve existing fixture ' + fixture.target);
  }
  git(['apply', '--check', patch]);
  fs.mkdirSync(output);
  const receipt = { revision: policy.revision, complete: false, functionalOnly: true, performanceAccepted: null,
    benchmarkExecuted: false, before, patchSha256: policy.patchSha256, fixtureFiles: policy.functional };
  const save = () => fs.writeFileSync(path.join(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
  save();
  try {
    git(['apply', patch]);
    for (const [name, expected] of Object.entries(policy.files)) assert.equal(hash(path.join(repository, name)), expected.after, name);
    for (const [name, fixture] of Object.entries(policy.functional)) {
      const target = path.join(repository, fixture.target); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(__dirname, name), target, fs.constants.COPYFILE_EXCL);
    }
    receipt.after = captureSourceIdentity(repository);
    assert.equal(receipt.after.sourceHash, policy.sourceHashAfter);
    assert.equal(receipt.after.sourceCommit, before.sourceCommit); assert.deepEqual(receipt.after.sourceGitErrors, []);
    receipt.typeDeclarationSha256 = hash(path.join(repository, 'types/native.d.cts'));
    receipt.gitChanges = git(['status', '--porcelain', '--untracked-files=all']).trimEnd().split('\n').filter(Boolean);
    receipt.complete = true;
    return receipt;
  } catch (error) { receipt.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { save(); }
}
if (require.main === module) {
  assert.equal(process.argv.length, 4, 'Provide source checkout and fresh outside evidence directory');
  try { console.log(JSON.stringify(prepare(process.argv[2], process.argv[3]))); }
  catch (error) { console.error(`Range collapse preparation failed: ${error.stack}`); process.exitCode = 1; }
}
module.exports = { prepare };
