/** @file Plans, authenticates or replays the AA diagnostic; capture remains guarded until the complete reviewed method is enabled. */
'use strict';
const assert = require('node:assert/strict');
const { policy, preflight } = require('./context.cjs');
const { plan } = require('./model.cjs');

/** @param {string[]} args - Public CLI operation and exact arguments. @returns {object} Real readiness or diagnostic data, never performance approval. */
function main(args) {
  const [operation, ...values] = args;
  if (operation === policy.operations.plan) {
    assert.equal(values.length, 0);
    return { revision: policy.revision, captureImplemented: policy.captureImplemented, diagnosticOnly: true,
      performanceAccepted: null, gateReevaluated: false, samplerInvoked: false, inputs: plan() };
  }
  if (operation === policy.operations.preflight) { assert.equal(values.length, 1); return preflight(values[0]); }
  if (operation === policy.operations.verify) { assert.equal(values.length, 1); return require('./replay.cjs').verify(values[0]); }
  assert.equal(operation, policy.operations.capture); assert.equal(values.length, 5);
  return require('./capture.cjs').run(values[0], values[1], values[2], values.slice(3));
}
if (require.main === module) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = policy.failureExitCode; }
}
module.exports = { main };
