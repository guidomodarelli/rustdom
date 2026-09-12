/** @file Compares public insertion constraints, errors, adoption and mutation effects with independent jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const { PARENT_KINDS, CANDIDATE_KINDS, parentFixture, candidateFixture, shape } = require('./helpers/node-constraints.cjs');

/** @param {object} engine - Real runtime. @returns {object[]} Differential outcomes for every receiver/candidate/reference combination. */
function inspectInsertions(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main>'); const observations = [];
  try {
    for (const parentKind of PARENT_KINDS) {
      for (const candidateKind of CANDIDATE_KINDS) {
        for (const referenceKind of ['append', 'owned', 'last-owned', 'foreign']) {
          const parent = parentFixture(dom.window.document, parentKind);
          const candidate = candidateFixture(dom.window.document, candidateKind);
          const reference = referenceKind === 'owned' ? parent.firstChild
            : referenceKind === 'last-owned' ? parent.lastChild
              : referenceKind === 'foreign' ? dom.window.document.createComment('foreign') : null;
          const before = [...parent.childNodes]; const owner = candidate.ownerDocument;
          const observer = new dom.window.MutationObserver(() => {}); observer.observe(parent, { childList: true });
          let failure = null;
          let inserted;
          try { inserted = parent.insertBefore(candidate, reference); }
          catch (error) { failure = { name: error.name, message: error.message, code: error.code, realm: error instanceof dom.window.DOMException }; }
          const records = observer.takeRecords(); observer.disconnect();
          if (failure) {
            assert.equal(parent.childNodes.length, before.length);
            for (const [index, child] of before.entries()) assert.equal(parent.childNodes[index], child);
            assert.equal(candidate.ownerDocument, owner); assert.equal(records.length, 0);
          } else assert.equal(inserted, candidate);
          observations.push({ parentKind, candidateKind, referenceKind, failure,
            children: [...parent.childNodes].map(shape), candidateChildren: [...candidate.childNodes].map(shape),
            attached: candidate.parentNode === parent, adopted: candidate.ownerDocument !== owner,
            preserved: before.map((child) => [...parent.childNodes].indexOf(child)),
            records: records.map((record) => ({ type: record.type, added: [...record.addedNodes].map(shape), removed: [...record.removedNodes].map(shape) })) });
        }
      }
    }
    return observations;
  } finally { dom.window.close(); }
}

test('should preserve insertion results, errors and untouched state across all parent/node/reference combinations', () => {
  assert.deepEqual(inspectInsertions(engines.rustdom), inspectInsertions(engines.jsdom));
});

test('should preserve host-cycle precedence for shadow roots and template contents', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<main></main><template><section></section></template>');
    try {
      const document = dom.window.document; const host = document.querySelector('main');
      const root = host.attachShadow({ mode: 'closed' }); const descendant = root.appendChild(document.createElement('div'));
      const foreign = document.createComment('foreign');
      assert.throws(() => descendant.insertBefore(host, foreign), { name: 'HierarchyRequestError', message: 'The operation would yield an incorrect node tree.' });
      const template = document.querySelector('template');
      assert.throws(() => template.content.firstChild.appendChild(template), { name: 'HierarchyRequestError' });
      assert.equal(descendant.parentNode, root); assert.equal(host.parentNode, document.body);
      assert.equal(template.parentNode, document.body);
    } finally { dom.window.close(); }
  }
});

test('should preserve the receiver exception realm and public argument conversion', () => {
  for (const engine of Object.values(engines)) {
    const first = new engine.JSDOM('<main></main>'); const second = new engine.JSDOM('<aside></aside>');
    try {
      const parent = first.window.document.querySelector('main'); const foreign = second.window.document.querySelector('aside');
      assert.throws(() => parent.insertBefore(second.window.document, foreign), (error) => {
        assert.equal(error.name, 'NotFoundError'); assert.ok(error instanceof first.window.DOMException);
        assert.equal(error instanceof second.window.DOMException, false); return true;
      });
      assert.throws(() => parent.appendChild(null), { name: 'TypeError' });
      assert.equal(parent.childNodes.length, 0); assert.equal(foreign.parentNode, second.window.document.body);
    } finally { first.window.close(); second.window.close(); }
  }
});

test('should expose read-only native constraints with allocated handles and a zero append sentinel', () => {
  const { NativeTree, NodeInsertionStatus } = require('../dist/native.cjs'); const tree = new NativeTree();
  const parent = tree.allocate(); tree.setData(parent, '{"kind":9}');
  const candidate = tree.allocate(); tree.setHtmlElement(candidate, 'root', []);
  const foreign = tree.allocate(); tree.setData(foreign, '{"kind":8,"value":"foreign"}');
  const before = tree.statistics();
  assert.equal(tree.preInsertConstraints(parent, candidate, 0), NodeInsertionStatus.Ready);
  assert.equal(tree.preInsertConstraints(parent, candidate, foreign), NodeInsertionStatus.ChildNotFound);
  assert.deepEqual(tree.statistics(), before); tree.append(parent, candidate);
  assert.equal(tree.preInsertConstraints(parent, candidate, candidate), NodeInsertionStatus.InvalidDocumentStructure);
  const reserved = tree.reserveHandles(); const allocated = tree.statistics();
  for (const invalid of [-1, 0.5, NaN, Infinity, reserved]) {
    assert.throws(() => tree.preInsertConstraints(invalid, candidate, 0), { code: 'InvalidArg' });
    assert.throws(() => tree.preInsertConstraints(parent, invalid, 0), { code: 'InvalidArg' });
    assert.throws(() => tree.preInsertConstraints(parent, candidate, invalid), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), allocated);
  for (const handle of [candidate, foreign, parent]) tree.release(handle); assert.equal(tree.statistics().liveNodes, 0);
});
