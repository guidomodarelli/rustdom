/** @file Tests saved real qualification data and controlled corruptions, without platform mocks or DOM execution. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { verify } = require('./verify-evidence.cjs');
const directory = path.resolve(__dirname, '../../../validation/native-class-ownership/shared-fixture-candidate');
const filenames = [22, 24].map((major) => path.join(directory, `node${major}-attempt5.json`));

function withModified(mutator, inspect) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-shared-evidence-'));
  const files = filenames.map((filename, index) => {
    const evidence = JSON.parse(fs.readFileSync(filename, 'utf8')); mutator(evidence, index);
    const output = path.join(temporary, `${index}.json`); fs.writeFileSync(output, JSON.stringify(evidence)); return output;
  });
  try { inspect(files); } finally { for (const filename of files) fs.unlinkSync(filename); fs.rmdirSync(temporary); }
}

test('both saved real profiles retain all matrix cases, original outputs and final native/weak boundaries', () => {
  const result = verify(filenames);
  assert.equal(result.verified, true); assert.equal(result.performanceAccepted, null);
  assert.equal(result.totals.windows, 76); assert.equal(result.totals.documents, 76);
  assert.equal(result.totals.requiredFinalClearStates, 152);
  const firstUnclear = filenames.flatMap((filename) => JSON.parse(fs.readFileSync(filename, 'utf8')).cases)
    .filter((entry) => !entry.endpoint.trace[0].clear).length;
  assert.equal(result.totals.firstUnclearStates, firstUnclear);
});
test('a consistently forged output cannot replace the independent original public hash', () => {
  withModified((evidence) => { for (const entry of evidence.cases) if (entry.output) entry.output.publicOutputHash = 'invalid'; },
    (files) => assert.throws(() => verify(files), { code: 'ERR_ASSERTION' }));
});
test('duplicate guard cases cannot conceal an omitted teardown scenario', () => {
  withModified((evidence) => { evidence.cases.at(-1).key = 'validation-error'; },
    (files) => assert.throws(() => verify(files), { code: 'ERR_ASSERTION' }));
});
test('a missing Window target cannot be treated as zero survivors', () => {
  withModified((evidence) => { delete evidence.cases[0].endpoint.state.survivors.window; },
    (files) => assert.throws(() => verify(files), { code: 'ERR_ASSERTION' }));
});
test('a substituted preparation cannot borrow the native resource and functional results', () => {
  withModified((evidence) => { evidence.preparationIdentity = {}; },
    (files) => assert.throws(() => verify(files), { code: 'ERR_ASSERTION' }));
});
