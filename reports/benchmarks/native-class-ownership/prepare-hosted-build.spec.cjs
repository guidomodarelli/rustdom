/** @file Checks real prepared packages, portable relocation and rejection of altered inputs and artifacts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { prepare, verify, verifyFunctionalReport } = require('./prepare-hosted-build.cjs');
const settings = require('./constants/hosted-build.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
assert.ok(archive, 'Use the actual completed preparation: RUSTDOM_HOSTED_BUILD_ARCHIVE');

/** @param {import('node:test').TestContext} context - Owns the isolated evidence copy. @returns {string} New temporary parent. */
function temporaryDirectory(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-hosted-build-check-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('rustdom-hosted-build-check-'));
    fs.rmSync(directory, { recursive: true });
  });
  return directory;
}

test('verifies the actual fresh build without turning preparation into performance acceptance', () => {
  const result = verify(archive);
  assert.equal(result.verified, true); assert.equal(result.measurementExecuted, false);
  assert.equal(result.performanceAccepted, null);
  assert.deepEqual(Object.keys(result.distributions), ['A0', 'A1', 'B', 'J0', 'J1']);
});

test('both actual Node workers exercised public behavior, isolated allocation and separate realm release', () => {
  const identity = verify(archive);
  for (const [filename, version] of [['ownership-node22.json', 'v22.12.0'], ['ownership-node24.json', 'v24.14.1']]) {
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(archive), filename)));
    assert.equal(verifyFunctionalReport(report, identity).verified, true);
    assert.equal(report.pass, true); assert.equal(report.node, version);
    assert.equal(report.measurementExecuted, false); assert.equal(report.results.length, 15);
    assert.equal(report.observedWindows, 15); assert.equal(report.observedDocuments, 15);
    for (const endpoint of Object.values(report.endpoints)) {
      assert.equal(endpoint.reached, true);
      assert.deepEqual(endpoint.state.survivors, { window: 0, document: 0 });
      assert.ok(endpoint.trace.slice(-2).every((state) => state.clear));
    }
    for (const entry of report.results) for (const [label, created] of Object.entries(entry.allocationDelta)) {
      if (label === entry.label) assert.ok(created > 0);
      else assert.equal(created, 0);
    }
  }
});

test('rejects a real functional report with a stale preparation identity or falsely clear Document', () => {
  const identity = verify(archive);
  const report = JSON.parse(fs.readFileSync(path.join(path.dirname(archive), 'ownership-node24.json')));
  report.integrity.preparationId = 'another-preparation';
  assert.throws(() => verifyFunctionalReport(report, identity), /belongs to another preparation/);
  report.integrity = identity;
  report.endpoints.B.trace.at(-1).survivors.document = 1;
  assert.throws(() => verifyFunctionalReport(report, identity));
});

for (const name of ['RUSTC', 'CARGO_BUILD_RUSTC', 'CARGO_BUILD_RUSTFLAGS']) {
  test(`the real build CLI rejects inherited ${name} before installing or creating output`, (context) => {
    const directory = temporaryDirectory(context); const output = path.join(directory, 'new-output');
    const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-hosted-build.cjs'),
      path.join(archive, 'baseline-sources'), path.join(archive, 'sources'), output],
    { encoding: 'utf8', env: { ...process.env, [name]: name.endsWith('FLAGS') ? '-C opt-level=0' : '/bin/false' } });
    assert.equal(child.status, 2); assert.match(child.stderr, new RegExp(`undeclared ${name}`));
    assert.equal(fs.existsSync(output), false);
  });
}

test('the real build CLI rejects an inherited Cargo configuration outside both source roots', (context) => {
  const directory = temporaryDirectory(context); const output = path.join(directory, 'new-output');
  const cargoHome = path.join(directory, 'cargo-home'); fs.mkdirSync(cargoHome);
  fs.writeFileSync(path.join(cargoHome, 'config.toml'), '[build]\nrustflags = ["-C", "opt-level=0"]\n');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-hosted-build.cjs'),
    path.join(archive, 'baseline-sources'), path.join(archive, 'sources'), output],
  { encoding: 'utf8', env: { ...process.env, CARGO_HOME: cargoHome } });
  assert.equal(child.status, 2); assert.match(child.stderr, /undeclared Cargo configuration/);
  assert.equal(fs.existsSync(output), false);
});

