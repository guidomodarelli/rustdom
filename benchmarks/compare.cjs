/** @file Runs isolated benchmark processes, preserves raw samples, and writes comparable summaries. */
'use strict';
const { spawnSync } = require('node:child_process');
const { readFileSync, readdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const { cpus, platform, arch, release, totalmem } = require('node:os');
const { createHash } = require('node:crypto');
const { BenchmarkReport } = require('./report.cjs');

/** Use fresh processes and alternate ordering to reduce shared-heap and ordering bias. */
const ORDERS = [['jsdom', 'rustdom'], ['rustdom', 'jsdom']];
/** Store reports in version control as requested; never replace results with marketing claims. */
const outputDirectory = 'reports/benchmarks';
/** Optional workload names reuse the exact fixtures and sampling of the full benchmark. */
const requestedWorkloads = process.argv.slice(2);
/** Bound a complete worker plan, including untimed setup and cleanup, on slower CI hosts. */
const workerTimeoutMs = Number(process.env.RUSTDOM_BENCHMARK_TIMEOUT_MS ?? 600_000);
assert.ok(Number.isSafeInteger(workerTimeoutMs) && workerTimeoutMs > 0,
  'RUSTDOM_BENCHMARK_TIMEOUT_MS must be a positive safe integer in milliseconds');

/** @param {string} directory - Owned source directory. @returns {string[]} Files included in the reproducibility digest. */
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
}
const measuredSources = [...sourceFiles('src'), ...sourceFiles('scripts'), ...sourceFiles('benchmarks'),
  'package-lock.json', 'Cargo.toml', 'Cargo.lock'].sort();
const sourceDigest = createHash('sha256');
for (const path of measuredSources) sourceDigest.update(path).update('\0').update(readFileSync(path)).update('\0');

