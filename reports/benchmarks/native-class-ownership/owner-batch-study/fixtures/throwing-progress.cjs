/** @file Reproduce original primitive progress rejection across the real worker/DOM/cleanup boundary; no library substitution. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { main } = require('../worker.cjs');
const { failureView } = require('../batches.cjs');
const policy = require('../constants/worker.json');
const [kind, ...args] = process.argv.slice(2);
assert.ok(['undefined', 'null', 'symbol'].includes(kind));
const original = kind === 'undefined' ? undefined : kind === 'null' ? null : Symbol('progress-failure');
let observed;
main(args, true, (progress) => { observed = progress; throw original; }).then(() => {
  assert.fail('Expected original progress rejection');
}, (error) => {
  assert.equal(error, original, 'Worker replaced the original rejected value');
  assert.deepEqual(observed, { blockIndex: 0, complete: false, tasks: 0 });
  fs.writeFileSync(args[5] + '.caught.json', JSON.stringify({ originalPreserved: true, kind, observed }) + '\n', { flag: 'wx' });
}).catch((error) => {
  process.stderr.write(JSON.stringify(failureView(error)) + '\n'); process.exitCode = policy.failureExitCode;
});
