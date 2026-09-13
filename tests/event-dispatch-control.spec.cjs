/** @file Exercises event path visibility, listener mutation, reentrancy and activation before migrating dispatch control. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {...Window} windows - Real error-reporting realms. @returns {Error[]} Unexpected listener errors asserted outside dispatch. */
function captureUnexpectedErrors(...windows) {
  const errors = [];
  for (const window of windows) window.addEventListener('error', (event) => {
    errors.push(event.error ?? new Error(event.message)); event.preventDefault();
  });
  return errors;
}

/**
 * @param {object} runtime - Real DOM implementation.
 * @param {string} outerMode - Outer shadow root visibility.
 * @param {string} innerMode - Inner shadow root visibility.
 * @param {boolean} composed - Whether the event crosses its own shadow root.
 * @returns {object[]} Public identities and paths observed across both dispatch phases.
 */
function captureSlottedPath(runtime, outerMode, innerMode, composed) {
  const dom = new runtime.JSDOM('<body></body>');
  const document = dom.window.document;
  const names = new Map([[dom.window, 'window'], [document, 'document'],
    [document.documentElement, 'html'], [document.body, 'body']]);
  const observations = [];
  const callbackErrors = captureUnexpectedErrors(dom.window);
  try {
    const outer = document.body.appendChild(document.createElement('section')); names.set(outer, 'outer');
    const outerRoot = outer.attachShadow({ mode: outerMode }); names.set(outerRoot, 'outer-root');
    const outerSlot = outerRoot.appendChild(document.createElement('slot')); names.set(outerSlot, 'outer-slot');
    const inner = outer.appendChild(document.createElement('section')); names.set(inner, 'inner');
    const innerRoot = inner.attachShadow({ mode: innerMode }); names.set(innerRoot, 'inner-root');
    const innerSlot = innerRoot.appendChild(document.createElement('slot')); names.set(innerSlot, 'inner-slot');
    const leaf = inner.appendChild(document.createElement('button')); names.set(leaf, 'leaf');
    const privateLeaf = innerRoot.appendChild(document.createElement('b')); names.set(privateLeaf, 'private-leaf');
    assert.deepEqual(outerSlot.assignedNodes(), [inner]); assert.deepEqual(innerSlot.assignedNodes(), [leaf]);
    for (const node of names.keys()) {
      for (const capture of [true, false]) {
        node.addEventListener('path', (event) => {
          const path = event.composedPath(); const original = [...path];
          assert.ok(original.includes(node)); assert.equal(event.currentTarget, node);
          for (const entry of original) assert.ok(names.has(entry));
          path.length = 0; assert.deepEqual(event.composedPath(), original);
          observations.push({ current: names.get(node), capture, phase: event.eventPhase,
            target: names.get(event.target), path: original.map((entry) => names.get(entry)) });
        }, capture);
      }
    }
    for (const target of [leaf, privateLeaf]) {
      const event = new dom.window.Event('path', { bubbles: true, composed });
      assert.deepEqual(event.composedPath(), []);
      const before = observations.length; assert.equal(target.dispatchEvent(event), true);
      assert.ok(observations.length > before); assert.deepEqual(event.composedPath(), []);
      assert.equal(event.currentTarget, null); assert.equal(event.eventPhase, 0);
    }
    assert.deepEqual(callbackErrors, []);
    return observations;
  } finally { dom.window.close(); }
}

