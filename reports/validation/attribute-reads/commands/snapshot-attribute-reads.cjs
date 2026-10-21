'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const files = fs.readFileSync('.cache/attribute-reads-owned-sources.txt', 'utf8').trim().split('\n');
const snapshot = '.cache/attribute-reads-review-snapshot';
const entries = files.map((file) => {
  const data = fs.readFileSync(file); const destination = path.join(snapshot, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, data);
  return { path: file, sha256: createHash('sha256').update(data).digest('hex') };
});
fs.writeFileSync('.cache/attribute-reads-review.json', JSON.stringify({ capturedAt: new Date().toISOString(), base: 'baa87fa3eb1a62ec6477013bb305b2a79a0c3bb6', entries }, null, 2) + '\n');
console.log(JSON.stringify({ snapshot, files: entries.length }));
