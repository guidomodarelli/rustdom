'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const [runtimeRoot, repositoryRoot, primaryRoot] = process.argv.slice(2);
const paths = ['src/dom/element_id.rs', 'src/dom/mod.rs', 'src/dom/tree.rs', 'src/dom/native-tree.cjs', 'scripts/build.mjs',
  'types/native.d.cts', 'benchmarks/constants/fragment-id.cjs', 'benchmarks/fragment-id.cjs', 'benchmarks/worker.cjs',
  'benchmarks/workload-plan.cjs', 'benchmarks/compare.cjs', 'tests/fragment-id.spec.cjs', 'tests/helpers/fragment-id-memory.cjs',
  'tests/benchmarks/fragment-id.spec.cjs', 'tests/fixtures/wpt/manifest.json', 'tests/fixtures/wpt/README.md'];
const upstream = JSON.parse(fs.readFileSync(primaryRoot + '/.cache/fragment-id-wpt-source.json'));
for (const file of upstream.files) paths.push('tests/fixtures/wpt/' + file.path);
const hashes = [];
for (const relativePath of paths) {
  const bytes = fs.readFileSync(runtimeRoot + '/' + relativePath);
  const target = repositoryRoot + '/' + relativePath;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(createHash('sha256').update(fs.readFileSync(target)).digest('hex'), sha256);
  hashes.push({ path: relativePath, sha256 });
}
fs.writeFileSync(repositoryRoot + '/.cache/fragment-id-copied-source-hashes.json', JSON.stringify(hashes, null, 2) + '\n');
console.log(JSON.stringify({ copied: hashes.length, allHashesMatch: true }));
