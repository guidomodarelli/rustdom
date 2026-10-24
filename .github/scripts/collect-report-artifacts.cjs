/** @file Preserve current-job report changes without duplicating immutable historical reports. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const settings = require('./constants/report-artifacts.json');

/** @returns {boolean} Whether a canonical path is inside a canonical directory. */
function within(directory, filename) {
  const relative = path.relative(directory, filename);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

/** @returns {Promise<string>} Streaming digest of the exact bytes retained for upload. */
async function digest(filename) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * Preserve changed/untracked reports and a complete delta manifest in a fresh, disjoint directory.
 * Existing historical reports remain available at the recorded Git commit.
 * @param {string} repository - Real Git checkout containing the reports.
 * @param {string} destination - Fresh output outside that checkout.
 * @param {string} reportRoot - Repository-relative report subtree, retained as the artifact root.
 * @returns {Promise<object>} Exact uploaded-file digests and records for deletions and links.
 */
async function collect(repository, destination, reportRoot = settings.reportsDirectory) {
  repository = fs.realpathSync(repository);
  const git = (args) => execFileSync('git', ['-C', repository, ...args], {
    encoding: 'utf8', maxBuffer: settings.maximumGitOutputBytes });
  assert.equal(fs.realpathSync(git(['rev-parse', '--show-toplevel']).trim()), repository,
    'Report collection requires the Git repository root');
  destination = path.resolve(destination);
  destination = path.join(fs.realpathSync(path.dirname(destination)), path.basename(destination));
  assert.ok(!within(repository, destination) && !within(destination, repository),
    'Report collection must preserve a disjoint source checkout');
  assert.ok(!fs.existsSync(destination), 'Report collection requires a fresh output directory');
  assert.ok((reportRoot === settings.reportsDirectory || reportRoot.startsWith(settings.reportsDirectory + '/')) &&
    !reportRoot.includes('\\') && !reportRoot.split('/').some((part) => part === '..' || part === '.' || part === ''),
  'Report collection requires a subtree inside reports');
  const reports = path.join(repository, reportRoot);
  if (fs.existsSync(reports)) {
    assert.ok(fs.lstatSync(reports).isDirectory() && !fs.lstatSync(reports).isSymbolicLink(),
      'Report collection requires an owned reports directory');
  }
  const tracked = git(['ls-tree', '--name-only', '-r', '-z', 'HEAD', '--', reportRoot]).split('\0').filter(Boolean);
  const trackedChanges = git(['diff', '--name-only', '--no-ext-diff', '--no-textconv', '--no-renames', '-z',
    'HEAD', '--', reportRoot]).split('\0').filter(Boolean);
  const untracked = git(['ls-files', '--others', '-z', '--', reportRoot]).split('\0').filter(Boolean);
  const candidates = [...new Set([...trackedChanges, ...untracked])];
  const changed = candidates.filter((name) => !name.split('/').some((part) => settings.excludedDirectoryNames.includes(part))).sort();
  const entries = changed.map((name) => {
    assert.ok(name.startsWith(reportRoot + '/') && !name.includes('\\') &&
      !name.split('/').some((part) => part === '..' || part === '.'), 'Report collection received a noncanonical path');
    assert.notEqual(path.posix.relative(reportRoot, name), settings.manifestFile,
      'Report collection cannot overwrite a report named like the reserved artifact manifest');
    const filename = path.join(repository, name);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) {
      if (error.code === 'ENOENT') return { path: name, kind: 'deleted' };
      throw error;
    }
    if (stat.isSymbolicLink()) return { path: name, kind: 'symlink', target: fs.readlinkSync(filename) };
    assert.ok(stat.isFile() && within(reports, fs.realpathSync(filename)),
      'Report collection cannot read a file outside the owned reports directory');
    return { path: name, kind: 'file' };
  });
  const manifest = { scope: settings.scope, reportRoot, sourceCommit: git(['rev-parse', 'HEAD']).trim(),
    githubRunId: process.env.GITHUB_RUN_ID ?? null, githubJob: process.env.GITHUB_JOB ?? null,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    trackedHistoricalReportFiles: tracked.length, excludedCacheFiles: candidates.length - changed.length,
    complete: false, entries: [], filesCopied: 0, bytesCopied: 0 };
  fs.mkdirSync(destination);
  const save = () => fs.writeFileSync(path.join(destination, settings.manifestFile), JSON.stringify(manifest, null, 2) + '\n');
  save();
  try {
    for (const entry of entries) {
      if (entry.kind !== 'file') { manifest.entries.push(entry); continue; }
      const artifactPath = path.posix.relative(reportRoot, entry.path);
      const output = path.join(destination, artifactPath);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(path.join(repository, entry.path), output, fs.constants.COPYFILE_EXCL);
      const bytes = fs.statSync(output).size;
      manifest.entries.push({ ...entry, artifactPath, bytes, sha256: await digest(output) });
      manifest.filesCopied++; manifest.bytesCopied += bytes;
    }
    manifest.complete = true;
    return manifest;
  } catch (error) {
    manifest.failure = { message: error.message };
    throw error;
  } finally { save(); }
}

if (require.main === module) {
  assert.ok(process.argv.length === 3 || process.argv.length === 4, 'Provide fresh output and optional report subtree');
  collect(process.cwd(), process.argv[2], process.argv[3]).then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(`collect-report-artifacts failed: ${error.stack}`); process.exitCode = 1; });
}
module.exports = { collect };
