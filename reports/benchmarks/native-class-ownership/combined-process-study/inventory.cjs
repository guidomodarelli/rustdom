/** @module combined-capture-inventory Enumerates data bytes and physical directories without importing any captured source. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hashFile: hash } = require('./io.cjs');
const capture = require('./constants/capture.json');

/** @param {string} directory - Current data extraction or fresh capture directory. @returns {object} Full physical inventory except the two explicitly self-referential metadata files. */
function snapshot(directory) {
  const root = fs.realpathSync.native(directory); const files = {}; const directories = [];
  const excluded = new Set([capture.files.index, capture.files.inventory]);
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
      const filename = path.join(current, entry.name); const relative = path.relative(root, filename).split(path.sep).join('/');
      if (excluded.has(relative)) continue;
      assert.equal(entry.isSymbolicLink(), false, 'Combined inventory: linked data member');
      if (entry.isDirectory()) { directories.push(relative); visit(filename); }
      else { assert.ok(entry.isFile(), 'Combined inventory: regular files and directories only'); files[relative] = { bytes: fs.statSync(filename).size, sha256: hash(filename) }; }
    }
  }
  visit(root);
  return { directories: directories.sort(), files: Object.fromEntries(Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) };
}
module.exports = { snapshot };
