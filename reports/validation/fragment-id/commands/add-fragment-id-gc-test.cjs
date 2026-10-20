'use strict';
const fs = require('node:fs');
const root = process.argv[2];
fs.appendFileSync(root + '/tests/fragment-id.spec.cjs', `
test('should release fragment ID results removed members owners Documents and Windows', () => {
  const { spawnSync } = require('node:child_process');
  const { readFileSync } = require('node:fs');
  const { TEST_TIMEOUT_MS } = require('../scripts/constants/collection-query-memory.cjs');
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/fragment-id-memory.cjs'], { encoding: 'utf8', timeout: TEST_TIMEOUT_MS });
  assert.equal(child.error, undefined, child.stderr);
  assert.equal(child.status, 0, child.stdout + child.stderr);
  const path = child.stdout.match(/Guardado: ([^\\r\\n]+\\.json)/)?.[1];
  assert.ok(path, child.stdout);
  const memory = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(memory.pass, true);
  assert.equal(memory.cases.length, 78);
  for (const sample of memory.cases) {
    assert.equal((sample.endpoint || sample.released).reached, true);
    if (sample.removed) assert.equal(sample.removed.reached, true);
  }
});
`);
