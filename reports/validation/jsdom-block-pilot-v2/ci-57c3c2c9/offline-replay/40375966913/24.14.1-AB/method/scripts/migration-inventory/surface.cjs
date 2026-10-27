/** @module scripts/migration-inventory/surface Observes public descriptors in a real independent jsdom realm. */
'use strict';
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { REFERENCE_GLOBALS_FILE, INSTANCE_SURFACE_PROBES, WINDOW_NAMESPACE_PROBES,
  SURFACE_DOCUMENT_URL, PUBLIC_FUNCTION_INTRINSIC_MEMBERS, SURFACE_ORIGIN,
  SURFACE_EXCLUSION, INVENTORY_ID_PREFIX } = require('../constants/migration-inventory.cjs');

/** @param {PropertyKey} key - Actual descriptor key. @returns {string|null} Stable public key or null for an internal symbol. */
function publicKey(key) {
  if (typeof key === 'string') return key.startsWith('_') ? null : key;
  for (const name of Object.getOwnPropertyNames(Symbol)) if (Symbol[name] === key) return `@@${name}`;
  return Symbol.keyFor(key) === undefined ? null : `Symbol.for(${Symbol.keyFor(key)})`;
}

/** @param {string} left - First stable identifier. @param {string} right - Second stable identifier. @returns {number} Locale-independent UTF-16 code-unit order. */
function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Records scalar descriptor metadata without evaluating getters or retaining owners.
 * @param {PropertyDescriptor} descriptor - Descriptor observed on an actual public object.
 * @returns {object} JSON-compatible metadata, including accessor availability and callable arity.
 */
function describe(descriptor) {
  const result = { enumerable: descriptor.enumerable, configurable: descriptor.configurable };
  if ('get' in descriptor || 'set' in descriptor) return { ...result, kind: 'attribute',
    get: descriptor.get !== undefined, set: descriptor.set !== undefined };
  result.writable = descriptor.writable;
  result.valueType = typeof descriptor.value;
  if (typeof descriptor.value === 'function') return { ...result, kind: 'method',
    arity: Object.getOwnPropertyDescriptor(descriptor.value, 'length')?.value ?? null };
  if (!descriptor.writable && !descriptor.configurable) {
    if (descriptor.value === null || ['string', 'boolean'].includes(typeof descriptor.value)) result.value = descriptor.value;
    if (typeof descriptor.value === 'number') result.value = Number.isFinite(descriptor.value) ? descriptor.value : String(descriptor.value);
  }
  return { ...result, kind: 'value' };
}

/**
 * Enumerates exposed globals, class declarations, jsdom exports and unforgeable instance members.
 * Arbitrary dynamic names and externally inherited declarations require a separate semantic audit.
 * @param {string} packageRoot - Pinned independently installed reference package root.
 * @param {object} [options] - Optional owner observer used for finite release diagnostics.
 * @param {Function} [options.observeOwners] - Receives owners synchronously; it must avoid retaining them.
 * @returns {object} JSON-only API records, inheritance, aliases and explicit exclusions.
 */
