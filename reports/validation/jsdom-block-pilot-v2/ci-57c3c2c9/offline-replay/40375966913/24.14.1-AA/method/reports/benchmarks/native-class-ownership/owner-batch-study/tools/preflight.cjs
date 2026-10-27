/** @file Inspect current method publication and actual Git identity without executing DOM or starting a capture. */
'use strict';
const assert = require('node:assert/strict');
const source = require('../source.cjs');
const { filesDigest } = require('../binding.cjs');
const capture = require('../constants/capture.json');
const worker = require('../constants/worker.json');
const sampler = require('../constants/sampler.json');

/** @returns {object} Actual source/flags and independent publication checks; hosted CI and activation remain separate prerequisites. */
function preflight() {
  assert.equal(worker.executionReady, capture.executionReady, 'Owner batch preflight: worker/capture flags differ');
  assert.equal(sampler.executionReady, capture.executionReady, 'Owner batch preflight: sampler/capture flags differ');
  const producer = source.producer(capture.executionReady);
  const methodFilesSha256 = filesDigest(producer.files);
  if (capture.executionReady) {
    assert.equal(producer.publication.completeMethodReview, true, 'Owner batch preflight: complete independent method review required');
    assert.equal(producer.publication.methodFilesSha256, methodFilesSha256, 'Owner batch preflight: publication graph digest differs');
  }
  return { ...producer, methodFilesSha256, methodFlagsEnabled: capture.executionReady,
    DOMExecuted: false, scientificCaptureExecuted: false, labelApplied: false,
    performanceAccepted: null, gateReevaluated: false };
}
module.exports = { preflight };

if (require.main === module) {
  try { process.stdout.write(JSON.stringify(preflight(), null, 2) + '\n'); }
  catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = capture.failureExitCode; }
}
