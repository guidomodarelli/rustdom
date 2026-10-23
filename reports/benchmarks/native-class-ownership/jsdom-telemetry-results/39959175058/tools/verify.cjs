'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
assert.equal(process.argv.length, 4, 'Provide extracted jsdom-telemetry root and a new output JSON file');
const repository = path.resolve(__dirname, '../../../../../..');
const output = path.resolve(process.argv[3]);
assert.ok(!fs.existsSync(output), 'JSDOM telemetry replay: output already exists; preserve it');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const root = path.resolve(process.argv[2]);
const capture = path.join(root, 'capture');
const index = read(path.join(capture, 'index.json'));
const method = require(path.join(repository, 'reports/benchmarks/native-class-ownership/jsdom-telemetry/run.cjs'));
const study = require(path.join(repository, 'reports/benchmarks/native-class-ownership/current-ownership-experiment.cjs'));
const { analyzeProcess } = require(path.join(repository, 'reports/benchmarks/native-class-ownership/jsdom-telemetry/analyze.cjs'));
assert.equal(index.mode, 'capture'); assert.equal(index.accepted, null); assert.equal(index.gateReevaluated, false);
assert.equal(index.complete, true); assert.equal(index.processes.length, 64);
assert.deepEqual(index.sourceFiles, method.sourceFiles());
for (const [name, expected] of Object.entries(index.sourceFiles)) assert.equal(hash(path.join(capture, 'method', name)), expected);
const publication = read(path.join(capture, 'publication.json'));
assert.equal(publication.commit, '22aeb0ba709f9a2959f4fe482b043f43d59794ad');
assert.deepEqual(publication.files, index.sourceFiles);
assert.equal(publication.actionableFindings, 0);
study.inspectPreparation(path.join(root, 'preparation/ownership-build'));
const source = read(path.join(capture, 'source-manifest.json'));
const harness = study.captureHarness();
assert.equal(source.commit, publication.commit);
assert.equal(source.harnessSha256, harness.sha256);
assert.deepEqual(source.files, harness.files);
for (const mode of ['cpu', 'jit']) {
  const derived = path.join(capture, `derived-${mode}`);
  const receipt = read(path.join(derived, 'preparation.json'));
  assert.equal(receipt.sourceCommit, publication.commit);
  assert.equal(receipt.sourceManifestSha256, hash(path.join(capture, 'source-manifest.json')));
  for (const [name, expected] of Object.entries(receipt.derivedFiles)) assert.equal(hash(path.join(derived, name)), expected);
}
const rows = [];
for (const [nodeIndex, nodeMajor] of [22, 24].entries()) {
  const processes = index.processes.filter((entry) => entry.node.startsWith(`v${nodeMajor}.`));
  assert.deepEqual(processes.map((entry) => entry.input), method.plan(nodeIndex, 'capture'));
  for (const entry of processes) {
    const directory = path.join(capture, `node${nodeMajor}`, path.basename(entry.directory));
    assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null);
    for (const [name, expected] of Object.entries(entry.files)) assert.equal(hash(path.join(directory, name)), expected);
    const report = read(path.join(directory, 'report.json'));
    method.validateReport(report, index.manifest, entry.input, entry);
    const analysis = analyzeProcess(directory);
    assert.deepEqual(analysis, read(path.join(directory, 'analysis.json')));
    rows.push({ node: entry.node, directory: path.relative(root, directory), input: entry.input, analysis });
  }
}
const replay = { node: process.version, samplerExecuted: false, processes: rows.length,
  spans: rows.reduce((total, row) => total + row.analysis.spans.length, 0),
  signedNegativeCpuDeltas: rows.reduce((total, row) => total + (row.analysis.outOfOrderCpuSamples?.length ?? 0), 0),
  verified: true, accepted: null, gateReevaluated: false, rows };
fs.writeFileSync(output, JSON.stringify(replay, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...replay, rows: undefined, output }));
