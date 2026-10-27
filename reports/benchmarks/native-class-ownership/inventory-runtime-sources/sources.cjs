/** @module inventory-runtime-correspondence Checks historical audit bytes separately from the actually exercised runtime. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const policy = require('./constants/correspondence.json');
const { requireProductionEquivalence } = require('../block-confirmation/production.cjs');

/** @param {string} root - Physical source root. @param {string} relative - Canonical member. @param {number} limit - Size bound. @returns {Buffer} Bounded physical bytes; no source is imported. */
function bytes(root, relative, limit) {
  assert.equal(path.posix.normalize(relative), relative);
  assert.ok(!path.posix.isAbsolute(relative) && !relative.includes('\\') && !relative.includes(':'));
  assert.ok(relative.split('/').every((segment) => segment && segment !== '..' && segment !== '.'));
  let filename = root;
  for (const segment of relative.split('/')) {
    filename = path.join(filename, segment); assert.equal(fs.lstatSync(filename).isSymbolicLink(), false);
  }
  const stat = fs.statSync(filename);
  assert.ok(stat.isFile() && stat.size <= limit, 'Inventory correspondence: bounded regular file required: ' + relative);
  assert.ok(fs.realpathSync(filename).startsWith(root + path.sep));
  const raw = fs.readFileSync(filename);
  assert.ok(raw.length <= limit); return raw;
}

/** @param {Buffer} raw - Actual file bytes. @returns {string} Recorded SHA-256. */
function digest(raw) { return createHash('sha256').update(raw).digest('hex'); }

/**
 * Verify both original audit receipts, every mapped historical file, and every corresponding runtime file.
 * Only the exact qualified Range bridge transition is permitted; it also requires all 344 selected compiler inputs.
 * Actual Git identity is separately checked by the caller; this function never equates different source bytes.
 * @param {string} snapshot - Immutable proposal files; no module is imported from this root.
 * @param {string} runtime - Current source root used to build the actual SUT.
 * @returns {object} Per-file correspondence and finite eligibility for running current public contracts, never migration credit.
 */
function verifyMappedSources(snapshot, runtime) {
  snapshot = fs.realpathSync(snapshot); runtime = fs.realpathSync(runtime);
  const sources = new Map(); const receipts = {}; let compilerInputs = null;
  for (const [family, expected] of Object.entries(policy.receipts)) {
    const relative = 'reports/validation/inventory-' + family + '-audit/receipt.json';
    const raw = bytes(snapshot, relative, policy.maximumReceiptBytes);
    assert.equal(digest(raw), expected.sha256, 'Inventory correspondence: changed original receipt ' + family);
    const receipt = JSON.parse(raw.toString('utf8'));
    assert.equal(receipt.complete, true); assert.equal(receipt.kind, 'static-source-correspondence-only');
    assert.equal(receipt.mappedLocalSources.length, expected.entries);
    assert.equal(new Set(receipt.mappedLocalSources.map((entry) => entry.path)).size, expected.entries);
    receipts[family] = { sha256: expected.sha256, entries: expected.entries };
    for (const entry of receipt.mappedLocalSources) {
      const snapshotSha256 = digest(bytes(snapshot, entry.path, policy.maximumSourceBytes));
      assert.equal(snapshotSha256, entry.sha256, 'Inventory correspondence: changed audited source ' + entry.path);
      const runtimeSha256 = digest(bytes(runtime, entry.path, policy.maximumSourceBytes));
      const historicalBytesEqual = runtimeSha256 === snapshotSha256;
      if (!historicalBytesEqual) {
        const transition = policy.rangeBridgeTransition;
        assert.equal(entry.path, transition.path, 'Inventory correspondence: undeclared runtime change ' + entry.path);
        assert.equal(snapshotSha256, transition.snapshotSha256);
        assert.equal(runtimeSha256, transition.runtimeSha256, 'Inventory correspondence: changed qualified Range bridge');
        compilerInputs ??= requireProductionEquivalence(runtime);
      }
      const correspondence = { path: entry.path, snapshotSha256, runtimeSha256, historicalBytesEqual,
        role: historicalBytesEqual ? 'unchanged-audited-source' : 'qualified-range-integration-requires-current-tests' };
      if (sources.has(entry.path)) assert.deepEqual(sources.get(entry.path), correspondence);
      sources.set(entry.path, correspondence);
    }
  }
  return { revision: policy.revision, receipts, sources: [...sources.values()],
    qualifiedCompilerInputs: compilerInputs?.inputCount ?? null,
    originalReceiptsModified: false, actualGitIdentityAuthenticatedHere: false,
    currentPublicContractsStillRequired: true, runtimeExecutedHere: false,
    migrationCreditGranted: false, performanceAccepted: null, gateReevaluated: false };
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 4, 'Inventory correspondence: provide snapshot and current runtime roots');
    process.stdout.write(JSON.stringify(verifyMappedSources(...process.argv.slice(2))) + '\n');
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { verifyMappedSources };
