/** @file Establishes public AbortSignal/Controller contracts against independent jsdom realms. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {AbortSignal} signal - Aborted public signal. @returns {unknown} Exact thrown value, including non-Error reasons. */
function thrownReason(signal) {
  try { signal.throwIfAborted(); } catch (error) { return error; }
  assert.fail('throwIfAborted did not throw');
}

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve controller identity, every reason and idempotent abort in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>', { runScripts: 'outside-only' });
    try {
      const objectReason = { document: dom.window.document }; const reasons = [null, false, 0, '', NaN, 12n, Symbol('abort'), objectReason];
      for (const reason of reasons) {
        const controller = new dom.window.AbortController(); const signal = controller.signal; const observations = [];
        assert.equal(controller.signal, signal); assert.equal(signal.aborted, false); assert.equal(signal.reason, undefined);
        assert.doesNotThrow(() => signal.throwIfAborted());
        signal.addEventListener('abort', (event) => observations.push({ target: event.target === signal, aborted: signal.aborted, reason: signal.reason, trusted: event.isTrusted }));
        controller.abort(reason); controller.abort('ignored');
        assert.equal(signal.aborted, true); assert.equal(signal.reason, reason); assert.equal(thrownReason(signal), reason);
        assert.deepEqual(observations, [{ target: true, aborted: true, reason, trusted: true }]);
        const already = dom.window.AbortSignal.abort(reason); assert.equal(already.reason, reason); assert.equal(thrownReason(already), reason);
      }
      const controller = new dom.window.AbortController(); controller.abort();
      assert.equal(controller.signal.reason.name, 'AbortError'); assert.ok(controller.signal.reason instanceof dom.window.DOMException);
      assert.equal(thrownReason(controller.signal), controller.signal.reason);
      assert.equal(dom.window.AbortSignal.abort().reason.name, 'AbortError');
    } finally { dom.window.close(); }
  });

  test(`should preserve any input order, duplicates, empty sources and foreign reasons in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>', { runScripts: 'outside-only' });
    const foreign = new runtime.JSDOM('<body></body>', { runScripts: 'outside-only' });
    try {
      const empty = dom.window.AbortSignal.any([]); assert.equal(empty.aborted, false);
      const first = new dom.window.AbortController(); const second = new foreign.window.AbortController();
      const reason = foreign.window.eval('({ value: 7 })'); second.abort(reason); first.abort('first');
      const combined = dom.window.AbortSignal.any([second.signal, first.signal, second.signal]);
      assert.equal(combined.reason, reason); assert.equal(thrownReason(combined), reason);
      assert.equal(dom.window.AbortSignal.any([first.signal, second.signal]).reason, 'first');
      assert.throws(() => dom.window.AbortSignal.any([{}]), { name: 'TypeError' });
    } finally { dom.window.close(); foreign.window.close(); }
  });

  test(`should mark all nested dependents before source events and preserve reentrant winner in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>');
    try {
      const first = new dom.window.AbortController(); const second = new dom.window.AbortController();
      const combined = dom.window.AbortSignal.any([first.signal, second.signal, first.signal]);
      const nested = dom.window.AbortSignal.any([combined, second.signal]); const trace = [];
      first.signal.addEventListener('abort', () => {
        trace.push(['first', combined.aborted, nested.aborted, combined.reason, nested.reason]); second.abort('second');
      });
      second.signal.addEventListener('abort', () => trace.push(['second', combined.reason, nested.reason]));
      combined.addEventListener('abort', () => trace.push(['combined', combined.reason]));
      nested.addEventListener('abort', () => trace.push(['nested', nested.reason]));
      first.abort('winner');
      assert.deepEqual(trace, [['first', true, true, 'winner', 'winner'], ['second', 'winner', 'winner'], ['combined', 'winner'], ['nested', 'winner']]);
      assert.equal(combined.reason, 'winner'); assert.equal(nested.reason, 'winner');
    } finally { dom.window.close(); }
  });

  test(`should remove signaled listeners before abort events and preserve onabort in ${name}`, () => {
    const dom = new runtime.JSDOM('<button></button>'); const target = dom.window.document.querySelector('button');
    try {
      const controller = new dom.window.AbortController(); const trace = [];
      target.addEventListener('go', () => trace.push('removed'), { signal: controller.signal });
      controller.signal.onabort = function (event) { trace.push(this === controller.signal && event.target === controller.signal ? 'onabort' : 'wrong'); };
      controller.signal.addEventListener('abort', () => { target.dispatchEvent(new dom.window.Event('go')); trace.push('listener'); });
      controller.abort(); assert.deepEqual(trace, ['onabort', 'listener']);
    } finally { dom.window.close(); }
  });

  test(`should preserve swallowed source listener errors and continue dependent delivery in ${name}`, () => {
    const virtualConsole = new runtime.VirtualConsole(); const failure = new Error('abort reporter failed');
    let reports = 0; virtualConsole.on('jsdomError', () => { reports++; throw failure; });
    const dom = new runtime.JSDOM('<body></body>', { virtualConsole });
    try {
      const controller = new dom.window.AbortController(); const dependent = dom.window.AbortSignal.any([controller.signal]); let calls = 0;
      controller.signal.addEventListener('abort', () => { throw new Error('source listener failed'); });
      dependent.addEventListener('abort', () => calls++);
      assert.doesNotThrow(() => controller.abort('reason'));
      assert.equal(controller.signal.reason, 'reason'); assert.equal(dependent.reason, 'reason'); assert.equal(dependent.aborted, true);
      assert.equal(reports, 0); assert.equal(calls, 1); controller.abort('ignored'); assert.equal(calls, 1);
    } finally { dom.window.close(); }
  });

  test(`should preserve partial abort when a real registered abort algorithm throws in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>');
    const utils = name === 'jsdom' ? require('jsdom/lib/jsdom/living/generated/utils') : require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
    try {
      const controller = new dom.window.AbortController(); const dependent = dom.window.AbortSignal.any([controller.signal]);
      const failure = new Error('abort algorithm failed'); const trace = [];
      const implementation = utils.implForWrapper(controller.signal);
      implementation._addAlgorithm(() => { trace.push('algorithm'); throw failure; });
      controller.signal.addEventListener('abort', () => trace.push('source'));
      dependent.addEventListener('abort', () => trace.push('dependent'));
      assert.throws(() => controller.abort('reason'), (error) => error === failure);
      assert.equal(controller.signal.reason, 'reason'); assert.equal(dependent.reason, 'reason');
      assert.equal(dependent.aborted, true); assert.deepEqual(trace, ['algorithm']);
      controller.abort('ignored'); assert.deepEqual(trace, ['algorithm']);
    } finally { dom.window.close(); }
  });

  test(`should preserve timeout reason, argument guards and cancellation by close in ${name}`, async () => {
    const dom = new runtime.JSDOM('<body></body>'); const closing = new runtime.JSDOM('<body></body>');
    try {
      for (const value of [-1, Infinity, NaN]) assert.throws(() => dom.window.AbortSignal.timeout(value), { name: 'TypeError' });
      const signal = dom.window.AbortSignal.timeout(0); assert.equal(signal.aborted, false);
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      assert.equal(signal.reason.name, 'TimeoutError'); assert.ok(signal.reason instanceof dom.window.DOMException);
      assert.equal(thrownReason(signal), signal.reason);
      const cancelled = closing.window.AbortSignal.timeout(0); closing.window.close();
      await new Promise((resolve) => setTimeout(resolve, 5)); assert.equal(cancelled.aborted, false);
    } finally { dom.window.close(); closing.window.close(); }
  });

  test(`should preserve internal algorithm set identity and live removal during public abort in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>');
    const utils = name === 'jsdom' ? require('jsdom/lib/jsdom/living/generated/utils') : require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
    try {
      const controller = new dom.window.AbortController(); const implementation = utils.implForWrapper(controller.signal); const trace = [];
      const removed = () => trace.push('removed');
      const first = () => { trace.push('first'); implementation._removeAlgorithm(removed); implementation._addAlgorithm(() => trace.push('ignored')); };
      implementation._addAlgorithm(first); implementation._addAlgorithm(first); implementation._addAlgorithm(removed);
      implementation._addAlgorithm(null); implementation._removeAlgorithm(null);
      implementation._addAlgorithm(() => trace.push('last'));
      controller.abort(); assert.deepEqual(trace, ['first', 'last']);
      const invalid = new dom.window.AbortController(); utils.implForWrapper(invalid.signal)._addAlgorithm(undefined);
      assert.throws(() => invalid.abort('invalid algorithm'), { name: 'TypeError' });
      assert.equal(invalid.signal.reason, 'invalid algorithm');
    } finally { dom.window.close(); }
  });
}
