/** @file Prepares real runner suites around authenticated addons without rebuilding them. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const hosted = require('../hosted-main-experiment.cjs');
const { inspectLinks } = require('../prepare-hosted-build.cjs');
const { fingerprint } = require('../paired-experiment.cjs');
const distributionSettings = require('../constants/hosted-main.cjs');
const settings = require('./constants/suites.json');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (filename, value) => fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);

/** Reject overlapping targets using real parents before creating or installing anything. */
function inspectDestination(output, inputs) {
  const resolved = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  assert.equal(fs.existsSync(resolved), false, 'Runner suites: output already exists');
  for (const input of inputs) {
    const real = fs.realpathSync(input);
    assert.ok(resolved !== real && !resolved.startsWith(`${real}${path.sep}`) && !real.startsWith(`${resolved}${path.sep}`),
      'Runner suites: output and inputs must be disjoint');
  }
  return resolved;
}

/** Capture every method file, including probes and configs, without loading a DOM. */
function methodIdentity() {
  const names = [];
  const walk = (directory, relative = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), name);
      else if (/\.(cjs|mjs|json|md)$/.test(name)) names.push(name);
    }
  };
  walk(__dirname);
  return fingerprint(__dirname, names.sort());
}

/** Require the complete published integration fixture before installation or runner execution. */
function inspectSuiteInputs(root) {
  const actual = fingerprint(root, ['tests/integration']);
  assert.deepEqual(Object.fromEntries(actual.files.map((entry) => [entry.path, entry.sha256])), settings.suiteFiles,
    'Runner suites: incomplete or changed integration suites');
  for (const [name, digest] of Object.entries(settings.configFiles)) assert.equal(hash(fs.readFileSync(path.join(root, name))), digest, `Runner suites: changed config ${name}`);
  return actual;
}

/** Record and preserve a real process and its logs before propagating an error. */
function command(argv, cwd, directory, label, index, save, environment = {}) {
  const entry = { label, argv, cwd, startedAt: new Date().toISOString() };
  index.commands.push(entry); save();
  let stdout; let stderr; let result;
  try {
    stdout = fs.openSync(path.join(directory, `${label}.stdout.log`), 'wx');
    stderr = fs.openSync(path.join(directory, `${label}.stderr.log`), 'wx');
    result = spawnSync(argv[0], argv.slice(1), { cwd, stdio: ['ignore', stdout, stderr],
      env: { ...process.env, PATH: `${path.dirname(argv[0])}${path.delimiter}${process.env.PATH ?? ''}`, ...environment } });
  } finally {
    if (stdout !== undefined) fs.closeSync(stdout);
    if (stderr !== undefined) fs.closeSync(stderr);
  }
  Object.assign(entry, { pid: result.pid, exitCode: result.status, signal: result.signal, finishedAt: new Date().toISOString() });
  if (result.error) entry.spawnError = { message: result.error.message, code: result.error.code };
  save();
  if (result.error || result.status !== 0) throw new Error(`Runner suites: ${label} failed; see ${directory}/${label}.stderr.log`, { cause: result.error });
  return fs.readFileSync(path.join(directory, `${label}.stdout.log`), 'utf8').trim();
}

/** Recompute package, dependency and symlink identities without executing runners. */
function verify(directory) {
  const index = readJson(path.join(directory, 'index.json'));
  assert.equal(index.complete, true); assert.equal(index.measurementExecuted, false);
  assert.deepEqual(index.settings, settings);
  assert.deepEqual(inspectLinks(directory), index.links);
  assert.deepEqual(fingerprint(directory, ['node_modules']), index.dependencies);
  for (const [name, digest] of Object.entries(index.rootInputs)) assert.equal(hash(fs.readFileSync(path.join(directory, name))), digest);
  for (const physical of settings.physicalPackages) {
    const root = path.join(directory, 'packages', physical);
    assert.deepEqual(fingerprint(root, settings.inputParts), index.packages[physical]);
    assert.equal(fingerprint(root, ['dist', 'package.json']).sha256, distributionSettings.distributionHashes[physical]);
  }
  return { revision: index.settings.revision, packages: Object.fromEntries(Object.entries(index.packages).map(([name, value]) => [name, value.sha256])),
    dependenciesSha256: index.dependencies.sha256, preparationId: index.officialIdentity.preparationId };
}

