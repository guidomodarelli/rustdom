/** @file Deterministic live collection streams with namespaces, UTF-16, canonical Attr writes and document adoption. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const namespaces = [null, HTML_NAMESPACE, 'urn:x', 'urn:\ud800', 'urn:🦀'];
const classes = ['', 'a', 'A', 'a b', 'b a a', '\t\n\f\r ', '\ud800', '\udc00', '\0', 'é', 'É', 'K', 'k', '🦀', 'a\vb', '__proto__'];
const queries = classes.map((value) => ['class', value]).concat(
  ['*', 'div', 'DIV', 'p:MiXeD', 'p:mixed', 'P:MIXED', 'MiXeD', 'entry', '🦀', ''].map((value) => ['tag', value]),
  ['*', '', ...namespaces].flatMap((namespace) => ['*', 'div', 'MiXeD', 'entry', '🦀'].map((name) => ['namespace', namespace, name])),
);
const RANDOM_SEED = 0x15948219;
const ELEMENT_COUNT = 50;
const MUTATION_COUNT = 80;
const report = { capturedAt: new Date().toISOString(), node: process.version,
  reference: require('jsdom/package.json').version, seed: RANDOM_SEED, queries, elementCount: ELEMENT_COUNT,
  mutationCount: MUTATION_COUNT, cases: [] };

/** @param {Element} root - Real collection root. @param {unknown[]} query - Public query arguments. @returns {HTMLCollection} Live platform collection. */
function select(root, query) {
  return query[0] === 'class' ? root.getElementsByClassName(query[1])
    : query[0] === 'tag' ? root.getElementsByTagName(query[1]) : root.getElementsByTagNameNS(query[1], query[2]);
}

/** @param {object} runtime - Independent real engine. @param {string} mode - Initial parsing/quirks mode. @returns {string[][]} Complete ordered public results after every state transition. */
function observe(runtime, mode) {
  let seed = RANDOM_SEED;
  /** @param {number} limit - Exclusive bound. @returns {number} Deterministic xorshift choice shared by both engines. */
  const random = (limit) => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % limit; };
  const owners = [
    new runtime.JSDOM(mode === 'xml' ? '<root/>' : `${mode === 'html' ? '<!doctype html>' : ''}<body>`,
      mode === 'xml' ? { contentType: 'application/xml' } : {}),
    new runtime.JSDOM('<root/>', { contentType: 'application/xml' }),
    new runtime.JSDOM('<body>'), new runtime.JSDOM('<!doctype html><body>'),
  ];
  try {
    const document = owners[0].window.document;
    const root = document.createElementNS(HTML_NAMESPACE, 'main');
    (document.body || document.documentElement).append(root);
    const nodes = [];
    for (let index = 0; index < ELEMENT_COUNT; index++) {
      const namespace = namespaces[random(namespaces.length)];
      const name = ['div', 'p:MiXeD', 'entry', 'x:entry'][random(4)];
      const element = document.createElementNS(namespace, namespace ? name : name.slice(name.lastIndexOf(':') + 1));
      element.setAttribute('data-id', String(index)); element.setAttribute('class', classes[random(classes.length)]);
      nodes.push(element);
      (index && random(3) === 0 ? nodes[random(nodes.length - 1)] : root).append(element);
    }
    const held = queries.map((query) => select(root, query));
    const states = [];
    /** @returns {void} Preserve held and newly requested memberships without keeping additional DOM owners. */
    const capture = () => {
      for (const kind of ['held', 'fresh']) queries.forEach((query, index) => {
        states.push(Array.from(kind === 'held' ? held[index] : select(root, query), (element) => element.getAttribute('data-id')));
      });
    };
    capture();
    for (let step = 0; step < MUTATION_COUNT; step++) {
      const element = nodes[random(nodes.length)];
      switch (step % 8) {
        case 0: element.setAttribute('class', classes[random(classes.length)]); break;
        case 1: root.append(element); break;
        case 2: element.classList.add('b'); break;
        case 3: element.removeAttribute('class'); break;
        case 4: element.setAttributeNS('urn:x', 'p:class', 'A'); break;
        case 5: {
          const attribute = element.ownerDocument.createAttribute('class'); attribute.value = classes[random(classes.length)];
          element.setAttributeNode(attribute); break;
        }
        case 6: {
          const target = owners[random(owners.length)].window.document;
          (target.body || target.documentElement).append(target.adoptNode(root)); break;
        }
        case 7: {
          const attribute = element.getAttributeNodeNS(null, 'class');
          if (attribute) attribute.value = classes[random(classes.length)];
          break;
        }
      }
      capture();
    }
    return states;
  } finally { for (const owner of owners) owner.window.close(); }
}

for (const mode of ['html', 'quirks', 'xml']) {
  test(`should preserve held and fresh collection results across deterministic ${mode} mutations and adoptions`, () => {
    const expected = observe(runtimes.jsdom, mode); const actual = observe(runtimes.rustdom, mode);
    assert.equal(actual.length, expected.length);
    for (const [index, result] of expected.entries()) {
      const state = Math.floor(index / (queries.length * 2));
      const kind = Math.floor(index / queries.length) % 2 === 0 ? 'held' : 'fresh';
      const query = queries[index % queries.length];
      assert.deepEqual(actual[index], result, `${mode} state=${state} kind=${kind} query=${JSON.stringify(query)}`);
    }
    report.cases.push({ mode, comparisons: expected.length, expected, actual });
  });
}

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-collection-query-fuzz.json`, `${JSON.stringify(report, null, 2)}\n`);
});
