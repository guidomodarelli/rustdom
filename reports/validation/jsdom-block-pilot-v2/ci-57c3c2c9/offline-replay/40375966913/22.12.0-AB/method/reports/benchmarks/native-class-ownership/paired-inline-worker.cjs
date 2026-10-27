/** @file Binds the unchanged full-batch worker algorithm to the explicit native inline candidate. */
'use strict';
const { main } = require('./paired-main-worker.cjs');
const settings = require('./constants/paired-inline.cjs');
if (require.main === module) {
  const [manifest, phase, engine, position, output] = process.argv.slice(2);
  main(manifest, phase, engine, position, output, settings).catch((error) => {
    process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
  });
}
