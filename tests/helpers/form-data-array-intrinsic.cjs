/** @file Exercises FormData's public arrays and serializer view while Array globals are replaced. */
'use strict';
const { writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
const mode = process.argv[2];
/** Keep the fixture's target identity stable when the public binding is replaced. */
const HostArray = Array;
/** @param {object} wrapper - Real wrapper. @returns {object} Serializer implementation. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}
/**
 * Read entries without consulting test utilities that depend on the mutated constructor.
 * @param {object} runtime - Independent engine.
 * @param {string} scope - Global binding or static factory.
 * @param {string} mutation - Null, replacement, or getter.
 * @returns {object} Observable arrays and File identity, plus unexpected accesses.
 */
function observe(runtime, scope, mutation) {
  const { window } = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const form = new window.FormData(); const file = new window.File(['bytes'], 'file.txt');
  form.append('field', 'first'); form.append('file', file); form.append('field', 'second');
  const target = scope === 'global' ? globalThis : HostArray; const property = scope === 'global' ? 'Array' : 'from';
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  let reads = 0; let result; let failure;
  const replacement = () => { reads++; throw new Error(`Unexpected Array ${scope} access`); };
  try {
    Object.defineProperty(target, property, mutation === 'getter' ? { configurable: true, get: replacement }
      : { ...descriptor, value: mutation === 'null' ? null : replacement });
    const values = form.getAll('field'); const missing = form.getAll('missing');
    const fileIdentity = form.getAll('file')[0] === file;
    const view = implementation(form)._entries;
    result = { values, missing, fileIdentity, names: view.map((entry) => entry.name) };
  } catch (error) { failure = error; }
  finally { Object.defineProperty(target, property, descriptor); window.close(); }
  return { reads, result, error: failure && { name: failure.name, message: failure.message } };
}
const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version, mode, cases: [] };
for (const scope of ['global', 'from']) for (const mutation of ['null', 'replacement', 'getter']) {
  const observations = {};
  for (const [engine, runtime] of Object.entries(runtimes)) observations[engine] = observe(runtime, scope, mutation);
  report.cases.push({ scope, mutation, ...observations });
}
writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-formdata-array-intrinsic-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report));
