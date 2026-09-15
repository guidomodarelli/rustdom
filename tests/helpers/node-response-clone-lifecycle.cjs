/** @file Diagnoses the host Response clone lifecycle without loading either DOM engine. */
'use strict';
const { createServer } = require('node:http');
const { once } = require('node:events');
/** Preserve every host observation, including the intentionally reproduced Node 22 failure. */
const results = [];
/** Retain the consumed clone through a final observable read when requested. */
const retainClone = process.argv[2] === 'retain';
/** @returns {Promise<void>} Record host-only clone behavior with explicit GC between operations. */
async function main() {
  for (let cycle = 0; cycle < 20; cycle++) {
    const payload = new FormData();
    payload.append('tag', 'first'); payload.append('binary', new File([new Uint8Array([0,128,255])], 'binary.dat')); payload.append('tag', 'second');
    const response = new Response(payload);
    const server = createServer();
    const sample = { cycle };
    try {
      let wireResponse = response.clone();
      const wire = await wireResponse.arrayBuffer();
      if (!retainClone) wireResponse = null;
      for (let turn = 0; turn < 8; turn++) { global.gc(); await new Promise((resolve) => setImmediate(resolve)); }
      sample.beforeFetch = { used: response.bodyUsed, locked: response.body.locked };
      server.on('request', (_request, outgoing) => { outgoing.writeHead(200, { 'content-type': response.headers.get('content-type') }); outgoing.end(Buffer.from(wire)); });
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      const fetched = await fetch(`http://127.0.0.1:${server.address().port}/form`);
      sample.afterFetch = { used: response.bodyUsed, locked: response.body.locked };
      const copy = response.clone();
      await Promise.all([copy.formData(), response.formData(), fetched.formData()]);
      sample.retainedCloneConsumed = retainClone ? wireResponse.bodyUsed : null;
      sample.pass = !retainClone || sample.retainedCloneConsumed === true;
    } catch (error) { sample.error = { name: error.name, message: error.message, stack: error.stack }; }
    finally { server.closeAllConnections(); if (server.listening) await new Promise((resolve) => server.close(resolve)); }
    results.push(sample);
  }
  process.stdout.write(JSON.stringify({ node: process.version, source: 'host Node Request/Response/FormData; no rustdom loaded', retainClone, cycles: results.length, pass: results.every((sample) => sample.pass), results }, null, 2) + '\n');
}
main().catch((error) => { process.stderr.write(error.stack); process.exitCode = 1; });
