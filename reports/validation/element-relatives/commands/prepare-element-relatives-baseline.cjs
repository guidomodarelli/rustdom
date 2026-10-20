'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = '/var/tmp/rustdom-pr72-validated-dist.EJKZBj';
const manifestBytes = fs.readFileSync(path.join(root, 'manifest.json'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(digest(manifestBytes), '13a36e163dec3e35da2299f95f2fb7ffda4490505e68dfae33314f28c012a99a');
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.commit, '2ae5f2cb71a3d5da7ed58e3eb5b87b558b887a47');
for (const entry of manifest.files) {
  const bytes = fs.readFileSync(path.join(root, entry.path));
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(digest(bytes), entry.sha256, entry.path);
}
const target = '/home/guido/rustdom-element-relatives-Tl8Wt9/baseline-engine';
fs.cpSync(path.join(root, 'dist'), path.join(target, 'dist'), { recursive: true });
for (const entry of manifest.files) assert.equal(digest(fs.readFileSync(path.join(target, entry.path))), entry.sha256, entry.path);
fs.writeFileSync('/home/guido/rustdom-element-relatives-Tl8Wt9/reports/validation/element-relatives/baseline-dist.json', JSON.stringify({ verifiedAt: new Date().toISOString(), ...manifest }, null, 2) + '\n');
console.log(JSON.stringify({ verified: manifest.files.length, baselineCommit: manifest.commit, addon: manifest.addonSha256 }));
