/** @file Attributes existing V8 function records to their scripts without collecting new samples. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { fileURLToPath } = require('node:url');
const { pointMembership } = require('../jsdom-telemetry/analyze.cjs');
const settings = require('./constants/inputs.json');

/** Retain the published logger's script IDs, source positions and emission timestamps. */
function readFunctionRecords(content) {
  const scripts = new Map();
  const events = [];
  let lineNumber = 0;
  for (const line of content.split('\n')) {
    lineNumber++;
    if (!line.startsWith('function,') && !line.startsWith('script-details,')) continue;
    const fields = line.split(',');
    if (fields[0] === 'script-details') {
      const existing = scripts.get(fields[1]);
      assert.ok(existing === undefined || existing === fields[2], 'JIT origins: conflicting script ID and URL');
      scripts.set(fields[1], fields[2]);
    } else {
      const event = { lineNumber, action: fields[1], scriptId: fields[2], startPosition: Number(fields[3]),
        endPosition: Number(fields[4]), loggedTimeDelta: Number(fields[5]), timestampUs: Number(fields[6]),
        name: fields.slice(7).join(',') };
      assert.ok(Number.isFinite(event.timestampUs) && Number.isFinite(event.loggedTimeDelta), 'JIT origins: invalid function timestamp or time delta');
      events.push(event);
    }
  }
  assert.ok(events.length > 0, 'JIT origins: no function records');
  return events.map((event) => ({ ...event, source: scripts.get(event.scriptId) ?? null }));
}

/** Classify by the logged script URL and authenticated roots, preserving unknown sources. */
function originFor(source, roots) {
  if (source === null || source === '') return settings.sourceCategories.unknown;
  if (source.startsWith('node:')) return settings.sourceCategories.node;
  const filename = source.startsWith('file:') ? fileURLToPath(source) : source;
  if (roots.jsdom.some((root) => filename.startsWith(root + '/'))) return settings.sourceCategories.jsdom;
  if (filename.startsWith(roots.dependencies + '/')) return settings.sourceCategories.dependencies;
  if (filename.startsWith(roots.harness + '/')) return settings.sourceCategories.harness;
  return settings.sourceCategories.other;
}

/** Describe recorded function emissions in each original operation and surrounding stage. */
function attributeProcess(events, analysis, roots) {
  const attributed = events.map((event) => ({ ...event, origin: originFor(event.source, roots) }));
  const all = {};
  const count = (buckets, event, contained) => {
    const key = `${event.origin}/${event.action}`;
    const bucket = buckets[key] ?? { records: 0, contained: 0 };
    bucket.records++; bucket.contained += Number(contained); buckets[key] = bucket;
  };
  for (const event of attributed) {
    const key = `${event.origin}/${event.action}`;
    all[key] = (all[key] ?? 0) + 1;
  }
  const describe = (span) => {
    const counts = {};
    const selected = [];
    for (const event of attributed) {
      const membership = pointMembership(event.timestampUs, span, analysis.jitOffsets);
      if (!membership.possible) continue;
      count(counts, event, membership.guaranteed);
      selected.push({ ...event, contained: membership.guaranteed });
    }
    return { stage: span.stage, startMs: span.startMs, durationMs: span.durationMs, counts, events: selected };
  };
  const spans = analysis.spans.map((span) => ({ index: span.index, ...describe(span),
    stages: span.stages.map((stage) => { const result = describe(stage); delete result.events; return result; }) }));
  return { node: analysis.node, position: analysis.position, physical: analysis.physical, key: analysis.key,
    pid: analysis.pid, offsets: analysis.jitOffsets, functionRecords: events.length, all, spans };
}

/** Read only authenticated reports and logger bytes from the completed diagnostic. */
function analyze(root) {
  const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
  const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  const capture = path.join(root, 'capture');
  assert.equal(hash(path.join(capture, 'index.json')), settings.captureIndexSha256, 'JIT origins: capture index differs from the published original');
  const index = read(path.join(capture, 'index.json'));
  assert.equal(index.complete, true); assert.equal(index.mode, 'capture');
  assert.equal(index.processes.length, settings.processCount); assert.equal(index.accepted, null);
  const processes = [];
  for (const entry of index.processes) {
    if (entry.input.mode !== 'jit') continue;
    const node = entry.node.startsWith('v22.') ? 'node22' : 'node24';
    const directory = path.join(capture, node, path.basename(entry.directory));
    assert.equal(entry.exitCode, 0);
    for (const name of ['v8.log', 'analysis.json', 'report.json']) assert.equal(hash(path.join(directory, name)), entry.files[name]);
    const analysis = read(path.join(directory, 'analysis.json'));
    const report = read(path.join(directory, 'report.json'));
    assert.equal(analysis.pid, entry.pid); assert.equal(report.pid, entry.pid);
    assert.equal(analysis.node, entry.node); assert.equal(analysis.mode, 'jit');
    const worker = entry.argv.find((argument) => argument.endsWith('/derived-jit/worker.cjs'));
    assert.ok(worker, 'JIT origins: missing original worker path');
    const roots = { jsdom: ['J0', 'J1'].map((physical) => index.manifest.copies[physical]),
      dependencies: path.dirname(path.dirname(index.manifest.copies.J0)) + '/node_modules',
      harness: path.posix.dirname(worker) + '/harness' };
    // The logger records absolute paths from the original host, which remain stable provenance after extraction.
    const result = attributeProcess(readFunctionRecords(fs.readFileSync(path.join(directory, 'v8.log'), 'utf8')), analysis, roots);
    assert.equal(result.spans.length, settings.spansPerProcess);
    assert.equal(result.functionRecords, analysis.jitRecordCounts.function);
    processes.push({ directory: `${node}/${path.basename(entry.directory)}`, roots, ...result });
  }
  assert.equal(processes.length, settings.jitProcessCount);
  return { diagnosticOnly: true, accepted: null, gateReevaluated: false, samplerExecuted: false,
    runId: settings.runId, processes };
}

if (require.main === module) {
  assert.equal(process.argv.length, 4, 'Provide the extracted diagnostic root and a new output JSON');
  const output = path.resolve(process.argv[3]);
  assert.ok(!fs.existsSync(output), 'JIT origins: preserve an existing output file');
  const result = analyze(path.resolve(process.argv[2]));
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ processes: result.processes.length,
    functionRecords: result.processes.reduce((total, entry) => total + entry.functionRecords, 0), output, accepted: null }));
}
module.exports = { readFunctionRecords, originFor, attributeProcess, analyze };
