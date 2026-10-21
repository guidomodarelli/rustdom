'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const source = require(process.cwd() + '/benchmarks/sources.cjs').captureSourceIdentity();
const observed = execFileSync('git', ['hash-object', '--stdin-paths'], {
  input: source.measuredSources.join('\n') + '\n', encoding: 'utf8', maxBuffer: 1024 * 1024,
}).trim().split('\n');
assert.equal(observed.length, source.measuredSources.length);
for (const [index, path] of source.measuredSources.entries()) {
  const bytes = fs.readFileSync(path);
  const hash = createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
  assert.equal(observed[index], hash, path);
}
const proof = { capturedAt: new Date().toISOString(), sourceHash: source.sourceHash,
  files: source.measuredSources.length, canonicalFiltersPreserveBytes: true, readOnly: true };
fs.writeFileSync('.cache/attribute-reads-canonical-preflight.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof));
