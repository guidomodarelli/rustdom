/** @module range-telemetry-observations Validates genuine process provenance before reading shared CPU/GC/JIT evidence. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { policy, read, hash, createModel } = require('./context.cjs');
const { annotate } = require('../native-mutation-telemetry/worker.cjs');
const { analyzeProcess } = require('../native-mutation-telemetry/analyze.cjs');
const { validateObservations } = require('../range-collapse-study/results.cjs');

/** @param {string} directory - Authenticated real process data. @param {object} identity - Actual report/telemetry revisions. @returns {object} Shared reader output with its original reader identity unchanged. */
function analyzeEvidence(directory, identity) { return analyzeProcess(directory, identity); }

/** @param {string} directory - Saved worker output. @param {object} manifest - Verified package identity. @param {object} input - Fixed plan entry. @param {object} observed - Actual child result. @param {string} derivationSha256 - Registered derived receipt. @param {object} context - Capture identity. @returns {object} Observed diagnostics, never acceptance or fabricated measurement identity. */
function validateProcess(directory, manifest, input, observed, derivationSha256, context) {
  const { model } = createModel();
  const report = read(path.join(directory, policy.paths.report));
  const raw = read(path.join(directory, policy.paths.rawReport));
  const telemetry = read(path.join(directory, policy.paths.telemetry));
  for (const [name, expected] of Object.entries({ revision: policy.revision, purpose: policy.purpose, diagnosticOnly: true,
    accepted: null, gateReevaluated: false, complete: true, mode: input.mode, engine: input.engine,
    pid: observed.pid, node: input.node, derivationSha256, hostedRunId: context.hostedRunId, runAttempt: 1, sourceCommit: context.sourceCommit })) {
    assert.deepEqual(telemetry[name], expected, name);
  }
  assert.equal(telemetry.failures, undefined); assert.equal(telemetry.observerDisconnected, true);
  assert.deepEqual([telemetry.start?.filename, telemetry.end?.filename], policy.clockNames);
  for (const name of ['connected', 'started', 'stopped', 'disabled']) assert.equal(telemetry.profiler[name], input.mode === policy.cpuMode);
  assert.equal(telemetry.profiler.disconnected, true);
  const sourceReportSha256 = hash(path.join(directory, policy.paths.rawReport));
  assert.equal(telemetry.sourceReportSha256, sourceReportSha256);
  assert.equal(telemetry.sourceSamplerRevision, policy.samplerRevision);
  assert.deepEqual(report, annotate(raw, policy, sourceReportSha256, telemetry.integration));
  const flags = require('../current-ownership-worker.cjs').workerArguments(input.position);
  assert.deepEqual(raw.execArgv, [...flags, ...policy.nodeFlagsByMode[input.mode]]);
  model.validateWorker({ ...raw, execArgv: flags }, manifest, { ...input, pid: observed.pid, node: input.node });
  assert.equal(raw.rowIndex, policy.rowIndex); assert.equal(raw.phase, policy.phase);
  validateObservations(report); assert.deepEqual(telemetry.integration, report.integration);
  const analysis = analyzeEvidence(directory, { engine: input.engine, reportRevision: policy.revision, telemetryRevision: policy.revision });
  return { ...analysis, analysisReaderRevision: analysis.revision, revision: policy.revision, startupRandomProbe: [...raw.randomProbe] };
}

/** @param {object[]} entries - All observed startup RNG prefixes. @returns {void} Compare every complete group, keeping modes/Nodes separate. */
function validateSeedGroups(entries) {
  const { plan } = require('./model.cjs');
  assert.deepEqual(entries.map(({ probe, ...input }) => input), plan());
  const { validateProbeGroup } = require('../native-mutation-telemetry/run.cjs');
  const { settings } = createModel();
  for (const node of policy.nodeVersions) for (const mode of policy.modes) for (let position = 0; position < settings.workerCount; position++) {
    validateProbeGroup(entries.filter((entry) => entry.node === node && entry.mode === mode && entry.position === position));
  }
}
module.exports = { analyzeEvidence, validateProcess, validateSeedGroups };
