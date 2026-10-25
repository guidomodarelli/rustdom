/** @module combined-results-contracts Exercises current readers against a real freshly derived sampler; altered copies never execute. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { verifyDerived, validateReport } = require('./results.cjs');
const { captureHarness } = require('./source.cjs');
const { validateInvocation } = require('./qualify.cjs');
const fixture = require('./fixtures/functional-worker.json');

test('a real completed worker binds exact invocation and commit, rejecting resealed provenance and purpose changes', () => {
  const validate = (copy) => {
    validateInvocation(copy.indexEntry, copy.runtime, copy.indexEntry.input, copy.derivedDirectory, copy.evidenceDirectory);
    return validateReport(copy.report, copy.manifest, copy.indexEntry.input, copy.indexEntry, copy.metadata,
      copy.derivationSha256, copy.sourceCommit, true);
  };
  assert.equal(validate(fixture), fixture.report);
  for (const change of [
    (copy) => { copy.indexEntry.argv[0] = '/unrelated-node'; },
    (copy) => { copy.indexEntry.argv[4] = '/unrelated-worker.cjs'; },
    (copy) => { copy.indexEntry.argv[2] = '--random-seed=2'; },
    (copy) => { copy.metadata.sourceCommit = '0'.repeat(40); },
    (copy) => { copy.metadata.complete = false; },
    (copy) => { copy.report.functionalOnly = false; },
    (copy) => { copy.report.batches[0].cleanupTrace.at(-1).survivors.window = 1; }
  ]) {
    const copy = structuredClone(fixture); change(copy); assert.throws(() => validate(copy));
  }
  assert.throws(() => validateReport(fixture.report, fixture.manifest, fixture.indexEntry.input, fixture.indexEntry,
    fixture.metadata, fixture.derivationSha256, fixture.sourceCommit, false));
});

test('the current reader authenticates a real derivation and rejects resealed code, links and unlisted files', () => {
  const derived = process.env.RUSTDOM_COMBINED_DERIVED_ROOT;
  assert.ok(derived, 'Provide the actual freshly derived sampler via RUSTDOM_COMBINED_DERIVED_ROOT');
  const harness = captureHarness(); const head = harness.identity.sourceCommit;
  assert.equal(verifyDerived(derived, harness, head).complete, true);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-derived-reader-'));
  try {
    const copy = path.join(root, 'derived'); fs.cpSync(derived, copy, { recursive: true });
    const filename = path.join(copy, 'worker.cjs'); const original = fs.readFileSync(filename);
    const receiptFile = path.join(copy, 'preparation.json'); const receiptBytes = fs.readFileSync(receiptFile);
    const receipt = JSON.parse(receiptBytes);
    fs.appendFileSync(filename, '\n// altered evidence, never executed\n');
    receipt.controlFiles['worker.cjs'] = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
    fs.writeFileSync(receiptFile, JSON.stringify(receipt));
    assert.throws(() => verifyDerived(copy, harness, head), /independently reviewed sources/);
    fs.writeFileSync(filename, original); fs.writeFileSync(receiptFile, receiptBytes);
    const extra = path.join(copy, 'unlisted.cjs'); fs.writeFileSync(extra, 'throw new Error("must never execute");\n');
    assert.throws(() => verifyDerived(copy, harness, head)); fs.unlinkSync(extra);
    fs.unlinkSync(filename); fs.symlinkSync(path.join(derived, 'worker.cjs'), filename);
    assert.throws(() => verifyDerived(copy, harness, head), /linked derived control/);
    fs.unlinkSync(filename); fs.writeFileSync(filename, original);
    assert.equal(verifyDerived(copy, harness, head).complete, true);
    assert.throws(() => verifyDerived(copy, harness, '0'.repeat(40)));
  } finally { fs.rmSync(root, { recursive: true }); }
});
