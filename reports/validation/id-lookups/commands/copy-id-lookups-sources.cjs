'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const [runtime, repository, primary] = process.argv.slice(2);
const paths = ['src/dom/document_ids.rs', 'src/dom/mod.rs', 'src/dom/store.rs', 'src/dom/error.rs', 'src/dom/element_id.rs',
  'src/dom/tree.rs', 'src/dom/native-tree.cjs', 'scripts/build.mjs', 'scripts/memory-endpoint.cjs',
  'scripts/constants/id-lookups-memory.cjs', 'types/index.d.cts', 'types/native.d.cts',
  'tests/id-lookups.spec.cjs', 'tests/helpers/id-lookups-memory.cjs'];
const hashes = [];
for (const relativePath of paths) {
  const bytes = fs.readFileSync(runtime + '/' + relativePath); const target = repository + '/' + relativePath;
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(createHash('sha256').update(fs.readFileSync(target)).digest('hex'), sha256);
  hashes.push({ path: relativePath, sha256 });
}
const source = require(runtime + '/benchmarks/sources.cjs').captureSourceIdentity(runtime);
fs.writeFileSync(repository + '/.cache/id-lookups-runtime-source.json', JSON.stringify(source, null, 2) + '\n');
fs.writeFileSync(repository + '/.cache/id-lookups-copied-hashes.json', JSON.stringify(hashes, null, 2) + '\n');
fs.writeFileSync(primary + '/.cache/id-lookups-runtime-source.json', JSON.stringify(source, null, 2) + '\n');
console.log(JSON.stringify({ copied: hashes.length, sourceHash: source.sourceHash, measuredSources: source.measuredSources.length }));
