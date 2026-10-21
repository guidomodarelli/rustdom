/** @module benchmarks/node-clone Complete public clones/imports with all source, result and owner checks outside timing. */
'use strict';
const assert = require('node:assert/strict');
const { NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD, NODE_CLONE_VALUE, NODE_CLONE_NAMESPACE } = require('./constants/node-clone.cjs');

/**
 * Read the complete physical and template-content trees without adding a recursive serializer limit.
 * @param {Node} root - Actual public node.
 * @param {Document} [rootOwner] - Independently expected owner for result validation.
 * @param {Document|null} [templateOwner] - Independently expected inert destination document.
 * @returns {object[]} Ordered nodes, expected owners, depths and lossless public data.
 */
function scan(root, rootOwner = root.ownerDocument, templateOwner = null) {
  const entries = [], pending = [{ node: root, owner: rootOwner, depth: 0 }];
  while (pending.length > 0) {
    const { node, owner, depth } = pending.pop();
    const children = [...node.childNodes];
    const attributes = node.attributes ? [...node.attributes] : [];
    entries.push({ node, owner, attributes, attributeOwners: attributes.map((attribute) => attribute.ownerDocument),
      data: { depth, kind: node.nodeType, name: node.nodeName, value: node.nodeValue,
      namespace: node.namespaceURI ?? null, prefix: node.prefix ?? null, children: children.length,
      attributes: attributes.map((attribute) => [attribute.name, attribute.namespaceURI, attribute.localName, attribute.prefix, attribute.value]) } });
    for (let index = children.length - 1; index >= 0; index--) pending.push({ node: children[index], owner, depth: depth + 1 });
    if (node.localName === 'template' && node.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      pending.push({ node: node.content, owner: templateOwner ?? node.content.ownerDocument, depth: depth + 1 });
    }
  }
  return entries;
}

/**
 * Prepare detached inputs and an import destination before timing one complete public operation.
 * @param {object} runtime - Actual reference or native engine.
 * @param {Window} window - Original owner; fixture disposal must preserve its document.
 * @param {number} size - Attribute/child count or nesting depth.
 * @param {string} name - Public operation and fixture shape.
 * @returns {object} Timed operation, complete correctness checks, deterministic output and cleanup.
 */
