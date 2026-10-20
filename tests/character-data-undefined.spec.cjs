/** @file Compares CharacterData reached through real DOMParser recovery, including non-string wholeText addition. */
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const jsdom = require('jsdom');
const rustdom = require('../dist/index.cjs');

/**
 * Reach an undefined Text payload through the reference's actual XML recovery path.
 * @param {object} runtime - Real DOM implementation.
 * @param {string} mode - Default or isolated VM realm.
 * @returns {object} Window owner and recovered document, element and Text.
 */
function recoveredText(runtime, mode) {
  const dom = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  try {
    const parser = new dom.window.DOMParser();
    const owner = parser[Object.getOwnPropertySymbols(parser).find((symbol) => symbol.description === 'impl')];
    const createDocument = owner.createScriptingDisabledDocument;
    let calls = 0;
    owner.createScriptingDisabledDocument = function (...args) {
      if (++calls === 1) throw 42;
      return Reflect.apply(createDocument, this, args);
    };
    const document = parser.parseFromString('<root/>', 'text/xml');
    const root = document.documentElement;
    assert.equal(root.firstChild.data, undefined);
    return { dom, document, root, text: root.firstChild };
  } catch (error) {
    dom.window.close();
    throw error;
  }
}

/**
 * Observe a public operation and its exception without retaining the DOM after teardown.
 * @param {object} runtime - Real DOM implementation.
 * @param {string} mode - Realm mode.
 * @param {Function} operation - Observable operation on fresh recovery state.
 * @returns {object} Value or original exception contract.
 */
function observe(runtime, mode, operation) {
  const state = recoveredText(runtime, mode);
  try {
    return { value: operation(state) };
  } catch (error) {
    return { error: { name: error.name, message: error.message, code: error.code,
      hostTypeError: error instanceof TypeError, realmTypeError: error instanceof state.dom.window.TypeError } };
  } finally {
    state.dom.window.close();
  }
}

describe('CharacterData created by XML error recovery', () => {
  const operations = {
    data: ({ text }) => text.data,
    nodeValue: ({ text }) => text.nodeValue,
    textContent: ({ text }) => text.textContent,
    parentText: ({ root }) => root.textContent,
    wholeText: ({ text }) => text.wholeText,
    length: ({ text }) => text.length,
    substring: ({ text }) => text.substringData(0, 0),
    append: ({ text }) => text.appendData('x'),
    setData: ({ text }) => { text.data = 'x'; return text.data; },
    setNodeValue: ({ text }) => { text.nodeValue = 'x'; return text.nodeValue; },
    clone: ({ text }) => { const clone = text.cloneNode(); return { data: clone.data, same: text.isEqualNode(clone) }; },
    equalEmpty: ({ text, document }) => text.isEqualNode(document.createTextNode('')),
    normalize: ({ root }) => root.normalize(),
    xmlSerialize: ({ root }) => root.outerHTML,
    matchesEmpty: ({ root }) => root.matches(':empty'),
    rangeSelect: ({ text, document }) => { const range = document.createRange(); range.selectNodeContents(text); return range.toString(); },
    htmlSerialize: ({ text, dom }) => { dom.window.document.body.append(text); return dom.window.document.body.innerHTML; },
    rawHtmlSerialize: ({ text, dom }) => {
      const script = dom.window.document.createElement('script');
      script.append(text);
      return script.outerHTML;
    },
  };
  for (const mode of ['default', 'vm']) {
    for (const method of ['toString', 'cloneContents', 'extractContents', 'deleteContents', 'isPointInRange', 'comparePoint']) {
      test(`should preserve Range.${method} errors after selecting undefined Text in ${mode}`, () => {
        const operation = ({ text, document }) => {
          const range = document.createRange();
          range.selectNode(text);
          return method === 'isPointInRange' || method === 'comparePoint' ? range[method](text, 0) : range[method]();
        };
        assert.deepEqual(observe(rustdom, mode, operation), observe(jsdom, mode, operation));
      });
    }
    for (const subject of ['root', 'first', 'last']) {
      test(`should preserve partial normalize mutations on ${subject} with an undefined sibling in ${mode}`, () => {
        const operation = ({ text, document, root, dom }) => {
          root.prepend(document.createTextNode('a'));
          root.append(document.createTextNode('b'));
          const observer = new dom.window.MutationObserver(() => {});
          observer.observe(root, { subtree: true, characterData: true, characterDataOldValue: true, childList: true });
          let failure;
          try { (subject === 'root' ? root : subject === 'first' ? root.firstChild : root.lastChild).normalize(); }
          catch (error) { failure = { name: error.name, message: error.message, code: error.code }; }
          const records = observer.takeRecords().map((record) => ({ type: record.type, oldValue: record.oldValue,
            removed: [...record.removedNodes].map((node) => node.data) }));
          observer.disconnect();
          return { failure, values: [...root.childNodes].map((node) => node.data), undefinedAttached: text.parentNode === root, records };
        };
        assert.deepEqual(observe(rustdom, mode, operation), observe(jsdom, mode, operation));
      });
    }
    for (const [name, operation] of Object.entries(operations)) {
      test(`should preserve ${name} when XML recovery produces undefined data in ${mode}`, () => {
        // Arrange and act: exercise the same public operation against independent implementations.
        const expected = observe(jsdom, mode, operation);
        const actual = observe(rustdom, mode, operation);
        // Assert: retain values, exception classes, diagnostics and realms.
        assert.deepEqual(actual, expected);
      });
    }
    for (const first of [undefined, '', 'a']) for (const second of [undefined, '', 'b']) for (const third of [undefined, '', 'c']) {
      const values = [first, second, third];
      test(`should preserve wholeText addition for ${values.map(String).join('/')} in ${mode}`, () => {
        for (let subject = 0; subject < values.length; subject++) {
          const operation = ({ text, document }) => {
            const parent = document.createElement('group');
            const children = values.map((value) => value === undefined ? text.cloneNode() : document.createTextNode(value));
            parent.append(...children);
            return children[subject].wholeText;
          };
          assert.deepEqual(observe(rustdom, mode, operation), observe(jsdom, mode, operation));
        }
      });
    }
  }
});
