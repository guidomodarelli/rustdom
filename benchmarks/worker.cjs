/** @file Measures equivalent end-to-end DOM workloads in one isolated runtime process. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');

/** Select a real implementation, never a benchmark-specific stand-in. */
const engine = process.argv[2];
if (!['jsdom', 'rustdom'].includes(engine)) throw new Error('benchmark: engine must be jsdom or rustdom');
/** Load dependencies before measurement; cold module startup is explicitly excluded. */
const runtime = engine === 'jsdom' ? require('jsdom') : require('../dist/index.cjs');
/** Warm both JIT and parser before collecting independent samples. */
const WARMUP_SAMPLES = 3;
/** Keep raw samples so noise and distributions remain inspectable. */
const MEASURED_SAMPLES = 9;
/** Keep a bounded default and a reproducible opt-in repeated-reference workload. */
const RANGE_STRINGIFICATION_READS = { 'range-stringify-1': 1, 'range-stringify-10': 10 };
/** Each iteration executes all eight setter/selection decisions against real row nodes. */
const RANGE_BOUNDARY_ITERATIONS = 100;
/** Measure both read-heavy access and complete Range/StaticRange lifetimes through public APIs. */
const RANGE_STATE_ITERATIONS = 1000;
/** Repeated insertions include preflight, native geometry and live-range mutation delivery. */
const RANGE_INSERTION_ITERATIONS = 100;
/** Exercise dense live-range sets and consume intermediate offsets to reject no-op updates. */
const RANGE_MUTATION_RANGE_COUNT = 1000;
const RANGE_MUTATION_ITERATIONS = 100;
const RANGE_MUTATION_TEXT = '++';
/** Include both public root lookup and connectivity on stable shallow/deep trees. */
const NODE_ROOT_ITERATIONS = 1000;
/** Measure full attachment and parsing of independent shadow hosts. */
const SHADOW_CREATION_COUNT = 100;
/** Include event creation, dispatch and retargeted listener observations. */
const RETARGET_EVENT_COUNT = 100;
/** Exercise both prepared slot reads and assignment with its mutation hooks. */
const SLOT_LOOKUP_ITERATIONS = 1000;
const SLOT_REASSIGNMENT_ITERATIONS = 100;
/** Recompute assignment lists rather than reading their existing cache. */
const SLOT_ASSIGNMENT_QUERY_ITERATIONS = 100;
/** Alternate visible values while timing complete public Node setters. */
const TEXT_WRITE_ITERATIONS = 1000;
const TEXT_WRITE_VALUES = ['first', 'second'];
/** Measure public insertions and replacements in Documents with many existing comments. */
const DOCUMENT_MUTATION_ITERATIONS = 100;
/** Public content operations sharing identical partial-boundary fixtures. */
const RANGE_CONTENT_OPERATIONS = { 'range-delete-contents': 'deleteContents',
  'range-clone-contents': 'cloneContents', 'range-extract-contents': 'extractContents' };

/**
 * Build reproducible HTML with attributes, decoded entities, and table insertion modes.
 * @param {number} size - Number of data rows.
 * @returns {string} Identical input for both implementations.
 */
function fixture(size) {
  return '<!doctype html><html><head><title>Benchmark</title></head><body><table>' +
    Array.from({ length: size }, (_, index) =>
      `<tr class="row" data-index="${index}"><td><a href="/row/${index}">Row ${index} &amp; value</a></td><td>${index}</td></tr>`).join('') +
    '</table></body></html>';
}

/** @param {Document} document - Actual DOM document. @param {number} depth - Nested root count. @param {ShadowRoot[]} roots - Captured roots for later validation. @returns {object} Leaf target and its outer host. */
function shadowChain(document, depth, roots) {
  let parent = document.body; let outerHost;
  for (let index = 0; index < depth; index++) {
    const host = parent.appendChild(document.createElement('section'));
    if (index === 0) outerHost = host;
    const root = host.attachShadow({ mode: index % 2 ? 'closed' : 'open' }); roots.push(root); parent = root;
  }
  const leaf = parent.appendChild(document.createElement('button')); leaf.textContent = 'deep';
  return { leaf, outerHost };
}

/**
 * Prepare named slots and exact expected assignments before starting measurement.
 * @param {Document} document - Actual DOM document.
 * @param {number} size - Slot count.
 * @param {boolean} dense - Use two candidates per slot instead of one total.
 * @returns {object} Root, slots, mutable target, names and expected final identity lists.
 */
function slotAssignmentFixture(document, size, dense) {
  const host = document.body.appendChild(document.createElement('section'));
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = Array.from({ length: size }, (_, index) => `<slot name="slot-${index}">fallback-${index}</slot>`).join('');
  const slots = [...root.querySelectorAll('slot')]; const names = [slots[0].name, slots.at(-1).name];
  const targets = Array.from({ length: dense ? size * 2 : 1 }, (_, index) => {
    const target = document.createElement('b'); target.textContent = dense ? `assigned-${index}` : 'assigned';
    target.slot = dense ? `slot-${index % size}` : names[1]; return target;
  });
  if (dense) targets[0].slot = names[1];
  host.append(...targets);
  const assignments = slots.map((slot) => targets.filter((target) => target.slot === slot.name));
  assert.equal(targets[0].assignedSlot, slots.at(-1));
  return { root, slots, target: targets[0], names, assignments };
}

