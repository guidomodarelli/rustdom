/** @module owner-batch-sampler Times unchanged public tasks with sequential fresh mutable fixtures; development contracts never accept performance. */
'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const policy = require('./constants/sampler.json');

/** @param {unknown} error - Original thrown value. @returns {object} Scalar diagnostic without retaining a DOM target. */
function failureView(error) {
  try { return { type: String(error?.name ?? typeof error).slice(0, policy.failureTextLimitCharacters),
    message: String(error?.message ?? error).slice(0, policy.failureTextLimitCharacters) }; }
  catch { return { type: policy.unserializableErrorKind }; }
}

/**
 * Bind the existing real public fixtures and operations; callers supply current reviewed modules, not archived scripts.
 * @param {object} dependencies - Mature fixture, warmup and operation helpers used by the original workloads.
 * @returns {object} Single-block and complete-row measurement functions; no launcher or acceptance decision.
 */
function createBatchSampler({ fixtureHTML, fixtures, operations, warmOwnership, collectGarbage }) {
  for (const implementation of [fixtureHTML, fixtures.createMutationFixture, fixtures.createDeliveryFixture,
    fixtures.captureRecords, operations.control, operations.lifecycle, warmOwnership, collectGarbage]) {
    assert.equal(typeof implementation, 'function');
  }

  /** @param {object} dom - Caller-owned real JSDOM realm. @param {string} name - Declared workload. @param {number} size - Fixed row size. @returns {object} Immutable inputs and the caller-owned real realm. */
  function context(dom, name, size) {
      const document = dom.window.document;
      const rangeNodes = [policy.workloads.control, policy.workloads.lifecycle].includes(name)
        ? [...document.querySelectorAll('tr')] : null;
      const ranges = name === policy.workloads.control ? rangeNodes.map((node) => {
        const range = document.createRange(); range.selectNodeContents(node); return range;
      }) : null;
      const texts = name === policy.workloads.lifecycle
        ? rangeNodes.map((node) => node.firstChild.firstChild.firstChild) : null;
      const expectedUnits = texts ? Array.from({ length: policy.rangeIterations },
        (unused, index) => texts[index % size].length).reduce((total, length) => total + length, 0) : null;
      return { dom, document, ranges, lastRange: ranges?.at(-1), texts,
        comparisonMode: dom.window.Range.START_TO_START,
        expectedLifecycle: expectedUnits === null ? null : expectedUnits * 3 + policy.rangeIterations };
  }

  /** @param {object} runtime - Actual Rust or independent jsdom exports. @param {string} name - Workload family. @returns {number|null} Primitive allocation counter, queried outside every timer. */
  function allocations(runtime, name) {
    const statistics = runtime.api.getNativeTreeStatistics?.();
    if (statistics === undefined) return null;
    const created = statistics[policy.nativeFamilies[name]]?.created;
    assert.ok(Number.isSafeInteger(created) && created >= 0, 'Owner batch: missing native family ' + policy.nativeFamilies[name]);
    return created;
  }

  /**
   * Execute and validate a single equivalent task. Mutable observers/hosts are disposed before returning.
   * @param {object} current - Live realm and immutable Range inputs.
   * @param {string} name - Exact declared public workload.
   * @param {number} size - Original fixture size.
   * @param {object} record - Caller-owned scalar progress, filled even if the task fails.
   * @returns {Promise<void>} No strong DOM reference escapes through the record.
   */
  async function task(current, name, size, record) {
    let mutable;
    let result;
    let snapshots;
    let failed = false;
    try {
      if (name === policy.workloads.mutation) mutable = fixtures.createMutationFixture(current.document, size);
      else if (name === policy.workloads.delivery) {
        mutable = fixtures.createDeliveryFixture(current.document, size, name);
        await new Promise((resolve) => setImmediate(resolve));
        mutable.prepare();
      }
      record.startMs = performance.now();
      try {
        if (name === policy.workloads.mutation) result = mutable.produce();
        else if (name === policy.workloads.delivery) result = await mutable.completed;
        else if (name === policy.workloads.control) {
          result = operations.control(current.lastRange, current.comparisonMode, policy.rangeIterations);
        } else result = operations.lifecycle(current.dom.window, current.document, current.texts, policy.rangeIterations);
      } finally { record.durationMs = performance.now() - record.startMs; }
      assert.ok(Number.isFinite(record.durationMs) && record.durationMs > 0, 'Owner batch: invalid task duration');
      if (name === policy.workloads.mutation) {
        snapshots = fixtures.captureRecords(result); mutable.validate(snapshots);
      } else if (name === policy.workloads.delivery) mutable.validate();
      else if (name === policy.workloads.control) {
        assert.equal(result, policy.rangeIterations / 2);
        assert.equal(current.lastRange.startOffset, 0); assert.equal(current.lastRange.endOffset, 2);
        assert.equal(current.lastRange.collapsed, false);
      } else assert.equal(result, current.expectedLifecycle);
      assert.equal(current.document.querySelector('a').textContent, policy.firstAnchorText);
      record.outputHash = createHash('sha256').update(current.dom.serialize()).digest('hex');
      record.complete = true;
    } catch (error) { failed = true; record.failure = failureView(error); throw error; }
    finally {
      snapshots = result = null;
      try { mutable?.dispose(); }
      catch (error) { record.cleanupFailure = failureView(error); if (!failed) throw error; }
      finally { mutable = null; }
    }
  }

  /**
   * Run exactly one new realm and 16 sequential timed tasks, preserving scalar partial progress on errors.
   * @param {object} input - Real runtime, engine, row, stage, block index, weak-owner bag and progress writer.
   * @returns {Promise<object>} Raw times and original-output hashes; never a performance decision.
   */
  async function measureBlock({ runtime, engine, key, stage, blockIndex, owners,
    purpose = policy.purposes.functional, onProgress = () => {} }) {
    assert.ok(policy.rows.includes(key), 'Owner batch: unsupported row ' + key);
    assert.ok(policy.engines.includes(engine));
    assert.ok(Object.values(policy.purposes).includes(purpose));
    if (purpose === policy.purposes.capture) assert.equal(policy.executionReady, true, 'Owner batch: capture is not enabled');
    assert.ok(Object.values(policy.stages).includes(stage));
    assert.ok(Number.isSafeInteger(blockIndex) && blockIndex >= 0);
    assert.equal(typeof global.gc, 'function', 'Owner batch: --expose-gc is required');
    const separator = key.lastIndexOf('/'); const name = key.slice(0, separator); const size = Number(key.slice(separator + 1));
    const record = { key, stage, blockIndex, complete: false, tasks: [],
      purpose, functionalOnly: purpose === policy.purposes.functional, performanceAccepted: null, gateReevaluated: false };
    let current;
    let dom;
    let failed = false;
    try {
      dom = new runtime.api.JSDOM(fixtureHTML(size));
      owners.window.push(new WeakRef(dom.window)); owners.document.push(new WeakRef(dom.window.document));
      current = context(dom, name, size);
      record.nativeCreatedBeforeWarmup = allocations(runtime, name);
      if (engine === 'rustdom') assert.notEqual(record.nativeCreatedBeforeWarmup, null, 'Owner batch: actual native statistics required');
      else assert.equal(record.nativeCreatedBeforeWarmup, null, 'Owner batch: the reference must be independent jsdom');
      onProgress(record);
      await collectGarbage(); global.gc();
      await warmOwnership({ name, window: current.dom.window, document: current.document, size,
        iterations: policy.rangeIterations, range: current.lastRange, comparisonMode: current.comparisonMode,
        texts: current.texts, expectedLifecycle: current.expectedLifecycle,
        createMutationFixture: fixtures.createMutationFixture, createDeliveryFixture: fixtures.createDeliveryFixture,
        captureRecords: fixtures.captureRecords });
      record.withinRealmWarmupRounds = policy.withinRealmWarmupRounds;
      record.nativeCreatedBefore = allocations(runtime, name);
      for (let index = 0; index < policy.logicalTasksPerBlock; index++) {
        const entry = { index, complete: false }; record.tasks.push(entry);
        await task(current, name, size, entry);
        if (index) assert.equal(entry.outputHash, record.tasks[0].outputHash, 'Owner batch: task output differs within block');
      }
      record.nativeCreatedAfter = allocations(runtime, name);
      if (engine === 'rustdom') assert.ok(record.nativeCreatedAfter > record.nativeCreatedBefore,
        'Owner batch: the public workload did not exercise its native family');
      record.complete = true; onProgress(record);
      return record;
    } catch (error) { failed = true; record.failure = failureView(error); throw error; }
    finally {
      let cleanupFailed = false;
      let cleanupError;
      try { dom?.window.close(); }
      catch (error) {
        cleanupFailed = true; cleanupError = error; record.cleanupFailure = failureView(error);
      } finally { current = dom = null; }
      await new Promise((resolve) => setImmediate(resolve)); global.gc();
      if (cleanupFailed && !failed) throw cleanupError;
    }
  }

  /** @param {object} input - Selected runtime/row and caller-owned weak progress bag. @returns {Promise<object>} All 12 blocks, 144 measured durations and 48 warmup durations. */
  async function measureRow(input) {
    const blocks = [];
    for (let blockIndex = 0; blockIndex < policy.warmupBlocksPerProcess + policy.measuredBlocksPerProcess; blockIndex++) {
      const stage = blockIndex < policy.warmupBlocksPerProcess ? policy.stages.warmup : policy.stages.measured;
      const block = await measureBlock({ ...input, stage, blockIndex }); blocks.push(block);
      if (blocks.length > 1) assert.equal(block.tasks[0].outputHash, blocks[0].tasks[0].outputHash);
    }
    return { key: input.key, complete: true,
    purpose: input.purpose ?? policy.purposes.functional,
    functionalOnly: (input.purpose ?? policy.purposes.functional) === policy.purposes.functional,
    blocks, measuredSamplesMs: blocks.filter((block) => block.stage === policy.stages.measured)
      .flatMap((block) => block.tasks.map((entry) => entry.durationMs)),
    warmupSamplesMs: blocks.filter((block) => block.stage === policy.stages.warmup)
      .flatMap((block) => block.tasks.map((entry) => entry.durationMs)),
    performanceAccepted: null, gateReevaluated: false };
  }
  return { measureBlock, measureRow };
}
module.exports = { createBatchSampler, failureView };
