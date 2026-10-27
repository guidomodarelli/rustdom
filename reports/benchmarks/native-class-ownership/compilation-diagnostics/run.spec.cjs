/** @file Exercises byte authentication, real process failure and stop-on-corruption without mocks. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyDerived, verifySources, runCommands } = require('./run.cjs');
const settings = require('./constants/trace.json');

const [derived, manifestPath, output] = process.argv.slice(2);
fs.mkdirSync(output);
const checks = [];
const receipt = verifyDerived(derived);
checks.push({ name: 'real-derived-source-authentication', files: Object.keys(receipt.derivedFiles).length });
const damaged = path.join(output, 'damaged-derived');
fs.cpSync(derived, damaged, { recursive: true });
fs.appendFileSync(path.join(damaged, 'harness/benchmarks/worker.cjs'), '\n');
assert.throws(() => verifyDerived(damaged), /changed derived file/);
checks.push({ name: 'reject-changed-sampler-even-with-unchanged-receipt' });
assert.throws(() => verifySources({ commit: '45a82467ab2b5e164bf67a6a823880f9949dc3fe', files: {} }), /incomplete source receipt/);
checks.push({ name: 'reject-source-receipt-without-required-files' });

const manifest = JSON.parse(fs.readFileSync(manifestPath));
const { schedule } = require(path.join(path.resolve(derived), 'harness/reports/benchmarks/native-class-ownership/independent-order-worker.cjs'));
for (const plan of [settings.capturePlan, [...settings.capturePlan].reverse()]) {
  for (const input of plan) {
    const actual = schedule(manifest, input.phase, input.engine, settings.position, input.label);
    assert.equal(actual.physical, input.physical);
    assert.equal(actual.root, manifest.copies[input.physical]);
  }
}
checks.push({ name: 'ten-treatment-selections-match-real-frozen-schedule', selections: settings.capturePlan.length * settings.nodeVersions.length });

for (const kind of ['child-exit', 'invalid-output']) {
  const directory = path.join(output, kind); fs.mkdirSync(directory);
  const nextMarker = path.join(directory, 'must-not-exist');
  const invalidOutput = path.join(directory, 'invalid.json');
  const script = kind === 'child-exit' ? 'process.stdout.write("partial output");process.stderr.write("controlled failure");process.exit(7)'
    : `require('node:fs').writeFileSync(${JSON.stringify(invalidOutput)}, 'invalid JSON')`;
  const commands = [{ physical: 'failure-fixture', nodeVersion: process.version, directory: path.join(directory, 'first'),
    argv: [process.execPath, '-e', script] },
  { physical: 'must-not-start', nodeVersion: process.version, directory: path.join(directory, 'second'),
    argv: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(nextMarker)}, 'started')`] }];
  const index = { complete: false, gateReevaluated: false, accepted: null, processes: [] };
  assert.throws(() => runCommands(commands, directory, index, () => {
    JSON.parse(fs.readFileSync(invalidOutput));
  }));
  const recorded = JSON.parse(fs.readFileSync(path.join(directory, 'index.json')));
  assert.equal(recorded.complete, false); assert.equal(recorded.accepted, null);
  assert.equal(recorded.processes.length, 1);
  assert.equal(recorded.processes[0].exitCode, kind === 'child-exit' ? 7 : 0);
  assert.equal(typeof recorded.failure.message, 'string');
  assert.equal(fs.existsSync(nextMarker), false);
  assert.equal(fs.existsSync(commands[1].directory), false);
  if (kind === 'child-exit') {
    assert.equal(fs.readFileSync(path.join(commands[0].directory, 'stdout.log'), 'utf8'), 'partial output');
    assert.equal(fs.readFileSync(path.join(commands[0].directory, 'stderr.log'), 'utf8'), 'controlled failure');
  }
  checks.push({ name: kind, firstResultRetained: true, laterCommandNotExecuted: true });
}
fs.writeFileSync(path.join(output, 'contracts.json'), `${JSON.stringify({ node: process.version,
  noDomMeasurements: true, platformMocks: false, checks }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ node: process.version, passed: checks.length })}\n`);
