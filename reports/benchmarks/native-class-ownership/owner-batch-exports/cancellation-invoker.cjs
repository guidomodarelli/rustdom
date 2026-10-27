/** @file Exercise the exact exported lifecycle at its own command boundary with a real tree and fixed Node executable. */
'use strict';
const path = require('node:path');
const { invokeReader } = require('./invoke.cjs');
const [destination, receipt] = process.argv.slice(2);
invokeReader([process.execPath, path.join(__dirname, 'cancellation-tree.cjs'), receipt, 'parent'], destination)
  .then((record) => { process.exitCode = record.interruptedBy || record.cancelled || record.timedOut ? 1 : record.exitCode; })
  .catch((error) => { process.stderr.write(String(error.stack) + '\n'); process.exitCode = 1; });
