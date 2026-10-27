/** @file Restores actual checkpoint066 and measured C sources for XML history contracts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const manifest = require('./manifest.json');

/** @param {import('node:test').TestContext} context - Owns the temporary real trees. @returns {object} Historical sources and immutable recipe. */
function historicalSources(context) {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-xml-history-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(tmpdir()));
    assert.ok(path.basename(directory).startsWith('rustdom-xml-history-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const baseline = path.join(directory, 'baseline');
  const candidate = path.join(directory, 'candidate');
  const compressed = fs.readFileSync(path.join(__dirname, manifest.snapshot));
  assert.equal(createHash('sha256').update(compressed).digest('hex'), manifest.snapshotSha256);
  const files = JSON.parse(gunzipSync(compressed));
  assert.equal(files.length, manifest.measuredSourceCount);
  for (const file of files) {
    const destination = path.join(baseline, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(file.bytes, 'base64'));
  }
  const frozen = path.resolve(__dirname, '../../paired-inline/2026-10-22/node-22');
  const index = JSON.parse(fs.readFileSync(path.join(frozen, 'index.json')));
  for (const name of index.harness.identity.measuredSources) {
    const destination = path.join(candidate, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(frozen, 'harness', name), destination);
  }
  const workflow = path.join(candidate, manifest.recipe.workflowPath);
  const buildPayload = fs.readFileSync(path.join(__dirname, manifest.buildInputs));
  assert.equal(createHash('sha256').update(buildPayload).digest('hex'), manifest.buildInputsSha256);
  for (const [label, entries] of Object.entries(JSON.parse(gunzipSync(buildPayload)))) {
    for (const entry of entries) {
      const destination = path.join(label === 'baseline' ? baseline : candidate, entry.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from(entry.bytes, 'base64'));
    }
  }
  fs.mkdirSync(path.dirname(workflow), { recursive: true });
  fs.copyFileSync(path.join(__dirname, manifest.workflowFile), workflow);
  return { directory, baseline, candidate, recipe: manifest.recipe };
}
module.exports = { historicalSources };
