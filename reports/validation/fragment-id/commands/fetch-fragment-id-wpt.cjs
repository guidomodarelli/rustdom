'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const revision = '8d124dbe46f46f55531f28f13eccf1113f794c12';
const root = path.resolve('.cache/fragment-id-wpt-files');
const files = [];
for (const resource of ['dom/nodes/Document-getElementById.html', 'dom/nodes/DocumentFragment-getElementById.html',
  'shadow-dom/getElementById-dynamic-001.html', 'shadow-dom/getElementById-dynamic-002.html']) {
  const response = JSON.parse(execFileSync('gh', ['api', `repos/web-platform-tests/wpt/contents/${resource}?ref=${revision}`], { encoding: 'utf8' }));
  assert.equal(response.encoding, 'base64');
  const bytes = Buffer.from(response.content, 'base64');
  const gitSha1 = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(gitSha1, response.sha);
  const target = path.resolve(root, resource);
  assert.ok(!path.relative(root, target).startsWith('..'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  files.push({ path: resource, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), gitSha1, url: response.download_url });
}
fs.writeFileSync('.cache/fragment-id-wpt-source.json', JSON.stringify({ fetchedAt: new Date().toISOString(), revision, files }, null, 2) + '\n');
console.log(JSON.stringify({ revision, files: files.length, totalBytes: files.reduce((total, file) => total + file.bytes, 0) }));
