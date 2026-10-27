/** @file Writes a fixed synthetic sensitivity grid, preserving every generated pair and adverse interval. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { sensitivity } = require('./model.cjs');
const policy = require('./constants/model.json');

/** @param {string} filename - Current source or SDK file. @returns {string} Exact byte digest. */
function hashFile(filename) { return createHash('sha256').update(fs.readFileSync(filename)).digest('hex'); }

/** @param {string} destination - Absent output directory with an existing parent. @returns {object} Complete simulation ledger; no runtime or performance acceptance. */
function simulate(destination) {
  const output = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  fs.mkdirSync(output); // Preserve an existing directory, file or dangling link by failing.
  const repository = path.resolve(__dirname, '../../../../..');
  const sourceFiles = Object.fromEntries([
    'run.cjs', 'model.cjs', 'constants/model.json',
    '../../range-combined-study/paired-interval.cjs', '../../range-combined-study/constants/interval.json',
    '../../combined-process-study/constants/protocol.json',
  ].map((relative) => {
    const filename = path.resolve(__dirname, relative);
    return [path.relative(repository, filename).split(path.sep).join('/'), hashFile(filename)];
  }));
  const record = { revision: policy.revision, complete: false, planningOnly: true,
    DOMExecuted: false, measurementExecuted: false, executionReady: false,
    performanceAccepted: null, gateReevaluated: false, policy,
    node: process.version, nodeBinarySha256: hashFile(process.execPath),
    host: { platform: process.platform, architecture: process.arch, cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model },
    sourceFiles, cases: [], interpretation: 'Hypothetical models; no historical variance estimate, power guarantee or simultaneous-coverage claim' };
  const save = () => fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(record, null, 2) + '\n');
  save();
  try {
    assert.equal(new Set(policy.scenarios.map((scenario) => scenario.id)).size, policy.scenarios.length);
    for (const scenario of policy.scenarios) {
      const result = sensitivity(scenario);
      const { syntheticResults, ...summary } = result;
      const filename = scenario.id + '.json.gz';
      assert.equal(path.basename(filename), filename);
      const bytes = gzipSync(Buffer.from(JSON.stringify(result) + '\n'));
      fs.writeFileSync(path.join(output, filename), bytes, { flag: 'wx' });
      record.cases.push({ ...summary, rawFile: filename, rawBytes: bytes.length,
        rawSha256: createHash('sha256').update(bytes).digest('hex') });
      save();
      process.stdout.write(JSON.stringify({ case: scenario.id, trials: result.trials,
        boundedCoverage: result.boundedCoverageFraction, withinBudget: result.withinBudgetFraction }) + '\n');
    }
    for (const [relative, expected] of Object.entries(sourceFiles)) assert.equal(hashFile(path.join(repository, relative)), expected);
    record.complete = true;
  } catch (error) {
    record.failure = { name: error.name, message: error.message, stack: error.stack };
    throw error;
  } finally { save(); }
  return record;
}

module.exports = { simulate };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 3, 'Provide one absent destination for synthetic sensitivity data');
    simulate(process.argv[2]);
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = 1; }
}