function capturePublicSurface(packageRoot, options = {}) {
  const reference = require(packageRoot);
  const hostGlobals = new Set(Object.keys(JSON.parse(readFileSync(join(packageRoot, REFERENCE_GLOBALS_FILE), 'utf8'))));
  const apis = new Map(), constructors = [], exclusions = [], aliases = [], evaluatedExportGetters = [];
  const seenObjects = new WeakMap();
  let dom = new reference.JSDOM('', { url: SURFACE_DOCUMENT_URL });

  function record(owner, key, descriptor, origin) {
    const name = publicKey(key);
    if (name === null) return;
    const id = `${INVENTORY_ID_PREFIX.api}${owner}.${name}`;
    const entry = { id, owner, name, origin, ...describe(descriptor) };
    const previous = apis.get(id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error(`Inventory descriptor collision for ${id}`);
      return;
    }
    apis.set(id, entry);
  }

  function members(owner, value, origin, excluded = []) {
    if (seenObjects.has(value)) { aliases.push({ owner, target: seenObjects.get(value) }); return; }
    seenObjects.set(value, owner);
    for (const key of Reflect.ownKeys(value)) if (!excluded.includes(key)) record(owner, key, Object.getOwnPropertyDescriptor(value, key), origin);
  }

  function constructor(owner, value, origin) {
    if (seenObjects.has(value)) { aliases.push({ owner, target: seenObjects.get(value) }); return; }
    const prototype = Object.getOwnPropertyDescriptor(value, 'prototype')?.value;
    // Probe [[Construct]] using Object as target; never invoke the observed constructor.
    try { Reflect.construct(Object, [], value); }
    catch (error) { if (error instanceof TypeError) return; throw error; }
    const parent = Object.getPrototypeOf(prototype ?? value);
    const parentConstructor = parent && Object.getOwnPropertyDescriptor(parent, 'constructor')?.value;
    constructors.push({ name: owner, constructorId: `${INVENTORY_ID_PREFIX.api}${owner}`, inherits: typeof parentConstructor === 'function'
      ? Object.getOwnPropertyDescriptor(parentConstructor, 'name')?.value ?? null : null,
      prototypeAlias: prototype && seenObjects.get(prototype) || null });
    members(`${owner}.static`, value, origin, PUBLIC_FUNCTION_INTRINSIC_MEMBERS);
    if (prototype) members(`${owner}.prototype`, prototype, origin, ['constructor']);
  }

  function namespace(owner, value, origin) {
    if (seenObjects.has(value)) { aliases.push({ owner, target: seenObjects.get(value) }); return; }
    seenObjects.set(value, owner);
    for (const key of Reflect.ownKeys(value)) {
      const name = publicKey(key); if (name === null) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      record(owner, key, descriptor, origin);
      let exported = descriptor.value;
      if (origin === SURFACE_ORIGIN.packageExport && descriptor.get) {
        // Bundled CommonJS namespaces expose their public class bindings through getters.
        exported = Reflect.get(value, key);
        evaluatedExportGetters.push(`${owner}.${name}`);
      }
      if (typeof exported === 'function' && Object.getOwnPropertyDescriptor(exported, 'prototype')) constructor(`${owner}.${name}`, exported, origin);
      else if (exported && typeof exported === 'object') {
        const prototype = Object.getPrototypeOf(exported);
        if (prototype === Object.prototype || prototype === null) namespace(`${owner}.${name}`, exported, origin);
      }
    }
  }

  try {
    const window = dom.window;
    options.observeOwners?.(window, window.document);
    const descriptors = Object.getOwnPropertyDescriptors(window);
    for (const key of Reflect.ownKeys(descriptors)) {
      const name = publicKey(key);
      if (name === null || hostGlobals.has(name)) {
        exclusions.push({ name: typeof key === 'symbol' ? String(key) : key,
          reason: name === null ? SURFACE_EXCLUSION.privateHost : SURFACE_EXCLUSION.ecmascriptGlobal }); continue;
      }
      const descriptor = descriptors[key];
      record('Window', key, descriptor, SURFACE_ORIGIN.windowOwn);
      if (typeof descriptor.value === 'function' && Object.getOwnPropertyDescriptor(descriptor.value, 'prototype')) constructor(`Window.${name}`, descriptor.value, SURFACE_ORIGIN.windowConstructor);
    }
    members('Window.[[Prototype]]', Object.getPrototypeOf(window), SURFACE_ORIGIN.windowPrototype, ['constructor']);
    for (const probe of INSTANCE_SURFACE_PROBES) {
      const instance = probe.path.reduce((owner, name) => owner[name], window);
      members(`${probe.interface}.instance`, instance, SURFACE_ORIGIN.instance);
    }
    for (const name of WINDOW_NAMESPACE_PROBES) {
      const value = descriptors[name]?.value;
      if (value && typeof value === 'object') namespace(`Window.${name}`, value, SURFACE_ORIGIN.windowNamespace);
    }
    namespace('jsdom', reference, SURFACE_ORIGIN.packageExport);
    return { profile: { node: process.version, url: SURFACE_DOCUMENT_URL, runScripts: 'default',
      gettersEvaluated: 'Solo sondeos de instancias y getters de exports del paquete fijado; no se evalúan getters de prototipos DOM.', evaluatedExportGetters },
      apis: [...apis.values()].sort((left, right) => compareIdentifiers(left.id, right.id)),
      constructors: constructors.sort((left, right) => compareIdentifiers(left.name, right.name)), aliases, exclusions };
  } finally { dom.window.close(); dom = null; }
}

module.exports = { capturePublicSurface };
