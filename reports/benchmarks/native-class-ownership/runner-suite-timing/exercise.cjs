/** @file Qualifies the exact timing wrapper with complete suites; never accepts performance. */
'use strict';
const { runExercise } = require('./study.cjs');
try {
  const [prepared, output, ...nodes] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(runExercise(prepared, output, nodes), null, 2)}\n`);
} catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
