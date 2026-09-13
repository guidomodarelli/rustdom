/** @file Exercises real process outcomes, including signals and split UTF-8 output. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValidationProcess } from '../../scripts/validation-process.mjs';

test('should preserve successful stdout and stderr without breaking split UTF-8 sequences', async () => {
  const result = await runValidationProcess(process.execPath, ['-e',
    'process.stdout.write(Buffer.from([0xe2])); setTimeout(() => { process.stdout.write(Buffer.from([0x9c,0x94])); process.stderr.write("diagnostic\\n"); }, 20);']);
  assert.equal(result.exitCode, 0); assert.equal(result.signal, null); assert.equal(result.spawnError, null);
  assert.ok(result.output.includes('✔')); assert.ok(result.output.includes('diagnostic\n'));
  assert.equal(result.output.includes('\ufffd'), false);
});

test('should preserve a nonzero child exit code and its diagnostic', async () => {
  const result = await runValidationProcess(process.execPath, ['-e', 'process.stderr.write("controlled failure\\n"); process.exitCode = 7;']);
  assert.equal(result.exitCode, 7); assert.equal(result.signal, null); assert.equal(result.spawnError, null);
  assert.ok(result.output.includes('controlled failure\n'));
});

test('should preserve abnormal termination instead of reporting successful completion', async () => {
  const result = await runValidationProcess(process.execPath, ['-e', 'process.kill(process.pid, "SIGTERM");']);
  assert.equal(result.spawnError, null);
  if (process.platform !== 'win32') { assert.equal(result.exitCode, null); assert.equal(result.signal, 'SIGTERM'); }
  else assert.ok(result.signal !== null || result.exitCode !== 0, 'Windows can report a code for self-termination');
});

test('should capture an unavailable executable without rejecting before the report can be saved', async () => {
  const result = await runValidationProcess('rustdom-validation-command-that-does-not-exist', []);
  assert.notEqual(result.exitCode, 0); assert.equal(result.signal, null);
  assert.equal(result.spawnError.code, 'ENOENT'); assert.equal(result.output, '');
});

test('should capture synchronous process argument errors without losing the outcome', async () => {
  const result = await runValidationProcess(null, []);
  assert.equal(result.exitCode, null); assert.equal(result.signal, null);
  assert.equal(result.spawnError.code, 'ERR_INVALID_ARG_TYPE'); assert.equal(result.output, '');
});

test('should stop the real validation CLI at a failing Cargo gate and preserve its report', async () => {
  assert.ok(process.env.npm_execpath, 'Run through npm run test:validation');
  const directory = await mkdtemp(join(tmpdir(), 'rustdom-validation-'));
  try {
    // A real malformed manifest makes Cargo reject this workspace before later gates run.
    await writeFile(join(directory, 'Cargo.toml'), '[package\n');
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/validate.mjs', import.meta.url))], {
      cwd: directory, env: process.env, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
    });
    assert.ifError(child.error); assert.equal(child.status, 1, child.stderr);
    const report = JSON.parse(await readFile(join(directory, 'reports/validation/latest.json'), 'utf8'));
    assert.equal(report.pass, false); assert.equal(report.gates.length, 1);
    assert.equal(report.gates[0].name, 'rust-format'); assert.notEqual(report.gates[0].exitCode, 0);
    assert.equal(report.gates[0].signal, null); assert.equal(report.gates[0].spawnError, null);
    assert.ok((await readFile(join(directory, 'reports/validation/rust-format.log'), 'utf8')).trim().length > 0);
  } finally {
    const actual = await realpath(directory);
    assert.equal(dirname(actual), await realpath(tmpdir())); assert.ok(basename(actual).startsWith('rustdom-validation-'));
    await rm(actual, { recursive: true });
  }
});
