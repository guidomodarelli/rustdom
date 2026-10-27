/** @file Exercises the CI boundary with real checkpoint067/C sources and all recorded observations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { historicalSources } = require('./fixtures/history-sources/materialize.cjs');
const { historicalSources: xmlSources } = require('./fixtures/xml-history-sources/materialize.cjs');
const { authenticateArchive, verifyCurrentInputs, verifyEvidence } = require('./ownership-evidence.cjs');
const archive = path.join(__dirname, 'paired-inline/2026-10-22');
const cli = path.join(__dirname, 'ownership-evidence.cjs');

/** Restore real source snapshots; checkpoint066/067 have identical root build inputs, not identical implementations. */
function sourceFixture(context) {
  const { baseline } = historicalSources(context);
  const original = xmlSources(context);
  for (const name of ['package.json', 'build.rs']) {
    fs.copyFileSync(path.join(original.baseline, name), path.join(baseline, name));
  }
  const index = JSON.parse(fs.readFileSync(path.join(archive, 'node-22/index.json')));
  for (const file of index.harness.files) {
    const destination = path.join(original.candidate, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(archive, 'node-22/harness', file.path), destination);
  }
  return { baseline, candidate: original.candidate, directory: original.directory };
}

test('recalculates every recorded Node22/24 worker and preserves the negative budget', (context) => {
  const { baseline, candidate } = sourceFixture(context);
  const result = verifyEvidence(baseline, archive, candidate);
  assert.equal(result.verified, true);
  assert.equal(result.accepted, false);
  assert.equal(result.measurementExecuted, false);
  assert.equal(result.authenticatedFiles, 931);
  assert.deepEqual(result.results.map((node) => [node.node, node.processes, node.measuredDurations, node.accepted]),
    [['v22.12.0', 32, 4608, false], ['v24.14.1', 32, 4608, false]]);
});

for (const [label, filename] of [['candidate', 'src/dom/tree.rs'], ['baseline', 'src/dom/tree.rs'],
  ['candidate', 'build.rs'], ['baseline', 'package.json'],
  ['candidate', 'reports/benchmarks/native-class-ownership/paired-main-worker.cjs']]) {
  test(`rejects changed current inputs: ${label}/${filename}`, (context) => {
    const roots = sourceFixture(context);
    fs.appendFileSync(path.join(roots[label], filename), '\n');
    assert.throws(() => verifyCurrentInputs(roots.baseline, roots.candidate), /Ownership evidence: current/);
  });
}

test('rejects an added build configuration outside the canonical source scope', (context) => {
  const { baseline, candidate } = sourceFixture(context);
  fs.mkdirSync(path.join(candidate, '.cargo'));
  fs.writeFileSync(path.join(candidate, '.cargo/config.toml'), '[build]\nrustflags = ["-C", "opt-level=1"]\n');
  assert.throws(() => verifyCurrentInputs(baseline, candidate), /current B build input differs: .cargo\/config.toml/);
});

test('rejects a missing archive without creating a directory or starting a study', (context) => {
  const { baseline, candidate, directory } = sourceFixture(context);
  const absent = path.join(directory, 'absent');
  assert.throws(() => verifyEvidence(baseline, absent, candidate), { code: 'ENOENT' });
  assert.equal(fs.existsSync(absent), false);
});

for (const change of ['observation', 'decision', 'missing-worker', 'manifest']) {
  test(`rejects damaged evidence without granting a new measurement: ${change}`, (context) => {
    const { directory } = sourceFixture(context);
    const changed = path.join(directory, 'damaged');
    fs.cpSync(archive, changed, { recursive: true });
    if (change === 'missing-worker') fs.unlinkSync(path.join(changed, 'node-24/AB-7-rustdom.json'));
    else {
      const filename = path.join(changed, change === 'manifest' ? 'files.json' :
        change === 'decision' ? 'node-22/index.json' : 'node-22/AA-0-jsdom.json');
      const data = JSON.parse(fs.readFileSync(filename));
      if (change === 'observation') data.batches[0].samplesMs[0] += 1;
      else if (change === 'decision') data.accepted = true;
      else data[0].sha256 = '0'.repeat(64);
      fs.writeFileSync(filename, JSON.stringify(data));
    }
    assert.throws(() => authenticateArchive(changed));
  });
}

test('actual CI CLI returns budget exit1 with both Node results instead of a stale-source failure', (context) => {
  const { baseline, candidate } = sourceFixture(context);
  const child = spawnSync(process.execPath, [cli, baseline, archive], { cwd: candidate, encoding: 'utf8' });
  assert.equal(child.status, 1, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.verified, true);
  assert.equal(result.accepted, false);
  assert.equal(result.results.length, 2);
  assert.match(child.stderr, /verified C study has not accepted the performance budget/);
});

test('actual CI CLI returns integrity exit2 for changed sources and never emits an accepted result', (context) => {
  const { baseline, candidate } = sourceFixture(context);
  fs.appendFileSync(path.join(candidate, 'src/dom/tree.rs'), '\n');
  const child = spawnSync(process.execPath, [cli, baseline, archive], { cwd: candidate, encoding: 'utf8' });
  assert.equal(child.status, 2);
  assert.equal(child.stdout, '');
  assert.match(child.stderr, /current B sources differ/);
});
