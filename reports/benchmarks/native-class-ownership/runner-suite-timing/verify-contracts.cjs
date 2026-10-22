/** @file Mutates copies of real completed output to exercise replay rejection boundaries. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const study = require('./study.cjs');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (filename, value) => fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);

/** Preserve each deliberately corrupted data copy; original samples and platform libraries remain untouched. */
function main(sourceArgument, outputArgument) {
  const source = fs.realpathSync(sourceArgument);
  const output = study.qualified().preparation.inspectDestination(outputArgument, [source]);
  const valid = study.verify(source);
  fs.mkdirSync(output);
  const results = [{ name: 'pristine-real-output', passed: true, result: valid }];
  const cases = [
    { name: 'empty-timing', expected: /incomplete raw timing/, change(index, timing) { for (const name of Object.keys(timing)) delete timing[name]; } },
    { name: 'empty-sources', expected: /incomplete source inventory/, change(index) { index.sources = {}; if (index.publication) index.publication.files = {}; } },
    { name: 'altered-launcher', expected: /unexpected launcher/, change(index, timing) { index.processes[0].launcherArgv = ['unmeasured']; timing.launcherArgv = ['unmeasured']; } },
    { name: 'successful-signal', expected: /successful launcher has a signal/, change(index, timing) { index.processes[0].signal = 'SIGTERM'; timing.signal = 'SIGTERM'; } },
  ];
  for (const scenario of cases) {
    const directory = path.join(output, scenario.name);
    fs.cpSync(source, directory, { recursive: true, verbatimSymlinks: true });
    const filename = path.join(directory, 'index.json');
    const index = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const timingFile = path.join(directory, 'processes/0000/timing.json');
    const timing = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
    scenario.change(index, timing);
    writeJson(timingFile, timing);
    index.processes[0].files['timing.json'] = hash(fs.readFileSync(timingFile));
    writeJson(filename, index);
    assert.throws(() => study.verify(directory), scenario.expected);
    results.push({ name: scenario.name, passed: true });
  }
  writeJson(path.join(output, 'results.json'), { cases: results, measurementsExecuted: false, originalOutputUnchanged: true });
  return { cases: results.length, measurementsExecuted: false };
}
if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(...process.argv.slice(2)))}\n`); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { main };
