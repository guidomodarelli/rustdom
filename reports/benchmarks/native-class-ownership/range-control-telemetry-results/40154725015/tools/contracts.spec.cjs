/** @file Exercises actual reader output boundaries and CSV behavior without executing a DOM. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { analyze, csvWriter, originFor } = require('./analyze.cjs');

const capture = fs.realpathSync(process.env.NATIVE_RESULT_CAPTURE);
const replay = fs.realpathSync(process.env.NATIVE_RESULT_REPLAY);
const index = JSON.parse(fs.readFileSync(path.join(capture, 'index.json'), 'utf8'));

/** Create and remove only this test's fresh directory under the actual system temporary directory. */
function temporary(work) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'rustdom-native-result-contract-'));
  try { work(root); } finally {
    assert.equal(path.dirname(root), parent); assert.equal(fs.realpathSync(root), root);
    fs.rmSync(root, { recursive: true });
  }
}

test('the public analyzer refuses direct and symlinked output inside its input before writing any file', () => {
  temporary((root) => {
    const input = path.join(root, 'input'); fs.mkdirSync(input);
    fs.copyFileSync(path.join(capture, 'index.json'), path.join(input, 'index.json'));
    const alias = path.join(root, 'alias'); fs.symlinkSync(input, alias, 'dir');
    for (const base of [input, alias]) {
      assert.throws(() => analyze(input, path.join(base, 'output'), replay), {
        code: 'ERR_ASSERTION', message: 'Native result analysis: output overlaps authenticated capture' });
      assert.deepEqual(fs.readdirSync(input), ['index.json']);
    }
  });
});

test('the real CLI preserves an existing destination and the caller file', () => {
  temporary((root) => {
    const output = path.join(root, 'output'); fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, 'user.txt'), 'preserve this file');
    const result = spawnSync(process.execPath, [path.join(__dirname, 'analyze.cjs'), capture, output, replay], { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(result.status, 0); assert.ok(result.stderr.includes('EEXIST'));
    assert.deepEqual(fs.readdirSync(output), ['user.txt']);
    assert.equal(fs.readFileSync(path.join(output, 'user.txt'), 'utf8'), 'preserve this file');
  });
});

test('an incomplete or changed index cannot borrow this diagnostic identity or produce an output', () => {
  temporary((root) => {
    const input = path.join(root, 'input'); fs.mkdirSync(input);
    const changed = { ...index, complete: false };
    fs.writeFileSync(path.join(input, 'index.json'), JSON.stringify(changed));
    const output = path.join(root, 'output');
    assert.throws(() => analyze(input, output, replay), { code: 'ERR_ASSERTION' });
    assert.equal(fs.existsSync(output), false);
  });
});

test('streaming CSV preserves UTF-8 quotes and embedded newlines across multiple buffer flushes', () => {
  temporary((root) => {
    const filename = path.join(root, 'output.csv');
    const writer = csvWriter(filename, ['name', 'url']);
    const row = { name: '"ñ😀"\nfin', url: 'node:internal/test' };
    for (let ordinal = 0; ordinal < 2000; ordinal++) writer.write(row);
    writer.close();
    const expected = '"name","url"\n' + '"""ñ😀""\nfin","node:internal/test"\n'.repeat(2000);
    assert.equal(fs.readFileSync(filename, 'utf8'), expected);
    assert.throws(() => csvWriter(filename, ['other']), { code: 'EEXIST' });
    assert.equal(fs.readFileSync(filename, 'utf8'), expected);
  });
});

test('actual recorded frame URLs distinguish compatibility JavaScript from rustdom JavaScript and the reference', () => {
  const roots = { reference: [index.manifest.copies.J0, index.manifest.copies.J1],
    native: [index.manifest.copies.A0, index.manifest.copies.A1, index.manifest.copies.B],
    dependencies: path.posix.dirname(path.posix.dirname(index.manifest.copies.J0)) + '/node_modules',
    instrumentation: path.posix.dirname(index.processes[0].argv.find((argument) => argument.endsWith('/worker.cjs'))) };
  const samples = index.processes.flatMap((entry, ordinal) => entry.input.mode === 'cpu' ? JSON.parse(fs.readFileSync(path.join(capture, String(ordinal).padStart(4, '0'), 'analysis.json'), 'utf8')).spans : [])
    .flatMap((span) => span.cpuFrames).map((counted) => counted.frame.url);
  const compatibility = samples.find((url) => url.includes('/dist/vendor-jsdom/'));
  const nativeJavascript = samples.find((url) => url.includes('/dist/native-tree.cjs'));
  const reference = samples.find((url) => url.includes('/packages/J0/lib/jsdom/'));
  assert.ok(compatibility && nativeJavascript && reference);
  assert.equal(originFor(compatibility, roots), 'compatibility-jsdom');
  assert.equal(originFor(nativeJavascript, roots), 'rustdom-javascript');
  assert.equal(originFor(reference, roots), 'reference-jsdom');
  assert.equal(originFor('', roots), 'unknown');
});