for (const outerMode of ['open', 'closed']) {
  for (const innerMode of ['open', 'closed']) {
    for (const composed of [true, false]) {
      test(`should preserve every visible path through ${outerMode}/${innerMode} slots with composed=${composed}`, () => {
        const expected = captureSlottedPath(runtimes.jsdom, outerMode, innerMode, composed);
        assert.deepEqual(captureSlottedPath(runtimes.rustdom, outerMode, innerMode, composed), expected);
      });
    }
  }
}

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve listener snapshots, abort, once and independent nested dispatch in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>'); const target = new dom.window.EventTarget();
    const controller = new dom.window.AbortController(); const trace = [];
    const currentTargets = []; let nestedResult;
    try {
      const removed = () => trace.push('removed');
      const late = (event) => { trace.push(`late:${event.detail}`); if (event.detail === 'nested') event.preventDefault(); };
      target.addEventListener('go', () => {
        trace.push('first'); controller.abort(); target.removeEventListener('go', removed);
        target.addEventListener('go', late);
        nestedResult = target.dispatchEvent(new dom.window.CustomEvent('go', { detail: 'nested', cancelable: true }));
      }, { once: true });
      target.addEventListener('go', () => trace.push('aborted'), { signal: controller.signal });
      target.addEventListener('go', removed);
      target.addEventListener('go', (event) => { trace.push(`tail:${event.detail}`); currentTargets.push(event.currentTarget); });
      const outer = new dom.window.CustomEvent('go', { detail: 'outer', cancelable: true });
      assert.equal(target.dispatchEvent(outer), true);
      assert.deepEqual(trace, ['first', 'tail:nested', 'late:nested', 'tail:outer']);
      assert.equal(nestedResult, false);
      assert.equal(outer.defaultPrevented, false); assert.equal(outer.currentTarget, null);
      trace.length = 0; assert.equal(target.dispatchEvent(outer), true);
      assert.deepEqual(trace, ['tail:outer', 'late:outer']);
      assert.deepEqual(currentTargets, [target, target, target]);
    } finally { dom.window.close(); }
  });

  test(`should keep a captured path when listeners detach and adopt the target in ${name}`, () => {
    const dom = new runtime.JSDOM('<main><button></button></main>'); const foreign = new runtime.JSDOM('<body></body>');
    const document = dom.window.document; const parent = document.querySelector('main'); const target = parent.firstChild;
    const trace = []; const expectedPath = [target, parent, document.body, document.documentElement, document, dom.window];
    const callbackErrors = captureUnexpectedErrors(dom.window, foreign.window);
    try {
      parent.addEventListener('move', (event) => {
        trace.push('capture'); foreign.window.document.body.append(target);
        assert.deepEqual(event.composedPath(), expectedPath);
      }, true);
      target.addEventListener('move', (event) => { trace.push('target'); assert.deepEqual(event.composedPath(), expectedPath); });
      parent.addEventListener('move', (event) => { trace.push('bubble'); assert.deepEqual(event.composedPath(), expectedPath); });
      const event = new dom.window.Event('move', { bubbles: true, composed: true });
      assert.equal(target.dispatchEvent(event), true); assert.deepEqual(trace, ['capture', 'target', 'bubble']);
      assert.equal(target.ownerDocument, foreign.window.document); assert.equal(event.target, target);
      assert.deepEqual(event.composedPath(), []);
      assert.deepEqual(callbackErrors, []);
    } finally { dom.window.close(); foreign.window.close(); }
  });

  test(`should restore window.event and finish dispatch after a nested listener throws in ${name}`, () => {
    const dom = new runtime.JSDOM('<button></button>'); const target = dom.window.document.querySelector('button');
    const trace = []; const reportedErrors = []; const currentEventMatches = []; let outerEvent; let nestedResult;
    try {
      dom.window.addEventListener('error', (event) => { trace.push('reported'); reportedErrors.push(event.error?.message); event.preventDefault(); });
      dom.window.addEventListener('inner', (event) => {
        trace.push('inner'); currentEventMatches.push(dom.window.event === event); throw new Error('nested listener failed');
      });
      dom.window.addEventListener('inner', (event) => { trace.push('after-error'); currentEventMatches.push(dom.window.event === event); });
      target.addEventListener('outer', (event) => {
        outerEvent = event; trace.push('outer'); currentEventMatches.push(dom.window.event === event);
        nestedResult = dom.window.dispatchEvent(new dom.window.Event('inner'));
        currentEventMatches.push(dom.window.event === event); trace.push('restored');
      });
      assert.equal(target.dispatchEvent(new dom.window.Event('outer')), true);
      assert.deepEqual(trace, ['outer', 'inner', 'reported', 'after-error', 'restored']);
      assert.deepEqual(reportedErrors, ['nested listener failed']); assert.deepEqual(currentEventMatches, [true, true, true, true]);
      assert.equal(nestedResult, true);
      assert.equal(dom.window.event, undefined); assert.equal(outerEvent.currentTarget, null);
      assert.equal(outerEvent.eventPhase, 0); assert.deepEqual(outerEvent.composedPath(), []);
    } finally { dom.window.close(); }
  });

  test(`should perform and roll back checkbox activation around cancellation in ${name}`, () => {
    const dom = new runtime.JSDOM('<input type="checkbox">'); const input = dom.window.document.querySelector('input');
    const observations = [];
    const callbackErrors = captureUnexpectedErrors(dom.window);
    try {
      input.addEventListener('click', (event) => {
        observations.push({ checked: input.checked, phase: event.eventPhase, target: event.target === input });
        assert.equal(event.composedPath()[0], input); event.preventDefault();
      }, { once: true });
      input.click(); assert.equal(input.checked, false);
      assert.deepEqual(observations, [{ checked: true, phase: 2, target: true }]);
      input.click(); assert.equal(input.checked, true);
      assert.deepEqual(callbackErrors, []);
    } finally { dom.window.close(); }
  });
}
