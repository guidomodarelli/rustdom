/** @file Exercise the exact assembled native distribution and separate Window/Document teardown, without workload timing. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/smoke.json');
assert.equal(process.argv.length, 3, 'Provide assembled numeric package root');
const root = path.resolve(process.argv[2]);
const assembler = path.join(__dirname, 'assemble.py');
const assemblyPolicy = path.join(__dirname, 'constants/package.json');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
assert.equal(hash(assembler), settings.assemblerSha256);
assert.equal(hash(assemblyPolicy), settings.assemblyPolicySha256);
const authentication = spawnSync('python3', ['-B', assembler, '--verify', root, process.execPath], {
  encoding: 'utf8', timeout: settings.authenticationTimeoutMs, maxBuffer: settings.authenticationMaxBytes
});
assert.equal(authentication.error, undefined);
assert.equal(authentication.status, 0, authentication.stderr);
const identity = JSON.parse(authentication.stdout);
assert.equal(identity.verified, true);
assert.equal(identity.artifactId, settings.artifactId);
assert.equal(identity.nativeBinarySha256, settings.nativeBinarySha256);
const candidate = path.join(root, 'candidate');
const runtime = require(path.join(candidate, 'dist/index.cjs'));
const { NativeRange, NativeTree } = require(path.join(candidate, 'dist/native.cjs'));
const { implForWrapper } = require(path.join(candidate, 'dist/vendor-jsdom/lib/jsdom/living/generated/utils'));
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../../../scripts/memory-endpoint.cjs');

/** @returns {void} Check numerical initialization, independent copies and native collapse through actual addon exports. */
function checkNativeFactory() {
  const tree = new NativeTree();
  const text = tree.allocate();
  try {
    tree.setCharacterData(text, 3, 'abcdef');
    const original = NativeRange.fromEndpoints(text, 1, text, 4);
    const oldEnd = original.end;
    for (const toStart of [true, false]) {
      const copy = original.copy();
      assert.equal(copy.collapse(toStart), !toStart);
      assert.equal(copy.startOffset, toStart ? 1 : 4);
      assert.equal(copy.endOffset, copy.startOffset);
      assert.equal(tree.rangeTextFromState(copy), '');
      assert.equal(tree.rangeTextFromState(original), 'bcd');
      assert.deepEqual(oldEnd, { node: text, offset: 4 });
    }
  } finally {
    tree.release(text);
  }
}

/** @returns {object} Closed realm with one deliberately retained range and weak independent observations. */
function createCycle() {
  const dom = new runtime.JSDOM('<main>abcdefgh<span>ijklmnop</span></main>');
  const document = dom.window.document;
  const first = document.querySelector('main').firstChild;
  const second = document.querySelector('span').firstChild;
  const references = { window: [new WeakRef(dom.window)], document: [new WeakRef(document)], ranges: [], native: [] };
  let held;
  for (let index = 0; index < settings.rangesPerCycle; index++) {
    const range = document.createRange();
    range.setStart(first, 1); range.setEnd(index % 2 ? second : first, 6);
    const copy = range.cloneRange();
    assert.ok(range.toString().length > 0);
    range.collapse(Boolean(index % 2)); copy.collapse(!Boolean(index % 2));
    first.insertData(0, '!'); first.deleteData(0, 1);
    for (const current of [range, copy]) {
      assert.equal(current.collapsed, true);
      references.ranges.push(new WeakRef(current));
      references.native.push(new WeakRef(implForWrapper(current)._nativeRange));
    }
    if (index === 0) held = range;
  }
  dom.window.close();
  return { held, references };
}

/** @returns {Promise<void>} Preserve retained and released endpoints, without asserting universal leak freedom. */
async function main() {
  checkNativeFactory();
  await collectGarbage();
  const baseline = runtime.getNativeTreeStatistics();
  const cycles = [];
  for (let cycle = 0; cycle < settings.cycles; cycle++) {
    let current = createCycle();
    let held = current.held;
    const references = current.references;
    current = null;
    const sample = () => captureMemoryState(references, runtime);
    const retained = await waitForMemoryQuiescence({ label: `numeric-package-held-${cycle}`, sample,
      expectedNative: baseline, maxRounds: settings.heldMaxRounds });
    assert.equal(retained.reached, false);
    assert.ok(retained.state.survivors.ranges >= 1);
    assert.equal(held.collapsed, true);
    held = null;
    const released = await waitForMemoryQuiescence({ label: `numeric-package-released-${cycle}`, sample,
      expectedNative: baseline, maxRounds: settings.releaseMaxRounds, timeoutMs: settings.releaseTimeoutMs });
    assert.equal(released.reached, true, JSON.stringify(released.trace));
    assert.deepEqual(released.state.survivors, { window: 0, document: 0, ranges: 0, native: 0 });
    cycles.push({ cycle, retained, released });
  }
  console.log(JSON.stringify({ node: process.version, pass: true,
    artifactId: identity.artifactId, nativeBinarySha256: identity.nativeBinarySha256,
    packageAuthenticatedBeforeRuntimeLoad: true, baseline, cycles,
    runtimeExecuted: true, benchmarkExecuted: false, performanceAccepted: null, gateReevaluated: false,
    limitations: 'Prueba finita del paquete hospedado ensamblado. No mide memoria pico ni demuestra ausencia universal de fugas.' }));
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
