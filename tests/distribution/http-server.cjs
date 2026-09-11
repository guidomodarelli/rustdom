/** @file Serves a real local resource from another process so synchronous XHR cannot block the server. */
'use strict';
const { createServer } = require('node:http');
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('Packaged XHR worker');
});
server.listen(0, '127.0.0.1', () => process.send(server.address().port));
process.on('disconnect', () => server.close());
