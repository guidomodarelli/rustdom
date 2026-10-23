/** @file Exercises real full-input evidence, physical source eligibility and the actual gate CLI. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { canReuse, verifyEvidence, readArchiveIdentity, matchesArchiveIdentity } = require('./xml-history.cjs');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const recipe = require('./constants/xml-native-properties-gate.json');
const contracts = require('./constants/xml-build-contracts.cjs');
const repository = path.resolve(__dirname, '../../..');
const baseline = path.resolve(process.env.RUSTDOM_XML_GATE_BASELINE || path.join(repository, '.baseline'));
const archive = path.join(repository, recipe.archive);
const cli = path.join(__dirname, 'xml-native-properties-gate.cjs');

/** Own one real filesystem fixture; never modify the recorded source or artifact. */
function temporary(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), contracts.sourceInputsDirectoryPrefix));
  context.after(() => {
    const actual = fs.realpathSync(directory);
    assert.equal(path.dirname(actual), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(actual).startsWith(contracts.sourceInputsDirectoryPrefix));
    fs.rmSync(actual, { recursive: true });
  });
  return directory;
}

/** Physically copy the real complete source graph and declared root inputs. */
function candidateCopy(context) {
  const destination = path.join(temporary(context), 'candidate');
  const names = new Set([...captureSourceIdentity(repository).measuredSources,
    ...Object.keys(recipe.buildInputHashes.candidate), recipe.workflowPath]);
  for (const name of names) {
    if (!fs.existsSync(path.join(repository, name))) continue;
    const output = path.join(destination, name);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(repository, name), output);
  }
  return destination;
}

test('selects the actually measured source graph and rejects the old source declaration', () => {
  assert.equal(canReuse(baseline, archive, repository, recipe), true);
  assert.equal(canReuse(baseline, archive, repository, { ...recipe, sourceHash: '0'.repeat(64) }), false);
  const identity = readArchiveIdentity(archive, recipe);
  assert.equal(matchesArchiveIdentity(identity, recipe), true);
  assert.equal(identity.sourceHash, recipe.sourceHash);
  assert.equal(identity.baselineSourceHash, recipe.baselineSourceHash);
});

test('recomputes the complete original transport rather than trusting its acceptance field', () => {
  const result = verifyEvidence(archive, recipe);
  assert.equal(result.verified, true);
  assert.equal(result.archiveTransportVerified, true);
  assert.equal(result.accepted, true);
  assert.equal(result.calibrated, true);
  assert.equal(result.processes, 468);
  assert.equal(result.measuredDurations, 14976);
  assert.equal(result.recordedSources.B, recipe.sourceHash);
});

test('changed implementation, extra source and undeclared build configuration cannot reuse the record', (context) => {
  const candidate = candidateCopy(context);
  assert.equal(canReuse(baseline, archive, candidate, recipe), true);
  const implementation = path.join(candidate, 'src/dom/xml_serializer_controller.rs');
  const original = fs.readFileSync(implementation);
  fs.appendFileSync(implementation, '\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
  fs.writeFileSync(implementation, original);
  const extra = path.join(candidate, 'src/unrecorded.rs');
  fs.writeFileSync(extra, '// Unrecorded source.\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
  fs.unlinkSync(extra);
  fs.mkdirSync(path.join(candidate, '.cargo'));
  fs.writeFileSync(path.join(candidate, '.cargo/config.toml'), '[build]\nrustflags = ["-C", "opt-level=1"]\n');
  assert.equal(canReuse(baseline, archive, candidate, recipe), false);
});

test('eligible sources never turn a damaged original ZIP into passing evidence', (context) => {
  const damaged = path.join(temporary(context), 'archive');
  for (const name of Object.keys(recipe.evidenceFiles)) {
    const output = path.join(damaged, name);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(archive, name), output);
  }
  const filename = path.join(damaged, 'artifact.zip');
  const bytes = fs.readFileSync(filename); bytes[0] ^= 1; fs.writeFileSync(filename, bytes);
  assert.equal(canReuse(baseline, damaged, repository, recipe), true);
  assert.throws(() => verifyEvidence(damaged, recipe), /declared evidence file changed/);
  fs.unlinkSync(filename);
  assert.throws(() => verifyEvidence(damaged, recipe), /declared evidence file is missing/);
});

test('the actual CLI consumes only the recorded runtime and never starts a replacement measurement', () => {
  const supported = process.version === recipe.node && process.platform === recipe.platform && process.arch === recipe.arch;
  for (const mode of ['--select', '--verify']) {
    const result = spawnSync(process.execPath, [cli, mode, baseline, archive], { cwd: repository, encoding: 'utf8' });
    if (!supported) {
      assert.equal(result.status, 2);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /differs from the declared XML recipe/);
    } else {
      assert.equal(result.status, 0, result.stderr);
      if (mode === '--select') assert.equal(result.stdout, 'reuse=true\n');
      else assert.equal(JSON.parse(result.stdout).accepted, true);
    }
  }
});

test('the actual CLI rejects optimized verification and unrecorded runtime flags', () => {
  const supported = process.version === recipe.node && process.platform === recipe.platform && process.arch === recipe.arch;
  for (const [name, value, diagnostic] of [
    ['PYTHONOPTIMIZE', '1', /requires Python assertions/],
    ['RUSTFLAGS', '-C opt-level=1', /undeclared RUSTFLAGS/],
    ['CARGO_PROFILE_RELEASE_OPT_LEVEL', '1', /undeclared CARGO_PROFILE_RELEASE_OPT_LEVEL/],
  ]) {
    const result = spawnSync(process.execPath, [cli, '--verify', baseline, archive],
      { cwd: repository, encoding: 'utf8', env: { ...process.env, [name]: value } });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, supported ? diagnostic : /differs from the declared XML recipe/);
  }
});
