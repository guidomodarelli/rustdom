/** @file Archives this milestone's real executions without copying inherited report history. */
'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');
const { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } = require('node:fs');
const { resolve, dirname, relative } = require('node:path');
const [runtime, managed, taskRoot] = process.argv.slice(2).map((value) => resolve(value));
const validation = 'reports/validation/native-class-ownership';
// The orchestrator writes this receipt from the terminal tool's exit result,
// never from log existence or an observed process disappearing.
const receiptPath = resolve(taskRoot, '.cache/native-class-validation-terminal.json');
assert.ok(existsSync(receiptPath), 'Observe the original validation handle exit 0 and save its terminal receipt before archiving');
const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
assert.equal(receipt.exitCode, 0, 'The validation process must exit successfully');
assert.equal(receipt.runtime, runtime);
assert.equal(receipt.command, '.cache/validate-native-class-base67.sh');
assert.equal(receipt.binarySha256, digestFile(resolve(runtime, 'dist/rustdom.node')));

/** Hash one artifact without interpreting its content. */
function digestFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
const sourceFiles = (directory) => readdirSync(resolve(runtime, directory), { withFileTypes: true }).flatMap((entry) => {
  const entryPath = `${directory}/${entry.name}`;
  return entry.isDirectory() ? sourceFiles(entryPath) : [entryPath];
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const store = (path, bytes) => {
  const target = resolve(managed, path);
  assert.ok(relative(managed, target).startsWith('reports/'));
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) assert.equal(digest(readFileSync(target)), digest(bytes), `Preserve existing ${path}`);
  else writeFileSync(target, bytes);
};
const logs = sourceFiles(validation);
assert.ok(logs.includes(`${validation}/base67/package-v24.14.1.log`), 'The completed validation must include its final package log');
const generated = new Set();
const observations = [];
const receiptBytes = readFileSync(receiptPath);
const storedReceiptPath = `${validation}/base67/terminal-result.json`;
store(storedReceiptPath, receiptBytes);
observations.push({ path: storedReceiptPath, bytes: receiptBytes.length, sha256: digest(receiptBytes) });
for (const path of logs) {
  const bytes = readFileSync(resolve(runtime, path));
  store(path, bytes);
  observations.push({ path, bytes: bytes.length, sha256: digest(bytes) });
  if (path.endsWith('.log')) {
    for (const match of bytes.toString('utf8').matchAll(/reports\/(?:compatibility|memory|distribution)\/[A-Za-z0-9_.\/-]+\.(?:json|md)/g)) {
      if (existsSync(resolve(runtime, match[0]))) generated.add(match[0]);
    }
  }
}
const artifacts = [];
for (const path of [...generated].sort()) {
  assert.ok(/^reports\/(compatibility|memory|distribution)\/2026-10-21T/.test(path), `Unexpected historical report ${path}`);
  const bytes = readFileSync(resolve(runtime, path));
  const compressed = bytes.length > 1024 * 1024 && path.endsWith('.json');
  const storedBytes = compressed ? gzipSync(bytes, { level: 9 }) : bytes;
  if (compressed) assert.deepEqual(gunzipSync(storedBytes), bytes);
  const storedPath = `${path}${compressed ? '.gz' : ''}`;
  store(storedPath, storedBytes);
  artifacts.push({ originalPath: path, originalBytes: bytes.length, originalSha256: digest(bytes),
    storedPath, storedBytes: storedBytes.length, storedSha256: digest(storedBytes),
    losslessRoundTripVerified: compressed ? true : null });
}
const identity = require(resolve(runtime, 'benchmarks/sources.cjs')).captureSourceIdentity(runtime);
const sourcePaths = [...new Set([...identity.measuredSources, 'package.json', 'tests/wpt/run.cjs',
  'tests/native-class-construction.spec.cjs', 'tests/fixtures/native-class-construction-worker.cjs'])].sort();
const sources = sourcePaths.map((path) => {
  const bytes = readFileSync(resolve(runtime, path));
  assert.equal(digest(bytes), digest(readFileSync(resolve(managed, path))), `Runtime/source mismatch ${path}`);
  return { path, bytes: bytes.length, sha256: digest(bytes) };
});
const probes = ['probe-sdk-constructors.cjs', 'probe-sdk-range-copy.cjs'];
for (const name of probes) store(`${validation}/commands/${name}`, readFileSync(resolve(taskRoot, '.cache', name)));
for (const name of ['validate-native-class-base67.sh', 'rebuild-native-class-constructors.sh',
  'validate-native-class-ownership.sh', 'resume-native-class-wpt.sh', 'archive-native-class-ownership.cjs']) {
  store(`${validation}/commands/${name}`, readFileSync(resolve(taskRoot, '.cache', name)));
}
store('reports/benchmarks/native-class-ownership/run-protocol.cjs', readFileSync(resolve(taskRoot, '.cache/benchmark-native-class-ownership.cjs')));
store(`${validation}/native-build-final.json`, readFileSync(resolve(runtime, 'dist/native-build.json')));
const manifest = { capturedAt: new Date().toISOString(), baseCommit: '3d37f89976a48203e80cc5c435e099267f4ce346',
  runtime, terminalReceipt: receipt, binarySha256: digest(readFileSync(resolve(runtime, 'dist/rustdom.node'))),
  sourceIdentity: identity, sources, logs: observations, artifacts,
  archivalRule: 'Only this milestone validation directory and report paths emitted by its logs; inherited history is excluded. JSON above 1 MiB is gzip with verified byte-for-byte round trip.' };
const manifestPath = resolve(managed, validation, 'manifest.json');
assert.ok(!existsSync(manifestPath), 'Preserve an existing final archive manifest');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ logs: observations.length, artifacts: artifacts.length,
  originalBytes: artifacts.reduce((total, artifact) => total + artifact.originalBytes, 0),
  storedBytes: artifacts.reduce((total, artifact) => total + artifact.storedBytes, 0),
  sourceHash: identity.sourceHash, binarySha256: manifest.binarySha256 })}\n`);
