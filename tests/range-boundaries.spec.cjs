/** @file Exercises real Range boundary setters, selection, ancestor identity and cross-realm errors. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
/** Public operations covered by the native decision plan. */
const methods = ['setStart', 'setEnd', 'setStartBefore', 'setStartAfter', 'setEndBefore', 'setEndAfter', 'selectNode', 'selectNodeContents'];

/** @param {object} engine - Real DOM implementation. @returns {object[]} Observable results across valid/invalid boundaries and live changes. */
function inspect(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main>');
  const foreign = new engine.JSDOM('<!doctype html><p>foreign</p>');
  const xml = new engine.JSDOM('<root><![CDATA[data]]></root>', { contentType: 'application/xml' });
  try {
    const document = dom.window.document;
    const root = document.querySelector('main');
    const first = document.createTextNode('A\ud800🦀Z');
    const span = document.createElement('span'); span.textContent = 'middle';
    const last = document.createTextNode('last');
    const comment = document.createComment('comment');
    const instruction = document.createProcessingInstruction('target', 'instruction');
    root.append(first, span, comment, instruction, last);
    const shadow = root.attachShadow({ mode: 'open' }); shadow.textContent = 'shadow';
    const fragment = document.createDocumentFragment(); fragment.append('fragment');
    const attribute = document.createAttribute('name'); attribute.value = 'value';
    const paragraph = foreign.window.document.querySelector('p');
    const xmlRoot = xml.window.document.documentElement;
    const nodes = [null, document, document.documentElement, document.head, document.body, document.doctype,
      root, first, span, span.firstChild, last, comment, instruction, shadow, shadow.firstChild, fragment,
      fragment.firstChild, attribute, foreign.window.document, foreign.window.document.documentElement,
      foreign.window.document.body, foreign.window.document.doctype, paragraph, paragraph.firstChild,
      xml.window.document, xmlRoot, xmlRoot.firstChild];
    /** @param {object|null} node - Observed identity. @returns {number} Stable fixture identifier. */
    const identity = (node) => { const index = nodes.indexOf(node); assert.notEqual(index, -1); return index; };
    /** @param {Range} range - Real live range. @returns {Array} Its public boundary and ancestor state. */
    const snapshot = (range) => [identity(range.startContainer), range.startOffset, identity(range.endContainer),
      range.endOffset, range.collapsed, identity(range.commonAncestorContainer)];
    const points = [[root, 0], [root, 3], [root, 5], [root, 6], [first, 1], [first, 3], [first, 5], [first, 6],
      [first, -1], [first, NaN], [first, Infinity], [first, 2 ** 32 + 1], [first, 1.8], [first, undefined],
      [span, 1], [last, 4], [comment, 7], [instruction, 11], [document.doctype, 99], [document, 0],
      [shadow, 1], [shadow.firstChild, 3], [fragment, 1], [attribute, 0], [attribute, 1],
      [paragraph.firstChild, 2], [foreign.window.document.doctype, 0], [xmlRoot.firstChild, 0], [xmlRoot.firstChild, 1]];
    const initial = [[root, 0, root, 5], [first, 1, last, 2], [shadow.firstChild, 1, shadow.firstChild, 4]];
    const results = [];
    for (const method of methods) {
      for (const point of points) {
        for (const [start, startOffset, end, endOffset] of initial) {
          const range = document.createRange(); range.setStart(start, startOffset); range.setEnd(end, endOffset);
          const before = snapshot(range);
          let errorResult = null;
          try { range[method](...point); } catch (error) {
            errorResult = [error.name, error.message]; assert.deepEqual(snapshot(range), before);
          }
          results.push([method, errorResult, snapshot(range)]);
        }
      }
    }
    const live = document.createRange(); live.setStart(span.firstChild, 2); live.setEnd(last, 3);
    const clone = live.cloneRange();
    span.firstChild.splitText(3); span.normalize(); root.insertBefore(document.createTextNode('new'), span);
    results.push(['mutation', live.toString(), clone.toString(), snapshot(live), snapshot(clone)]);
    foreign.window.document.adoptNode(span); paragraph.append(span);
    results.push(['adoption', live.toString(), snapshot(live), snapshot(clone)]);
    return results;
  } finally { dom.window.close(); foreign.window.close(); xml.window.close(); }
}

