/** @module confirmation-worker-engine Executes the new sealed Rust/jsdom functional treatments; scientific execution is not implemented. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { getHeapStatistics } = require('node:v8');
const { schedule } = require('./calendar.cjs');
const policy = require('./constants/worker.json');
const design = require('./constants/design.json');
const rawPolicy = require('../owner-batch-study/constants/worker.json');
const sampling = require('../owner-batch-study/constants/sampler.json');
const original = require('../combined-process-study/model.cjs');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const { schedule: pairSchedule, inspectDistributions } = require('../paired-main-worker.cjs');
const { fixture: fixtureHTML, loadRuntime } = require('../paired-worker.cjs');
const { configureAffinity, affinities } = require('../thread-worker.cjs');
const { createBatchSampler, failureView } = require('../owner-batch-study/batches.cjs');
const { readJSON } = require('../owner-batch-study/io.cjs');
const fixtures = require('../shared-fixture-candidate/fixtures.cjs');
const operations = require('../../../../benchmarks/ownership-operations.cjs');
const { warmOwnership } = require('../../../../benchmarks/ownership-warmup.cjs');
const { collectGarbage } = require('../../../../scripts/memory-endpoint.cjs');
const settings = { ...original.settings, revision: rawPolicy.revision, distributionHashes: policy.distributions };
const scheduler = createSinglePackageWorker(settings);
const sampler = createBatchSampler({ fixtureHTML, fixtures, operations, warmOwnership, collectGarbage });

/** @param {number} factor - Original fixed factor, never its rotated temporal slot. @returns {string[]} Unchanged V8 flags. */
function workerArguments(factor) { return scheduler.workerArguments(factor); }

/**
 * Produce one raw-format report and sidecar, preserving partials and original failures.
 * @param {string[]} args - Parent-authenticated manifest, exact planned-input JSON and new report output.
 * @param {'functional'} mode - Functional qualification only; scientific mode is rejected before file reads.
 * @param {function(object):void} [onProgress] - Caller-owned scalar observer; cannot receive a DOM reference.
 * @returns {Promise<object>} Tasks and resource endpoints; acceptance is always null.
 */
