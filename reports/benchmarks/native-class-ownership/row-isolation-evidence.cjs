/** @file Replays the complete current study, retaining budget failures and rejecting unmeasured sources. */
'use strict';
const { createRecordedEvidenceVerifier, runRecordedEvidenceCli } = require('./recorded-evidence.cjs');

runRecordedEvidenceCli(() => createRecordedEvidenceVerifier({
  study: require('./row-isolation-experiment.cjs'),
  method: require('./constants/row-isolation-study.cjs'),
  policy: require('./constants/row-isolation-evidence.json'),
}));
