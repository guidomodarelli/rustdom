/** @module pilot-workspace Creates the shared functional/capture layout before copying the real source snapshot. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { writeNewJSON } = require('./io.cjs');
const policy = require('../constants/capture.json');

/**
 * Initialize an existing fresh producer-owned workspace exactly once.
 * Both producer roles use this preparation, including the embedded sealed package.
 * @param {object} origin - Actual source identity returned by the current source API.
 * @param {string} destination - Existing physical workspace owned by the producer.
 * @param {object} source - Real source API; no replacement implementation is used by qualification.
 * @returns {object} Independently hash-checked snapshot index written to the workspace.
 */
function prepareWorkspace(origin, destination, source) {
  const status = fs.lstatSync(destination);
  assert.ok(status.isDirectory() && !status.isSymbolicLink(), 'Pilot workspace: physical owned directory required');
  fs.mkdirSync(path.join(destination, 'inputs'));
  fs.mkdirSync(path.join(destination, 'workers'));
  const snapshot = source.snapshot(origin, destination);
  writeNewJSON(path.join(destination, policy.methodSnapshotIndex), snapshot);
  return snapshot;
}

module.exports = { prepareWorkspace };
