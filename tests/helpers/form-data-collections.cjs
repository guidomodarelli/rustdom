/** @file Compares real FormData operations after host collection constructors are replaced. */
'use strict';
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
const [mode, collection, mutation] = process.argv.slice(2);

/** @param {object} wrapper - Actual DOM wrapper. @returns {object} Implementation used by FileList and the serializer. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

/** @param {FormData} data - Actual FormData. @returns {Array} Cross-realm public values and File metadata. */
function entries(data) {
  return Array.from(data, ([name, value]) => [name, typeof value === 'string' ? value : {
    name: value.name, size: value.size, type: value.type,
  }]);
}

/** @param {object} runtime - Independent DOM runtime. @returns {object} Observable constructor and mutation results. */
function observe(runtime) {
  const { window } = new runtime.JSDOM('<form><input name="text" value="first"><input name="text" value="second"><input name="upload" type="file"></form>', {
    ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}),
  });
  const form = window.document.forms[0];
  const file = new window.File(['payload'], 'input.txt', { type: 'text/plain', lastModified: 1 });
  implementation(form.elements.namedItem('upload').files).push(implementation(file));
  const cached = new window.FormData();
  cached.append('duplicate', 'first'); cached.append('kept', file); cached.append('duplicate', 'last');
  // XHR's serializer consumes this projection; hold it across real public mutations.
  const oldView = implementation(cached)._entries;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, collection);
  let globalReads = 0;
  let result;
  try {
    Object.defineProperty(globalThis, collection, mutation === 'getter' ? {
      configurable: true,
      get() { globalReads++; throw new Error(`Unexpected global ${collection} read`); },
    } : {
      configurable: true, writable: true,
      value: mutation === 'null' ? null : function replacementCollection() {
        globalReads++; throw new Error(`Unexpected ${collection} construction`);
      },
    });
    const empty = new window.FormData();
    const emptyInitially = entries(empty);
    empty.append('text', 'one'); empty.append('text', 'two'); empty.append('file', file);
    const appended = entries(empty); const all = Array.from(empty.getAll('text'));
    const fileIdentity = empty.get('file') === file;
    empty.set('text', 'replacement'); empty.delete('file'); empty.delete('missing');
    const fromForm = new window.FormData(form);
    const constructed = entries(fromForm); const formFileIdentity = fromForm.get('upload') === file;
    cached.set('duplicate', 'replacement'); cached.append('discard', file); cached.delete('discard');
    cached.delete('missing');
    result = { emptyInitially, appended, all, fileIdentity, mutated: entries(empty),
      constructed, formFileIdentity, cached: entries(cached),
      oldViewValues: oldView.map((entry) => entry.name), globalReads };
  } finally {
    Object.defineProperty(globalThis, collection, descriptor);
    window.close();
  }
  return result;
}

const observed = {};
for (const [engine, runtime] of Object.entries(runtimes)) observed[engine] = observe(runtime);
assert.deepEqual(observed.rustdom, observed.jsdom);
process.stdout.write(JSON.stringify(observed));
