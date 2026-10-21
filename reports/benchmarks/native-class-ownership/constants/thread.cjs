/** @file Fixed affinity diagnostic; it does not compare or accept a candidate implementation. */
'use strict';
module.exports = {
  revision: 'thread-cpu-affinity-v2-layout',
  modes: ['process', 'main', 'main', 'process'],
  modesSupported: ['process', 'main'],
  cpu: 2,
  kernelReference: 'https://docs.kernel.org/scheduler/sched-stats.html',
  clockReference: 'https://man7.org/linux/man-pages/man3/clock_gettime.3.html',
  methodFiles: [
    'reports/benchmarks/native-class-ownership/thread-diagnostic.cjs',
    'reports/benchmarks/native-class-ownership/thread-worker.cjs',
    'reports/benchmarks/native-class-ownership/thread-clock.spec.cjs',
    'reports/benchmarks/native-class-ownership/constants/thread.cjs',
    'reports/benchmarks/native-class-ownership/THREAD-PROTOCOL.md',
    'reports/benchmarks/native-class-ownership/paired-worker.cjs',
    'reports/benchmarks/native-class-ownership/paired-experiment.cjs',
    'reports/benchmarks/native-class-ownership/constants/paired.cjs',
    'reports/benchmarks/native-class-ownership/constants/hosted.cjs',
    'scripts/memory-endpoint.cjs',
    'reports/benchmarks/native-class-ownership/thread-clock-addon/Cargo.toml',
    'reports/benchmarks/native-class-ownership/thread-clock-addon/Cargo.lock',
    'reports/benchmarks/native-class-ownership/thread-clock-addon/src/lib.rs',
    'reports/benchmarks/native-class-ownership/thread-clock-addon/build.rs',
    'reports/benchmarks/native-class-ownership/thread-clock-addon/build.mjs',
    'reports/benchmarks/native-class-ownership/constants/thread-history.json',
  ],
};
