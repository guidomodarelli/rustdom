/** @file Verifies immutable Web API intrinsics, native MIME extraction and deterministic environment cleanup. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const { resolveObjectURL } = require('node:buffer');

/** Preserve host references before tests deliberately modify exposed globals. */
const HostTypeError = TypeError;
const HostError = Error;
const HostRequest = Request;
const HostResponse = Response;
const HostHeaders = Headers;
const HostURL = URL;

/** @param {object} environment - Real Vitest environment. @param {string} mode - Normal or VM. @param {Function} [beforeParse] - Public callback. @returns {object} Session, original error constructor and globals. */
function openEnvironment(environment, mode, beforeParse) {
  const host = { setTimeout, clearTimeout, TypeError: HostTypeError, Error: HostError };
  let window;
  let windowTypeError;
  const options = { jsdom: { beforeParse(createdWindow) {
    window = createdWindow;
    windowTypeError = window.TypeError;
    beforeParse?.(window, host);
  } } };
  const session = mode === 'vm' ? environment.setupVM(options) : environment.setup(host, options);
  return { session, window, host, target: mode === 'vm' ? session.getVmContext() : host,
    OriginalTypeError: mode === 'vm' ? windowTypeError : HostTypeError };
}

/** @param {object} globals - Body constructors. @param {string} kind - Request or Response. @param {*} body - Body input. @param {*} headers - Native headers. @returns {Request|Response} Real native owner. */
function createBody(globals, kind, body, headers) {
  return kind === 'Request'
    ? new globals.Request('http://localhost/form', { method: 'POST', body, headers, duplex: 'half' })
    : new globals.Response(body, { headers });
}

/** @param {string} boundary - Literal MIME boundary. @returns {string} A complete multipart body with a field and file. */
function multipartBody(boundary) {
  return `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="value.txt"\r\nContent-Type: text/plain\r\n\r\nbytes\r\n--${boundary}--\r\n`;
}

/** @param {string[]} values - Content-Type field values. @returns {Headers} Native combined headers. */
function contentTypes(values) {
  const headers = new HostHeaders();
  for (const value of values) headers.append('content-type', value);
  return headers;
}

