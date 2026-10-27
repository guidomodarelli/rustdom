/** @module range-telemetry-capture Executes one predeclared hosted sequence only after every readiness guard. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const context = require('./context.cjs');
const { policy, repository, read, hash, write } = context;
const { plan } = require('./model.cjs');
const { verifyDerived } = require('./derived.cjs');
const { validateProcess, validateSeedGroups } = require('./observations.cjs');
const { readReadiness, validateActivation } = require('./readiness.cjs');
const { execute } = require('../jsdom-telemetry/run.cjs');
const { commandFor } = require('./commands.cjs');

/** @param {string} sourceCommit - Exact actual source. @returns {object} Hosted event after capability and context checks, before any API or profiler. */
function captureContext(sourceCommit) {
  assert.equal(policy.captureImplemented, true, 'Range telemetry: full capture is not implemented/enabled');
  assert.deepEqual(new Set(policy.workflowSources), new Set([policy.workflow, policy.contractsWorkflow]), 'Range telemetry: workflow graph is incomplete');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Range telemetry: capture requires the declared hosted runner');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Range telemetry: no repeated attempt');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.apiRepository);
  assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName);
  assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/);
  assert.equal(process.env.NATIVE_TELEMETRY_SOURCE_COMMIT, sourceCommit);
  context.requireRuntime(); context.requireClean(sourceCommit);
  const event = read(process.env.GITHUB_EVENT_PATH);
  assert.equal(event.action, 'labeled'); assert.equal(event.label.name, policy.label);
  assert.equal(event.pull_request.number, policy.pullRequestNumber); assert.equal(event.pull_request.head.sha, sourceCommit);
  return event;
}

/** @param {string} filename - Fresh run-scoped guard. @param {object} receipt - Actual hosted identity. @returns {void} An uncertain failure is never retried at another output path. */
function consume(filename, receipt) {
  const descriptor = fs.openSync(filename, 'wx');
  try { fs.writeFileSync(descriptor, JSON.stringify(receipt, null, 2) + '\n'); }
  finally { fs.closeSync(descriptor); }
}

/** @param {number} nowMs - Observed monotonic time. @param {number} deadlineMs - Fixed capture deadline. @param {number} [reserveMs=0] - Complete next-worker allowance. @returns {void} A budget boundary never authorizes more work. */
function requireBudget(nowMs, deadlineMs, reserveMs = 0) {
  assert.ok(Number.isFinite(nowMs) && Number.isFinite(deadlineMs) && Number.isFinite(reserveMs) && reserveMs >= 0);
  assert.ok(nowMs + reserveMs < deadlineMs, 'Range telemetry: capture budget exhausted; preserve the prefix');
}

