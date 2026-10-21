/** @file Selects existing measurements only when both measured source trees and the original protocol still match. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { protocolFiles } = require('./constants/history.cjs');

/**
 * Identify reusable evidence without interpreting its acceptance flag or executing another measurement.
 * The caller must still verify every archived observation and enforce its recomputed result.
 * @param {string} baselineRoot - Real reference tree checked out by CI.
 * @param {string} archiveRoot - Existing or absent experiment directory.
 * @param {string} [candidateRoot] - Real candidate source tree.
 * @returns {boolean} Whether source and protocol bytes match the completed experiment.
 */
function canReuse(baselineRoot, archiveRoot, candidateRoot = process.cwd()) {
  const indexPath = path.join(archiveRoot, 'index.json');
  if (!fs.existsSync(indexPath)) return false;
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if (!index.complete) return false;
  const { captureSourceIdentity } = require(path.join(candidateRoot, 'benchmarks/sources.cjs'));
  if (captureSourceIdentity(candidateRoot).sourceHash !== index.sources.B.sourceHash ||
      captureSourceIdentity(baselineRoot).sourceHash !== index.sources.A.sourceHash) return false;
  const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const protocolRoot = path.join(candidateRoot, 'reports/benchmarks/native-class-ownership');
  return Object.entries(protocolFiles).every(([file, archivedName]) =>
    hash(path.join(protocolRoot, file)) === index.files[archivedName]);
}

if (require.main === module) process.stdout.write(`reuse=${canReuse(path.resolve(process.argv[2]), path.resolve(process.argv[3]))}\n`);
module.exports = { canReuse };
