/** @file Verifies metadata-kind lookup through real initialization, retyping and failed native writes. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree, NodeInsertionStatus } = require('../dist/native.cjs');

test('should observe every native metadata initializer through insertion constraints', () => {
  const initializers = [
    ['snapshot Element', (tree, node) => tree.setData(node, '{"kind":1,"name":"root"}'), NodeInsertionStatus.Ready],
    ['HTML Element', (tree, node) => tree.setHtmlElement(node, 'root', []), NodeInsertionStatus.Ready],
    ['Element attributes', (tree, node) => tree.setElementFromAttributes(node, '{"kind":1,"name":"root"}', []), NodeInsertionStatus.Ready],
    ['HTML attributes', (tree, node) => tree.setHtmlElementFromAttributes(node, 'root', []), NodeInsertionStatus.Ready],
    ['Element metadata', (tree, node) => tree.setElementMetadata(node, '{"kind":1,"name":"root"}'), NodeInsertionStatus.Ready],
    ['HTML metadata', (tree, node) => tree.setHtmlElementMetadata(node, 'root'), NodeInsertionStatus.Ready],
    ['Text', (tree, node) => tree.setCharacterData(node, 3, 'value'), NodeInsertionStatus.InvalidParentForNode],
    ['Comment', (tree, node) => tree.setCharacterData(node, 8, 'value'), NodeInsertionStatus.Ready],
    ['Attr', (tree, node) => tree.initializeAttribute(node, '{"kind":2,"name":"name","value":"value"}'), NodeInsertionStatus.InvalidNodeType],
    ['DocumentType', (tree, node) => tree.initializeDocumentType(node, 'root', '', ''), NodeInsertionStatus.Ready],
    ['ProcessingInstruction', (tree, node) => { tree.setCharacterData(node, 7, 'value'); tree.initializeProcessingInstructionTarget(node, 'target'); }, NodeInsertionStatus.Ready],
    ['Document', (tree, node) => tree.setData(node, '{"kind":9}'), NodeInsertionStatus.InvalidNodeType],
    ['Fragment', (tree, node) => tree.setData(node, '{"kind":11}'), NodeInsertionStatus.Ready],
    ['unknown kind', (tree, node) => tree.setData(node, '{"kind":0}'), NodeInsertionStatus.InvalidNodeType],
  ];
  for (const [name, initialize, expected] of initializers) {
    const tree = new NativeTree(); const document = tree.allocate(); tree.setData(document, '{"kind":9}');
    const node = tree.allocate(); initialize(tree, node); const before = tree.statistics();
    assert.equal(tree.preInsertConstraints(document, node, 0), expected, name);
    tree.getLinks(node); tree.descendants(node);
    assert.equal(tree.preInsertConstraints(document, node, 0), expected, `${name} after topology reads`);
    assert.deepEqual(tree.statistics(), before, name);
    tree.release(node); tree.release(document);
    assert.equal(tree.statistics().liveNodes, 0, name); assert.equal(tree.statistics().dataNodes, 0, name);
  }
});

test('should update linked node kinds while preserving metadata and reservations after rejected writes', () => {
  const tree = new NativeTree(); const document = tree.allocate(); tree.setData(document, '{"kind":9}');
  const child = tree.allocate(); tree.append(document, child);
  const candidate = tree.allocate(); tree.setHtmlElement(candidate, 'candidate', []);
  assert.throws(() => tree.preInsertConstraints(document, candidate, 0), { code: 'InvalidArg' });
  tree.setHtmlElement(child, 'root', []);
  assert.equal(tree.preInsertConstraints(document, candidate, 0), NodeInsertionStatus.InvalidDocumentStructure);
  tree.setCharacterData(child, 8, 'comment');
  assert.equal(tree.preInsertConstraints(document, candidate, 0), NodeInsertionStatus.Ready);
  tree.setData(child, '{"kind":0}');
  assert.equal(tree.preInsertConstraints(document, child, 0), NodeInsertionStatus.InvalidNodeType);
  tree.setHtmlElement(child, 'root', []);
  const reserved = tree.reserveHandles(); const before = tree.statistics();
  for (const handle of [child, reserved]) {
    assert.throws(() => tree.setData(handle, '{invalid'), { code: 'InvalidArg' });
    assert.throws(() => tree.setData(handle, '{"kind":8,"templateContent":-1}'), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), before);
  assert.equal(tree.preInsertConstraints(document, candidate, 0), NodeInsertionStatus.InvalidDocumentStructure);
  tree.initializeAttributeCollection(child);
  assert.throws(() => tree.setCharacterData(child, 8, 'rejected'), { code: 'InvalidArg' });
  assert.equal(tree.preInsertConstraints(document, candidate, 0), NodeInsertionStatus.InvalidDocumentStructure);
  for (const handle of [child, candidate, document]) tree.release(handle);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(tree.statistics().dataNodes, 0);
});

test('should preserve kinds when metadata activates self and already initialized template handles', () => {
  const tree = new NativeTree(); const document = tree.allocate(); tree.setData(document, '{"kind":9}');
  const template = tree.allocate(); tree.setData(template, JSON.stringify({ kind: 1, name: 'template', templateContent: template }));
  assert.equal(tree.preInsertConstraints(document, template, 0), NodeInsertionStatus.Ready);
  const content = tree.allocate(); tree.setData(content, '{"kind":11}');
  tree.setData(template, JSON.stringify({ kind: 1, name: 'template', templateContent: content }));
  assert.equal(tree.preInsertConstraints(document, template, 0), NodeInsertionStatus.Ready);
  assert.equal(tree.preInsertConstraints(document, content, 0), NodeInsertionStatus.Ready);
  for (const node of [template, content, document]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(tree.statistics().dataNodes, 0);
});