function nodeCloneFixture(runtime, window, size, name) {
  assert.ok(NODE_CLONE_WORKLOADS.includes(name) || name === NESTED_TEMPLATE_CLONE_WORKLOAD, `Unsupported clone benchmark: ${name}`);
  const isTemplate = name.includes('template'), shallow = name.startsWith('clone-shallow');
  const importing = name.startsWith('import-');
  let document = window.document, destination = importing ? document.implementation.createHTMLDocument('destination') : document;
  let source = document.createElement(isTemplate ? 'template' : 'section'), copy = null;
  source.setAttribute('data-root', NODE_CLONE_VALUE);
  let parent = isTemplate ? source.content : source;
  if (name === 'clone-shallow-attributes') {
    for (let index = 0; index < size; index++) source.setAttributeNS(index % 2 === 0 ? null : NODE_CLONE_NAMESPACE,
      index % 2 === 0 ? `entry-${index}` : `p:entry-${index}`, `${index}:${NODE_CLONE_VALUE}`);
    source.append(document.createTextNode('excluded child'));
  } else if (name === 'clone-deep-chain' || name === NESTED_TEMPLATE_CLONE_WORKLOAD) {
    for (let index = 0; index < size; index++) {
      const child = document.createElement(isTemplate ? 'template' : 'div'); parent.append(child);
      parent = isTemplate ? child.content : child;
    }
    parent.append(document.createTextNode(NODE_CLONE_VALUE));
  } else {
    for (let index = 0; index < size; index++) {
      const child = document.createElement('span'); child.setAttributeNS(NODE_CLONE_NAMESPACE, 'p:key', String(index));
      child.append(document.createTextNode(`${index}:${NODE_CLONE_VALUE}`), document.createComment(`comment-${index}`));
      parent.append(child);
    }
    if (isTemplate) source.append(document.createTextNode('physical template child'));
  }
  let sourceEntries = scan(source);
  let expected = sourceEntries.map((entry) => entry.data);
  if (shallow) {
    expected = [{ ...expected[0], children: 0 }];
    if (isTemplate) expected.push({ ...sourceEntries[1].data, children: 0 });
  }
  const expectedCalls = sourceEntries.reduce((count, entry) => count +
    (entry.node === source || !shallow ? Number(entry.node.nodeType !== window.Node.DOCUMENT_FRAGMENT_NODE) + entry.data.attributes.length : 0), 0);
  const expectedTemplateSteps = sourceEntries.filter((entry) => entry.node.localName === 'template' && (entry.node === source || !shallow)).length;
  const before = runtime.getNativeTreeStatistics?.().nodeCloningOperations;
  return {
    /** @returns {Element} Actual prepared input, for behavioral validation of source independence. */
    get source() { return source; },
    /** @returns {Element|null} Actual public output, for independent ownership validation. */
    get result() { return copy; },
    /** @returns {number} Consume the returned node kind; all traversal and validation remain outside timing. */
    run() { copy = importing ? destination.importNode(source, !shallow) : source.cloneNode(!shallow); return copy.nodeType; },
    /** @param {number} result - Consumed public result. @returns {void} Verify every output value, source independence and owner. */
    validate(result) {
      assert.equal(result, window.Node.ELEMENT_NODE); assert.notEqual(copy, source);
      assert.equal(copy.parentNode, null); assert.equal(copy.ownerDocument, destination);
      if (before !== undefined) {
        const after = runtime.getNativeTreeStatistics().nodeCloningOperations;
        assert.equal(after.calls - before.calls, expectedCalls);
        assert.equal(after.templateSteps - before.templateSteps, expectedTemplateSteps); assert.equal(after.active, 0);
      }
      const templateOwner = isTemplate ? destination.createElement('template').content.ownerDocument : null;
      const copied = scan(copy, destination, templateOwner);
      assert.deepEqual(copied.map((entry) => entry.data), expected);
      const currentSource = scan(source);
      assert.deepEqual(currentSource.map((entry) => entry.data), sourceEntries.map((entry) => entry.data));
      for (const [index, entry] of currentSource.entries()) {
        const original = sourceEntries[index];
        assert.equal(entry.node, original.node, `Source node identity changed at ${index}`);
        assert.equal(entry.node.ownerDocument, original.owner, `Source node owner changed at ${index}`);
        for (const [attributeIndex, attribute] of entry.attributes.entries()) {
          assert.equal(attribute, original.attributes[attributeIndex], `Source Attr identity changed at ${index}/${attributeIndex}`);
          assert.equal(attribute.ownerElement, original.node);
          assert.equal(attribute.ownerDocument, original.attributeOwners[attributeIndex]);
        }
      }
      for (const [index, entry] of copied.entries()) {
        assert.notEqual(entry.node, sourceEntries[index].node);
        assert.equal(entry.node.ownerDocument, entry.owner, `Cloned node owner differs from destination at ${index}`);
        const originalAttributes = sourceEntries[index].node.attributes;
        for (const [attributeIndex, attribute] of [...(entry.node.attributes ?? [])].entries()) {
          assert.notEqual(attribute, originalAttributes.item(attributeIndex));
          assert.equal(attribute.ownerElement, entry.node); assert.equal(attribute.ownerDocument, entry.owner);
        }
      }
    },
    /** @returns {string} Full input and output data, including every template fragment, namespace and UTF16 unit. */
    serialize() { return JSON.stringify({ source: sourceEntries.map((entry) => entry.data), copy: scan(copy).map((entry) => entry.data) }); },
    /** @returns {void} Drop strong fixture references without changing the original owner document. */
    dispose() { copy = null; source = null; parent = null; sourceEntries = null; expected = null; destination = null; document = null; window = null; },
  };
}
module.exports = { nodeCloneFixture };
