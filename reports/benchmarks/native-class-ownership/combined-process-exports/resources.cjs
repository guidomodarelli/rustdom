/** @module combined-resource-export Preserves every recorded span and native baseline with existing release predicates; never measures DOM, imports archived implementations or grants performance acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const config = require('./constants/exports.json');
const study = require('../combined-process-study/study.cjs');
const processes = require('../combined-process-study/processes.cjs');
const { hashFile } = require('../combined-process-study/io.cjs');
const policy = require('../combined-process-study/constants/protocol.json');
const qualified = require('../combined-process-study/constants/functional-qualification.json');
const fixture = require('../combined-process-study/fixtures/functional-worker.json');
const qualification = require('../combined-process-study/qualify.cjs');
const repository = path.resolve(__dirname, '../../../..');

/** @returns {object} Existing current-source resource helpers, authenticated before import; no legacy full-run decision is invoked. */
function helpers() {
  const publication = study.publication();
  assert.equal(hashFile(path.join(repository, config.referencePublication.path)), config.referencePublication.sha256);
  assert.equal(publication.methodFilesSha256, config.referencePublication.methodFilesSha256);
  for (const descriptor of Object.values(config.helpers)) assert.equal(hashFile(path.join(repository, descriptor.path)), descriptor.sha256);
  const { summarizeWorker } = require(path.join(repository, config.helpers.coldAnalyzer.path)).createAnalyzer(repository);
  const workers = require(path.join(repository, config.helpers.workers.path));
  const format = require(path.join(repository, config.helpers.format.path));
  const settings = require('../combined-process-study/model.cjs').settings;
  const originalSettings = require('../cold-cleanup-study/model.cjs').settings;
  for (const name of config.resourceSettingsFields) assert.deepEqual(settings[name], originalSettings[name]);
  return { summarizeWorker, workers, format, layout: require(path.join(repository, config.helpers.workerPolicy.path)),
    csvLine: require(path.join(repository, config.helpers.coldAnalyzer.path)).csvLine };
}

/** @param {string} directory - Actual data location. @param {boolean} functionalOnly - Only the pinned 64-process qualification, never a scientific substitution. @returns {object} Exact index and verified counts; full original paths/Git errors remain untouched. */
function prepareInput(directory, functionalOnly) {
  assert.equal(typeof functionalOnly, 'boolean'); assert.equal(process.platform, 'linux');
  assert.ok(policy.nodes.includes(process.version));
  assert.equal(study.hashExecutable(process.execPath), require('../constants/current-ownership.json').runtimeExecutableHashes[process.version]);
  const root = fs.realpathSync.native(directory); const indexBytes = processes.bytes(path.join(root, 'index.json'));
  const index = JSON.parse(indexBytes.toString('utf8')); const indexSha256 = createHash('sha256').update(indexBytes).digest('hex');
  if (!functionalOnly) {
    const verification = study.verify(root);
    assert.equal(processes.hash(path.join(root, 'index.json')), indexSha256);
    return { root, index, indexSha256, verification };
  }
  assert.equal(indexSha256, qualified.indexSha256);
  assert.equal(index.complete, true); assert.equal(index.functionalOnly, true); assert.equal(index.sourceCommit, qualified.sourceCommit);
  assert.equal(index.processes.length, policy.functionalQualification.processes);
  const observed = processes.scan(root, index, index.manifest, { inputs: qualification.plan(), originalRoot: fixture.evidenceDirectory,
    originalDerived: fixture.derivedDirectory, functionalOnly: true });
  study.verifyParent(index.parentMemory);
  return { root, index, indexSha256, verification: { verified: true, functionalOnly: true, sourceCommit: index.sourceCommit,
    processes: index.processes.length, measuredDurations: observed.measuredDurations, warmupDurations: observed.warmupDurations,
    windows: observed.windows, documents: observed.documents, captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false } };
}

