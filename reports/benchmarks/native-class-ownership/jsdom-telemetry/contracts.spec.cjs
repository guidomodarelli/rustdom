/** @file Checks real diagnostic processes and the reader/orchestrator boundaries, without mock platform libraries. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { sourceFiles, plan, execute, validateReport } = require('./run.cjs');
const { analyzeProcess, pointMembership, gcIntersects } = require('./analyze.cjs');
const policy = require('./constants/protocol.json');
const settings = require('../constants/current-ownership.cjs');
const qualification = process.env.RUSTDOM_JSDOM_TELEMETRY_QUALIFICATION;
assert.ok(qualification, 'Provide the completed real qualification directory');
const index = JSON.parse(fs.readFileSync(path.join(qualification, 'index.json'), 'utf8'));
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const directoryFor = (entry) => path.join(qualification, entry.node === settings.nodeVersions[0] ? 'node22' : 'node24', path.basename(entry.directory));

test('the declared diagnostic contains every row and both physical labels at both fixed positions', () => {
  for (const nodeIndex of [0, 1]) {
    const capture = plan(nodeIndex, 'capture');
    assert.equal(capture.length, 32);
    for (const position of policy.positions) for (const label of settings.labels) {
      assert.deepEqual(capture.filter((entry) => entry.position === position && entry.label === label)
        .map((entry) => entry.rowIndex).sort((left, right) => left - right), Array.from({ length: 8 }, (unused, row) => row));
    }
    assert.equal(plan(nodeIndex, 'qualification').length, 16);
  }
});

test('the source receipt also pins the intermediate shared worker read by the reused deriver', () => {
  const shared = 'reports/benchmarks/native-class-ownership/sampler-diagnostics/worker.cjs';
  const sources = sourceFiles();
  for (const mode of Object.keys(policy.nodeFlagsByMode)) {
    const base = JSON.parse(fs.readFileSync(path.join(qualification, `derived-${mode}/base-preparation.json`), 'utf8'));
    assert.equal(sources[shared], base.derivedFiles['worker.cjs']);
  }
});

test('all real qualified jsdom workloads retain public outputs, exact spans, CPU/GC/JIT and finite release', () => {
  assert.equal(index.mode, 'qualification'); assert.equal(index.complete, true); assert.equal(index.accepted, null);
  assert.equal(index.processes.length, 32);
  let spans = 0; let windows = 0; let documents = 0;
  for (const entry of index.processes) {
    assert.equal(entry.exitCode, 0);
    const directory = directoryFor(entry);
    for (const [filename, expected] of Object.entries(entry.files)) assert.equal(digest(path.join(directory, filename)), expected);
    const report = JSON.parse(fs.readFileSync(path.join(directory, 'report.json'), 'utf8'));
    validateReport(report, index.manifest, entry.input, entry);
    assert.equal(Object.hasOwn(report, 'nativeBaseline'), false);
    const result = analyzeProcess(directory);
    assert.equal(result.accepted, null); assert.equal(result.gateReevaluated, false);
    assert.equal(result.mode, entry.input.mode);
    assert.equal(result.spans.length, 12);
    if (result.mode === 'cpu') { assert.ok(result.cpuProfileTicks > 0); assert.equal(result.jitRecordCounts, null); }
    else { assert.equal(result.cpuProfileTicks, null); assert.ok(result.jitRecordCounts.function > 0); }
    assert.ok(result.totalGcEvents > 0);
    assert.ok(result.spans.every((span) => span.stages.length === 6));
    assert.ok(result.spans.every((span) => span.durationMs > 0 && span.cpuUserUs >= 0 && span.cpuSystemUs >= 0));
    assert.deepEqual(result, JSON.parse(fs.readFileSync(path.join(directory, 'analysis.json'), 'utf8')));
    spans += result.spans.length; windows += result.trackedOwners.window; documents += result.trackedOwners.document;
  }
  assert.equal(spans, 384); assert.equal(windows, 384); assert.equal(documents, 384);
});

test('observed child identity rejects a valid report relabeled to another Node or PID', () => {
  const entry = index.processes[0];
  const report = JSON.parse(fs.readFileSync(path.join(directoryFor(entry), 'report.json'), 'utf8'));
  assert.throws(() => validateReport({ ...report, pid: report.pid + 1 }, index.manifest, entry.input, entry));
  const otherNode = settings.nodeVersions.find((version) => version !== entry.node);
  assert.throws(() => validateReport({ ...report, node: otherNode }, index.manifest, entry.input, entry));
});

test('point attribution is half-open and preserves uncertainty instead of forcing a certain intersection', () => {
  const span = { startMs: 1, durationMs: 1 };
  assert.deepEqual(pointMembership(1000, span, { min: 0, max: 0 }), { guaranteed: true, possible: true });
  assert.deepEqual(pointMembership(2000, span, { min: 0, max: 0 }), { guaranteed: false, possible: false });
  assert.deepEqual(pointMembership(999, span, { min: 0, max: 2 }), { guaranteed: false, possible: true });
  assert.deepEqual(pointMembership(1999, span, { min: 0, max: 2 }), { guaranteed: false, possible: true });
  assert.deepEqual(pointMembership(3000, span, { min: 0, max: 2 }), { guaranteed: false, possible: false });
});

test('all signed CPU deltas survive reconstruction, including real out-of-order samples', () => {
  let observedNegatives = 0;
  for (const entry of index.processes.filter((record) => record.input.mode === 'cpu')) {
    const directory = directoryFor(entry);
    const raw = JSON.parse(fs.readFileSync(path.join(directory, 'cpu.cpuprofile'), 'utf8'));
    const result = analyzeProcess(directory);
    let timestamp = raw.startTime;
    const expected = raw.timeDeltas.flatMap((deltaUs, sampleIndex) => {
      timestamp += deltaUs;
      return deltaUs < 0 ? [{ id: raw.samples[sampleIndex], timestampUs: timestamp, index: sampleIndex, deltaUs }] : [];
    });
    assert.equal(result.cpuProfileTicks, raw.samples.length);
    assert.deepEqual(result.outOfOrderCpuSamples, expected);
    observedNegatives += expected.length;
  }
  assert.ok(observedNegatives > 0, 'The actual retained fixture must exercise negative deltas');
});

test('GC interval boundaries preserve point events and reject an event at the exclusive end', () => {
  const span = { startMs: 1, durationMs: 1 };
  assert.equal(gcIntersects({ startMs: 1, durationMs: 0 }, span), true);
  assert.equal(gcIntersects({ startMs: 2, durationMs: 0 }, span), false);
  assert.equal(gcIntersects({ startMs: 0, durationMs: 1 }, span), false);
  assert.equal(gcIntersects({ startMs: 0, durationMs: 2 }, span), true);
});

test('the real CLI rejects incomplete arguments with an actionable error', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs')], { encoding: 'utf8' });
  assert.ifError(child.error); assert.equal(child.status, 2); assert.equal(child.stdout, '');
  assert.match(child.stderr, /provide mode, preparation, output, publication, Node22 and Node24/);
});

test('derivation rejects altered source bytes before creating an output harness', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-jsdom-telemetry-contract-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true });
  });
  const source = path.join(root, 'source'); fs.mkdirSync(source);
  const manifestPath = path.join(qualification, 'source-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const repository = path.resolve(__dirname, '../../../..');
  for (const entry of manifest.files) {
    const target = path.join(source, entry.path); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repository, entry.path), target);
  }
  fs.appendFileSync(path.join(source, 'src/dom/tree.rs'), '\n');
  const output = path.join(root, 'output');
  const child = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), source, manifestPath, output, 'cpu'], { encoding: 'utf8' });
  assert.ifError(child.error); assert.notEqual(child.status, 0);
  assert.match(child.stderr, /source identity differs: src\/dom\/tree.rs/);
  assert.equal(fs.existsSync(output), false);
});

test('optimized Python cannot bypass derivation identity checks', () => {
  const child = spawnSync('python3', ['-O', path.join(__dirname, 'prepare.py')], { encoding: 'utf8' });
  assert.ifError(child.error); assert.notEqual(child.status, 0);
  assert.match(child.stderr, /requires non-optimized Python/);
});

test('a real failed child is retained and prevents the next child from running', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-jsdom-telemetry-contract-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true });
  });
  const commands = [7, 0].map((code, position) => ({ directory: path.join(root, String(position)),
    input: { position, label: 'A', rowIndex: 0 }, argv: [process.execPath, '-e', `process.exit(${code})`] }));
  const record = { processes: [], accepted: null };
  assert.throws(() => execute(commands, record, root, () => {}), /failed process/);
  assert.equal(record.processes.length, 1); assert.equal(record.processes[0].exitCode, 7);
  assert.ok(record.processes[0].files['stdout.log']); assert.equal(fs.existsSync(commands[1].directory), false);
});

test('existing output and its user file are never overwritten by a worker', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-jsdom-telemetry-contract-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true });
  });
  const sentinel = path.join(root, 'sentinel'); fs.writeFileSync(sentinel, 'preserved');
  const record = { processes: [] };
  assert.throws(() => execute([{ directory: root, argv: [process.execPath, '-e', 'process.exit(0)'] }], record, root, () => {}), /EEXIST/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserved'); assert.equal(record.processes.length, 0);
});
