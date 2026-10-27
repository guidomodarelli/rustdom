/** @file Binds the unchanged XML experiment to complete, independently verified preparation inputs. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const preparation = require('./prepare-xml-hosted-build.cjs');
const { captureXmlBuildInputs } = require('./xml-build-inputs.cjs');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const { fingerprint } = require('./paired-experiment.cjs');
const settings = require('./constants/xml-current-run.cjs');

/**
 * Verify actual prepared roots independently of a historical experiment's fixed candidate scope.
 * @param {string} baseline - Full checkpoint066 source/build tree.
 * @param {string} candidate - Full candidate source/build tree.
 * @param {string} archive - Complete, immutable XML preparation.
 * @returns {object} Observed identities, with no performance decision.
 */
function inspectPreparation(baseline, candidate, archive) {
  assert.ok(settings.nodeVersions.includes(process.version), 'XML current run: unsupported Node version');
  assert.equal(process.platform, 'linux', 'XML current run: Linux is required');
  assert.equal(process.arch, 'x64', 'XML current run: x64 is required');
  for (const name of settings.forbiddenEnvironment) assert.ok(!process.env[name], `XML current run: undeclared ${name}`);
  const identity = preparation.verify(archive);
  const index = JSON.parse(fs.readFileSync(path.join(archive, 'index.json'), 'utf8'));
  const roots = { A: fs.realpathSync(baseline), B: fs.realpathSync(candidate) };
  const inputs = captureXmlBuildInputs(roots.A, roots.B);
  assert.deepEqual(inputs, index.inputsBefore, 'XML current run: actual source/build inputs differ from the preparation');
  const distributions = {}, dependencies = {}, sources = {};
  for (const [label, root] of Object.entries(roots)) {
    sources[label] = captureSourceIdentity(root);
    distributions[label] = fingerprint(root, ['dist', 'package.json']);
    dependencies[label] = fingerprint(root, ['node_modules']);
    assert.deepEqual(distributions[label], index.distributions[label === 'A' ? 'A0' : 'B'],
      `XML current run: actual ${label} distribution differs from the preparation`);
    assert.deepEqual(dependencies[label], index.installedDependencies[label],
      `XML current run: actual ${label} dependencies differ from the preparation`);
  }
  const compiler = spawnSync('rustc', ['-Vv'], { encoding: 'utf8' });
  assert.ifError(compiler.error);
  assert.equal(compiler.status, 0, 'XML current run: rustc -Vv failed');
  assert.equal(compiler.stdout.trim(), index.tools.tools.rustc.stdout, 'XML current run: compiler differs from the preparation');
  const executableSha256 = createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex');
  if (process.version === settings.measurementNode) assert.equal(executableSha256, index.tools.executableSha256,
    'XML current run: measurement Node executable differs from the preparation');
  const glibc = process.report.getReport().header.glibcVersionRuntime;
  assert.equal(glibc, index.settings.glibc, 'XML current run: glibc differs from the preparation');
  return { revision: settings.revision, node: process.version, preparationId: identity.preparationId,
    preparationIndexSha256: createHash('sha256').update(fs.readFileSync(path.join(archive, 'index.json'))).digest('hex'),
    roots, inputs, sources, distributions, dependencies, compiler: compiler.stdout.trim(),
    runtime: { executableSha256, v8: process.versions.v8, glibc },
    machine: { cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, release: os.release(), totalMemoryBytes: os.totalmem() },
    measurementExecuted: false, performanceAccepted: null };
}

/**
 * Preserve the consumed experiment's exact source restriction, after checking real prepared inputs.
 * A verified new preparation is not permission to reuse historical measurement eligibility.
 * @param {string} baseline - Full checkpoint066 source/build tree.
 * @param {string} candidate - Full candidate source/build tree.
 * @param {string} archive - Complete immutable preparation.
 * @returns {object} The historical method's unchanged identity contract.
 */
function inspect(baseline, candidate, archive) {
  const identity = inspectPreparation(baseline, candidate, archive);
  assert.equal(identity.inputs.sources.B, settings.candidateSourceHash,
    'XML current run: candidate is outside the declared source scope');
  return identity;
}

