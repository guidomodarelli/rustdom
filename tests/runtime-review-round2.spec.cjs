/** @file Exercises stream error identity, immutable form intrinsics, and beforeParse overrides through real environments. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readDomFile } = require('./integration/read-dom-file.cjs');
/** Keep access to the native prototype before an environment publishes its DOM globals. */
const NativeFormData = FormData;

/** @param {object} environment - Public environment. @param {string} mode - Normal or VM. @param {object} [options] - Browser options. @returns {object} Session, exposed globals, and original host. */
function openEnvironment(environment, mode, options = {}) {
  const host = { setTimeout, clearTimeout, Error, TypeError, fetch, Request, TextEncoder, ReadableStream };
  const previous = Object.getOwnPropertyDescriptors(host);
  const session = mode === 'vm' ? environment.setupVM({ jsdom: options }) : environment.setup(host, { jsdom: options });
  return { session, target: mode === 'vm' ? session.getVmContext() : host, host, previous };
}

/** @param {object} target - Exposed globals. @param {string} kind - Request or Response. @param {ReadableStream|string} body - Real body. @param {string} contentType - Media type. @returns {Request|Response} A native body owner. */
function bodyOwner(target, kind, body, contentType) {
  const headers = { 'content-type': contentType };
  return kind === 'Request'
    ? new target.Request('/upload', { method: 'POST', body, duplex: 'half', headers })
    : new target.Response(body, { headers });
}

/** Explicit wire fixtures keep input independent from the constructors being replaced. */
const FORM_FIXTURES = [
  { format: 'urlencoded', contentType: 'application/x-www-form-urlencoded', payload: 'tag=first&tag=second' },
  { format: 'multipart', contentType: 'multipart/form-data; boundary=round2',
    payload: '--round2\r\nContent-Disposition: form-data; name="tag"\r\n\r\nfirst\r\n--round2\r\nContent-Disposition: form-data; name="tag"\r\n\r\nsecond\r\n--round2\r\nContent-Disposition: form-data; name="file"; filename="data.bin"\r\nContent-Type: application/octet-stream\r\n\r\nbytes\r\n--round2--\r\n' },
];
/** Invalid MIME metadata must not replace an error originating in the body stream. */
const STREAM_FAILURE_FIXTURES = [...FORM_FIXTURES,
  { format: 'invalid-content-type', contentType: 'text/plain' },
  { format: 'missing-multipart-boundary', contentType: 'multipart/form-data' }];

