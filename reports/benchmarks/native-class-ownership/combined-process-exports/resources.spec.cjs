/** @module combined-resource-contracts Exercises real saved qualification data, native release observations and kernel-enforced write failures without mocks or new DOM measurement. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { helpers, exportResources, prepareInput } = require('./resources.cjs');
const { read } = require('../combined-process-study/processes.cjs');
const policy = require('../combined-process-study/constants/protocol.json');
const config = require('./constants/exports.json');
const contracts = require('./constants/contracts.json');

/** @param {string} root - Fresh test root. @returns {string} Actual authenticated 64-process data at a new location. */
function materialize(root) {
  const destination = path.join(root, 'data');
  const child = spawnSync('python3', ['-B', path.join(__dirname, '../combined-process-study/materialize-functional.py'), destination],
    { encoding: 'utf8', timeout: policy.preparationTimeoutMs });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  return destination;
}

test('exports every real functional span, separate Window/Document counts and complete native families without accepting performance', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-resource-data-'));
  try {
    const directory = materialize(temporary); const output = path.join(temporary, 'export');
    const result = exportResources(directory, output, true);
    assert.equal(result.functionalOnly, true); assert.equal(result.captureAuthenticated, false);
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
    assert.equal(result.analyzerExecutedDOM, false); assert.equal(result.newMeasurements, 0);
    assert.equal(result.totals.processes, 64); assert.equal(result.totals.windows, 768); assert.equal(result.totals.documents, 768);
    assert.equal(result.totals.warmupSpans, 192); assert.equal(result.totals.measuredSpans, 576);
    assert.equal(result.totals.requiredFinalClearStates, 128); assert.equal(result.totals.firstUnclearStates, 8);
    assert.equal(result.byRow.length, 8); assert.equal(result.parentSnapshots.length, 3);
    const rows = fs.readFileSync(path.join(output, config.files.resources), 'utf8').trimEnd().split('\n').map((line) => JSON.parse(line));
    assert.equal(rows.length, 64);
    for (const row of rows) {
      const target = path.join(directory, row.node === 'v22.12.0' ? 'node22' : 'node24', String(row.ordinal % 32).padStart(4, '0'), 'report.json');
      const report = read(target); const batch = report.batches[0];
      assert.deepEqual(row.nativeBaseline, report.nativeBaseline); assert.deepEqual(row.trackedOwners, batch.trackedOwners);
      assert.deepEqual(row.memoryAfterCleanup, batch.memoryAfterCleanup); assert.deepEqual(row.cleanupTrace, batch.cleanupTrace);
      assert.equal(row.rowIndex, report.rowIndex); assert.equal(row.physical, report.schedule.physical); assert.equal(row.rows, batch.rows);
    }
    assert.equal(fs.readFileSync(path.join(output, config.files.spans), 'utf8').trimEnd().split('\n').length, 769);
    assert.throws(() => exportResources(directory, output, true), /preserve existing output/);
  } finally { fs.rmSync(temporary, { recursive: true }); }
});

test('retained Document or changed native baseline cannot be described as a released worker', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-resource-release-'));
  try {
    const directory = materialize(temporary); const index = read(path.join(directory, 'index.json'));
    const ordinal = index.processes.findIndex((entry) => entry.input.engine === 'rustdom');
    const report = read(path.join(directory, 'node22', String(ordinal).padStart(4, '0'), 'report.json'));
    const { summarizeWorker } = helpers(); summarizeWorker(report);
    const retained = structuredClone(report); retained.batches[0].cleanupTrace.at(-1).survivors.document = 1;
    assert.throws(() => summarizeWorker(retained));
    const baseline = structuredClone(report); baseline.nativeBaseline.napiClasses.live++;
    assert.throws(() => summarizeWorker(baseline));
    assert.throws(() => exportResources(directory, path.join(directory, 'export'), true), /preserve sources and input/);
    const alias = path.join(temporary, 'input-alias'); fs.symlinkSync(directory, alias, 'dir');
    assert.throws(() => exportResources(directory, path.join(alias, 'export'), true), /preserve sources and input/);
    assert.equal(fs.existsSync(path.join(directory, 'export')), false);
    assert.throws(() => exportResources(directory, path.join(temporary, 'scientific'), false));
    assert.equal(fs.existsSync(path.join(temporary, 'scientific')), false);
    const changedSpan = structuredClone(report); changedSpan.batches[0].samplesMs[0] *= 2;
    changedSpan.batches[0].sampleTimings[policy.warmupSpansPerProcess].durationMs = changedSpan.batches[0].samplesMs[0];
    fs.writeFileSync(path.join(directory, 'node22', String(ordinal).padStart(4, '0'), 'report.json'), JSON.stringify(changedSpan));
    assert.throws(() => exportResources(directory, path.join(temporary, 'changed-spans'), true));
    assert.equal(fs.existsSync(path.join(temporary, 'changed-spans')), false);
  } finally { fs.rmSync(temporary, { recursive: true }); }
});

test('real kernel file-size limits preserve partial output and close both writers across repeated errors', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-resource-errors-'));
  try {
    const directory = materialize(temporary);
    const childScript = path.join(temporary, 'limited.cjs');
    fs.writeFileSync(childScript, `const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path');
const {exportResources,prepareInput}=require(${JSON.stringify(path.join(__dirname, 'resources.cjs'))});
const input=${JSON.stringify(directory)}; const root=${JSON.stringify(temporary)}; prepareInput(input,true);
const before=fs.readdirSync('/proc/self/fd').length; let failures=0;
for(let index=0;index<${contracts.errorCycles};index++){ const destination=path.join(root,'limited-'+index);
try{exportResources(input,destination,true);throw new Error('Expected the real file limit to reject this write');}
catch(error){assert.equal(error.code,'EFBIG'); failures++; assert.ok(fs.existsSync(path.join(destination,'resources-native.jsonl')));}
assert.equal(fs.readdirSync('/proc/self/fd').length,before); }
console.log(JSON.stringify({failures,descriptorsBefore:before,descriptorsAfter:fs.readdirSync('/proc/self/fd').length,measurementProcesses:0}));\n`);
    const launcher = `import os,resource,signal,sys; resource.setrlimit(resource.RLIMIT_FSIZE,(${contracts.fileSizeLimitBytes},${contracts.fileSizeLimitBytes})); signal.signal(signal.SIGXFSZ,signal.SIG_IGN); os.execv(sys.argv[1],sys.argv[1:])`;
    const child = spawnSync('python3', ['-B', '-c', launcher, process.execPath, childScript],
      { encoding: 'utf8', timeout: policy.preparationTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout); assert.equal(result.failures, contracts.errorCycles);
    assert.equal(result.descriptorsBefore, result.descriptorsAfter); assert.equal(result.measurementProcesses, 0);
    console.log(JSON.stringify(result));
  } finally { fs.rmSync(temporary, { recursive: true }); }
});