/** Capture source and dependency identities alongside machine information. */
const report = {
  schemaVersion: 1, capturedAt: new Date().toISOString(),
  requestedWorkloads, workerTimeoutMs, complete: false,
  node: process.version, jsdom: require('jsdom/package.json').version,
  rustc: spawnSync('rustc', ['-Vv'], { encoding: 'utf8' }).stdout?.trim() || null,
  cargo: spawnSync('cargo', ['-V'], { encoding: 'utf8' }).stdout?.trim() || null,
  sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() || null,
  sourceChanges: spawnSync('git', ['status', '--porcelain', '--', 'src', 'scripts', 'benchmarks', 'Cargo.toml', 'Cargo.lock', 'package-lock.json'],
    { encoding: 'utf8' }).stdout?.trim().split('\n').filter(Boolean) ?? null,
  nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
  machine: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0].model,
    logicalCpus: cpus().length, totalMemoryBytes: totalmem() },
  sourceHash: sourceDigest.digest('hex'), measuredSources,
  methodology: {
    build: 'cargo release, thin LTO', processOrders: ORDERS,
    timing: 'Public operation only; excludes module startup, setup, validation, window.close and explicit GC.',
    memory: 'Process memory after window.close, one event-loop turn and explicit GC; not peak memory or allocation totals.',
    compatibility: 'Row count, decoded text, and deterministic full-document SHA-256 are checked outside timing. Cross-engine output hashes must match. serialize-utf8 includes result consumption via Buffer.byteLength.',
    environments: 'Environment setup includes creation of a 25-row document with outside-only scripts, excludes imports and teardown, and uses an isolated globals object for the normal setup case.',
    nodeComparisons: 'Cloning and selecting comparison nodes happen before timing. Equality compares complete independent 250-row trees 100 times; position compares the last sibling with 1000 cycling peers plus containment at 250 and 1000 rows. Result checksums are asserted.',
    nodeRoots: 'Read public getRootNode and isConnected 1000 times on a table Text, or on a separately prepared section chain whose depth equals the row count (250/1000). Creation is outside timing; each returned identity/boolean is consumed and the final serialized document digest must match.',
    shadowRoots: 'For queries, prepare 25/100 nested open/closed roots before timing, then read composed getRootNode and isConnected 1000 times. Creation workload times 100 independent host attachments and innerHTML parsing. Verify all root hosts, final counts/content and include every shadow root mode/innerHTML in the output digest outside timing.',
    eventRetargeting: 'Prepare two disjoint shadow chains, each 10/30 roots deep, before timing. Create and dispatch 100 composed bubbling MouseEvents with relatedTarget in the other chain. Count outer-host listener calls and validate exact target/relatedTarget identities, then verify shadow/document digests outside timing. Listener references are cleared before GC.',
    slots: 'Prepare one open root with 25/100 distinct named slots and one assigned Element before timing. Read assignedSlot 1000 times, or alternate 100 slot-name assignments with identity reads, including mutation hooks. Validate first-match identities and every assignedNodes list, then hash the document and shadow contents outside timing.',
    denseSlots: 'Prepare 25/100 distinct slots and twice as many light Element children before timing, with the first target initially assigned to the final slot. Read assignedNodes({flatten:true}) 100 times while consuming every identity and length, or alternate 100 target-name assignments including hooks and assignedSlot reads. Validate all cached/fresh lists and full document/shadow hashes outside timing.',
    cachedSlots: 'Use the same dense slot fixture and 100 public assignedNodes() calls without flattening. Consume every returned identity and length, validate all final lists and full output digests outside timing. This includes canonical native cache reads, N-API transfer and wrapper resolution, without recomputing candidates.',
    slotEvents: 'Use the same dense fixture and dispatch 100 composed bubbling Events from the assigned light child. Include Event construction, dispatch, recorded-backlink traversal and listener path/target observations in timing. Verify exact notification count, target identity, path membership, assignment lists and output digests; remove listener references before teardown/GC.',
    slotSignals: 'Prepare 100/1000 empty fallback slots and detached Text nodes, then drain setup callbacks. Time append/remove/append through public child-list operations on every slot, including parent/identity consumption and signal deduplication. Before yielding, verify the native queue contains exactly one signal per slot. Deliver callbacks outside timing, check exactly one correctly targeted notification per slot, final fallback identities/text and document/shadow hashes, and remove listeners before GC. This measures complete synchronous mutations and queueing, not isolated hash-set insertion or notification latency.',
    mutationRecords: 'Prepare a real observer and 100/1000 groups of attribute, Text and child-list mutations. Collect workload times mutations plus takeRecords; read workload prepares records before timing and consumes all nine public fields and static NodeLists in one pass. Validate every field, old value, target, sibling, node identity and final document hash outside timing. Disconnect observers and release records before teardown/GC; callback delivery is not included.',
    observerAncestors: 'Register the same real observer on the target and every ancestor in a 100/1000-section chain before timing. Run 100 groups of attribute, Text and child-list mutations plus takeRecords. Validate exactly 300 records, every public field and identity, and the complete document hash outside timing. This measures full public mutations and deduplication across matching registrations, not an isolated Rust lookup; setup, callback delivery and cleanup are excluded.',
    mutationFanout: 'Prepare 100/1000 real observers on one target, alternating attributeOldValue true/false. Time ten public attribute mutations and takeRecords for every observer; expect 1000/10000 distinct records. Validate every field, target identity and oldValue choice outside timing, then disconnect before teardown. This measures complete preparation, wrappers and queue/drain costs, not only native Arc sharing.',
    eventState: 'At size 100/1000, lifecycle times Event construction, timestamp reads, cancellation, immediate propagation stop, legacy reinitialization and scalar result consumption. Dispatch times construction plus dispatch on a real non-Node EventTarget whose listener prevents default and records phase. Fixture/target/listener setup and final checks are outside timing; this includes public binding cost, not only Rust flag operations.',
    observerDelivery: 'Drain setup and perform GC, then queue mutations synchronously before starting the timer. Await a Promise resolved by the last expected real callback; timing includes the queued notification microtask and minimal callback bookkeeping, not construction, mutations or record reads. Records mode delivers to 100/1000 observers; empty mode drains those observers first and delivers only to a final sentinel; slots mode delivers one observer and 100/1000 slotchange events. Validate callback counts, every record field, slot target identity, document/shadow hashes and cleanup outside timing.',
    flattenedSlots: 'Prepare 10/100 nested relay slots across open/closed shadow roots and two light leaves before timing. Read the terminal slot assignedNodes({flatten:true}) 100 times and consume all identities and lengths. Validate final leaves and include every shadow root in the output hash; construction and cleanup remain outside timing.',
    namespaces: 'Namespace setup is outside timing. A descendant Text performs 1000 URI, prefix and default-namespace lookups through ancestor declarations; all 3000 results are checked.',
    nodeText: 'Read the complete textContent of a 250-row or 1000-row table 100 times. Fixture creation and full expected-text validation are outside timing; the public getter aggregates all descendant Text nodes.',
    nodeTextWrites: 'Prepare a separate div and Text alongside the table, then time 1000 alternating nodeValue assignments on Text or textContent assignments on the div. Validate final data, child count, retained/replaced Text identity and full-document digest outside timing; no observers are installed.',
    documentInsertions: 'Prepare an auxiliary XML Document with as many comments as table rows, optionally preceded by an existing root Element, and 100 candidate nodes. Time public appendChild acceptance for comments or HierarchyRequestError rejection for duplicate roots. Setup, final counts/identities and serialization of both documents for matching digests are outside timing.',
    documentReplacements: 'Use the same auxiliary Documents and 100 prepared candidates. Time replaceChild on the first 100 comments, or replace the current root Element 100 times. Old/candidate nodes are prepared before timing; final counts, retained identities, detached old nodes and both document digests are checked afterward.',
    normalization: 'Normalize a 250-row or 1000-row table once. The split variant divides anchor text into chunks of four UTF-16 units before timing; the isolated variant retains one Text per anchor. Both validate full text, one Text child per anchor and serialized output outside timing.',
    boundaryPoints: 'Ranges select contents of table rows before timing. Compare the last range with 1000 cycling peers in both directions, or perform 1000 sets of comparePoint/isPointInRange/intersectsNode queries on row Elements or their descendant Text. Signed checksums distinguish equality, before/after and intersection; setup and validation are excluded.',
    rangeText: 'Select all table contents before timing and stringify the real Range once by default, or ten times with explicit range-stringify-10. Consume every returned length and validate the complete text outside timing; the default bounds the quadratic reference workload.',
    rangeBoundaries: 'Execute 100 sets of all eight public boundary setters/selections, including collapse after crossing endpoints and commonAncestorContainer identity. Real row ranges are prepared before timing; final endpoints and empty text are checked afterward.',
    rangeState: 'Read startOffset/endOffset/collapsed 1000 times from a prepared row Range, or create/select/clone a Range and construct a StaticRange 1000 times while checking independent offsets. Input creation and checksum validation are outside timing; lifecycle allocations and native state calls are timed.',
    rangeControl: 'Clone a prepared Range 1000 times, alternate collapse to its start/end and compare each copy with its unchanged source. Checksum and source independence are validated outside timing.',
    rangeDeletion: 'Delete a single Range spanning partial text in the first and last table rows and every intervening row. Setup is excluded; verify two remaining rows, exact text, collapse position and full serialized output afterward.',
    rangeContents: 'Clone or extract the same partial-boundary table selection. Validate fragment text and row count, source mutation/independence, and a digest including both the source document and XML serialization of the returned fragment.',
    rangeSurround: 'Select the entire table and surround it with a prepared section containing an old child. Time the complete public operation, then verify replacement, original table identity, full text, range selection and serialized output.',
    rangeInsertion: 'Prepare one collapsed Range at the middle of a tbody and 100 empty tr nodes before timing. Insert each through Range.insertNode, including live endpoint updates. Verify all inserted identities and order, final offsets, row count and full-document digest outside timing.',
    rangeContext: 'Prepare tbody markup and a Range selecting that context outside timing. Time public createContextualFragment, then verify fragment rows/text/ownerDocument, unchanged Range endpoints, native HTML parser use and a digest covering source document plus fragment XML serialization.',
    rangeMutations: 'Prepare 1000 live Ranges on the final row Text or tbody. Time 100 insert/delete CharacterData pairs or insertBefore/removeChild pairs. Consume an intermediate endOffset each cycle to reject no-op range updates; verify every final endpoint, original text/tree and full serialized digest outside timing.',
    ratio: 'jsdom median / rustdom median; values greater than 1 favor rustdom.',
    limitations: 'Synthetic workloads on one machine. JavaScript wrappers and Web APIs remain; unsupported selectors delegate to jsdom. No claim about complete test-suite speed.',
  },
  runs: [], comparisons: [],
};

/** Preserve every stage's partial evidence through one report lifecycle. */
const benchmarkReport = new BenchmarkReport(report, outputDirectory);
for (const order of ORDERS) {
  for (const engine of order) {
    process.stderr.write(`Benchmark ${engine}, proceso ${report.runs.length + 1}/${ORDERS.length * 2}\n`);
    const startedAt = performance.now();
    const child = spawnSync(process.execPath, ['--expose-gc', 'benchmarks/worker.cjs', engine, ...requestedWorkloads], {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: workerTimeoutMs,
    });
    benchmarkReport.recordWorker(child, { engine, processIndex: report.runs.length + 1,
      elapsedMs: performance.now() - startedAt, timeoutMs: workerTimeoutMs });
  }
}
const { jsonPath, table } = benchmarkReport.finish();
process.stdout.write(`${table.join('\n')}\n\nGuardado: ${jsonPath}\n`);
