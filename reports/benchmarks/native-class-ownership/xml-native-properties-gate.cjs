/** @file Selects and recomputes the accepted full-input XML capture for its measured source and recipe only. */
'use strict';
const { main } = require('./xml-history.cjs');
const recipe = require('./constants/xml-native-properties-gate.json');

if (require.main === module) {
  try { main(process.argv.slice(2), recipe); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
