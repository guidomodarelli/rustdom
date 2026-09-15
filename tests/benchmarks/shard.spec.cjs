/** @file Verifies complete and disjoint coverage of the actual benchmark workload plan. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getBenchmarkPlan } = require('../../benchmarks/workload-plan.cjs');
const { readBenchmarkShard, selectWorkloadShard } = require('../../benchmarks/shard.cjs');

test('should preserve the unpartitioned default and reject invalid partition settings', () => {
  assert.deepEqual(readBenchmarkShard({}), { index: 0, count: 1 });
  for (const env of [{ RUSTDOM_BENCHMARK_SHARD_COUNT: '0' }, { RUSTDOM_BENCHMARK_SHARD_COUNT: 'NaN' }, { RUSTDOM_BENCHMARK_SHARD_INDEX: '-1' }, { RUSTDOM_BENCHMARK_SHARD_COUNT: '4', RUSTDOM_BENCHMARK_SHARD_INDEX: '4' }]) assert.throws(() => readBenchmarkShard(env));
});

test('should cover every default workload exactly once across the four CI partitions', () => {
  const plan = getBenchmarkPlan().filter((workload) => !workload.manualOnly);
  const shards = Array.from({ length: 4 }, (_, index) => selectWorkloadShard(plan, readBenchmarkShard({ RUSTDOM_BENCHMARK_SHARD_COUNT: '4', RUSTDOM_BENCHMARK_SHARD_INDEX: String(index) })));
  assert.ok(shards.every((shard) => shard.length > 0));
  assert.equal(shards.flat().length, plan.length); assert.equal(new Set(shards.flat()).size, plan.length);
  assert.ok(plan.every((workload) => shards.flat().includes(workload)));
  assert.deepEqual(selectWorkloadShard(plan, readBenchmarkShard({})), plan);
});
