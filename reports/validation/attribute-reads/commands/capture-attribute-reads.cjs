'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const [runtimeRoot, sourceRoot, taskRoot] = process.argv.slice(2);
const capture = require(runtimeRoot + '/benchmarks/sources.cjs').captureSourceIdentity;
const source = capture(runtimeRoot), managed = capture(sourceRoot);
assert.equal(source.sourceHash, managed.sourceHash);
const digest = (data) => createHash('sha256').update(data).digest('hex');
const files = source.measuredSources.map((file) => ({ path: file, sha256: digest(fs.readFileSync(path.join(runtimeRoot, file))) }));
const candidate = JSON.parse(fs.readFileSync(runtimeRoot + '/dist/native-build.json'));
const baseline = JSON.parse(fs.readFileSync(runtimeRoot + '/baseline-engine/dist/native-build.json'));
assert.equal(digest(fs.readFileSync(runtimeRoot + '/dist/rustdom.node')), candidate.binarySha256);
assert.equal(baseline.binarySha256, 'cc8852f6ba6e3755fbe8805948c8fb71bd140323b08b86d091727aacc8ed6753');
const proof = { capturedAt: new Date().toISOString(), sourceHash: source.sourceHash, source, managed, files,
  nativeBinarySha256: candidate.binarySha256, baselineNativeBinarySha256: baseline.binarySha256 };
for (const root of [sourceRoot + '/.cache', runtimeRoot + '/reports/validation/attribute-reads']) {
  fs.writeFileSync(root + '/attribute-reads-source.json', JSON.stringify(proof, null, 2) + '\n');
}
const rust = {};
for (const toolchain of ['stable', '1.99.1']) rust[toolchain] = execFileSync('rustc', ['+' + toolchain, '-Vv'], { encoding: 'utf8' }).trim();
const nodes = {};
for (const directory of ['node', 'node-22']) nodes[directory] = JSON.parse(execFileSync(taskRoot + '/.tools/' + directory + '/bin/node', ['-p', 'JSON.stringify(process.versions)'], { encoding: 'utf8' }));
fs.writeFileSync(runtimeRoot + '/reports/validation/attribute-reads/toolchains.json', JSON.stringify({ capturedAt: new Date().toISOString(), rust, nodes,
  machine: { platform: process.platform, arch: process.arch, kernel: require('node:os').release(), cpu: require('node:os').cpus()[0].model,
    logicalCpus: require('node:os').cpus().length, totalMemoryBytes: require('node:os').totalmem() } }, null, 2) + '\n');
console.log(JSON.stringify({ sourceHash: proof.sourceHash, files: files.length, nativeBinarySha256: candidate.binarySha256 }));