/**
 * Measure one complete public operation; setup and assertions stay outside the timer.
 * @param {string} name - Workload name, including its configuration.
 * @param {number} size - Fixture row count.
 * @returns {Promise<object>} Raw milliseconds and post-cleanup memory snapshots.
 */
async function measure(name, size) {
  const html = fixture(size);
  const stringifyReads = RANGE_STRINGIFICATION_READS[name];
  const contentOperation = RANGE_CONTENT_OPERATIONS[name];
  const removesContent = contentOperation === 'deleteContents' || contentOperation === 'extractContents';
  const surroundsContent = name === 'range-surround-contents';
  const insertsNodes = name === 'range-insert-node-100';
  const createsContextFragment = name === 'range-context-fragment';
  const mutatesCharacterRanges = name === 'range-character-mutations-100';
  const textWriteProperty = name === 'node-value-writes-1000' ? 'nodeValue'
    : name === 'node-text-writes-1000' ? 'textContent' : null;
  const insertsDocumentComments = name === 'document-comments-insert-100';
  const rejectsDocumentElement = name === 'document-duplicate-element-100';
  const replacesDocumentComments = name === 'document-comments-replace-100';
  const replacesDocumentElement = name === 'document-root-replace-100';
  const queriesShadowRoots = name === 'shadow-roots-1000';
  const createsShadowHosts = name === 'shadow-hosts-create-100';
  const dispatchesRetargetEvents = name === 'shadow-retarget-events-100';
  const queriesSlots = name === 'slot-lookup-1000';
  const reassignsSlots = name === 'slot-reassign-100' || name === 'slot-dense-reassign-100';
  const queriesAssignments = name === 'slot-assigned-100';
  const denseSlots = queriesAssignments || name === 'slot-dense-reassign-100';
  const usesSlots = queriesSlots || reassignsSlots || queriesAssignments;
  const mutatesTreeRanges = name === 'range-tree-mutations-100';
  const mutatesRanges = mutatesCharacterRanges || mutatesTreeRanges;
  const environment = name.startsWith('environment-')
    ? engine === 'jsdom' ? (await import('vitest/runtime')).builtinEnvironments.jsdom
      : (await import('../src/environments/vitest.mjs')).default
    : null;
  const samplesMs = [];
  const memory = [];
  let outputHash;
  for (let sample = 0; sample < WARMUP_SAMPLES + MEASURED_SAMPLES; sample++) {
    let dom;
    let elapsed;
    let result;
    let insertionDocument;
    let shadowRoots;
    let shadowTarget;
    let eventHost; let relatedHost; let relatedTarget; let eventListener;
    let observedRetargetEvents = 0; let invalidRetargetEvents = 0;
    let cleanup;
    let target;
    if (environment) {
      target = { setTimeout, clearTimeout, setInterval, clearInterval,
        Request: globalThis.Request, Response: globalThis.Response, URL: globalThis.URL,
        AbortController: globalThis.AbortController, AbortSignal: globalThis.AbortSignal };
      global.gc?.();
      const start = performance.now();
      const session = name === 'environment-vm-setup'
        ? await environment.setupVM({ jsdom: { html, runScripts: 'outside-only' } })
        : await environment.setup(target, { jsdom: { html, runScripts: 'outside-only' } });
      if (name === 'environment-vm-setup') target = session.getVmContext();
      dom = target.jsdom;
      elapsed = performance.now() - start;
      cleanup = () => session.teardown(target);
      assert.equal(dom.window.document.querySelectorAll('tr').length, size);
    } else if (name.startsWith('construct')) {
      const options = name === 'construct-script-compatible' ? { runScripts: 'dangerously' } : {};
      global.gc?.();
      const start = performance.now();
      dom = new runtime.JSDOM(html, options);
      elapsed = performance.now() - start;
      assert.equal(dom.window.document.querySelectorAll('tr').length, size);
    } else {
      dom = new runtime.JSDOM(name === 'innerHTML' ? '<!doctype html><body>' : html);
      const document = dom.window.document;
      const comparisonRoot = name.startsWith('node-') ? document.querySelector('table') : null;
      const comparisonPeer = name === 'node-equality-100' ? comparisonRoot.cloneNode(true) : null;
      const comparisonNodes = name === 'node-position-1000' ? [...comparisonRoot.querySelectorAll('tr')] : null;
      const readsRoots = name === 'node-roots-shallow-1000' || name === 'node-roots-deep-1000';
      if (queriesShadowRoots || createsShadowHosts || dispatchesRetargetEvents || usesSlots) shadowRoots = [];
      const slotAssignment = usesSlots ? slotAssignmentFixture(document, size, denseSlots) : null;
      const slots = slotAssignment?.slots; const slotTarget = slotAssignment?.target; const slotNames = slotAssignment?.names;
      if (slotAssignment) shadowRoots.push(slotAssignment.root);
      if (queriesShadowRoots) {
        shadowTarget = shadowChain(document, size, shadowRoots).leaf;
      }
      if (dispatchesRetargetEvents) {
        const first = shadowChain(document, size, shadowRoots); const second = shadowChain(document, size, shadowRoots);
        shadowTarget = first.leaf; eventHost = first.outerHost; relatedHost = second.outerHost; relatedTarget = second.leaf;
        eventListener = (event) => { observedRetargetEvents++;
          if (event.target !== eventHost || event.relatedTarget !== relatedHost) invalidRetargetEvents++; };
        eventHost.addEventListener('mouseover', eventListener);
      }
      let documentCandidates;
      let documentReplacementTargets;
      if (insertsDocumentComments || rejectsDocumentElement || replacesDocumentComments || replacesDocumentElement) {
        insertionDocument = document.implementation.createDocument(null, null);
        if (rejectsDocumentElement || replacesDocumentElement) insertionDocument.appendChild(insertionDocument.createElement('root'));
        for (let index = 0; index < size; index++) insertionDocument.appendChild(insertionDocument.createComment(`seed-${index}`));
        documentReplacementTargets = replacesDocumentComments ? [...insertionDocument.childNodes].slice(0, DOCUMENT_MUTATION_ITERATIONS)
          : replacesDocumentElement ? [insertionDocument.documentElement] : null;
        documentCandidates = Array.from({ length: DOCUMENT_MUTATION_ITERATIONS }, (_, index) => rejectsDocumentElement || replacesDocumentElement
          ? insertionDocument.createElement('candidate') : insertionDocument.createComment(`insert-${index}`));
      }
      const textWriteContainer = textWriteProperty ? document.body.appendChild(document.createElement('div')) : null;
      if (textWriteContainer) textWriteContainer.append('initial');
      const originalWrittenText = textWriteContainer?.firstChild;
      const textWriteTarget = textWriteProperty === 'nodeValue' ? originalWrittenText : textWriteContainer;
      let rootTarget = readsRoots ? document.querySelector('tbody').lastChild.lastChild.firstChild : null;
      if (name === 'node-roots-deep-1000') {
        let parent = document.body;
        for (let index = 0; index < size; index++) parent = parent.appendChild(document.createElement('section'));
        rootTarget = parent.appendChild(document.createTextNode('deep'));
      }
      const rangeNodes = name.startsWith('range-') && !stringifyReads && !surroundsContent && !insertsNodes && !mutatesRanges && !createsContextFragment ? [...document.querySelectorAll('tr')] : null;
      const ranges = name === 'range-state-lifecycle-1000' || contentOperation ? null
        : rangeNodes?.map((node) => { const range = document.createRange(); range.selectNodeContents(node); return range; });
      const lastRange = ranges?.at(-1);
      const surroundRange = surroundsContent ? document.createRange() : null;
      const surrounding = surroundsContent ? document.createElement('section') : null;
      if (surroundRange) { surroundRange.selectNode(document.querySelector('table')); surrounding.innerHTML = '<em>old</em>'; }
      const insertionRange = insertsNodes ? document.createRange() : null;
      const insertionNodes = insertsNodes ? Array.from({ length: RANGE_INSERTION_ITERATIONS }, () => document.createElement('tr')) : null;
      const insertionParent = insertsNodes ? document.querySelector('tbody') : null;
      const insertionOffset = Math.floor(size / 2);
      if (insertionRange) { insertionRange.setStart(insertionParent, insertionOffset); insertionRange.collapse(true); }
      const mutationNode = mutatesCharacterRanges ? document.querySelector('tbody').lastChild.firstChild.firstChild.firstChild
        : mutatesTreeRanges ? document.querySelector('tbody') : null;
      const mutationOriginalText = mutatesCharacterRanges ? mutationNode.data : null;
      const mutationEndOffset = mutatesCharacterRanges ? 8 : size;
      const mutationStartOffset = mutatesCharacterRanges ? 1 : Math.floor(size / 2);
      const mutationRanges = mutatesRanges ? Array.from({ length: RANGE_MUTATION_RANGE_COUNT }, () => {
        const range = document.createRange(); range.setStart(mutationNode, mutationStartOffset); range.setEnd(mutationNode, mutationEndOffset); return range;
      }) : null;
      const mutationRow = mutatesTreeRanges ? document.createElement('tr') : null;
      const contextRange = createsContextFragment ? document.createRange() : null;
      const contextElement = createsContextFragment ? document.querySelector('tbody') : null;
      const contextMarkup = createsContextFragment ? contextElement.innerHTML : null;
      const previousNativeFragments = runtime.getParserStatistics?.().nativeFragment;
      if (contextRange) contextRange.selectNodeContents(contextElement);
      const contentRange = contentOperation ? document.createRange() : null;
      if (contentRange) {
        contentRange.setStart(rangeNodes[0].firstChild.firstChild.firstChild, 4);
        const end = rangeNodes.at(-1).lastChild.firstChild;
        contentRange.setEnd(end, end.length - 1);
      }
      const stateTextNodes = name === 'range-state-lifecycle-1000'
        ? rangeNodes.map((node) => node.firstChild.firstChild.firstChild) : null;
      const expectedStateUnits = stateTextNodes ? Array.from({ length: RANGE_STATE_ITERATIONS },
        (_, index) => stateTextNodes[index % size].length).reduce((total, length) => total + length, 0) : 0;
      const rangeComparisonMode = dom.window.Range.START_TO_START;
      const rangePointNodes = name === 'range-text-point-1000'
        ? rangeNodes.map((node) => node.firstChild.firstChild.firstChild) : rangeNodes;
      const namespaceNode = name === 'namespace-lookup-1000' ? document.querySelector('a').firstChild : null;
      const textRoot = name === 'text-content-100' || stringifyReads || contentOperation || surroundsContent || createsContextFragment || name.startsWith('normalize-') ? document.querySelector('table') : null;
      const expectedText = textRoot ? Array.from({ length: size }, (_, index) => `Row ${index} & value${index}`).join('') : null;
      let consumedTextUnits = 0;
      const stringifyRange = stringifyReads ? document.createRange() : null;
      if (stringifyRange) stringifyRange.selectNodeContents(textRoot);
      if (name === 'normalize-split-text') {
        for (const anchor of document.querySelectorAll('a')) {
          let text = anchor.firstChild;
          while (text.length > 4) text = text.splitText(4);
        }
      }
      if (namespaceNode) document.querySelector('table').setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:p', 'urn:benchmark');
      global.gc?.();
      const start = performance.now();
      if (queriesAssignments) {
        result = 0;
        const expected = slotAssignment.assignments.at(-1);
        for (let iteration = 0; iteration < SLOT_ASSIGNMENT_QUERY_ITERATIONS; iteration++) {
          const selected = slots.at(-1).assignedNodes({ flatten: true });
          result += Number(selected.length === expected.length);
          for (let index = 0; index < selected.length; index++) result += Number(selected[index] === expected[index]);
        }
      } else if (queriesSlots || reassignsSlots) {
        result = 0;
        const iterations = queriesSlots ? SLOT_LOOKUP_ITERATIONS : SLOT_REASSIGNMENT_ITERATIONS;
        for (let iteration = 0; iteration < iterations; iteration++) {
          if (reassignsSlots) slotTarget.slot = slotNames[iteration % 2];
          result += Number(slotTarget.assignedSlot === (queriesSlots || iteration % 2 ? slots.at(-1) : slots[0]));
        }
      } else if (dispatchesRetargetEvents) {
        for (let index = 0; index < RETARGET_EVENT_COUNT; index++) {
          shadowTarget.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true, composed: true, relatedTarget }));
        }
      } else if (queriesShadowRoots) {
        result = 0;
        for (let iteration = 0; iteration < NODE_ROOT_ITERATIONS; iteration++) {
          result += Number(shadowTarget.getRootNode({ composed: true }) === document) + Number(shadowTarget.isConnected);
        }
      } else if (createsShadowHosts) {
        for (let index = 0; index < SHADOW_CREATION_COUNT; index++) {
          const host = document.body.appendChild(document.createElement('div'));
          const root = host.attachShadow({ mode: index % 2 ? 'closed' : 'open' }); root.innerHTML = '<b>shadow</b>';
          shadowRoots.push(root);
        }
      } else if (documentCandidates) {
        result = 0;
        for (let index = 0; index < documentCandidates.length; index++) {
          const candidate = documentCandidates[index];
          if (replacesDocumentComments || replacesDocumentElement) {
            const previous = replacesDocumentComments ? documentReplacementTargets[index]
              : index === 0 ? documentReplacementTargets[0] : documentCandidates[index - 1];
            insertionDocument.replaceChild(candidate, previous); result++;
          } else if (rejectsDocumentElement) {
            try { insertionDocument.appendChild(candidate); }
            catch (error) { result += Number(error.name === 'HierarchyRequestError'); }
          } else { insertionDocument.appendChild(candidate); result++; }
        }
      } else if (textWriteProperty) {
        for (let iteration = 0; iteration < TEXT_WRITE_ITERATIONS; iteration++) {
          textWriteTarget[textWriteProperty] = TEXT_WRITE_VALUES[iteration % TEXT_WRITE_VALUES.length];
        }
      } else if (readsRoots) {
        result = 0;
        for (let iteration = 0; iteration < NODE_ROOT_ITERATIONS; iteration++) {
          result += Number(rootTarget.getRootNode() === document) + Number(rootTarget.isConnected);
        }
      } else if (stringifyReads) {
        for (let iteration = 0; iteration < stringifyReads; iteration++) {
          result = stringifyRange.toString(); consumedTextUnits += result.length;
        }
      } else if (surroundsContent) {
        surroundRange.surroundContents(surrounding);
      } else if (insertsNodes) {
        for (const node of insertionNodes) insertionRange.insertNode(node);
      } else if (createsContextFragment) {
        result = contextRange.createContextualFragment(contextMarkup);
      } else if (mutatesRanges) {
        result = 0;
        for (let iteration = 0; iteration < RANGE_MUTATION_ITERATIONS; iteration++) {
          if (mutatesCharacterRanges) mutationNode.insertData(2, RANGE_MUTATION_TEXT);
          else mutationNode.insertBefore(mutationRow, mutationNode.firstChild);
          result += mutationRanges[0].endOffset;
          if (mutatesCharacterRanges) mutationNode.deleteData(2, RANGE_MUTATION_TEXT.length);
          else mutationNode.removeChild(mutationRow);
        }
      } else if (contentOperation) {
        result = contentRange[contentOperation]();
      } else if (name === 'range-control-1000') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_STATE_ITERATIONS; iteration++) {
          const copy = lastRange.cloneRange(); copy.collapse(iteration % 2 === 0);
          result += copy.compareBoundaryPoints(rangeComparisonMode, lastRange);
        }
      } else if (name === 'range-state-read-1000') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_STATE_ITERATIONS; iteration++) {
          result += lastRange.startOffset + lastRange.endOffset + Number(lastRange.collapsed);
        }
      } else if (name === 'range-state-lifecycle-1000') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_STATE_ITERATIONS; iteration++) {
          const text = stateTextNodes[iteration % size];
          const range = document.createRange(); range.selectNodeContents(text);
          const clone = range.cloneRange();
          const frozen = new dom.window.StaticRange({ startContainer: text, startOffset: 0,
            endContainer: text, endOffset: text.length });
          clone.setStart(text, 1);
          result += range.endOffset + clone.endOffset + frozen.endOffset +
            Number(range.startOffset === 0 && clone.startOffset === 1 && frozen.startOffset === 0);
        }
      } else if (name === 'range-boundaries-100') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_BOUNDARY_ITERATIONS; iteration++) {
          const node = rangeNodes[iteration % size];
          const text = node.firstChild.firstChild.firstChild;
          lastRange.selectNode(node);
          lastRange.setStartBefore(node);
          lastRange.setEndAfter(node);
          lastRange.selectNodeContents(node);
          lastRange.setStart(text, 1);
          lastRange.setEnd(text, text.length);
          lastRange.setStartAfter(node);
          lastRange.setEndBefore(node);
          result += Number(lastRange.collapsed && lastRange.commonAncestorContainer === node.parentNode);
        }
      } else if (name === 'range-compare-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          const range = ranges[iteration % size];
          result += lastRange.compareBoundaryPoints(rangeComparisonMode, range) - range.compareBoundaryPoints(rangeComparisonMode, lastRange);
        }
      } else if (name === 'range-point-1000' || name === 'range-text-point-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          const node = rangePointNodes[iteration % size];
          result += lastRange.comparePoint(node, 0) + Number(lastRange.isPointInRange(node, 0)) + Number(lastRange.intersectsNode(node));
        }
      } else if (name.startsWith('normalize-')) {
        textRoot.normalize();
      } else if (name === 'text-content-100') {
        for (let iteration = 0; iteration < 100; iteration++) {
          result = textRoot.textContent;
          consumedTextUnits += result.length;
        }
      } else if (name === 'namespace-lookup-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          result += Number(namespaceNode.lookupNamespaceURI('p') === 'urn:benchmark');
          result += Number(namespaceNode.lookupPrefix('urn:benchmark') === 'p');
          result += Number(namespaceNode.isDefaultNamespace('http://www.w3.org/1999/xhtml'));
        }
      } else if (name === 'node-equality-100') {
        result = 0;
        for (let iteration = 0; iteration < 100; iteration++) result += Number(comparisonRoot.isEqualNode(comparisonPeer));
      } else if (name === 'node-position-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          const node = comparisonNodes[iteration % comparisonNodes.length];
          result += comparisonNodes.at(-1).compareDocumentPosition(node) + Number(comparisonRoot.contains(node));
        }
      } else if (name === 'innerHTML') {
        document.body.innerHTML = html.slice(html.indexOf('<table>'), html.indexOf('</body>'));
      } else if (name === 'selectors-100') {
        for (let iteration = 0; iteration < 100; iteration++) {
          result = document.querySelectorAll('table > tbody > tr.row[data-index] a');
        }
      } else if (name === 'mutations-100') {
        for (let iteration = 0; iteration < 100; iteration++) {
          const element = document.createElement('div');
          element.textContent = 'new content';
          document.body.appendChild(element);
          element.setAttribute('data-value', 'updated');
          element.remove();
        }
      } else if (name === 'attribute-collections-100') {
        const element = document.querySelector('tr');
        let current;
        for (let iteration = 0; iteration < 100; iteration++) {
          const attribute = document.createAttributeNS('urn:benchmark', 'p:transient');
          attribute.value = `value-${iteration}`;
          element.setAttributeNodeNS(attribute);
          current = element.attributes.getNamedItemNS('urn:benchmark', 'transient');
          result = current.value;
        }
        element.removeAttributeNode(current);
      } else if (name === 'attribute-data-100') {
        const element = document.querySelector('tr');
        const attribute = document.createAttribute('data-transient');
        element.setAttributeNode(attribute);
        for (let iteration = 0; iteration < 100; iteration++) {
          attribute.value = `value-${iteration}`;
          result = element.getAttribute('data-transient');
        }
        element.removeAttributeNode(attribute);
      } else if (name === 'character-data-100') {
        const text = document.querySelector('a').firstChild;
        for (let iteration = 0; iteration < 100; iteration++) {
          text.appendData('!');
          text.replaceData(0, 1, 'R');
          result = text.substringData(0, 4);
          text.deleteData(text.length - 1, 1);
        }
      } else if (name === 'serialize-utf8') {
        result = Buffer.byteLength(dom.serialize());
      } else throw new Error(`benchmark: unsupported workload ${name}`);
      elapsed = performance.now() - start;
      assert.equal(document.querySelectorAll('tr').length, removesContent ? 2 : size + (insertsNodes ? RANGE_INSERTION_ITERATIONS : 0));
      if (name === 'selectors-100') assert.equal(result.length, size);
      if (name === 'serialize-utf8') assert.ok(result > 0);
      if (name === 'character-data-100') assert.equal(result, 'Row ');
      if (name === 'attribute-data-100') assert.equal(result, 'value-99');
      if (name === 'attribute-collections-100') assert.equal(result, 'value-99');
      if (name === 'node-equality-100') assert.equal(result, 100);
      if (name === 'namespace-lookup-1000') assert.equal(result, 3000);
      if (name === 'text-content-100') {
        assert.equal(result, expectedText);
        assert.equal(consumedTextUnits, expectedText.length * 100);
      }
      if (name.startsWith('normalize-')) {
        assert.equal(textRoot.textContent, expectedText);
        for (const anchor of document.querySelectorAll('a')) {
          assert.equal(anchor.childNodes.length, 1);
          assert.equal(anchor.firstChild.nodeType, dom.window.Node.TEXT_NODE);
        }
      }
      if (name === 'node-position-1000') assert.equal(result, (1000 - Math.floor(1000 / size)) * 2 + 1000);
      if (name === 'range-compare-1000') assert.equal(result, 2 * (1000 - Math.floor(1000 / size)));
      if (name === 'range-state-read-1000') assert.equal(result, RANGE_STATE_ITERATIONS * 2);
      if (surroundsContent) {
        assert.equal(document.body.firstChild, surrounding); assert.equal(surrounding.firstChild, textRoot);
        assert.equal(surrounding.textContent, expectedText);
        assert.equal(surroundRange.startContainer, document.body);
        assert.equal(surroundRange.startOffset, 0); assert.equal(surroundRange.endOffset, 1);
      }
      if (readsRoots) assert.equal(result, NODE_ROOT_ITERATIONS * 2);
      if (shadowRoots) {
        assert.equal(shadowRoots.length, queriesShadowRoots ? size : dispatchesRetargetEvents ? size * 2 : usesSlots ? 1 : SHADOW_CREATION_COUNT);
        if (usesSlots) {
          assert.equal(result, queriesAssignments ? SLOT_ASSIGNMENT_QUERY_ITERATIONS * (slotAssignment.assignments.at(-1).length + 1)
            : queriesSlots ? SLOT_LOOKUP_ITERATIONS : SLOT_REASSIGNMENT_ITERATIONS);
          assert.equal(slots.length, size);
          for (const [index, slot] of slots.entries()) {
            assert.deepEqual(slot.assignedNodes(), slotAssignment.assignments[index]);
            assert.deepEqual(slot.assignedNodes({ flatten: true }), slotAssignment.assignments[index].length
              ? slotAssignment.assignments[index] : [slot.firstChild]);
          }
          if (engine === 'rustdom') assert.ok(runtime.getNativeTreeStatistics().slotableNames.namedNodes > 0);
        }
        if (queriesShadowRoots) assert.equal(result, NODE_ROOT_ITERATIONS * 2);
        if (dispatchesRetargetEvents) { assert.equal(observedRetargetEvents, RETARGET_EVENT_COUNT); assert.equal(invalidRetargetEvents, 0); }
        for (const root of shadowRoots) assert.equal(root.host.getRootNode({ composed: true }), document);
        if (createsShadowHosts) for (const root of shadowRoots) assert.equal(root.textContent, 'shadow');
        if (engine === 'rustdom') assert.ok(runtime.getNativeTreeStatistics().rootHosts.hostedRoots >= shadowRoots.length);
      }
      if (documentCandidates) {
        assert.equal(result, DOCUMENT_MUTATION_ITERATIONS);
        assert.equal(insertionDocument.childNodes.length, size + (rejectsDocumentElement || replacesDocumentElement ? 1 : insertsDocumentComments ? DOCUMENT_MUTATION_ITERATIONS : 0));
        if (rejectsDocumentElement) {
          assert.equal(insertionDocument.documentElement.localName, 'root');
          for (const candidate of documentCandidates) assert.equal(candidate.parentNode, null);
        } else if (replacesDocumentElement) {
          assert.equal(insertionDocument.documentElement, documentCandidates.at(-1));
          assert.equal(documentReplacementTargets[0].parentNode, null);
          for (const candidate of documentCandidates.slice(0, -1)) assert.equal(candidate.parentNode, null);
        } else {
          for (const [index, candidate] of documentCandidates.entries()) {
            assert.equal(insertionDocument.childNodes[(replacesDocumentComments ? 0 : size) + index], candidate);
          }
          if (replacesDocumentComments) for (const previous of documentReplacementTargets) assert.equal(previous.parentNode, null);
        }
      }
      if (textWriteProperty) {
        assert.equal(textWriteContainer.textContent, TEXT_WRITE_VALUES[(TEXT_WRITE_ITERATIONS - 1) % TEXT_WRITE_VALUES.length]);
        assert.equal(textWriteContainer.childNodes.length, 1);
        assert.equal(originalWrittenText.parentNode, textWriteProperty === 'nodeValue' ? textWriteContainer : null);
        assert.equal(textWriteContainer.firstChild === originalWrittenText, textWriteProperty === 'nodeValue');
      }
      if (createsContextFragment) {
        assert.equal(result.nodeType, dom.window.Node.DOCUMENT_FRAGMENT_NODE);
        assert.equal(result.querySelectorAll('tr').length, size); assert.equal(result.textContent, expectedText);
        assert.equal(result.ownerDocument, document);
        assert.equal(contextRange.startContainer, contextElement); assert.equal(contextRange.endContainer, contextElement);
        assert.equal(contextRange.startOffset, 0); assert.equal(contextRange.endOffset, size);
        if (engine === 'rustdom') assert.ok(runtime.getParserStatistics().nativeFragment > previousNativeFragments);
      }
      if (mutatesRanges) {
        assert.equal(result, (mutationEndOffset + (mutatesCharacterRanges ? RANGE_MUTATION_TEXT.length : 1)) * RANGE_MUTATION_ITERATIONS);
        for (const range of mutationRanges) {
          assert.equal(range.startContainer, mutationNode); assert.equal(range.endContainer, mutationNode);
          assert.equal(range.startOffset, mutationStartOffset); assert.equal(range.endOffset, mutationEndOffset);
        }
        if (mutatesCharacterRanges) assert.equal(mutationNode.data, mutationOriginalText);
        else assert.equal(mutationRow.parentNode, null);
      }
      if (insertsNodes) {
        assert.equal(insertionParent.childNodes.length, size + RANGE_INSERTION_ITERATIONS);
        assert.equal(insertionRange.startContainer, insertionParent); assert.equal(insertionRange.endContainer, insertionParent);
        assert.equal(insertionRange.startOffset, insertionOffset); assert.equal(insertionRange.endOffset, insertionOffset + RANGE_INSERTION_ITERATIONS);
        for (const [index, node] of insertionNodes.entries()) {
          assert.equal(insertionParent.childNodes[insertionOffset + RANGE_INSERTION_ITERATIONS - 1 - index], node);
        }
      }
      if (removesContent) {
        assert.equal(document.querySelectorAll('tr').length, 2);
        assert.equal(document.querySelector('table').textContent, `Row ${String(size - 1).at(-1)}`);
        assert.equal(contentRange.startContainer, document.querySelector('tbody'));
        assert.equal(contentRange.startOffset, 1); assert.equal(contentRange.endOffset, 1);
        assert.equal(contentRange.collapsed, true);
      }
      if (contentOperation === 'cloneContents' || contentOperation === 'extractContents') {
        assert.equal(result.nodeType, dom.window.Node.DOCUMENT_FRAGMENT_NODE);
        assert.equal(result.querySelectorAll('tr').length, size);
        assert.equal(result.textContent, expectedText.slice(4, -1));
        if (!removesContent) { assert.equal(textRoot.textContent, expectedText); assert.equal(contentRange.startOffset, 4); }
      }
      if (name === 'range-control-1000') {
        assert.equal(result, Math.floor(RANGE_STATE_ITERATIONS / 2));
        assert.equal(lastRange.startOffset, 0); assert.equal(lastRange.endOffset, 2); assert.equal(lastRange.collapsed, false);
      }
      if (name === 'range-state-lifecycle-1000') assert.equal(result, expectedStateUnits * 3 + RANGE_STATE_ITERATIONS);
      if (name === 'range-boundaries-100') {
        const expectedIndex = (RANGE_BOUNDARY_ITERATIONS - 1) % size;
        assert.equal(result, RANGE_BOUNDARY_ITERATIONS);
        assert.equal(lastRange.startContainer, rangeNodes[expectedIndex].parentNode);
        assert.equal(lastRange.startOffset, expectedIndex);
        assert.equal(lastRange.endOffset, expectedIndex);
        assert.equal(lastRange.toString(), '');
      }
      if (name === 'range-point-1000' || name === 'range-text-point-1000') assert.equal(result, -1000 + 3 * Math.floor(1000 / size));
      if (stringifyReads) {
        assert.equal(result, expectedText);
        assert.equal(consumedTextUnits, expectedText.length * stringifyReads);
      }
    }
    assert.equal(dom.window.document.querySelector('a').textContent, removesContent ? 'Row ' : 'Row 0 & value');
    const fragmentOutput = createsContextFragment || contentOperation === 'cloneContents' || contentOperation === 'extractContents'
      ? new dom.window.XMLSerializer().serializeToString(result) : '';
    const insertionOutput = insertionDocument ? new dom.window.XMLSerializer().serializeToString(insertionDocument) : '';
    const shadowOutput = shadowRoots ? shadowRoots.map((root) => `${root.mode}:${root.innerHTML}`).join('|') : '';
    const checksum = createHash('sha256').update(dom.serialize()).update(fragmentOutput).update(insertionOutput).update(shadowOutput).digest('hex');
    if (outputHash) assert.equal(checksum, outputHash);
    outputHash = checksum;
    result = null;
    insertionDocument = null;
    if (eventHost) eventHost.removeEventListener('mouseover', eventListener);
    eventHost = null; relatedHost = null; relatedTarget = null; eventListener = null;
    shadowRoots = null; shadowTarget = null;
    if (cleanup) await cleanup();
    else dom.window.close();
    cleanup = null;
    target = null;
    dom = null;
    // Let pending DOM readiness callbacks release references before the next GC.
    await new Promise((resolve) => setImmediate(resolve));
    global.gc?.();
    if (sample >= WARMUP_SAMPLES) {
      samplesMs.push(elapsed);
      memory.push(process.memoryUsage());
    }
  }
  return { name, rows: size, inputBytes: Buffer.byteLength(html), outputHash, samplesMs, memoryAfterCleanup: memory };
}

