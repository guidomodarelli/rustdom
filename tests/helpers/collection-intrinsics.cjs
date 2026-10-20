/** @file Exercises real generic HTMLCollections after typed-array globals are replaced. */
'use strict';
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
const mode = process.argv[2];
/** Keep constructor identity independent from globals modified by each isolated scenario. */
const HostFloat64Array = Float64Array;

/**
 * Observe public collections without consulting typed-array test utilities while poisoned.
 * @param {object} runtime - Independent engine.
 * @param {string} scope - Host or window constructor/factory.
 * @param {string} mutation - Replacement kind.
 * @param {string} kind - Children, document forms, or form controls query.
 * @param {string} stage - Newly created or invalidated collection.
 * @returns {object} Public names, element identities and unintended intrinsic accesses.
 */
function observe(runtime, scope, mutation, kind, stage) {
  const { window } = new runtime.JSDOM('<!doctype html><body><main></main>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const { document } = window;
  const container = document.body.firstElementChild;
  const root = kind === 'controls' ? document.createElement('form') : container;
  if (root !== container) container.append(root);
  const first = document.createElement(kind === 'forms' ? 'form' : kind === 'controls' ? 'input' : 'i');
  first.id = 'first'; first.setAttribute('name', 'first-name'); root.append(first);
  const added = document.createElement(kind === 'forms' ? 'form' : kind === 'controls' ? 'input' : 'b');
  added.id = 'added'; added.setAttribute('name', 'added-name');
  const query = () => kind === 'forms' ? document.forms : kind === 'controls' ? root.elements : root.children;
  let collection = stage === 'refreshed' ? query() : null;
  if (collection) collection.namedItem('first');
  const realm = scope.startsWith('window') ? window : globalThis;
  const target = scope.endsWith('from') ? realm.Float64Array : realm;
  const property = scope.endsWith('from') ? 'from' : 'Float64Array';
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  let reads = 0; let result; let failure;
  const replacement = function ReplacementFloat64Array() {
    reads++;
    if (mutation === 'forged') return new HostFloat64Array([0]);
    throw new Error(`Unexpected Float64Array ${scope} access`);
  };
  try {
    Object.defineProperty(target, property, mutation === 'getter'
      ? { configurable: true, get: replacement }
      : { configurable: true, writable: true, value: mutation === 'null' ? null : replacement });
    root.append(added);
    collection ??= query();
    result = { length: collection.length, firstIdentity: collection.namedItem('first') === first,
      addedIdentity: collection.namedItem('added-name') === added, indexIdentity: collection.item(1) === added,
      names: Object.getOwnPropertyNames(collection), missing: collection.namedItem('missing') };
    first.getAttributeNode('id').value = 'renamed';
    result.renamedIdentity = collection.namedItem('renamed') === first;
    result.removedName = collection.namedItem('first');
    result.refreshedNames = Object.getOwnPropertyNames(collection);
  } catch (error) { failure = error; }
  finally {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
    window.close();
  }
  return { reads, result, error: failure && { name: failure.name, message: failure.message } };
}

const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
  mode, cases: [] };
const scopes = mode === 'vm' ? ['host-global', 'host-from', 'window-global', 'window-from'] : ['host-global', 'host-from'];
for (const scope of scopes) for (const mutation of ['null', 'replacement', 'getter', 'forged']) {
  for (const kind of ['children', 'forms', 'controls']) for (const stage of ['fresh', 'refreshed']) {
    const observations = {};
    for (const [engine, runtime] of Object.entries(runtimes)) observations[engine] = observe(runtime, scope, mutation, kind, stage);
    report.cases.push({ scope, mutation, kind, stage, ...observations });
  }
}
mkdirSync('reports/compatibility', { recursive: true });
writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-collection-intrinsics-${mode}.json`, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(JSON.stringify(report));
