/** @file Interpretation limits of the terminal ownership sample audit. */
'use strict';
module.exports = {
  revision: 'current-ownership-trajectories-v1',
  packetDirectory: 'current-source-results/39921160254',
  inputFiles: ['process-samples.json.gz', 'summary.json', 'receipt.json'],
  limits: [
    'Descriptive reuse of every recorded sample; no new timings or acceptance decision.',
    'Sample indices are fresh realms in the same process, not repeated timings of one realm.',
    'Physical-copy groups and sample-index medians reuse observations; they are not independent replications.',
    'Process medians and trajectories do not replace the predeclared pooled-median estimator.',
    'Durations alone cannot identify JIT, GC, CPU scheduling or the native ownership guard as a cause.',
    'No filtering, confidence interval, sample-size extension or change to the consumed protocol.',
  ],
};
