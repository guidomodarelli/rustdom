/** @file Gates the current sources on their complete original ownership capture, preserving the rejected budget. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const study = require('./current-ownership-experiment.cjs');
const method = require('./constants/current-ownership-study.cjs');
const settings = require('./constants/current-ownership-evidence.json');
const { captureCurrentInputs } = require('./current-build-inputs.cjs');
const repository = path.resolve(__dirname, '../../..');
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Check the actual reference, current implementation/build inputs and full measured harness.
 * @param {string} baseline - Actual checkpoint 067 checkout.
 * @param {string} [candidate] - Current checkout, never substituted with archived sources by the CLI.
 * @returns {object} Matched source/build identity and harness hash, without collecting timings.
 */
function verifyCurrentInputs(baseline, candidate = repository) {
  const inputs = captureCurrentInputs(baseline, candidate);
  assert.deepEqual(inputs, method.preparation.identity.inputs,
    'Current ownership evidence: current source/build inputs differ from the measured candidate');
  const harness = study.captureHarness(candidate);
  assert.equal(harness.sha256, settings.harnessSha256,
    'Current ownership evidence: current harness differs from the measured method');
  return { inputs, harnessSha256: harness.sha256 };
}

/**
 * Recalculate every worker using existing readers and retain the exact original decision.
 * This function alone does not authenticate transport; the public CLI always does that first.
 * @param {string} baseline - Actual reference checkout.
 * @param {string} root - Complete original capture after extraction.
 * @param {string} packet - Published packet carrying the pinned original decision.
 * @returns {object} Complete two-Node verification and unchanged acceptance.
 */
function verifyExtracted(baseline, root, packet) {
  const current = verifyCurrentInputs(baseline);
  study.inspectPreparation(path.join(root, 'preparation/ownership-build'));
  assert.equal(digest(path.join(packet, 'original-verification.json')), settings.originalDecisionSha256);
  assert.equal(digest(path.join(root, 'verification.json')), settings.originalDecisionSha256);
  const result = study.verifySet(settings.nodeDirectories.map((directory) => path.join(root, directory)));
  assert.deepEqual(result, JSON.parse(fs.readFileSync(path.join(root, 'verification.json'), 'utf8')),
    'Current ownership evidence: recalculated result differs from the original decision');
  for (const directory of settings.nodeDirectories) {
    const index = JSON.parse(fs.readFileSync(path.join(root, directory, 'index.json'), 'utf8'));
    assert.equal(index.harness.sha256, current.harnessSha256);
    assert.equal(index.harness.identity.sourceHash, current.inputs.sources.B);
  }
  return { ...result, current, measurementExecuted: false };
}

/**
 * Authenticate and extract the full pinned ZIP, then invoke the original offline verifier.
 * @param {string} baseline - Actual reference checkout.
 * @param {string} packet - Published original capture packet.
 * @returns {object} Full integrity result, kept separate from performance acceptance.
 */
function verifyEvidence(baseline, packet) {
  verifyCurrentInputs(baseline);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), settings.temporaryDirectoryPrefix));
  try {
    const output = path.join(temporary, 'transport');
    const extraction = spawnSync(settings.pythonCommand,
      ['-B', path.join(__dirname, 'extract-current-ownership-evidence.py'), packet, output],
      { encoding: 'utf8', timeout: settings.extractionTimeoutMs });
    if (extraction.error) throw new Error('Current ownership evidence: original archive extraction did not complete',
      { cause: extraction.error });
    assert.equal(extraction.status, 0, `Current ownership evidence: extraction failed: ${extraction.stderr}`);
    const transport = JSON.parse(extraction.stdout);
    assert.equal(transport.transportAuthenticated, true); assert.equal(transport.samplerExecuted, false);
    return { ...verifyExtracted(baseline, path.join(output, 'archive', settings.archivePrefix), packet), transport };
  } finally {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith(settings.temporaryDirectoryPrefix));
    fs.rmSync(temporary, { recursive: true });
  }
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 4, 'Current ownership evidence: provide baseline and original packet paths');
    const result = verifyEvidence(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.accepted !== true) {
      process.stderr.write('Current ownership evidence: the complete current-source study rejected the performance budget; no measurement was repeated.\n');
      process.exitCode = 1;
    }
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { verifyCurrentInputs, verifyExtracted, verifyEvidence };
