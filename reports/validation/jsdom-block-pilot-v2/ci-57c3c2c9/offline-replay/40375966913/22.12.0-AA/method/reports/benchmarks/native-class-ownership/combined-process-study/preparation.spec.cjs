/** @file Exercises the real qualified assembly and the sampler's compatible runtime view without loading either DOM engine. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createManifest } = require('./preparation.cjs');
const identity = require('./constants/identity.json');
const { createSinglePackageWorker } = require('../single-package-worker.cjs');
const { settings } = require('./model.cjs');
const { schedule } = createSinglePackageWorker(settings);
const root = process.env.RUSTDOM_COMBINED_PACKAGE_ROOT;

test('authenticates every real package and preserves compiler versus transported Git identities', { skip: !root }, () => {
  const manifest = createManifest(root);
  assert.equal(manifest.samplerInvoked, false); assert.equal(manifest.performanceAccepted, null);
  assert.equal(manifest.preparation.fullCandidateFiles, 577);
  assert.equal(manifest.preparation.samplerCandidateFiles, 570);
  assert.deepEqual(manifest.distributions.B, identity.candidateRuntime);
  for (const label of ['A', 'B']) {
    assert.equal(manifest.sources[label].sourceCommit, null);
    assert.equal(manifest.sources[label].sourceChanges, null);
    assert.equal(manifest.sources[label].sourceGitErrors.length, 2);
    assert.equal(manifest.sources[label].sourceHash, identity.sourceHashes[label]);
  }
  assert.equal(manifest.compilerSources.A.commit, '3d37f89976a48203e80cc5c435e099267f4ce346');
  assert.equal(manifest.compilerSources.B.sourceCommit, 'f781c3b7549a86b6aa8b5a34d2bbb32038c315b7');
  assert.deepEqual(manifest.compilerSources.B.sourceGitErrors, []);
  const physicalRoots = Object.values(manifest.copies).map((directory) => fs.realpathSync.native(directory));
  assert.equal(new Set(physicalRoots).size, physicalRoots.length);
  for (const phase of settings.phases) for (const engine of settings.engines) {
    const planned = schedule(manifest, phase, engine, 0, 'B', 0);
    assert.equal(planned.root, manifest.copies[planned.physical]);
  }
  assert.ok(Object.keys(require.cache).every((filename) => !filename.startsWith(path.resolve(root) + path.sep)),
    'Package authentication must not import its runtime modules');
});