/** @param {string} directory - Validated saved input. @param {string} destination - Fresh disjoint output. @param {boolean} functionalOnly - Explicit qualification-only contract mode. @returns {object} Observed finite resources and every favorable/unfavorable comparison, without acceptance. */
function exportResources(directory, destination, functionalOnly = false) {
  const root = fs.realpathSync.native(directory);
  destination = path.join(fs.realpathSync.native(path.dirname(path.resolve(destination))), path.basename(destination));
  for (const protectedRoot of [repository, root]) assert.ok(destination !== protectedRoot &&
    !destination.startsWith(protectedRoot + path.sep) && !protectedRoot.startsWith(destination + path.sep), 'Combined resource export: preserve sources and input data');
  assert.ok(!fs.existsSync(destination), 'Combined resource export: preserve existing output');
  const { index, indexSha256, verification } = prepareInput(root, functionalOnly);
  const { summarizeWorker, workers, format, layout, csvLine } = helpers();
  const spanColumns = [...format.spanColumns, ...config.additionalSpanColumns];
  const aggregate = workers.createAggregate(); const byRow = policy.rows.map(() => workers.createAggregate());
  fs.mkdirSync(destination);
  let spans; let resources;
  try {
    spans = fs.openSync(path.join(destination, config.files.spans), 'wx');
    resources = fs.openSync(path.join(destination, config.files.resources), 'wx');
    fs.writeFileSync(spans, csvLine(spanColumns));
    const processesPerRuntime = index.processes.length / policy.nodes.length;
    for (const [ordinal, entry] of index.processes.entries()) {
      const runtimeIndex = Math.floor(ordinal / processesPerRuntime); const ordinalWithinRuntime = ordinal % processesPerRuntime;
      const target = path.join(root, layout.workerDirectories[runtimeIndex], String(ordinalWithinRuntime).padStart(layout.workerOrdinalDigits, '0'));
      const bytes = processes.bytes(path.join(target, 'report.json'));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.files['report.json']);
      const report = JSON.parse(bytes.toString('utf8'));
      const resource = summarizeWorker(report); const batch = report.batches[0];
      workers.addWorker(aggregate, report, resource); workers.addWorker(byRow[report.rowIndex], report, resource);
      const identity = { ordinal, node: report.node, pid: report.pid, phase: report.phase, engine: report.engine,
        label: report.label, physical: report.schedule.physical, position: report.position, seed: report.v8Seed,
        rowIndex: report.rowIndex, name: batch.name, size: batch.size, rows: batch.rows };
      fs.writeFileSync(resources, JSON.stringify({ ...identity, nativeBaseline: report.nativeBaseline,
        trackedOwners: batch.trackedOwners, memoryAfterCleanup: batch.memoryAfterCleanup, cleanupTrace: batch.cleanupTrace }) + '\n');
      for (const row of workers.spanRows(report)) fs.writeFileSync(spans, csvLine(spanColumns.map((name) => name === 'rows' ? batch.rows : row[name])));
    }
  } finally {
    try { if (spans !== undefined) fs.closeSync(spans); }
    finally { if (resources !== undefined) fs.closeSync(resources); }
  }
  const { totals, groups } = workers.finishAggregate(aggregate);
  assert.equal(totals.processes, verification.processes); assert.equal(totals.measuredSpans, verification.measuredDurations);
  assert.equal(totals.warmupSpans, verification.warmupDurations); assert.equal(totals.windows, verification.windows);
  assert.equal(totals.documents, verification.documents); assert.equal(totals.requiredFinalClearStates, totals.processes * policy.requiredFinalClearStates);
  const result = { revision: config.revision, functionalOnly, purpose: index.purpose, sourceCommit: index.sourceCommit, indexSha256,
    readerNode: process.version, readerCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
    readerChangesRaw: execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repository, encoding: 'utf8' }),
    readerSha256: hashFile(__filename), readerConfigurationSha256: hashFile(path.join(__dirname, 'constants/exports.json')),
    readerExecutableSha256: require('../constants/current-ownership.json').runtimeExecutableHashes[process.version],
    referencePublication: config.referencePublication, sourceHelpers: config.helpers, verification, totals, groups,
    byRow: byRow.map((value, rowIndex) => ({ rowIndex, key: policy.rows[rowIndex], ...workers.finishAggregate(value) })),
    parentSnapshots: index.parentMemory, captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false,
    newMeasurements: 0, analyzerExecutedDOM: false, limits: config.limits };
  fs.writeFileSync(path.join(destination, config.files.summary), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 5, 'Combined resource export: provide --capture|--functional, input and fresh output');
    const [operation, directory, destination] = process.argv.slice(2);
    assert.ok(Object.values(config.operations).includes(operation));
    const result = exportResources(directory, destination, operation === config.operations.functional);
    console.log(JSON.stringify({ totals: result.totals, functionalOnly: result.functionalOnly,
      captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false }));
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { helpers, prepareInput, exportResources };
