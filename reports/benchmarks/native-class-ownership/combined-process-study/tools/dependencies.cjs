/** @file Declares current contract dependencies and authenticates all historical pins without loading a DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../model.cjs'); require('../compare.cjs'); require('../preparation.cjs');
require('../../range-collapse-study/model.cjs');
const repository = path.resolve(__dirname, '../../../../..');
const methodDirectory = path.relative(repository, path.resolve(__dirname, '..')).split(path.sep).join('/');
const packageDirectory = 'reports/benchmarks/native-class-ownership/range-combined-packages';
const frozenReceipt = 'reports/validation/native-class-ownership/range-control-telemetry-method/review.json';
const receipt = JSON.parse(fs.readFileSync(path.join(repository, frozenReceipt), 'utf8'));
const { hashFile } = require('../io.cjs');
const sha = (name) => hashFile(path.join(repository, name));
assert.equal(sha(frozenReceipt), 'bdab7f4639f99054c93b1f4f962f233a9e5feb98db6ea6c708de4da87e5be9fb');
assert.equal(Object.keys(receipt.files).length, 599);
for (const [name, expected] of Object.entries(receipt.files)) assert.equal(sha(name), expected, name);
const names = new Set([...Object.keys(receipt.files), frozenReceipt]);
names.add('.github/workflows/combined-process-study-contracts.yml');
for (const filename of Object.keys(require.cache)) {
  const relative = path.relative(repository, filename).split(path.sep).join('/');
  assert.ok(!relative.startsWith('../') && !path.isAbsolute(relative)); names.add(relative);
}
/** @param {string} relative - Own current source directory. @returns {void} Include every current reader and its data declarations, excluding caches/self-reference. */
function walk(relative) {
  for (const entry of fs.readdirSync(path.join(repository, relative), { withFileTypes: true })) {
    if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue;
    const filename = relative + '/' + entry.name;
    if (filename === methodDirectory + '/constants/ci-files.json') continue;
    assert.equal(entry.isSymbolicLink(), false);
    if (entry.isDirectory()) walk(filename); else names.add(filename);
  }
}
walk(methodDirectory); walk(packageDirectory);
walk('reports/benchmarks/native-class-ownership/range-combined-study');
const packagePolicy = require('../../range-combined-packages/constants/archive.json');
names.add(packagePolicy.archive.path); names.add(packagePolicy.members.path); names.add(packagePolicy.extractor.path);
const binding = require('../../range-combined-packages/constants/artifact-binding.json');
for (const name of Object.keys(binding.collectionFiles)) names.add(binding.collectionDirectory + '/' + name);
names.add('reports/implementation/range-combined-candidate/source.json');
names.add(require('../constants/protocol.json').derivation.canonicalManifest);
const portable = require('../constants/portable.json');
names.add(portable.qualificationArchive.path); names.add(portable.qualificationManifest.path);
names.add(require('../constants/capture.json').workflow);
for (const name of Object.keys(require('../constants/transport-reference.json').files)) names.add(name);
for (const role of ['reader', 'extractor']) {
  const descriptor = require('../constants/transport.json')[role]; names.add(descriptor.path);
  for (const dependency of descriptor.dependencies || []) names.add(dependency.path);
}
const policy = { methodDirectory, checkoutTimeoutSeconds: 300, historicalPins: 599,
  contractScope: 'numerical-and-read-only-real-package-preparation', samplerInvoked: false,
  files: Object.fromEntries([...names].sort().map((name) => [name, sha(name)])) };
console.log(JSON.stringify(policy, null, 2));
