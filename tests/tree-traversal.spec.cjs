/** @file Public traversal contracts, including live topology and callback conversion reentrancy. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), cases: [] };
const markup = '<main id="root"><a id="a">A<b id="b">B</b><i id="c">C</i></a><!--comment--><d id="d"><e id="e">E</e></d><f id="f">F</f></main>';
const walkerMethods = ['parentNode', 'firstChild', 'lastChild', 'previousSibling', 'nextSibling', 'previousNode', 'nextNode'];

/** @param {Node|null} node - Public node. @returns {string|null} Stable public identity across independent realms. */
function label(node) { return node === null ? null : node.id || `${node.nodeName}:${node.nodeValue ?? ''}`; }
/** @param {object} cursor - Public iterator/walker. @returns {object} Observable traversal position. */
function position(cursor) {
  return 'referenceNode' in cursor ? { reference: label(cursor.referenceNode), before: cursor.pointerBeforeReferenceNode } : { current: label(cursor.currentNode) };
}
/** @param {Function} operation - Public operation. @param {Window} window - Expected exception realm. @returns {*} Result or observable error. */
function attempt(operation, window) {
  try { return operation(); } catch (error) { return { error: error.name, message: error.message, code: error.code ?? null, domException: error instanceof window.DOMException }; }
}
/** @param {string} name - Contract description. @param {Function} scenario - Actual public DOM scenario. @returns {void} Registers a differential test. */
function compare(name, scenario) {
  test(`should ${name}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const { window } = new runtime.JSDOM(markup);
      try { results[engine] = scenario(window, window.document.getElementById('root')); }
      finally { window.close(); }
    }
    report.cases.push({ name, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const kind of ['NodeIterator', 'TreeWalker']) {
  for (const mask of [0, 1, 4, 128, 0xffffffff]) {
    for (const policy of ['none', 'accept', 'skip', 'reject', 'mixed', 'unusual']) {
      compare(`preserve ${kind} order and filter calls with mask ${mask} and ${policy}`, (window, root) => {
        const calls = [];
        const filter = policy === 'none' ? null : (node) => {
          calls.push(label(node));
          if (policy === 'accept') return 1;
          if (policy === 'skip') return 3;
          if (policy === 'reject') return 2;
          if (policy === 'unusual') return node.id === 'a' ? 0 : node.id === 'd' ? 65537 : 1;
          return node.id === 'a' ? 3 : node.id === 'd' ? 2 : 1;
        };
        const cursor = window.document[`create${kind}`](root, mask, filter);
        const trace = [];
        for (const method of ['nextNode', 'previousNode', 'nextNode']) {
          for (let index = 0; index < 40; index++) {
            const node = cursor[method](); trace.push([method, label(node), position(cursor)]);
            if (node === null) break;
            assert.ok(index < 39, 'finite tree traversal must terminate');
          }
        }
        if (kind === 'NodeIterator') { cursor.detach(); trace.push(['detached', label(cursor.previousNode()), position(cursor)]); }
        assert.equal(cursor.root, root); assert.equal(cursor.whatToShow, mask); assert.equal(cursor.filter, filter);
        return { trace, calls };
      });
    }
  }
  for (const rootKind of ['document', 'fragment', 'text', 'attribute', 'shadow']) {
    compare(`preserve ${kind} boundaries when the root is ${rootKind}`, (window, root) => {
      const document = window.document;
      if (rootKind === 'document') root = document;
      if (rootKind === 'fragment') { const fragment = document.createDocumentFragment(); fragment.append(root); root = fragment; }
      if (rootKind === 'text') root = root.firstChild.firstChild;
      if (rootKind === 'attribute') root = root.getAttributeNode('id');
      if (rootKind === 'shadow') { const shadow = root.attachShadow({ mode: 'open' }); shadow.innerHTML = '<slot></slot><i>shadow</i>'; root = shadow; }
      const cursor = document[`create${kind}`](root); const nodes = [];
      for (let index = 0; index < 50; index++) { const node = cursor.nextNode(); if (!node) break; nodes.push(label(node)); assert.ok(index < 49); }
      return { nodes, position: position(cursor) };
    });
  }
  for (const behavior of ['throw', 'recursive', 'valueOf', 'conversionThrow', 'objectFilter']) {
    compare(`preserve ${kind} callback state when filtering uses ${behavior}`, (window, root) => {
      const trace = []; let cursor; let first = true;
      const callback = (node) => {
        trace.push(['filter', label(node), position(cursor)]);
        if (!first) return 1;
        first = false;
        if (behavior === 'throw') throw new window.DOMException('filter failed', 'AbortError');
        if (behavior === 'recursive') trace.push(['nested', attempt(() => label(cursor.nextNode()), window)]);
        if (behavior === 'conversionThrow') return Symbol('not numeric');
        if (behavior === 'valueOf') return { valueOf() { trace.push(['conversion', attempt(() => label(cursor.nextNode()), window), position(cursor)]); return 65537; } };
        return 1;
      };
      const filter = behavior === 'objectFilter' ? { acceptNode(node) { trace.push(['this', this === filter]); return callback(node); } } : callback;
      cursor = window.document[`create${kind}`](root, 0xffffffff, filter);
      for (let index = 0; index < 3; index++) trace.push(['result', attempt(() => label(cursor.nextNode()), window), position(cursor)]);
      return trace;
    });
  }
  for (const mutation of ['removeCandidate', 'removeParent', 'appendChild', 'replaceChildren', 'adopt', 'removeRoot']) {
    compare(`preserve ${kind} live traversal when the filter performs ${mutation}`, (window, root) => {
      const trace = []; let changed = false;
      const cursor = window.document[`create${kind}`](root, 1, (node) => {
        trace.push(['filter', label(node)]);
        if (!changed && node.id === 'a') {
          changed = true;
          if (mutation === 'removeCandidate') node.remove();
          if (mutation === 'removeParent') node.parentNode.remove();
          if (mutation === 'appendChild') { const child = window.document.createElement('added'); node.append(child); }
          if (mutation === 'replaceChildren') node.replaceChildren(window.document.createElement('replacement'));
          if (mutation === 'adopt') window.document.implementation.createHTMLDocument().adoptNode(node);
          if (mutation === 'removeRoot') root.remove();
          return 3;
        }
        return 1;
      });
      for (let index = 0; index < 25; index++) { const node = cursor.nextNode(); trace.push(['result', label(node), position(cursor)]); if (!node) break; assert.ok(index < 24); }
      return { trace, tree: root.outerHTML };
    });
  }
}

for (const method of walkerMethods) {
  for (const start of ['root', 'a', 'b', 'e', 'f', 'outside']) {
    compare(`preserve TreeWalker ${method} from ${start} with skipped and rejected ancestors`, (window, root) => {
      const calls = []; const walker = window.document.createTreeWalker(root, 1, (node) => { calls.push(label(node)); return node.id === 'a' ? 3 : node.id === 'd' ? 2 : 1; });
      walker.currentNode = start === 'outside' ? window.document.body : window.document.getElementById(start);
      const trace = [];
      for (let index = 0; index < 15; index++) { const node = walker[method](); trace.push([label(node), position(walker)]); if (!node) break; assert.ok(index < 14); }
      return { trace, calls };
    });
  }
  compare(`preserve TreeWalker ${method} when filters change currentNode and topology`, (window, root) => {
    let first = true; const trace = [];
    const walker = window.document.createTreeWalker(root, 1, (node) => {
      trace.push(['filter', label(node)]);
      if (first) { first = false; walker.currentNode = window.document.getElementById('d'); node.append(window.document.createElement('added')); return 3; }
      return 1;
    });
    walker.currentNode = window.document.getElementById(method.includes('previous') || method === 'lastChild' ? 'f' : 'a');
    for (let index = 0; index < 3; index++) trace.push(['result', label(walker[method]()), position(walker)]);
    return trace;
  });
}

for (const removed of ['a', 'b', 'd', 'root']) {
  for (const before of [false, true]) {
    compare(`repair NodeIterator position when removing ${removed} with pointerBefore ${before}`, (window, root) => {
      const iterator = window.document.createNodeIterator(root, 1);
      let reachedReference = false;
      for (let index = 0; index < 20; index++) {
        if (iterator.nextNode()?.id === 'b') { reachedReference = true; break; }
      }
      assert.equal(reachedReference, true, 'the iterator must reach the internal reference node');
      if (before) iterator.previousNode();
      window.document.getElementById(removed).remove();
      const trace = [position(iterator)];
      for (const method of ['nextNode', 'previousNode', 'previousNode', 'nextNode']) trace.push([method, label(iterator[method]()), position(iterator)]);
      return trace;
    });
  }
}

compare('allow recursive TreeWalker calls that encounter no filter candidate', (window, root) => {
  let walker; const trace = [];
  walker = window.document.createTreeWalker(root, 1, () => { trace.push(label(walker.parentNode())); return 1; });
  assert.equal(walker.nextNode().id, 'a'); assert.deepEqual(trace, [null]);
  return { trace, position: position(walker) };
});

for (let seed = 1; seed <= 48; seed++) {
  compare(`preserve mixed TreeWalker navigation and conversions for seed ${seed}`, (window, root) => {
    let randomState = seed;
    const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState; };
    const nodes = [root, ...root.querySelectorAll('*'), window.document.body];
    const decisions = nodes.map(() => [0, 1, 2, 3, 4, 65537, -65535][random() % 7]);
    const calls = [];
    const walker = window.document.createTreeWalker(root, 1, (node) => { calls.push(label(node)); return decisions[nodes.indexOf(node)] ?? 3; });
    const trace = [];
    for (let index = 0; index < 80; index++) {
      if (index % 5 === 0) walker.currentNode = nodes[random() % nodes.length];
      const method = walkerMethods[random() % walkerMethods.length];
      trace.push([method, label(walker[method]()), position(walker)]);
    }
    return { decisions, trace, calls };
  });
}

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-tree-traversal.json`, `${JSON.stringify(report, null, 2)}\n`);
});
