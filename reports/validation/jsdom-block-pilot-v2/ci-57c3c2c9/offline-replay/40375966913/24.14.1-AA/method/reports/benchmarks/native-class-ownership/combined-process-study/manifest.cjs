/** @module combined-capture-manifest Binds the independently qualified package to its recorded physical location without rewriting source provenance. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path').posix;
const identity = require('./constants/identity.json');
const assembly = require('../range-combined-packages/constants/assembly.json');
const reference = structuredClone(require('./fixtures/functional-worker.json').manifest);

/** @param {string} directory - Original absolute Linux package location, not the replay destination. @returns {object} Full known package declaration with only transport locations rebound. */
function forLocation(directory) {
  assert.equal(typeof directory, 'string'); assert.ok(path.isAbsolute(directory));
  assert.equal(path.normalize(directory), directory, 'Combined manifest: a canonical original package location is required');
  const manifest = structuredClone(reference); const controls = path.join(directory, assembly.paths.controls);
  manifest.copies = Object.fromEntries(Object.keys(identity.distributions).map((label) => [label,
    label === 'B' ? path.join(directory, assembly.paths.candidate) : path.join(controls, 'packages', label)]));
  manifest.roots = { A: path.join(controls, 'baseline-sources'), B: path.join(directory, assembly.paths.sources) };
  manifest.dependencies = path.join(controls, 'node_modules');
  return manifest;
}

/** @param {object} manifest - Saved complete declaration. @param {string} directory - Recorded original package location. @returns {object} Unchanged input after matching all identities, Git metadata and physical path relationships. */
function verify(manifest, directory) {
  assert.deepEqual(manifest, forLocation(directory), 'Combined manifest: package identity or source provenance differs');
  return manifest;
}
module.exports = { forLocation, verify };
