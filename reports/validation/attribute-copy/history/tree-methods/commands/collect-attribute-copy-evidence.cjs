'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const task = '/mnt/c/Users/guido/ghq/projects/rustdom';
const managed = '/mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom';
const root = fs.readFileSync(task + '/.cache/attribute-copy-root.txt', 'utf8').trim();
const validation = managed + '/reports/validation/attribute-copy';
const benchmark = managed + '/reports/benchmarks/attribute-copy';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceIdentity = require(root + '/benchmarks/sources.cjs').captureSourceIdentity;
const frozen = JSON.parse(fs.readFileSync(root + '/reports/benchmarks/attribute-copy/variants.json'));
assert.equal(sourceIdentity(root).sourceHash, frozen.sourceIdentity.sourceHash);
assert.equal(sourceIdentity(managed).sourceHash, frozen.sourceIdentity.sourceHash);
assert.equal(digest(fs.readFileSync(root + '/dist/rustdom.node')),
  frozen.variants.candidate.files.find((entry) => entry.path === 'dist/rustdom.node').sha256);

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
for (const directory of [validation, benchmark, managed + '/reports/memory/attribute-copy']) fs.mkdirSync(directory, { recursive: true });
for (const name of ['ownership', 'final']) fs.cpSync(root + '/reports/validation/attribute-copy/' + name, validation + '/' + name, { recursive: true });
fs.cpSync(root + '/reports/benchmarks/attribute-copy', benchmark, { recursive: true });
const raw = benchmark + '/raw'; fs.mkdirSync(raw, { recursive: true });
for (const name of fs.readdirSync(benchmark).filter((name) => name.endsWith('.log'))) {
  const log = fs.readFileSync(benchmark + '/' + name, 'utf8');
  for (const match of log.matchAll(/Guardado: (reports\/benchmarks\/[^\r\n]+\.json)/g)) {
    fs.copyFileSync(root + '/' + match[1], raw + '/' + path.basename(match[1]));
    const markdown = match[1].replace(/\.json$/, '.md');
    if (fs.existsSync(root + '/' + markdown)) fs.copyFileSync(root + '/' + markdown, raw + '/' + path.basename(markdown));
  }
}
const commandDirectory = validation + '/commands'; fs.mkdirSync(commandDirectory, { recursive: true });
const scripts = ['validate-attribute-copy-final.sh', 'reproduce-attribute-copy-termination.sh',
  'attribute-copy-review-construction.cjs', 'attribute-copy-termination-negative.sh',
  'record-attribute-copy-termination-final.sh', 'benchmark-attribute-copy-final.sh',
  'attribute-copy-benchmark-identity.cjs', 'summarize-attribute-copy-benchmarks.cjs',
  'collect-attribute-copy-evidence.cjs', 'inspect-jsdom-inventory.cjs'];
for (const name of scripts) fs.copyFileSync(task + '/.cache/' + name, commandDirectory + '/' + name);

// Compression and full-tree hashing are deliberately deferred until all benchmark workers exit.
const evidenceArchive = validation + '/raw-validation-memory-distribution.tar.gz';
command('tar', ['-czf', evidenceArchive, '-C', root, 'reports/validation/attribute-copy',
  'reports/compatibility', 'reports/memory', 'reports/distribution']);
const sourceArchive = validation + '/validated-sources.tar.gz';
const sourceEntries = ['src', 'scripts', 'benchmarks', 'tests', 'types', 'third-party', '.github',
  'Cargo.toml', 'Cargo.lock', 'package.json', 'package-lock.json', 'AGENTS.md', 'ROADMAP.md', 'README.md'];
command('tar', ['-czf', sourceArchive, '-C', managed, ...sourceEntries]);
const extracted = fs.mkdtempSync('/home/guido/rustdom-attribute-copy-verified-sources-');
command('tar', ['-xzf', sourceArchive, '-C', extracted]);
assert.equal(sourceIdentity(extracted).sourceHash, frozen.sourceIdentity.sourceHash);
const archive = JSON.parse(fs.readFileSync(root + '/artifacts/latest.json'));
assert.equal(digest(fs.readFileSync(archive.archive)), archive.sha256);
assert.equal(archive.native.binarySha256, frozen.variants.candidate.files.find((entry) => entry.path === 'dist/rustdom.node').sha256);
fs.writeFileSync(validation + '/package.json', JSON.stringify({ capturedAt: archive.capturedAt, archive: archive.archive,
  sha256: archive.sha256, native: archive.native, published: false }, null, 2) + '\n');
const summary = JSON.parse(fs.readFileSync(benchmark + '/summary.json'));
const manifest = { capturedAt: new Date().toISOString(), sourceBaseCommit: frozen.sourceBaseCommit,
  sourceHash: frozen.sourceIdentity.sourceHash, measuredSources: frozen.sourceIdentity.measuredSources,
  nativeBinarySha256: archive.native.binarySha256, packageSha256: archive.sha256,
  sourceArchive: { path: 'validated-sources.tar.gz', sha256: digest(fs.readFileSync(sourceArchive)),
    verifiedExtraction: extracted, measuredIdentityMatches: true },
  evidenceArchive: { path: path.basename(evidenceArchive), sha256: digest(fs.readFileSync(evidenceArchive)) },
  publicCloneBudgetPass: summary.publicBudgetPass,
  note: 'The raw archive preserves earlier attempts as history. Only final/ logs and their referenced timestamps establish the final matrix. The old failing binary was used solely as a negative regression control; it is not the candidate.' };
fs.writeFileSync(validation + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceHash: manifest.sourceHash, nativeHash: manifest.nativeBinarySha256,
  packageHash: manifest.packageSha256, publicBudgetPass: summary.publicBudgetPass,
  archives: [sourceArchive, evidenceArchive].map((file) => ({ file, bytes: fs.statSync(file).size })) }, null, 2));
