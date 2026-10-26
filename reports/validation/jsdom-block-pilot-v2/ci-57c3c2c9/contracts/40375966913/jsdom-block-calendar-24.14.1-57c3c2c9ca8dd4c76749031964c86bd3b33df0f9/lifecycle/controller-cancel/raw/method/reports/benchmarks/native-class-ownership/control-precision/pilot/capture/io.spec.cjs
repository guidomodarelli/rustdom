/** @file Real byte/alias/descriptor contracts, including the observed Windows path-stat/descriptor device asymmetry. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { readJSON, hashFile, copyNewFile } = require('./io.cjs');
const settings = require('../constants/reader-tests.json');

function temporary(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-pilot-io-'));
  try { callback(root); }
  finally {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rustdom-pilot-io-'));
    fs.rmSync(root, { recursive: true });
  }
}
function handles() {
  if (process.platform === 'win32') {
    const executable = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const child = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${process.pid}).HandleCount`], { encoding: 'utf8' });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const count = Number(child.stdout.trim()); assert.ok(Number.isSafeInteger(count) && count > 0); return count;
  }
  return fs.readdirSync(process.platform === 'linux' ? '/proc/self/fd' : '/dev/fd').length;
}
test('hashes original bytes and parses physical JSON without rewriting device observations or line endings', () => temporary((root) => {
  const filename = path.join(root, 'data.json'); const raw = Buffer.from('{"value":"á\\u0000"}\r\n');
  fs.writeFileSync(filename, raw);
  assert.equal(hashFile(filename), createHash('sha256').update(raw).digest('hex'));
  assert.deepEqual(readJSON(filename), { value: 'á\0' });
  const descriptor = fs.openSync(filename, 'r');
  try {
    const before = fs.lstatSync(filename, { bigint: true }); const actual = fs.fstatSync(descriptor, { bigint: true });
    assert.equal(before.ino, actual.ino);
    const digest = hashFile(filename); assert.equal(digest.length, 64);
    assert.equal(fs.lstatSync(filename, { bigint: true }).dev, before.dev);
    assert.equal(fs.fstatSync(descriptor, { bigint: true }).dev, actual.dev);
  } finally { fs.closeSync(descriptor); }
}));
test('rejects shared evidence inodes and oversized data while preserving installed-SDK sharing as an explicit separate role', () => temporary((root) => {
  const filename = path.join(root, 'data.json'); const alias = path.join(root, 'alias.json'); fs.writeFileSync(filename, '{}');
  fs.linkSync(filename, alias);
  assert.throws(() => readJSON(filename)); assert.throws(() => hashFile(filename));
  assert.equal(hashFile(filename, 2, false), createHash('sha256').update('{}').digest('hex'));
  fs.unlinkSync(alias); assert.throws(() => hashFile(filename, 1)); assert.deepEqual(readJSON(filename), {});
}));
test('repeated parse failures and streaming rejections release native file handles', () => temporary((root) => {
  const filename = path.join(root, 'broken.json'); fs.writeFileSync(filename, '{broken');
  assert.throws(() => readJSON(filename)); handles();
  const before = handles();
  for (let index = 0; index < settings.failedReadCycles; index += 1) {
    assert.throws(() => readJSON(filename)); assert.throws(() => hashFile(filename, 1));
  }
  const after = handles();
  assert.ok(after <= before + settings.maximumExtraOsHandles, `Pilot IO: OS handle retention after ${settings.failedReadCycles} cycles: ${before} -> ${after}`);
}));
test('publishes the original controller bytes exclusively and preserves a concurrent destination', () => temporary((root) => {
  const source = path.join(root, 'controller.json'); const target = path.join(root, 'copy.json');
  fs.writeFileSync(source, '{"observed":true}\r\n'); copyNewFile(source, target);
  assert.deepEqual(fs.readFileSync(target), fs.readFileSync(source));
  fs.writeFileSync(source, '{"new":true}');
  assert.throws(() => copyNewFile(source, target), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(target, 'utf8'), '{"observed":true}\r\n');
}));
