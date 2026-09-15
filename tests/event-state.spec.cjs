/** @file Verifies Event scalar state, legacy initialization, cancellation and subclass integration with both engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should expose native scalar transitions without accepting foreign receivers or invalid flags', () => {
  const { NativeEventState, EventStateFlag, NativeTree } = require('../dist/native.cjs');
  const state = new NativeEventState('raw\ud800\0', true, true, true); state.finishConstruction(true, 123.5);
  assert.equal(state.eventType, 'raw\ud800\0'); assert.equal(state.timeStamp, 123.5); assert.equal(state.flag(EventStateFlag.Trusted), true);
  for (const value of ['', 'false', 0, null, undefined, {}, Symbol('false')]) {
    state.setReturnValue(value); assert.equal(state.returnValue, true);
  }
  state.setFlag(EventStateFlag.PassiveListener, true); state.preventDefault(); assert.equal(state.returnValue, true);
  state.setFlag(EventStateFlag.PassiveListener, false); state.setReturnValue(false); state.setReturnValue(true); assert.equal(state.returnValue, false);
  state.stopImmediatePropagation(); state.setCancelBubble(false); assert.equal(state.flag(EventStateFlag.ImmediatePropagationStopped), true);
  state.setFlag(EventStateFlag.Dispatching, true); state.eventPhase = 2;
  assert.equal(state.initializeIfIdle('ignored', false, false), false); assert.equal(state.eventType, 'raw\ud800\0');
  state.setFlag(EventStateFlag.Dispatching, false); assert.equal(state.initializeIfIdle('after', false, false), true);
  assert.equal(state.eventType, 'after'); assert.equal(state.timeStamp, 123.5); assert.equal(state.eventPhase, 2);
  assert.equal(state.flag(EventStateFlag.Composed), true); assert.equal(state.flag(EventStateFlag.Canceled), false);
  assert.throws(() => state.setFlag(999, true)); assert.equal(state.flag(EventStateFlag.Composed), true);
  for (const foreign of [{}, new NativeTree(), Object.create(NativeEventState.prototype)]) {
    assert.throws(() => Reflect.apply(state.preventDefault, foreign, []), { name: 'TypeError' });
  }
});

test('should collect events and DOM roots while their native scalar state remains retained', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/event-state-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve Event defaults, UTF-16 type and legacy reset without changing timestamp or composed in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>');
    try {
      const before = Date.now(); const event = new dom.window.Event('go\0\ud800', { bubbles: true, cancelable: true, composed: true });
      assert.equal(event.type, 'go\0\ud800'); assert.equal(event.bubbles, true); assert.equal(event.cancelable, true); assert.equal(event.composed, true);
      assert.equal(event.target, null); assert.equal(event.currentTarget, null); assert.equal(event.eventPhase, 0); assert.equal(event.isTrusted, false);
      assert.ok(event.timeStamp >= before && event.timeStamp <= Date.now()); const timestamp = event.timeStamp;
      event.preventDefault(); event.stopImmediatePropagation(); assert.equal(event.defaultPrevented, true); assert.equal(event.cancelBubble, true);
      event.cancelBubble = false; event.returnValue = true; assert.equal(event.cancelBubble, true); assert.equal(event.defaultPrevented, true);
      event.initEvent('again\udc00', false, false);
      assert.equal(event.type, 'again\udc00'); assert.equal(event.bubbles, false); assert.equal(event.cancelable, false);
      assert.equal(event.composed, true); assert.equal(event.timeStamp, timestamp); assert.equal(event.defaultPrevented, false);
      assert.equal(event.cancelBubble, false); assert.equal(event.returnValue, true); assert.deepEqual(event.composedPath(), []);
    } finally { dom.window.close(); }
  });

  test(`should preserve passive cancellation and propagation transitions across dispatch and redispatch in ${name}`, () => {
    const dom = new runtime.JSDOM('<main><button></button></main>'); const parent = dom.window.document.querySelector('main'); const target = parent.firstChild;
    const trace = []; const event = new dom.window.Event('go', { bubbles: true, cancelable: true, composed: true });
    try {
      parent.addEventListener('go', (current) => { trace.push(['capture', current.eventPhase]); }, true);
      target.addEventListener('go', (current) => { current.preventDefault(); current.returnValue = false;
        trace.push(['passive', current.defaultPrevented]); current.cancelBubble = true; current.cancelBubble = false; }, { passive: true });
      target.addEventListener('go', (current) => { trace.push(['target', current.eventPhase]); current.stopImmediatePropagation(); });
      target.addEventListener('go', () => { trace.push(['unexpected']); }); parent.addEventListener('go', () => { trace.push(['bubble']); });
      assert.equal(target.dispatchEvent(event), true); assert.deepEqual(trace, [['capture', 1], ['passive', false], ['target', 2]]);
      assert.equal(event.target, target); assert.equal(event.srcElement, target); assert.equal(event.currentTarget, null);
      assert.equal(event.eventPhase, 0); assert.equal(event.cancelBubble, false); assert.equal(event.defaultPrevented, false);
      assert.deepEqual(event.composedPath(), []);
      const plain = new dom.window.EventTarget(); const cancelled = new dom.window.Event('cancel', { cancelable: true });
      plain.addEventListener('cancel', (current) => { current.returnValue = false; }, { once: true });
      assert.equal(plain.dispatchEvent(cancelled), false); assert.equal(plain.dispatchEvent(cancelled), false);
      cancelled.initEvent('cancel', false, true); assert.equal(plain.dispatchEvent(cancelled), true);
    } finally { dom.window.close(); }
  });

  test(`should ignore initEvent during dispatch and preserve uninitialized/reentrant error contracts in ${name}`, () => {
    const dom = new runtime.JSDOM('<button></button>', { runScripts: 'outside-only' }); const target = dom.window.document.querySelector('button');
    const event = new dom.window.Event('go', { bubbles: true, cancelable: true }); let invoked = 0;
    try {
      target.addEventListener('go', (current) => {
        invoked++; current.initEvent('wrong', false, false);
        assert.equal(current.type, 'go'); assert.equal(current.bubbles, true); assert.equal(current.cancelable, true);
        assert.throws(() => target.dispatchEvent(current), (error) => error instanceof dom.window.DOMException && error.name === 'InvalidStateError');
      });
      assert.equal(target.dispatchEvent(event), true); assert.equal(target.dispatchEvent(event), true); assert.equal(invoked, 2);
      const legacy = dom.window.document.createEvent('Event'); assert.equal(legacy.type, '');
      assert.throws(() => target.dispatchEvent(legacy), { name: 'InvalidStateError' });
      legacy.initEvent('legacy', true, true); assert.equal(target.dispatchEvent(legacy), true);
    } finally { dom.window.close(); }
  });

  test(`should keep subclass fields and initialization behavior alongside Event state in ${name}`, () => {
    const dom = new runtime.JSDOM('<button></button>'); const target = dom.window.document.querySelector('button');
    try {
      const detail = { value: 1 }; const custom = new dom.window.CustomEvent('custom', { detail, cancelable: true, composed: true });
      custom.preventDefault(); custom.initCustomEvent('changed', true, false, detail);
      assert.equal(custom.detail, detail); assert.equal(custom.type, 'changed'); assert.equal(custom.defaultPrevented, false); assert.equal(custom.composed, true);
      const mouse = new dom.window.MouseEvent('click', { clientX: 7, ctrlKey: true, bubbles: true, cancelable: true, composed: true });
      assert.ok(mouse instanceof dom.window.Event); assert.equal(mouse.clientX, 7); assert.equal(mouse.ctrlKey, true);
      const timestamp = mouse.timeStamp; mouse.preventDefault();
      mouse.initMouseEvent('other', true, false, dom.window, 2, 1, 2, 3, 4, false, false, false, false, 1, target);
      assert.equal(mouse.type, 'other'); assert.equal(mouse.clientX, 3); assert.equal(mouse.clientY, 4); assert.equal(mouse.button, 1);
      assert.equal(mouse.view, dom.window); assert.equal(mouse.relatedTarget, target); assert.equal(mouse.defaultPrevented, false);
      assert.equal(mouse.composed, true); assert.equal(mouse.timeStamp, timestamp);
      const keyboard = new dom.window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      keyboard.preventDefault(); assert.equal(keyboard.key, 'Enter'); assert.equal(keyboard.code, 'Enter'); assert.equal(keyboard.defaultPrevented, true);
      const message = new dom.window.MessageEvent('message', { data: detail, origin: 'https://example.test', cancelable: true });
      message.preventDefault(); assert.equal(message.data, detail); assert.equal(message.origin, 'https://example.test'); assert.equal(message.defaultPrevented, true);
    } finally { dom.window.close(); }
  });
}
