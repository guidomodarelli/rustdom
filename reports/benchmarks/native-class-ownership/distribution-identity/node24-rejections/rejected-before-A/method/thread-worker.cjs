/** @file Records real main-thread CPU brackets and affinity around the unchanged public Range loop. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { fixture, loadRuntime, cleanup } = require('./paired-worker.cjs');
const settings = require('./constants/paired.cjs');
const method = require('./constants/thread.cjs');

/** Observe masks on all current threads; a disappearing thread is reported explicitly. */
function affinities() {
  return fs.readdirSync('/proc/self/task').sort((left, right) => Number(left) - Number(right)).map((tid) => {
    try {
      const status = fs.readFileSync(`/proc/self/task/${tid}/status`, 'utf8');
      return { tid: Number(tid), name: status.match(/^Name:\s*(.+)$/m)[1], mask: status.match(/^Cpus_allowed_list:\s*(.+)$/m)[1] };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { tid: Number(tid), disappeared: true };
    }
  });
}

/** Initialize libuv before pinning only the main thread; leave existing background masks intact. */
async function configureAffinity(mode) {
  assert.ok(method.modesSupported.includes(mode));
  await fs.promises.readFile(__filename);
  const initial = affinities();
  if (mode === 'main') {
    assert.notEqual(initial.find((entry) => entry.tid === process.pid).mask, String(method.cpu));
    const result = spawnSync('taskset', ['--pid', '--cpu-list', String(method.cpu), String(process.pid)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const configured = affinities();
  assert.equal(configured.find((entry) => entry.tid === process.pid).mask, String(method.cpu));
  if (mode === 'process') assert.ok(configured.every((entry) => entry.disappeared || entry.mask === String(method.cpu)));
  else assert.ok(configured.some((entry) => entry.tid !== process.pid && !entry.disappeared && entry.mask !== String(method.cpu)));
  return { initial, configured };
}

/** Keep setup, the 1,000 public operations, correctness checks and teardown equivalent to the frozen sampler. */
function sample(runtime, size, clock, record = {}) {
  const dom = new runtime.api.JSDOM(fixture(size));
  const weak = { window: new WeakRef(dom.window), document: new WeakRef(dom.window.document) };
  try {
    const document = dom.window.document;
    const nodes = [...document.querySelectorAll('tr')];
    const ranges = nodes.map((node) => { const range = document.createRange(); range.selectNodeContents(node); return range; });
    const lastRange = ranges.at(-1);
    const comparisonMode = dom.window.Range.START_TO_START;
    global.gc();
    const before = runtime.native?.NativeRange.statistics();
    let result = 0;
    const outerWallStartMs = performance.now();
    const threadCpuStartMs = clock.threadCpuTimeMs();
    const startMs = performance.now();
    for (let iteration = 0; iteration < settings.operations; iteration++) {
      const copy = lastRange.cloneRange(); copy.collapse(iteration % 2 === 0);
      result += copy.compareBoundaryPoints(comparisonMode, lastRange);
    }
    const endMs = performance.now();
    const threadCpuEndMs = clock.threadCpuTimeMs();
    const outerWallEndMs = performance.now();
    const after = runtime.native?.NativeRange.statistics();
    const elapsedMs = endMs - startMs;
    const timing = { outerWallStartMs, threadCpuStartMs, startMs, endMs, threadCpuEndMs, outerWallEndMs };
    Object.assign(record, { elapsedMs, timing, result, before, after });
    assert.equal(result, settings.operations / 2); assert.equal(nodes.length, size);
    for (const [index, range] of ranges.entries()) {
      assert.equal(range.startContainer, nodes[index]); assert.equal(range.endContainer, nodes[index]);
      assert.equal(range.startOffset, 0); assert.equal(range.endOffset, 2); assert.equal(range.collapsed, false);
      assert.equal(nodes[index].getAttribute('data-index'), String(index));
      assert.equal(nodes[index].firstChild.firstChild.textContent, `Row ${index} & value`);
      assert.equal(nodes[index].lastChild.textContent, String(index));
    }
    if (before) assert.equal(after.created - before.created, settings.operations);
    assert.ok(threadCpuEndMs >= threadCpuStartMs);
    return { elapsedMs, timing, result, before, after,
      outputHash: createHash('sha256').update(dom.serialize()).digest('hex'), weak };
  } finally { dom.window.close(); }
}

/** Preserve all warmups and partial results; there is one real package per worker, with no candidate B. */
async function main(manifestPath, engine, mode, blockText, clockPath, output) {
  assert.equal(process.platform, 'linux'); assert.equal(typeof global.gc, 'function');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  assert.equal(fs.existsSync(output), false, 'Preserve existing thread diagnostic report');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  assert.ok(['rustdom', 'jsdom'].includes(engine));
  const block = Number(blockText);
  assert.equal(method.modes[block], mode);
  const root = engine === 'jsdom' ? manifest.copies.J0 : manifest.copies.A0;
  const report = { complete: false, engine, mode, block, root, pid: process.pid, node: process.version, v8: process.versions.v8,
    execArgv: process.execArgv, nodeOptionsPresent: Object.hasOwn(process.env, 'NODE_OPTIONS'), settings, method,
    schedulerStatisticsEnabled: fs.readFileSync('/proc/sys/kernel/sched_schedstats', 'utf8').trim(), samples: [] };
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  save();
  try {
    report.affinity = await configureAffinity(mode); save();
    const runtime = loadRuntime(root, engine);
    const clock = require(path.resolve(clockPath));
    for (const size of block % 2 ? [...settings.sizes].reverse() : settings.sizes) {
      for (const [warmup, count] of [[true, settings.warmupRounds], [false, settings.measuredRounds]]) {
        for (let round = 0; round < count; round++) {
          const record = { size, warmup, round, complete: false }; report.samples.push(record); save();
          Object.assign(record, await cleanup(sample(runtime, size, clock, record), runtime), { complete: true }); save();
          for (const endpoint of record.cleanupTrace.slice(-2)) {
            assert.deepEqual(endpoint.survivors, { window: false, document: false });
            if (endpoint.released) assert.equal(endpoint.released.live, 0);
          }
        }
      }
    }
    report.affinity.final = affinities(); report.complete = true; save();
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) main(...process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
module.exports = { affinities, configureAffinity, sample };
