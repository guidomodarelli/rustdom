/** @file Tests preparation boundaries and rejection using real Node and Jest processes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preparation = require('./prepare.cjs');
const { runnerCommand } = require('./qualify.cjs');
const settings = require('./constants/suites.json');

/** Preserve expected process failures while proving their specific contract, without mocks. */
function main(preparedArgument, outputArgument, ...nodes) {
  const prepared = fs.realpathSync(preparedArgument);
  const output = preparation.inspectDestination(outputArgument, [prepared]);
  assert.equal(nodes.length, settings.nodeVersions.length);
  const before = preparation.verify(prepared);
  fs.mkdirSync(output);
  const index = { complete: false, measurementExecuted: false, accepted: null,
    method: preparation.methodIdentity(), commands: [], cases: [], preparationBefore: before };
  const save = () => fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  save();
  try {
    for (const [position, node] of nodes.entries()) {
      const version = settings.nodeVersions[position];
      assert.equal(preparation.command([node, '--version'], output, output, `node-${position}`, index, save), version);
      assert.throws(() => preparation.inspectDestination(path.join(prepared, 'forbidden-output'), [prepared]), /disjoint/);
      index.cases.push({ version, name: 'reject-overlapping-output', passed: true }); save();
      const incomplete = path.join(output, version, 'incomplete-source');
      fs.mkdirSync(path.join(incomplete, 'tests/integration'), { recursive: true });
      assert.throws(() => preparation.inspectSuiteInputs(incomplete), /incomplete or changed integration suites/);
      index.cases.push({ version, name: 'reject-incomplete-suite-before-install', passed: true }); save();
      const failure = path.join(output, version, 'child-failure'); fs.mkdirSync(failure, { recursive: true });
      assert.throws(() => preparation.command([node, '-e', 'process.stdout.write("before-exit");process.stderr.write("expected-seven");process.exitCode=7'],
        failure, failure, 'child', index, save), /child failed/);
      assert.equal(index.commands.at(-1).exitCode, 7);
      assert.equal(fs.readFileSync(path.join(failure, 'child.stdout.log'), 'utf8'), 'before-exit');
      assert.equal(fs.readFileSync(path.join(failure, 'child.stderr.log'), 'utf8'), 'expected-seven');
      index.cases.push({ version, name: 'preserve-real-child-exit-seven', passed: true }); save();
      const directory = path.join(output, version, 'wrong-package'); fs.mkdirSync(directory, { recursive: true });
      const root = path.join(prepared, 'packages/A0'); const wrong = path.join(prepared, 'packages/A1');
      const argv = runnerCommand(node, root, 'jest', directory, path.join(prepared, 'node_modules'));
      argv.push('--runTestsByPath', path.join(root, 'tests/integration/suite-provenance.jest.cjs'));
      assert.throws(() => preparation.command(argv, root, directory, 'suite', index, save,
        { CI: '1', FORCE_COLOR: '0', [settings.expectedRootEnvironment]: wrong }), /suite failed/);
      assert.equal(index.commands.at(-1).exitCode, 1);
      const report = JSON.parse(fs.readFileSync(path.join(directory, 'report.json'), 'utf8'));
      assert.equal(report.numTotalTests, 1); assert.equal(report.numFailedTests, 1); assert.equal(report.success, false);
      const failures = report.testResults.flatMap((result) => result.assertionResults).flatMap((result) => result.failureMessages).join('\n');
      assert.ok(failures.includes(path.join(root, 'dist/native.cjs')) && failures.includes(path.join(wrong, 'dist/native.cjs')),
        'Runner suites: expected the real probe to reject the other package, not an unrelated test failure');
      index.cases.push({ version, name: 'real-jest-rejects-wrong-native-package', passed: true }); save();
    }
    index.preparationAfter = preparation.verify(prepared); assert.deepEqual(index.preparationAfter, before);
    assert.deepEqual(preparation.methodIdentity(), index.method);
    index.complete = true; save();
    return { complete: true, cases: index.cases.length, measurementExecuted: false, accepted: null };
  } catch (error) {
    index.failure = { message: error.message, stack: error.stack }; save(); throw error;
  }
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(...process.argv.slice(2)))}\n`); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }
}
module.exports = { main };
