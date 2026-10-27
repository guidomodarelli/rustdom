/** @module ownership-confirmation-planning-contracts Exercises real published pilot inputs and fail-closed CLI behavior without DOM. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { plan, runtimeForecast } = require('./plan.cjs');

const inputs = path.join(__dirname, 'planning-inputs');

test('plans all 32 real jsdom criteria without promoting the pilot or inferring Rust variance', () => {
  const result = plan(inputs);
  assert.equal(result.executionReady, false); assert.equal(result.scientificCaptureExecuted, false);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  assert.equal(result.rustVarianceEstimated, false); assert.equal(result.scenarios.length, 32);
  assert.equal(result.timing.feasible, true); assert.equal(result.rejectedAlternative.feasible, false);
  assert.equal(result.rejectedAlternative.forecasts.rustdom.projectedMinutes, 628);
  assert.equal(result.timing.forecasts.rustdom.projectedMinutes, 314);
  assert.equal(result.timing.forecasts.rustdom.observedPilotMinutesPerBlock, null);
  assert.equal(result.timing.reservedMinutes, 30);
  assert.ok(Math.abs(result.timing.forecasts.jsdom.projectedMinutes - 273.6982522504583) < 1e-9);
  assert.ok(result.scenarios.every((entry) => entry.performanceAccepted === null && entry.futurePassPredicted === false));
});

test('runtime forecast rejects invalid plans and shows that doubling Rust does not fit this capture budget', () => {
  assert.throws(() => runtimeForecast(NaN)); assert.throws(() => runtimeForecast(0));
  assert.throws(() => runtimeForecast(100, { jsdom: 31.5, rustdom: 16 }));
  assert.equal(runtimeForecast(100, { jsdom: 32, rustdom: 32 }).feasible, false);
  assert.equal(runtimeForecast(200).feasible, false);
});

test('actual CLI returns the plan and rejects changed input bytes before any result', (context) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-confirmation-contract-'));
  context.after(() => fs.rmSync(temporary, { recursive: true }));
  const cli = path.join(__dirname, 'plan.cjs');
  const accepted = spawnSync(process.execPath, [cli, inputs], { encoding: 'utf8' });
  assert.equal(accepted.status, 0); assert.equal(accepted.stderr, '');
  assert.deepEqual(JSON.parse(accepted.stdout), plan(inputs));
  for (const filename of ['analysis.json', 'resource-endpoints.json']) fs.copyFileSync(path.join(inputs, filename), path.join(temporary, filename));
  fs.appendFileSync(path.join(temporary, 'analysis.json'), '\n');
  const rejected = spawnSync(process.execPath, [cli, temporary], { encoding: 'utf8' });
  assert.equal(rejected.status, 1); assert.equal(rejected.stdout, '');
  assert.match(JSON.parse(rejected.stderr).message, /published input digest changed/);
  const missing = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(missing.status, 1); assert.equal(missing.stdout, '');
  assert.match(JSON.parse(missing.stderr).message, /provide the planning-input directory/);
});
