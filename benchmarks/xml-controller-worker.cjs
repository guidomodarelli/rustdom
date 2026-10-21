/** @file Measures repeated public XML operations on prepared DOMs; all samples and correctness checks are retained. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { serializationFixture } = require('./xml-serialization.cjs');
const { getBenchmarkPlan } = require('./workload-plan.cjs');
const { runtimeEntry } = require('./runtime.cjs');
const { XML_SERIALIZER_BATCH_SIZES, XML_SERIALIZER_WARMUP_BATCHES, XML_SERIALIZER_MEASURED_BATCHES,
  XML_SERIALIZER_GETTER_ERROR_WORKLOAD } = require('./constants/xml-serializer-controller.cjs');
const engine = process.argv[2];
assert.ok(['jsdom', 'rustdom'].includes(engine), 'Expected jsdom or rustdom');
const runtime = engine === 'jsdom' ? require('jsdom') : require(runtimeEntry);
const names = new Set(['xml-serialize', 'xml-inner-serialize', 'xml-document-serialize', 'xml-serialize-error', XML_SERIALIZER_GETTER_ERROR_WORKLOAD]);
const selectedRow = process.argv[3];
const eligibleRows = getBenchmarkPlan().filter(({ name }) => names.has(name));
const rows = selectedRow ? eligibleRows.filter(({ name, size }) => `${name}/${size}` === selectedRow) : eligibleRows;
assert.ok(rows.length > 0 && process.argv.length <= 4, 'XML controller benchmark: expected one known optional workload/size');
const results = [];
for (const { name, size } of rows) {
  const batchSize = XML_SERIALIZER_BATCH_SIZES[size];
  assert.ok(batchSize > 0, `Missing batch size for ${name}/${size}`);
  const work = serializationFixture(runtime, size, name);
  const warmupBatchMs = [], measuredBatchMs = [];
  try {
    for (let batch = 0; batch < XML_SERIALIZER_WARMUP_BATCHES + XML_SERIALIZER_MEASURED_BATCHES; batch++) {
      work.prepare();
      let checksum = 0, result;
      const started = performance.now();
      for (let operation = 0; operation < batchSize; operation++) { result = work.run(); checksum += result; }
      const elapsed = performance.now() - started;
      assert.equal(checksum, result * batchSize, 'Every public result must contribute to the batch checksum');
      work.validate(result, batchSize);
      (batch < XML_SERIALIZER_WARMUP_BATCHES ? warmupBatchMs : measuredBatchMs).push(elapsed);
    }
    results.push({ name, size, batchSize, inputBytes: work.inputBytes, warmupBatchMs, measuredBatchMs,
      outputHash: createHash('sha256').update(work.serialize()).digest('hex') });
  } finally { work.dispose(); }
}
const statistics = runtime.getNativeTreeStatistics?.();
if (statistics) {
  assert.equal(statistics.xmlSerialization.live, 0);
  assert.equal(statistics.xmlSerialization.references, 0);
  assert.equal(statistics.xmlSerialization.cleanupErrors, 0);
  if (statistics.xmlSerializerOperations) assert.equal(statistics.xmlSerializerOperations.active, 0);
}
process.stdout.write(JSON.stringify({ node: process.version, engine, selectedRow: selectedRow ?? null, results, statistics }) + '\n');
