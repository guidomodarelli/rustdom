/** @file Declares the resource reader dependency superset without changing the frozen scientific catalog or running DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const study = require('../../combined-process-study/study.cjs');
const capture = require('../../combined-process-study/constants/capture.json');
const { hashFile } = require('../../combined-process-study/io.cjs');
const config = require('../constants/exports.json');
const repository = path.resolve(__dirname, '../../../../..');
const directory = path.relative(repository, path.resolve(__dirname, '..')).split(path.sep).join('/');
const files = study.sourceFiles();
assert.equal(hashFile(path.join(repository, config.referencePublication.path)), config.referencePublication.sha256);
files[config.referencePublication.path] = config.referencePublication.sha256;
for (const descriptor of Object.values(config.helpers)) {
  assert.equal(hashFile(path.join(repository, descriptor.path)), descriptor.sha256); files[descriptor.path] = descriptor.sha256;
}
/** @param {string} relative - Current owned reader sources, never extracted code. @returns {void} Record every source/test except this nonrecursive catalog. */
function visit(relative) {
  for (const entry of fs.readdirSync(path.join(repository, relative), { withFileTypes: true })) {
    if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue;
    const name = relative + '/' + entry.name;
    if (name === directory + '/constants/ci-files.json') continue;
    assert.equal(entry.isSymbolicLink(), false);
    if (entry.isDirectory()) visit(name); else files[name] = hashFile(path.join(repository, name));
  }
}
visit(directory); files[config.workflow] = hashFile(path.join(repository, config.workflow));
console.log(JSON.stringify({ readerDirectory: directory, checkoutTimeoutSeconds: config.checkoutTimeoutSeconds,
  scientificMethodUnchanged: true, historicalPins: capture.historicalPins,
  files: Object.fromEntries(Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) }, null, 2));
