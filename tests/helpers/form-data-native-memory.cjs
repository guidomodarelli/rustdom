/** @file Real FormData construction, callbacks and temporary handle scopes under GC/Memcheck. */
'use strict';
const assert = require('node:assert/strict');
const addon = require('../../dist/native.cjs');
const mode = process.argv[2] ?? 'native'; const cycles = Number(process.argv[3] ?? 1000);
assert.ok(mode === 'control' || mode === 'native'); assert.ok(Number.isSafeInteger(cycles) && cycles > 0);
const runtime = mode === 'native' ? require('../../dist/index.cjs') : require('jsdom');

/** @returns {object} Owned actual realm and independent WeakRefs. */
function fixture() {
  const dom = new runtime.JSDOM('<form><input name="text" value="value"><input name="check" type="checkbox" checked><input name="files" type="file"></form>');
  const window = dom.window; const form = window.document.querySelector('form');
  const field = form.elements[0]; const internal = field[Object.getOwnPropertySymbols(field).find((symbol) => symbol.description === 'impl')];
  return { window, form, field: internal, getValue: internal._getValue, marker: { document: window.document },
    file: new window.File([new Uint8Array([0, 128, 255])], 'file', { lastModified: 42 }),
    documents: [new WeakRef(window.document)], windows: [new WeakRef(window)] };
}
/** @param {object} sample - Actual realm. @param {number} cycle - Case variation. @param {WeakRef[]} observed - Weak FormData observations. @returns {void} Exercise constructor, File preparation, mutations and failure cleanup. */
function exercise(sample, cycle, observed) {
  const data = new sample.window.FormData(sample.form); observed.push(new WeakRef(data));
  data.append('file', sample.file, `copy${cycle}`); data.append('text', 'duplicate'); data.set('text', `updated${cycle}`);
  assert.equal(data.get('text'), `updated${cycle}`); assert.equal(data.getAll('text').length, 1);
  assert.equal(data.get('file').lastModified, 42); data.delete('file'); assert.equal(data.has('file'), false);
  assert.deepEqual(Array.from(data.keys()), ['text', 'check', 'files']);
  if (cycle % 10 === 0) {
    sample.field._getValue = () => { throw sample.marker; };
    try { assert.throws(() => new sample.window.FormData(sample.form), (error) => error === sample.marker); }
    finally { sample.field._getValue = sample.getValue; }
  }
}
/** @returns {Promise<void>} Release every owner and check cleanup after separate GC turns. */
async function main() {
  const before = addon.NativeFormDataEntries.statistics(); const sample = fixture(); const forms = [];
  for (let cycle = 0; cycle < cycles; cycle++) { exercise(sample, cycle, forms); if (cycle % 25 === 0) { global.gc(); await new Promise((resolve) => setImmediate(resolve)); } }
  sample.window.close(); sample.window = null; sample.form = null; sample.field = null; sample.getValue = null; sample.file = null; sample.marker = null;
  for (let turn = 0; turn < 8; turn++) { global.gc(); await new Promise((resolve) => setImmediate(resolve)); }
  const survivors = { forms: forms.filter((value) => value.deref()).length, documents: sample.documents.filter((value) => value.deref()).length, windows: sample.windows.filter((value) => value.deref()).length };
  assert.deepEqual(survivors, { forms: 0, documents: 0, windows: 0 });
  const after = addon.NativeFormDataEntries.statistics();
  for (const key of ['live', 'entries', 'textUnits', 'capacity', 'nameCapacity']) assert.equal(after[key], before[key], key);
  assert.equal(addon.formDataConstructionStatistics().active, 0); assert.equal(addon.classReferenceStatistics().cleanupErrors, 0);
  process.stdout.write(`${JSON.stringify({ mode, cycles, pass: true, survivors, before, after, construction: addon.formDataConstructionStatistics(), classes: addon.classReferenceStatistics() })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