/** Build an isolated suite fixture; npm installs runners but no Rust or product build is invoked. */
function prepare(officialArgument, configurationArgument, outputArgument, node, npmCli) {
  assert.equal(process.platform, 'linux', 'Runner suites: Linux preparation is required');
  for (const name of ['NODE_OPTIONS', 'NODE_PATH']) assert.equal(Object.hasOwn(process.env, name), false, `Runner suites: inherited ${name}`);
  const official = fs.realpathSync(officialArgument); const configurations = fs.realpathSync(configurationArgument);
  const output = inspectDestination(outputArgument, [official, configurations]);
  const officialIdentity = hosted.inspectPreparation(official);
  const baseline = path.join(official, 'baseline-sources'); const candidate = path.join(official, 'sources');
  const commonParts = ['src/environments'];
  assert.deepEqual(fingerprint(baseline, commonParts), fingerprint(candidate, commonParts), 'Runner suites: integration sources differ between A and C');
  assert.equal(hash(fs.readFileSync(path.join(candidate, 'package-lock.json'))), settings.lockfileSha256);
  const suiteInputs = inspectSuiteInputs(configurations);
  fs.mkdirSync(output);
  const index = { complete: false, measurementExecuted: false, accepted: null, settings, officialIdentity,
    method: methodIdentity(), suiteInputs, startedAt: new Date().toISOString(), commands: [],
    host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus(), totalMemory: os.totalmem() } };
  const save = () => writeJson(path.join(output, 'index.json'), index);
  save();
  try {
    assert.equal(command([node, '--version'], output, output, 'node-version', index, save), settings.installerNode);
    assert.equal(command([node, npmCli, '--version'], output, output, 'npm-version', index, save), settings.installerNpm);
    for (const name of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(candidate, name), path.join(output, name));
    for (const name of ['npm-user.config', 'npm-global.config']) fs.writeFileSync(path.join(output, name), '', { flag: 'wx' });
    index.rootInputs = Object.fromEntries(['package.json', 'package-lock.json', 'npm-user.config', 'npm-global.config'].map((name) => [name, hash(fs.readFileSync(path.join(output, name)))]));
    command([node, npmCli, 'ci', '--no-audit', '--no-fund', '--userconfig', path.join(output, 'npm-user.config'), '--globalconfig', path.join(output, 'npm-global.config')], output, output, 'npm-ci', index, save);
    index.runnerVersions = Object.fromEntries(Object.keys(settings.runnerVersions).map((name) => [name, readJson(path.join(output, 'node_modules', name, 'package.json')).version]));
    assert.deepEqual(index.runnerVersions, settings.runnerVersions);
    const original = readJson(path.join(official, 'index.json')).dependencies;
    const dependencyDifferences = original.files.filter((entry) => entry.path !== 'node_modules/.package-lock.json').filter((entry) => {
      const actual = path.join(output, entry.path);
      return !fs.existsSync(actual) || hash(fs.readFileSync(actual)) !== entry.sha256;
    });
    index.productionDependencyDifferences = dependencyDifferences; save();
    assert.deepEqual(dependencyDifferences, [], 'Runner suites: production dependency bytes changed');
    index.packages = {};
    for (const physical of settings.physicalPackages) {
      const destination = path.join(output, 'packages', physical);
      fs.mkdirSync(destination, { recursive: true });
      const sources = physical === 'B' ? candidate : baseline;
      for (const part of ['dist', 'package.json']) fs.cpSync(path.join(official, 'packages', physical, part), path.join(destination, part), { recursive: true });
      for (const part of commonParts) fs.cpSync(path.join(sources, part), path.join(destination, part), { recursive: true });
      fs.cpSync(path.join(configurations, 'tests/integration'), path.join(destination, 'tests/integration'), { recursive: true });
      for (const name of Object.keys(settings.configFiles)) fs.copyFileSync(path.join(configurations, name), path.join(destination, name));
      for (const name of settings.probeFixtures) fs.copyFileSync(path.join(__dirname, 'fixtures', name), path.join(destination, 'tests/integration', name));
      fs.copyFileSync(path.join(__dirname, 'constants/suites.json'), path.join(destination, 'tests/integration/suite-provenance.constants.json'));
      fs.copyFileSync(path.join(__dirname, 'constants/suites.json'), path.join(destination, 'suite-settings.json'));
      fs.copyFileSync(path.join(__dirname, 'fixtures/vitest-suite.config.mjs'), path.join(destination, 'vitest-suite.config.mjs'));
      fs.symlinkSync('../../node_modules', path.join(destination, 'node_modules'), 'dir');
      index.packages[physical] = fingerprint(destination, settings.inputParts);
    }
    index.links = inspectLinks(output);
    index.dependencies = fingerprint(output, ['node_modules']);
    assert.deepEqual(hosted.inspectPreparation(official), officialIdentity);
    assert.deepEqual(inspectSuiteInputs(configurations), suiteInputs);
    assert.deepEqual(methodIdentity(), index.method, 'Runner suites: method changed during preparation');
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    return { directory: output, identity: verify(output) };
  } catch (error) {
    index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error;
  }
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(prepare(...process.argv.slice(2)))}\n`); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }
}
module.exports = { inspectDestination, methodIdentity, inspectSuiteInputs, command, verify, prepare };
