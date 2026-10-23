/** @file Runs the original real DOM sampler after moving auxiliary tasks away from the main CPU. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const { affinities } = require('./thread-worker.cjs');
const { configureBackgroundAffinity, validateBackgroundAffinity } = require('./background-affinity.cjs');
const settings = require('./constants/background-affinity.cjs');
const worker = createSinglePackageWorker(settings);

/**
 * Preserve partial sampler output on failure, without overwriting an existing output file.
 * @param {...string} arguments_ - Unchanged row-isolated worker CLI arguments.
 * @returns {Promise<void>} Resolves only after affinity, public output and release checks pass.
 */
async function main(...arguments_) {
  const output = arguments_[5];
  assert.equal(typeof output, 'string', 'Background affinity: a fresh report path is required');
  assert.equal(fs.existsSync(output), false, 'Background affinity: preserve existing report');
  const state = await configureBackgroundAffinity();
  // The sampler owns its wx creation and partial failures. A rejected call confers no ownership here.
  await worker.main(...arguments_);
  const descriptor = fs.openSync(output, 'r+');
  try {
    const report = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
    assert.equal(report.pid, process.pid, 'Background affinity: completed report belongs to another process');
    report.backgroundAffinity = { ...state, final: affinities() };
    let failure;
    try { validateBackgroundAffinity(report); } catch (error) {
      report.complete = false;
      report.failure = { message: error.message, stack: error.stack };
      failure = error;
    }
    const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
    fs.writeSync(descriptor, bytes, 0, bytes.length, 0);
    fs.ftruncateSync(descriptor, bytes.length);
    if (failure) throw failure;
  } finally { fs.closeSync(descriptor); }
}

if (require.main === module) main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = { ...worker, main };
