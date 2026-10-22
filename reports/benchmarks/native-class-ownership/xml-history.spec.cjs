/** @file Exercises XML evidence selection with immutable real sources, original ZIPs and actual CLIs. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { canReuse, verifyEvidence, readArchiveIdentity, matchesArchiveIdentity } = require('./xml-history.cjs');
const { historicalSources } = require('./fixtures/xml-history-sources/materialize.cjs');
const settings = require('./constants/xml-history.json');
const historicalRecipe = require('./fixtures/xml-history-sources/manifest.json').recipe;
const archive = path.join(__dirname, 'xml-validation/39697882498');
const cli = path.join(__dirname, 'xml-history.cjs');

/**
 * Restore the real historical implementation with the current CI selection policy.
 * @param {object} context - Owns the original source fixture and its cleanup.
 * @returns {object} Independent baseline and candidate directories.
 */
function currentRecipeSources(context) {
  const sources = historicalSources(context);
  const repository = path.resolve(__dirname, '../../..');
  fs.copyFileSync(path.join(repository, settings.workflowPath), path.join(sources.candidate, settings.workflowPath));
  return sources;
}

test('selects the actual historical XML sources and declared recipe independently of the current candidate', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  assert.equal(canReuse(baseline, archive, candidate, recipe), true);
});

