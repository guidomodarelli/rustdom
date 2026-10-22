/** @file Exercises native V8 tracing around all real ownership workloads and original cleanup. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/trace.json');
const { createTraceCommand } = require('./command.cjs');

const [diagnosticRoot, manifestPath, frozenNodeRoot, outputRoot] = process.argv.slice(2);
fs.mkdirSync(outputRoot);
const checks = [];
for (const engine of ['jsdom', 'rustdom']) {
  const directory = path.join(outputRoot, engine);
  fs.mkdirSync(directory);
  const output = path.join(directory, 'report.json');
  const tracePath = path.join(directory, 'trace.json');
  const command = createTraceCommand({ node: process.execPath, diagnosticRoot, manifestPath,
    directory, phase: 'AA', engine, label: 'A' });
  const result = spawnSync(command[0], command.slice(1), { encoding: 'utf8' });
  fs.writeFileSync(path.join(directory, 'stdout.log'), result.stdout ?? '');
  fs.writeFileSync(path.join(directory, 'stderr.log'), result.stderr ?? '');
  fs.writeFileSync(path.join(directory, 'process.json'), `${JSON.stringify({ command,
    exitCode: result.status }, null, 2)}\n`);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(output));
  const telemetry = JSON.parse(fs.readFileSync(`${output}.telemetry.json`));
  const trace = JSON.parse(fs.readFileSync(tracePath));
  const original = JSON.parse(fs.readFileSync(path.join(frozenNodeRoot, `AA-0-${engine}-A.json`)));
  assert.equal(report.complete, true);
  assert.equal(telemetry.complete, true);
  assert.equal(telemetry.accepted, null);
  assert.equal(report.batches.length, original.batches.length);
  const complete = trace.traceEvents.filter((event) => event.ph === 'X' && event.pid === report.pid);
  const compilation = complete.filter((event) => event.cat.split(',').includes(settings.categories[1]));
  assert.ok(compilation.length > 0, 'Compilation trace: no complete compiler-category events captured');
  assert.ok(compilation.some((event) => event.tid === report.pid), 'Compilation trace: main-thread events missing');
  const clock = telemetry.start;
  const offsetUs = (clock.beforeUs + clock.afterUs) / 2 - clock.performanceMs * 1000;
  let firstTraceUs = Infinity;
  let lastTraceUs = -Infinity;
  for (const event of complete) {
    firstTraceUs = Math.min(firstTraceUs, event.ts);
    lastTraceUs = Math.max(lastTraceUs, event.ts + event.dur);
  }
  for (const [index, batch] of report.batches.entries()) {
    const expected = original.batches[index];
    assert.equal(batch.name, expected.name);
    assert.equal(batch.size, expected.size);
    assert.equal(batch.outputHash, expected.outputHash);
    assert.equal(batch.sampleTimings.length, report.settings.warmupSamples + report.settings.measuredSamples);
    assert.deepEqual(batch.sampleTimings.slice(report.settings.warmupSamples).map((span) => span.durationMs), batch.samplesMs);
    for (const span of batch.sampleTimings) {
      assert.ok(firstTraceUs < span.startMs * 1000 + offsetUs);
      assert.ok(lastTraceUs > (span.startMs + span.durationMs) * 1000 + offsetUs);
    }
    assert.ok(batch.cleanupTrace.slice(-report.settings.requiredClearRounds).every((state) => state.clear));
    checks.push({ engine, row: `${batch.name}/${batch.size}`, publicOutputMatchesFrozen: true,
      checkedSpans: batch.sampleTimings.length, nativeTraceClockEnclosesSpans: true, finalEndpointsClear: true });
  }
  fs.writeFileSync(path.join(directory, 'trace-summary.json'), `${JSON.stringify({ node: report.node,
    revision: settings.revision, diagnosticOnly: true, gateReevaluated: false, nativeEvents: trace.traceEvents.length,
    completeCompilerCategoryEvents: compilation.length, mainCompilerCategoryEvents: compilation.filter((event) => event.tid === report.pid).length,
    backgroundCompilerCategoryEvents: compilation.filter((event) => event.tid !== report.pid).length,
    compilerEventNames: [...new Set(compilation.map((event) => event.name))].sort() }, null, 2)}\n`);
}
fs.writeFileSync(path.join(outputRoot, 'contracts.json'), `${JSON.stringify({ node: process.version,
  diagnosticOnly: true, gateReevaluated: false, checks }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ node: process.version, workloadChecks: checks.length,
  spans: checks.reduce((total, check) => total + check.checkedSpans, 0) })}\n`);
