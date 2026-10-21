/** @file Checks that retaining inventory output never retains its observed reference DOM owners. */
'use strict';
const assert = require('node:assert/strict');
const { dirname } = require('node:path');
const { capturePublicSurface } = require('../../scripts/migration-inventory/surface.cjs');
const { waitForMemoryQuiescence, captureMemoryState } = require('../../scripts/memory-endpoint.cjs');
(async () => {
  const owners = { windows: [], documents: [] }, reports = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    reports.push(capturePublicSurface(dirname(require.resolve('jsdom/package.json')), {
      observeOwners(window, document) { owners.windows.push(new WeakRef(window)); owners.documents.push(new WeakRef(document)); },
    }));
  }
  const endpoint = await waitForMemoryQuiescence({ label: 'inventory-surface-reports-retained', sample: () => captureMemoryState(owners) });
  assert.equal(endpoint.reached, true); assert.ok(reports.every((report) => report.apis.length > 0));
  console.log(JSON.stringify({ cycles: 3, reportsRetained: reports.length, released: endpoint.reached,
    survivors: endpoint.state.survivors, endpointTrace: endpoint.trace }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
