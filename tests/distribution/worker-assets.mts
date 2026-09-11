/** Verifies the private synchronous XHR worker and its dependencies after package installation. */
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { JSDOM } from '@rustdom/rustdom';

const server = fork(fileURLToPath(new URL('../types/http-server.cjs', import.meta.url)), {
  stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
});
let dom: JSDOM | undefined;
try {
  const [port] = await once(server, 'message', { signal: AbortSignal.timeout(15000) });
  dom = new JSDOM('', { url: `http://127.0.0.1:${port}/` });
  const request = new dom.window.XMLHttpRequest();
  request.open('GET', '/resource', false);
  request.send();
  assert.equal(request.status, 200);
  assert.equal(request.responseText, 'Packaged XHR worker');
} finally {
  dom?.window.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}
