/** @file Compares public FormData behavior under isolated host collection prototype mutations. */
'use strict';
const { writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
/** The methods introduced by private entry ownership and duplicate-removal bookkeeping. */
const methods = [['Map', 'get'], ['Map', 'set'], ['Map', 'delete'], ['WeakMap', 'get'], ['WeakMap', 'set'], ['Set', 'has'], ['Set', 'add']];
const mode = process.argv[2];

/** @param {object} wrapper - Actual DOM wrapper. @returns {object} Serializer implementation. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}
/** @param {FormData} form - Public form. @returns {Array} Portable entry values, including real File metadata. */
function entries(form) {
  return Array.from(form, ([name, value]) => [name, typeof value === 'string' ? value : { name: value.name, size: value.size, type: value.type }]);
}
/**
 * Mutate one host method synchronously, then restore it before teardown or diagnostic serialization.
 * @param {object} runtime - Independent DOM implementation.
 * @param {string} collection - Host collection name.
 * @param {string} method - Public prototype property to replace.
 * @param {string} mutation - Null, throwing replacement, or throwing getter.
 * @returns {object} Public outcomes and post-error usability observations.
 */
function observe(runtime, collection, method, mutation) {
  const { window } = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const file = new window.File(['payload'], 'input.txt', { type: 'text/plain', lastModified: 1 });
  const cached = new window.FormData();
  cached.append('duplicate', 'first'); cached.append('kept', file); cached.append('duplicate', 'last');
  const oldView = implementation(cached)._entries;
  const prototype = globalThis[collection].prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
  let reads = 0; let form; let result; let failure; let postFailure; let postValue;
  const replacement = () => { reads++; throw new Error(`Unexpected ${collection}.prototype.${method}`); };
  try {
    Object.defineProperty(prototype, method, mutation === 'getter' ? { configurable: true, get: replacement }
      : { ...descriptor, value: mutation === 'null' ? null : replacement });
    form = new window.FormData();
    const empty = entries(form);
    form.append('text', 'one'); form.append('text', 'two'); form.append('file', file);
    const all = Array.from(form.getAll('text')); const first = form.get('text'); const fileIdentity = form.get('file') === file;
    form.set('text', 'replacement'); form.delete('file'); form.delete('missing');
    cached.set('duplicate', 'replacement'); cached.append('discard', file); cached.delete('discard'); cached.delete('missing');
    result = { empty, all, first, fileIdentity, mutated: entries(form), cached: entries(cached), oldViewNames: oldView.map((entry) => entry.name) };
  } catch (error) { failure = error; }
  finally { Object.defineProperty(prototype, method, descriptor); }
  try { if (form) postValue = form.get('text'); } catch (error) { postFailure = error; }
  window.close();
  return { reads, result, postValue, error: failure && { name: failure.name, message: failure.message },
    postError: postFailure && { name: postFailure.name, message: postFailure.message } };
}

const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version, mode, cases: [] };
for (const [collection, method] of methods) for (const mutation of ['null', 'replacement', 'getter']) {
  const observations = {};
  for (const [engine, runtime] of Object.entries(runtimes)) observations[engine] = observe(runtime, collection, method, mutation);
  report.cases.push({ collection, method, mutation, ...observations });
}
const path = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-formdata-collection-methods-${mode}.json`;
writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report));