test('should preserve all Range boundary setters, selections and live updates against jsdom', () => {
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

for (const [name, engine] of Object.entries(engines)) {
  test(`should preserve setter exception realms and unchanged boundaries in ${name}`, () => {
    const owner = new engine.JSDOM('', { runScripts: 'outside-only' });
    const target = new engine.JSDOM('<!doctype html><p>target</p>', { runScripts: 'outside-only' });
    try {
      const range = owner.window.document.createRange();
      const document = target.window.document;
      const cases = [
        ['setStart', document.doctype, 99, 'InvalidNodeTypeError', target.window],
        ['setEnd', document.doctype, 99, 'InvalidNodeTypeError', target.window],
        ['setStart', document.querySelector('p').firstChild, 99, 'IndexSizeError', target.window],
        ['setEnd', document.querySelector('p').firstChild, 99, 'IndexSizeError', target.window],
        ...['setStartBefore', 'setStartAfter', 'setEndBefore', 'setEndAfter'].map((method) =>
          [method, document, 0, 'InvalidNodeTypeError', owner.window]),
        ['selectNode', document, 0, 'InvalidNodeTypeError', target.window],
        ['selectNodeContents', document.doctype, 0, 'InvalidNodeTypeError', owner.window],
      ];
      for (const [method, node, offset, errorName, realm] of cases) {
        assert.throws(() => range[method](node, offset), (error) => {
          assert.ok(error instanceof realm.DOMException); assert.equal(error.name, errorName); return true;
        });
        assert.equal(range.startContainer, owner.window.document); assert.equal(range.endContainer, owner.window.document);
        assert.equal(range.startOffset, 0); assert.equal(range.endOffset, 0);
      }
    } finally { owner.window.close(); target.window.close(); }
  });
}

test('should return transient native plans and release nodes while results remain reachable', () => {
  const { NativeTree, RangeBoundaryMode, RangeBoundaryAction } = require('../dist/native.cjs');
  const tree = new NativeTree();
  const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'A\ud800B'); tree.append(root, text);
  const plan = tree.rangeBoundaryPlan(RangeBoundaryMode.SelectContents, text, 0, root, 0, root, 1);
  assert.deepEqual(plan, { action: RangeBoundaryAction.BothStartFirst, node: text, startOffset: 0, endOffset: 3 });
  assert.equal(tree.commonAncestor(root, text), root);
  const reserved = tree.reserveHandles(); const before = tree.statistics();
  assert.throws(() => tree.rangeBoundaryPlan(RangeBoundaryMode.Start, reserved, 0, root, 0, root, 1), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before);
  tree.release(text); tree.release(root);
  assert.equal(plan.endOffset, 3); assert.equal(tree.statistics().liveNodes, 0);
});

/** @param {NativeTree} tree - Real native arena. @param {number[]} handles - Live fixture handles. @returns {object} Public state observed without serializing or mutating the arena. */
function nativeSnapshot(tree, handles) {
  return { links: handles.map((handle) => tree.getLinks(handle)), text: tree.getCharacterData(handles[1]), statistics: tree.statistics() };
}

for (const modeName of ['Start', 'End', 'StartBefore', 'StartAfter', 'EndBefore', 'EndAfter', 'SelectNode', 'SelectContents']) {
  test(`should reject either unallocated endpoint before all ${modeName} decisions without mutation`, () => {
    const { NativeTree, RangeBoundaryMode } = require('../dist/native.cjs');
    const tree = new NativeTree();
    const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
    const text = tree.allocate(); tree.setCharacterData(text, 3, 'text'); tree.append(root, text);
    const detached = tree.allocate(); tree.setCharacterData(detached, 3, 'detached');
    const doctype = tree.allocate(); tree.initializeDocumentType(doctype, 'html', '', '');
    const released = tree.allocate(); tree.release(released);
    const reserved = tree.reserveHandles();
    const handles = [root, text, detached, doctype];
    const before = nativeSnapshot(tree, handles);
    try {
      // Exercise normal decisions and early NoParent, InvalidNodeType and InvalidOffset decisions.
      for (const [target, offset] of [[text, 0], [detached, 0], [doctype, 0], [text, 99]]) {
        for (const invalid of [reserved, released, reserved + tree.handleBatchSize, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
          for (const [start, end] of [[invalid, root], [root, invalid]]) {
            assert.throws(() => tree.rangeBoundaryPlan(RangeBoundaryMode[modeName], target, offset, start, 0, end, 1),
              { code: 'InvalidArg' }, `${modeName}: target=${target}, offset=${offset}, start=${start}, end=${end}`);
            assert.deepEqual(nativeSnapshot(tree, handles), before);
          }
        }
      }
    } finally {
      for (const handle of [text, root, detached, doctype]) tree.release(handle);
      for (let index = 0; index < tree.handleBatchSize; index++) tree.release(reserved + index);
    }
    const after = tree.statistics();
    assert.equal(after.liveNodes, 0); assert.equal(after.dataNodes, 0); assert.equal(after.reservedHandles, 0);
  });
}

test('should accept both topology-only endpoints in every native boundary mode', () => {
  const { NativeTree, RangeBoundaryMode, RangeBoundaryAction } = require('../dist/native.cjs');
  const tree = new NativeTree();
  const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'text');
  const start = tree.allocate(); const end = tree.allocate();
  for (const child of [start, text, end]) tree.append(root, child);
  try {
    const cases = [
      ['Start', RangeBoundaryAction.Start, text, 1, 1],
      ['End', RangeBoundaryAction.End, text, 1, 1],
      ['StartBefore', RangeBoundaryAction.Start, root, 1, 1],
      ['StartAfter', RangeBoundaryAction.Start, root, 2, 2],
      ['EndBefore', RangeBoundaryAction.End, root, 1, 1],
      ['EndAfter', RangeBoundaryAction.End, root, 2, 2],
      ['SelectNode', RangeBoundaryAction.BothStartFirst, root, 1, 2],
      ['SelectContents', RangeBoundaryAction.BothStartFirst, text, 0, 4],
    ];
    for (const [modeName, action, node, startOffset, endOffset] of cases) {
      assert.deepEqual(tree.rangeBoundaryPlan(RangeBoundaryMode[modeName], text, 1, start, 0, end, 0),
        { action, node, startOffset, endOffset });
      assert.equal(tree.statistics().dataNodes, 2);
    }
  } finally {
    for (const handle of [start, text, end, root]) tree.release(handle);
  }
  assert.equal(tree.statistics().liveNodes, 0);
});
