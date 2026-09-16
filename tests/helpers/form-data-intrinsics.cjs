/** @file Exercises FormData under host-global Symbol replacement in an isolated process. */
'use strict';
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
const [mode, mutation] = process.argv.slice(2);

/** @param {object} wrapper - Actual DOM wrapper. @returns {object} Private implementation for a real FileList and throwing field. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

/** @param {object} runtime - Independent DOM implementation. @returns {object} Public values and error identity after restoring the host global. */
function observe(runtime) {
  const dom = new runtime.JSDOM('<form><input name="field" value="first"><input name="field" value="last"><input name="upload" type="file"></form><form><input name="broken"></form><form><select name="choices"><option selected>one</option></select></form>', {
    ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}),
  });
  const { window } = dom;
  const form = window.document.forms[0];
  const brokenForm = window.document.forms[1];
  const selectForm = window.document.forms[2];
  const file = new window.File(['payload'], 'upload.txt', { type: 'text/plain', lastModified: 1 });
  implementation(form.elements.namedItem('upload').files).push(implementation(file));
  const marker = Symbol('original failure');
  implementation(brokenForm.elements[0])._getValue = () => { throw marker; };
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Symbol');
  const unrelatedIterator = Symbol('unrelated iterator');
  let symbolReads = 0;
  let result;
  try {
    if (mutation === 'getter') {
      Object.defineProperty(globalThis, 'Symbol', { configurable: true, get() { symbolReads++; throw new Error('Global Symbol was read'); } });
    } else {
      globalThis.Symbol = mutation === 'null' ? null : { iterator: unrelatedIterator };
    }
    const data = new window.FormData(form);
    let preservedFailure = false;
    try { new window.FormData(brokenForm); } catch (error) { preservedFailure = error === marker; }
    result = {
      duplicates: Array.from(data.getAll('field')),
      fileIdentity: data.get('upload') === file && data.getAll('upload')[0] === file,
      values: Array.from(data, ([name, value]) => [name, typeof value === 'string' ? value : {
        name: value.name, type: value.type, size: value.size,
      }]),
      preservedFailure, symbolReads,
    };
    // HTMLCollection's own iterator still reads the mutable global in both engines.
    // Preserve that dependency behavior rather than masking it with this FormData fix.
    try { new window.FormData(selectForm); } catch (error) { result.selectFailure = { name: error.name, message: error.message }; }
  } finally {
    Object.defineProperty(globalThis, 'Symbol', originalDescriptor);
    window.close();
  }
  return result;
}

const observed = {};
for (const [engine, runtime] of Object.entries(runtimes)) observed[engine] = observe(runtime);
assert.deepEqual(observed.rustdom, observed.jsdom);
process.stdout.write(JSON.stringify(observed));