/** @param {string} directory - Original experiment output. @returns {object} Original complete/acceptance states, preserving null when AB did not run. */
function readExperimentOutcome(directory) {
  const filename = path.join(directory, 'experiment.json');
  if (!fs.existsSync(filename)) return { complete: false, accepted: null };
  const experiment = JSON.parse(fs.readFileSync(filename, 'utf8'));
  return { complete: experiment.complete, accepted: experiment.complete ? experiment.accepted : null };
}

/**
 * Run the existing protocol once, keeping partial output and post-run integrity on every outcome.
 * @param {string} baseline - Actual baseline runtime root.
 * @param {string} candidate - Actual candidate runtime root.
 * @param {string} archive - Verified preparation directory.
 * @param {string} output - New external directory, never an existing capture.
 * @returns {object} Process outcome and observed identities; no acceptance is inferred from exit 0.
 */
function run(baseline, candidate, archive, output) {
  assert.equal(process.version, settings.measurementNode, 'XML current run: measurement requires the declared Node');
  const before = inspect(baseline, candidate, archive);
  const allowedCpus = fs.readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1];
  assert.ok(allowedCpus?.split(',').some((range) => {
    const [first, last = first] = range.split('-').map(Number);
    return settings.cpu >= first && settings.cpu <= last;
  }), 'XML current run: declared CPU is outside the allowed affinity');
  const requestedOutput = path.resolve(output);
  const directory = path.join(fs.realpathSync(path.dirname(requestedOutput)), path.basename(requestedOutput));
  for (const root of [...Object.values(before.roots), fs.realpathSync(archive)]) {
    assert.ok(directory !== root && !directory.startsWith(`${root}${path.sep}`) && !root.startsWith(`${directory}${path.sep}`),
      'XML current run: capture must not overlap source or preparation trees');
  }
  fs.mkdirSync(directory);
  const record = { revision: settings.revision, startedAt: new Date().toISOString(), before,
    measurementExecuted: false, performanceAccepted: null, complete: false };
  const save = () => fs.writeFileSync(path.join(directory, 'execution.json'), `${JSON.stringify(record, null, 2)}\n`);
  save();
  const stdout = fs.openSync(path.join(directory, 'experiment.stdout.log'), 'wx');
  let stderr;
  try {
    stderr = fs.openSync(path.join(directory, 'experiment.stderr.log'), 'wx');
    const arguments_ = ['benchmarks/xml-controller-experiment.cjs', '--baseline', before.roots.A,
      '--output', path.join(directory, 'observations'), '--cpu', String(settings.cpu)];
    record.command = [process.execPath, ...arguments_]; record.measurementExecuted = true; save();
    const child = spawnSync(process.execPath, arguments_, { cwd: before.roots.B,
      env: { ...process.env, RUSTDOM_BENCHMARK_REQUESTED_HEAD: before.sources.B.sourceCommit ?? '' },
      stdio: ['ignore', stdout, stderr] });
    record.process = { pid: child.pid, exitCode: child.status, signal: child.signal, error: child.error?.message ?? null };
    save();
    record.after = inspect(baseline, candidate, archive);
    assert.deepEqual(record.after, before, 'XML current run: inputs changed during the measurement');
    record.complete = !child.error && !child.signal && [0, 2, 3].includes(child.status);
    const experiment = readExperimentOutcome(path.join(directory, 'observations'));
    record.experimentComplete = experiment.complete;
    record.performanceAccepted = experiment.accepted;
    record.finishedAt = new Date().toISOString(); save();
    return record;
  } catch (error) {
    record.failure = { name: error.name, message: error.message }; save(); throw error;
  } finally { fs.closeSync(stdout); if (stderr !== undefined) fs.closeSync(stderr); }
}

if (require.main === module) {
  try {
    const [mode, baseline, candidate, archive, output] = process.argv.slice(2);
    assert.ok(mode === '--inspect' || mode === '--run', 'XML current run: use --inspect or --run with baseline, candidate and archive');
    const result = mode === '--inspect' ? inspect(baseline, candidate, archive) : run(baseline, candidate, archive, output);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (mode === '--run' && (!result.complete || result.performanceAccepted !== true)) process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { inspectPreparation, inspect, readExperimentOutcome, run };