/**
 * Execute public workloads and prove the native route was exercised when expected.
 * @returns {Promise<void>} Writes one structured result to stdout.
 */
async function main() {
  const workloads = [];
  const plan = [
    ...[25, 250, 1000].flatMap((size) => ['construct-native-eligible', 'innerHTML'].map((name) => ({ name, size }))),
    ...['construct-script-compatible', 'selectors-100', 'mutations-100', 'character-data-100', 'attribute-data-100',
      'attribute-collections-100', 'node-equality-100', 'node-position-1000', 'namespace-lookup-1000'].map((name) => ({ name, size: 250 })),
    ...['environment-setup', 'environment-vm-setup'].map((name) => ({ name, size: 25 })),
    { name: 'node-position-1000', size: 1000 },
    ...[250, 1000].flatMap((size) => ['node-roots-shallow-1000', 'node-roots-deep-1000'].map((name) => ({ name, size }))),
    ...[25, 100].map((size) => ({ name: 'shadow-roots-1000', size })),
    { name: 'shadow-hosts-create-100', size: 25 },
    ...[10, 30].map((size) => ({ name: 'shadow-retarget-events-100', size })),
    ...[25, 100].flatMap((size) => ['slot-lookup-1000', 'slot-reassign-100'].map((name) => ({ name, size }))),
    ...[25, 100].flatMap((size) => ['slot-assigned-100', 'slot-dense-reassign-100'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['node-value-writes-1000', 'node-text-writes-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['document-comments-insert-100', 'document-duplicate-element-100'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['document-comments-replace-100', 'document-root-replace-100'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'text-content-100', size })),
    ...[250, 1000].flatMap((size) => ['normalize-split-text', 'normalize-isolated-text'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['range-compare-1000', 'range-point-1000', 'range-text-point-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-boundaries-100', size })),
    ...[250, 1000].flatMap((size) => ['range-state-read-1000', 'range-state-lifecycle-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-control-1000', size })),
    ...[250, 1000].map((size) => ({ name: 'range-insert-node-100', size })),
    ...[250, 1000].map((size) => ({ name: 'range-context-fragment', size })),
    ...[250, 1000].flatMap((size) => ['range-character-mutations-100', 'range-tree-mutations-100'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => Object.keys(RANGE_CONTENT_OPERATIONS).map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-surround-contents', size })),
    ...[250, 1000].flatMap((size) => Object.keys(RANGE_STRINGIFICATION_READS).map((name) =>
      ({ name, size, manualOnly: RANGE_STRINGIFICATION_READS[name] > 1 }))),
    ...[250, 1000].map((size) => ({ name: 'serialize-utf8', size })),
  ];
  const requested = new Set(process.argv.slice(3));
  for (const name of requested) assert.ok(plan.some((workload) => workload.name === name), `Unknown benchmark workload: ${name}`);
  const selected = plan.filter(({ name, manualOnly }) => requested.size === 0 ? !manualOnly : requested.has(name));
  for (const { name, size } of selected) {
    process.stderr.write(`Benchmark ${engine}: starting ${name}/${size}\n`);
    workloads.push(await measure(name, size));
    process.stderr.write(`Benchmark ${engine}: completed ${name}/${size}\n`);
  }
  const parserStatistics = runtime.getParserStatistics?.();
  const nativeTreeStatistics = runtime.getNativeTreeStatistics?.();
  if (engine === 'rustdom') {
    assert.ok(parserStatistics.nativeDocument > 0);
    if (selected.some(({ name }) => name === 'innerHTML')) assert.ok(parserStatistics.nativeFragment > 0);
    if (selected.some(({ name }) => name === 'construct-script-compatible')) assert.ok(parserStatistics.fallback['document-scripts'] > 0);
    if (nativeTreeStatistics) assert.ok(nativeTreeStatistics.mutations > 0);
  }
  process.stdout.write(JSON.stringify({ engine, warmupSamples: WARMUP_SAMPLES,
    measuredSamples: MEASURED_SAMPLES, workloads, parserStatistics, nativeTreeStatistics }));
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
