/** @file Fixed diagnostic scope; no performance budget or treatment acceptance is defined here. */
'use strict';
const original = require('./paired-inline.cjs');
const originalMethod = require('./paired-inline-study.cjs');
const SHARED_RUNNER_MODE = 'shared';
const INDEPENDENT_RUNNER_MODE = 'independent';
/** Keep diagnostic artifact paths relative to the repository or output directory as named. */
module.exports = {
  revision: 'runner-sharing-diagnostic-v1',
  nodeVersions: original.nodeVersions,
  sharedMode: SHARED_RUNNER_MODE,
  modes: [SHARED_RUNNER_MODE, INDEPENDENT_RUNNER_MODE],
  labels: ['A', 'B'],
  phase: 'AA',
  engine: 'jsdom',
  positions: original.workerCount,
  workload: { name: 'range-control-1000', size: 250 },
  runnerParts: ['benchmarks', 'tests/integration/read-dom-file.cjs'],
  runnerSha256: 'c3708ad1f9d18e92d9fd384621dbdb0b7dd46eb5ba66d9753e856ca9153c6fec',
  sourceHash: originalMethod.sourceHashes.B,
  workerTimeoutMs: originalMethod.workerTimeoutMs,
  flags: ['--expose-gc', '--trace-opt', '--trace-deopt', '--trace-file-names'],
  files: { worker: 'runner-sharing-worker.cjs', workloadEntry: 'benchmarks/worker.cjs',
    index: 'index.json', harness: 'harness', runners: 'runners' },
  events: { start: 'batch-start', returned: 'measurement-returned', end: 'batch-end' },
  digestPattern: /^[0-9a-f]{64}$/,
  commitPattern: /^[0-9a-f]{40}$/,
  methodFiles: [...originalMethod.methodFiles,
    'reports/benchmarks/native-class-ownership/RUNNER-SHARING-PROTOCOL.md',
    'reports/benchmarks/native-class-ownership/constants/runner-sharing.cjs',
    'reports/benchmarks/native-class-ownership/runner-sharing-worker.cjs',
    'reports/benchmarks/native-class-ownership/runner-sharing-diagnostic.cjs',
    'reports/benchmarks/native-class-ownership/runner-sharing.spec.cjs'],
};
