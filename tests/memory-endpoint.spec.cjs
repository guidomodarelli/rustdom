/** @file Validates real resource release and bounded failure of the memory measurement endpoint. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const mode of ['jsdom', 'rustdom']) {
  test(`should reject retained Documents and reach a zero endpoint after releasing ${mode} fixtures`, (context) => {
    const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/memory-endpoint-worker.cjs'), mode], {
      cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    });
    if (child.error) throw child.error;
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const report = JSON.parse(child.stdout);
    assert.equal(report.pass, true);
    assert.equal(report.cycles.length, 6);
    for (const cycle of report.cycles) {
      assert.equal(cycle.retained.reached, false);
      assert.equal(cycle.released.reached, true);
      assert.equal(cycle.released.state.survivors.documents, 0);
      assert.equal(cycle.released.state.survivors.windows, 0);
    }
    context.diagnostic(JSON.stringify({ mode, node: report.node, cycles: report.cycles.map((cycle) => ({
      cycle: cycle.cycle, retainedAccepted: cycle.retained.reached,
      retainedDocuments: cycle.retained.state.survivors.documents,
      retainedNativeNodes: cycle.retained.state.nativeTree?.liveNodes,
      releasedAccepted: cycle.released.reached, releasedSurvivors: cycle.released.state.survivors,
      releasedNativeNodes: cycle.released.state.nativeTree?.liveNodes,
    })) }));
  });
}
