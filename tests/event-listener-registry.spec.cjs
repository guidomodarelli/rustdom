/** @file Compares listener identity, snapshots, reset and network/frame consumers with real jsdom and rustdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
/** Bound real loopback requests while allowing slower CI machines to run normally. */
const REQUEST_TIMEOUT_MS = 10_000;

/** @param {Window} window - Live test realm. @returns {Promise<void>} Settles the initial document load. */
async function loaded(window) {
  if (window.document.readyState !== 'complete') await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
}

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve duplicate identity, capture distinction and first options in ${name}`, () => {
    const dom = new runtime.JSDOM('<button></button>'); const target = dom.window.document.querySelector('button'); const trace = [];
    try {
      const firstSignal = new dom.window.AbortController(); const ignoredSignal = new dom.window.AbortController();
      const callback = (event) => { event.preventDefault(); trace.push(event.defaultPrevented); };
      target.addEventListener('go', callback, { passive: true, signal: firstSignal.signal });
      target.addEventListener('go', callback, { once: true, passive: false, signal: ignoredSignal.signal });
      ignoredSignal.abort();
      target.addEventListener('go', callback, { capture: true, once: true });
      assert.equal(target.dispatchEvent(new dom.window.Event('go', { cancelable: true })), false);
      assert.deepEqual(trace, [true, true]);
      trace.length = 0; assert.equal(target.dispatchEvent(new dom.window.Event('go', { cancelable: true })), true);
      assert.deepEqual(trace, [false]); firstSignal.abort(); trace.length = 0;
      target.dispatchEvent(new dom.window.Event('go')); assert.deepEqual(trace, []);
    } finally { dom.window.close(); }
  });

  test(`should keep removed and readded registrations out of an active snapshot in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>'); const target = new dom.window.EventTarget(); const trace = [];
    try {
      const later = () => trace.push('later');
      target.addEventListener('go', () => {
        trace.push('first'); target.removeEventListener('go', later); target.addEventListener('go', later);
      }, { once: true });
      target.addEventListener('go', later);
      target.addEventListener('go', () => trace.push('last'));
      target.dispatchEvent(new dom.window.Event('go')); assert.deepEqual(trace, ['first', 'last']);
      trace.length = 0; target.dispatchEvent(new dom.window.Event('go')); assert.deepEqual(trace, ['last', 'later']);
    } finally { dom.window.close(); }
  });

  test(`should preserve captured listeners when close replaces Window and Document storage in ${name}`, () => {
    for (const kind of ['window', 'document']) {
      const dom = new runtime.JSDOM('<body></body>'); const target = kind === 'window' ? dom.window : dom.window.document;
      const trace = []; const event = new dom.window.Event('close-during');
      target.addEventListener('close-during', () => { trace.push('first'); dom.window.close(); });
      target.addEventListener('close-during', () => trace.push('second'));
      assert.equal(target.dispatchEvent(event), true); assert.deepEqual(trace, ['first', 'second']);
      trace.length = 0; assert.equal(target.dispatchEvent(event), true); assert.deepEqual(trace, []);
    }
  });

  test(`should resolve object callbacks dynamically and preserve foreign identity and UTF-16 names in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>', { runScripts: 'outside-only' });
    const foreign = new runtime.JSDOM('<body></body>', { runScripts: 'outside-only' });
    const target = new dom.window.EventTarget(); const trace = [];
    try {
      const listener = foreign.window.eval('({ count: 0, handleEvent() { this.count++; } })');
      for (const type of ['__proto__', 'constructor', 'nul\0\ud800']) {
        target.addEventListener(type, listener); target.addEventListener(type, listener);
        target.dispatchEvent(new dom.window.Event(type));
        listener.handleEvent = function () { trace.push(this === listener); this.count += 2; };
        target.dispatchEvent(new dom.window.Event(type)); target.removeEventListener(type, listener);
        const count = listener.count; target.dispatchEvent(new dom.window.Event(type)); assert.equal(listener.count, count);
      }
      assert.equal(listener.count, 11); assert.deepEqual(trace, [true, true, true, true, true]);
    } finally { dom.window.close(); foreign.window.close(); }
  });

  test(`should preserve passive-default errors and early returns on targets without a document in ${name}`, () => {
    const dom = new runtime.JSDOM('<body></body>'); const target = new dom.window.EventTarget(); const controller = new dom.window.AbortController();
    try {
      const callback = () => {}; controller.abort();
      assert.doesNotThrow(() => target.addEventListener('wheel', null));
      assert.doesNotThrow(() => target.addEventListener('wheel', callback, { signal: controller.signal }));
      assert.throws(() => target.addEventListener('wheel', callback), { name: 'TypeError' });
      assert.doesNotThrow(() => target.addEventListener('wheel', callback, { passive: false }));
      target.removeEventListener('wheel', callback);
    } finally { dom.window.close(); }
  });

  test(`should preserve frame load scheduling after a listener bucket becomes empty in ${name}`, async () => {
    const dom = new runtime.JSDOM('<body></body>');
    try {
      await loaded(dom.window);
      for (const removedBucket of [false, true]) {
        const frame = dom.window.document.createElement('iframe'); const trace = []; const removed = () => {};
        if (removedBucket) { frame.addEventListener('discarded', removed); frame.removeEventListener('discarded', removed); }
        dom.window.document.body.append(frame); trace.push('after-append');
        frame.addEventListener('load', () => trace.push('late-load'));
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(trace, removedBucket ? ['after-append', 'late-load'] : ['after-append']);
        frame.remove();
      }
    } finally { dom.window.close(); }
  });

  test(`should preserve real XHR upload preflight after removing the last listener in ${name}`, async () => {
    const methods = [];
    const server = createServer((request, response) => {
      methods.push(request.method); request.resume();
      response.setHeader('Access-Control-Allow-Origin', 'http://example.test');
      response.setHeader('Access-Control-Allow-Methods', 'POST');
      response.setHeader('Access-Control-Allow-Headers', 'content-type');
      response.writeHead(request.method === 'OPTIONS' ? 204 : 200); response.end('ok');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const dom = new runtime.JSDOM('<body></body>', { url: 'http://example.test/' });
    try {
      for (const removedBucket of [false, true]) {
        methods.length = 0; const xhr = new dom.window.XMLHttpRequest(); const removed = () => {};
        xhr.open('POST', `http://127.0.0.1:${server.address().port}/upload`); xhr.timeout = REQUEST_TIMEOUT_MS;
        if (removedBucket) { xhr.upload.addEventListener('progress', removed); xhr.upload.removeEventListener('progress', removed); }
        await new Promise((resolve, reject) => {
          xhr.onload = resolve;
          xhr.onerror = () => reject(new Error('loopback upload failed'));
          xhr.ontimeout = () => reject(new Error('loopback upload timed out'));
          xhr.send('payload');
        });
        assert.equal(xhr.status, 200); assert.equal(xhr.responseText, 'ok');
        assert.deepEqual(methods, removedBucket ? ['OPTIONS', 'POST'] : ['POST']);
      }
    } finally {
      dom.window.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    }
  });
}