for (const mode of ['normal', 'vm']) {
  for (const fixture of STREAM_FAILURE_FIXTURES) {
    for (const kind of ['Request', 'Response']) {
      test(`should preserve user Error and TypeError identity when ${mode} ${kind} ${fixture.format} streams fail`, async () => {
        const environment = (await import('../src/environments/vitest.mjs')).default;
        const { target, session } = openEnvironment(environment, mode);
        try {
          for (const ErrorConstructor of [Error, TypeError]) {
            for (const timing of ['before-read', 'pending-read']) {
              // Deliberately match an internal error's copy: provenance cannot depend on its message.
              const failure = new ErrorConstructor('Body is unusable: Body has already been read');
              let controller;
              const stream = new ReadableStream({ start(createdController) { controller = createdController; } });
              if (timing === 'before-read') controller.error(failure);
              const owner = bodyOwner(target, kind, stream, fixture.contentType);
              const pending = owner.formData();
              if (timing === 'pending-read') controller.error(failure);
              await assert.rejects(pending, (error) => error === failure);
              assert.equal(owner.bodyUsed, true);
            }
          }
        } finally { session.teardown(); }
      });
    }
  }

  for (const mutation of ['replace', 'delete']) {
    for (const timing of ['before-read', 'pending-read']) {
      test(`should retain original form intrinsics when ${mode} globals ${mutation} during ${timing}`, async () => {
        const environment = (await import('../src/environments/vitest.mjs')).default;
        const { target, session } = openEnvironment(environment, mode);
        const window = target.jsdom.window;
        const OriginalFormData = window.FormData;
        const OriginalFile = window.File;
        const descriptors = { FormData: Object.getOwnPropertyDescriptor(window, 'FormData'),
          File: Object.getOwnPropertyDescriptor(window, 'File') };
        try {
          for (const fixture of FORM_FIXTURES) {
            for (const kind of ['Request', 'Response']) {
              Object.defineProperties(window, descriptors);
              let controller;
              const stream = new ReadableStream({ start(createdController) { controller = createdController; } });
              const owner = bodyOwner(target, kind, stream, fixture.contentType);
              const pending = timing === 'pending-read' ? owner.formData() : null;
              if (mutation === 'replace') {
                window.FormData = class ReplacementFormData extends OriginalFormData {};
                window.File = class ReplacementFile extends OriginalFile {};
              } else {
                delete window.FormData;
                delete window.File;
              }
              const result = pending ?? owner.formData();
              controller.enqueue(new TextEncoder().encode(fixture.payload));
              controller.close();
              const form = await result;
              assert.equal(form.constructor, OriginalFormData);
              assert.deepEqual(Array.from(form.getAll('tag')), ['first', 'second']);
              if (fixture.format === 'multipart') {
                assert.equal(form.get('file').constructor, OriginalFile);
                assert.equal(form.get('file').name, 'data.bin');
                assert.deepEqual(await readDomFile(target, form.get('file')), [98, 121, 116, 101, 115]);
              }
            }
          }
        } finally {
          Object.defineProperties(window, descriptors);
          session.teardown();
        }
      });
    }
  }

  for (const mutation of ['replace', 'delete', 'accessor']) {
    test(`should expose the same beforeParse API overrides to scripts and ${mode} globals after ${mutation}`, async () => {
      const environment = (await import('../src/environments/vitest.mjs')).default;
      let customFetch;
      let CustomRequest;
      let CustomTextEncoder;
      let getterCalls = 0;
      let retainedAccessor;
      const { target, session, host, previous } = openEnvironment(environment, mode, {
        beforeParse(window) {
          if (mutation !== 'delete') {
            customFetch = async () => 'custom fetch';
            CustomRequest = class UserRequest { constructor() { this.marker = 'custom request'; } };
            CustomTextEncoder = class UserTextEncoder { constructor() { this.marker = 'custom encoder'; } };
            Object.defineProperty(window, 'fetch', mutation === 'accessor'
              ? { configurable: true, get() { getterCalls++; return this === window ? customFetch : undefined; },
                set(value) { assert.equal(this, window); customFetch = value; } }
              : { configurable: true, writable: false, enumerable: false, value: customFetch });
            Object.defineProperty(window, 'Request', { configurable: false, writable: false, value: CustomRequest });
            window.TextEncoder = CustomTextEncoder;
          } else {
            delete window.fetch;
            delete window.Request;
            delete window.TextEncoder;
          }
          delete window.ReadableStream;
          window.getFetchGetterCalls = () => getterCalls;
        },
        html: '<script>window.initialApiState = { fetch: typeof fetch, request: typeof Request, encoder: typeof TextEncoder, stream: typeof ReadableStream }; if (typeof Request === "function") window.initialRequest = new Request("/script").marker; window.initialGetterCalls = getFetchGetterCalls();</script>',
      });
      try {
        const actualWindow = target.jsdom.window;
        assert.equal(getterCalls, actualWindow.initialGetterCalls);
        assert.equal(typeof target.fetch, actualWindow.initialApiState.fetch);
        assert.equal(typeof target.Request, actualWindow.initialApiState.request);
        assert.equal(typeof target.TextEncoder, actualWindow.initialApiState.encoder);
        assert.equal(typeof target.ReadableStream, actualWindow.initialApiState.stream);
        assert.equal('ReadableStream' in target, false);
        if (mutation !== 'delete') {
          assert.equal(target.fetch, customFetch);
          assert.equal(target.Request, CustomRequest);
          assert.equal(await target.fetch('/test'), 'custom fetch');
          assert.equal(new target.Request('/test').marker, actualWindow.initialRequest);
          assert.equal(target.TextEncoder, CustomTextEncoder);
          if (mutation === 'accessor') {
            target.fetch = async () => 'setter result';
            assert.equal(await target.fetch('/test'), 'setter result');
            if (mode === 'normal') retainedAccessor = Object.getOwnPropertyDescriptor(target, 'fetch').get;
          }
        } else {
          assert.equal('fetch' in target, false);
          assert.equal('Request' in target, false);
        }
      } finally { session.teardown(); }
      assert.deepEqual(Object.getOwnPropertyDescriptors(host), previous);
      if (retainedAccessor) assert.equal(retainedAccessor(), undefined);
    });
  }

  for (const kind of ['Request', 'Response']) {
    test(`should consume native bytes and current MIME when ${mode} ${kind} methods or metadata change`, async () => {
      const environment = (await import('../src/environments/vitest.mjs')).default;
      const { target, session } = openEnvironment(environment, mode);
      try {
        const failure = new TypeError('caller override must not run');
        const overridden = bodyOwner(target, kind, 'field=value', 'application/x-www-form-urlencoded');
        overridden.arrayBuffer = () => { throw failure; };
        assert.equal((await overridden.formData()).get('field'), 'value');
        assert.equal(overridden.bodyUsed, true);
        const getterFailure = bodyOwner(target, kind, 'field=value', 'application/x-www-form-urlencoded');
        Object.defineProperty(getterFailure, 'headers', { get() { throw failure; } });
        assert.equal((await getterFailure.formData()).get('field'), 'value');
        assert.equal(getterFailure.bodyUsed, true);
        const unusedIterator = bodyOwner(target, kind, 'field=value', 'application/x-www-form-urlencoded');
        Object.defineProperty(unusedIterator, 'headers', { value: {
          get() { return 'application/x-www-form-urlencoded'; },
          [Symbol.iterator]() { throw failure; },
        } });
        assert.equal((await unusedIterator.formData()).get('field'), 'value');
        const parsedWithUserMethod = bodyOwner(target, kind, 'field=value', 'application/x-www-form-urlencoded');
        const originalAppend = NativeFormData.prototype.append;
        try {
          NativeFormData.prototype.append = () => { throw failure; };
          await assert.rejects(parsedWithUserMethod.formData(), (error) => error === failure);
        } finally { NativeFormData.prototype.append = originalAppend; }
        for (const validAfterRead of [true, false]) {
          let controller;
          const stream = new ReadableStream({ start(createdController) { controller = createdController; } });
          const owner = bodyOwner(target, kind, stream, validAfterRead ? 'text/plain' : 'application/x-www-form-urlencoded');
          const pending = owner.formData();
          owner.headers.set('content-type', validAfterRead ? 'application/x-www-form-urlencoded' : 'text/plain');
          controller.enqueue(new TextEncoder().encode('field=value'));
          controller.close();
          if (validAfterRead) assert.equal((await pending).get('field'), 'value');
          else await assert.rejects(pending, target.TypeError ?? TypeError);
          assert.equal(owner.bodyUsed, true);
        }
      } finally { session.teardown(); }
    });
  }
}
