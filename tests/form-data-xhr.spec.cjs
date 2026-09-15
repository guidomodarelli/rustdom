/** @file Exercises the real XHR multipart serializer and a loopback HTTP receiver with native FormData entries. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const NodeResponse = globalThis.Response;

/** @param {object} wrapper - Actual DOM object. @returns {object} Existing implementation for serializer-view probes. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }

for (const mode of ['default', 'vm']) {
  test(`should serialize native entries after cached-view mutations through real XMLHttpRequest in ${mode}`, async () => {
    const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/upload`; const results = {};
    try {
      for (const [engine, runtime] of Object.entries(engines)) {
        const { window } = new runtime.JSDOM('', { url, ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
        try {
          const data = new window.FormData(); data.append('repeat', 'first'); data.append('repeat', 'second');
          data.append('removed', new window.File(['discard'], 'discard', { lastModified: 1 }));
          const view = implementation(data)._entries;
          data.append('binary', new window.File([new Uint8Array([0, 128, 255])], 'original', { type: 'application/octet-stream', lastModified: 42 }), 'renamed.bin');
          assert.equal(view.length, 4);
          data.set('repeat', 'replacement'); data.delete('removed'); data.append('line', 'a\nb\r\nc');
          const received = new Promise((resolve, reject) => server.once('request', (incoming, response) => {
            const chunks = []; incoming.on('data', (chunk) => chunks.push(chunk)); incoming.on('error', reject);
            incoming.on('end', () => { response.end('ok'); resolve({ body: Buffer.concat(chunks), contentType: incoming.headers['content-type'] }); });
          }));
          const completed = new Promise((resolve, reject) => {
            const xhr = new window.XMLHttpRequest(); xhr.open('POST', url);
            xhr.onload = () => { try { assert.equal(xhr.status, 200); resolve(); } catch (error) { reject(error); } };
            xhr.onerror = () => reject(new Error(`XHR multipart transport failed for ${engine}/${mode}`));
            xhr.send(data);
          });
          const [wire] = await Promise.all([received, completed]);
          const boundary = /boundary=(?:"([^"]+)"|([^;]+))/u.exec(wire.contentType);
          assert.ok(boundary); const token = boundary[1] ?? boundary[2];
          const decoded = await new NodeResponse(wire.body, { headers: { 'content-type': wire.contentType } }).formData();
          assert.deepEqual([...decoded.keys()], ['repeat', 'binary', 'line']); assert.equal(decoded.get('repeat'), 'replacement');
          assert.equal(decoded.get('binary').name, 'renamed.bin'); assert.deepEqual([...new Uint8Array(await decoded.get('binary').arrayBuffer())], [0, 128, 255]);
          assert.equal(decoded.get('line'), 'a\r\nb\r\nc');
          results[engine] = { body: wire.body.toString('latin1').replaceAll(token, '<boundary>'), type: wire.contentType.replace(token, '<boundary>') };
        } finally { window.close(); }
      }
      assert.deepEqual(results.rustdom, results.jsdom);
    } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
}
