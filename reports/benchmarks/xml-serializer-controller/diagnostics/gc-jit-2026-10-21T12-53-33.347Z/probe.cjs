/** Measures real public calls with diagnostic CPU/GC observation; never used for acceptance. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { performance, PerformanceObserver } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const root = process.cwd(), rowKey = process.argv[2], output = process.argv[3], traced = process.argv[4] === 'trace';
const events = [];
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) events.push({ startTime: entry.startTime, duration: entry.duration, detail: entry.detail });
});
observer.observe({ entryTypes: ['gc'] });
const { serializationFixture } = require(path.join(root, 'benchmarks/xml-serialization.cjs'));
const settings = require(path.join(root, 'benchmarks/constants/xml-serializer-controller.cjs'));
const { runtimeEntry, nativeBinaryPath } = require(path.join(root, 'benchmarks/runtime.cjs'));
const runtime = require(runtimeEntry);
const [name, sizeText] = rowKey.split('/'), size = Number(sizeText), batchSize = settings.XML_SERIALIZER_BATCH_SIZES[size];
assert.ok(['xml-serialize/1', 'xml-serializer-getter-error/1'].includes(rowKey));
const samples = [];
async function main() {
  const work = serializationFixture(runtime, size, name);
  let outputHash;
  try {
    for (let batch = 0; batch < settings.XML_SERIALIZER_WARMUP_BATCHES + settings.XML_SERIALIZER_MEASURED_BATCHES; batch++) {
      work.prepare();
      if (traced) process.stdout.write(`PROBE_START batch=${batch} time=${performance.now()}\n`);
      const beforeCpu = process.cpuUsage(), startTime = performance.now();
      let checksum = 0, result;
      for (let operation = 0; operation < batchSize; operation++) { result = work.run(); checksum += result; }
      const endTime = performance.now(), cpu = process.cpuUsage(beforeCpu);
      assert.equal(checksum, result * batchSize); work.validate(result, batchSize);
      samples.push({ batch, warmup: batch < settings.XML_SERIALIZER_WARMUP_BATCHES, startTime, endTime,
        elapsedMs: endTime - startTime, cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000 });
      if (traced) process.stdout.write(`PROBE_END batch=${batch} time=${endTime}\n`);
    }
    outputHash = createHash('sha256').update(work.serialize()).digest('hex');
  } finally { work.dispose(); }
  // Deliver GC observer entries after the synchronous workload without inserting yields into it.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  observer.disconnect();
  for (const sample of samples) {
    sample.gcOverlapMs = events.reduce((total, event) => total + Math.max(0,
      Math.min(sample.endTime, event.startTime + event.duration) - Math.max(sample.startTime, event.startTime)), 0);
  }
  const statistics = runtime.getNativeTreeStatistics();
  assert.equal(statistics.xmlSerialization.live, 0); assert.equal(statistics.xmlSerialization.references, 0);
  assert.equal(statistics.xmlSerialization.cleanupErrors, 0);
  fs.writeFileSync(output, JSON.stringify({ node: process.version, rowKey, traced, batchSize, settings, outputHash,
    nativeBinarySha256: createHash('sha256').update(fs.readFileSync(nativeBinaryPath)).digest('hex'),
    samples, gcEvents: events, statistics,
    limitations: 'CPU includes process background threads and a slightly wider envelope than the wall timer. GC entries are delivered asynchronously and do not describe all concurrent GC CPU. Tracing/observation can perturb timing. No performance acceptance or leak absence is inferred.' }, null, 2) + '\n', { flag: 'wx' });
}
main().catch((error) => { observer.disconnect(); process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
