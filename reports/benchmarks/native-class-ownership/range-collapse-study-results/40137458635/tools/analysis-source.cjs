/** @module range-analysis-source Authenticates current resource code and the clean fixed Git/runtime context, without DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const policy = require('./constants/analysis.json');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/** @param {string} repository - Fixed source tree. @returns {void} Authenticate the independent receipt and every current source before module evaluation. */
function authenticateSources(repository) {
  const filename = path.join(repository, policy.sourceReceipt.path);
  assert.ok(fs.lstatSync(filename).isFile()); assert.equal(hash(filename), policy.sourceReceipt.sha256);
  const receipt = JSON.parse(fs.readFileSync(filename, 'utf8'));
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.actionableFindings, 0);
  assert.equal(Object.keys(receipt.files).length, policy.sourcePins);
  for (const [name, expected] of Object.entries(receipt.files)) {
    const source = path.join(repository, name); assert.ok(fs.lstatSync(source).isFile()); assert.equal(hash(source), expected, name);
  }
}

/**
 * Load only reviewed Git sources; the repository argument is the actual source checkout, not an archived method tree.
 * @param {string} repository - Real clean Linux Git checkout of the fixed source commit.
 * @returns {object} Original resource/CSV helpers, current settings and independently pinned verifier.
 */
function loadSources(repository) {
  repository = fs.realpathSync(repository);
  assert.equal(process.platform, 'linux', 'Range analysis requires Linux/WSL and the two pinned Node runtimes');
  assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory(), 'Range analysis requires a real Git directory, not a Windows gitfile');
  const git = (args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  assert.equal(git(['rev-parse', 'HEAD']), policy.sourceCommit, 'Range analysis requires the exact original source commit');
  assert.equal(git(['status', '--short']), '', 'Range analysis requires the actual clean source context');
  authenticateSources(repository);
  const runtimes = require(path.join(repository, policy.runtimePolicyPath)).runtimeExecutableHashes;
  assert.equal(hash(process.execPath), runtimes[process.version], 'Range analysis requires a pinned executable version and digest');
  const resourcePath = path.resolve(__dirname, policy.resourceReader.path);
  const formatPath = path.resolve(__dirname, policy.formatPolicy.path);
  assert.ok(fs.lstatSync(resourcePath).isFile()); assert.ok(fs.lstatSync(formatPath).isFile());
  assert.equal(hash(resourcePath), policy.resourceReader.sha256);
  assert.equal(hash(formatPath), policy.formatPolicy.sha256);
  const legacy = require(resourcePath);
  const format = require(formatPath);
  const settings = require(path.join(repository, policy.modelPath)).settings;
  const resourceSettings = require(path.join(repository, policy.resourceModelPath)).settings;
  for (const name of policy.resourceSettingsFields) assert.deepEqual(settings[name], resourceSettings[name]);
  assert.equal(settings.nodeVersions.length, policy.workerDirectories.length);
  return { settings, format, summarizeWorker: legacy.createAnalyzer(repository).summarizeWorker,
    csvLine: legacy.csvLine, study: require(path.join(repository, policy.studyPath)) };
}
module.exports = { loadSources, authenticateSources, policy };