async function run(args, mode, onProgress = () => {}) {
  assert.equal(mode, 'functional', 'Confirmation worker: scientific producer is not implemented');
  const functionalOnly = true;
  assert.equal(args.length, 3, 'Confirmation functional worker: provide manifest, input and new report');
  assert.equal(process.platform, 'linux', 'Confirmation functional worker: Linux affinity evidence required');
  assert.equal(typeof global.gc, 'function', 'Confirmation functional worker: use --expose-gc');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false); assert.equal(typeof onProgress, 'function');
  const [manifestPath, inputPath, outputText] = args;
  const manifest = readJSON(manifestPath); const input = readJSON(inputPath);
  assert.equal(input.node, process.version);
  const shard = schedule([input.node, input.phase, input.engine, input.row].join('/'));
  assert.ok(Number.isSafeInteger(input.ordinal));
  assert.deepEqual(input, shard.processes[input.ordinal], 'Confirmation functional worker: changed calendar tuple');
  assert.deepEqual(process.execArgv, workerArguments(input.factor), 'Confirmation functional worker: changed startup flags');
  assert.equal(manifest.numericPackageVerifiedByParent, true); assert.equal(manifest.selectedArtifactId, policy.selectedArtifactId);
  assert.equal(manifest.nativeBinarySha256, policy.nativeBinarySha256); assert.equal(manifest.archiveSha256, policy.archiveSha256);
  assert.equal(manifest.functionalOnly, functionalOnly, 'Confirmation worker: package manifest role differs from invocation');
  const output = path.join(fs.realpathSync(path.dirname(path.resolve(outputText))), path.basename(outputText));
  const sourceRoot = path.resolve(__dirname, '../../../..');
  for (const protectedRoot of [sourceRoot, manifest.packageRoot, ...Object.values(manifest.copies)]) {
    const root = fs.realpathSync(protectedRoot);
    assert.ok(output !== root && !output.startsWith(root + path.sep), 'Confirmation functional worker: output must be outside source/packages');
  }
  const contextPath = output + '.context.json';
  assert.equal(fs.existsSync(output), false); assert.equal(fs.existsSync(contextPath), false);
  const plan = scheduler.schedule(manifest, input.phase, input.engine, input.factor, input.label, input.rowIndex);
  const report = { revision: rawPolicy.revision, complete: false, functionalOnly,
    purpose: functionalOnly ? rawPolicy.purpose : sampling.purposes.capture,
    performanceStudyExecuted: !functionalOnly, performanceAccepted: null, gateReevaluated: false,
    phase: input.phase, engine: input.engine, position: input.factor, label: input.label, rowIndex: input.rowIndex,
    key: input.row, schedule: plan, pid: process.pid, node: process.version, v8: process.versions.v8,
    execArgv: process.execArgv, heapLimitBytes: getHeapStatistics().heap_size_limit,
    v8Seed: settings.v8Seeds[input.factor], randomProbe: Array.from({ length: settings.v8SeedProbeSamples }, () => Math.random()),
    sampling: { tasksPerBlock: sampling.logicalTasksPerBlock, warmupBlocks: sampling.warmupBlocksPerProcess,
      measuredBlocks: sampling.measuredBlocksPerProcess, withinRealmWarmupRounds: sampling.withinRealmWarmupRounds }, blocks: [] };
  const workerFile = path.join(__dirname, 'worker.cjs');
  const context = { workerRevision: policy.revision, methodRevision: design.revision, rawPayloadContractRevision: rawPolicy.revision,
    workerSourceSha256: createHash('sha256').update(fs.readFileSync(workerFile)).digest('hex'),
    workerEngineSourceSha256: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    complete: false, mode, plannedInput: input, pid: process.pid, parentPid: process.ppid,
    node: process.version, numericPackageArtifactId: policy.selectedArtifactId,
    packageAuthenticationPerformedHere: false, producerSourceAuthenticationPerformedHere: false,
    scientificCaptureExecuted: !functionalOnly, analysisObservation: null, performanceAccepted: null, gateReevaluated: false };
  function write(filename, value, flag) {
    const raw = JSON.stringify(value, null, 2) + '\n';
    assert.ok(Buffer.byteLength(raw) <= policy.maximumReportBytes, 'Confirmation functional worker: report exceeds bound');
    fs.writeFileSync(filename, raw, { flag });
  }
  write(output, report, 'wx'); write(contextPath, context, 'wx');
  const save = () => { write(output, report, 'w'); write(contextPath, context, 'w'); };
  const owners = { window: [], document: [] };
  let runtime; let failed = false; let originalFailure;
  const loaded = () => {
    const packages = scheduler.loadedPackages(manifest);
    for (const [physical, filenames] of Object.entries(packages)) assert.equal(filenames.length > 0, physical === plan.physical);
    return packages;
  };
  try {
    const pair = pairSchedule(manifest, input.phase, input.engine, input.factor, settings);
    report.distributionsBefore = inspectDistributions(manifest, pair, input.engine, settings); save();
    report.affinity = await configureAffinity('main');
    assert.ok(Object.values(scheduler.loadedPackages(manifest)).every((filenames) => filenames.length === 0));
    if (plan.physical === 'B') assert.equal(createHash('sha256').update(fs.readFileSync(path.join(plan.root, 'dist/rustdom.node'))).digest('hex'),
      policy.nativeBinarySha256, 'Confirmation worker: changed sealed native binary');
    runtime = loadRuntime(plan.root, input.engine);
    if (input.engine === 'jsdom') { assert.equal(runtime.native, null); assert.equal(runtime.api.getNativeTreeStatistics, undefined); }
    else { assert.ok(runtime.native); assert.equal(typeof runtime.api.getNativeTreeStatistics, 'function'); }
    report.loadedBefore = loaded();
    for (let round = 0; round < settings.cleanupRounds; round += 1) await collectGarbage();
    report.nativeBaseline = runtime.api.getNativeTreeStatistics?.() ?? null; save();
    report.measurement = await sampler.measureRow({ runtime, engine: input.engine, key: input.row, owners,
      purpose: functionalOnly ? sampling.purposes.functional : sampling.purposes.capture, onProgress: (block) => {
        if (!report.blocks.includes(block)) report.blocks.push(block);
        save(); onProgress({ blockIndex: block.blockIndex, complete: block.complete, tasks: block.tasks.length });
      } });
    report.loadedAfter = loaded();
    report.distributionsAfter = inspectDistributions(manifest, pair, input.engine, settings);
    report.affinitiesAfter = affinities();
    assert.equal(report.affinitiesAfter.find((entry) => entry.tid === process.pid).mask, String(settings.cpu));
    assert.ok(report.affinitiesAfter.some((entry) => entry.tid !== process.pid && !entry.disappeared && entry.mask !== String(settings.cpu)));
  } catch (error) { failed = true; originalFailure = error; report.failure = failureView(error); }
  finally {
    report.trackedOwners = { window: owners.window.length, document: owners.document.length };
    if (runtime) {
      try {
        report.cleanupTrace = await scheduler.observeCleanup(owners, runtime, report.nativeBaseline ?? undefined);
        for (const endpoint of report.cleanupTrace.slice(-sampling.requiredFinalClearStates)) assert.equal(endpoint.clear, true, 'Confirmation functional worker: retained Window/Document');
      } catch (error) {
        report.cleanupFailure = failureView(error);
        if (!failed) { failed = true; originalFailure = error; }
      }
    }
    report.complete = !failed; context.complete = !failed;
    save();
  }
  if (failed) throw originalFailure;
  return report;
}

module.exports = { workerArguments, run };
