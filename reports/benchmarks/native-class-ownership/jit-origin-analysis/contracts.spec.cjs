/** @file Behavioral checks against the complete, already captured native logger data. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { analyze, readFunctionRecords, originFor } = require('./function-origins.cjs');
const root = process.env.RUSTDOM_JSDOM_TELEMETRY_ROOT;
assert.ok(root, 'Provide the extracted original diagnostic');
const result = analyze(root);
const source = result.processes[0];
const directory = path.join(root, 'capture', source.directory);
const lines = fs.readFileSync(path.join(directory, 'v8.log'), 'utf8').split('\n');

test('every real function record and original timed function emission is preserved independently of its source', () => {
  assert.equal(result.processes.length, 32); assert.equal(result.accepted, null); assert.equal(result.samplerExecuted, false);
  let records = 0; let spans = 0;
  for (const process of result.processes) {
    const original = JSON.parse(fs.readFileSync(path.join(root, 'capture', process.directory, 'analysis.json'), 'utf8'));
    assert.equal(process.functionRecords, original.jitRecordCounts.function);
    assert.equal(Object.values(process.all).reduce((total, count) => total + count, 0), process.functionRecords);
    records += process.functionRecords; spans += process.spans.length;
    for (const [index, span] of process.spans.entries()) {
      const expected = original.spans[index].jitEvents.filter((event) => event.kind === 'function')
        .map((event) => ({ timestampUs: event.timestampUs, name: event.name, action: event.action, contained: event.guaranteed }));
      assert.deepEqual(span.events.map((event) => ({ timestampUs: event.timestampUs, name: event.name, action: event.action, contained: event.contained })), expected);
      assert.equal(span.stages.length, 6);
      assert.equal(Object.values(span.counts).reduce((total, bucket) => total + bucket.records, 0), span.events.length);
    }
  }
  assert.equal(records, 1107823); assert.equal(spans, 384);
});

test('source classification respects authenticated directory boundaries and unknown scripts', () => {
  const roots = source.roots;
  assert.equal(originFor(roots.jsdom[0] + '/lib/api.js', roots), 'jsdom');
  assert.equal(originFor('file://' + roots.jsdom[1] + '/lib/jsdom/living/generated/Node.js', roots), 'jsdom');
  assert.equal(originFor(roots.jsdom[0] + '-other/file.js', roots), 'other');
  assert.equal(originFor(roots.dependencies + '/symbol-tree/lib/SymbolTree.js', roots), 'dependencies');
  assert.equal(originFor(roots.harness + '/benchmarks/worker.cjs', roots), 'harness');
  assert.equal(originFor('node:internal/util/comparisons', roots), 'node');
  assert.equal(originFor(null, roots), 'unknown');
});

test('the real script ID links a function event even when details follow it; missing details stay unknown', () => {
  const functionLine = lines.find((line) => line.startsWith('function,turbofan,'));
  const id = functionLine.split(',')[2];
  const details = lines.find((line) => line.startsWith(`script-details,${id},`));
  const [event] = readFunctionRecords(functionLine + '\n' + details);
  assert.equal(event.source, details.split(',')[2]);
  assert.equal(readFunctionRecords(functionLine)[0].source, null);
  const commaName = functionLine + ',suffix';
  assert.equal(readFunctionRecords(commaName)[0].name, functionLine.split(',').slice(7).join(',') + ',suffix');
});

test('a script ID cannot be silently reassigned to a different source', () => {
  const functionLine = lines.find((line) => line.startsWith('function,turbofan,'));
  const id = functionLine.split(',')[2];
  const details = lines.find((line) => line.startsWith(`script-details,${id},`));
  assert.throws(() => readFunctionRecords([functionLine, details, `script-details,${id},node:conflicting,0,0,`].join('\n')),
    /conflicting script ID/);
});

test('modified capture identity fails before reading any process reports', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-origin-identity-'));
  const capture = path.join(temporary, 'capture'); fs.mkdirSync(capture);
  const filename = path.join(capture, 'index.json');
  try {
    fs.writeFileSync(filename, fs.readFileSync(path.join(root, 'capture/index.json'), 'utf8') + '\n');
    assert.throws(() => analyze(temporary), /capture index differs/);
  } finally { fs.unlinkSync(filename); fs.rmdirSync(capture); fs.rmdirSync(temporary); }
});

test('the real CLI rejects missing arguments and preserves existing output bytes', () => {
  const cli = path.join(__dirname, 'function-origins.cjs');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-origin-output-'));
  const filename = path.join(temporary, 'existing.json'); fs.writeFileSync(filename, 'sentinel');
  try {
    const missing = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
    assert.notEqual(missing.status, 0); assert.match(missing.stderr, /Provide the extracted diagnostic/);
    const existing = spawnSync(process.execPath, [cli, root, filename], { encoding: 'utf8' });
    assert.notEqual(existing.status, 0); assert.match(existing.stderr, /preserve an existing output/);
    assert.equal(fs.readFileSync(filename, 'utf8'), 'sentinel');
  } finally { fs.unlinkSync(filename); fs.rmdirSync(temporary); }
});
