/** @file Verifies the complete prospective control agenda without invoking a DOM or profiler. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { plan } = require('./model.cjs');
const policy = require('./constants/protocol.json');
const original = require('../range-collapse-study/model.cjs');

test('La agenda incluye 256 controles AA y todos los grupos de Node/modo/motor/label/posición', () => {
  const inputs = plan();
  assert.equal(inputs.length, 256);
  assert.deepEqual(new Set(inputs.map((input) => input.node)), new Set(['v22.12.0', 'v24.14.1']));
  for (const node of policy.nodeVersions) for (const mode of policy.modes) {
    const current = inputs.filter((input) => input.node === node && input.mode === mode);
    assert.equal(current.length, 64);
    assert.deepEqual(current.map(({ node, mode, ...input }) => input),
      original.plan().filter((input) => input.phase === 'AA' && input.rowIndex === 4));
    for (let position = 0; position < original.settings.workerCount; position++) {
      assert.deepEqual(new Set(current.filter((input) => input.position === position).map((input) => `${input.engine}/${input.label}`)),
        new Set(['jsdom/A', 'jsdom/B', 'rustdom/A', 'rustdom/B']));
    }
  }
});

test('Cada par original conserva adyacencia y orden, sin otra fila o fase', () => {
  const inputs = plan();
  for (let index = 0; index < inputs.length; index += 2) {
    const pair = inputs.slice(index, index + 2);
    for (const name of ['node', 'mode', 'phase', 'engine', 'position', 'rowIndex']) assert.equal(pair[0][name], pair[1][name]);
    assert.equal(pair[0].phase, 'AA'); assert.equal(pair[0].rowIndex, 4);
    assert.deepEqual(pair.map((input) => input.label), pair[0].position & 1 ? ['B', 'A'] : ['A', 'B']);
  }
});

test('La capacidad implementada conserva el carácter diagnóstico y los presupuestos', () => {
  assert.equal(policy.captureImplemented, true);
  assert.equal(policy.diagnosticOnly, true);
  assert.equal(policy.performanceAccepted, null); assert.equal(policy.gateReevaluated, false);
  assert.deepEqual(policy.plannedTotals, { processes: 256, warmupSpans: 768, measuredSpans: 2304,
    windows: 3072, documents: 3072, finalClearStates: 512, cpuProfiles: 128, jitLogs: 128 });
  assert.equal(policy.workerTimeoutMs, 180000); assert.equal(policy.captureBudgetMs, 3300000);
});

test('La fuente A histórica coincide pero conserva Git desconocido y otro binario/candidato', () => {
  const metadata = require('../profiles/v2/index.json');
  const identity = require('../range-collapse-study/constants/identity.json');
  assert.equal(metadata.sources.A.sourceHash, identity.inputs.sources.A);
  assert.equal(metadata.sources.A.sourceCommit, null);
  assert.equal(metadata.sources.A.sourceGitErrors.length, 2);
  assert.notEqual(metadata.sources.B.sourceHash, identity.inputs.sources.B);
  assert.notEqual(metadata.binaries.B, identity.binarySha256);
  assert.equal(metadata.originalWorkerSha256, '444320a7865b37955646b3f11b0fbf106b353e08dcbfe687e597d455ab44fb3c');
});

test('Las referencias diagnósticas completas mantienen sus hashes publicados', () => {
  const { createHash } = require('node:crypto');
  const provenance = require('./constants/provenance.json');
  const repository = path.resolve(__dirname, '../../../..');
  for (const [name, expected] of Object.entries(provenance.references)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(repository, name))).digest('hex'), expected);
  }
  assert.equal(provenance.newMeasurementExecuted, false);
  assert.equal(provenance.causalityEstablished, false);
});
