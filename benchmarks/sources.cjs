/** @module benchmarks/sources Captures matching source digests and Git provenance for benchmark reports. */
'use strict';
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

/** Include every measured implementation, harness, validator and locked dependency in both identities. */
const SOURCE_ROOTS = ['src', 'scripts', 'benchmarks', 'third-party/napi',
  'package-lock.json', 'Cargo.toml', 'Cargo.lock', 'tests/integration/read-dom-file.cjs'];

/**
 * Enumerate a source root using portable repository-relative names for the digest.
 * @param {string} repositoryRoot - Working tree whose sources are measured.
 * @param {string} relativePath - Source directory or file relative to that working tree.
 * @returns {string[]} Files included in the reproducibility digest, including untracked files.
 */
function sourceFiles(repositoryRoot, relativePath) {
  if (!statSync(join(repositoryRoot, relativePath)).isDirectory()) return [relativePath];
  return readdirSync(join(repositoryRoot, relativePath), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = `${relativePath}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(repositoryRoot, entryPath) : [entryPath];
  });
}

/**
 * Read Git provenance and keep unavailable metadata distinct from a clean working tree.
 * @param {string} repositoryRoot - Working tree used for the Git operation.
 * @param {string[]} arguments_ - Git operation and its static source-scope arguments.
 * @param {object[]} diagnostics - Receives safe process outcomes, without raw stderr or environment data.
 * @returns {string|null} Successful stdout, or null when Git cannot provide this identity.
 */
function readGit(repositoryRoot, arguments_, diagnostics) {
  const result = spawnSync('git', arguments_, { cwd: repositoryRoot, encoding: 'utf8' });
  if (result.error || result.status !== 0 || result.signal) {
    diagnostics.push({ operation: arguments_[0], exitCode: result.status,
      signal: result.signal, errorCode: result.error?.code ?? null });
    return null;
  }
  return result.stdout;
}

/**
 * Capture the measured working tree with one canonical scope for hashing and Git changes.
 * @param {string} [repositoryRoot] - Repository root; defaults to the benchmark runner's working directory.
 * @returns {object} Commit, porcelain changes (including ignored sources), digest, measured names and Git failure diagnostics.
 */
function captureSourceIdentity(repositoryRoot = process.cwd()) {
  const measuredSources = SOURCE_ROOTS.flatMap((sourceRoot) => sourceFiles(repositoryRoot, sourceRoot)).sort();
  const sourceDigest = createHash('sha256');
  for (const relativePath of measuredSources) {
    sourceDigest.update(relativePath).update('\0').update(readFileSync(join(repositoryRoot, relativePath))).update('\0');
  }
  const sourceGitErrors = [];
  const commitOutput = readGit(repositoryRoot, ['rev-parse', 'HEAD'], sourceGitErrors);
  const statusOutput = readGit(repositoryRoot,
    ['status', '--porcelain', '--untracked-files=all', '--ignored', '--', ...SOURCE_ROOTS], sourceGitErrors);
  return {
    sourceCommit: commitOutput?.trim() || null,
    sourceChanges: statusOutput?.trimEnd().split('\n').filter(Boolean) ?? null,
    sourceGitErrors,
    sourceHash: sourceDigest.digest('hex'), measuredSources,
  };
}

module.exports = { captureSourceIdentity };
