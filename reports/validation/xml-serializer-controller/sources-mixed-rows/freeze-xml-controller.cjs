'use strict';
const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
const directory = path.join(root, 'reports/validation/xml-serializer-controller/sources');
fs.mkdirSync(directory, { recursive: true });
const sourceIdentity = require(path.join(root, 'benchmarks/sources.cjs')).captureSourceIdentity(root);
const files = new Set(sourceIdentity.measuredSources);
function add(relative) {
  const absolute = path.join(root, relative);
  if (fs.statSync(absolute).isDirectory()) {
    for (const entry of fs.readdirSync(absolute)) if (relative !== 'tests' || entry !== 'fixtures') add(relative + '/' + entry);
  } else files.add(relative);
}
for (const relative of ['types', 'tests', 'package.json', 'AGENTS.md', '.github']) add(relative);
const ordered = [...files].sort();
const manifest = ordered.map((relative) => ({ path: relative, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex') }));
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ sourceIdentity, files: manifest }, null, 2) + '\n');
fs.writeFileSync(path.join(directory, 'paths.txt'), ordered.join('\n') + '\n');
const archive = path.join(directory, 'source.tar.gz');
const result = spawnSync('tar', ['--sort=name', '--mtime=2026-10-21T00:00:00Z', '--owner=0', '--group=0', '--numeric-owner', '-czf', archive, '-T', path.join(directory, 'paths.txt')], { cwd: root, encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr);
fs.copyFileSync('/mnt/c/Users/guido/ghq/projects/rustdom/.cache/xml-controller-experiment.cjs', path.join(directory, 'xml-controller-experiment.cjs'));
fs.copyFileSync(__filename, path.join(directory, 'freeze-xml-controller.cjs'));
fs.writeFileSync(path.join(directory, 'identity.json'), JSON.stringify({ capturedAt: new Date().toISOString(), baseCommit: '75db9bb095db8457a6ae567f219e2224a55b9f36', sourceHash: sourceIdentity.sourceHash,
  archiveSha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
  binarySha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'dist/rustdom.node'))).digest('hex'),
  runnerSha256: createHash('sha256').update(fs.readFileSync(path.join(directory, 'xml-controller-experiment.cjs'))).digest('hex'), files: ordered.length }, null, 2) + '\n');
console.log(JSON.stringify({ directory, sourceHash: sourceIdentity.sourceHash, files: ordered.length }));
