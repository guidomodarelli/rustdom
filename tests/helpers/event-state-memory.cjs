/** @file Separates native Event lifetime and path buffers from public events, targets, documents and windows. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeEventState, EventStateFlag } = require('../../dist/native.cjs');
const utils = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {boolean} incomplete - Whether the real error reporter aborts dispatch. @returns {object} Native state retained after dropping the real Event and its targets. */
function closedEventState(incomplete) {
  const reporterFailure = new Error('event memory reporter failed'); const virtualConsole = new runtime.VirtualConsole();
  virtualConsole.on('jsdomError', () => { throw reporterFailure; });
  const dom = new runtime.JSDOM('<main></main>', { virtualConsole }); const document = dom.window.document; let target = document.querySelector('main');
  for (let depth = 0; depth < 100; depth++) target = target.appendChild(document.createElement('span'));
  const event = new dom.window.CustomEvent('held\ud800', { detail: { target }, bubbles: true, cancelable: true, composed: true });
  const state = utils.implForWrapper(event)._eventState;
  let capturedPath;
  target.addEventListener(event.type, (current) => {
    capturedPath = { length: state.pathLength, capacity: state.pathCapacity, visible: current.composedPath().length };
    if (incomplete) throw new Error('event memory listener failed');
  }, { once: true });
  if (incomplete) assert.throws(() => target.dispatchEvent(event), (error) => error === reporterFailure);
  else target.dispatchEvent(event);
  event.preventDefault();
  assert.ok(capturedPath.length >= 100); assert.ok(capturedPath.capacity >= capturedPath.length);
  assert.equal(capturedPath.visible, capturedPath.length);
  assert.equal(state.pathLength, incomplete ? capturedPath.length : 0);
  if (!incomplete) assert.equal(state.pathCapacity, 0);
  const observed = { events: [new WeakRef(event)], nodes: [new WeakRef(target)], documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)] };
  dom.window.close(); return { state, observed, incomplete, capturedPath };
}

/** @returns {Promise<void>} Saves five retain/drop cycles while checking native and V8 resources independently. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = closedEventState(cycle % 2 === 1);
      const objectsReleased = await waitForMemoryQuiescence({ label: `event-objects-${cycle}`,
        sample: () => captureMemoryState(owner.observed, null) });
      assert.equal(objectsReleased.reached, true);
      assert.equal(NativeEventState.statistics().live, baseline.eventStates.live + 1);
      assert.equal(owner.state.eventType, 'held\ud800'); assert.equal(owner.state.flag(EventStateFlag.Canceled), true);
      assert.equal(owner.state.pathLength, owner.incomplete ? owner.capturedPath.length : 0);
      owner.state.finishDispatch(); assert.equal(owner.state.pathCapacity, 0);
      assert.equal(owner.state.initializeIfIdle('after\0', false, false), true); assert.equal(owner.state.eventType, 'after\0');
      owner.state = null;
      const released = await waitForMemoryQuiescence({ label: `event-state-${cycle}`,
        sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
      assert.equal(released.reached, true); report.cycles.push({ incomplete: owner.incomplete, path: owner.capturedPath, objectsReleased, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-event-state.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
