/** @file Validates benchmark partition settings and partitions an already selected workload list. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} [env] - Runtime configuration. @returns {{index: number, count: number}} Valid partition identity. */
function readBenchmarkShard(env = process.env) {
  const count = Number(env.RUSTDOM_BENCHMARK_SHARD_COUNT ?? 1);
  const index = Number(env.RUSTDOM_BENCHMARK_SHARD_INDEX ?? 0);
  assert.ok(Number.isSafeInteger(count) && count > 0, 'RUSTDOM_BENCHMARK_SHARD_COUNT must be a positive safe integer');
  assert.ok(Number.isSafeInteger(index) && index >= 0 && index < count, 'RUSTDOM_BENCHMARK_SHARD_INDEX must be a safe integer from 0 to shard count minus 1');
  return { index, count };
}

/** @param {object[]} workloads - Eligible workloads in canonical order. @param {{index: number, count: number}} shard - Validated partition. @returns {object[]} Disjoint subset preserving order. */
function selectWorkloadShard(workloads, shard) { return workloads.filter((workload, index) => index % shard.count === shard.index); }
module.exports = { readBenchmarkShard, selectWorkloadShard };
