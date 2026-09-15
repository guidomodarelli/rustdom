/** @file Differential FileReader output, state transitions, abort and reentrant event contracts. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), reference: require('jsdom/package.json').version, cases: [] };
const EVENTS = ['loadstart', 'progress', 'load', 'abort', 'error', 'loadend'];

/** @param {FileReader} reader - Actual public reader. @param {Window} window - Result realm. @returns {object} Public state without retaining DOM objects. */
function state(reader, window) {
  const value = reader.result;
  return { readyState: reader.readyState, error: reader.error?.name ?? null,
    result: value !== null && typeof value === 'object' ? [...new Uint8Array(value)] : value,
    arrayBufferRealm: value !== null && typeof value === 'object' ? value instanceof window.ArrayBuffer : null };
}
/** @returns {Promise<void>} Drain the bounded chains of real immediate callbacks used by these scenarios. */
async function settle() { for (let turn = 0; turn < 8; turn++) await new Promise((resolve) => setImmediate(resolve)); }
/** @param {Function} action - Public operation. @param {Window} window - Exception realm. @returns {*} Result or exception metadata. */
function capture(action, window) { try { action(); return null; } catch (error) { return { name: error.name, message: error.message, realm: error instanceof window.DOMException || error instanceof window.TypeError }; } }
/** @param {string} title - Contract. @param {string} mode - Realm mode. @param {Function} scenario - Actual interactions. @returns {void} Register comparison. */
function compare(title, mode, scenario) {
  test(`should ${title} in ${mode}`, async () => {
    const results = {};
    for (const [name, runtime] of Object.entries(engines)) {
      const { window } = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
      try {
        const reader = new window.FileReader(); const trace = [];
        for (const type of EVENTS) reader.addEventListener(type, (event) => trace.push({ type, ...state(reader, window), total: event.total, loaded: event.loaded, lengthComputable: event.lengthComputable, target: event.target === reader }));
        const extra = await scenario(window, reader, trace); await settle(); results[name] = { trace, state: state(reader, window), extra };
      } finally { window.close(); }
    }
    report.cases.push({ title, mode, expected: results.jsdom, actual: results.rustdom }); assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const mode of ['default', 'vm']) {
  for (const method of ['readAsArrayBuffer', 'readAsBinaryString', 'readAsDataURL', 'readAsText']) {
    compare(`read nonempty bytes with ${method} and preserve old result during a later read`, mode, async (window, reader) => {
      reader[method](new window.Blob([new Uint8Array([65, 0, 128, 255])], { type: 'TEXT/PLAIN; CHARSET=UTF-8' }));
      const immediate = state(reader, window); await settle(); const first = state(reader, window);
      reader[method](new window.Blob(['second'])); const nextImmediate = state(reader, window); await settle();
      reader.abort(); return { immediate, first, nextImmediate, abortedDone: state(reader, window) };
    });
    compare(`read empty content with ${method}`, mode, (window, reader) => { reader[method](new window.Blob()); });
  }
  for (const stage of ['before', 'loadstart', 'progress', 'load', 'loadend']) {
    compare(`preserve abort at ${stage}`, mode, (window, reader) => {
      const file = new window.File(['content'], 'name', { type: 'text/plain', lastModified: 42 });
      if (stage !== 'before') reader.addEventListener(stage, () => reader.abort(), { once: true });
      reader.readAsText(file); if (stage === 'before') reader.abort();
      return state(reader, window);
    });
  }
  for (const stage of ['abort', 'loadstart', 'progress', 'load', 'loadend']) {
    compare(`preserve reentrant read from ${stage}`, mode, (window, reader) => {
      const results = [];
      reader.addEventListener(stage, () => { if (stage === 'loadstart' || stage === 'progress') reader.abort(); results.push(capture(() => reader.readAsText(new window.Blob(['second'])), window)); }, { once: true });
      reader.readAsText(new window.Blob(['first'])); if (stage === 'abort') reader.abort(); return results;
    });
  }
  compare('preserve invalid reads, public branding and empty abort', mode, (window, reader) => {
    reader.abort(); const empty = state(reader, window); const blob = new window.Blob(['value']); reader.readAsText(blob);
    return { empty, loading: capture(() => reader.readAsArrayBuffer(blob), window), invalid: capture(() => reader.readAsText({}), window),
      missing: capture(() => reader.readAsText(), window), symbolLabel: capture(() => reader.readAsText(blob, Symbol('bad')), window),
      branding: capture(() => window.FileReader.prototype.abort.call({}), window) };
  });
  for (const label of ['utf-8', 'utf-16', 'utf-16be', 'windows-1252', 'iso-8859-2', 'shift_jis', 'gb18030', 'x-user-defined', 'replacement', 'unknown label']) {
    compare(`decode malformed bytes and BOM with label ${label}`, mode, async (window, reader) => {
      const results = [];
      for (const bytes of [[0x80, 0xff, 0xc3, 0x28, 0], [0xff, 0xfe, 0, 0xd8, 0xff], [0xef, 0xbb, 0xbf, 0x41], [0xfe, 0xff, 0, 0x41]]) {
        reader.readAsText(new window.Blob([new Uint8Array(bytes)]), label); await settle(); results.push(state(reader, window));
      }
      return results;
    });
  }
}

after(() => { mkdirSync('reports/compatibility', { recursive: true }); writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-file-reader.json`, `${JSON.stringify(report, null, 2)}\n`); });
