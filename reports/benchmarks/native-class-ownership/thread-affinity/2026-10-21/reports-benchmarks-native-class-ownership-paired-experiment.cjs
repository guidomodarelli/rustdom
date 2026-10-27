/** @file Prepares real independent runtime copies and runs one fixed fresh-realm paired experiment. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const settings = require('./constants/paired.cjs');
const originalProtocol = require('./constants/hosted.cjs');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Fingerprint the exact distribution files loaded by a physical copy, excluding shared dependencies. */
function fingerprint(root, parts) {
  const files = [];
  const walk = (relativePath) => {
    const absolute = path.join(root, relativePath);
    if (fs.statSync(absolute).isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) walk(`${relativePath}/${name}`);
    } else files.push({ path: relativePath, bytes: fs.statSync(absolute).size, sha256: sha256(absolute) });
  };
  for (const part of parts) walk(part);
  return { files, sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
}

/** Make physical package copies so A/A has independent module/classes just like A/B. Never mutates originals. */
function prepare(candidateRoot, baselineRoot) {
  candidateRoot = path.resolve(candidateRoot); baselineRoot = path.resolve(baselineRoot);
  const { captureSourceIdentity } = require(path.join(candidateRoot, 'benchmarks/sources.cjs'));
  const sources = { A: captureSourceIdentity(baselineRoot), B: captureSourceIdentity(candidateRoot) };
  for (const label of ['A', 'B']) assert.equal(sources[label].sourceHash, originalProtocol.sourceHashes[label]);
  const reference = path.dirname(require.resolve('jsdom/package.json', { paths: [candidateRoot] }));
  assert.equal(readJson(path.join(reference, 'package.json')).version, '27.4.0');
  const dependencies = fs.realpathSync(path.join(candidateRoot, 'node_modules'));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-paired-copies-'));
  const copies = {}; const distributions = {};
  for (const [label, source] of Object.entries({ A0: baselineRoot, A1: baselineRoot, B: candidateRoot, J0: reference, J1: reference })) {
    const target = path.join(directory, label);
    fs.mkdirSync(target);
    const parts = label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json'];
    for (const part of parts) fs.cpSync(path.join(source, part), path.join(target, part), { recursive: true });
    fs.symlinkSync(dependencies, path.join(target, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const original = fingerprint(source, parts), copied = fingerprint(target, parts);
    assert.deepEqual(copied, original);
    copies[label] = target; distributions[label] = copied;
  }
  assert.equal(distributions.A0.sha256, distributions.A1.sha256);
  assert.equal(distributions.J0.sha256, distributions.J1.sha256);
  const manifest = { copies, distributions, sources, roots: { A: baselineRoot, B: candidateRoot },
    dependencies, referenceVersion: '27.4.0', recordedAt: new Date().toISOString() };
  const filename = path.join(directory, 'manifest.json');
  fs.writeFileSync(filename, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return { filename, manifest };
}

/** Recompute every label/engine/size aggregate without filtering observations. */
function summarize(entries, phase) {
  return settings.sizes.map((size) => {
    const row = { size }; const outputHashes = new Set();
    for (const label of ['A', 'B']) {
      row[label] = {};
      for (const engine of ['jsdom', 'rustdom']) {
        const selected = entries.filter((entry) => entry.engine === engine);
        assert.deepEqual(selected.map((entry) => entry.position), Array.from({ length: settings.workerCount }, (_, index) => index));
        const processMediansMs = [];
        const samples = selected.flatMap((entry) => {
          assert.equal(entry.complete, true); assert.equal(entry.phase, phase); assert.equal(entry.node, settings.nodeVersion);
          assert.deepEqual(entry.settings, settings);
          const observations = entry.samples.filter((sample) => sample.size === size && sample.label === label && !sample.warmup);
          assert.equal(observations.length, settings.measuredRounds);
          for (const sample of observations) { assert.equal(sample.complete, true); outputHashes.add(sample.outputHash); }
          const values = observations.map((sample) => sample.elapsedMs);
          assert.ok(values.every((value) => Number.isFinite(value) && value > 0));
          processMediansMs.push(median(values)); return values;
        });
        assert.equal(samples.length, settings.workerCount * settings.measuredRounds);
        row[label][engine] = { count: samples.length, medianMs: median(samples), processMediansMs };
      }
    }
    assert.equal(outputHashes.size, 1);
    row.outputHash = [...outputHashes][0];
    row.rustdomChangePercent = (row.B.rustdom.medianMs / row.A.rustdom.medianMs - 1) * 100;
    row.jsdomControlChangePercent = (row.B.jsdom.medianMs / row.A.jsdom.medianMs - 1) * 100;
    row.rustdomPairedChangesPercent = entries.filter((entry) => entry.engine === 'rustdom').map((entry) => {
      const medianFor = (label) => median(entry.samples.filter((sample) => !sample.warmup && sample.size === size && sample.label === label).map((sample) => sample.elapsedMs));
      return (medianFor('B') / medianFor('A') - 1) * 100;
    });
    row.calibrated = Math.abs(row.jsdomControlChangePercent) <= settings.controlBudgetPercent &&
      (phase === 'AB' || Math.abs(row.rustdomChangePercent) <= settings.rustBudgetPercent);
    row.withinBudget = row.calibrated && row.rustdomChangePercent <= settings.rustBudgetPercent;
    return row;
  });
}

/** Verify the complete paired archive, including warmups, ordering, native activation and original output parity. */
function verify(outputRoot) {
  const index = readJson(path.join(outputRoot, 'index.json'));
  assert.equal(index.complete, true); assert.deepEqual(index.settings, settings);
  for (const label of ['A', 'B']) assert.equal(index.packages.sources[label].sourceHash, originalProtocol.sourceHashes[label]);
  for (const [file, hash] of Object.entries(index.files)) assert.equal(sha256(path.join(outputRoot, file)), hash, `Paired archive changed: ${file}`);
  const original = readJson(path.join(__dirname, 'hosted/39643090437/AA-01-A.json'));
  const summaries = {}; let measured = 0; let copies = 0; const survivors = { window: 0, document: 0 };
  for (const phase of ['AA', 'AB']) {
    const entries = index.runs.filter((run) => run.phase === phase).map((run) => {
      assert.equal(run.exitCode, 0);
      const report = readJson(path.join(outputRoot, run.report));
      assert.equal(report.position, run.position); assert.equal(report.phase, phase); assert.equal(report.engine, run.engine);
      assert.deepEqual(report.execArgv, ['--expose-gc']); assert.equal(report.nodeOptionsPresent, false);
      const expectedRoots = run.engine === 'jsdom' ? { A: index.packages.copies.J0, B: index.packages.copies.J1 }
        : { A: index.packages.copies.A0, B: phase === 'AA' ? index.packages.copies.A1 : index.packages.copies.B };
      assert.deepEqual(report.roots, expectedRoots);
      const expected = [];
      for (const size of run.position % 2 ? [...settings.sizes].reverse() : settings.sizes) {
        for (const [warmup, order] of [[true, settings.warmupOrder], [false, settings.measuredOrder]]) {
          for (const [round, pair] of order.entries()) for (const label of run.position % 2 ? [...pair].reverse() : [...pair]) {
            expected.push({ size, warmup, round, label });
          }
        }
      }
      assert.deepEqual(report.samples.map(({ size, warmup, round, label }) => ({ size, warmup, round, label })), expected);
      for (const sample of report.samples) {
        assert.equal(sample.complete, true); assert.equal(sample.result, settings.operations / 2);
        assert.equal(sample.outputHash, original.runs[0].workloads.find((row) => row.rows === sample.size).outputHash);
        assert.ok(Number.isFinite(sample.elapsedMs) && sample.elapsedMs > 0);
        if (run.engine === 'rustdom') assert.equal(sample.after.created - sample.before.created, settings.operations);
        assert.equal(sample.cleanupTrace.length, settings.cleanupRounds);
        for (const endpoint of sample.cleanupTrace.slice(-2)) {
          assert.deepEqual(endpoint.survivors, { window: false, document: false });
          if (endpoint.released) assert.equal(endpoint.released.live, 0);
        }
        if (sample.survivors.window) survivors.window++;
        if (sample.survivors.document) survivors.document++;
        if (!sample.warmup) measured++;
        copies += settings.operations;
      }
      return report;
    });
    assert.equal(entries.length, settings.workerCount * 2);
    summaries[phase] = summarize(entries, phase);
  }
  assert.deepEqual(index.summaries, summaries);
  const accepted = summaries.AA.every((row) => row.calibrated) && summaries.AB.every((row) => row.withinBudget);
  assert.equal(index.accepted, accepted);
  return { verified: true, processes: index.runs.length, measuredDurations: measured, copiesIncludingWarmup: copies, survivors, accepted, summaries };
}

/** Run one fixed experiment only after functional validation and review of this exact method. */
function run(candidateArgument, baselineArgument, outputArgument, cpuArgument) {
  assert.equal(process.version, settings.nodeVersion);
  assert.ok(!Object.hasOwn(process.env, 'NODE_OPTIONS'), 'The fixed paired study requires NODE_OPTIONS to be absent');
  assert.match(cpuArgument, /^\d+$/, 'CPU must be a nonnegative integer');
  assert.ok(Number.isSafeInteger(Number(cpuArgument)));
  const outputRoot = path.resolve(outputArgument);
  assert.equal(fs.existsSync(outputRoot), false, 'Preserve existing experiment output');
  const { filename, manifest } = prepare(candidateArgument, baselineArgument);
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true }); fs.mkdirSync(outputRoot);
  const index = { complete: false, startedAt: new Date().toISOString(), settings, cpu: Number(cpuArgument),
    node: process.version, v8: process.versions.v8,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model,
      logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() },
    rustc: spawnSync('rustc', ['-Vv'], { encoding: 'utf8' }).stdout?.trim() || null,
    packages: manifest, files: {}, runs: [], summaries: {} };
  const save = () => fs.writeFileSync(path.join(outputRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  for (const file of ['paired-experiment.cjs', 'paired-worker.cjs', 'constants/paired.cjs', 'PAIRED-PROTOCOL.md']) {
    const name = file.replaceAll('/', '-'); fs.copyFileSync(path.join(__dirname, file), path.join(outputRoot, name));
    index.files[name] = sha256(path.join(outputRoot, name));
  }
  save();
  try {
    for (const phase of ['AA', 'AB']) {
      const entries = [];
      for (let position = 0; position < settings.workerCount; position++) {
        for (const engine of position % 2 ? ['rustdom', 'jsdom'] : ['jsdom', 'rustdom']) {
          const prefix = `${phase}-${position}-${engine}`;
          const record = { phase, engine, position, report: `${prefix}.json`, stdout: `${prefix}.stdout.log`, stderr: `${prefix}.stderr.log` };
          index.runs.push(record); save();
          process.stdout.write(`Paired fresh realms ${phase} ${position + 1}/${settings.workerCount} ${engine}\n`);
          const stdout = fs.openSync(path.join(outputRoot, record.stdout), 'wx');
          const stderr = fs.openSync(path.join(outputRoot, record.stderr), 'wx');
          let result;
          try {
            result = spawnSync('taskset', ['-c', cpuArgument, process.execPath, '--expose-gc', path.join(__dirname, 'paired-worker.cjs'), filename,
              phase, engine, String(position), path.join(outputRoot, record.report)], { stdio: ['ignore', stdout, stderr], timeout: settings.workerTimeoutMs });
          } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
          Object.assign(record, { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null });
          for (const file of [record.report, record.stdout, record.stderr]) {
            if (fs.existsSync(path.join(outputRoot, file))) index.files[file] = sha256(path.join(outputRoot, file));
          }
          save(); assert.equal(result.status, 0, `Inspect failed paired worker ${record.stderr}`);
          entries.push(readJson(path.join(outputRoot, record.report)));
        }
      }
      index.summaries[phase] = summarize(entries, phase); save();
    }
    for (const [label, root] of Object.entries(manifest.copies)) {
      assert.deepEqual(fingerprint(root, label.startsWith('J') ? ['lib', 'package.json'] : ['dist', 'package.json']), manifest.distributions[label]);
    }
    const { captureSourceIdentity } = require(path.join(manifest.roots.B, 'benchmarks/sources.cjs'));
    for (const label of ['A', 'B']) assert.equal(captureSourceIdentity(manifest.roots[label]).sourceHash, manifest.sources[label].sourceHash);
    index.accepted = index.summaries.AA.every((row) => row.calibrated) && index.summaries.AB.every((row) => row.withinBudget);
    index.complete = true; index.finishedAt = new Date().toISOString(); save();
    process.stdout.write(`${JSON.stringify(verify(outputRoot), null, 2)}\n`);
    if (!index.accepted) process.exitCode = 1;
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) {
  if (process.argv[2] === '--prepare') process.stdout.write(`${prepare(process.argv[3], process.argv[4]).filename}\n`);
  else if (process.argv[2] === '--verify') process.stdout.write(`${JSON.stringify(verify(path.resolve(process.argv[3])), null, 2)}\n`);
  else run(...process.argv.slice(2));
}
module.exports = { prepare, fingerprint, summarize, verify };