test('rejects changed candidate source bytes', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.appendFileSync(path.join(candidate, 'third-party/napi/src/bindgen_runtime/js_values/class.rs'), '\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects changed reference source bytes', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.appendFileSync(path.join(baseline, 'src/dom/tree.rs'), '\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects additional candidate implementation files', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.writeFileSync(path.join(candidate, 'src/unrecorded_source.rs'), '// Additional candidate source.\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects changed root build metadata outside the old canonical source scope', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  const filename = path.join(candidate, 'package.json');
  const metadata = JSON.parse(fs.readFileSync(filename));
  metadata.scripts.build = 'node scripts/build.mjs';
  fs.writeFileSync(filename, `${JSON.stringify(metadata)}\n`);
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects an added Cargo configuration that was absent from the recorded recipe', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.mkdirSync(path.join(candidate, '.cargo'), { recursive: true });
  fs.writeFileSync(path.join(candidate, '.cargo/config.toml'), '[build]\nrustflags = ["-C", "opt-level=1"]\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects a changed Cargo build script outside the old canonical source scope', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.appendFileSync(path.join(candidate, 'build.rs'), '\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects a repository npm configuration absent from the recorded build recipe', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.writeFileSync(path.join(candidate, '.npmrc'), 'omit=dev\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects an added higher-priority npm shrinkwrap even when package-lock bytes are unchanged', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.copyFileSync(path.join(candidate, 'package-lock.json'), path.join(candidate, 'npm-shrinkwrap.json'));
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('rejects a changed real workflow recipe even when canonical implementation bytes match', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  fs.appendFileSync(path.join(candidate, recipe.workflowPath), '\n# Another declared recipe.\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('another declared measurement profile cannot reuse the historical experiment', (context) => {
  const { baseline, candidate, recipe } = historicalSources(context);
  assert.equal(canReuse(baseline, archive, candidate, { ...recipe, node: 'v0.0.0' }), false);
});

test('absent evidence is not selected or created', (context) => {
  const { directory, baseline, candidate, recipe } = historicalSources(context);
  const absent = path.join(directory, 'absent');
  assert.equal(canReuse(baseline, absent, candidate, recipe), false);
  assert.equal(fs.existsSync(absent), false);
});

test('recomputes the actual complete XML ZIP with the real archived verifier',
  { skip: process.platform !== 'linux' && 'The declared gate invokes Python3 on Linux.' }, () => {
    const result = verifyEvidence(archive, historicalRecipe);
    assert.equal(result.verified, true);
    assert.equal(result.accepted, true);
    assert.equal(result.processes, 468);
    assert.equal(result.measuredDurations, 14976);
  });

test('recorded compiler, platform and source identities must match the requested recipe',
  { skip: process.platform !== 'linux' && 'The recorded input reader invokes Python3 on Linux.' }, () => {
    const identity = readArchiveIdentity(archive, historicalRecipe);
    assert.equal(matchesArchiveIdentity(identity, historicalRecipe), true);
    assert.equal(matchesArchiveIdentity(identity, { ...historicalRecipe, rustc: 'another declared compiler' }), false);
    assert.equal(matchesArchiveIdentity(identity, { ...historicalRecipe, platform: 'another-platform' }), false);
    assert.equal(matchesArchiveIdentity(identity, { ...historicalRecipe, sourceHash: '0'.repeat(64) }), false);
  });

test('source eligibility never makes an altered ZIP a passing gate', (context) => {
    const { directory, baseline, candidate, recipe } = historicalSources(context);
    const damaged = path.join(directory, 'damaged');
    fs.cpSync(archive, damaged, { recursive: true });
    const filename = path.join(damaged, 'artifact.zip');
    const bytes = fs.readFileSync(filename); bytes[0] ^= 1; fs.writeFileSync(filename, bytes);
    assert.equal(canReuse(baseline, damaged, candidate, recipe), true);
    assert.throws(() => verifyEvidence(damaged, recipe), /declared evidence file changed/);
  });

test('a missing ZIP still selects verification and fails instead of authorizing another measurement', (context) => {
    const { directory, baseline, candidate, recipe } = historicalSources(context);
    const missing = path.join(directory, 'missing-zip');
    fs.cpSync(archive, missing, { recursive: true });
    fs.unlinkSync(path.join(missing, 'artifact.zip'));
    assert.equal(canReuse(baseline, missing, candidate, recipe), true);
    assert.throws(() => verifyEvidence(missing, recipe), /declared evidence file is missing/);
  });

test('changed verifier code cannot turn matching sources into accepted evidence', (context) => {
    const { directory, recipe } = historicalSources(context);
    const changed = path.join(directory, 'changed-verifier');
    fs.cpSync(archive, changed, { recursive: true });
    fs.appendFileSync(path.join(changed, 'verify.py'), '\n# Changed verifier.\n');
    assert.throws(() => verifyEvidence(changed, recipe), /declared evidence file changed/);
  });

test('changed selection metadata fails before the real CLI can authorize another measurement', (context) => {
    const { directory, baseline, candidate, recipe } = historicalSources(context);
    const changed = path.join(directory, 'changed-protocol');
    fs.cpSync(archive, changed, { recursive: true });
    const filename = path.join(changed, 'constants/protocol.json');
    const protocol = JSON.parse(fs.readFileSync(filename));
    protocol.sourceHash = '0'.repeat(64);
    fs.writeFileSync(filename, `${JSON.stringify(protocol)}\n`);
    assert.equal(canReuse(baseline, changed, candidate, recipe), false);
    assert.throws(() => verifyEvidence(changed, recipe), /declared evidence file changed/);
    if (process.version !== settings.node || process.platform !== settings.platform) return;
    const repository = path.resolve(__dirname, '../../..');
    fs.copyFileSync(path.join(repository, settings.workflowPath), path.join(candidate, settings.workflowPath));
    const compiler = spawnSync('rustc', ['-Vv'], { encoding: 'utf8' });
    if (compiler.status !== 0 || compiler.stdout.trim() !== settings.rustc) {
      context.skip('The declared compiler is required for the actual Node24 CLI guard.');
      return;
    }
    const child = spawnSync(process.execPath, [cli, '--select', baseline, changed], { cwd: candidate, encoding: 'utf8' });
    assert.equal(child.status, 2);
    assert.equal(child.stdout, '');
    assert.match(child.stderr, /declared evidence file changed/);
  });

test('the real cancelled duplicate is ineligible and its verifier grants no budget',
  { skip: process.platform !== 'linux' && 'The declared gate invokes Python3 on Linux.' }, (context) => {
    const { baseline, candidate, recipe } = historicalSources(context);
    const partial = path.join(__dirname, 'xml-validation/39702836767');
    assert.equal(canReuse(baseline, partial, candidate, recipe), false);
    assert.throws(() => verifyEvidence(partial, recipe), /declared evidence file changed/);
    const child = spawnSync(settings.python, ['-B', path.join(partial, 'verify.py')], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.equal(result.verified, true);
    assert.equal(result.complete, false);
    assert.equal(result.accepted, null);
    assert.equal(result.measuredDurations, 1664);
  });

test('the real CLI selects and verifies only a supported source and tool profile',
  { skip: process.platform !== 'linux' && 'This CI recipe is Linux-specific.' }, (context) => {
    const { baseline, candidate } = currentRecipeSources(context);
    const invoke = (mode) => spawnSync(process.execPath, [cli, mode, baseline, archive],
      { cwd: candidate, encoding: 'utf8' });
    const selected = invoke('--select');
    const workflowDigest = createHash('sha256').update(fs.readFileSync(path.join(candidate, settings.workflowPath))).digest('hex');
    if (process.version !== settings.node || workflowDigest !== settings.workflowSha256) {
      assert.equal(selected.status, 2);
      assert.equal(selected.stdout, '');
      return;
    }
    const compiler = spawnSync('rustc', ['-Vv'], { encoding: 'utf8' });
    if (compiler.status !== 0 || compiler.stdout.trim() !== settings.rustc) {
      context.skip('The declared Linux rustc fingerprint is not installed in this test environment.');
      return;
    }
    assert.equal(selected.status, 0, selected.stderr);
    const eligible = canReuse(baseline, archive, candidate);
    assert.equal(selected.stdout, `reuse=${eligible}\n`);
    const verified = invoke('--verify');
    assert.equal(verified.status, eligible ? 0 : 2, verified.stderr);
    if (eligible) assert.equal(JSON.parse(verified.stdout).accepted, true);
  });

for (const filename of ['third-party/napi/src/bindgen_runtime/js_values/class.rs', 'build.rs']) {
  test(`the actual CLI refuses automatic measurement for changed inputs: ${filename}`, (context) => {
    const { baseline, candidate } = currentRecipeSources(context);
    fs.appendFileSync(path.join(candidate, filename), '\n');
    assert.equal(canReuse(baseline, archive, candidate), false);
    const child = spawnSync(process.execPath, [cli, '--select', baseline, archive],
      { cwd: candidate, encoding: 'utf8' });
    assert.equal(child.status, 2, child.stderr);
    assert.equal(child.stdout, '', 'Failed selection cannot emit reuse=false and authorize a new CI measurement');
    if (process.version === settings.node && process.platform === settings.platform) {
      const compiler = spawnSync('rustc', ['-Vv'], { encoding: 'utf8' });
      if (compiler.status === 0 && compiler.stdout.trim() === settings.rustc) {
        assert.match(child.stderr, /current inputs do not match the declared evidence/);
        assert.match(child.stderr, /Automatic measurement is not authorized/);
      } else assert.match(child.stderr, /XML history: (rustc|compiler)/);
    } else assert.match(child.stderr, /XML history: (Node|platform) differs/);
  });
}
