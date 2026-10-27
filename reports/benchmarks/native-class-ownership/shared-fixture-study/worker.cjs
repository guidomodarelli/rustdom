/** @file Runs the qualified inner sampler once and marks the raw report with this prospective study's identity. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');

/** Add study provenance only after the unchanged inner sampler has stopped and saved its raw report. */
function annotate(report, metadata, adapter) {
  assert.equal(report.pid, metadata.pid, 'Shared fixture study: report belongs to another child');
  assert.equal(report.node, metadata.node, 'Shared fixture study: report belongs to another Node');
  assert.equal(report.revision, metadata.sourceSamplerRevision);
  return { ...report, sourceSamplerRevision: report.revision, revision: metadata.revision,
    purpose: metadata.purpose, functionalOnly: false, performanceAccepted: null, integration: adapter };
}

async function main(args) {
  assert.equal(args.length, 7, 'Provide manifest, phase, engine, position, label, output and row');
  const output = args[5]; const sidecar = `${output}.integration.json`;
  assert.ok(!fs.existsSync(output) && !fs.existsSync(sidecar), 'Shared fixture study: preserve existing evidence');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Shared fixture study: capture requires the declared hosted runner');
  const receipt = JSON.parse(fs.readFileSync(require.resolve('./preparation.json'), 'utf8'));
  const sampler = require('./harness/reports/benchmarks/native-class-ownership/current-ownership-worker.cjs');
  const sourceSettings = require('./harness/reports/benchmarks/native-class-ownership/constants/current-ownership.cjs');
  const metadata = { revision: receipt.revision, sourceSamplerRevision: sourceSettings.revision, purpose: receipt.purpose,
    functionalOnly: false, performanceAccepted: null, gateReevaluated: false, complete: false, samplerInvoked: false,
    pid: process.pid, node: process.version,
    derivationSha256: createHash('sha256').update(fs.readFileSync(require.resolve('./preparation.json'))).digest('hex') };
  fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  let failure;
  try { metadata.samplerInvoked = true; await sampler.main(...args); }
  catch (error) { failure = error; metadata.failure = { message: error.message, stack: error.stack }; }
  finally {
    metadata.adapter = require('./harness/benchmarks/shared-ownership-fixtures/adapter.cjs').statistics();
    if (fs.existsSync(output)) {
      const report = annotate(JSON.parse(fs.readFileSync(output, 'utf8')), metadata, metadata.adapter);
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      metadata.complete = report.complete && failure === undefined;
    }
    fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n');
  }
  if (failure) throw failure;
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
module.exports = { main, annotate };
