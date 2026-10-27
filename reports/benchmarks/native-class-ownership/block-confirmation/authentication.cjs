/** @module confirmation-historical-authentication Authenticates a sealed package using its real immutable Git source, separately from the current producer. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { hashFile } = require('../combined-process-study/io.cjs');
const policy = require('./constants/authentication.json');
const worker = require('./constants/worker.json');
const design = require('./constants/design.json');
const currentRepository = path.resolve(__dirname, '../../../..');

/** @param {string} filename - Physical regular file. @param {number} maximumBytes - Explicit bound. @returns {Buffer} Exact source/data bytes, without following a final symlink. */
function readPhysical(filename, maximumBytes) {
  const stat = fs.lstatSync(filename);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maximumBytes,
    'Historical package authentication: physical bounded file required: ' + filename);
  const raw = fs.readFileSync(filename);
  assert.ok(raw.length <= maximumBytes);
  return raw;
}

/** @param {Buffer} raw - Exact bytes. @returns {string} SHA-256 identity. */
function digest(raw) { return createHash('sha256').update(raw).digest('hex'); }

/** @param {string} repository - Actual physical Git source. @param {string[]} args - Read-only Git operation. @returns {string} Original UTF-8 output without status/source normalization. */
function git(repository, args) {
  const result = spawnSync('git', ['--no-optional-locks', '-c', 'core.longpaths=true', ...args], { cwd: repository,
    encoding: 'utf8', timeout: policy.commandTimeoutMs, maxBuffer: policy.maximumCommandBytes });
  assert.ifError(result.error);
  assert.equal(result.status, 0, 'Historical package authentication: git ' + args[0] + ' failed: ' + result.stderr);
  assert.equal(result.stderr, '', 'Historical package authentication: preserve Git diagnostics instead of claiming an error-free identity');
  return result.stdout;
}

/** @param {string} repository - Physical root. @param {string} relative - Published relative data path. @returns {string} Exact contained regular-file location. */
function ownedFile(repository, relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(relative.length > 0 && !path.posix.isAbsolute(relative) && !/[\\:\r\n\0]/.test(relative));
  assert.ok(relative.split('/').every((part) => part !== '' && part !== '.' && part !== '..' && part !== '.git'));
  const filename = path.join(repository, ...relative.split('/'));
  const physical = fs.realpathSync(filename);
  assert.ok(physical.startsWith(repository + path.sep), 'Historical package authentication: source path escapes its root');
  return filename;
}

/**
 * Verify the original source's real HEAD, clean status and every published byte before invoking its approved readers.
 * This source context describes the historical package only; it never replaces the current producer's Git identity.
 * @param {string} source - Separate original native Git checkout, never an artifact snapshot or Windows gitfile.
 * @returns {object} Observed historical identity, source hashes and exact current/frozen reader equality.
 */
function inspectSource(source) {
  assert.equal(process.platform, 'linux', 'Historical package authentication: use the actual native Linux Git checkout');
  assert.equal(typeof source, 'string'); assert.ok(source.length > 0);
  const repository = fs.realpathSync(source);
  assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory(),
    'Historical package authentication: a real Git directory is required; archive data and gitfiles are not source checkouts');
  assert.equal(fs.realpathSync(git(repository, ['rev-parse', '--show-toplevel']).trim()), repository);
  const sourceCommit = git(repository, ['rev-parse', 'HEAD']).trim();
  const sourceChangesRaw = git(repository, ['status', '--porcelain=v1', '--untracked-files=normal']);
  assert.equal(sourceCommit, policy.sourceCommit, 'Historical package authentication: original source commit changed');
  assert.equal(sourceChangesRaw, '', 'Historical package authentication: preserve foreign changes in the original source');
  const receiptRaw = readPhysical(ownedFile(repository, policy.receipt.path), policy.maximumReceiptBytes);
  assert.equal(digest(receiptRaw), policy.receipt.sha256, 'Historical package authentication: published receipt changed');
  const receipt = JSON.parse(receiptRaw.toString('utf8'));
  assert.ok(receipt.files && typeof receipt.files === 'object' && !Array.isArray(receipt.files));
  assert.equal(Object.keys(receipt.files).length, policy.frozenFileCount);
  for (const [relative, expected] of Object.entries(receipt.files)) {
    assert.equal(typeof expected, 'string'); assert.match(expected, /^[a-f0-9]{64}$/);
    assert.equal(hashFile(ownedFile(repository, relative), policy.maximumFrozenFileBytes, false), expected,
      'Historical package authentication: frozen input changed: ' + relative);
  }
  for (const binding of Object.values(policy.readerBindings)) {
    assert.equal(hashFile(ownedFile(repository, binding.path), policy.maximumFrozenFileBytes, false), binding.sha256);
    assert.equal(hashFile(ownedFile(currentRepository, binding.path), policy.maximumFrozenFileBytes, false), binding.sha256,
      'Historical package authentication: current reviewed reader differs from the approved historical reader');
  }
  return { revision: policy.revision, role: policy.sourceRole, sourceDirectory: repository, sourceCommit,
    sourceChangesRaw, sourceGitErrors: [], receiptSha256: policy.receipt.sha256,
    files: { ...receipt.files }, reviewedReaderBindings: structuredClone(policy.readerBindings),
    currentProducerIdentityReplaced: false, DOMExecuted: false, performanceAccepted: null, gateReevaluated: false };
}