/** @param {string} preparation - Immutable exact compiled packages. @param {string} output - New disjoint output. @param {string} sourceCommit - Exact source. @param {string[]} nodes - Two pinned executables in fixed order. @returns {object} Complete diagnostic; every failure keeps the available prefix. */
function run(preparation, output, sourceCommit, nodes) {
  const event = captureContext(sourceCommit);
  const deadline = performance.now() + policy.captureBudgetMs;
  assert.equal(nodes.length, policy.nodeVersions.length);
  const reviewed = context.publication(); const checked = context.preflight(preparation);
  const runtimes = require('../shared-fixture-study/study.cjs').runtimeIdentities(nodes);
  assert.deepEqual(runtimes.map((entry) => entry.node), policy.nodeVersions);
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  for (const input of [repository, preparation]) {
    const root = fs.realpathSync(input);
    assert.ok(root !== output && !root.startsWith(output + path.sep) && !output.startsWith(root + path.sep), 'Range telemetry: output must be disjoint');
  }
  assert.equal(fs.existsSync(output), false);
  const executionReceipt = { revision: policy.revision, hostedRunId: process.env.GITHUB_RUN_ID, runAttempt: 1, sourceCommit, startedAt: new Date().toISOString() };
  const sentinel = path.join(fs.realpathSync(process.env.RUNNER_TEMP), policy.paths.executionGuardPrefix + process.env.GITHUB_RUN_ID + '.json');
  consume(sentinel, executionReceipt);
  fs.mkdirSync(output);
  const index = { revision: policy.revision, purpose: policy.purpose, diagnosticOnly: true, performanceAccepted: null, gateReevaluated: false,
    complete: false, captureRoot: output, sourceCommit, hostedRunId: process.env.GITHUB_RUN_ID, runAttempt: 1, executionReceipt,
    sourceFiles: checked.files, harness: checked.harness, manifest: checked.manifest, runtimes, derivationSha256: {},
    startedAt: executionReceipt.startedAt, machine: { cpus: os.cpus(), platform: os.platform(), release: os.release(), totalMemory: os.totalmem() }, processes: [], parentMemory: [] };
  const save = () => write(path.join(output, policy.paths.index), index);
  const sourceManifest = { commit: sourceCommit, harnessSha256: checked.harness.sha256, files: checked.harness.files };
  try {
    save(); write(path.join(output, policy.paths.executionReceipt), executionReceipt);
    const readiness = readReadiness(event); write(path.join(output, policy.paths.activation), readiness);
    validateActivation(readiness, sourceCommit); assert.equal(String(readiness.run.id), index.hostedRunId);
    for (const [name, expected] of Object.entries(checked.files)) {
      const filename = path.join(output, policy.paths.method, name); fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.copyFileSync(path.join(repository, name), filename); assert.equal(hash(filename), expected);
    }
    write(path.join(output, policy.paths.publication), reviewed);
    write(path.join(output, policy.paths.manifest), checked.manifest);
    write(path.join(output, policy.paths.sourceManifest), sourceManifest);
    for (const mode of policy.modes) {
      const root = path.join(output, policy.paths.derivedPrefix + mode);
      const result = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), repository, path.join(output, policy.paths.sourceManifest), root, mode],
        { encoding: 'utf8', maxBuffer: policy.metadataOutputLimitBytes, timeout: policy.derivationTimeoutMs });
      fs.writeFileSync(path.join(output, `derive-${mode}.stdout.log`), result.stdout ?? '');
      fs.writeFileSync(path.join(output, `derive-${mode}.stderr.log`), result.stderr ?? '');
      assert.equal(result.status, 0, result.stderr ?? result.error?.message);
      verifyDerived(root, mode, sourceManifest, hash(path.join(output, policy.paths.sourceManifest)));
      index.derivationSha256[mode] = hash(path.join(root, policy.paths.preparation)); save();
    }
    const unchanged = () => {
      context.requireClean(sourceCommit); assert.deepEqual(context.sourceFiles(), checked.files);
      assert.deepEqual(require('../current-ownership-experiment.cjs').captureHarness(), checked.harness);
      assert.deepEqual(require('../range-collapse-study/preparation.cjs').createManifest(preparation), checked.manifest);
      for (const runtime of runtimes) assert.equal(hash(runtime.executable), runtime.sha256);
      for (const mode of policy.modes) {
        const root = path.join(output, policy.paths.derivedPrefix + mode);
        assert.equal(hash(path.join(root, policy.paths.preparation)), index.derivationSha256[mode]);
        verifyDerived(root, mode, sourceManifest, hash(path.join(output, policy.paths.sourceManifest)));
      }
    };
    unchanged(); index.parentMemory.push({ stage: policy.stages.beforeWorkers, state: process.memoryUsage() }); save();
    const probes = []; const inputs = plan();
    for (const runtime of runtimes) {
      for (const [ordinal, input] of inputs.entries()) {
        if (input.node !== runtime.node) continue;
        requireBudget(performance.now(), deadline, policy.workerTimeoutMs);
        const command = commandFor(input, ordinal, output, runtime);
        execute([command], index, output, (entry) => {
          const analysis = validateProcess(entry.directory, index.manifest, input, entry, index.derivationSha256[input.mode], index);
          write(path.join(entry.directory, policy.paths.analysis), analysis);
          probes.push({ ...input, probe: analysis.startupRandomProbe });
        });
        requireBudget(performance.now(), deadline);
      }
      unchanged(); index.parentMemory.push({ stage: policy.stages.afterNodePrefix + runtime.node, state: process.memoryUsage() }); save();
    }
    validateSeedGroups(probes); index.complete = true; index.finishedAt = new Date().toISOString(); save();
    const verified = require('./replay.cjs').verify(output);
    requireBudget(performance.now(), deadline);
    return verified;
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { index.finishedAt = new Date().toISOString(); save(); }
}
module.exports = { captureContext, consume, requireBudget, run };
