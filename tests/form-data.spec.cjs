/** @file Differential FormData entry, iterator, coercion, File and form-construction contracts. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), reference: require('jsdom/package.json').version, scope: 'Public FormData contracts with native entry operations and construction control; WebIDL, realm factories and field helpers remain host integrations', cases: [] };
/** @param {FormData} data - Actual form data. @returns {Array} Realm-independent public snapshot. */
function entries(data) { return Array.from(data, ([name, value]) => [name, typeof value === 'string' ? value : { name: value.name, size: value.size, type: value.type }]); }
/** @param {object} wrapper - Real jsdom/rustdom wrapper. @returns {object} Actual implementation for reentrant behavior probes. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }
/** @param {Function} action - Actual operation. @param {Window} window - Realm. @returns {object|null} Observable exception. */
function failure(action, window) { try { action(); return null; } catch (error) { return { name: error.name, message: error.message, realm: error instanceof window.TypeError || error instanceof window.DOMException }; } }
/** @param {string} name - Contract. @param {string} mode - Realm selection. @param {Function} scenario - Actual operations. @returns {void} Register independent-engine comparison. */
function compare(name, mode, scenario) {
  test(`should ${name} in ${mode}`, async () => {
    const observed = {};
    for (const [engine, runtime] of Object.entries(engines)) {
      const dom = new runtime.JSDOM('', { url: 'https://form.example.test/', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
      try { observed[engine] = await scenario(dom.window, runtime); } finally { dom.window.close(); }
    }
    report.cases.push({ name, mode, expected: observed.jsdom, actual: observed.rustdom }); assert.deepEqual(observed.rustdom, observed.jsdom);
  });
}
for (const mode of ['default', 'vm']) {
  for (const brokenStage of ['iterator', 'result']) {
    compare(`preserve invalid iterator-result errors during construction at ${brokenStage}`, mode, (window) => {
      window.document.body.innerHTML = '<form><input name="field" value="value"></form>';
      const form = window.document.querySelector('form');
      implementation(form)._getSubmittableElementNodes = () => ({ [Symbol.iterator]() { return brokenStage === 'iterator' ? 3 : { next() { return null; } }; } });
      return failure(() => new window.FormData(form), window);
    });
  }
  compare('preserve captured serializer arrays and private iterator generations across mutations', mode, (window) => {
    const data = new window.FormData(); data.append('a', 'first'); data.append('b', 'middle'); data.append('a', 'last');
    const internal = implementation(data); const firstView = internal._entries; const keptEntry = firstView[1];
    const iterator = internal[Symbol.iterator](); const first = iterator.next().value;
    data.append('tail', 'tail'); data.set('a', 'replaced');
    const afterSet = internal._entries; const remaining = Array.from(iterator);
    data.delete('missing'); const afterMissingDelete = internal._entries; data.delete('b');
    return { first, remaining, firstView: firstView.map((entry) => [entry.name, entry.value]),
      afterSet: afterSet.map((entry) => [entry.name, entry.value]), current: entries(data),
      replacedArray: firstView !== afterSet, copiedOnMissing: afterMissingDelete !== afterSet,
      keptEntryIdentity: afterSet[1] === keptEntry, keys: Object.keys(afterSet[0]) };
  });
  compare('consume the live real FileList when selection changes during item access', mode, (window) => {
    window.document.body.innerHTML = '<form><input type="file" name="files" multiple></form>';
    const form = window.document.querySelector('form'); const list = implementation(form.elements[0].files);
    const first = new window.File(['one'], 'one', { lastModified: 1 }); const second = new window.File(['two'], 'two', { lastModified: 2 });
    list.push(implementation(first)); const item = list.item; const trace = [];
    list.item = function (index) { trace.push(index); if (index === 0) list.push(implementation(second)); return item.call(this, index); };
    const data = new window.FormData(form);
    assert.equal(data.getAll('files')[0], first); assert.equal(data.getAll('files')[1], second);
    return { trace, values: entries(data) };
  });
  compare('preserve lazy field reads and live control values during form construction', mode, (window) => {
    window.document.body.innerHTML = '<form><input name="skip" disabled><input name="check" type="checkbox"><input name="first" value="one"><input name="second" value="two"></form>';
    const form = window.document.querySelector('form'); const fields = Array.from(form.elements, implementation); const trace = [];
    for (const [index, field] of fields.entries()) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'type');
      Object.defineProperty(field, 'type', { configurable: true, get() { trace.push([index, 'type']); return descriptor.get.call(this); } });
      const getAttribute = field.getAttributeNS; field.getAttributeNS = function (namespace, name) { trace.push([index, name]); return getAttribute.call(this, namespace, name); };
      const getValue = field._getValue; field._getValue = function () { trace.push([index, 'value']); if (index === 2) form.elements[3].value = 'changed'; return getValue.call(this); };
    }
    const values = entries(new window.FormData(form));
    assert.deepEqual(values, [['first', 'one'], ['second', 'changed']]);
    assert.ok(!trace.some(([index, operation]) => index < 2 && operation === 'value'));
    return { values, trace };
  });
  for (const failureStage of ['body', 'next']) {
    compare(`preserve primitive failures and IteratorClose precedence at ${failureStage}`, mode, (window) => {
      window.document.body.innerHTML = '<form><input name="first" value="one"></form>';
      const form = window.document.querySelector('form'); const field = implementation(form.elements[0]); const trace = [];
      const marker = Symbol('original'); const closing = { closing: true };
      field._getValue = () => { trace.push('value'); throw marker; };
      implementation(form)._getSubmittableElementNodes = () => ({
        [Symbol.iterator]() { trace.push('iterator'); return this; },
        next() { trace.push('next'); if (failureStage === 'next') throw marker; return { value: field, done: false }; },
        return() { trace.push('return'); throw closing; },
      });
      let same = false;
      try { new window.FormData(form); } catch (error) { same = error === marker; }
      assert.equal(same, true); assert.equal(trace.includes('return'), failureStage === 'body');
      return { same, trace };
    });
  }
  compare('preserve USV conversion errors from a live field value', mode, (window) => {
    window.document.body.innerHTML = '<form><input name="field"></form>';
    const form = window.document.querySelector('form'); implementation(form.elements[0])._getValue = () => Symbol('value');
    return failure(() => new window.FormData(form), window);
  });
  compare('preserve duplicate order and replace only the first entry position', mode, (window) => {
    const data = new window.FormData(); data.append('a', 'first'); data.append('b', 'middle'); data.append('a', 'last');
    const before = entries(data); const all = Array.from(data.getAll('a')); data.set('a', 'replaced'); const set = entries(data);
    data.delete('a'); data.append('a', 'new'); return { before, all, set, after: entries(data), missing: data.get('missing'), has: data.has('a') };
  });
  compare('convert names and values to USV strings without normalizing line endings', mode, (window) => {
    const data = new window.FormData();
    for (const [name, value] of [['', ''], ['\ud800', '\udfff'], ['a\0b', 'a\r\nb\rc'], ['🦀', '€'], [null, undefined], [123, false]]) data.append(name, value);
    return { entries: entries(data), surrogate: data.get('\ud800'), all: Array.from(data.getAll('\ufffd')), absent: data.has('other') };
  });
  for (const operation of ['delete', 'set', 'append']) {
    compare(`preserve live public iterators across ${operation} and extension after done`, mode, (window) => {
      const data = new window.FormData(); data.append('a', '1'); data.append('b', '2'); data.append('a', '3');
      const iterator = data.entries(); const trace = [JSON.parse(JSON.stringify(iterator.next()))];
      if (operation === 'delete') data.delete('a'); else data[operation]('a', 'changed');
      for (let turn = 0; turn < 5; turn++) trace.push(JSON.parse(JSON.stringify(iterator.next())));
      data.append('tail', 'resumed'); trace.push(JSON.parse(JSON.stringify(iterator.next())));
      return { trace, final: entries(data) };
    });
  }
  compare('observe mutations and thisArg during forEach callbacks', mode, (window) => {
    const data = new window.FormData(); data.append('a', '1'); data.append('b', '2'); data.append('a', '3'); const context = {}; const trace = [];
    data.forEach(function (value, name, owner) { trace.push([name, value, this === context, owner === data]); if (trace.length === 1) { data.delete('a'); data.append('c', '4'); } }, context);
    return { trace, final: entries(data) };
  });
  compare('preserve conversion order and mutations performed during coercion', mode, (window) => {
    const data = new window.FormData(); const trace = [];
    data.append({ toString() { trace.push('name'); data.append('side', 'name'); return 'key'; } }, { toString() { trace.push('value'); data.append('side', 'value'); return 'converted'; } });
    const symbol = failure(() => data.append(Symbol('bad'), 'value'), window);
    const invalidOverload = failure(() => data.append('key', 'text', 'filename'), window);
    return { trace, entries: entries(data), symbol, invalidOverload };
  });
  compare('preserve File identity, filename copies and Blob conversion metadata', mode, (window) => {
    const data = new window.FormData(); const file = new window.File(['abc'], 'original', { type: 'text/plain', lastModified: 42 });
    data.append('original', file); data.append('renamed', file, 'other'); data.append('blob', new window.Blob(['bytes'], { type: 'image/png' }));
    return { entries: entries(data), original: data.get('original') === file, renamed: data.get('renamed') === file,
      renamedTime: data.get('renamed').lastModified, allIdentity: data.getAll('original')[0] === file, blobIsFile: data.get('blob') instanceof window.File };
  });
  compare('retain foreign File realms when constructing filename copies', mode, (window, runtime) => {
    const foreign = new runtime.JSDOM('', { runScripts: 'outside-only' });
    try {
      const data = new window.FormData(); const file = new foreign.window.File(['abc'], 'foreign', { lastModified: 42 });
      data.append('same', file); data.append('copy', file, 'copy'); data.append('blob', new foreign.window.Blob(['xyz']));
      return { entries: entries(data), same: data.get('same') === file, foreignCopy: data.get('copy') instanceof foreign.window.File,
        localCopy: data.get('copy') instanceof window.File, foreignBlob: data.get('blob') instanceof foreign.window.File };
    } finally { foreign.window.close(); }
  });
  compare('construct successful controls with disabled, checked, select and dirname rules', mode, (window) => {
    window.document.body.innerHTML = '<form id="form"><input name="text" value="hello" dirname="direction"><input name="disabled" disabled value="omit"><input name="check" type="checkbox" checked><input name="unchecked" type="checkbox"><input name="radio" type="radio" checked value="selected"><input name="radio" type="radio" value="other"><select name="choice" multiple><option selected value="first">One</option><option selected disabled value="second">Two</option></select><textarea name="area">a\nb</textarea><input name="empty" type="file"><fieldset disabled><legend><input name="legend" value="keep"></legend><input name="fieldset" value="omit"></fieldset><datalist><input name="suggestion" value="omit"></datalist><button name="button" value="pressed">Send</button></form><input name="external" value="attached" form="form">';
    const form = window.document.querySelector('form'); const button = form.querySelector('button');
    return { default: entries(new window.FormData(form)), submitted: entries(new window.FormData(form, button)) };
  });
  compare('preserve image submit coordinates and submitter validation precedence', mode, (window) => {
    window.document.body.innerHTML = '<form id="first"><input name="image" type="image"><input name="text"><button>Send</button></form><form id="second"><button>Other</button></form>';
    const form = window.document.querySelector('#first'); const image = form.querySelector('[type=image]');
    return { image: entries(new window.FormData(form, image)), wrongType: failure(() => new window.FormData(form, form.querySelector('[name=text]')), window),
      foreignForm: failure(() => new window.FormData(form, window.document.querySelector('#second button')), window),
      invalidForm: failure(() => new window.FormData({}), window), missingForm: failure(() => new window.FormData(undefined, image), window) };
  });
  compare('reject incompatible receivers and preserve symbol argument errors', mode, (window) => {
    const data = new window.FormData(); const errors = [];
    for (const method of ['append', 'set', 'delete', 'get', 'getAll', 'has', 'entries', 'keys', 'values', 'forEach']) errors.push(failure(() => window.FormData.prototype[method].call({}, 'name', 'value'), window));
    for (const method of ['delete', 'get', 'getAll', 'has']) errors.push(failure(() => data[method](Symbol('name')), window));
    return errors;
  });
}
after(() => writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-form-data.json`, `${JSON.stringify(report, null, 2)}\n`));
