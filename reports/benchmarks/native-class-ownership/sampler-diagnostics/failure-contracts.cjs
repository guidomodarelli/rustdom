/** @file Requires failed diagnostic processes to retain errors and preserve prior telemetry. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const [diagnosticRoot, manifestPath, outputRoot] = process.argv.slice(2);
fs.mkdirSync(outputRoot);
const output = path.join(outputRoot, 'invalid-engine.json');
const telemetryPath = `${output}.telemetry.json`;
const args = ['--expose-gc', path.join(diagnosticRoot, 'worker.cjs'), manifestPath,
  'AA', 'unsupported-engine', '0', 'A', output];
const failed = spawnSync(process.execPath, args, { encoding: 'utf8' });
fs.writeFileSync(path.join(outputRoot, 'failed.stdout.log'), failed.stdout ?? '');
fs.writeFileSync(path.join(outputRoot, 'failed.stderr.log'), failed.stderr ?? '');
assert.equal(failed.status, 2);
const originalBytes = fs.readFileSync(telemetryPath);
const telemetry = JSON.parse(originalBytes);
assert.equal(telemetry.complete, false);
assert.equal(telemetry.accepted, null);
assert.equal(telemetry.gateReevaluated, false);
assert.equal(typeof telemetry.failure.message, 'string');
assert.ok(telemetry.failure.message.length > 0);
assert.ok(telemetry.failure.stack.includes(telemetry.failure.message));
assert.ok(telemetry.end.performanceMs >= telemetry.start.performanceMs);
const repeated = spawnSync(process.execPath, args, { encoding: 'utf8' });
fs.writeFileSync(path.join(outputRoot, 'existing.stdout.log'), repeated.stdout ?? '');
fs.writeFileSync(path.join(outputRoot, 'existing.stderr.log'), repeated.stderr ?? '');
assert.equal(repeated.status, 2);
assert.deepEqual(fs.readFileSync(telemetryPath), originalBytes);
const probe = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'error-gc-probe.cjs'),
  diagnosticRoot, manifestPath, path.join(outputRoot, 'queued-gc.json')], { encoding: 'utf8' });
fs.writeFileSync(path.join(outputRoot, 'probe.stdout.log'), probe.stdout ?? '');
fs.writeFileSync(path.join(outputRoot, 'probe.stderr.log'), probe.stderr ?? '');
assert.equal(probe.status, 0, probe.stderr);
fs.writeFileSync(path.join(outputRoot, 'contracts.json'), `${JSON.stringify({ node: process.version,
  passed: 3, failureRetained: true, existingTelemetryPreserved: true, pendingGcRetained: true }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ node: process.version, passed: 3 })}\n`);
