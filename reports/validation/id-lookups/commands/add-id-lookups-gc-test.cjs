'use strict';
const fs = require('node:fs');
const root = process.argv[2];
fs.appendFileSync(root + '/tests/id-lookups.spec.cjs', `
test('should preserve public alias reachability and release private ID state owners and Windows', () => {
  const { spawnSync } = require('node:child_process');
  const { readFileSync } = require('node:fs');
  const { TEST_TIMEOUT_MS } = require('../scripts/constants/collection-query-memory.cjs');
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/id-lookups-memory.cjs'], { encoding: 'utf8', timeout: TEST_TIMEOUT_MS });
  assert.equal(child.error, undefined, child.stderr); assert.equal(child.status, 0, child.stdout + child.stderr);
  const path = child.stdout.match(/Guardado: ([^\\r\\n]+\\.json)/)?.[1]; assert.ok(path, child.stdout);
  const memory = JSON.parse(readFileSync(path, 'utf8')); assert.equal(memory.pass, true); assert.equal(memory.cases.length, 62);
  for (const sample of memory.cases) {
    assert.equal((sample.endpoint || sample.released).reached, true);
    if (sample.removed) assert.equal(sample.removed.reached, true);
    if (sample.kind === 'private-document-alias') assert.equal(sample.held.survivors.elements, sample.engine === 'jsdom' ? 1 : 0);
    if (sample.kind === 'public-window-alias') assert.equal(sample.held.survivors.elements, 1);
  }
});
`);
