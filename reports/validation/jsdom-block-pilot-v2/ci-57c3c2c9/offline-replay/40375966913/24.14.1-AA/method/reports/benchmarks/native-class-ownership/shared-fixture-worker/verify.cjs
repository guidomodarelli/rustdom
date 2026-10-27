/** @file Replays the complete derived-worker qualification, without loading a DOM or executing archived code. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { plan, validateReport } = require('./qualify.cjs');
const study = require('../current-ownership-experiment.cjs');
const settings = require('../constants/current-ownership.cjs');
const policy = require('./constants/protocol.json');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/** All stored names must stay below their explicitly declared archive root. */
function inside(root, name) {
  assert.equal(typeof name, 'string');
  const result = path.resolve(root, name);
  assert.ok(result.startsWith(`${path.resolve(root)}${path.sep}`), 'Shared fixture replay: file escapes archive');
  return result;
}

/** Require full ordered coverage, authentic raw files, unchanged outputs and finite resource boundaries. */
function verify(directory) {
  // This receipt belongs to the reviewed checkout, never to the supplied archive.
  // It pins the historical method, including readers later corrected without rerunning a sampler.
  const publication = read(path.resolve(__dirname, '../../../..', policy.publicationReceipt));
  assert.equal(hash(path.join(directory, 'index.json')), publication.indexSha256);
  const index = read(path.join(directory, 'index.json'));
  assert.equal(index.revision, policy.revision); assert.equal(index.complete, true);
  assert.equal(index.functionalOnly, true); assert.equal(index.performanceAccepted, null);
  assert.equal(index.gateReevaluated, false); assert.equal(index.failure, undefined);
  assert.equal(index.sourceCommit, publication.sourceCommit);
  assert.deepEqual(index.sourceFiles, publication.sourceFiles);
  assert.equal(index.derivationSha256, publication.derivationSha256);
  const sourceManifestPath = path.join(directory, 'source-manifest.json');
  assert.equal(hash(sourceManifestPath), publication.sourceManifestSha256);
  const sourceManifest = read(sourceManifestPath); const harness = study.captureHarness();
  assert.equal(harness.sha256, policy.sourceHarnessSha256);
  assert.equal(sourceManifest.commit, publication.sourceCommit);
  assert.equal(sourceManifest.harnessSha256, harness.sha256);
  assert.deepEqual(sourceManifest.files, harness.files);
  assert.deepEqual(index.manifest.preparationBefore, require('../constants/current-ownership-study.cjs').preparation.identity);
  const declared = [...policy.methodFiles.map((name) => path.relative(path.resolve(__dirname, '../../../..'), path.join(__dirname, name)).split(path.sep).join('/')),
    ...policy.sharedFiles, policy.referenceFile];
  assert.deepEqual(Object.keys(index.sourceFiles).sort(), [...new Set(declared)].sort());
  for (const [name, expected] of Object.entries(index.sourceFiles)) assert.equal(hash(inside(path.join(directory, 'method'), name)), expected);
  const receiptPath = path.join(directory, 'derived/preparation.json');
  assert.equal(hash(receiptPath), index.derivationSha256);
  const receipt = read(receiptPath);
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.sourceHarnessSha256, policy.sourceHarnessSha256);
  assert.equal(receipt.sourceManifestSha256, publication.sourceManifestSha256);
  assert.equal(receipt.verifiedSourceFiles, harness.files.length);
  assert.equal(receipt.functionalOnly, true); assert.equal(receipt.performanceAccepted, null);
  for (const [name, expected] of Object.entries(receipt.derivedFiles)) assert.equal(hash(inside(path.join(directory, 'derived'), name)), expected);
  for (const original of harness.files) if (original.path !== 'benchmarks/worker.cjs') {
    assert.equal(hash(inside(path.join(directory, 'derived/harness'), original.path)), original.sha256);
  }
  const totals = { processes: 0, windows: 0, documents: 0, spans: 0, warmupSpans: 0, measuredSpans: 0,
    firstUnclearStates: 0, requiredFinalClearStates: 0 };
  const groups = {};
  const inputs = plan(); assert.equal(index.processes.length, inputs.length * settings.nodeVersions.length);
  const randomProbe = new Map();
  for (const [ordinal, entry] of index.processes.entries()) {
    const nodeIndex = Math.floor(ordinal / inputs.length); const position = ordinal % inputs.length;
    assert.deepEqual(entry.input, inputs[position]); assert.equal(entry.node, settings.nodeVersions[nodeIndex]);
    assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
    const root = path.join(directory, nodeIndex === 0 ? 'node22' : 'node24', String(position).padStart(3, '0'));
    assert.deepEqual(Object.keys(entry.files).sort(), ['report.json', 'report.json.integration.json', 'stderr.log', 'stdout.log']);
    for (const [name, expected] of Object.entries(entry.files)) assert.equal(hash(inside(root, name)), expected);
    const report = read(path.join(root, 'report.json')); const metadata = read(path.join(root, 'report.json.integration.json'));
    validateReport(report, index.manifest, entry.input, entry, metadata, index.derivationSha256);
    if (randomProbe.has(entry.node)) assert.deepEqual(report.randomProbe, randomProbe.get(entry.node));
    else randomProbe.set(entry.node, report.randomProbe);
    const batch = report.batches[0]; const key = `${entry.node}/${report.schedule.physical}`;
    const group = groups[key] ?? { processes: 0, windows: 0, documents: 0, firstUnclearStates: 0,
      requiredFinalClearStates: 0, memoryRangesBytes: {}, nativeClassLiveValues: entry.input.engine === 'rustdom' ? [] : null };
    group.processes++; group.windows += batch.trackedOwners.window; group.documents += batch.trackedOwners.document;
    group.firstUnclearStates += Number(!batch.cleanupTrace[0].clear);
    group.requiredFinalClearStates += settings.requiredClearRounds;
    for (const endpoint of batch.cleanupTrace) {
      for (const [name, value] of Object.entries(endpoint.memory)) {
        assert.ok(Number.isFinite(value) && value >= 0);
        const range = group.memoryRangesBytes[name] ?? { min: value, max: value };
        range.min = Math.min(range.min, value); range.max = Math.max(range.max, value); group.memoryRangesBytes[name] = range;
      }
      if (group.nativeClassLiveValues) group.nativeClassLiveValues.push(endpoint.nativeTree.napiClasses.live);
    }
    totals.processes++; totals.spans += batch.sampleTimings.length;
    totals.warmupSpans += settings.warmupSamples; totals.measuredSpans += settings.measuredSamples;
    groups[key] = group;
  }
  for (const group of Object.values(groups)) {
    assert.equal(group.processes, settings.rows.length);
    for (const name of ['windows', 'documents', 'firstUnclearStates', 'requiredFinalClearStates']) totals[name] += group[name];
    if (group.nativeClassLiveValues) group.nativeClassLiveValues = [...new Set(group.nativeClassLiveValues)];
  }
  return { verified: true, functionalOnly: true, samplerInvoked: true, performanceAccepted: null, gateReevaluated: false,
    totals, groups, limits: ['Calificación funcional: un seed y una posición, sin estimación ni decisión de rendimiento',
      'Observaciones finitas tras GC; no miden memoria pico ni prueban ausencia universal de fugas',
      'Los métodos comparten identidad; no demuestra estabilidad de JIT ni mejora de rendimiento'] };
}
if (require.main === module) {
  assert.equal(process.argv.length, 4, 'Provide qualification directory and new replay output');
  const result = verify(process.argv[2]);
  fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ verified: true, totals: result.totals, performanceAccepted: null }));
}
module.exports = { verify, inside };
