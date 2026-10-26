/** @file Binds the unchanged complete public workload sampler to the official hosted package pins. */
'use strict';
const { main } = require('./paired-main-worker.cjs');
const settings = require('./constants/hosted-main.cjs');
if (require.main === module) {
  const [manifest, phase, engine, position, output] = process.argv.slice(2);
  main(manifest, phase, engine, position, output, settings).catch((error) => {
    process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
  });
}
