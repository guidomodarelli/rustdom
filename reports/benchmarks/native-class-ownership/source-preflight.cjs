/** @file Rejects undeclared source trees before CI builds packages or starts an obsolete experiment. */
'use strict';
const path = require('node:path');
const protocol = require('./constants/hosted.cjs');

/**
 * Compare actual source identities with the sources declared by the hosted method.
 * This does not validate compiled packages, reuse measurements or approve performance.
 * @param {string} baselineRoot - Actual reference checkout.
 * @param {string} [candidateRoot] - Actual candidate checkout.
 * @returns {object} Both expected/observed identities and whether the method declares them.
 */
function inspectSources(baselineRoot, candidateRoot = process.cwd()) {
  const { captureSourceIdentity } = require(path.join(candidateRoot, 'benchmarks/sources.cjs'));
  const actual = {
    A: captureSourceIdentity(baselineRoot).sourceHash,
    B: captureSourceIdentity(candidateRoot).sourceHash,
  };
  return { declared: actual.A === protocol.sourceHashes.A && actual.B === protocol.sourceHashes.B,
    expected: { ...protocol.sourceHashes }, actual };
}

if (require.main === module) {
  const result = inspectSources(path.resolve(process.argv[2]), process.argv[3] ? path.resolve(process.argv[3]) : process.cwd());
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.declared) {
    process.stderr.write('OwnershipSourcePreflight: sources differ from the declared hosted method. Prepare and review a comparison for these sources before building or measuring; no performance acceptance is granted.\n');
    process.exitCode = 1;
  }
}
module.exports = { inspectSources };
