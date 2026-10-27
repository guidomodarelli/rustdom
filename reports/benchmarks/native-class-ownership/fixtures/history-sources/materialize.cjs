/** @file Restores independently preserved real source trees for history and source-preflight contracts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const manifest = require('./manifest.json');

/** @param {import('node:test').TestContext} context - Owns and cleans both historical trees. @returns {object} Actual source roots. */
function historicalSources(context) {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-history-sources-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(tmpdir()));
    assert.ok(path.basename(directory).startsWith('rustdom-history-sources-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  for (const [label, source] of Object.entries(manifest.sources)) {
    const snapshot = fs.readFileSync(path.join(__dirname, source.snapshot));
    assert.equal(createHash('sha256').update(snapshot).digest('hex'), source.sha256,
      `Historical source snapshot checksum differs: ${source.snapshot}`);
    const files = JSON.parse(gunzipSync(snapshot).toString('utf8'));
    assert.equal(files.length, source.measuredSourceCount);
    for (const file of files) {
      const destination = path.join(directory, label, file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from(file.bytes, 'base64'));
    }
  }
  const candidate = path.join(directory, 'B');
  const protocolRoot = path.join(candidate, 'reports/benchmarks/native-class-ownership');
  const archive = path.resolve(__dirname, '../../hosted/39643090437');
  for (const [file, archivedName] of Object.entries(manifest.protocolFiles)) {
    const destination = path.join(protocolRoot, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(archive, archivedName), destination);
  }
  return { baseline: path.join(directory, 'A'), candidate };
}
module.exports = { historicalSources };
