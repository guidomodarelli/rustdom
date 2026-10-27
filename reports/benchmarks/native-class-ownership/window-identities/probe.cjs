/** @file Observes actual per-Window DOM function identities without collecting performance timings. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collectGarbage } = require('../../../../scripts/memory-endpoint.cjs');
const settings = require('./constants/probe.json');

/** Number weakly held identity keys; scalar IDs cannot retain a Window through its functions. */
function createIdentityTracker() {
  const identities = new WeakMap();
  let nextId = 0;
  return (value) => {
    if (!identities.has(value)) identities.set(value, ++nextId);
    return identities.get(value);
  };
}

/** Exercise the public Range behavior and let every strong DOM reference leave this frame. */
function inspectWindow(api, identity) {
  const dom = new api.JSDOM(settings.html);
  const weak = { window: new WeakRef(dom.window), document: new WeakRef(dom.window.document) };
  try {
    const { window } = dom;
    const range = window.document.createRange();
    range.selectNodeContents(window.document.querySelector('p'));
    const clone = range.cloneRange();
    clone.collapse(false);
    assert.equal(range.toString(), settings.expectedText);
    assert.equal(clone.compareBoundaryPoints(window.Range.START_TO_START, range), 1);
    const functions = { JSDOM: api.JSDOM, Object: window.Object, Range: window.Range,
      cloneRange: window.Range.prototype.cloneRange, collapse: window.Range.prototype.collapse,
      compareBoundaryPoints: window.Range.prototype.compareBoundaryPoints, createRange: window.document.createRange,
      startOffset: Object.getOwnPropertyDescriptor(window.AbstractRange.prototype, 'startOffset').get };
    return { weak, functions: Object.fromEntries(Object.entries(functions).map(([name, value]) => [name, identity(value)])),
      objectIsHostIntrinsic: window.Object === Object };
  } finally {
    dom.window.close();
  }
}

/** Preserve identity observations and finite cleanup endpoints without making JIT or performance claims. */
async function inspectWindows(packageRoot) {
  assert.equal(typeof global.gc, 'function', 'Window identities: run with --expose-gc');
  const root = fs.realpathSync(packageRoot);
  const api = require(root);
  const identity = createIdentityTracker();
  const windows = [];
  for (let ordinal = 0; ordinal < settings.windowCount; ordinal++) {
    const observation = inspectWindow(api, identity);
    const cleanup = [];
    for (let round = 0; round < settings.cleanupRounds; round++) {
      await collectGarbage();
      cleanup.push({ window: observation.weak.window.deref() !== undefined,
        document: observation.weak.document.deref() !== undefined });
    }
    assert.ok(cleanup.slice(-settings.requiredClearRounds).every((state) => !state.window && !state.document),
      `Window identities: Window or Document remains at required endpoints for ordinal ${ordinal}`);
    windows.push({ ordinal, functions: observation.functions, objectIsHostIntrinsic: observation.objectIsHostIntrinsic, cleanup });
  }
  const counts = Object.fromEntries(Object.keys(windows[0].functions).map((name) =>
    [name, new Set(windows.map((entry) => entry.functions[name])).size]));
  return { node: process.version, v8: process.versions.v8, execArgv: process.execArgv, packageRoot: root,
    jsdom: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
    settings, windows, distinctFunctionIdentities: counts, measurementExecuted: false, acceptanceChanged: false };
}

if (require.main === module) inspectWindows(process.argv[2]).then((result) => {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}).catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
module.exports = { createIdentityTracker, inspectWindow, inspectWindows };
