/** @file Differential Selection contracts with actual native control and shared Range objects. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), reference: require('jsdom/package.json').version, scope: 'Native Selection control with GC-visible Range ownership and host realm/event factories', cases: [] };
/** @param {Node|null} node - Public boundary node. @returns {string|null} Stable fixture identity. */
function label(node) { return node === null ? null : node.id || `${node.nodeName}:${node.textContent}`; }
/** @param {Selection} selection - Actual public selection. @returns {object} Observable state. */
function state(selection) { return { anchor: label(selection.anchorNode), anchorOffset: selection.anchorOffset, focus: label(selection.focusNode), focusOffset: selection.focusOffset, count: selection.rangeCount, collapsed: selection.isCollapsed, type: selection.type, text: String(selection) }; }
/** @param {Function} action - Public operation. @param {Window} window - Realm. @returns {object|null} Error identity metadata. */
function error(action, window) { try { action(); return null; } catch (caughtError) { return { name: caughtError.name, message: caughtError.message, realm: caughtError instanceof window.DOMException || caughtError instanceof window.TypeError }; } }
/** @param {string} name - Contract. @param {string} mode - Realm mode. @param {Function} scenario - Real interactions. @returns {void} Register oracle comparison. */
function compare(name, mode, scenario) {
  test(`should ${name} in ${mode}`, async () => {
    const observed = {};
    for (const [engine, runtime] of Object.entries(engines)) {
      const dom = new runtime.JSDOM('<!doctype html><main><p id="a">ab🦀cd</p><p id="b">efghi</p></main>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
      try { const window = dom.window; const selection = window.getSelection(); observed[engine] = await scenario(window, selection, window.document.querySelector('#a').firstChild, window.document.querySelector('#b').firstChild); }
      finally { dom.window.close(); }
    }
    report.cases.push({ name, mode, expected: observed.jsdom, actual: observed.rustdom }); assert.deepEqual(observed.rustdom, observed.jsdom);
  });
}
for (const mode of ['default', 'vm']) {
  compare('preserve thrown host values and nested Selection calls across the native boundary', mode, (window, selection, first) => {
    selection.collapse(first, 1); const wrapper = selection.getRangeAt(0);
    const range = wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
    const original = range.toString; const observations = [];
    try {
      for (const marker of [undefined, null, false, 42, 'failure', Symbol('failure'), { reason: 'failure' }]) {
        range.toString = () => { observations.push(selection.anchorOffset); throw marker; };
        let caught = false; try { String(selection); } catch (caughtError) { caught = Object.is(caughtError, marker); }
        observations.push(caught);
      }
    } finally { range.toString = original; }
    return { observations, after: state(selection) };
  });
  compare('preserve conversion order, reentrant changes and primitive conversion exceptions', mode, (window, selection, first, second) => {
    const calls = [];
    const anchorOffset = { valueOf() { calls.push('anchor'); selection.collapse(first, 2); return 1; } };
    const focusOffset = { valueOf() { calls.push('focus'); selection.removeAllRanges(); return 3; } };
    selection.setBaseAndExtent(first, anchorOffset, second, focusOffset);
    const selected = state(selection); const previous = selection.getRangeAt(0); const thrown = [];
    for (const marker of [undefined, null, false, 42, 'failure', Symbol('failure'), { reason: 'failure' }]) {
      let caught = false;
      try { selection.collapse(first, { valueOf() { throw marker; } }); }
      catch (caughtError) { caught = Object.is(caughtError, marker); }
      thrown.push(caught);
    }
    return { calls, selected, thrown, unchanged: previous === selection.getRangeAt(0), after: state(selection) };
  });
  compare('preserve shadow roots, detached selected ranges and document adoption', mode, (window, selection, first) => {
    const host = window.document.createElement('div'); window.document.body.append(host);
    const shadow = host.attachShadow({ mode: 'closed' }); shadow.innerHTML = '<p>shadow</p>';
    const shadowText = shadow.firstChild.firstChild; selection.collapse(first, 1); const states = [state(selection)];
    selection.collapse(shadowText, 2); selection.extend(shadowText, 3); states.push(state(selection));
    const range = selection.getRangeAt(0); const disconnected = window.document.createTextNode('detached');
    range.setStart(disconnected, 1); range.setEnd(disconnected, 4); states.push(state(selection));
    const detachedExtensionError = error(() => selection.extend(first, 2), window); states.push(state(selection));
    selection.removeAllRanges(); selection.collapse(first, 2);
    const other = window.document.implementation.createHTMLDocument(); other.adoptNode(first.parentNode);
    states.push(state(selection)); return { states, detachedExtensionError };
  });
  compare('preserve empty state, aliases and empty-selection errors', mode, (window, selection) => {
    const before = state(selection); const errors = [error(() => selection.getRangeAt(0), window), error(() => selection.collapseToStart(), window), error(() => selection.collapseToEnd(), window)];
    selection.empty(); selection.removeAllRanges(); selection.collapse(null); return { before, errors, after: state(selection), identity: selection === window.document.getSelection() };
  });
  compare('share the added Range and observe later boundary and text mutations', mode, (window, selection, first, second) => {
    const range = window.document.createRange(); range.setStart(first, 1); range.setEnd(second, 2); selection.addRange(range);
    const same = selection.getRangeAt(0) === range; const initial = state(selection); range.setStart(first, 4); first.insertData(0, 'X');
    const updated = state(selection); const ignored = window.document.createRange(); ignored.selectNodeContents(second); selection.addRange(ignored);
    return { same, initial, updated, afterSecondAdd: state(selection), sameAfter: selection.getRangeAt(0) === range };
  });
  compare('preserve forward and backward extension across UTF16 boundaries', mode, (window, selection, first, second) => {
    selection.collapse(second, 3); const states = [state(selection)]; selection.extend(first, 2); states.push(state(selection)); selection.extend(second, 5); states.push(state(selection)); selection.setPosition(first, 4); states.push(state(selection)); return states;
  });
  compare('replace rather than mutate Range identity when collapsing to an endpoint', mode, (window, selection, first, second) => {
    selection.setBaseAndExtent(second, 4, first, 1); const initial = selection.getRangeAt(0); const before = state(selection);
    selection.collapseToStart(); const changed = selection.getRangeAt(0) !== initial; const start = state(selection);
    selection.setBaseAndExtent(first, 0, second, 4); const next = selection.getRangeAt(0); selection.collapseToEnd();
    return { before, start, end: state(selection), changed, changedEnd: selection.getRangeAt(0) !== next, oldStart: initial.startOffset, oldEnd: initial.endOffset };
  });
  compare('preserve node containment and document deletion effects', mode, (window, selection, first, second) => {
    selection.setBaseAndExtent(first, 1, second, 2); const root = window.document.querySelector('main');
    const contains = [root, first, second, first.parentNode, second.parentNode].map((node) => [selection.containsNode(node), selection.containsNode(node, true)]);
    selection.deleteFromDocument(); return { contains, selection: state(selection), html: root.innerHTML };
  });
  compare('ignore foreign and disconnected roots while preserving error precedence', mode, (window, selection, first) => {
    const detached = window.document.createTextNode('outside'); const other = window.document.implementation.createHTMLDocument('other'); const foreign = other.body.appendChild(other.createTextNode('foreign'));
    const errors = [error(() => selection.extend(detached, 99), window), error(() => selection.collapse(detached, 99), window), error(() => selection.setBaseAndExtent(detached, 99, first, 0), window)];
    selection.collapse(first, 1); const before = state(selection); selection.collapse(foreign, 2); selection.extend(foreign, 999); selection.selectAllChildren(other.body);
    return { errors, before, after: state(selection) };
  });
  compare('reject DocumentType and incorrect Range removals without losing state', mode, (window, selection, first) => {
    selection.collapse(first, 1); const range = selection.getRangeAt(0); const copy = range.cloneRange();
    const errors = [error(() => selection.collapse(window.document.doctype, 0), window), error(() => selection.selectAllChildren(window.document.doctype), window), error(() => selection.removeRange(copy), window), error(() => selection.getRangeAt(1), window)];
    const kept = selection.getRangeAt(0) === range; selection.removeRange(range); return { errors, kept, final: state(selection) };
  });
  compare('preserve selectionchange scheduling and no-op range association', mode, async (window, selection, first, second) => {
    const events = []; window.document.addEventListener('selectionchange', (event) => events.push({ target: event.target === window.document, bubbles: event.bubbles, state: state(selection) }));
    selection.collapse(first, 1); selection.collapse(first, 1); selection.extend(second, 2); const immediate = events.length; selection.removeAllRanges(); selection.removeAllRanges();
    await new Promise((resolve) => setTimeout(resolve, 20)); return { immediate, events, final: state(selection) };
  });
}
after(() => writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-selection.json`, `${JSON.stringify(report, null, 2)}\n`));
