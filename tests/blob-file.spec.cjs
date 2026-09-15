/** @file Differential Blob/File construction, typed views, FileReader, slicing and FormData contracts. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), reference: require('jsdom/package.json').version, cases: [] };

/** @param {Window} window - Actual realm. @param {Blob} blob - Public blob. @param {string} [method] - Reader operation. @returns {Promise<*>} Actual FileReader result. */
function read(window, blob, method = 'readAsArrayBuffer') {
  return new Promise((resolve, reject) => { const reader = new window.FileReader(); reader.onload = () => resolve(method === 'readAsArrayBuffer' ? [...new Uint8Array(reader.result)] : reader.result); reader.onerror = () => reject(reader.error); reader[method](blob); });
}
/** @param {Window} window - Realm. @param {string} kind - Blob or File. @param {unknown[]} parts - Input parts. @param {object} [options] - Public options. @returns {Blob} Actual construction. */
function construct(window, kind, parts, options = {}) { return kind === 'File' ? new window.File(parts, 'dir/name\0🦀', { lastModified: 42, ...options }) : new window.Blob(parts, options); }
/** @param {Window} window - Realm. @param {Blob} blob - Instance. @returns {Promise<object>} Public bytes and metadata. */
async function snapshot(window, blob) { return { size: blob.size, type: blob.type, name: blob.name ?? null, lastModified: blob.lastModified ?? null, tag: Object.prototype.toString.call(blob), bytes: await read(window, blob) }; }
/** @param {Function} action - Operation. @param {Window} window - Exception realm. @returns {Promise<*>} Result or error shape. */
async function capture(action, window) { try { return await action(); } catch (error) { return { name: error.name, message: error.message, typeError: error instanceof window.TypeError }; } }
/** @param {string} title - Contract. @param {string} kind - Constructor. @param {string} mode - Realm. @param {Function} scenario - Actual interactions. @returns {void} Register comparison. */
function compare(title, kind, mode, scenario) {
  test(`should ${title} for ${kind} in ${mode}`, async () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const { window } = new runtime.JSDOM('', { url: 'https://blob.example.test/', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
      try { results[engine] = await scenario(window); } finally { window.close(); }
    }
    report.cases.push({ title, kind, mode, expected: results.jsdom, actual: results.rustdom }); assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const kind of ['Blob', 'File']) for (const mode of ['default', 'vm']) {
  compare('copy mixed binary parts and preserve view offsets and USV text', kind, mode, async (window) => {
    const buffer = new window.ArrayBuffer(8); const bytes = new window.Uint8Array(buffer); bytes.set([1, 2, 3, 4, 5, 6, 7, 8]);
    const parts = [new window.Uint8Array(buffer, 1, 3), new window.DataView(buffer, 4, 2), new window.Blob(['nested']), 'a\0\ud800🦀'];
    const blob = construct(window, kind, parts, { type: 'TEXT/PLAIN; Charset=UTF-8' }); bytes.fill(9);
    return snapshot(window, blob);
  });
  compare('normalize MIME strings and line endings with the pinned Unix behavior', kind, mode, async (window) => {
    const result = [];
    for (const endings of ['transparent', 'native']) for (const type of ['', ' TEXT/PLAIN ', 'x/y;A=B', 'é', 'x\0y', 'x\ty', '\u007f', '🦀']) {
      result.push(await snapshot(window, construct(window, kind, ['a\r\nb\rc\nd', new window.Blob(['\r\n'])], { endings, type })));
    }
    return result;
  });
  compare('preserve slice ranges, types and Blob return identity', kind, mode, async (window) => {
    const blob = construct(window, kind, ['abcdef'], { type: 'TEXT/PLAIN' }); const results = [];
    for (const [start, end] of [[undefined, undefined], [1, 4], [-3, -1], [-100, 100], [4, 1], [Infinity, -Infinity], [NaN, NaN], [1.5, 4.5], [2 ** 63, undefined]]) {
      results.push(await snapshot(window, blob.slice(start, end, 'IMAGE/PNG')));
    }
    return { results, original: await snapshot(window, blob) };
  });
  compare('observe source mutations during later part conversion', kind, mode, async (window) => {
    const first = new window.Uint8Array([1, 2]); const second = new window.Uint8Array([3, 4]); const original = second.buffer; let armed = false; const trace = [];
    Object.defineProperty(second, 'buffer', { get() { if (armed) { first[0] = 9; trace.push('mutate'); } return original; } });
    const blob = construct(window, kind, [first, second], { get type() { armed = true; return ''; } });
    return { trace, blob: await snapshot(window, blob) };
  });
  compare('preserve errors when a later buffer getter detaches an earlier part', kind, mode, async (window) => {
    const first = new window.Uint8Array([1, 2]); const firstBuffer = first.buffer;
    const second = new window.Uint8Array([3, 4]); const secondBuffer = second.buffer; let armed = false; let detached = false;
    Object.defineProperty(second, 'buffer', { get() { if (armed && !detached) { structuredClone(firstBuffer, { transfer: [firstBuffer] }); detached = true; } return secondBuffer; } });
    return capture(async () => snapshot(window, construct(window, kind, [first, second], { get type() { armed = true; return ''; } })), window);
  });
  compare('preserve shared backing reached after public buffer getter conversion', kind, mode, async (window) => {
    const shared = new SharedArrayBuffer(4); new Uint8Array(shared).set([1, 2, 3, 4]);
    const view = new window.Uint8Array(shared); const ordinary = new window.ArrayBuffer(4); let armed = false;
    Object.defineProperty(view, 'buffer', { get() { return armed ? shared : ordinary; } });
    return capture(async () => snapshot(window, construct(window, kind, [view], { get type() { armed = true; return ''; } })), window);
  });
  compare('preserve conversion errors, primitive throws and public branding', kind, mode, async (window) => {
    const marker = { original: true }; let same = false;
    try { construct(window, kind, [{ toString() { throw marker; } }]); } catch (error) { same = error === marker; }
    const errors = [];
    for (const parts of [null, {}, [Symbol('part')], [new window.Uint8Array(new SharedArrayBuffer(4))]]) errors.push(await capture(() => construct(window, kind, parts), window));
    errors.push(await capture(() => construct(window, kind, [], { endings: 'invalid' }), window));
    errors.push(await capture(() => window.Blob.prototype.slice.call({}), window));
    return { same, errors };
  });
  compare('preserve FileReader text and data URLs and FormData filename conversion', kind, mode, async (window) => {
    const blob = construct(window, kind, ['hello\r\n🦀'], { type: 'TEXT/PLAIN', endings: 'native' });
    const form = new window.FormData(); form.append('file', blob, 'renamed.txt'); const file = form.get('file');
    return { text: await read(window, blob, 'readAsText'), url: await read(window, blob, 'readAsDataURL'), file: { name: file.name, type: file.type, size: file.size, bytes: await read(window, file), lastModified: kind === 'File' ? file.lastModified : typeof file.lastModified } };
  });
}

test('should preserve File name conversion and lastModified defaults in both engines', () => {
  for (const runtime of Object.values(runtimes)) {
    const { window } = new runtime.JSDOM();
    try {
      const before = Date.now(); const file = new window.File([], 'a\ud800/b'); const after = Date.now();
      assert.equal(file.name, 'a\ufffd/b'); assert.ok(file.lastModified >= before && file.lastModified <= after);
      assert.equal(new window.File([], 'name', { lastModified: NaN }).lastModified, 0);
      assert.equal(new window.File([], 'name', { lastModified: -1.9 }).lastModified, -1);
      assert.throws(() => new window.File([], 'name', { lastModified: 1n }), { name: 'TypeError' });
    } finally { window.close(); }
  }
});

after(() => { mkdirSync('reports/compatibility', { recursive: true }); writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-blob-file.json`, `${JSON.stringify(report, null, 2)}\n`); });
