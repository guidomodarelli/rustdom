/** @file Owned live process-tree fixture. It records real PIDs and partial output; it never runs DOM or benchmark workloads. */
'use strict';
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const [receipt, generation] = process.argv.slice(2);
if (generation === 'parent') spawn(process.execPath, [__filename, receipt, 'descendant'], { stdio: 'inherit' });
fs.appendFileSync(receipt, JSON.stringify({ pid: process.pid, generation }) + '\n');
process.stdout.write('Owned cancellation fixture: ' + generation + ' partial output\n');
setInterval(() => {}, 1000);
