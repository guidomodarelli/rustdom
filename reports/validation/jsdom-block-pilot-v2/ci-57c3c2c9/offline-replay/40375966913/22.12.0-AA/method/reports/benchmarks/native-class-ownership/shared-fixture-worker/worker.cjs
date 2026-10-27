/** @file Runs the prospective derived worker and marks its reports as ineligible for the historical gate. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');

async function main(args) {
  assert.equal(args.length, 7, 'Shared fixture worker: provide manifest, phase, engine, position, label, output and row');
  const output = args[5];
  const metadataPath = `${output}.integration.json`;
  assert.ok(!fs.existsSync(output) && !fs.existsSync(metadataPath), 'Shared fixture worker: preserve existing output');
  const receipt = JSON.parse(fs.readFileSync(require.resolve('./preparation.json'), 'utf8'));
  const metadata = { revision: receipt.revision, functionalOnly: true, performanceAccepted: null,
    gateReevaluated: false, samplerInvoked: false, complete: false, pid: process.pid, node: process.version,
    derivationSha256: createHash('sha256').update(fs.readFileSync(require.resolve('./preparation.json'))).digest('hex') };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  let failure;
  try {
    metadata.samplerInvoked = true;
    await require('./harness/reports/benchmarks/native-class-ownership/current-ownership-worker.cjs').main(...args);
  } catch (error) {
    failure = error;
    metadata.failure = { message: error.message, stack: error.stack };
  } finally {
    metadata.adapter = require('./harness/benchmarks/shared-ownership-fixtures/adapter.cjs').statistics();
    if (fs.existsSync(output)) {
      const report = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(report.pid, process.pid, 'Shared fixture worker: report belongs to another process');
      report.sourceSamplerRevision = report.revision;
      report.revision = receipt.revision;
      report.functionalOnly = true; report.performanceAccepted = null;
      report.integration = metadata.adapter;
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      metadata.complete = report.complete && failure === undefined;
    }
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  }
  if (failure) throw failure;
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = { main };
