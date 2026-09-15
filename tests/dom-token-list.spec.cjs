/** @file DOMTokenList behavior through actual elements, attribute mutations and runner-compatible wrappers. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const families = [
  ['div', 'classList', 'class'], ['a', 'relList', 'rel'], ['area', 'relList', 'rel'],
  ['link', 'relList', 'rel'], ['output', 'htmlFor', 'for'], ['svg', 'classList', 'class'], ['xml', 'classList', 'class'],
];
const report = { capturedAt: new Date().toISOString(), cases: [] };

/** @param {Function} action - Public operation. @param {Window} window - Error realm. @returns {unknown} Value or observable failure. */
function capture(action, window) {
  try { const value = action(); return value === undefined ? { returnedUndefined: true } : value; }
  catch (error) { return { error: error.name, message: error.message, code: error.code ?? null, domException: error instanceof window.DOMException }; }
}
/** @param {Element} element - Actual owner. @param {DOMTokenList} list - Public list. @param {string} attribute - Reflected attribute. @returns {object} Public values and indexed contract. */
function snapshot(element, list, attribute) {
  return { attribute: element.getAttribute(attribute), value: list.value, string: String(list), length: list.length,
    tokens: [...list], entries: [...list.entries()], keys: [...list.keys()], ownKeys: Object.keys(list),
    first: list.item(0), last: list.item(list.length - 1), beyond: list.item(list.length), zero: list[0] ?? null };
}
/** @param {string} name - Scenario. @param {string[]} family - Element/list/attribute. @param {Function} scenario - Public interactions. @returns {void} Registers a differential contract. */
function compare(name, family, scenario) {
  test(`should ${name} for ${family[0]}.${family[1]}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const xml = family[0] === 'xml'; const { window } = new runtime.JSDOM(xml ? '<r/>' : '<!doctype html><body>', xml ? { contentType: 'text/xml' } : {});
      try {
        const element = xml ? window.document.documentElement : family[0] === 'svg' ? window.document.createElementNS('http://www.w3.org/2000/svg', 'g') : window.document.createElement(family[0]);
        if (!xml) window.document.body.append(element);
        const list = element[family[1]]; assert.equal(list instanceof window.DOMTokenList, true);
        results[engine] = scenario(window, element, list, family[2]);
        assert.equal(element[family[1]], list);
      } finally { window.close(); }
    }
    report.cases.push({ name, family, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const family of families) {
  for (const initial of [null, '', ' a  b a\tb ', 'a\nb\fc\rd', 'a\vb\u00a0c', 'x\0y \ud800 \udfff 🦀']) {
    compare(`preserve token order and normalization from ${JSON.stringify(initial)}`, family, (window, element, list, attribute) => {
      if (initial !== null) element.setAttribute(attribute, initial);
      const observer = new window.MutationObserver(() => {}); observer.observe(element, { attributes: true, attributeOldValue: true });
      const trace = [snapshot(element, list, attribute)];
      for (const [method, args] of [['add', []], ['add', ['a', 'c', 'a']], ['remove', ['b', 'missing']], ['toggle', ['a', true]], ['toggle', ['c', false]], ['replace', ['a', 'z']], ['replace', ['missing', 'z']]]) {
        const result = capture(() => list[method](...args), window);
        trace.push({ method, result, state: snapshot(element, list, attribute), records: observer.takeRecords().map((record) => [record.attributeName, record.oldValue]) });
      }
      observer.disconnect(); return trace;
    });
  }
  for (const [method, args] of [
    ['add', ['bad space', '']], ['add', ['', 'bad space']], ['remove', ['bad space', '']],
    ['replace', ['bad space', '']], ['replace', ['', 'bad space']], ['replace', ['a', 'bad\tspace']],
    ['toggle', ['']], ['toggle', ['bad\nspace']], ['contains', ['']], ['contains', ['bad space']],
    ['supports', ['']], ['supports', ['STYLESHEET']], ['supports', ['stylesheet']], ['supports', ['ſtylesheet']], ['supports', ['bad space']],
  ]) {
    compare(`preserve validation and writes for ${method}${JSON.stringify(args)}`, family, (window, element, list, attribute) => {
      element.setAttribute(attribute, ' a  b '); const observer = new window.MutationObserver(() => {}); observer.observe(element, { attributes: true, attributeOldValue: true });
      const result = capture(() => list[method](...args), window);
      const records = observer.takeRecords().map((record) => record.oldValue); observer.disconnect();
      return { result, records, state: snapshot(element, list, attribute) };
    });
  }
  compare('synchronize external attribute changes without mutating previously returned arrays', family, (window, element, list, attribute) => {
    element.setAttribute(attribute, 'one two'); const previous = [...list]; const trace = [snapshot(element, list, attribute)];
    element.getAttributeNode(attribute).value = ' three three four '; trace.push(snapshot(element, list, attribute));
    element.removeAttribute(attribute); trace.push(snapshot(element, list, attribute));
    list.value = 'new new final'; trace.push(snapshot(element, list, attribute));
    const copy = element.cloneNode(true); list.add('original');
    return { previous, trace, cloned: [...copy[family[1]]], original: [...list] };
  });
  compare('preserve live iteration when callbacks and callers mutate the attribute', family, (window, element, list, attribute) => {
    list.value = 'a b c'; const iterator = list.values(); const trace = [iterator.next()];
    element.setAttribute(attribute, 'x y z w'); trace.push(iterator.next()); list.remove('x'); trace.push(iterator.next(), iterator.next());
    list.value = 'a b c'; const visited = [];
    list.forEach((value, index, owner) => { visited.push([value, index, owner === list]); if (index === 0) list.remove('b'); });
    return { trace, visited, state: snapshot(element, list, attribute) };
  });
  compare('convert all arguments before validation and observe reentrant conversion changes', family, (window, element, list, attribute) => {
    const trace = []; const first = { toString() { trace.push('first'); element.setAttribute(attribute, 'converted'); return 'bad space'; } };
    const second = { toString() { trace.push('second'); list.add('during'); return ''; } };
    const result = capture(() => list.add(first, second), window);
    return { trace, result, state: snapshot(element, list, attribute) };
  });
}

for (const initial of ['a b c', 'b a c', 'a c', 'b c', ' a a b b ']) {
  compare(`preserve replacement position for ${JSON.stringify(initial)}`, families[0], (window, element, list, attribute) => {
    element.setAttribute(attribute, initial); const result = list.replace('a', 'b');
    return { result, state: snapshot(element, list, attribute) };
  });
}
compare('distinguish qualified-name presence from a null-namespace attribute value', families[0], (window, element, list, attribute) => {
  element.setAttributeNS('urn:foreign', attribute, 'foreign'); list.add();
  return { state: snapshot(element, list, attribute), attributes: [...element.attributes].map((entry) => [entry.name, entry.namespaceURI, entry.value]) };
});
compare('preserve item index conversion and strict indexed assignments', families[0], (window, element, list) => {
  list.value = 'a b'; const results = [-1, 0, 1, 2, 2 ** 32, NaN, Infinity].map((index) => [String(index), list.item(index)]);
  results.push(capture(() => { list[0] = 'changed'; }, window)); return { results, values: [...list] };
});

after(() => { mkdirSync('reports/compatibility', { recursive: true }); writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-dom-token-list.json`, `${JSON.stringify(report, null, 2)}\n`); });
