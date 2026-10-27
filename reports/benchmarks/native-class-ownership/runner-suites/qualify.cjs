/** @file Exercises complete real Jest/Vitest suites without accepting or sampling performance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preparation = require('./prepare.cjs');
const settings = require('./constants/suites.json');

/** Select the public runner CLI and retain every original test plus the provenance probe. */
function runnerCommand(node, root, runner, output, dependencies) {
  const report = path.join(output, 'report.json');
  if (runner === 'jest') return [node, path.join(dependencies, 'jest/bin/jest.js'), '--runInBand', '--no-cache',
    '--config', path.join(root, 'jest.config.cjs'), '--json', '--outputFile', report];
  assert.ok(settings.runners.some((entry) => entry.name === runner), 'Runner suites: unknown runner');
  return [node, path.join(dependencies, 'vitest/vitest.mjs'), 'run', '--config', path.join(root, 'vitest-suite.config.mjs'),
    '--no-cache', '--reporter=json', '--outputFile', report];
}

/** Check actual assertion results and the native allocations produced through runner globals. */
function inspectReport(directory, runner, root, version) {
  const report = JSON.parse(fs.readFileSync(path.join(directory, 'report.json'), 'utf8'));
  const expected = settings.runners.find((entry) => entry.name === runner);
  assert.equal(report.success, true, 'Runner suites: suite did not succeed');
  assert.equal(report.numTotalTests, expected.expectedTests, 'Runner suites: unexpected or missing tests');
  assert.equal(report.numPassedTests, expected.expectedTests);
  for (const name of ['numFailedTests', 'numPendingTests', 'numTodoTests']) assert.equal(report[name] ?? 0, 0, `Runner suites: ${name}`);
  const assertions = report.testResults.flatMap((entry) => entry.assertionResults);
  assert.equal(assertions.length, expected.expectedTests);
  assert.ok(assertions.every((entry) => entry.status === 'passed'), 'Runner suites: non-passing assertion');
  const logs = ['stdout', 'stderr'].map((kind) => fs.readFileSync(path.join(directory, `suite.${kind}.log`), 'utf8')).join('\n');
  const proofs = logs.split(/\r?\n/).filter((line) => line.includes(settings.probePrefix))
    .map((line) => JSON.parse(line.slice(line.indexOf(settings.probePrefix) + settings.probePrefix.length)));
  assert.equal(proofs.length, expected.expectedProbes, 'Runner suites: missing or duplicate provenance probes');
  for (const proof of proofs) {
    assert.equal(proof.root, fs.realpathSync(root)); assert.equal(proof.node, version);
    assert.equal(proof.nativeFile, fs.realpathSync(path.join(root, 'dist/native.cjs')));
    assert.equal(proof.created, 2);
  }
  return { tests: report.numTotalTests, passed: report.numPassedTests, proofs };
}

/** Run exactly twelve functional CLIs and preserve failures without launching later selections. */
function main(preparedArgument, outputArgument, ...nodes) {
  assert.equal(process.platform, 'linux', 'Runner suites: Linux qualification is required');
  for (const name of ['NODE_OPTIONS', 'NODE_PATH']) assert.equal(Object.hasOwn(process.env, name), false, `Runner suites: inherited ${name}`);
  const prepared = fs.realpathSync(preparedArgument);
  const output = preparation.inspectDestination(outputArgument, [prepared]);
  assert.equal(nodes.length, settings.nodeVersions.length);
  const before = preparation.verify(prepared);
  fs.mkdirSync(output);
  const index = { complete: false, qualificationOnly: true, measurementExecuted: false, gateReevaluated: false,
    accepted: null, settings, preparationBefore: before, method: preparation.methodIdentity(), commands: [], suites: [] };
  const save = () => fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  save();
  try {
    for (const [position, node] of nodes.entries()) {
      const version = settings.nodeVersions[position];
      assert.equal(preparation.command([node, '--version'], output, output, `node-${position}`, index, save), version);
      for (const physical of settings.qualificationPackages) {
        const root = path.join(prepared, 'packages', physical);
        for (const { name } of settings.runners) {
          const directory = path.join(output, version, physical, name);
          fs.mkdirSync(directory, { recursive: true });
          const entry = { version, physical, runner: name, complete: false, directory };
          index.suites.push(entry); save();
          const argv = runnerCommand(node, root, name, directory, path.join(prepared, 'node_modules'));
          preparation.command(argv, root, directory, 'suite', index, save,
            { CI: '1', FORCE_COLOR: '0', [settings.expectedRootEnvironment]: root,
              [settings.runnerEnvironment]: name, [settings.cacheEnvironment]: path.join(directory, 'vite-cache') });
          entry.result = inspectReport(directory, name, root, version); entry.complete = true; save();
          process.stdout.write(`${JSON.stringify({ version, physical, runner: name, passed: entry.result.passed })}\n`);
        }
      }
      index.preparationAfter = preparation.verify(prepared);
      assert.deepEqual(index.preparationAfter, before);
    }
    assert.deepEqual(preparation.methodIdentity(), index.method, 'Runner suites: method changed during qualification');
    index.complete = true; save();
    return { complete: true, qualificationOnly: true, accepted: null, suites: index.suites.length,
      tests: index.suites.reduce((total, entry) => total + entry.result.tests, 0) };
  } catch (error) {
    index.failure = { message: error.message, stack: error.stack }; save(); throw error;
  }
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(...process.argv.slice(2)))}\n`); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }
}
module.exports = { runnerCommand, inspectReport, main };
