/** @file Compares real replacement constraints, identities, ranges and reactions with independent jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const { PARENT_KINDS, CANDIDATE_KINDS, parentFixture, candidateFixture, shape } = require('./helpers/node-constraints.cjs');

/** @param {object} engine - Real runtime. @returns {object[]} Replacements with new candidates and existing identities. */
function inspectReplacements(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main>'); const observations = [];
  try {
    for (const parentKind of PARENT_KINDS) {
      for (const candidateKind of [...CANDIDATE_KINDS, 'same-child', 'next-sibling', 'previous-sibling']) {
        for (const referenceKind of ['first', 'last', 'foreign']) {
          const parent = parentFixture(dom.window.document, parentKind);
          const oldChild = (referenceKind === 'first' ? parent.firstChild : referenceKind === 'last' ? parent.lastChild : null)
            || dom.window.document.createComment('missing');
          const existing = candidateKind === 'same-child' || candidateKind.endsWith('-sibling');
          if (existing && oldChild.parentNode !== parent) continue;
          const candidate = candidateKind === 'same-child' ? oldChild
            : candidateKind === 'next-sibling' ? oldChild.nextSibling
              : candidateKind === 'previous-sibling' ? oldChild.previousSibling : candidateFixture(dom.window.document, candidateKind);
          if (!candidate) continue;
          const before = [...parent.childNodes]; const owner = candidate.ownerDocument; const previousParent = candidate.parentNode;
          const identities = new Map();
          /** @param {Node|null} node - Observed identity. @returns {number|null} Stable local identity without serializing wrappers. */
          function identity(node) { if (!node) return null; if (!identities.has(node)) identities.set(node, identities.size); return identities.get(node); }
          before.forEach(identity); [...candidate.childNodes].forEach(identity); identity(oldChild); identity(candidate); identity(parent);
          const observer = new dom.window.MutationObserver(() => {}); observer.observe(parent, { childList: true });
          let failure = null; let replaced;
          try { replaced = parent.replaceChild(candidate, oldChild); }
          catch (error) { failure = { name: error.name, message: error.message, code: error.code, realm: error instanceof dom.window.DOMException }; }
          const records = observer.takeRecords(); observer.disconnect();
          if (failure) {
            assert.equal(parent.childNodes.length, before.length);
            for (const [index, child] of before.entries()) assert.equal(parent.childNodes[index], child);
            assert.equal(candidate.ownerDocument, owner); assert.equal(candidate.parentNode, previousParent); assert.equal(records.length, 0);
          } else assert.equal(replaced, oldChild);
          observations.push({ parentKind, candidateKind, referenceKind, failure,
            children: [...parent.childNodes].map((child) => ({ id: identity(child), ...shape(child) })),
            candidateChildren: [...candidate.childNodes].map((child) => ({ id: identity(child), ...shape(child) })),
            attached: candidate.parentNode === parent, oldAttached: oldChild.parentNode === parent, adopted: candidate.ownerDocument !== owner,
            records: records.map((record) => ({ type: record.type, added: [...record.addedNodes].map(identity),
              removed: [...record.removedNodes].map(identity), previous: identity(record.previousSibling), next: identity(record.nextSibling) })) });
        }
      }
    }
    return observations;
  } finally { dom.window.close(); }
}

test('should preserve replacement outcomes and exact identities for new, same and sibling candidates', (context) => {
  const expected = inspectReplacements(engines.jsdom);
  assert.deepEqual(inspectReplacements(engines.rustdom), expected);
  context.diagnostic(`Compared ${expected.length} real replacement scenarios`);
});

