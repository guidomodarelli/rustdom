/** @file Exercises Node's delayed-task shutdown after real loopback redirects, without loading rustdom or any addon. */
'use strict';
const { createServer } = require('node:http');
const { LOCAL_HOST, REDIRECT_STATUS_CODE } = require('../constants/windows-node-exit.cjs');
let requests = 0;
const server = createServer((request, response) => {
  requests += 1;
  response.statusCode = REDIRECT_STATUS_CODE;
  response.setHeader('Location', '/');
  response.end();
});
server.listen(0, LOCAL_HOST, async () => {
  let redirectRejected = false;
  try { await fetch(`http://${LOCAL_HOST}:${server.address().port}/`); }
  catch (error) { redirectRejected = error instanceof TypeError; }
  const report = { node: process.version, pid: process.pid, requests, redirectRejected,
    loadedAddonFiles: Object.keys(require.cache).filter((filename) => filename.endsWith('.node')) };
  // Immediate exit deliberately exercises the upstream Node regression. The
  // parent requires actual termination and never accepts output from a crash.
  process.stdout.write(JSON.stringify(report) + '\n', () => process.exit(redirectRejected ? 0 : 2));
});
