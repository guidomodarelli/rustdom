/** @file Verifies decoded form identities, browser File consumers and isolated environment lifetimes. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { readDomFile } = require('./integration/read-dom-file.cjs');

/**
 * Open the public environment using the same actual addon in both lifecycle modes.
 * @param {object} environment - Public Vitest environment.
 * @param {string} mode - Normal globals or VM globals.
 * @returns {{target: object, session: object}} Owned browser globals and teardown.
 */
function setup(environment, mode) {
  if (mode === 'vm') {
    const session = environment.setupVM({ jsdom: { runScripts: 'outside-only' } });
    return { session, target: session.getVmContext() };
  }
  const target = { setTimeout, clearTimeout, TypeError };
  return { target, session: environment.setup(target, {}) };
}

for (const mode of ['normal', 'vm']) {
  test(`should preserve the exposed form and file realm for Request, Response, clones and fetch in ${mode}`, async () => {
    // Arrange two live realms to detect process-global constructor caches.
    const environment = (await import('../src/environments/vitest.mjs')).default;
    const first = setup(environment, mode);
    const second = setup(environment, mode);
    const server = createServer();
    try {
      const target = first.target;
      const payload = new target.FormData();
      payload.append('tag', 'first');
      payload.append('binary', new target.File([new Uint8Array([0, 128, 255])], 'binary.dat', { type: 'application/octet-stream' }));
      payload.append('tag', 'second');
      payload.append('empty', new target.File([], 'empty.txt', { type: 'text/plain' }));
      const request = new target.Request('http://localhost/upload', { method: 'POST', body: payload });
      const response = new target.Response(payload);
      // Keep the consumed transport clone alive until every reader completes: Node 22.12 can cancel its sibling during finalization.
      const wireResponse = response.clone();
      const wire = await wireResponse.arrayBuffer();
      const headers = { 'content-type': response.headers.get('content-type') };
      server.on('request', (_request, outgoing) => { outgoing.writeHead(200, headers); outgoing.end(Buffer.from(wire)); });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const fetched = await target.fetch(`http://127.0.0.1:${server.address().port}/form`);

      // Act through every exposed reader, including native transport response clones.
      for (const body of [request.clone(), request, response.clone(), response, fetched.clone(), fetched]) {
        const form = await body.formData();
        assert.ok(form instanceof target.FormData);
        assert.equal(form.constructor, target.FormData);
        assert.equal(form instanceof second.target.FormData, false);
        assert.deepEqual(Array.from(form.keys()), ['tag', 'binary', 'tag', 'empty']);
        assert.deepEqual(Array.from(form.getAll('tag')), ['first', 'second']);
        const file = form.get('binary');
        assert.ok(file instanceof target.File);
        assert.ok(file instanceof target.Blob);
        assert.equal(file.constructor, target.File);
        assert.equal(file instanceof second.target.File, false);
        assert.equal(file.name, 'binary.dat');
        assert.equal(file.type, 'application/octet-stream');
        assert.equal(file.size, 3);
        assert.deepEqual(await readDomFile(target, file), [0, 128, 255]);
        assert.deepEqual(await readDomFile(target, form.get('empty')), []);
        assert.equal(form.get('empty').name, 'empty.txt');
        assert.equal(form.get('empty').type, 'text/plain');
        assert.equal(body.bodyUsed, true);
        await assert.rejects(body.formData(), target.TypeError ?? TypeError);

        // Assert that another browser API accepts the returned File and keeps its bytes.
        const roundtrip = await new target.Response(form).formData();
        assert.deepEqual(await readDomFile(target, roundtrip.get('binary')), [0, 128, 255]);
      }
      assert.equal(wireResponse.bodyUsed, true);
      const other = await new second.target.Response(payload).formData();
      assert.ok(other instanceof second.target.FormData);
      assert.ok(other.get('binary') instanceof second.target.File);
      first.session.teardown();
      assert.ok((await new second.target.Response(payload).formData()) instanceof second.target.FormData);
    } finally {
      first.session.teardown();
      second.session.teardown();
      server.closeAllConnections();
      if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  test(`should decode urlencoded forms in the same exposed realm and preserve body errors in ${mode}`, async () => {
    const environment = (await import('../src/environments/vitest.mjs')).default;
    const { target, session } = setup(environment, mode);
    try {
      const headers = { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' };
      const payload = 'tag=first&text=caf%C3%A9+con+leche&tag=second&empty=';
      const request = new target.Request('http://localhost/upload', { method: 'POST', headers, body: payload });
      const response = new target.Response(payload, { headers });
      for (const body of [request.clone(), request, response.clone(), response]) {
        const form = await body.formData();
        assert.ok(form instanceof target.FormData);
        assert.equal(form.constructor, target.FormData);
        assert.deepEqual(Array.from(form, (entry) => Array.from(entry)), [['tag', 'first'], ['text', 'café con leche'], ['tag', 'second'], ['empty', '']]);
        assert.equal(body.bodyUsed, true);
        await assert.rejects(body.formData(), target.TypeError ?? TypeError);
      }
      for (const Constructor of [target.Request, target.Response]) {
        for (const contentType of ['multipart/form-data', 'multipart/form-data; boundary=absent', 'text/plain', 'invalid']) {
          const options = { headers: { 'content-type': contentType } };
          const body = Constructor === target.Request
            ? new Constructor('http://localhost/upload', { ...options, method: 'POST', body: 'malformed' })
            : new Constructor('malformed', options);
          await assert.rejects(body.formData(), target.TypeError ?? TypeError);
        }
      }
      const failure = new Error('test stream failed');
      const stream = new ReadableStream({ start(controller) { controller.error(failure); } });
      await assert.rejects(new target.Response(stream, { headers }).formData(), (error) => error === failure);
      const locked = new target.Response(payload, { headers });
      const reader = locked.body.getReader();
      await assert.rejects(locked.formData(), target.TypeError ?? TypeError);
      reader.releaseLock();
      assert.ok((await locked.formData()) instanceof target.FormData);
    } finally { session.teardown(); }
  });
}