for (const mode of ['normal', 'vm']) {
  for (const mutation of ['replace', 'delete']) {
    for (const timing of ['beforeParse', 'pending']) {
      test(`should preserve the original ${mode} TypeError when ${mutation} happens at ${timing}`, async () => {
        const environment = (await import('../src/environments/vitest.mjs')).default;
        let replacementCalls = 0;
        class ReplacementTypeError extends HostError { constructor(...args) { super(...args); replacementCalls++; } }
        const change = (window, host) => {
          for (const global of new Set([window, host])) {
            if (mutation === 'replace') global.TypeError = ReplacementTypeError;
            else delete global.TypeError;
          }
        };
        const context = openEnvironment(environment, mode, timing === 'beforeParse' ? change : undefined);
        try {
          for (const kind of ['Request', 'Response']) {
            let controller;
            const stream = new ReadableStream({ start(createdController) { controller = createdController; } });
            const pending = createBody(context.target, kind, stream, { 'content-type': 'text/plain' }).formData();
            if (timing === 'pending') change(context.window, context.host);
            controller.enqueue(new TextEncoder().encode('field=value'));
            controller.close();
            await assert.rejects(pending, (error) => error.constructor === context.OriginalTypeError);
            const used = createBody(context.target, kind, 'field=value', { 'content-type': 'application/x-www-form-urlencoded' });
            await used.formData();
            await assert.rejects(used.formData(), (error) => error instanceof context.OriginalTypeError && error.constructor === context.OriginalTypeError);
            const malformed = createBody(context.target, kind, 'invalid', { 'content-type': 'multipart/form-data; boundary=missing' });
            await assert.rejects(malformed.formData(), (error) => error.constructor === context.OriginalTypeError);
          }
          assert.equal(replacementCalls, 0);
        } finally { context.session.teardown(); }
      });
    }
  }

  for (const failureStage of ['beforeParse', 'forwarding']) {
    test(`should preserve initialization failure and release ${mode} resources after ${failureStage} throws`, async () => {
      const environment = (await import('../src/environments/vitest.mjs')).default;
      const failure = new HostError('expected initialization failure');
      const controller = new AbortController();
      let window;
      let originalClose;
      let objectUrl;
      let timerFired = false;
      try {
        assert.throws(() => openEnvironment(environment, mode, (createdWindow) => {
          window = createdWindow;
          originalClose = window.close;
          window.addEventListener('retained', () => {}, { signal: controller.signal });
          window.setTimeout(() => { timerFired = true; }, 20);
          objectUrl = window.URL.createObjectURL(new window.Blob(['owned bytes']));
          delete window.EventTarget;
          window.close = () => {};
          if (failureStage === 'beforeParse') throw failure;
          window.addEventListener = () => { throw failure; };
        }), (error) => error === failure);
        await new Promise((resolve) => setTimeout(resolve, 40));
        assert.equal(window.document, undefined);
        assert.equal(timerFired, false);
        assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
        assert.equal(resolveObjectURL(objectUrl), undefined);
      } finally {
        originalClose?.call(window);
        controller.abort();
        if (objectUrl) HostURL.revokeObjectURL(objectUrl);
      }
    });
  }

  for (const timing of ['before-read', 'pending']) {
    test(`should populate ${mode} forms with intrinsic append after a ${timing} prototype override`, async () => {
      const environment = (await import('../src/environments/vitest.mjs')).default;
      const { target, window, session } = openEnvironment(environment, mode);
      const originalAppend = window.FormData.prototype.append;
      const failure = new HostTypeError('user DOM append must not be called by formData');
      let calls = 0;
      try {
        for (const kind of ['Request', 'Response']) {
          for (const multipart of [false, true]) {
            window.FormData.prototype.append = originalAppend;
            let controller;
            const stream = new ReadableStream({ start(createdController) { controller = createdController; } });
            const headers = { 'content-type': multipart ? 'multipart/form-data; boundary=intrinsic' : 'application/x-www-form-urlencoded' };
            const owner = createBody(target, kind, stream, headers);
            const pending = timing === 'pending' ? owner.formData() : null;
            window.FormData.prototype.append = () => { calls++; throw failure; };
            const received = pending ?? owner.formData();
            controller.enqueue(new TextEncoder().encode(multipart ? multipartBody('intrinsic') : 'field=value'));
            controller.close();
            const form = await received;
            assert.equal(form.get('field'), 'value');
            if (multipart) assert.equal(form.get('file').name, 'value.txt');
          }
          assert.equal(calls, 0);
        }
      } finally { window.FormData.prototype.append = originalAppend; session.teardown(); }
    });
  }

  for (const kind of ['Request', 'Response']) {
    test(`should ignore shadowed ${mode} ${kind} body and header accessors`, async () => {
      const environment = (await import('../src/environments/vitest.mjs')).default;
      const { target, session } = openEnvironment(environment, mode);
      const Prototype = kind === 'Request' ? HostRequest.prototype : HostResponse.prototype;
      const getUsed = Object.getOwnPropertyDescriptor(Prototype, 'bodyUsed').get;
      const failure = new HostTypeError('shadowed body accessor must not run');
      try {
        for (const shadow of ['bodyUsed', 'body', 'headers', 'fake-used', 'fake-body', 'fake-headers', 'headers-get']) {
          const owner = createBody(target, kind, 'field=value', { 'content-type': 'application/x-www-form-urlencoded' });
          let calls = 0;
          const hook = () => { calls++; throw failure; };
          if (shadow === 'fake-used') Object.defineProperty(owner, 'bodyUsed', { value: true });
          else if (shadow === 'fake-body') Object.defineProperty(owner, 'body', { value: { locked: true } });
          else if (shadow === 'fake-headers') Object.defineProperty(owner, 'headers', { value: new HostHeaders({ 'content-type': 'text/plain' }) });
          else if (shadow === 'headers-get') owner.headers.get = hook;
          else Object.defineProperty(owner, shadow, { get: hook });
          const form = await owner.formData();
          assert.equal(form.get('field'), 'value');
          assert.equal(calls, 0);
          assert.equal(getUsed.call(owner), true);
        }
        let lockedCalls = 0;
        const source = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('field=value')); controller.close(); } });
        const owner = createBody(target, kind, source, { 'content-type': 'application/x-www-form-urlencoded' });
        Object.defineProperty(source, 'locked', { get() { lockedCalls++; if (lockedCalls > 1) throw failure; return false; } });
        assert.equal((await owner.formData()).get('field'), 'value');
        assert.equal(lockedCalls, 1, 'only the native reader may invoke the public stream hook');
      } finally { session.teardown(); }
    });
  }

  for (const mutation of ['replace', 'delete']) {
    test(`should close ${mode} resources when beforeParse ${mutation}s EventTarget and overrides close`, async () => {
      const environment = (await import('../src/environments/vitest.mjs')).default;
      const controller = new AbortController();
      let originalClose;
      let originalEventTarget;
      let objectUrl;
      let timerFired = false;
      let closeOverrideCalls = 0;
      const context = openEnvironment(environment, mode, (window) => {
        originalClose = window.close;
        originalEventTarget = window.EventTarget;
        window.addEventListener('retained', () => {}, { signal: controller.signal });
        window.setTimeout(() => { timerFired = true; }, 20);
        objectUrl = window.URL.createObjectURL(new window.Blob(['owned bytes']));
        window.close = () => { closeOverrideCalls++; };
        if (mutation === 'replace') window.EventTarget = class ReplacementEventTarget {};
        else delete window.EventTarget;
      });
      let teardownError;
      try {
        try { context.session.teardown(); } catch (error) { teardownError = error; }
        await new Promise((resolve) => setTimeout(resolve, 40));
        assert.equal(teardownError, undefined);
        assert.equal(context.window.document, undefined);
        assert.equal(timerFired, false);
        assert.equal(closeOverrideCalls, 0);
        assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
        assert.equal(resolveObjectURL(objectUrl), undefined);
      } finally {
        context.window.EventTarget = originalEventTarget;
        originalClose.call(context.window);
        controller.abort();
        HostURL.revokeObjectURL(objectUrl);
      }
    });
  }

  test(`should extract native Content-Type lists for ${mode} Request and Response readers`, async () => {
    const environment = (await import('../src/environments/vitest.mjs')).default;
    const { target, session, OriginalTypeError } = openEnvironment(environment, mode);
    const cases = [
      { values: ['text/plain', 'application/x-www-form-urlencoded'], body: 'field=value' },
      { values: ['application/x-www-form-urlencoded', 'cannot-parse', '*/*'], body: 'field=value' },
      { values: ['text/plain', 'multipart/form-data; boundary="a,b"'], body: multipartBody('a,b') },
      { values: ['multipart/form-data; boundary="a,b"', 'cannot-parse'], body: multipartBody('a,b') },
      { values: ['multipart/form-data; boundary=a', 'multipart/form-data'], body: multipartBody('a') },
      { values: ['application/x-www-form-urlencoded', 'application/*'], body: 'field=value' },
      { values: ['cannot-parse', '*/*'], body: 'field=value' },
    ];
    try {
      for (const kind of ['Request', 'Response']) for (const fixture of cases) {
        const reference = createBody({ Request: HostRequest, Response: HostResponse }, kind, fixture.body, contentTypes(fixture.values));
        let expected;
        let failed = false;
        try { expected = await reference.formData(); } catch (error) { assert.ok(error instanceof HostTypeError); failed = true; }
        const owner = createBody(target, kind, fixture.body, contentTypes(fixture.values));
        if (failed) await assert.rejects(owner.formData(), (error) => error.constructor === OriginalTypeError);
        else assert.equal((await owner.formData()).get('field'), expected.get('field'));
        assert.equal(owner.bodyUsed, reference.bodyUsed);
      }
    } finally { session.teardown(); }
  });
}
