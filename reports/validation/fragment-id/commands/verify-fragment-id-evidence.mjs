import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const repositoryRoot = process.cwd();
const require = createRequire(`${repositoryRoot}/package.json`);
const manifestPath = 'reports/validation/fragment-id/evidence.json';
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
const comparison = JSON.parse(await readFile('reports/benchmarks/fragment-id/comparison.json'));
assert.equal(comparison.rawReports.length, 8); assert.equal(comparison.comparisons.length, 20);
for (const file of [...comparison.rawReports, ...manifest.packageReports]) assert.ok((await stat(file.path)).isFile(), file.path);
const codePaths = ['.gitattributes', 'ROADMAP.md', 'reports/progress/HANDOFF.md', 'reports/progress/native-migration.md',
  'reports/validation/fragment-id.md', 'reports/memory/fragment-id/README.md',
  'benchmarks/fragment-id.cjs', 'benchmarks/constants/fragment-id.cjs', 'benchmarks/compare.cjs',
  'benchmarks/worker.cjs', 'benchmarks/workload-plan.cjs', 'scripts/build.mjs',
  'src/dom/element_id.rs', 'src/dom/mod.rs', 'src/dom/native-tree.cjs', 'src/dom/tree.rs',
  'tests/fragment-id.spec.cjs', 'tests/helpers/fragment-id-memory.cjs',
  'tests/benchmarks/fragment-id.spec.cjs', 'types/native.d.cts', 'tests/fixtures/wpt/manifest.json', 'tests/fixtures/wpt/README.md'];
const upstream = JSON.parse(await readFile('reports/validation/fragment-id/wpt-upstream-source.json'));
for (const file of upstream.files) {
  const path = 'tests/fixtures/wpt/' + file.path;
  assert.equal(digest(await readFile(path)), file.sha256, path);
  codePaths.push(path);
}
const ownPaths = new Set([...manifest.files.map((file) => file.path), manifestPath,
  'reports/benchmarks/fragment-id/comparison.json', 'reports/benchmarks/fragment-id/README.md', ...codePaths]);
const status = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' });
assert.equal(status.status, 0);
const changed = status.stdout.split('\0').filter(Boolean).map((entry) => { assert.ok(!entry.startsWith('R')); return entry.slice(3); });
for (const path of changed) assert.ok(ownPaths.has(path), `Unowned or unexpected working-tree path: ${path}`);
await writeFile('.cache/fragment-id-owned-paths.txt', [...ownPaths].sort().join('\n') + '\n');
await writeFile('.cache/fragment-id-owned-source-hashes.json', JSON.stringify(await Promise.all(codePaths.map(async (path) => ({ path, sha256: digest(await readFile(path)) }))), null, 2) + '\n');
console.log(JSON.stringify({ preservedFiles: manifest.files.length, ownPaths: ownPaths.size, changedPaths: changed.length,
  sourceHash: source.sourceHash, checksumsValid: true }));
