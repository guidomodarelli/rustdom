'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');
const minimumBytes = 1024 ** 2;
const added = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=A'], { encoding: 'utf8' }).trim().split('\n');
const selected = added.filter((relative) => relative.startsWith('reports/compatibility/') && relative.endsWith('.json') && fs.statSync(relative).size >= minimumBytes);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const entries = [];
for (const relative of selected) {
  const raw = fs.readFileSync(relative), archive = gzipSync(raw, { level: 9 });
  assert.equal(digest(gunzipSync(archive)), digest(raw));
  const compressedPath = relative + '.gz';
  fs.writeFileSync(compressedPath, archive, { flag: 'wx' });
  entries.push({ originalPath: relative, compressedPath, originalBytes: raw.length, compressedBytes: archive.length,
    originalSha256: digest(raw), compressedSha256: digest(archive), codec: 'gzip' });
}
fs.writeFileSync('reports/compatibility/xml-serializer-controller-archives.json', JSON.stringify({
  capturedAt: new Date().toISOString(), minimumBytes, scope: 'Only newly added compatibility results of the XMLSerializer controller work; original bytes are losslessly preserved.', entries,
}, null, 2) + '\n', { flag: 'wx' });
for (const relative of selected) {
  execFileSync('git', ['restore', '--staged', '--', relative]);
  assert.equal(digest(fs.readFileSync(relative)), entries.find((entry) => entry.originalPath === relative).originalSha256);
  fs.unlinkSync(relative);
}
console.log(JSON.stringify({ files: entries.length, originalBytes: entries.reduce((total, entry) => total + entry.originalBytes, 0),
  compressedBytes: entries.reduce((total, entry) => total + entry.compressedBytes, 0) }));
