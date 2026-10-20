'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const revision = '8d124dbe46f46f55531f28f13eccf1113f794c12';
const directory = 'html/dom/documents/dom-tree-accessors/document.getElementsByName';
const root = path.resolve('tests/fixtures/wpt');
const api = (resource) => JSON.parse(execFileSync('gh', ['api', `repos/web-platform-tests/wpt/contents/${resource}?ref=${revision}`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
const entries = api(directory);
const files = [];
for (const entry of entries) {
  assert.ok(entry.path.startsWith(directory + '/'));
  const target = path.resolve(root, entry.path);
  assert.ok(!path.relative(root, target).startsWith('..'));
  const response = api(entry.path);
  assert.equal(response.encoding, 'base64');
  const bytes = Buffer.from(response.content, 'base64');
  const gitSha1 = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(gitSha1, response.sha);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes);
  else fs.writeFileSync(target, bytes, { flag: 'wx' });
  files.push({ path: entry.path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), gitSha1, url: entry.download_url });
}
fs.writeFileSync('C:/Users/guido/ghq/projects/rustdom/.cache/name-query-wpt-source.json', JSON.stringify({ fetchedAt: new Date().toISOString(), revision, directory, files }, null, 2) + '\n');
console.log(JSON.stringify({ revision, files: files.length, totalBytes: files.reduce((total, file) => total + file.bytes, 0) }));
