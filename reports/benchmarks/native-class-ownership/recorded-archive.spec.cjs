/** @file Exercises the real archive materializer with complete preserved evidence and damaged transport inputs. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/recorded-archive.json');
const evidenceSettings = require('./constants/recorded-evidence.json');
assert.ok(process.env.RUSTDOM_RECORDED_ARCHIVE_FIXTURE, 'Recorded archive contracts require a complete real-data fixture');
const fixture = JSON.parse(fs.readFileSync(process.env.RUSTDOM_RECORDED_ARCHIVE_FIXTURE, 'utf8'));
const declaration = JSON.parse(fs.readFileSync(path.join(fixture.sourceRoot, settings.manifestFilename), 'utf8'));
assert.equal(declaration.archive.sha256, fixture.expectedArchiveSha256);

/**
 * Own a disposable transport directory without modifying preserved dataset inputs.
 * @param {import('node:test').TestContext} context - Owns cleanup after the actual operation.
 * @returns {string} Fresh temporary directory.
 */
function temporaryDirectory(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), settings.contractTemporaryDirectoryPrefix));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith(settings.contractTemporaryDirectoryPrefix));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

/**
 * Preserve the real child outcome for successful and controlled rejected materialization.
 * @param {string} name - Unique contract output name.
 * @param {string} source - Actual recorded input directory.
 * @param {string} destination - Fresh or deliberately preexisting output path.
 * @param {object} [environment] - Explicit child environment, for the Python optimization guard.
 * @returns {object} Unmocked Python process outcome.
 */
function execute(name, source, destination, environment = process.env) {
  const command = ['-B', path.join(__dirname, 'materialize-recorded-archive.py'), source, destination];
  const child = spawnSync(evidenceSettings.pythonCommand, command,
    { encoding: 'utf8', env: environment, timeout: evidenceSettings.cliTimeoutMs });
  fs.writeFileSync(path.join(fixture.outputRoot, `${name}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(fixture.outputRoot, `${name}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(fixture.outputRoot, `${name}.process.json`), `${JSON.stringify({
    command: [evidenceSettings.pythonCommand, ...command], pid: child.pid, exitCode: child.status,
    signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.ifError(child.error); assert.equal(child.signal, null);
  return child;
}

/**
 * Hash an actual large archive without retaining its full contents in the Node heap.
 * @param {string} filename - Materialized archive or recorded sidecar.
 * @returns {Promise<string>} Complete content digest.
 */
async function digest(filename) {
  const checksum = createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) checksum.update(chunk);
  return checksum.digest('hex');
}

test('the real complete archive and sidecars reassemble byte for byte without measuring DOM', async (context) => {
  const directory = temporaryDirectory(context);
  const destination = path.join(directory, 'materialized');
  const child = execute('complete', fixture.sourceRoot, destination);
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stderr, '');
  const result = JSON.parse(child.stdout);
  assert.equal(result.verified, true); assert.equal(result.measurementExecuted, false);
  assert.equal(result.parts, declaration.parts.length); assert.deepEqual(result.archive, declaration.archive);
  for (const entry of [declaration.archive, ...declaration.sidecars]) {
    const filename = path.join(destination, entry.filename);
    assert.equal(fs.statSync(filename).size, entry.bytes);
    assert.equal(await digest(filename), entry.sha256);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination, settings.receiptFilename), 'utf8')), result);
});

test('missing real archive parts fail before creating output', (context) => {
  const directory = temporaryDirectory(context);
  const source = path.join(directory, 'source'); fs.mkdirSync(source);
  fs.copyFileSync(path.join(fixture.sourceRoot, settings.manifestFilename), path.join(source, settings.manifestFilename));
  const destination = path.join(directory, 'materialized');
  const child = execute('missing-part', source, destination);
  assert.equal(child.status, 1); assert.equal(child.stdout, '');
  assert.match(child.stderr, /missing regular input/); assert.equal(fs.existsSync(destination), false);
});

test('changed real archive part bytes cannot produce a verified materialization', (context) => {
  const directory = temporaryDirectory(context);
  const source = path.join(directory, 'source'); fs.mkdirSync(source);
  const names = [settings.manifestFilename, ...declaration.parts.map((part) => part.filename),
    ...declaration.sidecars.map((sidecar) => sidecar.filename)];
  for (const name of names) fs.copyFileSync(path.join(fixture.sourceRoot, name), path.join(source, name), fs.constants.COPYFILE_FICLONE);
  const firstPart = path.join(source, declaration.parts[0].filename);
  const descriptor = fs.openSync(firstPart, 'r+');
  try {
    const byte = Buffer.alloc(1); assert.equal(fs.readSync(descriptor, byte, 0, 1, 0), 1);
    byte[0] ^= 1; fs.writeSync(descriptor, byte, 0, 1, 0);
  } finally { fs.closeSync(descriptor); }
  const destination = path.join(directory, 'materialized');
  const child = execute('changed-part', source, destination);
  assert.equal(child.status, 1); assert.equal(child.stdout, ''); assert.match(child.stderr, /part digest differs/);
  assert.equal(fs.existsSync(path.join(destination, settings.receiptFilename)), false);
});

test('a traversal filename in the declared transport is rejected before creating output', (context) => {
  const directory = temporaryDirectory(context);
  const source = path.join(directory, 'source'); fs.mkdirSync(source);
  const changed = structuredClone(declaration); changed.parts[0].filename = '../escaped';
  fs.writeFileSync(path.join(source, settings.manifestFilename), JSON.stringify(changed));
  const destination = path.join(directory, 'materialized');
  const child = execute('traversal', source, destination);
  assert.equal(child.status, 1); assert.equal(child.stdout, ''); assert.match(child.stderr, /noncanonical filename/);
  assert.equal(fs.existsSync(destination), false); assert.equal(fs.existsSync(path.join(directory, 'escaped')), false);
});

test('an existing destination and its user file remain untouched', (context) => {
  const directory = temporaryDirectory(context);
  const destination = path.join(directory, 'existing'); fs.mkdirSync(destination);
  const sentinel = Buffer.from('preserved user file');
  fs.writeFileSync(path.join(destination, 'sentinel'), sentinel);
  const child = execute('existing-destination', fixture.sourceRoot, destination);
  assert.equal(child.status, 1); assert.equal(child.stdout, ''); assert.match(child.stderr, /destination already exists/);
  assert.deepEqual(fs.readdirSync(destination), ['sentinel']);
  assert.deepEqual(fs.readFileSync(path.join(destination, 'sentinel')), sentinel);
});

for (const level of ['1', '2']) {
  test(`Python optimization ${level} cannot bypass transport integrity checks`, (context) => {
    const directory = temporaryDirectory(context);
    const destination = path.join(directory, 'materialized');
    const child = execute(`python-optimize-${level}`, fixture.sourceRoot, destination,
      { ...process.env, PYTHONOPTIMIZE: level });
    assert.equal(child.status, 1); assert.equal(child.stdout, '');
    assert.match(child.stderr, /Python optimization disables required checks/);
    assert.equal(fs.existsSync(destination), false);
  });
}
