/** @file Records the actual fixed official Node executable used by prospective contract checks. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { runtimeExecutableHashes } = require('../../constants/current-ownership.json');
assert.equal(process.version, 'v' + process.argv[2], 'Combined contracts: unsupported runtime version');
const sha256 = createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex');
assert.equal(sha256, runtimeExecutableHashes[process.version], 'Combined contracts: official Node bytes differ');
console.log(JSON.stringify({ node: process.version, executable: process.execPath, sha256,
  samplerInvoked: false, performanceAccepted: null, gateReevaluated: false }));
