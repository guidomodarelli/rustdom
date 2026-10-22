/** @file Builds complete immutable A/C packages before declaring another hosted timing experiment. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const { verifyCurrentInputs } = require('./ownership-evidence.cjs');
const study = require('./paired-inline-experiment.cjs');
const { fingerprint } = require('./paired-experiment.cjs');
const settings = require('./constants/hosted-build.cjs');
const repositoryRoot = path.resolve(__dirname, '../../..');

/** @param {Buffer} bytes - Actual file contents. @returns {string} Portable digest. */
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

/**
 * Reject inherited overrides before creating outputs, installing dependencies or invoking compilers.
 * @param {Record<string, string>} roots - Actual source directories used by both builds.
 * @returns {object} Inspected versions, executable identity and declared environment inputs.
 */
function inspectTools(roots = {}) {
  for (const name of settings.forbiddenEnvironment) assert.ok(!process.env[name], `Hosted build: undeclared ${name}`);
  for (const name of Object.keys(process.env)) {
    if (settings.forbiddenEnvironmentPrefixes.some((prefix) => name.startsWith(prefix)) && name !== settings.allowedTargetEnvironment) {
      assert.ok(!process.env[name], `Hosted build: undeclared ${name}`);
    }
  }
  assert.ok(!process.env.CARGO_INCREMENTAL || process.env.CARGO_INCREMENTAL === '0', 'Hosted build: incremental override is not disabled');
  const cargoConfiguration = inspectCargoConfiguration(roots);
  assert.equal(process.version, settings.node, 'Hosted build: undeclared build Node');
  assert.equal(process.platform, settings.platform); assert.equal(process.arch, settings.arch);
  assert.equal(process.env.RUSTUP_TOOLCHAIN, settings.rustRelease, 'Hosted build: pin RUSTUP_TOOLCHAIN for both source roots');
  assert.equal(process.report.getReport().header.glibcVersionRuntime, settings.glibc);
  const tools = {};
  for (const [name, arguments_] of Object.entries({ npm: ['--version'], rustc: ['-Vv'], cargo: ['-V'], cc: ['--version'], ld: ['--version'] })) {
    const result = spawnSync(name, arguments_, { encoding: 'utf8', timeout: settings.commandTimeoutMs });
    if (result.error) throw new Error(`Hosted build: could not inspect ${name}`, { cause: result.error });
    assert.equal(result.status, 0, `Hosted build: ${name} version failed: ${result.stderr}`);
    tools[name] = { arguments: arguments_, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  }
  assert.equal(tools.npm.stdout, settings.npm, 'Hosted build: undeclared npm');
  assert.ok(tools.rustc.stdout.split('\n').includes(`release: ${settings.rustRelease}`), 'Hosted build: undeclared Rust');
  assert.ok(tools.cargo.stdout.startsWith(`cargo ${settings.cargoRelease} `), 'Hosted build: undeclared Cargo');
  return { node: process.version, v8: process.versions.v8, executable: process.execPath,
    executableSha256: hash(fs.readFileSync(process.execPath)), tools,
    cargoConfiguration, cargoIncremental: process.env.CARGO_INCREMENTAL ?? null,
    cargoTargetDirectory: process.env.CARGO_TARGET_DIR ?? null, rustupToolchain: process.env.RUSTUP_TOOLCHAIN ?? null };
}

/**
 * Reject undeclared Cargo configuration without reading credentials into reports.
 * @param {Record<string, string>} roots - Source directories whose ancestors Cargo searches.
 * @returns {object[]} Paths checked for configuration and their required absent state.
 */
function inspectCargoConfiguration(roots) {
  const locations = new Set();
  assert.ok(path.isAbsolute(os.homedir()), 'Hosted build: home directory must be absolute');
  for (const name of settings.absoluteDirectoryEnvironment) {
    if (process.env[name]) assert.ok(path.isAbsolute(process.env[name]), `Hosted build: use absolute ${name}`);
  }
  const cargoHome = path.resolve(process.env.CARGO_HOME || path.join(os.homedir(), '.cargo'));
  for (const name of ['config', 'config.toml']) locations.add(path.join(cargoHome, name));
  for (const root of Object.values(roots)) {
    let directory = path.resolve(root);
    for (;;) {
      for (const name of ['config', 'config.toml']) locations.add(path.join(directory, '.cargo', name));
      const parent = path.dirname(directory); if (parent === directory) break; directory = parent;
    }
  }
  const files = [...locations].sort().map((filename) => ({ path: filename, exists: fs.existsSync(filename) }));
  for (const file of files) assert.equal(file.exists, false, `Hosted build: undeclared Cargo configuration: ${file.path}`);
  return files;
}

/**
 * Preserve exact build processes and logs, including failed attempts.
 * @param {string} root - Source directory used as the child working directory.
 * @param {string} output - Owned preparation output directory.
 * @param {object} index - Mutable provenance receiving the real process outcome.
 * @param {string} label - Baseline or candidate identity.
 * @param {string} step - Install or build operation declared by the recipe.
 * @param {Function} save - Persists completed provenance before errors propagate.
 * @returns {void}
 */
function executeStep(root, output, index, label, step, save) {
  const prefix = `${label}-${step}`;
  const entry = { label, step, command: ['npm', ...settings.commands[step]], cwd: root,
    stdout: `${prefix}.stdout.log`, stderr: `${prefix}.stderr.log`, exitCode: null };
  index.commands.push(entry); save();
  const stdout = fs.openSync(path.join(output, entry.stdout), 'wx');
  let stderr;
  let result;
  try {
    stderr = fs.openSync(path.join(output, entry.stderr), 'wx');
    result = spawnSync('npm', settings.commands[step], { cwd: root, stdio: ['ignore', stdout, stderr], timeout: settings.commandTimeoutMs });
  } finally { fs.closeSync(stdout); if (stderr !== undefined) fs.closeSync(stderr); }
  Object.assign(entry, { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null }); save();
  for (const name of [entry.stdout, entry.stderr]) index.files[name] = hash(fs.readFileSync(path.join(output, name)));
  save();
  assert.equal(result.status, 0, `Hosted build: inspect ${entry.stderr}`);
  if (step === 'install') { index.installedDependencies[label] = fingerprint(root, ['node_modules']); save(); }
}

/**
 * Reject links to the original build tree and directory cycles before fingerprinting.
 * @param {string} rootArgument - Actual preparation directory or relocated archive.
 * @returns {object[]} Relative links wholly contained in the prepared file tree.
 */
function inspectLinks(rootArgument) {
  const root = fs.realpathSync(rootArgument); const links = [];
  const packageLinks = Object.keys(settings.packageSources).map((label) => `packages/${label}/node_modules`);
  const walk = (relative) => {
    const filename = path.join(root, relative); const metadata = fs.lstatSync(filename);
    if (metadata.isSymbolicLink()) {
      const target = fs.readlinkSync(filename);
      assert.equal(path.isAbsolute(target), false, `Hosted build: absolute symbolic link: ${relative}`);
      const resolved = fs.realpathSync(filename);
      assert.ok(resolved.startsWith(`${root}${path.sep}`), `Hosted build: symbolic link escapes archive: ${relative}`);
      const targetMetadata = fs.statSync(filename);
      if (targetMetadata.isDirectory()) {
        assert.ok(packageLinks.includes(relative), `Hosted build: undeclared directory link: ${relative}`);
        assert.equal(resolved, path.join(root, 'node_modules'));
      } else assert.equal(targetMetadata.isFile(), true, `Hosted build: unsupported link target: ${relative}`);
      links.push({ path: relative, target });
    } else if (metadata.isDirectory()) {
      for (const name of fs.readdirSync(filename).sort()) walk(relative ? `${relative}/${name}` : name);
    } else assert.equal(metadata.isFile(), true, `Hosted build: unsupported archive entry: ${relative}`);
  };
  walk(''); return links;
}

/**
 * Recalculate packaged bytes after relocation without loading a DOM or invoking compilers.
 * @param {string} outputArgument - Complete preparation directory to inspect offline.
 * @returns {object} Verified identities with no performance decision.
 */
function verify(outputArgument) {
  const output = path.resolve(outputArgument);
  const links = inspectLinks(output);
  const index = JSON.parse(fs.readFileSync(path.join(output, 'index.json'), 'utf8'));
  assert.equal(index.complete, true); assert.equal(index.measurementExecuted, false);
  assert.equal(index.failure, undefined, 'Hosted build: failed preparation cannot be accepted as complete');
  assert.equal(index.performanceAccepted, null); assert.deepEqual(index.settings, settings);
  assert.equal(typeof index.preparationId, 'string'); assert.notEqual(index.preparationId, '');
  assert.deepEqual(links, index.links);
  assert.deepEqual(index.inputsAfter, index.inputsBefore);
  assert.equal(index.tools.node, settings.node); assert.equal(index.tools.tools.npm.stdout, settings.npm);
  assert.ok(index.tools.tools.rustc.stdout.split('\n').includes(`release: ${settings.rustRelease}`));
  assert.ok(index.tools.tools.cargo.stdout.startsWith(`cargo ${settings.cargoRelease} `));
  assert.ok(index.tools.cargoConfiguration.every((file) => file.exists === false));
  assert.deepEqual(index.commands.map(({ label, step, exitCode }) => ({ label, step, exitCode })),
    ['A', 'B'].flatMap((label) => ['install', 'build'].map((step) => ({ label, step, exitCode: 0 }))));
  for (const [name, expected] of Object.entries(index.files)) {
    const filename = path.resolve(output, name);
    assert.ok(filename.startsWith(`${output}${path.sep}`), 'Hosted build: file escapes archive');
    assert.equal(hash(fs.readFileSync(filename)), expected, `Hosted build: archived file changed: ${name}`);
  }
  assert.deepEqual(verifyCurrentInputs(path.join(output, 'baseline-sources'), path.join(output, 'sources')), index.inputsBefore);
  const candidateNames = [...new Set([...study.captureHarness(path.join(output, 'sources')).files.map((file) => file.path),
    ...settings.additionalBuildInputs, ...settings.preparationFiles])];
  const expectedFiles = [...new Set([...index.sourceProvenance.A.measuredSources, ...settings.additionalBuildInputs])]
    .map((name) => `baseline-sources/${name}`)
    .concat(candidateNames.map((name) => `sources/${name}`), index.commands.flatMap((entry) => [entry.stdout, entry.stderr]));
  assert.deepEqual(Object.keys(index.files).sort(), expectedFiles.sort());
  assert.deepEqual(fingerprint(output, ['node_modules']), index.dependencies);
  assert.deepEqual(index.dependencies, index.installedDependencies.B);
  assert.deepEqual(Object.keys(index.distributions).sort(), Object.keys(settings.packageSources).sort());
  for (const [label, distribution] of Object.entries(index.distributions)) {
    const root = path.join(output, 'packages', label);
    assert.deepEqual(fingerprint(root, label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json']), distribution);
    assert.equal(fs.realpathSync(path.join(root, 'node_modules')), fs.realpathSync(path.join(output, 'node_modules')));
    if (!label.startsWith('J')) {
      const metadata = JSON.parse(fs.readFileSync(path.join(root, 'dist/native-build.json')));
      assert.equal(metadata.binarySha256, hash(fs.readFileSync(path.join(root, 'dist/rustdom.node'))));
      assert.equal(metadata.platform, settings.platform); assert.equal(metadata.arch, settings.arch);
      assert.equal(metadata.node, settings.node); assert.equal(metadata.glibcBuildVersion, settings.glibc);
      const sources = label === 'B' ? 'sources' : 'baseline-sources';
      assert.equal(metadata.cargoLockSha256, hash(fs.readFileSync(path.join(output, sources, 'Cargo.lock'))));
    }
  }
  assert.equal(index.distributions.A0.sha256, index.distributions.A1.sha256);
  assert.equal(index.distributions.J0.sha256, index.distributions.J1.sha256);
  return { verified: true, preparationId: index.preparationId, measurementExecuted: false, performanceAccepted: null,
    inputs: index.inputsBefore, distributions: Object.fromEntries(Object.entries(index.distributions).map(([label, value]) => [label, value.sha256])),
    dependenciesSha256: index.dependencies.sha256 };
}

/**
 * Bind functional records to these exact packages and reject stale or falsely clear endpoints.
 * @param {object} report - Actual worker output, including resource traces and baseline counts.
 * @param {object} identity - Independently verified preparation identity.
 * @returns {object} Matching preparation and runtime, without a performance decision.
 */
function verifyFunctionalReport(report, identity) {
  assert.equal(report.pass, true); assert.equal(report.measurementExecuted, false);
  assert.deepEqual(report.integrity, identity, 'Hosted build: functional report belongs to another preparation');
  assert.ok(settings.validationNodeVersions.includes(report.node));
  const labels = Object.keys(settings.packageSources);
  const expected = labels.flatMap((label) => Array.from({ length: settings.validationCycles }, (_, cycle) => ({ label, cycle })));
  assert.deepEqual(report.results.map(({ label, cycle }) => ({ label, cycle })), expected);
  assert.equal(report.observedWindows, expected.length); assert.equal(report.observedDocuments, expected.length);
  const { isReleased } = require('../../../scripts/memory-endpoint.cjs');
  assert.deepEqual(Object.keys(report.endpoints).sort(), [...labels].sort());
  for (const label of labels) {
    const endpoint = report.endpoints[label]; assert.equal(endpoint.reached, true);
    assert.equal(endpoint.requiredClearSamples, 2); assert.equal(endpoint.maxRounds, settings.releaseMaxRounds);
    assert.equal(endpoint.timeoutMs, settings.releaseTimeoutMs);
    assert.ok(endpoint.trace.length >= endpoint.requiredClearSamples);
    assert.ok(endpoint.trace.length <= settings.releaseMaxRounds);
    for (const state of endpoint.trace.slice(-endpoint.requiredClearSamples)) {
      assert.equal(state.clear, true); assert.equal(isReleased(state, report.baselines[label]), true);
    }
    const { round, elapsedMs, clear, ...terminalState } = endpoint.trace.at(-1);
    assert.deepEqual(endpoint.state, terminalState);
  }
  const publicResult = report.results.find((entry) => entry.label === 'J0').result;
  for (const entry of report.results) {
    assert.deepEqual(entry.result, publicResult);
    assert.deepEqual(Object.keys(entry.allocationDelta).sort(), labels.filter((label) => !label.startsWith('J')).sort());
    for (const [label, created] of Object.entries(entry.allocationDelta)) {
      if (label === entry.label) assert.ok(created > 0); else assert.equal(created, 0);
    }
  }
  return { verified: true, preparationId: identity.preparationId, node: report.node };
}

/**
 * Build once from fresh complete roots; preserve output and partial provenance on any failure.
 * @param {string} baselineArgument - Full checkpoint067 sources, with no existing dist directory.
 * @param {string} candidateArgument - Full C sources and unchanged measured harness, with no dist directory.
 * @param {string} outputArgument - New output directory that must not overlap either source root.
 * @returns {object} Verified package identities; performance remains undecided.
 */
function prepare(baselineArgument, candidateArgument, outputArgument) {
  const roots = { A: fs.realpathSync(baselineArgument), B: fs.realpathSync(candidateArgument) };
  const requestedOutput = path.resolve(outputArgument);
  const output = path.join(fs.realpathSync(path.dirname(requestedOutput)), path.basename(requestedOutput));
  assert.equal(fs.existsSync(output), false, 'Hosted build: output already exists; preserve the previous preparation');
  assert.notEqual(roots.A, roots.B, 'Hosted build: independent source roots are required');
  for (const root of Object.values(roots)) {
    assert.ok(output !== root && !root.startsWith(`${output}${path.sep}`) && !output.startsWith(`${root}${path.sep}`),
      'Hosted build: output must not overlap either source root');
    assert.equal(fs.existsSync(path.join(root, 'dist')), false, 'Hosted build: dist must be absent before a fresh build');
  }
  const inputsBefore = verifyCurrentInputs(roots.A, roots.B);
  const tools = inspectTools(roots);
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.mkdirSync(output);
  const index = { complete: false, measurementExecuted: false, performanceAccepted: null,
    preparationId: randomUUID(), startedAt: new Date().toISOString(), settings, roots, inputsBefore, tools,
    commands: [], files: {}, distributions: {}, installedDependencies: {},
    machine: { cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, release: os.release(), totalMemoryBytes: os.totalmem() } };
  const save = () => fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  save();
  try {
    const harness = study.captureHarness(roots.B);
    index.sourceProvenance = { A: captureSourceIdentity(roots.A), B: captureSourceIdentity(roots.B) };
    for (const name of [...index.sourceProvenance.A.measuredSources, ...settings.additionalBuildInputs]) {
      const destination = path.join(output, 'baseline-sources', name);
      fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(roots.A, name), destination);
      index.files[`baseline-sources/${name}`] = hash(fs.readFileSync(destination));
    }
    const names = [...new Set([...harness.files.map((file) => file.path), ...settings.additionalBuildInputs, ...settings.preparationFiles])].sort();
    for (const name of names) {
      const source = settings.preparationFiles.includes(name) ? path.join(repositoryRoot, name) : path.join(roots.B, name);
      const destination = path.join(output, 'sources', name);
      fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination);
      index.files[`sources/${name}`] = hash(fs.readFileSync(destination));
    }
    save();
    for (const [label, root] of Object.entries(roots)) for (const step of ['install', 'build']) executeStep(root, output, index, label, step, save);
    index.inputsAfter = verifyCurrentInputs(roots.A, roots.B); assert.deepEqual(index.inputsAfter, inputsBefore);
    assert.deepEqual(inspectCargoConfiguration(roots), tools.cargoConfiguration);
    for (const name of settings.additionalBuildInputs) {
      assert.equal(hash(fs.readFileSync(path.join(roots.A, name))), index.files[`baseline-sources/${name}`],
        `Hosted build: baseline input changed during preparation: ${name}`);
    }
    for (const name of names) {
      const source = settings.preparationFiles.includes(name) ? path.join(repositoryRoot, name) : path.join(roots.B, name);
      assert.equal(hash(fs.readFileSync(source)), index.files[`sources/${name}`], `Hosted build: source changed during preparation: ${name}`);
    }
    fs.cpSync(path.join(roots.B, 'node_modules'), path.join(output, 'node_modules'), { recursive: true, verbatimSymlinks: true });
    index.dependencies = fingerprint(output, ['node_modules']);
    for (const [label, root] of Object.entries(roots)) assert.deepEqual(fingerprint(root, ['node_modules']), index.installedDependencies[label]);
    const reference = path.dirname(require.resolve('jsdom/package.json', { paths: [roots.B] }));
    assert.equal(JSON.parse(fs.readFileSync(path.join(reference, 'package.json'))).version, settings.referenceVersion);
    const packageRoots = { ...roots, reference };
    for (const [label, source] of Object.entries(settings.packageSources)) {
      const root = packageRoots[source];
      const destination = path.join(output, 'packages', label); fs.mkdirSync(destination, { recursive: true });
      const parts = label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json'];
      const original = fingerprint(root, parts);
      for (const part of parts) fs.cpSync(path.join(root, part), path.join(destination, part), { recursive: true });
      fs.symlinkSync('../../node_modules', path.join(destination, 'node_modules'), 'dir');
      index.distributions[label] = fingerprint(destination, parts); assert.deepEqual(index.distributions[label], original);
    }
    for (const entry of index.commands) for (const name of [entry.stdout, entry.stderr]) index.files[name] = hash(fs.readFileSync(path.join(output, name)));
    index.links = inspectLinks(output);
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    return verify(output);
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) {
  try {
    const result = process.argv[2] === '--verify' ? verify(process.argv[3]) : prepare(...process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { inspectTools, inspectCargoConfiguration, inspectLinks, prepare, verify, verifyFunctionalReport };
