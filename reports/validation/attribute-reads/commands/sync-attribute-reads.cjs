'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('branch', '--show-current'), 'feature/native-attribute-reads');
assert.equal(git('rev-parse', 'HEAD'), 'baa87fa3eb1a62ec6477013bb305b2a79a0c3bb6');
const files = [...new Set([...git('diff', '--name-only', '--diff-filter=ACM').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n')])]
  .filter((path) => /^(src|scripts|types|tests|benchmarks)\//.test(path));
assert.ok(files.length >= 15);
fs.writeFileSync('.cache/attribute-reads-owned-sources.txt', files.join('\n') + '\n');
console.log(JSON.stringify({ paths: files.length }));
