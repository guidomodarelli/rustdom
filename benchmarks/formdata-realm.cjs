/** @file Measures complete browser-body decoding with raw samples and separate realm-contract evidence. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const os = require('node:os');
const { readDomFile } = require('../tests/integration/read-dom-file.cjs');

/** Warm body conversion and parser caches before collecting timings. */
const WARMUP_SAMPLES = 5;
/** Retain repeated observations instead of only the favorable aggregate. */
const MEASURED_SAMPLES = 20;
/** Include several complete body-owner construction/decoding operations per sample. */
const OPERATIONS_PER_SAMPLE = 20;
/** Use a deterministic binary payload with non-ASCII bytes. */
const FILE_SIZE_BYTES = 4096;

/** @param {string} path - Local implementation file. @returns {string} Content fingerprint for before/after provenance. */
function fingerprint(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }

/** @returns {Promise<void>} Saves timings and correctness observations for the actual runtime at invocation. */
async function main() {
  const label = process.argv[2];
  assert.ok(['baseline', 'fixed'].includes(label));
  const environment = (await import('../src/environments/vitest.mjs')).default;
  const target = { setTimeout, clearTimeout };
  const session = environment.setup(target, {});
  const results = [];
  try {
    const bytes = Uint8Array.from({ length: FILE_SIZE_BYTES }, (_, index) => index % 256);
    const multipart = new target.FormData();
    multipart.append('tag', 'first');
    multipart.append('file', new target.File([bytes], 'payload.bin', { type: 'application/octet-stream' }));
    multipart.append('tag', 'second');
    const urlencoded = new URLSearchParams('tag=first&tag=second&text=caf%C3%A9');
    for (const [format, payload] of [['multipart', multipart], ['urlencoded', urlencoded]]) {
      const samples = [];
      const identities = [];
      for (let sample = 0; sample < WARMUP_SAMPLES + MEASURED_SAMPLES; sample++) {
        let decoded;
        const start = performance.now();
        for (let operation = 0; operation < OPERATIONS_PER_SAMPLE; operation++) {
          decoded = await new target.Response(payload).formData();
        }
        const durationMs = performance.now() - start;
        assert.deepEqual(Array.from(decoded.getAll('tag')), ['first', 'second']);
        const identity = { form: decoded.constructor === target.FormData, file: null };
        if (format === 'multipart') {
          const file = decoded.get('file');
          identity.file = file.constructor === target.File;
          assert.equal(file.name, 'payload.bin');
          assert.equal(file.type, 'application/octet-stream');
          const actual = identity.file ? await readDomFile(target, file) : Array.from(new Uint8Array(await file.arrayBuffer()));
          assert.deepEqual(actual, Array.from(bytes));
        } else assert.equal(decoded.get('text'), 'café');
        if (label === 'fixed') { assert.equal(identity.form, true); if (identity.file !== null) assert.equal(identity.file, true); }
        if (sample >= WARMUP_SAMPLES) { samples.push(durationMs); identities.push(identity); }
      }
      const sorted = [...samples].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      results.push({ format, samplesMs: samples, identities, medianBatchMs: (sorted[middle - 1] + sorted[middle]) / 2,
        meanOperationMs: samples.reduce((sum, value) => sum + value, 0) / samples.length / OPERATIONS_PER_SAMPLE });
    }
  } finally { session.teardown(); }
  const report = { capturedAt: new Date().toISOString(), label, node: process.version,
    jsdomReferenceVersion: require('jsdom/package.json').version,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model },
    fingerprints: Object.fromEntries(['src/environments/multipart.cjs', 'src/environments/web-platform.cjs',
      'src/environments/window.cjs', 'src/environments/vitest.mjs', 'src/environments/lifecycle.cjs',
      'src/environments/window-errors.cjs', 'src/environments/mime-type.cjs',
      'benchmarks/formdata-realm.cjs', 'tests/integration/read-dom-file.cjs',
      'package-lock.json', 'dist/rustdom.node'].map((path) => [path, fingerprint(path)])),
    warmupSamples: WARMUP_SAMPLES, measuredSamples: MEASURED_SAMPLES, operationsPerSample: OPERATIONS_PER_SAMPLE, fileSizeBytes: FILE_SIZE_BYTES,
    methodology: 'Sequential complete Response(DOM FormData/URLSearchParams).formData() operation; real rustdom environment and addon. Fields, duplicate ordering, binary bytes, filename and MIME are checked outside each timed batch. Returned FormData/File constructor identity is recorded separately. Raw timings include native body conversion, multipart encoding, async body consumption, parsing and result construction.',
    limitations: 'This body bridge runs JavaScript, jsdom wrappers and Node transport; it does not measure Rust parsing throughput. Baseline returns the wrong realm, so timings do not establish equivalent-contract performance or a speedup. FileReader verification is outside timed regions; no peak/retained-memory measurement.',
    results };
  mkdirSync('reports/benchmarks', { recursive: true });
  const path = `reports/benchmarks/${new Date().toISOString().replaceAll(':', '-')}-formdata-${label}.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ path, results: results.map(({ format, meanOperationMs }) => ({ format, meanOperationMs })) })}\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
