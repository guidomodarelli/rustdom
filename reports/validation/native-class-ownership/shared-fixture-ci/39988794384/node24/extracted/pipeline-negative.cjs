const { test } = require('node:test');
const assert = require('node:assert/strict');
test('expected pipeline failure', () => assert.fail('Controlled failure for shell propagation'));