/**
 * Run the unchanged approved package verifier from the independently inspected Git source, saving both streams.
 * It reads transported compiler inputs as data; it never loads a DOM or executes scripts from an artifact.
 * @param {string} prepared - Existing sealed package root.
 * @param {string} destination - Existing caller-owned evidence directory outside source and package.
 * @param {string} label - Fixed simple evidence basename.
 * @param {string} [source] - Explicit historical checkout; defaults to the documented environment variable.
 * @returns {object} Original package result plus a separately named historical source context.
 */
function authenticatePackage(prepared, destination, label, source = process.env[policy.authenticationSourceEnvironment]) {
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  assert.equal(typeof label, 'string'); assert.match(label, /^[a-z][a-z0-9-]*$/);
  assert.equal(hashFile(fs.realpathSync(process.execPath), policy.maximumExecutableBytes, false),
    design.nodeExecutableSha256[process.version], 'Historical package authentication: use a pinned Node SDK');
  const historicalSource = inspectSource(source);
  prepared = fs.realpathSync(prepared); destination = fs.realpathSync(destination);
  for (const protectedRoot of [currentRepository, historicalSource.sourceDirectory, prepared]) {
    assert.ok(destination !== protectedRoot && !destination.startsWith(protectedRoot + path.sep),
      'Historical package authentication: evidence must stay outside source and package');
  }
  const stdoutPath = path.join(destination, label + '.stdout.log');
  const stderrPath = path.join(destination, label + '.stderr.log');
  assert.equal(fs.existsSync(stdoutPath), false); assert.equal(fs.existsSync(stderrPath), false);
  const verification = spawnSync('python3', ['-B', ownedFile(historicalSource.sourceDirectory, policy.readerBindings.script.path),
    '--verify', prepared, process.execPath], { encoding: 'utf8', timeout: policy.commandTimeoutMs,
    maxBuffer: policy.maximumCommandBytes });
  fs.writeFileSync(stdoutPath, verification.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(stderrPath, verification.stderr ?? '', { flag: 'wx' });
  assert.ifError(verification.error); assert.equal(verification.status, 0, verification.stderr);
  const result = JSON.parse(verification.stdout);
  assert.equal(result.verified, true); assert.equal(result.artifactId, worker.selectedArtifactId);
  assert.equal(result.nativeBinarySha256, design.selectedNativeBinarySha256);
  assert.deepEqual(inspectSource(source), historicalSource, 'Historical package authentication: original source changed during verification');
  return { ...result, historicalSource };
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 4, 'Historical package authentication: provide --inspect original-source');
    assert.equal(process.argv[2], '--inspect');
    process.stdout.write(JSON.stringify(inspectSource(process.argv[3]), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ operation: 'Historical package authentication', name: error.name, message: error.message }) + '\n');
    process.exitCode = worker.failureExitCode;
  }
}

module.exports = { inspectSource, authenticatePackage };
