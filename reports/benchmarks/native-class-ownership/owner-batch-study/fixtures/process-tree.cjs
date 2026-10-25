/** @file Genuine owned child/grandchild cancellation fixture; no SDK, process API or platform mocks. */
'use strict';
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const ready = process.argv[2];
const child = spawn(process.execPath, ['-e', "process.stdout.write('ready\\n'); setInterval(() => {}, 1000);"],
  { stdio: ['ignore', 'pipe', 'inherit'] });
child.stdout.once('data', () => {
  fs.writeFileSync(ready, JSON.stringify({ parent: process.pid, child: child.pid }) + '\n', { flag: 'wx' });
  process.stdout.write('tree-ready\n');
  if (process.argv[3] === 'exit-parent') process.exit(0);
});
setInterval(() => {}, 1000);