test('should preserve live range endpoints and observer ordering when replacement moves or reuses nodes', () => {
  const inspect = (engine) => {
    const dom = new engine.JSDOM('<!doctype html><body></body>'); const observations = [];
    try {
      for (const operation of ['same', 'next-sibling', 'previous-sibling', 'fragment']) {
        const document = dom.window.document; const root = document.createElement('main');
        root.innerHTML = '<span>first</span><b>second</b>tail'; document.body.append(root);
        const nodes = [root, ...root.childNodes, root.firstChild.firstChild, root.childNodes[1].firstChild];
        const live = document.createRange(); live.setStart(nodes[4], 1); live.setEnd(nodes[5], 2);
        const parentRange = document.createRange(); parentRange.setStart(root, 1); parentRange.setEnd(root, 3);
        const observer = new dom.window.MutationObserver(() => {}); observer.observe(root, { childList: true });
        let oldChild = nodes[1]; let candidate = nodes[1];
        if (operation === 'next-sibling') candidate = nodes[2];
        if (operation === 'previous-sibling') oldChild = nodes[3];
        if (operation === 'fragment') { candidate = document.createDocumentFragment(); candidate.append(document.createElement('i'), 'new'); }
        assert.equal(root.replaceChild(candidate, oldChild), oldChild);
        const records = observer.takeRecords(); observer.disconnect();
        const describeRange = (range) => [nodes.indexOf(range.startContainer), range.startOffset, nodes.indexOf(range.endContainer), range.endOffset];
        observations.push({ operation, html: root.innerHTML, ranges: [describeRange(live), describeRange(parentRange)],
          records: records.map((record) => ({ added: [...record.addedNodes].map(shape), removed: [...record.removedNodes].map(shape),
            previous: record.previousSibling && shape(record.previousSibling), next: record.nextSibling && shape(record.nextSibling) })) });
        root.remove();
      }
      return observations;
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should permit reentrant connected reactions after validation and preserve the receiver error realm', () => {
  const inspect = (engine) => {
    const dom = new engine.JSDOM('<!doctype html><main><span>old</span></main>');
    const foreign = new engine.JSDOM('<aside></aside>');
    try {
      const document = dom.window.document; const parent = document.querySelector('main'); const oldChild = parent.firstChild;
      assert.throws(() => parent.replaceChild(foreign.window.document, foreign.window.document.querySelector('aside')), (error) => {
        assert.equal(error.name, 'NotFoundError'); assert.ok(error instanceof dom.window.DOMException);
        assert.equal(error instanceof foreign.window.DOMException, false); return true;
      });
      assert.throws(() => parent.replaceChild(document.createElement('i'), null), { name: 'TypeError' });
      /** Mutates both the candidate and parent through real connected reactions. */
      class ReplacementTarget extends dom.window.HTMLElement {
        connectedCallback() { this.append('inside'); parent.append(document.createComment('after')); }
      }
      dom.window.customElements.define('replacement-target', ReplacementTarget);
      const candidate = document.createElement('replacement-target');
      const observer = new dom.window.MutationObserver(() => {}); observer.observe(parent, { childList: true, subtree: true });
      assert.equal(parent.replaceChild(candidate, oldChild), oldChild);
      const records = observer.takeRecords(); observer.disconnect();
      return { html: parent.innerHTML, oldDetached: oldChild.parentNode === null,
        records: records.map((record) => ({ target: record.target.nodeName, added: [...record.addedNodes].map(shape), removed: [...record.removedNodes].map(shape) })) };
    } finally { dom.window.close(); foreign.window.close(); }
  };
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should distinguish native replacement from insertion and reject absent child handles without mutation', () => {
  const { NativeTree, NodeInsertionStatus } = require('../dist/native.cjs'); const tree = new NativeTree();
  const document = tree.allocate(); tree.setData(document, '{"kind":9}');
  const oldChild = tree.allocate(); tree.setHtmlElement(oldChild, 'root', []); tree.append(document, oldChild);
  const candidate = tree.allocate(); tree.setHtmlElement(candidate, 'next', []); const before = tree.statistics();
  assert.equal(tree.preInsertConstraints(document, candidate, oldChild), NodeInsertionStatus.InvalidDocumentStructure);
  assert.equal(tree.preReplaceConstraints(document, candidate, oldChild), NodeInsertionStatus.Ready);
  assert.equal(tree.preReplaceConstraints(document, oldChild, oldChild), NodeInsertionStatus.Ready);
  assert.deepEqual(tree.statistics(), before);
  const reserved = tree.reserveHandles(); const allocated = tree.statistics();
  for (const invalid of [0, -1, NaN, Infinity, 0.5, reserved]) {
    assert.throws(() => tree.preReplaceConstraints(invalid, candidate, oldChild), { code: 'InvalidArg' });
    assert.throws(() => tree.preReplaceConstraints(document, invalid, oldChild), { code: 'InvalidArg' });
    assert.throws(() => tree.preReplaceConstraints(document, candidate, invalid), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), allocated);
  for (const node of [oldChild, candidate, document]) tree.release(node); assert.equal(tree.statistics().liveNodes, 0);
});
