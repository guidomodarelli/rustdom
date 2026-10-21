import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const repositoryRoot = process.cwd();
const require = createRequire(`${repositoryRoot}/package.json`);
const manifestPath = 'reports/validation/id-lookups/evidence.json';
const manifest = JSON.parse(await readFile(manifestPath));
const source = require('./benchmarks/sources.cjs').captureSourceIdentity(repositoryRoot);
assert.equal(source.sourceHash, manifest.sourceHash);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const file of manifest.files) {
  const bytes = await readFile(file.path);
  assert.equal(bytes.length, file.bytes, file.path); assert.equal(digest(bytes), file.sha256, file.path);
  if (file.compression === 'gzip') {
    const original = gunzipSync(bytes);
    assert.equal(original.length, file.originalBytes, file.path); assert.equal(digest(original), file.originalSha256, file.path);
  }
}
for (const file of manifest.validationSources) assert.equal(digest(await readFile(file.path)), file.sha256, file.path);
for (const file of manifest.review.files) assert.equal(digest(await readFile(file.path)), file.sha256, file.path);
const comparison = JSON.parse(await readFile('reports/benchmarks/id-lookups/comparison.json'));
assert.equal(comparison.rawReports.length, 8); assert.equal(comparison.comparisons.length, 36);
for (const file of [...comparison.rawReports, ...manifest.packageReports]) assert.ok((await stat(file.path)).isFile(), file.path);
const codePaths = ['.gitattributes', 'ROADMAP.md', 'reports/progress/HANDOFF.md', 'reports/progress/native-migration.md',
  'reports/validation/id-lookups.md', 'reports/memory/id-lookups/README.md',
  'benchmarks/constants/id-lookups.cjs', 'benchmarks/id-lookups.cjs', 'benchmarks/worker.cjs', 'benchmarks/workload-plan.cjs',
  'scripts/build.mjs', 'scripts/memory-endpoint.cjs', 'scripts/constants/id-lookups-memory.cjs',
  'src/dom/document_ids.rs', 'src/dom/element_id.rs', 'src/dom/error.rs', 'src/dom/mod.rs',
  'src/dom/native-tree.cjs', 'src/dom/store.rs', 'src/dom/tree.rs',
  'tests/id-lookups.spec.cjs', 'tests/helpers/id-lookups-memory.cjs', 'tests/benchmarks/id-lookups.spec.cjs',
  'types/index.d.cts', 'types/native.d.cts'];
const ownPaths = new Set([...manifest.files.map((file) => file.path), manifestPath,
  'reports/benchmarks/id-lookups/comparison.json', 'reports/benchmarks/id-lookups/README.md', ...codePaths]);
const status = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' });
assert.equal(status.status, 0);
const changed = status.stdout.split('\0').filter(Boolean).map((entry) => { assert.ok(!entry.startsWith('R')); return entry.slice(3); });
for (const path of changed) assert.ok(ownPaths.has(path), `Unowned or unexpected working-tree path: ${path}`);
await writeFile('.cache/id-lookups-owned-paths.txt', [...ownPaths].sort().join('\n') + '\n');
await writeFile('.cache/id-lookups-owned-source-hashes.json', JSON.stringify(await Promise.all(codePaths.map(async (path) => ({ path, sha256: digest(await readFile(path)) }))), null, 2) + '\n');
console.log(JSON.stringify({ preservedFiles: manifest.files.length, ownPaths: ownPaths.size, changedPaths: changed.length,
  sourceHash: source.sourceHash, checksumsValid: true }));
