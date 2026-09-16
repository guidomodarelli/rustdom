/** @file Exercises genuine FormData host values and typed-ID projection without substituting the implementation. */
'use strict';
const { resolve } = require('node:path');
const { JSDOM } = require(process.argv[2] === 'jsdom' ? 'jsdom' : resolve(process.argv[4] ?? 'dist', 'index.cjs'));
const mode = process.argv[3] ?? 'default';
const HostString = String;
const originalString = Object.getOwnPropertyDescriptor(globalThis, 'String');
const object = { marker: 'name' }, otherObject = { marker: 'other' };
function named() {} function otherFunction() {}
const symbol = Symbol('name');
const records = [
  ['object', object, otherObject], ['function', named, otherFunction], ['symbol', symbol, Symbol('name')],
  ['undefined', undefined, null], ['null', null, undefined], ['false', false, true], ['true', true, false],
  ['zero', 0, -0], ['negative-zero', -0, 0], ['nan', NaN, NaN], ['number', 17, 18], ['bigint', 17n, 18n], ['string', '1', 'other'],
];
const valueKinds = [
  ['object', { marker: 'opaque value' }], ['function', function opaqueValue() {}], ['symbol', Symbol('opaque value')],
  ['undefined', undefined], ['null', null], ['false', false], ['true', true], ['zero', 0], ['negative-zero', -0],
  ['nan', NaN], ['number', 17], ['bigint', 17n], ['string', 'text'], ['surrogate', '\ud800'],
];
for (const [label, value] of valueKinds) records.push([`value-${label}`, 'stable', 'other', value]);
const output = [];
/** @param {object} wrapper - Genuine wrapper. @returns {object} Existing private implementation. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((key) => key.description === 'impl')]; }
for (const record of records) for (const globals of ['host', 'window', 'both']) {
  const [label, name, alternate] = record;
  const dom = new JSDOM('<form><input name="key" value="value"></form>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const windowString = Object.getOwnPropertyDescriptor(dom.window, 'String');
  const form = dom.window.document.querySelector('form');
  const value = record.length === 4 ? record[3] : { marker: 'value', document: dom.window.document };
  let selectedName = name, selectedValue = value;
  let conversions = 0;
  /** @param {unknown} input - Real WebIDL/construction conversion input. @returns {object} Consumer-controlled well-formed conversion. */
  function replacement(input) { return { toWellFormed() { conversions++; return input === 'key' || input === 'query' ? selectedName : selectedValue; } }; }
  /** @param {unknown} item - Observed value. @returns {unknown} Stable identity/primitive encoding. */
  function encode(item) {
    if ((typeof value === 'object' && value !== null || typeof value === 'function' || typeof value === 'symbol') && item === value) return { identity: 'value' };
    if (typeof item === 'object' && item !== null) return { identity: item === name ? 'name' : item === alternate ? 'alternate' : 'other' };
    if (typeof item === 'function') return { identity: item === name ? 'name-function' : 'other-function' };
    if (typeof item === 'symbol') return { identity: item === name ? 'name-symbol' : 'other-symbol' };
    if (typeof item === 'number') return Object.is(item, -0) ? { number: '-0' } : Number.isNaN(item) ? { number: 'NaN' } : item;
    if (typeof item === 'bigint') return { bigint: HostString(item) };
    if (item === undefined) return { primitive: 'undefined' };
    return item;
  }
  const row = { label, globals, mode };
  try {
    if (globals !== 'window') globalThis.String = replacement;
    if (globals !== 'host') dom.window.String = replacement;
    const data = new dom.window.FormData(form);
    const entries = () => Array.from(data, (pair) => pair.map(encode));
    row.initial = entries(); row.has = data.has('query'); row.get = encode(data.get('query')); row.all = data.getAll('query').map(encode);
    const visited = []; data.forEach((item, key) => visited.push([encode(key), encode(item)])); row.forEach = visited;
    selectedName = alternate; row.alternateHas = data.has('query');
    selectedName = name; data.append('query', 'value'); row.appended = entries();
    data.set('query', 'value'); row.replaced = entries();
    selectedName = '1'; selectedValue = 'literal'; data.append('query', 'value');
    selectedName = name; row.hostAfterLiteral = data.getAll('query').map(encode);
    selectedName = '1'; row.literal = data.getAll('query').map(encode);
    selectedName = name; data.delete('query'); row.deleted = entries();
    row.view = implementation(data)._entries.map((entry) => [encode(entry.name), encode(entry.value)]);
  } catch (error) { row.error = { name: error.name, message: error.message }; }
  finally {
    row.conversions = conversions;
    Object.defineProperty(globalThis, 'String', originalString);
    if (windowString) Object.defineProperty(dom.window, 'String', windowString); else delete dom.window.String;
    dom.window.close();
  }
  output.push(row);
}
const dom = new JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
const data = new dom.window.FormData(); data.append('key', 'a'); data.append('key', 'b');
const descriptor = Object.getOwnPropertyDescriptor(Float64Array.prototype, Symbol.iterator);
let typedReads = 0;
const typed = { mode, label: 'typed-iterator' };
try {
  Object.defineProperty(Float64Array.prototype, Symbol.iterator, { configurable: true, get() { typedReads++; throw new Error('typed iterator must not run'); } });
  typed.all = data.getAll('key'); typed.view = implementation(data)._entries.map((entry) => [entry.name, entry.value]);
} catch (error) { typed.error = { name: error.name, message: error.message }; }
finally {
  if (descriptor) Object.defineProperty(Float64Array.prototype, Symbol.iterator, descriptor); else delete Float64Array.prototype[Symbol.iterator];
  dom.window.close();
}
typed.reads = typedReads; output.push(typed);
for (const mutation of ['array-index-setter', 'typed-length-getter']) {
  const owned = new JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const values = new owned.window.FormData();
  const target = mutation === 'array-index-setter' ? Array.prototype : Float64Array.prototype;
  const key = mutation === 'array-index-setter' ? '0' : 'length';
  const before = Object.getOwnPropertyDescriptor(target, key);
  let calls = 0; let all; let view; let error; let armed = false;
  if (mutation === 'array-index-setter') {
    const projected = new Proxy({ marker: 'projected value' }, { get(object, property, receiver) {
      if (armed && typeof property === 'symbol') {
        armed = false;
        Object.defineProperty(Array.prototype, '0', { configurable: true, set() { calls++; throw new Error('inherited index setter must not run'); } });
      }
      return Reflect.get(object, property, receiver);
    } });
    const string = Object.getOwnPropertyDescriptor(owned.window, 'String');
    try {
      owned.window.String = (input) => ({ toWellFormed: () => input === 'key' ? 'key' : projected });
      values.append('key', 'value');
    } finally { if (string) Object.defineProperty(owned.window, 'String', string); else delete owned.window.String; }
    armed = true;
  } else { values.append('key', 'a'); values.append('key', 'b'); }
  try {
    // The setter is installed by a real value getter after WebIDL has built its argument array.
    if (mutation === 'typed-length-getter') Object.defineProperty(target, key, { configurable: true, get() { calls++; throw new Error('typed length getter must not run'); } });
    all = values.getAll('key'); view = implementation(values)._entries;
  } catch (caught) { error = { name: caught.name, message: caught.message }; }
  finally { if (before) Object.defineProperty(target, key, before); else delete target[key]; owned.window.close(); }
  output.push({ mode, label: mutation, calls, all, view: view?.map((entry) => [entry.name, entry.value]), error });
}
process.stdout.write(JSON.stringify(output) + '\n');
