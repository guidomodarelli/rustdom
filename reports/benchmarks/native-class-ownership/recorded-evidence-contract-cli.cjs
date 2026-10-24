/** @file Binds real historical/current fixtures to the same CLI boundary intended for the ownership gate. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRecordedEvidenceVerifier, runRecordedEvidenceCli } = require('./recorded-evidence.cjs');

runRecordedEvidenceCli(() => {
  const fixture = JSON.parse(fs.readFileSync(process.env.RUSTDOM_RECORDED_EVIDENCE_FIXTURE, 'utf8'));
  const scenario = fixture.scenarios.find((entry) => entry.kind === process.argv[2]);
  assert.ok(scenario, 'Recorded evidence contract CLI: fixture scenario is undeclared');
  const implementations = {
    seeded: { study: require('./seeded-pre-gc-experiment.cjs'), method: require('./constants/seeded-pre-gc-study.cjs') },
    rowIsolated: { study: require('./row-isolation-experiment.cjs'), method: require('./constants/row-isolation-study.cjs') },
  };
  const implementation = implementations[scenario.kind];
  assert.ok(implementation, 'Recorded evidence contract CLI: real study implementation is undeclared');
  return createRecordedEvidenceVerifier({ ...implementation, policy: scenario.policy });
}, process.argv.slice(3));