test('the real build CLI rejects a CARGO_HOME that would resolve differently inside A/B', (context) => {
  const directory = temporaryDirectory(context); const output = path.join(directory, 'new-output');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-hosted-build.cjs'),
    path.join(archive, 'baseline-sources'), path.join(archive, 'sources'), output],
  { encoding: 'utf8', env: { ...process.env, CARGO_HOME: 'relative-cache' } });
  assert.equal(child.status, 2); assert.match(child.stderr, /use absolute CARGO_HOME/);
  assert.equal(fs.existsSync(output), false);
});

test('moves a complete archive with relative dependency links and retains every package identity', (context) => {
  const directory = temporaryDirectory(context); const relocated = path.join(directory, 'relocated');
  fs.cpSync(archive, relocated, { recursive: true, verbatimSymlinks: true });
  assert.deepEqual(verify(relocated), verify(archive));
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'hosted-build-worker.cjs'), relocated],
    { encoding: 'utf8', timeout: settings.validationTimeoutMs });
  const prefix = path.join(path.dirname(archive), `relocated-${process.version}-${randomUUID()}`);
  fs.writeFileSync(`${prefix}.json`, child.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(`${prefix}.stderr.log`, child.stderr ?? '', { flag: 'wx' });
  fs.writeFileSync(`${prefix}.process.json`, JSON.stringify({ exitCode: child.status, signal: child.signal, error: child.error?.message ?? null }), { flag: 'wx' });
  assert.equal(child.error, undefined, child.stderr); assert.equal(child.status, 0, child.stderr);
  assert.equal(verifyFunctionalReport(JSON.parse(child.stdout), verify(archive)).verified, true);
});

for (const change of ['javascript', 'native', 'dependency', 'incomplete', 'external-link']) {
  test(`rejects altered prepared evidence: ${change}`, (context) => {
    const directory = temporaryDirectory(context); const damaged = path.join(directory, 'damaged');
    fs.cpSync(archive, damaged, { recursive: true, verbatimSymlinks: true });
    if (change === 'incomplete') {
      const filename = path.join(damaged, 'index.json'); const index = JSON.parse(fs.readFileSync(filename));
      index.complete = false; fs.writeFileSync(filename, JSON.stringify(index));
    } else if (change === 'external-link') fs.symlinkSync('/etc/hosts', path.join(damaged, 'node_modules/unrecorded-link'));
    else if (change === 'dependency') {
      const index = JSON.parse(fs.readFileSync(path.join(damaged, 'index.json')));
      const dependency = index.dependencies.files.find((file) => file.path.endsWith('.js'));
      fs.appendFileSync(path.join(damaged, dependency.path), '\n');
    } else fs.appendFileSync(path.join(damaged, 'packages/B/dist', change === 'native' ? 'rustdom.node' : 'index.cjs'), '\n');
    assert.throws(() => verify(damaged));
  });
}

test('rejects changed real root build inputs before creating output or invoking build tools', (context) => {
  const directory = temporaryDirectory(context); const candidate = path.join(directory, 'candidate');
  fs.cpSync(path.join(archive, 'sources'), candidate, { recursive: true });
  fs.appendFileSync(path.join(candidate, 'build.rs'), '\n');
  const output = path.join(directory, 'new-output');
  assert.throws(() => prepare(path.join(archive, 'baseline-sources'), candidate, output), /build input differs: build.rs/);
  assert.equal(fs.existsSync(output), false);
});

test('preserves an existing preparation before inspecting tools or running installers', (context) => {
  const directory = temporaryDirectory(context); const sentinel = path.join(directory, 'sentinel');
  fs.writeFileSync(sentinel, 'preserve');
  assert.throws(() => prepare(path.join(archive, 'baseline-sources'), path.join(archive, 'sources'), directory), /output already exists/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve');
  assert.deepEqual(fs.readdirSync(directory), ['sentinel']);
});

test('the actual offline CLI verifies relocated packages without building or running a sampler', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-hosted-build.cjs'), '--verify', archive], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.verified, true); assert.equal(result.measurementExecuted, false);
  assert.equal(result.performanceAccepted, null);
});
